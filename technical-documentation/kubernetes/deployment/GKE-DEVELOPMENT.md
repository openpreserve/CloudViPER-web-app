# Development Workflow on GKE

## Quick Update Workflows

### Option 1: Manual Build & Deploy (Simple)
```bash
# Make your code changes, then:
./scripts/build-and-push-to-gke.sh  # Builds and pushes image
kubectl rollout restart deployment/viper-app  # Restarts with new image
kubectl logs -f deployment/viper-app  # Watch logs
```

### Option 2: Using Tilt (Automated, Best for Active Development)
```bash
# After deploying initially, just run:
tilt up

# Tilt will:
# - Watch your code for changes
# - Automatically rebuild and push to Artifact Registry
# - Automatically update the deployment
# - Show logs in real-time
```

**To use Tilt with GKE:**
1. Make sure you're connected to GKE: `kubectl config current-context`
2. Run: `tilt up`
3. Open browser at: `http://localhost:10350`
4. Edit code → Tilt auto-rebuilds and deploys!

Press `space` in terminal to open the Tilt UI in browser, or `q` to quit.

## Database Management

### Accessing MySQL
```bash
# Port-forward to MySQL
kubectl port-forward svc/mysql 3306:3306

# Connect from another terminal
mysql -h 127.0.0.1 -u viper_user -p viper_db
# Password from your secret

# Or use a MySQL client GUI pointing to localhost:3306
```

### Manual Backup (Test Server)
```bash
# Backup database
kubectl exec -it deployment/mysql -- mysqldump -u viper_user -p viper_db > backup.sql

# Restore (if needed)
kubectl exec -i deployment/mysql -- mysql -u viper_user -p viper_db < backup.sql
```

### What Happens to Data

| Scenario | Data Survives? | Notes |
|----------|----------------|-------|
| Pod restarts | ✅ Yes | PVC stays attached |
| Deployment update | ✅ Yes | PVC persists |
| Cluster restart | ✅ Yes | Disk is in Google Cloud |
| Cluster deletion | ❌ No | PVC deleted by default |
| `kubectl delete pvc` | ❌ No | Explicitly deleted |

**For test server:** Don't worry about backups. Data survives normal operations.

**To preserve data when deleting cluster:**
```bash
# Find your PV
kubectl get pv

# Change reclaim policy to Retain
kubectl patch pv <pv-name> -p '{"spec":{"persistentVolumeReclaimPolicy":"Retain"}}'

# Now you can delete the cluster, and the disk remains in GCP
# You can reattach it to a new cluster later
```

## Switching Between Minikube and GKE

Your Tiltfile now automatically detects the context!

```bash
# Work with Minikube
kubectl config use-context minikube
tilt up  # Uses localhost:5000 registry

# Work with GKE
kubectl config use-context gke_opf-viper-cloud_australia-southeast2-a_viper-cluster
tilt up  # Uses Artifact Registry
```

## Common Development Tasks

### View Real-time Logs
```bash
# Application logs
kubectl logs -f deployment/viper-app

# All pods
kubectl logs -f -l app=viper-app

# Specific pod
kubectl logs -f <pod-name>

# Previous crashed container
kubectl logs --previous <pod-name>
```

### Debug a Pod
```bash
# Get shell in running pod
kubectl exec -it deployment/viper-app -- /bin/sh

# Or specific pod
kubectl exec -it <pod-name> -- /bin/sh

# Run a command
kubectl exec deployment/viper-app -- node -v
```

### Check Resource Status
```bash
# All resources
kubectl get all

# Pods with more details
kubectl get pods -o wide

# Describe a failing pod
kubectl describe pod <pod-name>

# Check events
kubectl get events --sort-by='.lastTimestamp'
```

### Update Configuration
```bash
# Edit ConfigMap
kubectl edit configmap viper-app-config

# Or apply changes from file
kubectl apply -f k8s/viper-app-configmap.yaml

# Restart to pick up changes
kubectl rollout restart deployment/viper-app
```

### Scale Application
```bash
# Scale to 3 replicas
kubectl scale deployment/viper-app --replicas=3

# Check status
kubectl get pods -l app=viper-app
```

## Performance Monitoring

### Check Resource Usage
```bash
# Node resources
kubectl top nodes

# Pod resources
kubectl top pods

# Specific deployment
kubectl top pods -l app=viper-app
```

### View Metrics in GCP Console
1. Go to: https://console.cloud.google.com/kubernetes
2. Select your cluster: `viper-cluster`
3. Click "Workloads" to see deployments
4. Click on `viper-app` for detailed metrics

## Cleanup

### Delete Just the Application
```bash
kubectl delete deployment viper-app
kubectl delete service viper-app
# Database and data remain
```

### Delete Everything (But Keep Cluster)
```bash
kubectl delete all --all
kubectl delete pvc --all
kubectl delete configmap --all
# Cluster remains, just resources deleted
```

### Delete Entire Cluster
```bash
# This deletes everything including data
gcloud container clusters delete viper-cluster --zone=australia-southeast2-a

# Also clean up the static IP
gcloud compute addresses delete viper-app-ip --global
```

## Cost Optimization for Test Server

### Pause When Not Using
```bash
# Scale down to 0 (no pods running, no compute cost)
kubectl scale deployment/viper-app --replicas=0
kubectl scale deployment/mysql --replicas=0

# Resume later
kubectl scale deployment/mysql --replicas=1
kubectl scale deployment/viper-app --replicas=1
```

### Resize Cluster
```bash
# Reduce nodes (e.g., to 1)
gcloud container clusters resize viper-cluster --num-nodes=1 --zone=australia-southeast2-a

# Increase later if needed
gcloud container clusters resize viper-cluster --num-nodes=3 --zone=australia-southeast2-a
```

### Use Preemptible Nodes (Cheaper, Can Be Interrupted)
When creating cluster, add: `--preemptible`

Good for test servers, saves ~70% on compute costs.

## Troubleshooting

### Pod Won't Start
```bash
# Check pod status
kubectl describe pod <pod-name>

# Common issues:
# - ImagePullBackOff: Image not in registry or auth issue
# - CrashLoopBackOff: Application crashing on start
# - Pending: Not enough resources or PVC issue
```

### Can't Access Ingress
```bash
# Check ingress status
kubectl get ingress
kubectl describe ingress viper-app-ingress

# GKE Ingress takes 5-10 minutes to provision
# Check backends are healthy:
# GCP Console → Network Services → Load Balancing
```

### Database Connection Issues
```bash
# Check MySQL pod
kubectl get pod -l app=mysql
kubectl logs deployment/mysql

# Verify service
kubectl get svc mysql

# Test connection from app pod
kubectl exec deployment/viper-app -- nc -zv mysql 3306
```

### Image Not Updating
```bash
# Force image pull
kubectl rollout restart deployment/viper-app

# Or delete the pod (it will recreate)
kubectl delete pod -l app=viper-app

# Verify image
kubectl describe deployment viper-app | grep Image
```
