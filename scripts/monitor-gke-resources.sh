#!/bin/bash
#
# Monitor GKE cluster resource usage
#

echo "=== Node Resources ==="
kubectl top nodes
echo

echo "=== Pod Resources (All) ==="
kubectl top pods --all-namespaces
echo

echo "=== ViPER Instance Pods ==="
kubectl top pods -l app=viper-instance 2>/dev/null || echo "No ViPER instances running"
echo

echo "=== Cluster Autoscaler Status ==="
kubectl get nodes
echo

echo "=== Resource Requests vs Capacity ==="
kubectl describe nodes | grep -A 5 "Allocated resources"
