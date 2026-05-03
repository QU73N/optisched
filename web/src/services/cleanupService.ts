import { supabase } from '../lib/supabase';

export interface CleanupResult {
    cleaned_count: number;
    details: string;
}

export interface SoftDeletedCount {
    total_count: number;
    older_than_30_days: number;
    details: string;
}

export interface SoftDeletedSchedule {
    id: string;
    subject_id: string | null;
    teacher_id: string | null;
    room_id: string | null;
    section_id: string | null;
    day_of_week: string;
    start_time: string;
    end_time: string;
    semester: string;
    academic_year: string;
    status: string;
    deleted_at: string;
    deleted_by: string | null;
    days_since_deletion: number;
    cleanup_status: 'READY_FOR_CLEANUP' | 'APPROACHING_CLEANUP' | 'ACTIVE_RETENTION';
}

export interface ExpiredNotificationCount {
    expired_count: number;
    active_count: number;
    total_count: number;
    details: string;
}

export interface ExpiredNotification {
    id: string;
    user_id: string;
    type: string;
    title: string;
    is_read: boolean;
    expires_at: string;
    created_at: string;
    days_until_expiry: number;
    expiry_status: 'EXPIRED' | 'EXPIRING_SOON' | 'ACTIVE';
}

/**
 * Clean up soft-deleted schedules older than 30 days
 * Only Power Admins should execute this function
 * @returns Cleanup result with count and details
 */
export async function cleanupSoftDeletedSchedules(): Promise<CleanupResult> {
    const { data, error } = await supabase.rpc('cleanup_soft_deleted_schedules');
    
    if (error) throw error;
    
    return data as CleanupResult;
}

/**
 * Get count of soft-deleted schedules
 * @returns Count of total soft-deleted schedules and those ready for cleanup
 */
export async function getSoftDeletedScheduleCount(): Promise<SoftDeletedCount> {
    const { data, error } = await supabase.rpc('get_soft_deleted_schedule_count');
    
    if (error) throw error;
    
    return data as SoftDeletedCount;
}

/**
 * Get all soft-deleted schedules with cleanup status
 * @returns Array of soft-deleted schedules with cleanup status
 */
export async function getSoftDeletedSchedules(): Promise<SoftDeletedSchedule[]> {
    const { data, error } = await supabase
        .from('soft_deleted_schedules_monitor')
        .select('*')
        .order('deleted_at', { ascending: false });
    
    if (error) throw error;
    
    return data as SoftDeletedSchedule[];
}

/**
 * Clean up expired notifications
 * Only Power Admins should execute this function
 * @returns Cleanup result with count and details
 */
export async function cleanupExpiredNotifications(): Promise<CleanupResult> {
    const { data, error } = await supabase.rpc('cleanup_expired_notifications');
    
    if (error) throw error;
    
    return data as CleanupResult;
}

/**
 * Get count of expired notifications
 * @returns Count of expired, active, and total notifications
 */
export async function getExpiredNotificationCount(): Promise<ExpiredNotificationCount> {
    const { data, error } = await supabase.rpc('get_expired_notification_count');
    
    if (error) throw error;
    
    return data as ExpiredNotificationCount;
}

/**
 * Get all notifications with expiry status
 * @returns Array of notifications with expiry status
 */
export async function getExpiringNotifications(): Promise<ExpiredNotification[]> {
    const { data, error } = await supabase
        .from('notification_expiry_monitor')
        .select('*')
        .order('expires_at', { ascending: true });
    
    if (error) throw error;
    
    return data as ExpiredNotification[];
}

/**
 * Manually trigger schedule cleanup (for Power Admins only)
 * This is a wrapper around cleanupSoftDeletedSchedules with additional permission check
 * @returns Cleanup result with count and details
 */
export async function manualScheduleCleanup(): Promise<CleanupResult> {
    // Verify user is Power Admin before proceeding
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
    
    if (!profile || (profile.role !== 'power_admin' && profile.role !== 'admin')) {
        throw new Error('Only Power Admins can manually trigger cleanup');
    }
    
    return cleanupSoftDeletedSchedules();
}

/**
 * Manually trigger notification cleanup (for Power Admins only)
 * This is a wrapper around cleanupExpiredNotifications with additional permission check
 * @returns Cleanup result with count and details
 */
export async function manualNotificationCleanup(): Promise<CleanupResult> {
    // Verify user is Power Admin before proceeding
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
    
    if (!profile || (profile.role !== 'power_admin' && profile.role !== 'admin')) {
        throw new Error('Only Power Admins can manually trigger cleanup');
    }
    
    return cleanupExpiredNotifications();
}
