#!/bin/bash
# Test version of corrected viper-monitor.sh with actual values for validation

export DISPLAY=:1
INSTANCE_UUID="1zi4x8e5jlib"
SERVICE_URL="http://172.20.0.4:3000"
SCREENSHOT_URL="${SERVICE_URL}/service/screenshot/${INSTANCE_UUID}"
ACTIVITY_URL="${SERVICE_URL}/service/activity/${INSTANCE_UUID}"

# Activity counters
MOUSE_EVENTS=0
KEYBOARD_EVENTS=0

# Debug mode - set to 1 to enable debug output
DEBUG=1

# Function to log debug messages
debug_log() {
    if [ "$DEBUG" -eq 1 ]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - [DEBUG] $1" >> /tmp/viper-monitor-test.log
    fi
}

# Function to log regular messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a /tmp/viper-monitor-test.log
}

# Test screenshot function
test_screenshot() {
    log "Testing screenshot capture..."
    if command -v scrot &> /dev/null && [ -n "$DISPLAY" ]; then
        local temp_file="/tmp/test_screenshot_$(date +%s).png"
        local temp_json="/tmp/test_screenshot_data.json"
        
        scrot -z -q 30 "$temp_file" 2>/dev/null
        
        if [ -f "$temp_file" ]; then
            local screenshot_size=$(stat -c%s "$temp_file")
            log "Screenshot captured: $screenshot_size bytes"
            
            if [ "$screenshot_size" -le 5000000 ]; then
                local screenshot_base64=$(base64 -w 0 "$temp_file")
                local timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
                
                echo "{\"screenshot\":\"$screenshot_base64\",\"timestamp\":\"$timestamp\"}" > "$temp_json"
                
                log "Sending test screenshot..."
                local response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
                    -X POST \
                    -H "Content-Type: application/json" \
                    -d @"$temp_json" \
                    --max-time 30 \
                    "$SCREENSHOT_URL" 2>&1)
                
                local http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
                
                if [ "$http_code" = "200" ]; then
                    log "✅ Screenshot test PASSED"
                else
                    log "❌ Screenshot test FAILED: HTTP $http_code"
                fi
                
                rm -f "$temp_json"
            else
                log "❌ Screenshot too large: $screenshot_size bytes"
            fi
            
            rm -f "$temp_file"
        else
            log "❌ Screenshot capture failed"
        fi
    else
        log "❌ scrot or DISPLAY not available"
    fi
}

# Test activity function
test_activity() {
    log "Testing activity report..."
    
    local activity_json="{
        \"mouseEvents\": 1,
        \"keyboardEvents\": 0,
        \"windowActive\": true,
        \"cpuUsage\": 5,
        \"memoryUsage\": 25,
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"
    }"
    
    local response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$activity_json" \
        --max-time 15 \
        "$ACTIVITY_URL" 2>&1)
    
    local http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    
    if [ "$http_code" = "200" ]; then
        log "✅ Activity test PASSED"
    else
        log "❌ Activity test FAILED: HTTP $http_code"
    fi
}

log "=== Starting ViPER Monitor Tests ==="
log "Instance UUID: $INSTANCE_UUID"
log "Screenshot URL: $SCREENSHOT_URL"
log "Activity URL: $ACTIVITY_URL"

test_activity
test_screenshot

log "=== Tests Complete ==="
