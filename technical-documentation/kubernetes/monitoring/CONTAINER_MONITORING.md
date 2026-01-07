# ViPER Container Monitoring System

## Overview

The ViPER Cloud Web GUI now includes advanced container monitoring capabilities that enable two-way communication between ViPER containers and the service API. This system provides:

- **Screenshot Capture**: Automatic screenshots from containers (1 per minute)
- **Activity Monitoring**: Real-time tracking of user activity (mouse, keyboard, CPU, memory)
- **Automatic Resource Management**: Auto-shutdown of inactive instances after 30 minutes
- **Admin Dashboard Integration**: View screenshots and activity data through the web interface

## New API Endpoints

### 1. Screenshot Upload (Container → Service)
```
POST /service/screenshot/:instanceUUID
Content-Type: application/json

{
  "screenshot": "base64-encoded-image-data",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 2. Activity Reporting (Container → Service)  
```
POST /service/activity/:instanceUUID
Content-Type: application/json

{
  "mouseEvents": 15,
  "keyboardEvents": 8,
  "windowActive": true,
  "cpuUsage": 25.5,
  "memoryUsage": 45.2,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 3. Screenshot Retrieval (Admin Only)
```
GET /service/screenshot/:instanceUUID
```

### 4. Activity History (Admin Only)
```
GET /service/activity/:instanceUUID?limit=50
```

### 5. Cleanup Inactive Instances (Admin Only)
```
POST /service/cleanup-inactive
```

## Container Integration

### Option 1: Python Monitor Script

The `container-monitor.py` script provides comprehensive monitoring:

```bash
# Install dependencies (inside container)
pip3 install requests psutil

# Run monitor
python3 container-monitor.py <instance_uuid> <service_url>
```

**Features:**
- Automatic screenshot capture using `scrot`
- Real-time activity monitoring
- System resource tracking
- Graceful shutdown on inactivity detection

### Option 2: Bash Script (Lightweight)

The `container-monitor.sh` script provides basic monitoring:

```bash
# Run monitor (requires scrot, xdotool, curl)
./container-monitor.sh <instance_uuid> <service_url>
```

**Features:**
- Basic screenshot capture
- Simple activity reporting
- Minimal resource usage
- Easy integration

### Integration with Docker Containers

Add monitoring to your ViPER container startup:

```dockerfile
# Copy monitor script
COPY container-monitor.py /usr/local/bin/
COPY container-monitor.sh /usr/local/bin/

# Install dependencies
RUN apt-get update && apt-get install -y scrot xdotool curl bc
RUN pip3 install requests psutil

# Add to startup script
RUN echo "python3 /usr/local/bin/container-monitor.py \$INSTANCE_UUID \$SERVICE_URL &" >> /startup.sh
```

Or start monitoring after container launch:

```bash
# Inside container
export INSTANCE_UUID="your-instance-uuid"
export SERVICE_URL="https://cloudviper.org"

# Start monitoring in background
python3 /usr/local/bin/container-monitor.py $INSTANCE_UUID $SERVICE_URL &
```

## Admin Dashboard Features

### Instance Monitoring Tab

The admin dashboard now shows enhanced instance information:

- **Activity Status**: Real-time indication of user activity
- **Last Activity**: Timestamp of last recorded activity  
- **Activity Score**: Cumulative activity metric
- **Screenshot Preview**: Thumbnail of latest screenshot
- **Activity History Button**: View detailed activity reports
- **Screenshot Button**: View full-size latest screenshot

### New Status Indicators

- 🟢 **Active User**: Instance has recent user activity
- 🟡 **Inactive**: No recent activity detected
- 📷 **Monitored**: Instance is sending screenshots
- ⚠️ **Pending Shutdown**: Marked for auto-shutdown due to inactivity

### Admin Controls

- **View Activity**: Popup showing activity summary and metrics
- **View Screenshot**: Opens latest screenshot in new window
- **Cleanup Inactive Instances**: Manually trigger auto-shutdown of inactive instances

## Database Schema Updates

The `ViperInstance` model now includes:

```typescript
interface ViperInstanceAttributes {
  // ... existing fields ...
  lastActivity?: Date;           // Last recorded activity timestamp
  lastScreenshot?: any;          // Latest screenshot data and metadata
  activityHistory?: any[];       // Array of recent activity reports
  activityScore?: number;        // Cumulative activity score
  isUserActive?: boolean;        // Current user activity status
}
```

## Configuration

### Environment Variables

Set these in your ViPER containers:

```bash
INSTANCE_UUID=<your-instance-uuid>     # UUID of the instance
SERVICE_URL=<your-service-url>         # URL of the ViPER service API
MONITOR_SCREENSHOT_INTERVAL=60         # Screenshot interval in seconds (default: 60)
MONITOR_ACTIVITY_INTERVAL=30           # Activity report interval in seconds (default: 30)
```

### Monitoring Configuration

**Screenshot Interval**: Default 1 minute (configurable)
**Activity Reporting**: Default 30 seconds (configurable)  
**Inactivity Threshold**: 30 minutes (configurable in service.ts)
**Activity History Retention**: Last 100 entries per instance

## Security Considerations

- All monitoring endpoints require instance UUID validation
- Screenshot and activity retrieval requires authentication
- Admin-only access for viewing other users' instance data
- Rate limiting applied to prevent abuse
- Screenshot data is stored temporarily and can be purged

## Troubleshooting

### Common Issues

1. **Screenshots not capturing**
   - Ensure `scrot` is installed in container
   - Verify X11 display is available (`$DISPLAY` set)
   - Check file permissions on `/tmp` directory

2. **Activity not reporting**
   - Verify network connectivity to service API
   - Check instance UUID is correct
   - Ensure required tools (`xdotool`, `curl`) are available

3. **Auto-shutdown not working**
   - Verify activity reports are being received
   - Check admin dashboard for instance status
   - Review server logs for cleanup errors

### Debug Commands

```bash
# Test screenshot capture
scrot -z /tmp/test.png && echo "Screenshot OK" || echo "Screenshot failed"

# Test API connectivity
curl -X POST "$SERVICE_URL/service/activity/$INSTANCE_UUID" \
  -H "Content-Type: application/json" \
  -d '{"mouseEvents":1,"timestamp":"'$(date -Iseconds)'"}'

# Check container resources
top -bn1 | head -20
free -h
df -h
```

## Performance Impact

- **Screenshot capture**: ~1-5MB per minute (depending on screen content)
- **Activity reporting**: ~1KB per report every 30 seconds
- **CPU overhead**: <1% for monitoring activities
- **Memory usage**: ~10-50MB for monitoring scripts

## Future Enhancements

- Video recording capabilities
- Advanced activity pattern analysis
- Custom auto-shutdown policies
- Integration with container orchestration
- Performance optimization alerts
- User activity heatmaps
