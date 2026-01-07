#!/bin/bash

# Setup Kubernetes Dashboard for kind cluster
# This is similar to Portainer for Docker

set -e

echo "🎨 Setting up Kubernetes Dashboard..."

# Install Kubernetes Dashboard
echo "📦 Installing Kubernetes Dashboard..."
kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.7.0/aio/deploy/recommended.yaml

# Create admin user for dashboard access
echo "👤 Creating admin user..."
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: admin-user
  namespace: kubernetes-dashboard
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: admin-user
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
- kind: ServiceAccount
  name: admin-user
  namespace: kubernetes-dashboard
EOF

# Wait for dashboard to be ready
echo "⏳ Waiting for dashboard to be ready..."
kubectl wait --for=condition=available --timeout=120s deployment/kubernetes-dashboard -n kubernetes-dashboard

echo ""
echo "✅ Kubernetes Dashboard installed!"
echo ""
echo "📋 To access the dashboard:"
echo "1. Run this command in a separate terminal:"
echo "   kubectl proxy"
echo ""
echo "2. Open this URL in your browser:"
echo "   http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/"
echo ""
echo "3. Get your login token with:"
echo "   kubectl -n kubernetes-dashboard create token admin-user"
echo ""
echo "Or use this one-liner to get the token:"
echo "   kubectl -n kubernetes-dashboard create token admin-user | pbcopy  # (macOS)"
echo "   kubectl -n kubernetes-dashboard create token admin-user | xclip -selection clipboard  # (Linux)"
echo ""
