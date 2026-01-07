# GKE Cluster Configuration Backup - CloudViPER

**Backup Date:** January 5, 2026  
**Project ID:** opf-viper-cloud  
**Cluster Name:** viper-cluster  
**Location:** australia-southeast2-a (Sydney, Australia)  
**Purpose:** Complete cluster documentation before shutdown to enable easy recreation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Cluster Overview](#cluster-overview)
3. [Cost Analysis](#cost-analysis)
4. [Kubernetes Resources](#kubernetes-resources)
5. [GCP Resources](#gcp-resources)
6. [Application Configuration](#application-configuration)
7. [Recreation Instructions](#recreation-instructions)
8. [Deletion Plan](#deletion-plan)

---

## Executive Summary

This document provides a complete backup of the CloudViPER GKE cluster configuration. The cluster has been running for approximately 66 days and contains:

- **1 active node** (e2-standard-2) running at 6% CPU, 43% memory
- **2 main applications**: viper-app (web application) and MySQL database
- **17 dynamic viper instance services** (currently idle)
- **Static IP addresses** for ingress
- **Cert-manager** for TLS certificate management
- **10GB persistent disk** for MySQL data

**Current Status:** Cluster is healthy but underutilized, making it a good candidate for shutdown to reduce costs.

---

## Cluster Overview

### Cluster Basic Information

```yaml
Cluster Name: viper-cluster
Project: opf-viper-cloud
Location: australia-southeast2-a
Type: Standard (non-Autopilot)
Created: October 31, 2025
Age: 66 days
Status: RUNNING

Kubernetes Version:
  Control Plane: 1.33.5-gke.1308000
  Nodes: 1.33.5-gke.1308000
  Release Channel: REGULAR
```

### Network Configuration

```yaml
Network: default
Subnetwork: default (australia-southeast2)
Cluster IPv4 CIDR: 10.24.0.0/14
Services IPv4 CIDR: 34.118.224.0/20
Pod IPv4 Range: gke-viper-cluster-pods-93db22df

Endpoints:
  Public Endpoint: 34.126.199.33
  Private Endpoint: 10.192.0.6
  DNS Endpoint: gke-93db22df975043689a395bf4df371b7e7cc7-543135495270.australia-southeast2-a.gke.goog
```

### Node Pool Configuration

```yaml
Node Pool Name: default-pool
Initial Node Count: 3
Current Node Count: 1
Machine Type: e2-standard-2 (2 vCPUs, 8GB RAM)

Autoscaling:
  Enabled: true
  Min Nodes: 1
  Max Nodes: 10
  Location Policy: BALANCED

Node Configuration:
  Image Type: COS_CONTAINERD
  Disk Type: pd-standard
  Disk Size: 50 GB
  Max Pods per Node: 110
  
Management:
  Auto Repair: enabled
  Auto Upgrade: enabled
  
Shielded Instance:
  Integrity Monitoring: enabled
```

---

## Cost Analysis

### Current Resource Usage

**Active Compute Resources:**
- **1x e2-standard-2 node** (2 vCPU, 8GB RAM)
  - CPU Usage: 121m (6% of 2 cores)
  - Memory Usage: 2647Mi (43% of 8GB)
  - Estimated Cost: ~$50-60/month

**Storage:**
- **50GB node disk** (pd-standard): ~$2/month
- **10GB MySQL persistent disk** (pd-balanced): ~$1/month

**Network:**
- **2 static IP addresses**: ~$1.50/month each (if not in use)
- **Ingress/Egress traffic**: Variable based on usage

**Total Estimated Monthly Cost: $55-70**

### Cost Drivers
1. **Primary Cost:** Single e2-standard-2 node running 24/7
2. **Secondary Cost:** Static IP addresses (especially unused ones)
3. **Minimal Cost:** Storage volumes (very small)

### Optimization Opportunities
- Cluster is significantly underutilized (6% CPU, 43% memory)
- 17 viper instance services exist but appear unused
- Could reduce to a smaller node type when recreating
- Consider on-demand cluster creation for workshop/demo purposes

---

## Kubernetes Resources

### Namespaces

```
- cert-manager (Active, 66d)
- default (Active, 66d) - Main application namespace
- gke-managed-cim (Active, 66d)
- gke-managed-system (Active, 66d)
- gke-managed-volumepopulator (Active, 66d)
- gmp-public (Active, 66d) - Google Managed Prometheus
- gmp-system (Active, 66d)
- ingress-nginx (Active, 66d)
- kube-node-lease (Active, 66d)
- kube-public (Active, 66d)
- kube-system (Active, 66d)
```

### Main Deployments (default namespace)

#### 1. viper-app Deployment

```yaml
Name: viper-app
Replicas: 1
Image: australia-southeast2-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/web-app:latest
Pull Policy: Always

Container Resources:
  Requests:
    CPU: 200m
    Memory: 256Mi
  Limits:
    CPU: 500m
    Memory: 512Mi

Current Usage:
  CPU: 1m
  Memory: 85Mi

Health Checks:
  Liveness Probe: HTTP GET /healthz:3000 (after 30s, every 10s)
  Readiness Probe: HTTP GET /healthz:3000 (after 10s, every 5s)

Init Container:
  - db-init (mysql:8.0)
  - Waits for MySQL to be ready
  - Initializes database schema from configmap
  
Volumes:
  - db-init-script (ConfigMap)
```

#### 2. mysql Deployment

```yaml
Name: mysql
Replicas: 1
Image: mysql:8.0
Pull Policy: IfNotPresent

Container Resources:
  Requests:
    CPU: 250m
    Memory: 512Mi
  Limits:
    CPU: 500m
    Memory: 1Gi

Current Usage:
  CPU: 10m
  Memory: 374Mi

Health Checks:
  Liveness Probe: TCP socket :3306 (after 30s, every 10s)
  Readiness Probe: TCP socket :3306 (after 10s, every 5s)

Volumes:
  - mysql-persistent-storage (PVC: mysql-pvc, 10Gi)
```

### Services (default namespace)

**Main Services:**
- `kubernetes` - ClusterIP: 34.118.224.1:443
- `mysql` - ClusterIP: 34.118.234.31:3306
- `viper-app` - ClusterIP: 34.118.232.179:3000

**Dynamic Viper Instance Services (17 instances):**
All following the pattern `viper-svc-{id}`:
```
viper-svc-07loqusxf3e9   34.118.225.78     3000/TCP   64d
viper-svc-1lhz5ztgse16   34.118.225.72     3000/TCP   64d
viper-svc-33ae2cxnpuuy   34.118.227.56     3000/TCP   64d
viper-svc-4an2a69r5h0o   34.118.234.32     3000/TCP   64d
viper-svc-66qv12pilzi0   34.118.226.152    3000/TCP   64d
viper-svc-67d2kszxuvxy   34.118.227.120    3000/TCP   64d
viper-svc-7ueypmch5ikj   34.118.227.201    3000/TCP   64d
viper-svc-aprcmfvnveym   34.118.226.147    3000/TCP   64d
viper-svc-b3p4n6ia82t1   34.118.225.203    3000/TCP   64d
viper-svc-f9fcvsygq1pl   34.118.237.123    3000/TCP   64d
viper-svc-fajwvl07wtq3   34.118.235.222    3000/TCP   60d
viper-svc-kgb028w7i0zc   34.118.225.30     3000/TCP   64d
viper-svc-lflvpdjgk1ig   34.118.235.56     3000/TCP   64d
viper-svc-st32qodn7jug   34.118.229.164    3000/TCP   64d
viper-svc-ux3curnei2pd   34.118.237.143    3000/TCP   64d
viper-svc-vx0tkr90aro6   34.118.230.99     3000/TCP   64d
viper-svc-yaz8zitsb14m   34.118.225.4      3000/TCP   64d
```

### Ingresses (default namespace)

**Main Ingress:**
```yaml
Name: viper-app-ingress
Class: nginx
Host: workshop.vipercloud.cc
Address: 34.129.22.190
Ports: 80, 443
Age: 66d
```

**Dynamic Viper Instance Ingresses (17 instances):**
All using nginx ingress class, host `workshop.vipercloud.cc`, port 80, address `34.129.22.190`, following pattern `viper-ingress-{id}`

### ConfigMaps (default namespace)

#### viper-app-config
```yaml
APP_HOST: workshop.vipercloud.cc
APP_PUBLIC_URL: https://workshop.vipercloud.cc
DB_HOST: mysql
DB_NAME: viper_db
DB_PORT: "3306"
DB_USER: root
DOMAIN_NAME: workshop.vipercloud.cc
MEMCACHED_HOST: memcached
NODE_ENV: production
POD_NAMESPACE: default
PORT: "3000"
SERVICE_NAME: viper-app
SERVICE_URL: https://workshop.vipercloud.cc
```

#### db-init-script
Contains SQL initialization script for database setup.

#### viper-proxy-config
Contains proxy configuration for viper instances.

### Secrets (default namespace)

#### viper-app-secret (Opaque)
Contains 11 keys:
- Database credentials (MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD, DB_PASSWORD)
- Session secrets
- Email service credentials (MAILERSEND_API_KEY)
- Cookie secrets
- Other application secrets

#### viper-app-tls (kubernetes.io/tls)
TLS certificate managed by cert-manager
- Certificate: issued and valid
- Secret contains 2 keys (tls.crt, tls.key)

### Persistent Volumes

```yaml
PVC: mysql-pvc
  Status: Bound
  Volume: pvc-80d5db59-e80c-44f6-96e5-4fa8999fe28b
  Capacity: 10Gi
  Access Mode: RWO (ReadWriteOnce)
  Storage Class: standard-rwo
  Age: 66d

PV: pvc-80d5db59-e80c-44f6-96e5-4fa8999fe28b
  Capacity: 10Gi
  Access Mode: RWO
  Reclaim Policy: Delete
  Status: Bound
  Claim: default/mysql-pvc
  Storage Class: standard-rwo
  Age: 66d
```

### RBAC Configuration

#### ServiceAccount: viper-app
```yaml
Namespace: default
Labels:
  app: viper-app
```

#### Role: viper-app-role
```yaml
Permissions:
  - Services: get, list, create, delete, watch
  - Ingresses: get, list, create, delete, watch
  - Pods: get, list, create, delete, watch
  - Pods/exec: get, create
```

#### RoleBinding: viper-app-role-binding
```yaml
Binds: viper-app-role to viper-app ServiceAccount
```

### Certificates

```yaml
Name: viper-app-tls
Namespace: default
Status: Ready (True)
Secret: viper-app-tls
Age: 66d
Managed by: cert-manager
```

---

## GCP Resources

### Compute Resources

#### Compute Instances
```
Name: gke-viper-cluster-default-pool-5f556559-oz9z
Machine Type: e2-standard-2
Zone: australia-southeast2-a
Status: RUNNING
Created: December 7, 2025
```

### Storage Resources

#### Persistent Disks
```
1. gke-viper-cluster-default-pool-5f556559-oz9z
   Size: 50GB
   Type: pd-standard
   Status: READY
   Purpose: Node boot disk

2. pvc-80d5db59-e80c-44f6-96e5-4fa8999fe28b
   Size: 10GB
   Type: pd-balanced
   Status: READY
   Purpose: MySQL database storage
```

### Network Resources

#### Static IP Addresses
```
1. viper-app-ip
   Address: 107.178.254.138
   Type: Global EXTERNAL
   Status: RESERVED
   Age: ~66d
   Note: Appears unused by current ingress

2. viper-nginx-ip
   Address: 34.76.253.108
   Region: europe-west1
   Type: Regional EXTERNAL
   Status: RESERVED
   Note: Wrong region for current cluster
```

#### Firewall Rules
```
GKE Automatic Firewall Rules:
1. gke-viper-cluster-93db22df-all
   - Direction: INGRESS
   - Source: 10.24.0.0/14 (pod network)
   - Target: gke-viper-cluster-93db22df-node
   - Protocols: ah, sctp, tcp, udp, icmp, esp

2. gke-viper-cluster-93db22df-exkubelet
   - Direction: INGRESS
   - Source: 0.0.0.0/0
   - Target: gke-viper-cluster-93db22df-node

3. gke-viper-cluster-93db22df-inkubelet
   - Direction: INGRESS
   - Source: 10.24.0.0/14
   - Target: gke-viper-cluster-93db22df-node
   - Protocol: tcp/10255

4. gke-viper-cluster-93db22df-vms
   - Direction: INGRESS
   - Source: 10.128.0.0/9
   - Target: gke-viper-cluster-93db22df-node
   - Protocols: tcp/1-65535, udp/1-65535, icmp
```

### Container Registry

#### Artifact Registry Repositories
```
Repository: opf-viper-repo
Format: DOCKER
Locations: 
  - australia-southeast2 (created: 2025-10-31)
  - Unknown location (created: 2025-09-08)

Current Image:
  australia-southeast2-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/web-app:latest
```

---

## Application Configuration

### Domain and DNS
```
Primary Domain: workshop.vipercloud.cc
Current Ingress IP: 34.129.22.190 (NGINX Ingress Controller)

DNS Configuration Required:
  A record: workshop.vipercloud.cc -> 34.129.22.190
```

### Application Architecture

```
┌─────────────────────────────────────────────────┐
│           Internet / Users                       │
└──────────────────┬──────────────────────────────┘
                   │
          ┌────────▼────────┐
          │  workshop.      │
          │  vipercloud.cc  │
          │  (DNS A Record) │
          └────────┬────────┘
                   │
          ┌────────▼────────┐
          │ NGINX Ingress    │
          │ Controller       │
          │ 34.129.22.190    │
          └────────┬────────┘
                   │
     ┌─────────────┼─────────────┐
     │             │             │
┌────▼─────┐ ┌────▼─────┐ ┌────▼─────┐
│ viper-app│ │  viper   │ │  viper   │
│ (main)   │ │ instance │ │ instance │
│          │ │ services │ │ services │
│ :3000    │ │  (17x)   │ │   ...    │
└────┬─────┘ └──────────┘ └──────────┘
     │
     │
┌────▼─────┐
│  MySQL   │
│  :3306   │
│          │
│  PVC     │
│  10GB    │
└──────────┘
```

### Key Features

1. **Dynamic ViPER Instance Management**
   - App can create/delete pods dynamically
   - Each instance gets its own service and ingress
   - Path-based routing via NGINX ingress

2. **Database Initialization**
   - Init container waits for MySQL
   - Automatically applies schema from ConfigMap
   - Persistent storage ensures data survives pod restarts

3. **TLS/SSL**
   - Managed by cert-manager
   - Certificate stored in viper-app-tls secret
   - Automatic renewal

4. **Health Monitoring**
   - Both apps have liveness and readiness probes
   - Integrated with GKE monitoring
   - Prometheus metrics enabled

---

## Recreation Instructions

### Prerequisites

1. **Required Tools:**
   ```bash
   - gcloud CLI (authenticated)
   - kubectl
   - Docker (for building images)
   ```

2. **GCP Project Setup:**
   ```bash
   export PROJECT_ID="your-project-id"
   export CLUSTER_NAME="viper-cluster"
   export REGION="australia-southeast2"
   export ZONE="australia-southeast2-a"
   
   gcloud config set project $PROJECT_ID
   gcloud config set compute/zone $ZONE
   ```

3. **Enable Required APIs:**
   ```bash
   gcloud services enable container.googleapis.com
   gcloud services enable artifactregistry.googleapis.com
   gcloud services enable compute.googleapis.com
   ```

### Step 1: Create GKE Cluster

```bash
# Create the cluster (adjust machine type for cost)
gcloud container clusters create $CLUSTER_NAME \
  --zone=$ZONE \
  --machine-type=e2-standard-2 \
  --num-nodes=1 \
  --enable-autoscaling \
  --min-nodes=1 \
  --max-nodes=10 \
  --enable-autorepair \
  --enable-autoupgrade \
  --disk-type=pd-standard \
  --disk-size=50 \
  --enable-shielded-nodes \
  --release-channel=regular \
  --addons=GcePersistentDiskCsiDriver

# Get credentials
gcloud container clusters get-credentials $CLUSTER_NAME --zone=$ZONE
```

**Cost Optimization Option:**
```bash
# Use smaller machine type for lower cost
--machine-type=e2-small  # 2 vCPU, 2GB RAM (~$15/month)
--machine-type=e2-micro  # 2 vCPU, 1GB RAM (~$7/month, may be too small)
```

### Step 2: Install NGINX Ingress Controller

```bash
# Install NGINX Ingress using Helm or kubectl
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml

# Wait for external IP assignment
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s

# Get the ingress IP
kubectl get svc -n ingress-nginx ingress-nginx-controller
```

### Step 3: Install cert-manager

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-webhook -n cert-manager
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-cainjector -n cert-manager
```

### Step 4: Reserve Static IP (Optional)

```bash
# Reserve a global static IP if needed
gcloud compute addresses create viper-app-ip --global

# Get the IP address
gcloud compute addresses describe viper-app-ip --global --format="get(address)"
```

### Step 5: Create Artifact Registry

```bash
# Create repository for container images
gcloud artifacts repositories create opf-viper-repo \
  --repository-format=docker \
  --location=$REGION \
  --description="CloudViPER Docker images"

# Configure Docker authentication
gcloud auth configure-docker ${REGION}-docker.pkg.dev
```

### Step 6: Build and Push Application Image

```bash
# From the web-app directory
cd /home/darrren/OPF/sandbox/viper-cloud-web-gui

# Build the image
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/opf-viper-repo/web-app:latest .

# Push to Artifact Registry
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/opf-viper-repo/web-app:latest
```

### Step 7: Apply Kubernetes Resources

```bash
# Navigate to k8s directory
cd k8s

# Create secrets (update with actual values)
kubectl create secret generic viper-app-secret \
  --from-literal=MYSQL_ROOT_PASSWORD='your-password' \
  --from-literal=MYSQL_PASSWORD='your-password' \
  --from-literal=DB_PASSWORD='your-password' \
  --from-literal=SESSION_SECRET='your-session-secret' \
  --from-literal=MAILERSEND_API_KEY='your-mailersend-key' \
  --from-literal=COOKIE_SECRET='your-cookie-secret' \
  # ... add other secrets as needed

# Apply RBAC
kubectl apply -f viper-app-rbac.yaml

# Apply ConfigMaps
kubectl apply -f viper-app-configmap.yaml
kubectl apply -f db-init-configmap.yaml
kubectl apply -f viper-proxy-configmap.yaml

# Apply MySQL PVC
kubectl apply -f mysql-pvc.yaml

# Deploy MySQL
kubectl apply -f mysql-deployment.yaml

# Wait for MySQL to be ready
kubectl wait --for=condition=ready pod -l app=mysql --timeout=300s

# Deploy viper-app
kubectl apply -f viper-app-deployment.yaml

# Wait for viper-app to be ready
kubectl wait --for=condition=ready pod -l app=viper-app --timeout=300s

# Apply ingress
kubectl apply -f ingress.yaml
```

### Step 8: Configure DNS

```bash
# Get the NGINX ingress external IP
INGRESS_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

echo "Configure DNS A record:"
echo "workshop.vipercloud.cc -> $INGRESS_IP"
```

Update your DNS provider to point `workshop.vipercloud.cc` to the ingress IP.

### Step 9: Configure TLS Certificate

The cert-manager should automatically provision a certificate based on the ingress annotations. Verify:

```bash
kubectl get certificate -n default
kubectl describe certificate viper-app-tls -n default
```

### Step 10: Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n default

# Check services
kubectl get svc -n default

# Check ingress
kubectl get ingress -n default

# View logs
kubectl logs -f deployment/viper-app -n default

# Test the application
curl -k https://workshop.vipercloud.cc
```

---

## Deletion Plan

### Pre-Deletion Checklist

- [ ] **Backup MySQL database** (if needed)
  ```bash
  kubectl exec -it deployment/mysql -- mysqldump -u root -p viper_db > mysql-backup.sql
  ```
- [ ] **Download all application logs**
  ```bash
  kubectl logs deployment/viper-app > viper-app-logs.txt
  kubectl logs deployment/mysql > mysql-logs.txt
  ```
- [ ] **Export all Kubernetes manifests** (already done in this document)
- [ ] **Document any custom configurations** not captured here
- [ ] **Update DNS to remove entries** or point elsewhere
- [ ] **Notify users** of downtime if applicable

### Deletion Steps (In Order)

#### Step 1: Delete Kubernetes Resources

```bash
# Delete ingresses (will remove load balancer)
kubectl delete ingress --all -n default

# Delete services (releases IP addresses)
kubectl delete svc --all -n default

# Delete deployments
kubectl delete deployment viper-app mysql -n default

# Delete PVCs (will also delete PVs)
kubectl delete pvc mysql-pvc -n default

# Delete configmaps and secrets
kubectl delete configmap --all -n default
kubectl delete secret viper-app-secret viper-app-tls -n default

# Delete RBAC resources
kubectl delete role viper-app-role -n default
kubectl delete rolebinding viper-app-role-binding -n default
kubectl delete serviceaccount viper-app -n default

# Delete cert-manager resources
kubectl delete certificate viper-app-tls -n default
```

#### Step 2: Delete the GKE Cluster

```bash
# This will delete the cluster, nodes, and associated firewall rules
gcloud container clusters delete viper-cluster \
  --zone=australia-southeast2-a \
  --quiet

# Expected cleanup:
# - All nodes (compute instances)
# - Node boot disks
# - Automatic firewall rules
# - Load balancers
```

#### Step 3: Delete Static IP Addresses

```bash
# List static IPs
gcloud compute addresses list

# Delete reserved IPs (only if no longer needed)
gcloud compute addresses delete viper-app-ip --global --quiet
gcloud compute addresses delete viper-nginx-ip --region=europe-west1 --quiet
```

#### Step 4: Delete Persistent Disks (if any remain)

```bash
# List disks in the zone
gcloud compute disks list --filter="zone:australia-southeast2-a"

# Delete any remaining disks (check first!)
# Note: PV disks should auto-delete, but verify
gcloud compute disks list | grep viper
```

#### Step 5: Clean Up Artifact Registry (Optional)

```bash
# List repositories
gcloud artifacts repositories list

# Delete repository if no longer needed
gcloud artifacts repositories delete opf-viper-repo \
  --location=australia-southeast2 \
  --quiet

# Or just delete old images to save storage costs
gcloud artifacts docker images list \
  australia-southeast2-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/web-app
```

#### Step 6: Verify Complete Deletion

```bash
# Check for any remaining compute resources
gcloud compute instances list
gcloud compute disks list
gcloud compute addresses list
gcloud compute firewall-rules list | grep gke-viper

# Check for any remaining load balancers
gcloud compute forwarding-rules list
gcloud compute target-pools list
gcloud compute backend-services list

# Verify no lingering costs
# Check GCP Console -> Billing -> Reports
```

### Expected Cost Savings

After complete deletion:
- **Compute:** -$50-60/month (nodes eliminated)
- **Storage:** -$3/month (disks deleted)
- **Static IPs:** -$3/month (if deleted)
- **Network:** Minimal savings

**Total Monthly Savings: ~$55-70**

### Deletion Warnings

⚠️ **IMPORTANT:**
1. **Database deletion is permanent** - The MySQL PVC has `Delete` reclaim policy, so deleting the PVC will permanently delete the database
2. **Backup first** if you need any data
3. **Static IPs** - If these IPs are referenced in DNS or documentation elsewhere, deleting them will break those references
4. **Cert-manager certificates** - Will be lost, but can be easily recreated
5. **Application secrets** - Ensure you have backups of all secrets in viper-app-secret

### Alternative: Cluster Pause (Not Available for GKE Standard)

GKE Standard clusters cannot be paused. To reduce costs without full deletion:

1. **Scale down to zero nodes** (not possible with current autoscaling minimum of 1)
2. **Reduce node count to minimum** (already at 1)
3. **Use smaller machine type** (would require cluster recreation)

Best option is full deletion and recreation when needed.

---

## Quick Recreation Script

Save this as `recreate-cluster.sh`:

```bash
#!/bin/bash
set -e

# Configuration
PROJECT_ID="opf-viper-cloud"
CLUSTER_NAME="viper-cluster"
ZONE="australia-southeast2-a"
REGION="australia-southeast2"
MACHINE_TYPE="e2-standard-2"  # Adjust for cost

echo "Creating GKE cluster..."
gcloud container clusters create $CLUSTER_NAME \
  --zone=$ZONE \
  --machine-type=$MACHINE_TYPE \
  --num-nodes=1 \
  --enable-autoscaling \
  --min-nodes=1 \
  --max-nodes=10 \
  --enable-autorepair \
  --enable-autoupgrade \
  --disk-type=pd-standard \
  --disk-size=50 \
  --enable-shielded-nodes \
  --release-channel=regular

gcloud container clusters get-credentials $CLUSTER_NAME --zone=$ZONE

echo "Installing NGINX Ingress..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s

echo "Installing cert-manager..."
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager

echo "Applying Kubernetes resources..."
kubectl apply -f k8s/viper-app-secret.yaml
kubectl apply -f k8s/viper-app-rbac.yaml
kubectl apply -f k8s/viper-app-configmap.yaml
kubectl apply -f k8s/db-init-configmap.yaml
kubectl apply -f k8s/viper-proxy-configmap.yaml
kubectl apply -f k8s/mysql-pvc.yaml
kubectl apply -f k8s/mysql-deployment.yaml
kubectl wait --for=condition=ready pod -l app=mysql --timeout=300s
kubectl apply -f k8s/viper-app-deployment.yaml
kubectl wait --for=condition=ready pod -l app=viper-app --timeout=300s
kubectl apply -f k8s/ingress.yaml

echo "Getting ingress IP..."
INGRESS_IP=$(kubectl get svc -n ingress-nginx ingress-nginx-controller -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "Cluster ready! Point DNS workshop.vipercloud.cc to: $INGRESS_IP"
```

---

## Additional Notes

### Files Exported During Backup

The following configuration files were exported to `/tmp` during this backup:
- `/tmp/cluster-config.yaml` - Complete cluster configuration
- `/tmp/k8s-all-resources.yaml` - All Kubernetes resources (24,520 lines)
- `/tmp/viper-app-deployment.yaml` - ViPER application deployment
- `/tmp/mysql-deployment.yaml` - MySQL deployment

### Repository Files Referenced

Key configuration files in this repository:
- `k8s/viper-app-deployment.yaml`
- `k8s/mysql-deployment.yaml`
- `k8s/viper-app-configmap.yaml`
- `k8s/viper-app-secret.yaml.example`
- `k8s/viper-app-rbac.yaml`
- `k8s/db-init-configmap.yaml`
- `k8s/ingress.yaml`
- `k8s/mysql-pvc.yaml`
- `scripts/deploy-to-gke.sh`

### Key Changes from Original Deployment

Based on the code changes in this branch (kubernetes-gke):
1. Branding updated from "Cloud Viper"/"Cloud ViPER" to "CloudViPER" (37 instances)
2. Files affected: templates, emails, documentation, package.json, deployment scripts

### Contact Information

- **Project Repository:** viper-cloud-web-gui
- **Branch:** kubernetes-gke
- **Owner:** darrendignam
- **Domain:** workshop.vipercloud.cc

---

## Backup Metadata

```yaml
Backup Created: January 5, 2026
Cluster Age: 66 days
Cluster Created: October 31, 2025
Last Updated: January 5, 2026
Backup Created By: Automated documentation script
Purpose: Pre-deletion backup to enable recreation
Format Version: 1.0
```

---

**END OF DOCUMENT**
