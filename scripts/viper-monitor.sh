#!/bin/bash
# ViPER Container Monitoring Script
# This script monitors container activity and sends screenshots and activity reports
# to the parent application for tracking usage.

# Variables will be substituted when the script is deployed
INSTANCE_UUID="{{INSTANCE_UUID}}"
SERVICE_URL="{{SERVICE_URL}}"
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
        echo "$(date): [DEBUG] $1" >> /tmp/viper-monitor.log
    fi
}

# Function to capture and send screenshot
capture_screenshot() {
    debug_log "Starting screenshot capture"
    
    if command -v scrot &> /dev/null && [ -n "$DISPLAY" ]; then
        debug_log "scrot and DISPLAY available, capturing screenshot"
        scrot -z /tmp/screenshot.png 2>/dev/null
        
        if [ -f /tmp/screenshot.png ]; then
            # Check screenshot size (limit to ~500KB to avoid curl issues)
            SCREENSHOT_SIZE=$(wc -c < /tmp/screenshot.png)
            debug_log "Screenshot size: $SCREENSHOT_SIZE bytes"
            
            if [ "$SCREENSHOT_SIZE" -gt 500000 ]; then
                debug_log "Screenshot too large ($SCREENSHOT_SIZE bytes), resizing..."
                # Resize screenshot to reduce size
                if command -v convert &> /dev/null; then
                    convert /tmp/screenshot.png -resize 800x600 -quality 70 /tmp/screenshot_small.png 2>/dev/null
                    if [ -f /tmp/screenshot_small.png ]; then
                        mv /tmp/screenshot_small.png /tmp/screenshot.png
                        SCREENSHOT_SIZE=$(wc -c < /tmp/screenshot.png)
                        debug_log "Resized screenshot size: $SCREENSHOT_SIZE bytes"
                    fi
                fi
            fi
            
            if [ "$SCREENSHOT_SIZE" -le 1000000 ]; then  # Max 1MB
                debug_log "Screenshot captured, encoding to base64"
                SCREENSHOT_B64=$(base64 -w 0 /tmp/screenshot.png)
                TIMESTAMP=$(date -Iseconds)
                
                debug_log "Sending screenshot to $SCREENSHOT_URL"
                curl -X POST "$SCREENSHOT_URL" \
                    -H "Content-Type: application/json" \
                    -d "{\"screenshot\":\"$SCREENSHOT_B64\",\"timestamp\":\"$TIMESTAMP\"}" \
                    --max-time 30 --silent &
                
                echo "$(date): Screenshot sent"
                debug_log "Screenshot sent successfully"
            else
                debug_log "Screenshot still too large after resize ($SCREENSHOT_SIZE bytes), skipping"
            fi
            
            rm -f /tmp/screenshot.png
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
    
    TIMESTAMP=$(date -Iseconds)
    
    # Send activity report
    debug_log "Sending activity report to $ACTIVITY_URL"
    debug_log "Activity data: Mouse=$MOUSE_EVENTS, Keyboard=$KEYBOARD_EVENTS, WindowActive=$WINDOW_ACTIVE, CPU=${CPU_USAGE:-0}%, Memory=${MEMORY_USAGE:-0}%"
    curl -X POST "$ACTIVITY_URL" \
        -H "Content-Type: application/json" \
        -d "{
            \"mouseEvents\": $MOUSE_EVENTS,
            \"keyboardEvents\": $KEYBOARD_EVENTS,
            \"windowActive\": $WINDOW_ACTIVE,
            \"cpuUsage\": ${CPU_USAGE:-0},
            \"memoryUsage\": ${MEMORY_USAGE:-0},
            \"timestamp\": \"$TIMESTAMP\"
        }" \
        --max-time 15 --silent &
    
    # Reset keyboard counter (mouse events already reset by removing the file)
    KEYBOARD_EVENTS=0
    
    echo "$(date): Activity report sent (CPU: ${CPU_USAGE:-0}%, Memory: ${MEMORY_USAGE:-0}%)"
    debug_log "Activity report sent successfully"
}

# Function to monitor mouse activity
monitor_mouse() {
    debug_log "Starting mouse monitoring"
    PREV_POS=""
    while true; do
        if command -v xdotool &> /dev/null && [ -n "$DISPLAY" ]; then
            CURRENT_POS=$(xdotool getmouselocation 2>/dev/null)
            if [ -n "$CURRENT_POS" ] && [ "$CURRENT_POS" != "$PREV_POS" ]; then
                # Write mouse event to a file that the main process can read
                echo "1" >> /tmp/mouse_events.tmp
                PREV_POS="$CURRENT_POS"
                debug_log "Mouse movement detected: $CURRENT_POS"
            fi
        fi
        sleep 2
    done
}

# Function to handle shutdown
cleanup() {
    echo "$(date): ViPER monitoring stopped"
    debug_log "Monitoring cleanup initiated"
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

echo "$(date): Starting ViPER monitoring for instance $INSTANCE_UUID"
debug_log "ViPER monitoring started with instance UUID: $INSTANCE_UUID"
debug_log "Service URL: $SERVICE_URL"
debug_log "Screenshot URL: $SCREENSHOT_URL"
debug_log "Activity URL: $ACTIVITY_URL"

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
    # Send screenshot every 60 seconds
    if [ $SCREENSHOT_COUNTER -ge 60 ]; then
        capture_screenshot
        SCREENSHOT_COUNTER=0
    fi
    
    # Send activity report every 30 seconds
    if [ $ACTIVITY_COUNTER -ge 30 ]; then
        send_activity
        ACTIVITY_COUNTER=0
    fi
    
    # Increment counters
    SCREENSHOT_COUNTER=$((SCREENSHOT_COUNTER + 1))
    ACTIVITY_COUNTER=$((ACTIVITY_COUNTER + 1))
    
    # Wait 1 second
    sleep 1
done
