#!/bin/bash
# ViPER Container Monitoring Script
# This script monitors container activity and sends screenshots and activity reports
# to the parent application for tracking usage.

# Variables will be substituted when the script is deployed
INSTANCE_UUID="{{INSTANCE_UUID}}"
SERVICE_URL="{{SERVICE_URL}}"
STATUS_KEY="{{STATUS_KEY}}"
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
        echo "$(date '+%Y-%m-%d %H:%M:%S') - [DEBUG] $1" >> /tmp/viper-monitor.log
        # Rotate log: keep last 1000 lines
        if [ $(wc -l < /tmp/viper-monitor.log) -gt 1000 ]; then
            tail -n 1000 /tmp/viper-monitor.log > /tmp/viper-monitor.log.tmp && mv /tmp/viper-monitor.log.tmp /tmp/viper-monitor.log
        fi
    fi
}

# Function to log regular messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a /tmp/viper-monitor.log
    # Rotate log: keep last 1000 lines
    if [ $(wc -l < /tmp/viper-monitor.log) -gt 1000 ]; then
        tail -n 1000 /tmp/viper-monitor.log > /tmp/viper-monitor.log.tmp && mv /tmp/viper-monitor.log.tmp /tmp/viper-monitor.log
    fi
}

# Function to capture and send screenshot
capture_screenshot() {
    if command -v scrot &> /dev/null && [ -n "$DISPLAY" ]; then
        debug_log "scrot and DISPLAY available, capturing screenshot"
        local temp_file="/tmp/screenshot_${INSTANCE_UUID}.png"
        local temp_json="/tmp/screenshot_data_${INSTANCE_UUID}.json"
        # Capture screenshot with compression (overwrites previous)
        scrot -z -q 30 "$temp_file" 2>/dev/null
        if [ -f "$temp_file" ]; then
            local screenshot_size=$(stat -c%s "$temp_file")
            debug_log "Screenshot size: $screenshot_size bytes"
            # Accept screenshots up to 5MB (server now supports 10MB)
            if [ "$screenshot_size" -le 5000000 ]; then
                debug_log "Screenshot captured, encoding to base64"
                local screenshot_base64=$(base64 -w 0 "$temp_file")
                local base64_length=${#screenshot_base64}
                debug_log "Base64 encoded: $base64_length characters"
                local timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
                # Create JSON using echo to avoid heredoc variable expansion issues
                echo "{\"screenshot\":\"$screenshot_base64\",\"timestamp\":\"$timestamp\",\"statusKey\":\"$STATUS_KEY\"}" > "$temp_json"
                local json_size=$(stat -c%s "$temp_json")
                debug_log "JSON created: $json_size bytes"
                debug_log "Sending screenshot to $SCREENSHOT_URL"
                local response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
                    -X POST \
                    -H "Content-Type: application/json" \
                    -d @"$temp_json" \
                    --max-time 60 \
                    "$SCREENSHOT_URL" 2>&1)
                local http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
                local response_body=$(echo "$response" | grep -v "HTTP_CODE:")
                debug_log "HTTP Response Code: $http_code"
                debug_log "Response Body: $response_body"
                if [ "$http_code" = "200" ]; then
                    log "Screenshot sent successfully"
                    debug_log "Screenshot sent successfully"
                else
                    log "Screenshot send failed with HTTP $http_code"
                    debug_log "Screenshot send failed: HTTP $http_code - $response_body"
                fi
                # Clean up temp files
                rm -f "$temp_json"
            else
                debug_log "Screenshot too large ($screenshot_size bytes), skipping"
                log "Screenshot too large ($screenshot_size bytes), skipped"
            fi
            # Do NOT remove $temp_file, so it always contains the latest screenshot
        else
            debug_log "Failed to capture screenshot - file not created"
        fi
    else
        debug_log "scrot not available or DISPLAY not set"
    fi
}

# Function to get and send activity data
send_activity() {
    debug_log "Collecting activity data"
    
    # Count mouse events from file and reset
    MOUSE_EVENTS=0
    if [ -f /tmp/mouse_events.tmp ]; then
        MOUSE_EVENTS=$(wc -l < /tmp/mouse_events.tmp 2>/dev/null || echo "0")
        rm -f /tmp/mouse_events.tmp
    fi
    debug_log "Mouse events since last report: $MOUSE_EVENTS"
    
    # Get CPU usage
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}' 2>/dev/null || echo "0")
    debug_log "CPU usage: ${CPU_USAGE}%"
    
    # Get memory usage
    if [ -f /proc/meminfo ]; then
        MEMORY_TOTAL=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        MEMORY_AVAILABLE=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        MEMORY_USAGE=$(echo "scale=1; (($MEMORY_TOTAL - $MEMORY_AVAILABLE) * 100) / $MEMORY_TOTAL" | bc -l 2>/dev/null || echo "0")
        debug_log "Memory usage: ${MEMORY_USAGE}% (Total: $MEMORY_TOTAL, Available: $MEMORY_AVAILABLE)"
    else
        MEMORY_USAGE=0
        debug_log "Memory info not available"
    fi
    
    # Check if window is active
    WINDOW_ACTIVE=false
    if [ -n "$DISPLAY" ] && command -v xdotool &> /dev/null; then
        if xdotool getactivewindow &>/dev/null; then
            WINDOW_ACTIVE=true
            debug_log "Window is active"
        else
            debug_log "No active window detected"
        fi
    else
        debug_log "xdotool not available or DISPLAY not set"
    fi
    
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
    
    # Create JSON for activity data using echo method to avoid variable expansion issues
    local activity_json="{
        \"mouseEvents\": $MOUSE_EVENTS,
        \"keyboardEvents\": $KEYBOARD_EVENTS,
        \"windowActive\": $WINDOW_ACTIVE,
        \"cpuUsage\": ${CPU_USAGE:-0},
        \"memoryUsage\": ${MEMORY_USAGE:-0},
        \"timestamp\": \"$timestamp\",
        \"statusKey\": \"$STATUS_KEY\"
    }"
    
    # Send activity report
    debug_log "Sending activity report to $ACTIVITY_URL"
    debug_log "Activity data: Mouse=$MOUSE_EVENTS, Keyboard=$KEYBOARD_EVENTS, WindowActive=$WINDOW_ACTIVE, CPU=${CPU_USAGE:-0}%, Memory=${MEMORY_USAGE:-0}%"
    
    local response=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "$activity_json" \
        --max-time 15 \
        "$ACTIVITY_URL" 2>&1)
    
    local http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    local response_body=$(echo "$response" | grep -v "HTTP_CODE:")
    
    debug_log "Activity HTTP Response Code: $http_code"
    debug_log "Activity Response Body: $response_body"
    
    if [ "$http_code" = "200" ]; then
        log "Activity report sent (CPU: ${CPU_USAGE:-0}%, Memory: ${MEMORY_USAGE:-0}%, Mouse: $MOUSE_EVENTS)"
        debug_log "Activity report sent successfully"
    else
        log "Activity report failed with HTTP $http_code"
        debug_log "Activity report failed: HTTP $http_code - $response_body"
    fi
    
    # Reset keyboard counter (mouse events already reset by removing the file)
    KEYBOARD_EVENTS=0
}

# Function to monitor mouse activity
monitor_mouse() {
    debug_log "Starting mouse monitoring"
    local prev_pos=""
    while true; do
        if command -v xdotool &> /dev/null && [ -n "$DISPLAY" ]; then
            local current_pos=$(xdotool getmouselocation 2>/dev/null)
            if [ -n "$current_pos" ] && [ "$current_pos" != "$prev_pos" ]; then
                # Write mouse event to a file that the main process can read
                echo "1" >> /tmp/mouse_events.tmp
                prev_pos="$current_pos"
                debug_log "Mouse movement detected: $current_pos"
            fi
        fi
        sleep 3  # Check every 3 seconds to reduce CPU usage
    done
}

# Function to handle shutdown
cleanup() {
    log "ViPER monitoring stopped"
    debug_log "Monitoring cleanup initiated"
    # Kill mouse monitoring background process
    if [ -n "$MOUSE_PID" ]; then
        kill $MOUSE_PID 2>/dev/null
        debug_log "Mouse monitoring process terminated"
    fi
    # Clean up temp files
    rm -f /tmp/mouse_events.tmp /tmp/screenshot_*.png /tmp/screenshot_data_*.json
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

log "Starting ViPER monitoring for instance $INSTANCE_UUID"
debug_log "ViPER monitoring started with instance UUID: $INSTANCE_UUID"
debug_log "Service URL: $SERVICE_URL"
debug_log "Screenshot URL: $SCREENSHOT_URL"
debug_log "Activity URL: $ACTIVITY_URL"
debug_log "Status Key authentication: enabled (${#STATUS_KEY} chars)"

# Verify required tools are available
debug_log "Checking required tools..."
command -v scrot &> /dev/null && debug_log "scrot: available" || debug_log "scrot: NOT available"
command -v xdotool &> /dev/null && debug_log "xdotool: available" || debug_log "xdotool: NOT available"
command -v curl &> /dev/null && debug_log "curl: available" || debug_log "curl: NOT available"
command -v bc &> /dev/null && debug_log "bc: available" || debug_log "bc: NOT available"
debug_log "DISPLAY variable: ${DISPLAY:-'not set'}"

# Start mouse monitoring in background
monitor_mouse &
MOUSE_PID=$!
debug_log "Mouse monitoring started with PID: $MOUSE_PID"

# Main monitoring loop
SCREENSHOT_COUNTER=0
ACTIVITY_COUNTER=0

debug_log "Starting main monitoring loop"
while true; do
    # Send screenshot every 30 seconds (every 30 iterations with 1-second sleep)
    if [ $SCREENSHOT_COUNTER -ge 30 ]; then
        capture_screenshot
        SCREENSHOT_COUNTER=0
    fi
    
    # Send activity report every 10 seconds (every 10 iterations with 1-second sleep)
    if [ $ACTIVITY_COUNTER -ge 10 ]; then
        send_activity
        ACTIVITY_COUNTER=0
    fi
    
    # Increment counters
    SCREENSHOT_COUNTER=$((SCREENSHOT_COUNTER + 1))
    ACTIVITY_COUNTER=$((ACTIVITY_COUNTER + 1))
    
    # Wait 1 second
    sleep 1
done
