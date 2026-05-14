import { supabase } from '../lib/supabase';
import type { Notification } from '../types/database';

export async function createNotification(
    userId: string,
    type: 'schedule_change' | 'sharing_request' | 'approval' | 'system' | 'reminder' | 'conflict_alert' | 'announcement' | 'password_reset' | 'event',
    title: string,
    message: string,
    data: Record<string, unknown> = {},
    actionUrl?: string,
    expiresHours?: number
): Promise<string> {
    const { data: result, error } = await supabase.rpc('create_notification', {
        p_user_id: userId,
        p_type: type,
        p_title: title,
        p_message: message,
        p_data: data,
        p_action_url: actionUrl || null,
        p_expires_hours: expiresHours || null
    });
    if (error) throw error;
    return result;
}

export async function getNotifications(
    unreadOnly = false,
    limit = 50
): Promise<Notification[]> {
    console.log('[NotificationService] getNotifications called, unreadOnly:', unreadOnly, 'limit:', limit);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
        console.error('[NotificationService] User not authenticated');
        throw new Error('User not authenticated');
    }

    console.log('[NotificationService] Querying notifications for user:', user.id);
    let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (unreadOnly) {
        query = query.eq('is_read', false);
    }

    const { data, error } = await query;
    if (error) {
        console.error('[NotificationService] Query error:', error);
        throw error;
    }
    console.log('[NotificationService] Query success, returned', (data || []).length, 'notifications');
    return (data || []) as Notification[];
}

export async function markAsRead(notificationId: string): Promise<boolean> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId,
        p_user_id: user.id
    });
    if (error) throw error;
    return data || false;
}

export async function markAllAsRead(): Promise<number> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.rpc('mark_all_notifications_read', {
        p_user_id: user.id
    });
    if (error) throw error;
    return data || 0;
}

export async function getUnreadCount(): Promise<number> {
    console.log('[NotificationService] getUnreadCount called');
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
        console.error('[NotificationService] User not authenticated');
        throw new Error('User not authenticated');
    }

    console.log('[NotificationService] Calling RPC get_unread_notification_count for user:', user.id);
    const { data, error } = await supabase.rpc('get_unread_notification_count', {
        p_user_id: user.id
    });
    if (error) {
        console.error('[NotificationService] RPC error:', error);
        throw error;
    }
    console.log('[NotificationService] RPC success, unread count:', data);
    return data || 0;
}

export async function deleteNotification(notificationId: string): Promise<void> {
    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);
    if (error) throw error;
}

// Real-time subscription to notifications
export async function subscribeToNotifications(
    callback: (notification: Notification) => void
): Promise<() => void> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return () => {};

    const channel = supabase
        .channel('notifications')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`
            },
            (payload) => {
                callback(payload.new as Notification);
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

// Create a conflict alert notification for admins
export async function createConflictAlert(
    conflictCount: number,
    severity: 'low' | 'medium' | 'high',
    details?: Record<string, unknown>
): Promise<void> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    // Check if user is admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    if (profile?.role !== 'admin') return;

    await createNotification(
        user.id,
        'conflict_alert',
        `Schedule Conflicts Detected (${severity.toUpperCase()})`,
        `${conflictCount} conflict${conflictCount !== 1 ? 's' : ''} found in the schedule. Please review and resolve.`,
        {
            conflict_count: conflictCount,
            severity,
            timestamp: new Date().toISOString(),
            ...details,
        },
        '/admin/conflicts',
        24 // Expires in 24 hours
    );
}

// Create an announcement for all users
export async function createAnnouncement(
    title: string,
    message: string,
    actionUrl?: string,
    expiresHours?: number
): Promise<number> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error('User not authenticated');

    // Check if user is admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    if (profile?.role !== 'admin') throw new Error('Only admins can create announcements');

    // Get all active users
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_active', true);

    if (error) throw error;
    if (!profiles) return 0;

    // Create announcement for each user
    let createdCount = 0;
    for (const profile of profiles) {
        try {
            await createNotification(
                profile.id,
                'announcement',
                title,
                message,
                {
                    created_by: user.id,
                    created_at: new Date().toISOString(),
                },
                actionUrl,
                expiresHours || 168 // Default 7 days
            );
            createdCount++;
        } catch (err) {
            console.error(`Failed to create announcement for user ${profile.id}:`, err);
        }
    }

    return createdCount;
}

// Create conflict resolution notification
export async function createConflictResolutionNotification(
    conflictsResolved: number,
    conflictsRemaining: number
): Promise<void> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) return;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

    if (profile?.role !== 'admin') return;

    const title = conflictsRemaining === 0 
        ? 'All Conflicts Resolved' 
        : 'Conflicts Partially Resolved';
    
    const message = conflictsRemaining === 0
        ? `Successfully resolved all ${conflictsResolved} conflicts. The schedule is now conflict-free.`
        : `Resolved ${conflictsResolved} conflicts. ${conflictsRemaining} conflict${conflictsRemaining !== 1 ? 's' : ''} remain.`;

    await createNotification(
        user.id,
        'conflict_alert',
        title,
        message,
        {
            resolved_count: conflictsResolved,
            remaining_count: conflictsRemaining,
            timestamp: new Date().toISOString(),
        },
        '/admin/conflicts',
        24
    );
}

// Create password reset notification for admin
export async function createPasswordResetNotification(
    email: string,
    requestId: string
): Promise<void> {
    // Get all admins to notify
    const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['power_admin', 'system_admin', 'schedule_admin']);

    if (!admins) return;

    for (const admin of admins) {
        try {
            await createNotification(
                admin.id,
                'password_reset',
                'Password Reset Request',
                `User ${email} has requested a password reset.`,
                {
                    email,
                    request_id: requestId,
                    timestamp: new Date().toISOString(),
                },
                '/admin',
                24 // Expires in 24 hours
            );
        } catch (err) {
            console.error(`Failed to create password reset notification for admin ${admin.id}:`, err);
        }
    }
}

// Create event notification for all users
export async function createEventNotification(
    eventTitle: string,
    eventDate: string,
    eventTime: string,
    eventId: string
): Promise<void> {
    // Get all active users
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_active', true);

    if (!profiles) return;

    const message = `Event: ${eventTitle} on ${new Date(eventDate).toLocaleDateString()} at ${eventTime}`;

    for (const profile of profiles) {
        try {
            await createNotification(
                profile.id,
                'event',
                'New Event Added',
                message,
                {
                    event_id: eventId,
                    event_title: eventTitle,
                    event_date: eventDate,
                    event_time: eventTime,
                    timestamp: new Date().toISOString(),
                },
                undefined, // No action URL for events
                168 // Expires in 7 days
            );
        } catch (err) {
            console.error(`Failed to create event notification for user ${profile.id}:`, err);
        }
    }
}

// Create teacher request notification for admins
export async function createTeacherRequestNotification(
    teacherName: string,
    requestType: string,
    requestId: string
): Promise<void> {
    // Get all admins to notify
    const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['power_admin', 'system_admin', 'schedule_admin']);

    if (!admins) return;

    for (const admin of admins) {
        try {
            await createNotification(
                admin.id,
                'approval',
                'New Teacher Request',
                `${teacherName} submitted a ${requestType} request.`,
                {
                    teacher_name: teacherName,
                    request_type: requestType,
                    request_id: requestId,
                    timestamp: new Date().toISOString(),
                },
                '/admin',
                24 // Expires in 24 hours
            );
        } catch (err) {
            console.error(`Failed to create teacher request notification for admin ${admin.id}:`, err);
        }
    }
}
