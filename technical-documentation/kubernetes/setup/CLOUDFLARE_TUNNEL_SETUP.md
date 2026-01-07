# Cloudflare Tunnel Setup Guide

This guide shows how to use Cloudflare Tunnel to eliminate the LoadBalancer and save $20/month.

## Benefits
- ✅ No LoadBalancer cost ($20/month savings)
- ✅ No public IPs exposed (more secure)
- ✅ Free Cloudflare SSL certificate
- ✅ Free DDoS protection
- ✅ Works behind NAT/firewalls
- ✅ Keep nginx-ingress for routing (just change to ClusterIP)

## Prerequisites
1. Cloudflare account (free)
2. Domain registered on Cloudflare (~$10/year)
3. `cloudflared` CLI installed locally

## Step 1: Install cloudflared locally
```bash
# macOS
brew install cloudflared

# Linux
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared
```

## Step 2: Login to Cloudflare
```bash
cloudflared tunnel login
```
This opens a browser to authorize the tunnel.

## Step 3: Create a tunnel
```bash
cloudflared tunnel create viper-tunnel
```
This creates a tunnel and generates credentials in `~/.cloudflared/`

Output example:
```
Tunnel credentials written to /home/user/.cloudflared/viper-tunnel.json
```

## Step 4: Create Kubernetes secret with credentials
```bash
kubectl create secret generic tunnel-credentials \
  --from-file=credentials.json=$HOME/.cloudflared/<TUNNEL-ID>.json
```

## Step 5: Configure DNS routing
```bash
# Route your domain to the tunnel
cloudflared tunnel route dns viper-tunnel vipercloud.cc
cloudflared tunnel route dns viper-tunnel *.vipercloud.cc
```

Or manually in Cloudflare Dashboard:
- Go to DNS settings
- Add CNAME record: `vipercloud.cc` → `<TUNNEL-ID>.cfargotunnel.com`

## Step 6: Update nginx-ingress to ClusterIP (remove LoadBalancer)
```bash
# Update nginx-ingress to use ClusterIP instead of LoadBalancer
helm upgrade nginx-ingress ingress-nginx/ingress-nginx \
  --set controller.service.type=ClusterIP \
  --namespace default
```

This removes the external LoadBalancer and associated $20/month cost.

## Step 7: Deploy cloudflared to your cluster
```bash
# Edit k8s/cloudflared-deployment.yaml and update tunnel name if needed
kubectl apply -f k8s/cloudflared-deployment.yaml
```

## Step 8: Verify tunnel is connected
```bash
# Check cloudflared pods are running
kubectl get pods -l app=cloudflared

# Check tunnel status
cloudflared tunnel list
cloudflared tunnel info viper-tunnel
```

## Step 9: Test access
```bash
curl -I https://vipercloud.cc
```

## Step 10: Clean up old LoadBalancer resources
```bash
# Release the static IP (since we don't need it anymore)
gcloud compute addresses delete viper-nginx-ip --region=europe-west1

# Old global IP can also be deleted if not in use
gcloud compute addresses delete viper-app-ip --global
```

## Traffic Flow

**Before (with LoadBalancer):**
```
Internet → vipercloud.cc
  → 34.76.253.108 (LoadBalancer $20/month)
  → nginx-ingress-controller
  → viper-app / viper-instances
```

**After (with Cloudflare Tunnel):**
```
Internet → vipercloud.cc
  → Cloudflare Edge (free SSL, DDoS)
  → Cloudflare Tunnel (encrypted)
  → cloudflared pod (in your cluster)
  → nginx-ingress-controller (ClusterIP)
  → viper-app / viper-instances
```

## Monitoring
```bash
# Check cloudflared logs
kubectl logs -l app=cloudflared -f

# Check nginx-ingress (should still work)
kubectl logs -l app.kubernetes.io/name=ingress-nginx -f
```

## Rollback (if needed)
```bash
# Switch nginx-ingress back to LoadBalancer
helm upgrade nginx-ingress ingress-nginx/ingress-nginx \
  --set controller.service.type=LoadBalancer \
  --set controller.service.loadBalancerIP=34.76.253.108 \
  --namespace default

# Delete cloudflared
kubectl delete -f k8s/cloudflared-deployment.yaml
kubectl delete secret tunnel-credentials

# Update DNS back to LoadBalancer IP
```

## Cost Comparison

| Setup | Monthly Cost |
|-------|--------------|
| Current (LoadBalancer) | ~$515 |
| With Cloudflare Tunnel | ~$495 |
| **Savings** | **$20/month** |

Plus domain is cheaper on Cloudflare (~$10/year vs Namecheap fees)

## Additional Cloudflare Features (Free)
- Page Rules (3 free)
- Analytics
- Firewall rules
- Rate limiting
- Bot protection
- Email routing

## Notes
- Cloudflare Tunnel is part of Cloudflare Zero Trust (free tier available)
- Tunnel automatically handles SSL/TLS (no cert-manager needed for edge)
- Let's Encrypt cert still works for pod-to-pod if needed
- nginx-ingress still handles all internal routing
- WebSocket support works out of the box
