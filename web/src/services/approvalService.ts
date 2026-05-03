import { supabase } from '../lib/supabase';
import type { ApprovalRequest, ApprovalAuditLog } from '../types/database';
import { notifyStudentsOfScheduleChanges } from './generationService';

export async function createApprovalRequest(
    requestType: 'schedule_change' | 'new_schedule' | 'delete_schedule' | 'bulk_change',
    resourceType: 'schedule' | 'section' | 'teacher' | 'room' | 'subject',
    resourceId: string | null,
    title: string,
    description?: string,
    changeData: Record<string, unknown> = {},
    academicYear?: string,
    semester?: string
): Promise<string> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.rpc('create_approval_request', {
        p_request_type: requestType,
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_requested_by: user.id,
        p_title: title,
        p_description: description || null,
        p_change_data: changeData,
        p_academic_year: academicYear || null,
        p_semester: semester || null
    });
    if (error) throw error;
    return data;
}

export async function getApprovalRequests(
    status?: 'pending' | 'approved' | 'rejected' | 'cancelled',
    limit = 50
): Promise<ApprovalRequest[]> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error('User not authenticated');

    let query = supabase
        .from('approval_requests')
        .select(`
            *,
            requested_by_user:profiles!requested_by(id, full_name, email, role),
            approved_by_user:profiles!approved_by(id, full_name, email, role)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as ApprovalRequest[];
}

export async function getMyApprovalRequests(limit = 50): Promise<ApprovalRequest[]> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
        .from('approval_requests')
        .select(`
            *,
            requested_by_user:profiles!requested_by(id, full_name, email, role),
            approved_by_user:profiles!approved_by(id, full_name, email, role)
        `)
        .eq('requested_by', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return (data || []) as ApprovalRequest[];
}

export async function approveRequest(requestId: string, notes?: string): Promise<boolean> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error('User not authenticated');

    // Get the approval request details to extract section IDs
    const { data: request, error: fetchError } = await supabase
        .from('approval_requests')
        .select('resource_type, resource_id, change_data')
        .eq('id', requestId)
        .maybeSingle();

    if (fetchError) throw fetchError;
    if (!request) throw new Error('Approval request not found');

    const { data, error } = await supabase.rpc('approve_request', {
        p_request_id: requestId,
        p_approved_by: user.id,
        p_notes: notes || null
    });
    if (error) throw error;

    // Notify students if this is a schedule-related approval
    if (request && request.resource_type === 'schedule') {
        try {
            // Extract section IDs from change_data or get them from the schedules table
            let sectionIds: string[] = [];

            if (request.change_data && typeof request.change_data === 'object') {
                const changeData = request.change_data as Record<string, unknown>;
                if (Array.isArray(changeData.section_ids)) {
                    sectionIds = changeData.section_ids as string[];
                }
            }

            // If no section IDs in change_data, try to get them from the resource
            if (sectionIds.length === 0 && request.resource_id) {
                const { data: schedules } = await supabase
                    .from('schedules')
                    .select('section_id')
                    .eq('id', request.resource_id);
                
                if (schedules && schedules.length > 0) {
                    sectionIds = schedules.map(s => s.section_id).filter(Boolean);
                }
            }

            // Notify students of the approval
            if (sectionIds.length > 0) {
                await notifyStudentsOfScheduleChanges(sectionIds, 'approved', true);
            }
        } catch (notifyError) {
            console.error('Failed to notify students of schedule approval:', notifyError);
            // Don't fail the approval if notification fails
        }
    }

    return data || false;
}

export async function rejectRequest(requestId: string, reason?: string): Promise<boolean> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.rpc('reject_request', {
        p_request_id: requestId,
        p_rejected_by: user.id,
        p_reason: reason || null
    });
    if (error) throw error;
    return data || false;
}

export async function cancelRequest(requestId: string): Promise<boolean> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.rpc('cancel_request', {
        p_request_id: requestId,
        p_cancelled_by: user.id
    });
    if (error) throw error;
    return data || false;
}

export async function getApprovalAuditLog(requestId: string): Promise<ApprovalAuditLog[]> {
    const { data, error } = await supabase
        .from('approval_audit_log')
        .select(`
            *,
            performed_by_user:profiles(id, full_name, email, role)
        `)
        .eq('approval_request_id', requestId)
        .order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as ApprovalAuditLog[];
}

export async function getPendingApprovalCount(): Promise<number> {
    const { data, error } = await supabase
        .from('approval_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
    if (error) throw error;
    return data?.length || 0;
}
