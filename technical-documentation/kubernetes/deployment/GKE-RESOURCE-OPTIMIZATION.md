# GKE Resource Optimization Guide

## Current Configuration

### Cluster Settings
- **Node type:** e2-standard-2 (2 vCPU, 8 GB RAM)
- **Cost:** ~$50/month per node
- **Autoscaling:** 1-5 nodes

### ViPER Instance Resources
- **Requests:** 500m CPU, 1 GB RAM (guaranteed)
- **Limits:** 1 CPU, 2 GB RAM (burst capacity)
- **Instances per node:** ~3 (based on requests)

## Optimization Options

### 1. For Better Performance (Higher Quality VMs)

#### Option A: Larger Nodes (Fewer, More Powerful)
```bash
# Use n2-standard-4 nodes (4 vCPU, 16 GB RAM)
gcloud container clusters create viper-cluster \
    --machine-type=n2-standard-4 \
    --num-nodes=2 \
    --min-nodes=1 \
    --max-nodes=3
    
# Cost: ~$140/month per node
# Benefit: ~7 instances per node, better performance per instance
```

#### Option B: Compute-Optimized Nodes (Best CPU Performance)
```bash
# Use c2-standard-4 (4 vCPU, 16 GB RAM, high-performance CPUs)
gcloud container clusters create viper-cluster \
    --machine-type=c2-standard-4 \
    --num-nodes=2 \
    --min-nodes=1 \
    --max-nodes=3
    
# Cost: ~$180/month per node
# Benefit: Faster CPUs, better for VNC/desktop workloads
```

### 2. For Lower Costs (Smaller or Preemptible)

#### Option A: Smaller Nodes (More Nodes, Lower Individual Cost)
```bash
# Use e2-standard-2 (current) or even e2-medium
gcloud container clusters create viper-cluster \
    --machine-type=e2-medium \
    --num-nodes=3 \
    --min-nodes=2 \
    --max-nodes=8
    
# Cost: ~$25/month per node
# Trade-off: More nodes needed, slightly more overhead
```

#### Option B: Preemptible Nodes (70% Cost Savings!)
```bash
# Use preemptible VMs (can be interrupted with 30s notice)
gcloud container clusters create viper-cluster \
    --machine-type=e2-standard-2 \
    --preemptible \
    --num-nodes=3 \
    --min-nodes=1 \
    --max-nodes=5
    
# Cost: ~$15/month per node (70% cheaper!)
# Trade-off: Instances may be terminated (good for test/dev)
```

### 3. Adjust ViPER Instance Resources

#### For More Instances Per Node (Tighter Packing)
Edit `web-app/src/services/ViperInstanceService.ts`:

```typescript
resources: {
  requests: { memory: '512Mi', cpu: '250m' },  // Reduced from 1Gi/500m
  limits: { memory: '1Gi', cpu: '500m' }       // Reduced from 2Gi/1
}
```

**Result:** 
- ~6 instances per e2-standard-2 node (vs 3 currently)
- Lower per-instance performance
- Better cost efficiency

#### For Better Performance Per Instance
```typescript
resources: {
  requests: { memory: '2Gi', cpu: '1' },       // Increased
  limits: { memory: '4Gi', cpu: '2' }          // Increased
}
```

**Result:**
- 1-2 instances per e2-standard-2 node
- Much better performance per instance
- Higher cost per instance

## Monitoring Commands

### Check Current Resource Usage
```bash
# See actual CPU/memory usage
kubectl top nodes
kubectl top pods -l app=viper-instance

# See what's scheduled vs available
kubectl describe nodes | grep -A 5 "Allocated resources"

# Watch autoscaling in action
watch kubectl get nodes
```

### Stress Test
```bash
# Create multiple instances and watch scaling
# Check if instances are being constrained

# View instance logs for performance issues
kubectl logs -l app=viper-instance --tail=50
```

## Cost Estimates

### Current Setup (e2-standard-2)
| Instances | Nodes | Monthly Cost |
|-----------|-------|--------------|
| 1-3       | 1     | $50          |
| 4-6       | 2     | $100         |
| 7-9       | 3     | $150         |
| 10-12     | 4     | $200         |
| 13-15     | 5     | $250         |

### With Preemptible Nodes (70% off)
| Instances | Nodes | Monthly Cost |
|-----------|-------|--------------|
| 1-3       | 1     | $15          |
| 4-6       | 2     | $30          |
| 7-9       | 3     | $45          |
| 10-12     | 4     | $60          |
| 13-15     | 5     | $75          |

### With n2-standard-4 (Better Performance)
| Instances | Nodes | Monthly Cost |
|-----------|-------|--------------|
| 1-7       | 1     | $140         |
| 8-14      | 2     | $280         |
| 15-21     | 3     | $420         |

*Note: Add ~$1-5/month for persistent disks (10 GB MySQL)*

## Recommendations

### For Test/Development Server
✅ **Use preemptible nodes** - save 70% on compute
- Acceptable for instances to occasionally restart
- Much cheaper for testing
- Can always upgrade to standard later

```bash
# Update cluster to use preemptible
gcloud container node-pools create preemptible-pool \
    --cluster=viper-cluster \
    --zone=europe-west1-b \
    --machine-type=e2-standard-2 \
    --preemptible \
    --num-nodes=2 \
    --enable-autoscaling \
    --min-nodes=1 \
    --max-nodes=5
```

### For Production
✅ **Keep current setup** or upgrade to n2-standard-4
- Reliable, good balance of cost/performance
- Autoscaling handles variable load well
- Can add node pools later for mixed workloads

### For Maximum Performance
✅ **Use c2-standard-4** compute-optimized nodes
- Best CPU performance for VNC workloads
- More expensive but noticeable quality improvement
- Consider for production with paying users

## Changing Node Type (After Initial Deploy)

You can't change existing nodes, but you can add a new node pool:

```bash
# Add a new pool with different machine type
gcloud container node-pools create performance-pool \
    --cluster=viper-cluster \
    --zone=europe-west1-b \
    --machine-type=n2-standard-4 \
    --num-nodes=2 \
    --enable-autoscaling \
    --min-nodes=1 \
    --max-nodes=3

# Cordon and drain old pool
kubectl cordon <old-node>
kubectl drain <old-node> --ignore-daemonsets --delete-emptydir-data

# Delete old pool
gcloud container node-pools delete default-pool \
    --cluster=viper-cluster \
    --zone=europe-west1-b
```

## Storage Costs

Persistent disks are cheap:
- **MySQL (10 GB):** ~$0.40/month (standard persistent disk)
- **Per instance:** No additional storage by default

If instances need persistent storage, budget ~$0.04/GB/month.
