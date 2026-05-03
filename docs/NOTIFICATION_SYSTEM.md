# OptiSched Notification System

## Overview

The OptiSched notification system provides a unified way to send alerts, notifications, and announcements across both web and mobile platforms. All notifications are stored in the Supabase `notifications` table and can be synced in real-time.

## Database Schema

### `notifications` Table

```sql
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY[
    'schedule_change'::text, 
    'sharing_request'::text, 
    'approval'::text, 
    'system'::text, 
    'reminder'::text,
    'conflict_alert'::text,
    'announcement'::text
  ])),
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  is_read boolean DEFAULT false,
  action_url text,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
```

## Notification Types

### 1. `schedule_change`
- Triggered when a schedule is published
- Notifies affected teachers and students
- Auto-created via database trigger

### 2. `sharing_request`
- When a schedule is shared with a user
- Pending approval notifications

### 3. `approval`
- Approval request status updates
- For schedule changes, new schedules, deletions

### 4. `system`
- General system notifications
- Maintenance alerts, updates

### 5. `reminder`
- Time-based reminders
- Deadline notifications

### 6. `conflict_alert` (NEW)
- Conflict detection alerts for admins
- Severity levels: low, medium, high
- Auto-created when conflicts are detected
- Includes conflict count and details

### 7. `announcement` (NEW)
- System-wide announcements from admins
- Broadcast to all active users
- Used for important updates, maintenance notices, etc.

## Web API

### Notification Service (`web/src/services/notificationService.ts`)

#### `createNotification(userId, type, title, message, data?, actionUrl?, expiresHours?)`
Creates a single notification for a user.

```typescript
import { createNotification } from '../services/notificationService';

await createNotification(
  'user-id',
  'schedule_change',
  'Schedule Updated',
  'Your schedule has been modified',
  { schedule_id: '123' },
  '/schedule',
  24 // expires in 24 hours
);
```

#### `createConflictAlert(conflictCount, severity, details?)`
Creates a conflict alert for admins only.

```typescript
import { createConflictAlert } from '../services/notificationService';

await createConflictAlert(
  5,
  'high',
  { soft_score: 85, scan_timestamp: '2024-01-01T00:00:00Z' }
);
```

#### `createAnnouncement(title, message, actionUrl?, expiresHours?)`
Creates an announcement for all active users (admin only).

```typescript
import { createAnnouncement } from '../services/notificationService';

const count = await createAnnouncement(
  'System Maintenance',
  'The system will be down for maintenance on Sunday from 2-4 AM.',
  '/maintenance',
  168 // 7 days
);
console.log(`Announcement sent to ${count} users`);
```

#### `createConflictResolutionNotification(conflictsResolved, conflictsRemaining)`
Creates a notification after conflicts are resolved.

```typescript
import { createConflictResolutionNotification } from '../services/notificationService';

await createConflictResolutionNotification(
  10,
  0 // All conflicts resolved
);
```

#### `getNotifications(unreadOnly?, limit?)`
Fetches notifications for the current user.

```typescript
const notifications = await getNotifications(false, 50);
const unread = await getNotifications(true, 10);
```

#### `markAsRead(notificationId)`
Marks a notification as read.

```typescript
await markAsRead('notification-id');
```

#### `markAllAsRead()`
Marks all notifications as read for the current user.

```typescript
const count = await markAllAsRead();
```

#### `getUnreadCount()`
Gets the count of unread notifications.

```typescript
const count = await getUnreadCount();
```

#### `deleteNotification(notificationId)`
Deletes a notification.

```typescript
await deleteNotification('notification-id');
```

#### `subscribeToNotifications(callback)`
Subscribes to real-time notification updates.

```typescript
const unsubscribe = await subscribeToNotifications((notification) => {
  console.log('New notification:', notification);
});

// Call unsubscribe to stop listening
unsubscribe();
```

## Integration with Conflict Fixer Engine

The Conflict Fixer Engine automatically creates notifications:

1. **When conflicts are detected**: Creates a `conflict_alert` notification with severity based on the number and type of conflicts
2. **When conflicts are resolved**: Creates a `conflict_alert` notification showing how many conflicts were resolved and how many remain

### Example Flow

```typescript
// 1. Scan for conflicts
const result = await scanAllConstraints(schedules, teachers, rooms, sections, subjects, constraints);

// 2. If conflicts found, auto-create alert
if (result.hardViolations.length > 0) {
  const severity = result.hardViolations.length > 10 ? 'high' : 
                   result.hardViolations.length > 5 ? 'medium' : 'low';
  await createConflictAlert(result.hardViolations.length, severity, {
    soft_score: result.softScore.totalScore,
    scan_timestamp: result.scannedAt,
  });
}

// 3. Apply fixes
const fixResult = await applyAutonomousFixes(...);

// 4. After rescan, notify of resolution
await createConflictResolutionNotification(
  fixResult.conflictsResolvedInLastPass,
  newScanResult.hardViolations.length
);
```

## Mobile Sync

### For Mobile Developers

To sync notifications with the mobile app:

1. **Subscribe to real-time updates** using Supabase Realtime
2. **Fetch notifications** using the same API as web
3. **Display notifications** in your notification center
4. **Mark as read** when user taps a notification

### Example Mobile Integration (React Native)

```typescript
import { supabase } from './supabase';

// Fetch notifications
const fetchNotifications = async (userId: string) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  
  return data;
};

// Subscribe to real-time updates
const subscribeToNotifications = (userId: string, callback: (notification) => void) => {
  const channel = supabase
    .channel('notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => callback(payload.new)
    )
    .subscribe();
  
  return () => supabase.removeChannel(channel);
};

// Mark as read
const markAsRead = async (notificationId: string) => {
  await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
    p_user_id: userId
  });
};
```

## Database RPC Functions

The following RPC functions are available:

- `create_notification(p_user_id, p_type, p_title, p_message, p_data, p_action_url, p_expires_hours)` - Creates a notification
- `mark_notification_read(p_notification_id, p_user_id)` - Marks a notification as read
- `mark_all_notifications_read(p_user_id)` - Marks all notifications as read
- `get_unread_notification_count(p_user_id)` - Gets unread count

## Security

- All notification functions use `SECURITY DEFINER` with proper RLS policies
- Only admins can create announcements
- Users can only read their own notifications
- Notifications automatically expire based on `expires_at`

## Best Practices

1. **Use appropriate notification types** - Choose the type that best matches the notification purpose
2. **Set reasonable expiration times** - Don't let notifications pile up indefinitely
3. **Include actionable data** - Use the `data` field to include relevant information
4. **Provide action URLs** - Link notifications to relevant pages in the app
5. **Don't spam** - Limit the frequency of notifications per user
6. **Use real-time subscriptions** - Keep users updated without requiring page refreshes

## Migration

To add the new notification types (`conflict_alert` and `announcement`), run:

```bash
psql -h your-project.supabase.co -U postgres -d postgres -f database/supabase/add_conflict_announcement_notification_types.sql
```

Or run the SQL directly in the Supabase SQL editor.
