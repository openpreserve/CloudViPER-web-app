# Kubernetes Deployment Guide

## Prerequisites

1. **Docker** installed and running
2. **kind** (Kubernetes in Docker) installed
3. **kubectl** installed
4. **Tilt** installed (for development workflow)

## Quick Start with Tilt (Recommended for Development)

### 1. Create kind Cluster
```bash
kind create cluster --config k8s/kind-config.yml
```

### 2. Start Tilt
```bash
# From project root
tilt up
```

Tilt will:
- Build and inject images directly into kind (no registry needed)
- Deploy all Kubernetes resources
- Enable live reload when you change code
- Forward port 30080 to localhost

**Access the app**: http://localhost:30080
**Tilt UI**: http://localhost:10350

### 3. Install Kubernetes Dashboard (Optional)
```bash
./k8s/setup-dashboard.sh
```

Get your login token:
```bash
kubectl -n kubernetes-dashboard create token admin-user
```

Then run in a separate terminal:
```bash
kubectl proxy
```

**Access dashboard**: http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/

## Troubleshooting

### Check Pod Status
```bash
kubectl get pods
kubectl describe pod <pod-name>
kubectl logs <pod-name>
```

### Check Services
```bash
kubectl get svc
```

### Check PV/PVC
```bash
kubectl get pv
kubectl get pvc
```

### Registry Issues
```bash
# Verify registry is running
docker ps | grep registry

# Check registry contents
curl http://localhost:5000/v2/_catalog

# Verify network connectivity
docker network inspect kind
```

### Restart Deployment
```bash
kubectl rollout restart deployment/viper-app
kubectl rollout restart deployment/mysql
```

## Clean Up

```bash
# Delete all resources
kubectl delete -f k8s/

# Delete cluster
kind delete cluster

# Stop registry
docker stop kind-registry
docker rm kind-registry
```

## Configuration Files

- `kind-config.yml` - Kind cluster configuration with registry mirror
- `mysql-pv.yaml` - PersistentVolume for MySQL data
- `mysql-pvc.yaml` - PersistentVolumeClaim for MySQL
- `mysql-deployment.yaml` - MySQL deployment and service
- `viper-app-configmap.yaml` - Non-sensitive configuration
- `viper-app-secret.yaml` - Sensitive configuration (base64 encoded)
- `viper-app-deployment.yaml` - Application deployment and service

## Environment Variables

### ConfigMap (Non-sensitive)
- DB_HOST, DB_PORT, DB_USER, DB_NAME
- MEMCACHED_HOST, PORT, SERVICE_URL
- APP_HOST, DOMAIN_NAME, NODE_ENV

### Secret (Sensitive - base64 encoded)
- MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD, DB_PASSWORD
- SENDGRID_API_KEY, MAILERSEND_API_KEY
- GOOGLE_AUTH_CLIENT_ID, GOOGLE_AUTH_CLIENT_SECRET
- APP_COOKIE_SECRET
