#!/bin/bash
# Forensic Report Generator for ViPER Instances
# Generates comprehensive reports for each instance before deletion

set -e

REPORT_DIR="./workshop-reports-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$REPORT_DIR"

echo "🔍 ViPER Instance Forensic Report Generator"
echo "==========================================="
echo "Report directory: $REPORT_DIR"
echo ""

# Get all viper instance pods
PODS=$(kubectl get pods -l app=viper-instance --no-headers | awk '{print $1}')

if [ -z "$PODS" ]; then
    echo "❌ No viper instances found!"
    exit 1
fi

POD_COUNT=$(echo "$PODS" | wc -l)
echo "📊 Found $POD_COUNT instances to analyze"
echo ""

COUNTER=1
for POD in $PODS; do
    echo "[$COUNTER/$POD_COUNT] Analyzing $POD..."
    REPORT_FILE="$REPORT_DIR/${POD}-report.md"
    
    cat > "$REPORT_FILE" << EOF
# ViPER Instance Forensic Report
## Instance: $POD
### Generated: $(date)

---

## 📋 Pod Metadata

\`\`\`
$(kubectl get pod $POD -o wide)
\`\`\`

### Pod Details
\`\`\`yaml
$(kubectl get pod $POD -o yaml | grep -A 50 "^spec:" | head -60)
\`\`\`

### Node Assignment
\`\`\`
$(kubectl get pod $POD -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName,NODE-IP:.status.hostIP,POD-IP:.status.podIP --no-headers)
\`\`\`

### Age and Uptime
- Created: $(kubectl get pod $POD -o jsonpath='{.metadata.creationTimestamp}')
- Age: $(kubectl get pod $POD --no-headers | awk '{print $5}')

---

## 💻 Resource Usage

### Current Resource Metrics
\`\`\`
$(kubectl top pod $POD --containers 2>/dev/null || echo "Metrics not available")
\`\`\`

### Resource Requests/Limits
\`\`\`yaml
$(kubectl get pod $POD -o jsonpath='{range .spec.containers[*]}Container: {.name}
  CPU Request: {.resources.requests.cpu}
  CPU Limit: {.resources.limits.cpu}
  Memory Request: {.resources.requests.memory}
  Memory Limit: {.resources.limits.memory}
{end}')
\`\`\`

---

## 👤 User Activity

### Bash History
\`\`\`bash
$(kubectl exec $POD -- cat /config/.bash_history 2>/dev/null || echo "No bash history found")
\`\`\`

### Recently Modified Files in Home Directory
\`\`\`
$(kubectl exec $POD -- find /config -type f -mtime -7 -ls 2>/dev/null | head -20 || echo "Could not list files")
\`\`\`

### Desktop Files
\`\`\`
$(kubectl exec $POD -- ls -lah /config/Desktop 2>/dev/null || echo "No desktop files")
\`\`\`

---

## 🔧 Running Processes

### Process List (Snapshot)
\`\`\`
$(kubectl exec $POD -- ps aux 2>/dev/null | head -50)
\`\`\`

### Process Tree
\`\`\`
$(kubectl exec $POD -- ps auxf 2>/dev/null | head -50)
\`\`\`

### Top CPU Consumers
\`\`\`
$(kubectl exec $POD -- ps aux --sort=-%cpu 2>/dev/null | head -15)
\`\`\`

### Top Memory Consumers
\`\`\`
$(kubectl exec $POD -- ps aux --sort=-%mem 2>/dev/null | head -15)
\`\`\`

---

## 📊 System Statistics

### Memory Info
\`\`\`
$(kubectl exec $POD -- cat /proc/meminfo 2>/dev/null | head -20)
\`\`\`

### CPU Info
\`\`\`
$(kubectl exec $POD -- cat /proc/cpuinfo 2>/dev/null | grep -E "model name|cpu MHz|cache size" | head -10)
\`\`\`

### Load Average
\`\`\`
$(kubectl exec $POD -- cat /proc/loadavg 2>/dev/null)
\`\`\`

### Uptime
\`\`\`
$(kubectl exec $POD -- cat /proc/uptime 2>/dev/null)
\`\`\`

---

## 💾 Disk Usage

### Root Filesystem
\`\`\`
$(kubectl exec $POD -- df -h / 2>/dev/null)
\`\`\`

### /tmp Usage
\`\`\`
$(kubectl exec $POD -- du -sh /tmp/* 2>/dev/null | sort -rh | head -10 || echo "No data in /tmp")
\`\`\`

### /config Usage
\`\`\`
$(kubectl exec $POD -- du -sh /config/* 2>/dev/null | sort -rh | head -10 || echo "Could not analyze /config")
\`\`\`

---

## 🌐 Network Information

### Network Connections
\`\`\`
$(kubectl exec $POD -- netstat -tuln 2>/dev/null | head -20 || echo "netstat not available")
\`\`\`

### Listening Ports
\`\`\`
$(kubectl exec $POD -- ss -tuln 2>/dev/null | head -20 || echo "ss not available")
\`\`\`

---

## 📝 Container Logs

### Last 100 Lines of Logs
\`\`\`
$(kubectl logs $POD --tail=100 2>/dev/null)
\`\`\`

### Log Statistics
- Total log lines: $(kubectl logs $POD 2>/dev/null | wc -l)
- Errors/Warnings: $(kubectl logs $POD 2>/dev/null | grep -iE "error|warning|fatal" | wc -l)

### Recent Errors (if any)
\`\`\`
$(kubectl logs $POD 2>/dev/null | grep -iE "error|fatal" | tail -10 || echo "No errors found")
\`\`\`

---

## 🔍 Application-Specific Data

### X Server Display
\`\`\`
$(kubectl exec $POD -- printenv DISPLAY 2>/dev/null || echo "DISPLAY not set")
\`\`\`

### KasmVNC Status
\`\`\`
$(kubectl exec $POD -- pgrep -a Xvnc 2>/dev/null || echo "KasmVNC not found")
\`\`\`

### Firefox Running
\`\`\`
$(kubectl exec $POD -- pgrep -a firefox 2>/dev/null || echo "Firefox not running")
\`\`\`

### Desktop Environment
\`\`\`
$(kubectl exec $POD -- pgrep -a xfce4 2>/dev/null || echo "XFCE not found")
\`\`\`

---

## 🎯 Workshop Tool Usage

### Installed Preservation Tools
\`\`\`bash
$(kubectl exec $POD -- bash -c "which fido siegfried veraPDF jhove mediaconch ffmpeg handbrake 2>/dev/null | xargs -I {} bash -c 'echo -n \"{}: \"; {} --version 2>&1 | head -1'" 2>/dev/null || echo "Could not check tools")
\`\`\`

### /tmp Files (Workshop Artifacts)
\`\`\`
$(kubectl exec $POD -- ls -lh /tmp/*.{html,pdf,xml,txt} 2>/dev/null | head -20 || echo "No workshop artifacts found")
\`\`\`

---

## 📅 Event History

### Pod Events
\`\`\`
$(kubectl get events --field-selector involvedObject.name=$POD --sort-by='.lastTimestamp' 2>/dev/null | tail -20)
\`\`\`

---

## 🏷️ Labels and Annotations

\`\`\`yaml
$(kubectl get pod $POD -o jsonpath='{.metadata.labels}' | jq -r 2>/dev/null || echo "No labels")
\`\`\`

---

## ✅ Report Generation Complete
- Generated: $(date)
- Pod: $POD
- Status: $(kubectl get pod $POD -o jsonpath='{.status.phase}')

EOF

    echo "   ✅ Report saved: $REPORT_FILE"
    COUNTER=$((COUNTER + 1))
done

# Create summary report
SUMMARY_FILE="$REPORT_DIR/00-SUMMARY.md"
echo ""
echo "📄 Generating summary report..."

cat > "$SUMMARY_FILE" << EOF
# Workshop Instance Summary Report
## Generated: $(date)

---

## 📊 Overview

- **Total Instances Analyzed:** $POD_COUNT
- **Report Directory:** $REPORT_DIR
- **Workshop Date:** $(date +%Y-%m-%d)

---

## 🎯 Instance List

| Instance | Node | Age | Status |
|----------|------|-----|--------|
$(kubectl get pods -l app=viper-instance -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName,AGE:.metadata.creationTimestamp,STATUS:.status.phase --no-headers | awk '{print "| " $1 " | " $2 " | " $3 " | " $4 " |"}')

---

## 💻 Resource Usage Summary

\`\`\`
$(kubectl top pods -l app=viper-instance 2>/dev/null || echo "Metrics unavailable")
\`\`\`

---

## 🌐 Cluster State

### Nodes
\`\`\`
$(kubectl get nodes)
\`\`\`

### Node Resources
\`\`\`
$(kubectl top nodes 2>/dev/null || echo "Node metrics unavailable")
\`\`\`

---

## 📝 Individual Reports

$(for POD in $PODS; do echo "- [\`$POD\`](./${POD}-report.md)"; done)

---

## 🎓 Workshop Statistics

### Bash Command Frequency Analysis
\`\`\`
$(for POD in $PODS; do kubectl exec $POD -- cat /config/.bash_history 2>/dev/null; done | sort | uniq -c | sort -rn | head -20 || echo "Could not analyze")
\`\`\`

### Most Active Instance (by bash history)
\`\`\`
$(for POD in $PODS; do echo -n "$POD: "; kubectl exec $POD -- cat /config/.bash_history 2>/dev/null | wc -l; done | sort -t: -k2 -rn | head -5)
\`\`\`

---

## 📦 Next Steps

1. Review individual instance reports in this directory
2. Archive reports for future reference
3. Delete instances when ready:
   \`\`\`bash
   kubectl delete pods -l app=viper-instance
   \`\`\`

---

*Report generated by ViPER Instance Forensic Report Generator*
EOF

echo "   ✅ Summary saved: $SUMMARY_FILE"
echo ""
echo "✨ Report generation complete!"
echo ""
echo "📁 Reports available in: $REPORT_DIR/"
echo "📄 Start with: $SUMMARY_FILE"
echo ""
echo "To view reports:"
echo "  cd $REPORT_DIR && ls -lh"
echo ""
