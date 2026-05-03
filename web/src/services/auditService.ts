import { supabase } from '../lib/supabase';

/**
 * Audit Service - Centralized logging for all administrative actions
 * 
 * This service provides a consistent interface for logging actions to the audit_logs table.
 * All administrative actions (create, update, delete, approve, submit, etc.) should be logged here.
 */

export interface AuditLogDetails {
    [key: string]: unknown;
}

/**
 * Log an audit event
 * @param action - The action performed (e.g., 'create', 'update', 'delete', 'approve', 'submit')
 * @param targetTable - The table affected (e.g., 'schedules', 'profiles', 'subjects')
 * @param targetId - The ID of the affected row (optional for bulk actions)
 * @param details - Additional context about the action
 * @returns The audit log entry ID
 */
export async function logAudit(
    action: string,
    targetTable: string,
    targetId: string | null,
    details: AuditLogDetails = {}
): Promise<string> {
    try {
        const { data, error } = await supabase.rpc('log_audit', {
            p_action: action,
            p_target_table: targetTable,
            p_target_id: targetId,
            p_details: details,
        });

        if (error) throw error;
        return data || '';
    } catch (error) {
        console.error('[AuditService] Failed to log audit event:', error);
        // Don't throw - audit logging failures shouldn't break the main flow
        return '';
    }
}

/**
 * Schedule-specific audit helpers
 */
export const scheduleAudit = {
    /**
     * Log schedule creation
     */
    created: (scheduleId: string, details: { subject?: string; section?: string; teacher?: string }) =>
        logAudit('create', 'schedules', scheduleId, details),

    /**
     * Log schedule update
     */
    updated: (scheduleId: string, details: { changes: Record<string, unknown> }) =>
        logAudit('update', 'schedules', scheduleId, details),

    /**
     * Log schedule deletion
     */
    deleted: (scheduleId: string, details: { reason?: string }) =>
        logAudit('delete', 'schedules', scheduleId, details),

    /**
     * Log bulk schedule deletion
     */
    bulkDeleted: (count: number, details: { reason?: string; semester?: string; academic_year?: string; [key: string]: unknown }) =>
        logAudit('bulk_delete', 'schedules', null, { count, ...details }),

    /**
     * Log schedule submission for approval
     */
    submitted: (scheduleId: string, details: { submitted_by?: string }) =>
        logAudit('submit', 'schedules', scheduleId, details),

    /**
     * Log schedule approval
     */
    approved: (scheduleId: string, details: { approved_by?: string }) =>
        logAudit('approve', 'schedules', scheduleId, details),

    /**
     * Log schedule rejection
     */
    rejected: (scheduleId: string, details: { rejected_by?: string; reason?: string }) =>
        logAudit('reject', 'schedules', scheduleId, details),

    /**
     * Log schedule publication
     */
    published: (scheduleId: string, details: { published_by?: string; version?: number }) =>
        logAudit('publish', 'schedules', scheduleId, details),

    /**
     * Log schedule unpublish
     */
    unpublished: (scheduleId: string, details: { unpublished_by?: string }) =>
        logAudit('unpublish', 'schedules', scheduleId, details),

    /**
     * Log schedule lock
     */
    locked: (scheduleId: string, details: { locked_by?: string; reason?: string }) =>
        logAudit('lock', 'schedules', scheduleId, details),

    /**
     * Log schedule unlock
     */
    unlocked: (scheduleId: string, details: { unlocked_by?: string }) =>
        logAudit('unlock', 'schedules', scheduleId, details),
};

/**
 * Profile/User audit helpers
 */
export const profileAudit = {
    /**
     * Log user role change
     */
    roleChanged: (profileId: string, details: { old_role: string; new_role: string; changed_by: string }) =>
        logAudit('role_change', 'profiles', profileId, details),

    /**
     * Log user creation
     */
    created: (profileId: string, details: { role: string; email?: string }) =>
        logAudit('create', 'profiles', profileId, details),

    /**
     * Log user deletion
     */
    deleted: (profileId: string, details: { role: string; deleted_by: string }) =>
        logAudit('delete', 'profiles', profileId, details),
};

/**
 * Data entity audit helpers (subjects, rooms, sections, teachers)
 */
export const dataAudit = {
    /**
     * Log entity creation
     */
    created: (table: 'subjects' | 'rooms' | 'sections' | 'teachers', entityId: string, details: { name: string }) =>
        logAudit('create', table, entityId, details),

    /**
     * Log entity update
     */
    updated: (table: 'subjects' | 'rooms' | 'sections' | 'teachers', entityId: string, details: { changes: Record<string, unknown> }) =>
        logAudit('update', table, entityId, details),

    /**
     * Log entity deletion
     */
    deleted: (table: 'subjects' | 'rooms' | 'sections' | 'teachers', entityId: string, details: { name: string }) =>
        logAudit('delete', table, entityId, details),
};
