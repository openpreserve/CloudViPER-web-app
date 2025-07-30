#!/bin/bash
# Debug script for ViPER monitoring system
# This script helps test and debug the monitoring functionality

INSTANCE_UUID="${1:-test-instance-123}"
SERVICE_URL="${2:-http://localhost:3000}"
DEBUG_MODE="${3:-1}"

echo "=== ViPER Monitoring Debug Script ==="
echo "Instance UUID: $INSTANCE_UUID"
echo "Service URL: $SERVICE_URL"
echo "Debug Mode: $DEBUG_MODE"
echo ""

# Test URLs
SCREENSHOT_URL="${SERVICE_URL}/service/screenshot/${INSTANCE_UUID}"
ACTIVITY_URL="${SERVICE_URL}/service/activity/${INSTANCE_UUID}"

echo "Testing URLs:"
echo "Screenshot URL: $SCREENSHOT_URL"
echo "Activity URL: $ACTIVITY_URL"
echo ""

# Test connectivity
echo "=== Testing Connectivity ==="
echo "Testing connection to service..."
if curl -f -s --max-time 5 "$SERVICE_URL" > /dev/null; then
    echo "✓ Service is reachable"
else
    echo "✗ Service is not reachable"
fi
echo ""

# Test required tools
echo "=== Testing Required Tools ==="
tools=("scrot" "xdotool" "curl" "bc" "base64")
for tool in "${tools[@]}"; do
    if command -v "$tool" &> /dev/null; then
        echo "✓ $tool is available"
    else
        echo "✗ $tool is NOT available"
    fi
done
echo ""

# Test environment
echo "=== Testing Environment ==="
echo "DISPLAY: ${DISPLAY:-'not set'}"
echo "USER: ${USER:-'not set'}"
echo "HOME: ${HOME:-'not set'}"
echo "PWD: $PWD"
echo ""

# Test screenshot capture
echo "=== Testing Screenshot Capture ==="
if command -v scrot &> /dev/null && [ -n "$DISPLAY" ]; then
    echo "Attempting to capture test screenshot..."
    if scrot -z /tmp/debug_screenshot.png 2>/dev/null; then
        if [ -f /tmp/debug_screenshot.png ]; then
            size=$(stat -c%s /tmp/debug_screenshot.png 2>/dev/null || echo "unknown")
            echo "✓ Screenshot captured successfully (size: $size bytes)"
            
            # Test base64 encoding
            if base64 /tmp/debug_screenshot.png > /tmp/debug_screenshot.b64 2>/dev/null; then
                b64_size=$(stat -c%s /tmp/debug_screenshot.b64 2>/dev/null || echo "unknown")
                echo "✓ Base64 encoding successful (size: $b64_size bytes)"
            else
                echo "✗ Base64 encoding failed"
            fi
            
            rm -f /tmp/debug_screenshot.png /tmp/debug_screenshot.b64
        else
            echo "✗ Screenshot file was not created"
        fi
    else
        echo "✗ Screenshot capture failed"
    fi
else
    echo "✗ Cannot capture screenshot (scrot not available or DISPLAY not set)"
fi
echo ""

# Test mouse detection
echo "=== Testing Mouse Detection ==="
if command -v xdotool &> /dev/null && [ -n "$DISPLAY" ]; then
    echo "Attempting to get mouse position..."
    if mouse_pos=$(xdotool getmouselocation 2>/dev/null); then
        echo "✓ Mouse position detected: $mouse_pos"
    else
        echo "✗ Mouse position detection failed"
    fi
else
    echo "✗ Cannot detect mouse (xdotool not available or DISPLAY not set)"
fi
echo ""

# Test window detection
echo "=== Testing Window Detection ==="
if command -v xdotool &> /dev/null && [ -n "$DISPLAY" ]; then
    echo "Attempting to get active window..."
    if xdotool getactivewindow &>/dev/null; then
        echo "✓ Active window detected"
    else
        echo "✗ No active window detected"
    fi
else
    echo "✗ Cannot detect windows (xdotool not available or DISPLAY not set)"
fi
echo ""

# Test system stats
echo "=== Testing System Stats ==="
echo "Testing CPU usage calculation..."
if cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}' 2>/dev/null); then
    echo "✓ CPU usage: ${cpu_usage}%"
else
    echo "✗ CPU usage calculation failed"
fi

echo "Testing memory usage calculation..."
if [ -f /proc/meminfo ]; then
    memory_total=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    memory_available=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
    if command -v bc &> /dev/null; then
        memory_usage=$(echo "scale=1; (($memory_total - $memory_available) * 100) / $memory_total" | bc -l 2>/dev/null || echo "0")
        echo "✓ Memory usage: ${memory_usage}% (Total: ${memory_total}KB, Available: ${memory_available}KB)"
    else
        echo "✗ Memory usage calculation failed (bc not available)"
    fi
else
    echo "✗ Memory info not available"
fi
echo ""

# Test network calls (if in test mode)
if [ "$DEBUG_MODE" = "1" ]; then
    echo "=== Testing Network Calls (Test Mode) ==="
    
    echo "Testing activity report..."
    activity_payload='{"mouseEvents": 5, "keyboardEvents": 3, "windowActive": true, "cpuUsage": 25.5, "memoryUsage": 60.2, "timestamp": "'$(date -Iseconds)'"}'
    
    echo "Payload: $activity_payload"
    echo "Sending to: $ACTIVITY_URL"
    
    if curl -X POST "$ACTIVITY_URL" \
        -H "Content-Type: application/json" \
        -d "$activity_payload" \
        --max-time 15 -v 2>&1; then
        echo "✓ Activity report test completed"
    else
        echo "✗ Activity report test failed"
    fi
    echo ""
    
    # Note: Not testing screenshot upload as it requires a real image and instance
    echo "Note: Screenshot upload test skipped (requires valid instance and image)"
fi

echo "=== Debug Script Complete ==="
echo ""
echo "If issues are found:"
echo "1. Check that required tools are installed"
echo "2. Verify DISPLAY environment variable is set"
echo "3. Ensure the service URLs are accessible"
echo "4. Check container logs at /tmp/viper-monitor.log (if debug mode is enabled)"
echo "5. Verify instance UUID exists in the database"
