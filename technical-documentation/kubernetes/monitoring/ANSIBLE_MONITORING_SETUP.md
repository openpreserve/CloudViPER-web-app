# Ansible Playbook Updates for Monitoring in Kubernetes

The monitoring scripts need to be baked into the container image, not injected at runtime.

## Add these tasks to your Ansible playbook:

```yaml
- hosts: docker-viper
  tasks:
    # ... existing tasks ...
    
    # ========================================
    # MONITORING SETUP FOR KUBERNETES
    # ========================================
    
    - name: K8S Monitoring | Create monitoring scripts directory
      file:
        path: "/usr/local/share/viper-monitoring"
        state: directory
        mode: '0755'
    
    - name: K8S Monitoring | Create activity monitor script
      copy:
        dest: /usr/local/share/viper-monitoring/activity-monitor.sh
        mode: '0755'
        content: |
          #!/bin/bash
          # Activity monitoring script for ViPER instances
          # Reports mouse/keyboard events and system resources to the web app
          
          INSTANCE_UUID="${INSTANCE_UUID:-unknown}"
          STATUS_KEY="${STATUS_KEY:-unknown}"
          SERVICE_URL="${SERVICE_URL:-http://viper-app:3000}"
          
          # Counters
          MOUSE_EVENTS=0
          KEYBOARD_EVENTS=0
          LAST_REPORT=$(date +%s)
          REPORT_INTERVAL=60  # Report every 60 seconds
          
          # Track window activity
          get_active_window() {
            xdotool getactivewindow 2>/dev/null && echo "true" || echo "false"
          }
          
          # Get system metrics
          get_cpu_usage() {
            top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}'
          }
          
          get_memory_usage() {
            free | grep Mem | awk '{printf "%.1f", ($3/$2) * 100.0}'
          }
          
          # Report to server
          report_activity() {
            local mouse=$1
            local keyboard=$2
            local window_active=$(get_active_window)
            local cpu=$(get_cpu_usage)
            local memory=$(get_memory_usage)
            local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
            
            curl -X POST "${SERVICE_URL}/service/activity/${INSTANCE_UUID}" \
              -H "Content-Type: application/json" \
              -d "{\"mouseEvents\":${mouse},\"keyboardEvents\":${keyboard},\"windowActive\":${window_active},\"cpuUsage\":${cpu},\"memoryUsage\":${memory},\"timestamp\":\"${timestamp}\",\"statusKey\":\"${STATUS_KEY}\"}" \
              --max-time 5 \
              --silent \
              || echo "Failed to report activity"
          }
          
          # Monitor input devices
          monitor_events() {
            xinput list | grep -Po 'id=\K\d+' | while read device_id; do
              xinput test "$device_id" 2>/dev/null &
            done
            
            while read -r line; do
              if [[ $line =~ "motion" ]]; then
                MOUSE_EVENTS=$((MOUSE_EVENTS + 1))
              elif [[ $line =~ "key press" ]] || [[ $line =~ "key release" ]]; then
                KEYBOARD_EVENTS=$((KEYBOARD_EVENTS + 1))
              fi
              
              # Check if it's time to report
              current_time=$(date +%s)
              if [ $((current_time - LAST_REPORT)) -ge $REPORT_INTERVAL ]; then
                report_activity $MOUSE_EVENTS $KEYBOARD_EVENTS
                MOUSE_EVENTS=0
                KEYBOARD_EVENTS=0
                LAST_REPORT=$current_time
              fi
            done
          }
          
          # Start monitoring
          echo "Starting activity monitor for instance ${INSTANCE_UUID}"
          monitor_events
    
    - name: K8S Monitoring | Create screenshot capture script
      copy:
        dest: /usr/local/share/viper-monitoring/screenshot-capture.sh
        mode: '0755'
        content: |
          #!/bin/bash
          # Screenshot capture script for ViPER instances
          # Takes periodic screenshots and uploads to the web app
          
          INSTANCE_UUID="${INSTANCE_UUID:-unknown}"
          STATUS_KEY="${STATUS_KEY:-unknown}"
          SERVICE_URL="${SERVICE_URL:-http://viper-app:3000}"
          SCREENSHOT_INTERVAL=300  # Every 5 minutes
          
          capture_and_upload() {
            local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
            
            # Capture screenshot
            DISPLAY=:1 import -window root -resize 800x600 /tmp/screenshot.png 2>/dev/null
            
            if [ -f /tmp/screenshot.png ]; then
              # Convert to base64
              local screenshot_data=$(base64 -w 0 /tmp/screenshot.png)
              
              # Upload to server
              curl -X POST "${SERVICE_URL}/service/screenshot/${INSTANCE_UUID}" \
                -H "Content-Type: application/json" \
                -d "{\"screenshot\":\"${screenshot_data}\",\"timestamp\":\"${timestamp}\",\"statusKey\":\"${STATUS_KEY}\"}" \
                --max-time 10 \
                --silent \
                || echo "Failed to upload screenshot"
              
              rm -f /tmp/screenshot.png
            fi
          }
          
          # Start screenshot loop
          echo "Starting screenshot capture for instance ${INSTANCE_UUID}"
          while true; do
            capture_and_upload
            sleep $SCREENSHOT_INTERVAL
          done
    
    - name: K8S Monitoring | Create monitoring supervisor script
      copy:
        dest: /usr/local/share/viper-monitoring/start-monitoring.sh
        mode: '0755'
        content: |
          #!/bin/bash
          # Supervisor script to start all monitoring services
          
          echo "Starting ViPER monitoring services..."
          
          # Wait for X server to be ready
          timeout=30
          while [ $timeout -gt 0 ]; do
            if xdpyinfo -display :1 >/dev/null 2>&1; then
              echo "X server is ready"
              break
            fi
            sleep 1
            timeout=$((timeout - 1))
          done
          
          if [ $timeout -eq 0 ]; then
            echo "ERROR: X server not ready after 30 seconds"
            exit 1
          fi
          
          # Start activity monitor in background
          DISPLAY=:1 /usr/local/share/viper-monitoring/activity-monitor.sh >> /var/log/activity-monitor.log 2>&1 &
          echo "Activity monitor started (PID: $!)"
          
          # Start screenshot capture in background
          DISPLAY=:1 /usr/local/share/viper-monitoring/screenshot-capture.sh >> /var/log/screenshot-capture.log 2>&1 &
          echo "Screenshot capture started (PID: $!)"
          
          echo "All monitoring services started"
    
    - name: K8S Monitoring | Install imagemagick for screenshots
      apt:
        name: imagemagick
        state: present
    
    - name: K8S Monitoring | Install xdotool for activity monitoring
      apt:
        name: xdotool
        state: present
    
    - name: K8S Monitoring | Install xinput for device monitoring
      apt:
        name: xinput
        state: present
    
    - name: K8S Monitoring | Create autostart entry for monitoring
      copy:
        dest: /config/.config/autostart/viper-monitoring.desktop
        content: |
          [Desktop Entry]
          Type=Application
          Exec=/usr/local/share/viper-monitoring/start-monitoring.sh
          Hidden=false
          NoDisplay=true
          X-GNOME-Autostart-enabled=true
          Name=ViPER Monitoring
          Comment=Start ViPER activity and screenshot monitoring
        owner: abc
        group: abc
        mode: '0644'
```

## Key Changes from Your Current Setup:

1. **Scripts are installed to `/usr/local/share/viper-monitoring/`** (persists across container restarts)
2. **Uses environment variables** passed from Kubernetes (`INSTANCE_UUID`, `STATUS_KEY`, `SERVICE_URL`)
3. **Autostart via .desktop file** in `/config/.config/autostart/`
4. **No sudo required** - scripts run as `abc` user
5. **Proper error handling** and logging

## After updating the Ansible playbook:

1. Rebuild your viper container image
2. Push to registry
3. Update `VIPER_IMAGE` in your deployment
4. New instances will have monitoring built-in!
