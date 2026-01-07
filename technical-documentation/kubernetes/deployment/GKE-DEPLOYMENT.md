# GKE Deployment Guide for ViPER Cloud

## Quick Start

### 1. Build and Push Image to Artifact Registry
```bash
./scripts/build-and-push-to-gke.sh
```

This will:
- Authenticate with your existing Artifact Registry
- Build the Docker image
- Push it to `europe-west1-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/web-app:latest`

### 2. Create Secrets
```bash
# Copy the example secret file
cp k8s/viper-app-secret.yaml.example k8s/viper-app-secret.yaml

# Edit with your actual base64-encoded values
nano k8s/viper-app-secret.yaml

# Apply the secret
kubectl apply -f k8s/viper-app-secret.yaml
```

**To encode values:**
```bash
echo -n 'your-value' | base64
```

### 3. Deploy to GKE
```bash
./scripts/deploy-to-gke-simple.sh
```

This will:
- Create or connect to your GKE cluster
- Reserve a static IP address
- Generate an auto-resolving domain using nip.io
- Deploy MySQL, the web app, and configure ingress
- Output the URL where your app is accessible

## What Changed for GKE

### ✅ Image Registry
- **Before:** `localhost:5000/web-app:latest` (minikube)
- **After:** `europe-west1-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/web-app:latest`

### ✅ Storage
- **Before:** Manual PersistentVolume creation
- **After:** GKE dynamic provisioning with `standard-rwo` storage class

### ✅ Ingress Controller
- **Before:** nginx ingress controller (minikube addon)
- **After:** GCE ingress controller (GKE native)
- **Instance Routing:** Each ViPER instance gets its own Ingress resource
- **WebSocket Support:** Uses GKE BackendConfig for WebSocket timeouts

### ✅ Domain & SSL
- **Development:** Uses nip.io for automatic DNS (no SSL)
- **Production:** Can use Google-managed SSL certificates with custom domain

## Instance Routing Architecture

### How it works:
1. Main app serves on `/` via main ingress
2. When a user creates an instance, the app creates:
   - A Pod for the ViPER container
   - A Service to expose the Pod
   - A BackendConfig for WebSocket support
   - An Ingress to route `/viper-instances/{UUID}/*` to that specific service

### Example:
- Main app: `http://35-1-2-3.nip.io/` → `viper-app` service
- Instance 1: `http://35-1-2-3.nip.io/viper-instances/abc123def456/` → `viper-svc-abc123def456` service
- Instance 2: `http://35-1-2-3.nip.io/viper-instances/xyz789uvw012/` → `viper-svc-xyz789uvw012` service

This is different from nginx's regex-based routing but works perfectly with GKE's LoadBalancer.

## DockerHub Images

**Question:** Can I reference DockerHub images?
**Answer:** YES! Your web-app can reference any public DockerHub images. GKE will pull them automatically.

Example in your code:
```typescript
image: 'darrenopf/opf-cloud-viper:docker-0.0.17'  // ✅ This works fine
```

Only your main web-app image needs to be in Artifact Registry because it's built from source.

## Useful Commands

### Check Deployment Status
```bash
kubectl get pods
kubectl get services
kubectl get ingress
```

### View Logs
```bash
# Application logs
kubectl logs -f deployment/viper-app

# MySQL logs
kubectl logs -f deployment/mysql

# Specific pod logs
kubectl logs -f <pod-name>
```

### Access Database
```bash
# Port-forward to MySQL
kubectl port-forward svc/mysql 3306:3306

# Then connect locally
mysql -h 127.0.0.1 -u viper_user -p viper_db
```

### Update Application
```bash
# Build and push new image
./scripts/build-and-push-to-gke.sh

# Restart deployment to pull new image
kubectl rollout restart deployment/viper-app

# Watch rollout status
kubectl rollout status deployment/viper-app
```

### Cleanup
```bash
# Delete all resources in namespace
kubectl delete all --all -n default

# Delete the cluster entirely
gcloud container clusters delete viper-cluster --zone=europe-west1-b

# Release the static IP
gcloud compute addresses delete viper-app-ip --global
```

## Production Considerations

### 1. Custom Domain with SSL
To use a custom domain with automatic SSL:

```yaml
apiVersion: networking.gke.io/v1
kind: ManagedCertificate
metadata:
  name: viper-app-cert
spec:
  domains:
    - yourdomain.com
    - www.yourdomain.com
```

Then update the Ingress annotation:
```yaml
annotations:
  networking.gke.io/managed-certificates: "viper-app-cert"
```

Point your DNS A record to the static IP address.

### 2. Scaling
```bash
# Scale the application
kubectl scale deployment/viper-app --replicas=3

# Enable autoscaling
kubectl autoscale deployment/viper-app --min=2 --max=10 --cpu-percent=70
```

### 3. Monitoring
- Use Google Cloud Console → Kubernetes Engine → Workloads
- Set up Cloud Monitoring and Logging
- Configure alerts for pod failures

### 4. Backup
- Use GKE's built-in backup features
- Or configure MySQL backups to Cloud Storage
- Consider using Cloud SQL instead of self-hosted MySQL

## Troubleshooting

### Ingress not working
```bash
# Check ingress status
kubectl describe ingress viper-app-ingress

# Common issue: Ingress takes 5-10 minutes to provision
# Wait and check: kubectl get ingress -w
```

### Pod not starting
```bash
# Check pod status
kubectl describe pod <pod-name>

# Check logs
kubectl logs <pod-name>

# Common issue: Image pull errors
# Verify: docker pull europe-west1-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/web-app:latest
```

### Database connection issues
```bash
# Check MySQL pod
kubectl get pod -l app=mysql

# Check MySQL logs
kubectl logs -f deployment/mysql

# Verify secret exists
kubectl get secret viper-app-secret -o yaml
```

## Cost Optimization

- Use preemptible nodes for non-production: `--preemptible`
- Enable cluster autoscaling
- Use smaller machine types for development
- Clean up unused resources regularly
- Consider regional clusters for high availability

## Next Steps

1. Set up a CI/CD pipeline (Cloud Build, GitHub Actions)
2. Configure custom domain and SSL certificate
3. Set up monitoring and alerting
4. Configure database backups
5. Implement horizontal pod autoscaling
6. Add health checks and readiness probes
