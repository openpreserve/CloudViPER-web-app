# Container Snapshot Workflow for ViPER Instances

This document explains how to customize a viper-instance container and save it as a new image.

## Step 1: Deploy Development Instance

Deploy a viper-instance without monitoring scripts and with root access:

```bash
kubectl apply -f k8s/dev-viper-instance.yaml
```

Wait for it to be ready:
```bash
kubectl wait --for=condition=ready pod/viper-dev-instance --timeout=120s
```

## Step 2: Access the Container

### Option A: Shell Access
```bash
kubectl exec -it viper-dev-instance -- /bin/bash
```

### Option B: VNC Access (through port-forward)
```bash
kubectl port-forward pod/viper-dev-instance 6901:6901
# Open browser: http://localhost:6901/
# Password: changeme
```

## Step 3: Make Your Changes

Once inside the container, you can:

```bash
# Update packages
apt-get update

# Install software
apt-get install -y <your-packages>

# Configure settings
# ... make your changes ...

# Download corpus files
cd /config
curl -L https://github.com/openpreserve/jhove/archive/refs/heads/integration.tar.gz | tar xz
mv jhove-integration test-corpus

# Exit when done
exit
```

## Step 4: Commit Container to New Image

### Find the Docker container ID

On a GKE node (or using gcloud):
```bash
# Get the node the pod is running on
NODE=$(kubectl get pod viper-dev-instance -o jsonpath='{.spec.nodeName}')

# SSH to the node
gcloud compute ssh $NODE --zone=<your-zone>

# Find the container ID
sudo crictl ps | grep viper-dev-instance
# Copy the CONTAINER ID (first column)
```

### Export the container filesystem
```bash
# Export to tar
sudo crictl export <container-id> /tmp/viper-custom.tar

# Exit the node
exit

# Copy tar file from node to local machine
gcloud compute scp $NODE:/tmp/viper-custom.tar . --zone=<your-zone>
```

### Build new image from tar
```bash
# Import as Docker image
docker import viper-custom.tar viper-instance:custom

# Tag for Artifact Registry
docker tag viper-instance:custom \
  europe-west1-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/viper-instance:v1.0

# Push to registry
docker push europe-west1-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/viper-instance:v1.0
```

## Step 5: Use New Image in Production

Update the image in `web-app/src/services/ViperInstanceService.ts`:

```typescript
// Around line 290
containers: [
  {
    name: 'kasmvnc',
    // OLD: image: 'accetto/ubuntu-vnc-xfce-firefox-g3:latest',
    image: 'europe-west1-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/viper-instance:v1.0',
    imagePullPolicy: 'Always',
    // ... rest of config
  }
]
```

Rebuild and deploy:
```bash
docker build -t europe-west1-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/web-app:latest -f Dockerfile .
docker push europe-west1-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/web-app:latest
kubectl delete pod -l app=viper-app
```

## Alternative: Simpler Dockerfile Method

Instead of committing a running container, you can create a Dockerfile:

```dockerfile
# Create: Dockerfile.viper-instance
FROM accetto/ubuntu-vnc-xfce-firefox-g3:latest

# Install additional packages
RUN apt-get update && apt-get install -y \
    vim \
    htop \
    your-package-here \
    && rm -rf /var/lib/apt/lists/*

# Download and extract corpus
RUN curl -L https://github.com/openpreserve/jhove/archive/refs/heads/integration.tar.gz \
    | tar xz -C /config/ \
    && mv /config/jhove-integration /config/test-corpus

# Add custom scripts or configs
COPY custom-configs/ /config/

# Keep the original entrypoint
```

Build and push:
```bash
docker build -f Dockerfile.viper-instance \
  -t europe-west1-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/viper-instance:v1.0 .
docker push europe-west1-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/viper-instance:v1.0
```

## Cleanup

Remove the development instance when done:
```bash
kubectl delete -f k8s/dev-viper-instance.yaml
```

## Version Management

Consider using semantic versioning for your custom images:
- `viper-instance:v1.0` - Initial custom image
- `viper-instance:v1.1` - Minor updates
- `viper-instance:v2.0` - Major changes
- `viper-instance:latest` - Always points to newest (use with caution)
