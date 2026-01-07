#!/bin/bash
#
# Setup script for Google Cloud Marketplace deployment
# This script creates the necessary GCP resources for deploying CloudViPER
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="${APP_NAME:-cloud-viper}"
NAMESPACE="${NAMESPACE:-default}"
PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CloudViPER - Google Cloud Marketplace Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Check prerequisites
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}✗ Error: No GCP project configured${NC}"
    echo "  Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo -e "${GREEN}✓${NC} GCP Project: ${PROJECT_ID}"

# Check if running in GKE
CURRENT_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "")
if [[ ! "$CURRENT_CONTEXT" =~ gke ]]; then
    echo -e "${YELLOW}⚠${NC} Warning: Not connected to a GKE cluster"
    echo "  Current context: ${CURRENT_CONTEXT}"
    echo "  This script is designed for GKE deployment"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo

# Step 1: Reserve static IP for Ingress
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Reserving Global Static IP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

IP_NAME="${APP_NAME}-ip"

if gcloud compute addresses describe "$IP_NAME" --global &>/dev/null; then
    IP_ADDRESS=$(gcloud compute addresses describe "$IP_NAME" --global --format="get(address)")
    echo -e "${GREEN}✓${NC} Static IP already exists: ${IP_ADDRESS}"
else
    echo "Creating global static IP: ${IP_NAME}..."
    gcloud compute addresses create "$IP_NAME" \
        --global \
        --ip-version IPV4
    
    IP_ADDRESS=$(gcloud compute addresses describe "$IP_NAME" --global --format="get(address)")
    echo -e "${GREEN}✓${NC} Static IP created: ${IP_ADDRESS}"
fi

echo

# Step 2: Generate endpoint domain name
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Generating Endpoint Domain"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Generate a random suffix for uniqueness
RANDOM_SUFFIX=$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 8 | head -n 1)
ENDPOINT_DOMAIN="${APP_NAME}-${RANDOM_SUFFIX}.endpoints.${PROJECT_ID}.cloud.goog"

echo -e "${GREEN}✓${NC} Generated domain: ${ENDPOINT_DOMAIN}"
echo

# Step 3: Create Kubernetes resources
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Creating Kubernetes Resources"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create namespace if it doesn't exist
if kubectl get namespace "$NAMESPACE" &>/dev/null; then
    echo -e "${GREEN}✓${NC} Namespace already exists: ${NAMESPACE}"
else
    kubectl create namespace "$NAMESPACE"
    echo -e "${GREEN}✓${NC} Namespace created: ${NAMESPACE}"
fi

# Apply RBAC
echo "Applying ServiceAccount and RBAC..."
kubectl apply -f k8s/viper-app-rbac.yaml -n "$NAMESPACE"
echo -e "${GREEN}✓${NC} RBAC configured"

# Apply ConfigMap and Secrets
echo "Applying ConfigMap and Secrets..."
kubectl apply -f k8s/viper-app-configmap.yaml -n "$NAMESPACE"
kubectl apply -f k8s/viper-app-secret.yaml -n "$NAMESPACE"
kubectl apply -f k8s/db-init-configmap.yaml -n "$NAMESPACE"
echo -e "${GREEN}✓${NC} ConfigMap and Secrets applied"

# Update ConfigMap with the endpoint domain
kubectl patch configmap viper-app-config -n "$NAMESPACE" \
    --patch "{\"data\":{\"APP_PUBLIC_URL\":\"https://${ENDPOINT_DOMAIN}\",\"DOMAIN_NAME\":\"${ENDPOINT_DOMAIN}\"}}"
echo -e "${GREEN}✓${NC} ConfigMap updated with endpoint domain"

# Apply MySQL resources
echo "Deploying MySQL..."
kubectl apply -f k8s/mysql-pv.yaml -n "$NAMESPACE"
kubectl apply -f k8s/mysql-pvc.yaml -n "$NAMESPACE"
kubectl apply -f k8s/mysql-deployment.yaml -n "$NAMESPACE"
echo -e "${GREEN}✓${NC} MySQL deployed"

# Apply application deployment
echo "Deploying CloudViPER application..."
kubectl apply -f k8s/viper-app-deployment.yaml -n "$NAMESPACE"
echo -e "${GREEN}✓${NC} Application deployed"

echo

# Step 4: Create Ingress with managed certificate
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Creating Ingress with Managed Certificate"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create temporary ingress file with the actual domain
TEMP_INGRESS=$(mktemp)
cat > "$TEMP_INGRESS" <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: viper-app-ingress
  namespace: ${NAMESPACE}
  annotations:
    kubernetes.io/ingress.class: "gce"
    networking.gke.io/managed-certificates: "viper-app-cert"
    kubernetes.io/ingress.global-static-ip-name: "${IP_NAME}"
  labels:
    app: viper-app
spec:
  rules:
  - host: ${ENDPOINT_DOMAIN}
    http:
      paths:
      - path: /*
        pathType: ImplementationSpecific
        backend:
          service:
            name: viper-app
            port:
              number: 3000
---
apiVersion: networking.gke.io/v1
kind: ManagedCertificate
metadata:
  name: viper-app-cert
  namespace: ${NAMESPACE}
  labels:
    app: viper-app
spec:
  domains:
    - ${ENDPOINT_DOMAIN}
EOF

kubectl apply -f "$TEMP_INGRESS"
rm "$TEMP_INGRESS"

echo -e "${GREEN}✓${NC} Ingress created with managed certificate"
echo

# Step 5: Wait for resources
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5: Waiting for Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Waiting for MySQL to be ready..."
kubectl wait --for=condition=ready pod -l app=mysql -n "$NAMESPACE" --timeout=300s

echo "Waiting for CloudViPER to be ready..."
kubectl wait --for=condition=ready pod -l app=viper-app -n "$NAMESPACE" --timeout=300s

echo -e "${GREEN}✓${NC} All pods are running"
echo

# Display results
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo -e "${GREEN}✓${NC} CloudViPER has been deployed successfully!"
echo
echo "Access Information:"
echo "  URL:         https://${ENDPOINT_DOMAIN}"
echo "  IP Address:  ${IP_ADDRESS}"
echo "  Namespace:   ${NAMESPACE}"
echo
echo "Admin Credentials (from secret):"
echo "  Username:    admin"
echo "  Email:       admin@example.com"
echo "  Password:    ChangeMeOnFirstLogin123!"
echo
echo -e "${YELLOW}⚠${NC} Important Notes:"
echo "  • SSL certificate provisioning takes 10-15 minutes"
echo "  • You can check certificate status with:"
echo "    kubectl describe managedcertificate viper-app-cert -n ${NAMESPACE}"
echo
echo "  • The application will auto-detect its URL from the Ingress"
echo "  • Change the admin password after first login!"
echo
echo "Check deployment status:"
echo "  kubectl get pods -n ${NAMESPACE}"
echo "  kubectl get ingress -n ${NAMESPACE}"
echo "  kubectl logs -f deployment/viper-app -n ${NAMESPACE}"
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
