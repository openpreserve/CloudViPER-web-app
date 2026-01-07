# Using Google-Generated Domains

## Quick Start

### For Local Development (kind)
```bash
tilt up
# Access: http://localhost:30080
```

### For GKE Deployment with Auto-Generated Domain
```bash
# Deploy to GKE with automatic HTTPS domain
./scripts/deploy-to-gke.sh

# Result: https://cloud-viper-abc12345.endpoints.YOUR-PROJECT.cloud.goog
```

## How It Works

### 1. **Automatic Domain Generation**

When you deploy to GKE, the script:
1. Reserves a static IP: `35.123.45.67`
2. Generates a unique domain: `cloud-viper-abc12345.endpoints.project-id.cloud.goog`
3. Creates a Google-managed SSL certificate
4. Creates an Ingress that routes traffic to your app

### 2. **Your App Auto-Detects the URL**

The app includes Kubernetes API access to detect its own URL:

```typescript
// In your code:
import { getPublicUrl } from './utility/detectServiceUrl';

const myUrl = await getPublicUrl();
// Returns: "https://cloud-viper-abc12345.endpoints.project-id.cloud.goog"
```

**Detection order:**
1. Checks `APP_PUBLIC_URL` env var (custom domain)
2. Reads Ingress hostname from Kubernetes
3. Reads LoadBalancer IP from Service
4. Falls back to localhost (development)

### 3. **Use Cases**

```typescript
// OAuth callbacks
const googleCallbackUrl = await getOAuthCallbackUrl('google');
// → https://cloud-viper-abc12345.endpoints.project.cloud.goog/account/auth/google/callback

// Password reset emails
const resetLink = `${await getPublicUrl()}/account/reset-password?token=${token}`;

// API documentation
const apiBaseUrl = await getPublicUrl();
```

## Architecture

### Local Development (kind)
```
Browser → localhost:30080 → kind cluster → viper-app (NodePort)
```

### GKE Production
```
Browser → cloud-viper-abc.endpoints.project.cloud.goog
    ↓ (DNS)
Static IP: 35.123.45.67
    ↓ (HTTPS - Google-managed cert)
GCP Load Balancer
    ↓ (Ingress)
viper-app Service (ClusterIP)
    ↓
viper-app Pod
```

## Components

### k8s/ingress.yaml
- Creates Ingress resource
- References ManagedCertificate
- Routes traffic to viper-app service

### k8s/viper-app-rbac.yaml
- ServiceAccount for the app
- Permissions to read Services and Ingresses
- Allows app to discover its own URL

### k8s/viper-app-deployment.yaml
- Uses ServiceAccount for Kubernetes API access
- Injects POD_NAMESPACE env var
- Changed Service from NodePort → ClusterIP

### web-app/src/utility/detectServiceUrl.ts
- Detects public URL from Kubernetes resources
- Priority: env var → Ingress → LoadBalancer → localhost
- Used throughout app for absolute URLs

## Benefits

✅ **No DNS management** - Google handles everything
✅ **Auto HTTPS** - Managed certificates (10-15 min provisioning)
✅ **Professional URLs** - `*.endpoints.*.cloud.goog`
✅ **App knows its URL** - Automatic detection
✅ **Easy upgrades** - Can migrate to custom domain later

## Monitoring

```bash
# Check certificate status
kubectl describe managedcertificate viper-app-cert

# Check Ingress
kubectl get ingress viper-app-ingress
kubectl describe ingress viper-app-ingress

# Check app logs for URL detection
kubectl logs -f deployment/viper-app | grep "Detected"

# Check if app can access Kubernetes API
kubectl logs deployment/viper-app | grep "Ingress\|LoadBalancer"
```

## Troubleshooting

### Certificate stuck in "Provisioning"
```bash
# Check certificate status
kubectl describe managedcertificate viper-app-cert

# Common causes:
# - Domain not pointing to correct IP (check DNS)
# - Takes 10-15 minutes normally
# - Ingress must be healthy first
```

### App can't detect URL
```bash
# Check RBAC permissions
kubectl auth can-i get ingresses --as=system:serviceaccount:default:viper-app

# Check ServiceAccount is attached
kubectl get pod -l app=viper-app -o jsonpath='{.items[0].spec.serviceAccountName}'

# Should return: viper-app
```

### "403 Forbidden" from Kubernetes API
```bash
# Recreate RBAC
kubectl apply -f k8s/viper-app-rbac.yaml

# Restart pods
kubectl rollout restart deployment/viper-app
```

## Migration to Custom Domain

If you want to use your own domain later:

```bash
# 1. Point your domain to the static IP
# viper.mycompany.com → 35.123.45.67

# 2. Update ConfigMap
kubectl patch configmap viper-app-config \
  --patch '{"data":{"APP_PUBLIC_URL":"https://viper.mycompany.com"}}'

# 3. Update ManagedCertificate
kubectl patch managedcertificate viper-app-cert \
  --type merge \
  --patch '{"spec":{"domains":["viper.mycompany.com"]}}'

# 4. Update Ingress host
kubectl patch ingress viper-app-ingress \
  --type json \
  --patch '[{"op":"replace","path":"/spec/rules/0/host","value":"viper.mycompany.com"}]'

# 5. Restart app
kubectl rollout restart deployment/viper-app
```

## Files Changed

- ✅ `k8s/ingress.yaml` - New Ingress with ManagedCertificate
- ✅ `k8s/viper-app-rbac.yaml` - New ServiceAccount + RBAC
- ✅ `k8s/viper-app-deployment.yaml` - Added ServiceAccount, POD_NAMESPACE env
- ✅ `k8s/viper-app-deployment.yaml` - Service: NodePort → ClusterIP
- ✅ `k8s/viper-app-configmap.yaml` - Added SERVICE_NAME, POD_NAMESPACE
- ✅ `web-app/src/utility/detectServiceUrl.ts` - New URL detection utility
- ✅ `scripts/deploy-to-gke.sh` - Automated GKE deployment script
- ✅ `Tiltfile` - Added RBAC, updated port forwarding

## Next Steps

1. Test locally with kind: `tilt up`
2. Deploy to GKE: `./scripts/deploy-to-gke.sh`
3. Wait for certificate provisioning (10-15 min)
4. Access your app via the generated URL
5. Check app logs to verify URL detection
