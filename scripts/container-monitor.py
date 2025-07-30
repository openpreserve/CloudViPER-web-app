#!/usr/bin/env python3
"""
ViPER Container Monitoring Script

This script should be run inside ViPER containers to send screenshots
and activity reports to the service API for monitoring and automatic
resource management.

Usage:
    python3 container-monitor.py <instance_uuid> <service_url>

Example:
    python3 container-monitor.py abc123-def456 https://cloudviper.org
"""

import sys
import time
import json
import base64
import requests
import subprocess
from datetime import datetime
import psutil
import os
import signal
from threading import Thread
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ViPERMonitor:
    def __init__(self, instance_uuid, service_url):
        self.instance_uuid = instance_uuid
        self.service_url = service_url.rstrip('/')
        self.screenshot_url = f"{self.service_url}/service/screenshot/{instance_uuid}"
        self.activity_url = f"{self.service_url}/service/activity/{instance_uuid}"
        
        # Activity tracking
        self.mouse_events = 0
        self.keyboard_events = 0
        self.window_active = False
        self.running = True
        
        # Screenshot interval (1 minute)
        self.screenshot_interval = 60
        
        # Activity report interval (30 seconds)
        self.activity_interval = 30

    def capture_screenshot(self):
        """Capture a screenshot and return as base64 encoded string"""
        try:
            # Use scrot to capture screenshot (common in Linux desktop environments)
            result = subprocess.run(['scrot', '-z', '/tmp/screenshot.png'], 
                                  capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0 and os.path.exists('/tmp/screenshot.png'):
                with open('/tmp/screenshot.png', 'rb') as f:
                    screenshot_data = base64.b64encode(f.read()).decode('utf-8')
                os.remove('/tmp/screenshot.png')
                return screenshot_data
            else:
                logger.warning(f"scrot failed: {result.stderr}")
                return None
                
        except subprocess.TimeoutExpired:
            logger.warning("Screenshot capture timed out")
            return None
        except Exception as e:
            logger.error(f"Error capturing screenshot: {e}")
            return None

    def send_screenshot(self, screenshot_data):
        """Send screenshot to service API"""
        try:
            payload = {
                'screenshot': screenshot_data,
                'timestamp': datetime.now().isoformat()
            }
            
            response = requests.post(self.screenshot_url, json=payload, timeout=30)
            
            if response.status_code == 200:
                logger.info("Screenshot sent successfully")
                return True
            else:
                logger.warning(f"Screenshot upload failed: {response.status_code} - {response.text}")
                return False
                
        except requests.RequestException as e:
            logger.error(f"Error sending screenshot: {e}")
            return False

    def get_system_activity(self):
        """Get current system activity metrics"""
        try:
            # Get CPU and memory usage
            cpu_usage = psutil.cpu_percent(interval=1)
            memory_usage = psutil.virtual_memory().percent
            
            # Check if any GUI windows are active (simplified detection)
            window_active = self.check_window_activity()
            
            return {
                'mouseEvents': self.mouse_events,
                'keyboardEvents': self.keyboard_events,
                'windowActive': window_active,
                'cpuUsage': cpu_usage,
                'memoryUsage': memory_usage,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error getting system activity: {e}")
            return None

    def check_window_activity(self):
        """Check if there's window activity (simplified)"""
        try:
            # Check if X11 session is active and has focus
            result = subprocess.run(['xdotool', 'getactivewindow'], 
                                  capture_output=True, text=True, timeout=5)
            return result.returncode == 0
        except:
            # Fallback to checking if display is set
            return bool(os.environ.get('DISPLAY'))

    def send_activity_report(self, activity_data):
        """Send activity report to service API"""
        try:
            response = requests.post(self.activity_url, json=activity_data, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Activity report sent: Score={data.get('activityScore', 0)}, Active={data.get('isActive', False)}")
                
                # Check if we should shutdown
                if data.get('shouldShutdown', False):
                    logger.warning(f"Instance marked for shutdown due to inactivity ({data.get('inactiveMinutes', 0)} minutes)")
                    self.initiate_shutdown()
                
                return True
            else:
                logger.warning(f"Activity report failed: {response.status_code} - {response.text}")
                return False
                
        except requests.RequestException as e:
            logger.error(f"Error sending activity report: {e}")
            return False

    def initiate_shutdown(self):
        """Initiate graceful shutdown of the container"""
        logger.info("Initiating graceful shutdown due to inactivity...")
        self.running = False
        
        # Give a few seconds for cleanup
        time.sleep(5)
        
        # Send SIGTERM to the container's main process (usually PID 1)
        try:
            os.kill(1, signal.SIGTERM)
        except:
            # If that doesn't work, try shutting down the system
            subprocess.run(['shutdown', 'now'])

    def monitor_input_events(self):
        """Monitor for mouse and keyboard events (simplified tracking)"""
        try:
            # This is a simplified implementation
            # In a real implementation, you might use libraries like pynput
            # or monitor X11 events directly
            
            prev_mouse_pos = None
            
            while self.running:
                try:
                    # Check mouse position changes (basic activity detection)
                    result = subprocess.run(['xdotool', 'getmouselocation'], 
                                          capture_output=True, text=True, timeout=2)
                    if result.returncode == 0:
                        current_pos = result.stdout.strip()
                        if prev_mouse_pos and current_pos != prev_mouse_pos:
                            self.mouse_events += 1
                        prev_mouse_pos = current_pos
                        
                except:
                    pass
                
                time.sleep(1)
                
        except Exception as e:
            logger.error(f"Error monitoring input events: {e}")

    def screenshot_worker(self):
        """Worker thread for capturing and sending screenshots"""
        logger.info(f"Starting screenshot worker (interval: {self.screenshot_interval}s)")
        
        while self.running:
            try:
                screenshot = self.capture_screenshot()
                if screenshot:
                    self.send_screenshot(screenshot)
                    logger.info("Screenshot captured and sent")
                else:
                    logger.warning("No screenshot captured")
                    
            except Exception as e:
                logger.error(f"Error in screenshot worker: {e}")
            
            # Wait for next screenshot
            for _ in range(self.screenshot_interval):
                if not self.running:
                    break
                time.sleep(1)

    def activity_worker(self):
        """Worker thread for sending activity reports"""
        logger.info(f"Starting activity worker (interval: {self.activity_interval}s)")
        
        while self.running:
            try:
                activity_data = self.get_system_activity()
                if activity_data:
                    self.send_activity_report(activity_data)
                    
                    # Reset counters after sending
                    self.mouse_events = 0
                    self.keyboard_events = 0
                    
            except Exception as e:
                logger.error(f"Error in activity worker: {e}")
            
            # Wait for next report
            for _ in range(self.activity_interval):
                if not self.running:
                    break
                time.sleep(1)

    def run(self):
        """Main monitoring loop"""
        logger.info(f"Starting ViPER Monitor for instance {self.instance_uuid}")
        logger.info(f"Service URL: {self.service_url}")
        
        try:
            # Start worker threads
            screenshot_thread = Thread(target=self.screenshot_worker, daemon=True)
            activity_thread = Thread(target=self.activity_worker, daemon=True)
            input_thread = Thread(target=self.monitor_input_events, daemon=True)
            
            screenshot_thread.start()
            activity_thread.start()
            input_thread.start()
            
            # Main loop - just keep alive
            while self.running:
                time.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("Received interrupt signal, shutting down...")
            self.running = False
        except Exception as e:
            logger.error(f"Error in main loop: {e}")
            self.running = False

def main():
    if len(sys.argv) != 3:
        print("Usage: python3 container-monitor.py <instance_uuid> <service_url>")
        print("Example: python3 container-monitor.py abc123-def456 https://cloudviper.org")
        sys.exit(1)
    
    instance_uuid = sys.argv[1]
    service_url = sys.argv[2]
    
    # Validate inputs
    if not instance_uuid or not service_url:
        print("Error: Both instance_uuid and service_url are required")
        sys.exit(1)
    
    monitor = ViPERMonitor(instance_uuid, service_url)
    monitor.run()

if __name__ == "__main__":
    main()
