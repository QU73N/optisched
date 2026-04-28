import { supabase } from '../lib/supabase';
import type { Notification } from '../types/database';

export async function createNotification(
    userId: string,
    type: 'schedule_change' | 'sharing_request' | 'approval' | 'system' | 'reminder',
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
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error('User not authenticated');

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
    if (error) throw error;
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
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.rpc('get_unread_notification_count', {
        p_user_id: user.id
    });
    if (error) throw error;
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
export function subscribeToNotifications(
    callback: (notification: Notification) => void
): () => void {
    const { data: authData } = supabase.auth.getUser();
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
