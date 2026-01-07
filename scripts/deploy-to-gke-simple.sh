#!/bin/bash
#
# Simple GKE deployment script for ViPER Cloud
# This script deploys the application to Google Kubernetes Engine with auto-generated domain and SSL
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="opf-viper-cloud"
CLUSTER_NAME="${CLUSTER_NAME:-viper-cluster}"
REGION="${REGION:-australia-southeast2}"
ZONE="${ZONE:-australia-southeast2-a}"
NAMESPACE="${NAMESPACE:-default}"
APP_NAME="viper-app"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ViPER Cloud - GKE Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo -e "${BLUE}Project:${NC}   ${PROJECT_ID}"
echo -e "${BLUE}Cluster:${NC}   ${CLUSTER_NAME}"
echo -e "${BLUE}Zone:${NC}      ${ZONE}"
echo -e "${BLUE}Namespace:${NC} ${NAMESPACE}"
echo

# Check prerequisites
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}✗ Error: gcloud CLI not found${NC}"
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}✗ Error: kubectl not found${NC}"
    exit 1
fi

# Set project
gcloud config set project "$PROJECT_ID"
echo -e "${GREEN}✓${NC} Project set to: ${PROJECT_ID}"
echo

# Check if cluster exists
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Checking GKE Cluster"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! gcloud container clusters describe "$CLUSTER_NAME" --zone="$ZONE" &>/dev/null; then
    echo -e "${YELLOW}⚠${NC} Cluster '${CLUSTER_NAME}' not found. Creating it..."
    
    gcloud container clusters create "$CLUSTER_NAME" \
        --zone="$ZONE" \
        --num-nodes=3 \
        --machine-type=e2-standard-2 \
        --enable-autoscaling \
        --min-nodes=1 \
        --max-nodes=10 \
        --enable-autorepair \
        --enable-autoupgrade \
        --disk-size=50 \
        --disk-type=pd-standard
    
    echo -e "${GREEN}✓${NC} Cluster created successfully"
else
    echo -e "${GREEN}✓${NC} Cluster '${CLUSTER_NAME}' exists"
fi

# Get cluster credentials
echo "Getting cluster credentials..."
gcloud container clusters get-credentials "$CLUSTER_NAME" --zone="$ZONE"
echo -e "${GREEN}✓${NC} Connected to cluster"
echo

# Install nginx ingress controller
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Installing nginx Ingress Controller"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! kubectl get namespace ingress-nginx &>/dev/null; then
    echo "Installing nginx ingress controller..."
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.2/deploy/static/provider/cloud/deploy.yaml
    echo "Waiting for nginx ingress controller to be ready..."
    kubectl wait --namespace ingress-nginx \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/component=controller \
        --timeout=300s || true
    echo -e "${GREEN}✓${NC} nginx ingress controller installed"
else
    echo -e "${GREEN}✓${NC} nginx ingress controller already installed"
fi
echo

# Get LoadBalancer IP
echo "Waiting for LoadBalancer IP to be assigned..."
for i in {1..30}; do
    IP_ADDRESS=$(kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
    if [ -n "$IP_ADDRESS" ]; then
        break
    fi
    echo "  Waiting for IP... (attempt $i/30)"
    sleep 10
done

if [ -z "$IP_ADDRESS" ]; then
    echo -e "${RED}✗ Error: Failed to get LoadBalancer IP${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} LoadBalancer IP: ${IP_ADDRESS}"
echo

# Install cert-manager for automatic SSL
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Installing cert-manager for SSL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! kubectl get namespace cert-manager &>/dev/null; then
    echo "Installing cert-manager..."
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.15.3/cert-manager.yaml
    echo "Waiting for cert-manager to be ready..."
    kubectl wait --namespace cert-manager \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/instance=cert-manager \
        --timeout=300s || true
    echo -e "${GREEN}✓${NC} cert-manager installed"
else
    echo -e "${GREEN}✓${NC} cert-manager already installed"
fi

# Create Let's Encrypt ClusterIssuer
echo "Creating Let's Encrypt ClusterIssuer..."
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@vipercloud.cc
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

echo -e "${GREEN}✓${NC} Let's Encrypt ClusterIssuer created"
echo

# Generate domain using LoadBalancer IP
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Generating Domain"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create a unique domain using the IP address
IP_REVERSED=$(echo "$IP_ADDRESS" | tr '.' '-')
ENDPOINT_DOMAIN="${IP_REVERSED}.nip.io"

echo -e "${GREEN}✓${NC} Using domain: ${ENDPOINT_DOMAIN}"
echo -e "${BLUE}Note:${NC} This uses nip.io for automatic DNS. For production, use a custom domain."
echo

# Create namespace if needed
if [ "$NAMESPACE" != "default" ]; then
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    echo -e "${GREEN}✓${NC} Namespace '${NAMESPACE}' ready"
fi

# Apply secrets
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5: Applying Secrets"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if secrets file exists locally
if [ ! -f "k8s/viper-app-secret.yaml" ]; then
    echo -e "${RED}✗ Error: k8s/viper-app-secret.yaml not found${NC}"
    echo
    echo "Please create the secret file first:"
    echo "  1. Copy k8s/viper-app-secret.yaml.example to k8s/viper-app-secret.yaml"
    echo "  2. Edit it with your actual values (base64 encoded)"
    echo
    echo "To encode values: echo -n 'your-value' | base64"
    exit 1
fi

# Apply the secret (will create or update)
echo "Applying secret from k8s/viper-app-secret.yaml..."
kubectl apply -f k8s/viper-app-secret.yaml -n "$NAMESPACE"
echo -e "${GREEN}✓${NC} Secret 'viper-app-secret' applied"
echo

# Deploy Kubernetes resources
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 6: Deploying Kubernetes Resources"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Apply RBAC
echo "Applying RBAC configuration..."
kubectl apply -f k8s/viper-app-rbac.yaml -n "$NAMESPACE"
echo -e "${GREEN}✓${NC} RBAC configured"

# Apply ConfigMaps
echo "Applying ConfigMaps..."
kubectl apply -f k8s/viper-app-configmap.yaml -n "$NAMESPACE"
kubectl apply -f k8s/db-init-configmap.yaml -n "$NAMESPACE"
kubectl apply -f k8s/viper-proxy-configmap.yaml -n "$NAMESPACE"
echo -e "${GREEN}✓${NC} ConfigMaps applied"

# Update ConfigMap with the endpoint domain
kubectl patch configmap viper-app-config -n "$NAMESPACE" \
    --patch "{\"data\":{\"APP_PUBLIC_URL\":\"http://${ENDPOINT_DOMAIN}\",\"DOMAIN_NAME\":\"${ENDPOINT_DOMAIN}\",\"SERVICE_URL\":\"http://${ENDPOINT_DOMAIN}\"}}"
echo -e "${GREEN}✓${NC} ConfigMap updated with domain: ${ENDPOINT_DOMAIN}"

# Deploy MySQL with GKE-specific storage
echo "Deploying MySQL..."
kubectl apply -f k8s-gke/mysql-pvc.yaml -n "$NAMESPACE"
kubectl apply -f k8s/mysql-deployment.yaml -n "$NAMESPACE"
echo -e "${GREEN}✓${NC} MySQL deployment started"

# Wait for MySQL to be ready
echo "Waiting for MySQL to be ready (this may take a few minutes)..."
kubectl wait --for=condition=ready pod -l app=mysql -n "$NAMESPACE" --timeout=300s || true
echo -e "${GREEN}✓${NC} MySQL is ready"

# Deploy the application
echo "Deploying ViPER application..."
kubectl apply -f k8s/viper-app-deployment.yaml -n "$NAMESPACE"
echo -e "${GREEN}✓${NC} Application deployment started"

# Wait for application to be ready
echo "Waiting for application to be ready..."
kubectl wait --for=condition=ready pod -l app=viper-app -n "$NAMESPACE" --timeout=300s || true
echo -e "${GREEN}✓${NC} Application is ready"

# Create Ingress with the domain
echo "Creating Ingress with domain ${ENDPOINT_DOMAIN}..."

# Create temporary ingress file with the actual domain
TEMP_INGRESS=$(mktemp)
cat > "$TEMP_INGRESS" <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: viper-app-ingress
  namespace: ${NAMESPACE}
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
  labels:
    app: viper-app
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - ${ENDPOINT_DOMAIN}
    secretName: viper-app-tls
  rules:
  - host: ${ENDPOINT_DOMAIN}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: viper-app
            port:
              number: 3000
EOF

kubectl apply -f "$TEMP_INGRESS"
rm "$TEMP_INGRESS"

echo -e "${GREEN}✓${NC} Ingress created"
echo -e "${BLUE}Note:${NC} SSL certificate will be automatically provisioned by Let's Encrypt (may take a few minutes)"
echo

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo -e "${GREEN}✓${NC} ViPER Cloud has been deployed to GKE!"
echo
echo "Access Information:"
echo -e "  ${BLUE}URL:${NC}         http://${ENDPOINT_DOMAIN}"
echo -e "  ${BLUE}IP Address:${NC}  ${IP_ADDRESS}"
echo -e "  ${BLUE}Namespace:${NC}   ${NAMESPACE}"
echo
echo -e "${YELLOW}⚠${NC} Important Notes:"
echo "  • The Ingress may take 5-10 minutes to fully provision"
echo "  • You can check status with: kubectl get ingress -n ${NAMESPACE}"
echo "  • Default admin credentials are in your viper-app-secret"
echo
echo "Useful Commands:"
echo "  # Check pod status"
echo "  kubectl get pods -n ${NAMESPACE}"
echo
echo "  # View application logs"
echo "  kubectl logs -f deployment/viper-app -n ${NAMESPACE}"
echo
echo "  # Check ingress status"
echo "  kubectl describe ingress viper-app-ingress -n ${NAMESPACE}"
echo
echo "  # Get all resources"
echo "  kubectl get all -n ${NAMESPACE}"
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
