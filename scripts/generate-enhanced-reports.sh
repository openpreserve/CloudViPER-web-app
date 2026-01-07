#!/bin/bash
# Enhanced Forensic Report Generator with Network Analytics
# Includes nginx logs, IP geolocation, and user agent analysis

set -e

REPORT_DIR="./workshop-reports-enhanced-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$REPORT_DIR"

echo "🔍 Enhanced ViPER Instance Forensic Report Generator"
echo "===================================================="
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
echo "🌐 Collecting ingress controller logs for IP geolocation..."
echo ""

# Get ingress logs for all instances
INGRESS_POD=$(kubectl get pods -n ingress-nginx -l app.kubernetes.io/component=controller --no-headers | awk '{print $1}')
echo "📝 Ingress controller: $INGRESS_POD"
echo ""

COUNTER=1
for POD in $PODS; do
    INSTANCE_ID=$(echo $POD | sed 's/viper-instance-//')
    echo "[$COUNTER/$POD_COUNT] Analyzing $POD (ID: $INSTANCE_ID)..."
    REPORT_FILE="$REPORT_DIR/${POD}-enhanced-report.md"
    
    # Extract unique IPs for this instance from ingress logs
    echo "   → Extracting client IPs from ingress logs..."
    UNIQUE_IPS=$(kubectl logs -n ingress-nginx $INGRESS_POD --tail=50000 2>/dev/null | \
        grep "$INSTANCE_ID" | \
        grep -v "service/activity" | \
        grep -v "service/screenshots" | \
        awk '{print $1}' | \
        sort -u || echo "")
    
    IP_COUNT=$(echo "$UNIQUE_IPS" | grep -v '^$' | wc -l)
    
    # Get nginx container logs from pod
    echo "   → Collecting nginx-proxy logs..."
    NGINX_LOGS=$(kubectl logs $POD -c nginx-proxy 2>/dev/null | tail -200 || echo "No nginx logs available")
    
    # Get sample ingress logs for this instance
    echo "   → Collecting ingress access logs..."
    INGRESS_SAMPLE=$(kubectl logs -n ingress-nginx $INGRESS_POD --tail=50000 2>/dev/null | \
        grep "$INSTANCE_ID" | \
        grep -E "GET|POST" | \
        grep -v "service/activity" | \
        grep -v "service/screenshots" | \
        tail -50 || echo "No ingress logs found")
    
    cat > "$REPORT_FILE" << EOF
# Enhanced ViPER Instance Forensic Report
## Instance: $POD
## Instance ID: $INSTANCE_ID
### Generated: $(date)

---

## 📋 Pod Metadata

\`\`\`
$(kubectl get pod $POD -o wide)
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

---

## 🌐 Network Access Analytics

### Client IP Addresses ($IP_COUNT unique)
\`\`\`
$UNIQUE_IPS
\`\`\`

### IP Geolocation Analysis
EOF

    # Geolocate each unique IP
    if [ -n "$UNIQUE_IPS" ] && [ "$IP_COUNT" -gt 0 ]; then
        echo "" >> "$REPORT_FILE"
        echo "\`\`\`" >> "$REPORT_FILE"
        for IP in $UNIQUE_IPS; do
            if [ -n "$IP" ]; then
                echo "   → Geolocating $IP..."
                # Use ip-api.com for geolocation (free, no API key required)
                GEO_INFO=$(curl -s "http://ip-api.com/json/$IP?fields=status,message,country,regionName,city,isp,org,as,query" 2>/dev/null || echo "{}")
                
                if echo "$GEO_INFO" | grep -q '"status":"success"'; then
                    COUNTRY=$(echo "$GEO_INFO" | grep -o '"country":"[^"]*"' | cut -d'"' -f4)
                    REGION=$(echo "$GEO_INFO" | grep -o '"regionName":"[^"]*"' | cut -d'"' -f4)
                    CITY=$(echo "$GEO_INFO" | grep -o '"city":"[^"]*"' | cut -d'"' -f4)
                    ISP=$(echo "$GEO_INFO" | grep -o '"isp":"[^"]*"' | cut -d'"' -f4)
                    ORG=$(echo "$GEO_INFO" | grep -o '"org":"[^"]*"' | cut -d'"' -f4)
                    
                    echo "$IP:" >> "$REPORT_FILE"
                    echo "  Location: $CITY, $REGION, $COUNTRY" >> "$REPORT_FILE"
                    echo "  ISP: $ISP" >> "$REPORT_FILE"
                    echo "  Organization: $ORG" >> "$REPORT_FILE"
                    echo "" >> "$REPORT_FILE"
                else
                    echo "$IP: Geolocation failed or private IP" >> "$REPORT_FILE"
                    echo "" >> "$REPORT_FILE"
                fi
                
                # Rate limit to avoid API throttling
                sleep 1.5
            fi
        done
        echo "\`\`\`" >> "$REPORT_FILE"
    else
        echo "\`\`\`" >> "$REPORT_FILE"
        echo "No client IPs found in logs" >> "$REPORT_FILE"
        echo "\`\`\`" >> "$REPORT_FILE"
    fi

    cat >> "$REPORT_FILE" << EOF

### User Agent Analysis
\`\`\`
EOF

    # Extract unique user agents from ingress logs
    echo "   → Analyzing user agents..."
    kubectl logs -n ingress-nginx $INGRESS_POD --tail=50000 2>/dev/null | \
        grep "$INSTANCE_ID" | \
        grep -oP 'Mozilla[^"]*' | \
        sort -u | \
        head -10 >> "$REPORT_FILE" 2>/dev/null || echo "No user agents found" >> "$REPORT_FILE"

    cat >> "$REPORT_FILE" << EOF
\`\`\`

---

## 📝 Nginx Proxy Logs (Pod Sidecar)

### Last 200 Lines
\`\`\`
$NGINX_LOGS
\`\`\`

---

## 🌐 Ingress Controller Access Logs

### Sample Recent Requests (Last 50)
\`\`\`
$INGRESS_SAMPLE
\`\`\`

### Access Statistics
EOF

    # Calculate access statistics from ingress logs
    echo "   → Calculating access statistics..."
    TOTAL_REQUESTS=$(kubectl logs -n ingress-nginx $INGRESS_POD --tail=50000 2>/dev/null | \
        grep "$INSTANCE_ID" | \
        grep -E "GET|POST" | \
        grep -v "service/activity" | \
        grep -v "service/screenshots" | \
        wc -l || echo "0")
    
    HTTP_200=$(kubectl logs -n ingress-nginx $INGRESS_POD --tail=50000 2>/dev/null | \
        grep "$INSTANCE_ID" | \
        grep -E 'HTTP/[12].[01]" 200' | \
        wc -l || echo "0")
    
    HTTP_304=$(kubectl logs -n ingress-nginx $INGRESS_POD --tail=50000 2>/dev/null | \
        grep "$INSTANCE_ID" | \
        grep -E 'HTTP/[12].[01]" 304' | \
        wc -l || echo "0")
    
    HTTP_4XX=$(kubectl logs -n ingress-nginx $INGRESS_POD --tail=50000 2>/dev/null | \
        grep "$INSTANCE_ID" | \
        grep -E 'HTTP/[12].[01]" 4[0-9]{2}' | \
        wc -l || echo "0")
    
    cat >> "$REPORT_FILE" << EOF
- **Total Requests:** $TOTAL_REQUESTS
- **HTTP 200 (OK):** $HTTP_200
- **HTTP 304 (Not Modified):** $HTTP_304
- **HTTP 4xx (Client Errors):** $HTTP_4XX
- **Unique Client IPs:** $IP_COUNT

---

## 👤 User Activity

### Bash History
\`\`\`bash
$(kubectl exec $POD -- cat /config/.bash_history 2>/dev/null || echo "No bash history found")
\`\`\`

### Recently Modified Files
\`\`\`
$(kubectl exec $POD -- find /config -type f -mtime -7 -ls 2>/dev/null | head -20 || echo "Could not list files")
\`\`\`

---

## 🔧 Running Processes

### Current Processes (Top 30)
\`\`\`
$(kubectl exec $POD -- ps aux 2>/dev/null | head -30)
\`\`\`

### Top CPU Consumers
\`\`\`
$(kubectl exec $POD -- ps aux --sort=-%cpu 2>/dev/null | head -10)
\`\`\`

### Top Memory Consumers
\`\`\`
$(kubectl exec $POD -- ps aux --sort=-%mem 2>/dev/null | head -10)
\`\`\`

---

## 📝 Container Logs (Viper Container)

### Last 100 Lines
\`\`\`
$(kubectl logs $POD -c viper --tail=100 2>/dev/null)
\`\`\`

---

## ✅ Enhanced Report Complete
- Generated: $(date)
- Pod: $POD
- Instance ID: $INSTANCE_ID
- Client IPs Analyzed: $IP_COUNT
- Total HTTP Requests: $TOTAL_REQUESTS

EOF

    echo "   ✅ Enhanced report saved: $REPORT_FILE"
    COUNTER=$((COUNTER + 1))
    echo ""
done

# Create enhanced summary with IP analytics
SUMMARY_FILE="$REPORT_DIR/00-ENHANCED-SUMMARY.md"
echo "📄 Generating enhanced summary with IP analytics..."

cat > "$SUMMARY_FILE" << EOF
# Workshop Enhanced Analytics Report
## Generated: $(date)

---

## 📊 Overview

- **Total Instances Analyzed:** $POD_COUNT
- **Report Directory:** $REPORT_DIR
- **Workshop Date:** $(date +%Y-%m-%d)
- **Ingress Controller:** $INGRESS_POD

---

## 🎯 Instance List

| Instance | Node | Age | Status |
|----------|------|-----|--------|
$(kubectl get pods -l app=viper-instance -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName,AGE:.metadata.creationTimestamp,STATUS:.status.phase --no-headers | awk '{print "| " $1 " | " $2 " | " $3 " | " $4 " |"}')

---

## 🌐 Global Access Analytics

### All Unique Client IPs Across Workshop
\`\`\`
EOF

# Get ALL unique IPs from entire workshop
echo "   → Extracting all unique client IPs from workshop..."
ALL_IPS=$(kubectl logs -n ingress-nginx $INGRESS_POD --tail=100000 2>/dev/null | \
    grep "viper-instance" | \
    grep -v "service/activity" | \
    grep -v "service/screenshots" | \
    awk '{print $1}' | \
    sort -u || echo "")

echo "$ALL_IPS" >> "$SUMMARY_FILE"
echo "\`\`\`" >> "$SUMMARY_FILE"

cat >> "$SUMMARY_FILE" << EOF

### Geographic Distribution
\`\`\`
EOF

TOTAL_UNIQUE_IPS=$(echo "$ALL_IPS" | grep -v '^$' | wc -l)
echo "   → Geolocating $TOTAL_UNIQUE_IPS unique IPs..."

if [ -n "$ALL_IPS" ] && [ "$TOTAL_UNIQUE_IPS" -gt 0 ]; then
    for IP in $ALL_IPS; do
        if [ -n "$IP" ]; then
            echo "      → $IP..."
            GEO_INFO=$(curl -s "http://ip-api.com/json/$IP?fields=status,country,regionName,city,isp" 2>/dev/null || echo "{}")
            
            if echo "$GEO_INFO" | grep -q '"status":"success"'; then
                COUNTRY=$(echo "$GEO_INFO" | grep -o '"country":"[^"]*"' | cut -d'"' -f4)
                REGION=$(echo "$GEO_INFO" | grep -o '"regionName":"[^"]*"' | cut -d'"' -f4)
                CITY=$(echo "$GEO_INFO" | grep -o '"city":"[^"]*"' | cut -d'"' -f4)
                ISP=$(echo "$GEO_INFO" | grep -o '"isp":"[^"]*"' | cut -d'"' -f4)
                
                echo "$IP → $CITY, $REGION, $COUNTRY (ISP: $ISP)" >> "$SUMMARY_FILE"
            else
                echo "$IP → Private/Local IP or geolocation failed" >> "$SUMMARY_FILE"
            fi
            
            sleep 1.5
        fi
    done
fi

cat >> "$SUMMARY_FILE" << EOF
\`\`\`

### Total Unique Participants: $TOTAL_UNIQUE_IPS

---

## 📊 Request Statistics

EOF

echo "   → Calculating global request statistics..."
TOTAL_ALL=$(kubectl logs -n ingress-nginx $INGRESS_POD --tail=100000 2>/dev/null | \
    grep "viper-instance" | \
    grep -E "GET|POST" | \
    grep -v "service/activity" | \
    grep -v "service/screenshots" | \
    wc -l || echo "0")

cat >> "$SUMMARY_FILE" << EOF
- **Total Requests (All Instances):** $TOTAL_ALL
- **Total Unique Client IPs:** $TOTAL_UNIQUE_IPS
- **Average Requests per IP:** $(echo "$TOTAL_ALL / $TOTAL_UNIQUE_IPS" | bc 2>/dev/null || echo "N/A")

---

## 📝 Individual Reports

$(for POD in $PODS; do echo "- [\`$POD\`](./${POD}-enhanced-report.md)"; done)

---

*Enhanced report with geolocation data generated by ViPER Enhanced Forensic Report Generator*
EOF

echo "   ✅ Enhanced summary saved: $SUMMARY_FILE"
echo ""
echo "✨ Enhanced report generation complete!"
echo ""
echo "📁 Reports available in: $REPORT_DIR/"
echo "📄 Start with: $SUMMARY_FILE"
echo ""
echo "🌐 Geolocation data included for all client IPs"
echo "📊 Network access analytics complete"
echo ""
