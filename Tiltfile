# Tiltfile for viper-cloud-web-gui

# Allow both Minikube and GKE contexts
allow_k8s_contexts(['minikube', 'gke_opf-viper-cloud_australia-southeast2-a_viper-cluster'])

# Detect which context we're using
k8s_context_name = k8s_context()
is_gke = 'gke_' in k8s_context_name

# Note: Minikube registry addon must be port-forwarded to localhost:5000
# Run in separate terminal: kubectl port-forward -n kube-system svc/registry 5000:80

# Load Kubernetes manifests based on environment
if is_gke:
    # GKE-specific manifests
    k8s_yaml('k8s/mysql-deployment.yaml')
    k8s_yaml('k8s-gke/mysql-pvc.yaml')  # Use GKE PVC (no PV needed)
    k8s_yaml('k8s/viper-app-configmap.yaml')
    k8s_yaml('k8s/viper-app-secret.yaml')
    k8s_yaml('k8s/db-init-configmap.yaml')
    k8s_yaml('k8s/viper-proxy-configmap.yaml')
    k8s_yaml('k8s/viper-app-rbac.yaml')
    k8s_yaml('k8s/viper-app-deployment.yaml')
    # Note: Ingress is managed separately for GKE (see deploy script)
else:
    # Minikube manifests
    k8s_yaml('k8s/mysql-deployment.yaml')
    k8s_yaml('k8s/mysql-pv.yaml')
    k8s_yaml('k8s/mysql-pvc.yaml')
    k8s_yaml('k8s/viper-app-configmap.yaml')
    k8s_yaml('k8s/viper-app-secret.yaml')
    k8s_yaml('k8s/db-init-configmap.yaml')
    k8s_yaml('k8s/viper-proxy-configmap.yaml')
    k8s_yaml('k8s/viper-app-rbac.yaml')
    k8s_yaml('k8s/viper-app-deployment.yaml')
    k8s_yaml('k8s/adminer-deployment.yaml')
# Note: Ingress resources are now created dynamically per-instance by the app
# Static Ingress (k8s/ingress.yaml) is for production GKE deployment only

# Configure registry and build based on environment
if is_gke:
    # GKE: Use Artifact Registry
    default_registry('australia-southeast2-docker.pkg.dev/opf-viper-cloud/opf-viper-repo')
    
    docker_build(
        'australia-southeast2-docker.pkg.dev/opf-viper-cloud/opf-viper-repo/web-app',
        './',
        dockerfile='./Dockerfile',
        only=[
            './web-app/',
            './Dockerfile'
        ],
        ignore=[
            './web-app/node_modules/',
            './web-app/dist/',
            './web-app/logs/',
            './web-app/coverage/'
        ]
    )
else:
    # Minikube: Use local registry
    default_registry('localhost:5000')
    
    docker_build(
        'localhost:5000/web-app',
        './',
        dockerfile='./Dockerfile',
        only=[
            './web-app/',
            './Dockerfile'
        ],
        ignore=[
            './web-app/node_modules/',
            './web-app/dist/',
            './web-app/logs/',
            './web-app/coverage/'
        ]
    )

# Port forwarding based on environment
if is_gke:
    # GKE: Access via Ingress, but can still port-forward for debugging
    k8s_resource('viper-app', port_forwards='30080:3000')
    # Note: Also accessible via Ingress at the domain shown in deploy script
else:
    # Minikube: Port forwarding for local access
    k8s_resource('viper-app', port_forwards='30080:3000')  # Local port 30080 → Container port 3000
    k8s_resource('adminer', port_forwards='30081:8080')    # Adminer database UI

# Note: Minikube has built-in nginx Ingress addon (already enabled)
# Access apps via Ingress at localhost (minikube tunnel provides routing)
# Each ViPER instance gets its own dynamically-created Ingress resource

# Uncomment below for live code sync during development
# live_update(
#     'web-app',
#     [sync('./web-app/src', '/usr/src/app/src')],
#     restart_container()
# )