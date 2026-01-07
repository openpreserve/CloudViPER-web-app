# ViPER Instance Monitoring - Kubernetes Migration Guide

## Problem Summary

The monitoring system (screenshots + activity tracking) worked in Docker but doesn't work in Kubernetes because:

1. **Runtime script injection doesn't work** - The `ViperInstanceService.ts` methods like `setupContainerSecurityAndMonitoring()` use Docker exec APIs that aren't called in the Kubernetes code path
2. **Scripts need to be baked into the image** - Kubernetes best practice is immutable containers
3. **Service URL needs to point to Kubernetes service** - Not external LoadBalancer

## The Solution: Three-Part Fix

### Part 1: Update Ansible Playbook (Build-Time)

Add monitoring scripts to your Ansible playbook so they're **baked into the container image**. See `docs/ANSIBLE_MONITORING_SETUP.md` for complete Ansible tasks.

**Key Points:**
- Scripts installed to `/usr/local/share/viper-monitoring/`
- Autostart via `/config/.config/autostart/viper-monitoring.desktop`
- Uses environment variables: `INSTANCE_UUID`, `STATUS_KEY`, `SERVICE_URL`
- Requires packages: `imagemagick`, `xdotool`, `xinput`, `curl`

### Part 2: Update Pod Spec Environment Variables

The monitoring scripts use environment variables that are already passed to pods:

```typescript
// In ViperInstanceService.ts - already correct!
env: [
  { name: 'INSTANCE_UUID', value: instanceUUID },     // ✅
  { name: 'STATUS_KEY', value: statusKey },           // ✅
  { name: 'SERVICE_URL', value: process.env.SERVICE_URL || '' }, // ⚠️ Fix this
  { name: 'DOMAIN_NAME', value: DOMAIN_NAME },
  // ...
]
```

**Fix the SERVICE_URL:**

In `k8s/viper-app-configmap.yaml`:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: viper-app-config
data:
  SERVICE_URL: "http://viper-app:3000"  # ← Kubernetes ClusterIP service
```

### Part 3: Allow HTTP for Internal /service/ Endpoints

Already done! The app.ts correctly bypasses HTTPS redirect for:
- Internal pod IPs (10.x.x.x)
- Kubernetes service name (`viper-app`)
- `/service/*` endpoints

```typescript
// app.ts - Updated
const isInternalRequest = 
    req.ip?.startsWith('10.') ||  // Kubernetes pod network  
    req.hostname === 'viper-app' || // Kubernetes service name
    req.hostname === 'localhost';

const isServiceEndpoint = req.path.startsWith('/service/');

if (isInternalRequest && isServiceEndpoint) {
    return next(); // Skip HTTPS redirect
}
```

## Implementation Checklist

- [ ] 1. Update Ansible playbook with monitoring tasks (see ANSIBLE_MONITORING_SETUP.md)
- [ ] 2. Rebuild viper container image with Ansible
- [ ] 3. Push new image to your registry (darrenopf/opf-cloud-viper:docker-0.0.18 or similar)
- [ ] 4. Update SERVICE_URL in `k8s/viper-app-configmap.yaml` to `http://viper-app:3000`
- [ ] 5. Apply ConfigMap changes: `kubectl apply -f k8s/viper-app-configmap.yaml`
- [ ] 6. Rebuild and deploy web-app (for app.ts hostname fix)
- [ ] 7. Create a new viper instance to test monitoring

## Testing the Fix

After deploying:

### 1. Check monitoring processes are running:
```bash
POD=$(kubectl get pods -l app=viper-instance -o jsonpath='{.items[0].metadata.name}')
kubectl exec $POD -c viper -- ps aux | grep monitoring
```

Expected output:
```
abc      123  activity-monitor.sh
abc      124  screenshot-capture.sh
```

### 2. Check monitoring logs:
```bash
kubectl exec $POD -c viper -- tail -f /var/log/activity-monitor.log
kubectl exec $POD -c viper -- tail -f /var/log/screenshot-capture.log
```

### 3. Check database for activity:
```bash
kubectl exec -it $(kubectl get pod -l app=mysql -o jsonpath='{.items[0].metadata.name}') -- \
  mysql -u root -p'<PASSWORD>' -D viper_db -e \
  "SELECT instanceUUID, mouseEvents, keyboardEvents, lastActivity FROM Activities ORDER BY lastActivity DESC LIMIT 5;"
```

### 4. Check screenshots in database:
```bash
kubectl exec -it $(kubectl get pod -l app=mysql -o jsonpath='{.items[0].metadata.name}') -- \
  mysql -u root -p'<PASSWORD>' -D viper_db -e \
  "SELECT instanceUUID, capturedAt, LENGTH(imageData) as size FROM Screenshots ORDER BY capturedAt DESC LIMIT 5;"
```

### 5. Test via web app:
- Login as admin
- Go to admin dashboard
- View instances - should show activity and screenshots

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Viper Instance Pod (viper-instance-xyz123)                  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Container: viper (darrenopf/opf-cloud-viper)           │ │
│  │                                                         │ │
│  │  - KasmVNC (X server on :1)                            │ │
│  │  - XFCE Desktop                                        │ │
│  │                                                         │ │
│  │  Monitoring (Autostart):                               │ │
│  │  ├─ activity-monitor.sh                                │ │
│  │  │   └─ POST http://viper-app:3000/service/activity/  │ │
│  │  └─ screenshot-capture.sh                              │ │
│  │      └─ POST http://viper-app:3000/service/screenshot/ │ │
│  │                                                         │ │
│  │  Environment:                                          │ │
│  │  - INSTANCE_UUID=xyz123                                │ │
│  │  - STATUS_KEY=abc...                                   │ │
│  │  - SERVICE_URL=http://viper-app:3000                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Container: nginx-proxy                                 │ │
│  │  - Handles path routing                                │ │
│  │  - WebSocket upgrades                                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ HTTP (no SSL inside cluster)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ ViPER Web App (viper-app)                                   │
│  ClusterIP Service: viper-app:3000                          │
│                                                              │
│  Routes:                                                     │
│  - POST /service/activity/:uuid (no HTTPS redirect)         │
│  - POST /service/screenshot/:uuid (no HTTPS redirect)       │
│                                                              │
│  Database: MySQL                                            │
│  - Activities table                                         │
│  - Screenshots table                                        │
└─────────────────────────────────────────────────────────────┘
```

## Differences from Docker Setup

| Aspect | Docker | Kubernetes |
|--------|--------|------------|
| Script Injection | Runtime (container.exec) | Build-time (Ansible) |
| Service URL | http://cloud-viper-gui-app:3000 | http://viper-app:3000 |
| Network | Docker bridge (172.x.x.x) | Pod network (10.x.x.x) |
| Persistence | `/config` volume mount | Ephemeral (scripts in `/usr/local`) |
| Lifecycle | Manual removal | Kubernetes manages |

## Troubleshooting

### Scripts don't start
- Check autostart file exists: `ls -la /config/.config/autostart/viper-monitoring.desktop`
- Check X server: `DISPLAY=:1 xdpyinfo`
- Check logs: `tail -f /var/log/activity-monitor.log`

### HTTP requests failing
- Verify SERVICE_URL: `echo $SERVICE_URL`
- Test connectivity: `curl -v http://viper-app:3000/healthz`
- Check DNS: `nslookup viper-app`

### Screenshots not appearing
- Check ImageMagick: `which import`
- Test screenshot: `DISPLAY=:1 import -window root /tmp/test.png`
- Check base64 size: `ls -lh /tmp/screenshot.png`

### Activity not tracking
- Check xdotool: `DISPLAY=:1 xdotool getactivewindow`
- Check xinput: `xinput list`
- Verify environment vars: `env | grep INSTANCE_UUID`

## Next Steps

1. Once monitoring is working, consider adding these features:
   - Auto-shutdown inactive instances after X hours
   - Email notifications for low activity
   - Historical activity graphs
   - Screenshot carousel in admin UI

2. Optimize monitoring intervals:
   - Activity: Currently 60s, could reduce to 30s
   - Screenshots: Currently 300s (5min), adjust as needed
   
3. Consider adding health checks to monitoring scripts:
   - Restart if they crash
   - Alert if not reporting for > 10 minutes

## Resources

- Ansible playbook tasks: `docs/ANSIBLE_MONITORING_SETUP.md`
- Original Docker monitoring code: `web-app/src/services/ViperInstanceService.ts` (lines 570-865)
- Service routes: `web-app/src/routes/service.ts`
- Activity endpoint: Line 1386
- Screenshot endpoint: Line 1293
