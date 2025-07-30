#!/bin/bash
# Simple ViPER Container Monitoring Script
# This script captures screenshots and basic activity data

INSTANCE_UUID="$1"
SERVICE_URL="$2"

if [ -z "$INSTANCE_UUID" ] || [ -z "$SERVICE_URL" ]; then
    echo "Usage: $0 <instance_uuid> <service_url>"
    echo "Example: $0 abc123-def456 https://cloudviper.org"
    exit 1
fi

# URLs for API endpoints
SCREENSHOT_URL="${SERVICE_URL}/service/screenshot/${INSTANCE_UUID}"
ACTIVITY_URL="${SERVICE_URL}/service/activity/${INSTANCE_UUID}"

# Activity counters
MOUSE_EVENTS=0
KEYBOARD_EVENTS=0

# Function to capture and send screenshot
capture_screenshot() {
    echo "$(date): Capturing screenshot..."
    
    # Capture screenshot using scrot
    if command -v scrot &> /dev/null; then
        scrot -z /tmp/screenshot.png 2>/dev/null
        
        if [ -f /tmp/screenshot.png ]; then
            # Convert to base64
            SCREENSHOT_B64=$(base64 -w 0 /tmp/screenshot.png)
            TIMESTAMP=$(date -Iseconds)
            
            # Send to API
            curl -X POST "$SCREENSHOT_URL" \
                -H "Content-Type: application/json" \
                -d "{\"screenshot\":\"$SCREENSHOT_B64\",\"timestamp\":\"$TIMESTAMP\"}" \
                --max-time 30 --silent
            
            rm -f /tmp/screenshot.png
            echo "$(date): Screenshot sent successfully"
        else
            echo "$(date): Failed to capture screenshot"
        fi
    else
        echo "$(date): scrot not available, skipping screenshot"
    fi
}

# Function to get system activity
get_activity() {
    # Get CPU usage (if available)
    CPU_USAGE=0
    if command -v top &> /dev/null; then
        CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
    fi
    
    # Get memory usage (if available)
    MEMORY_USAGE=0
    if [ -f /proc/meminfo ]; then
        MEMORY_TOTAL=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        MEMORY_AVAILABLE=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        MEMORY_USAGE=$(echo "scale=1; (($MEMORY_TOTAL - $MEMORY_AVAILABLE) * 100) / $MEMORY_TOTAL" | bc -l 2>/dev/null || echo "0")
    fi
    
    # Check if window is active (simplified)
    WINDOW_ACTIVE=false
    if [ -n "$DISPLAY" ]; then
        WINDOW_ACTIVE=true
    fi
    
    # Get current timestamp
    TIMESTAMP=$(date -Iseconds)
    
    # Send activity report
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
        --max-time 15 --silent
    
    echo "$(date): Activity report sent (CPU: ${CPU_USAGE:-0}%, Memory: ${MEMORY_USAGE:-0}%)"
    
    # Reset counters
    MOUSE_EVENTS=0
    KEYBOARD_EVENTS=0
}

# Function to monitor mouse activity (simplified)
monitor_mouse() {
    PREV_POS=""
    while true; do
        if command -v xdotool &> /dev/null; then
            CURRENT_POS=$(xdotool getmouselocation 2>/dev/null)
            if [ -n "$CURRENT_POS" ] && [ "$CURRENT_POS" != "$PREV_POS" ]; then
                MOUSE_EVENTS=$((MOUSE_EVENTS + 1))
                PREV_POS="$CURRENT_POS"
            fi
        fi
        sleep 2
    done
}

# Function to handle shutdown signal
cleanup() {
    echo "$(date): Received shutdown signal, cleaning up..."
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

echo "$(date): Starting ViPER monitoring for instance $INSTANCE_UUID"
echo "$(date): Service URL: $SERVICE_URL"

# Start mouse monitoring in background
monitor_mouse &
MOUSE_PID=$!

# Main monitoring loop
SCREENSHOT_COUNTER=0
ACTIVITY_COUNTER=0

while true; do
    # Send screenshot every 60 seconds (60 iterations of 1 second)
    if [ $SCREENSHOT_COUNTER -ge 60 ]; then
        capture_screenshot &
        SCREENSHOT_COUNTER=0
    fi
    
    # Send activity report every 30 seconds
    if [ $ACTIVITY_COUNTER -ge 30 ]; then
        get_activity &
        ACTIVITY_COUNTER=0
    fi
    
    # Increment counters
    SCREENSHOT_COUNTER=$((SCREENSHOT_COUNTER + 1))
    ACTIVITY_COUNTER=$((ACTIVITY_COUNTER + 1))
    
    # Wait 1 second
    sleep 1
done
