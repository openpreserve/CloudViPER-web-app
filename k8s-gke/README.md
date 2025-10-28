# GKE-specific Kubernetes manifests

This folder contains GKE-specific configuration files.

## Files in this folder:

- `mysql-pvc.yaml` - Persistent Volume Claim for MySQL using GKE dynamic provisioning

## Storage on GKE

GKE uses dynamic provisioning with Storage Classes. No PersistentVolume (PV) manifest is needed.

The PVC uses `storageClassName: standard-rwo` which is GKE's default SSD-backed storage.

## Deployment Order

1. Apply common resources from `../k8s/`
2. Apply this GKE-specific storage:
   ```bash
   kubectl apply -f k8s-gke/mysql-pvc.yaml
   ```
3. The rest of the deployments from `../k8s/` will use this PVC

## Storage Classes Available on GKE

- `standard-rwo` - Standard persistent disk (SSD) - ReadWriteOnce
- `premium-rwo` - Premium persistent disk (SSD with higher IOPS)
- `standard` - Legacy standard persistent disk
