# 10-Minute User Activity Timeout Implementation

## Overview
Modified the ViPER instance activity tracking to use a **10-minute timeout** based on actual user interaction instead of relying on `windowActive` status.

## Changes Made

### New Activity Logic
```typescript
// OLD Logic (windowActive based)
const isActive = activityScore > 0 || windowActive;

// NEW Logic (10-minute timeout based)
const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
const hasRecentInteraction = activityScore > 0;

if (hasRecentInteraction) {
    isActive = true;
    lastInteractionTime = new Date();
} else {
    isActive = lastInteractionTime > tenMinutesAgo;
}
```

### How It Works

1. **Real Interaction Detection**: Only mouse/keyboard events count as user interaction
2. **10-Minute Timer**: User remains "active" for 10 minutes after their last interaction
3. **Precise Tracking**: `lastActivity` timestamp is only updated when user actually interacts
4. **Ignore windowActive**: Window focus state no longer affects activity status

### Behavior Examples

#### Scenario 1: User Actively Working
```
T+0:00 - User clicks mouse → isActive = true, lastActivity = now
T+0:10 - No interaction → isActive = true (still within 10 min)
T+2:30 - User types → isActive = true, lastActivity = now (timer resets)
T+5:00 - No interaction → isActive = true (still within 10 min)
```

#### Scenario 2: User Goes Idle
```
T+0:00 - User clicks mouse → isActive = true, lastActivity = now
T+5:00 - No interaction → isActive = true (within 10 min)
T+10:00 - No interaction → isActive = true (exactly 10 min)
T+10:01 - No interaction → isActive = false (timeout reached)
```

#### Scenario 3: User Returns After Timeout
```
T+0:00 - User goes idle
T+15:00 - No interaction → isActive = false (past 10 min timeout)
T+15:30 - User clicks → isActive = true, lastActivity = now (reactivated)
```

## Technical Implementation

### Database Updates
- `lastActivity` field only updates on actual user interaction
- `isUserActive` reflects 10-minute timeout status
- Activity reports continue every 10 seconds

### Logging Enhancements
New log fields added:
- `hasRecentInteraction`: Boolean - did user just interact?
- `lastInteractionTime`: Timestamp of last interaction
- `tenMinuteTimeoutActive`: Boolean - is user active due to timeout (not current interaction)?

### Monitoring Script Impact
- No changes needed to `viper-monitor.sh`
- Still reports mouse/keyboard events every 10 seconds
- `windowActive` still reported but ignored in activity calculation

## Benefits

1. **Accurate Idle Detection**: Users are only considered active when they actually interact
2. **Reasonable Timeout**: 10 minutes allows for reading/thinking time
3. **Eliminates False Positives**: Window focus issues no longer affect activity status
4. **Better Resource Management**: Inactive instances can be identified more reliably
5. **Improved Logging**: More detailed activity tracking for debugging

## Testing

To test the new timeout:
1. Interact with a ViPER instance (mouse/keyboard)
2. Stop all interaction
3. Check logs - should show `isActive = true` for ~10 minutes
4. After 10 minutes, should show `isActive = false`
5. Interact again - should immediately show `isActive = true`

## Monitoring

Activity logs now show:
```json
{
  "eventType": "Activity Report Received",
  "instanceUUID": "abc123",
  "mouseEvents": 0,
  "keyboardEvents": 0,
  "activityScore": 0,
  "hasRecentInteraction": false,
  "isActive": true,
  "lastInteractionTime": "2025-07-31T01:45:00.000Z",
  "tenMinuteTimeoutActive": true
}
```

This makes it easy to see why an instance is considered active and when the timeout will expire.
