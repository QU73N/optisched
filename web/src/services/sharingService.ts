import { supabase } from '../lib/supabase';
import type { SharingRequest, Profile, Teacher, Room, Subject, Section } from '../types/database';

export async function shareResource(
    resourceType: 'teacher' | 'room' | 'subject' | 'section',
    resourceId: string,
    toUserId: string,
    message?: string
): Promise<SharingRequest> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.rpc('share_resource', {
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_from_user_id: user.id,
        p_to_user_id: toUserId,
        p_message: message || null
    });

    if (error) throw error;

    // Fetch the created request with user details
    const { data: request } = await supabase
        .from('sharing_requests')
        .select('*, from_user:profiles(*), to_user:profiles(*)')
        .eq('id', data)
        .maybeSingle();

    if (!request) throw new Error('Failed to fetch created sharing request');
    return request as SharingRequest;
}

export async function respondToSharingRequest(
    requestId: string,
    status: 'approved' | 'rejected'
): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase.rpc('respond_sharing_request', {
        p_request_id: requestId,
        p_status: status,
        p_user_id: user.id
    });

    if (error) throw error;
    return true;
}

export async function grantResourceAccess(
    resourceType: 'teacher' | 'room' | 'subject' | 'section',
    resourceId: string,
    userId: string
): Promise<boolean> {
    const { error } = await supabase.rpc('grant_resource_access', {
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_user_id: userId
    });

    if (error) throw error;
    return true;
}

export async function revokeResourceAccess(
    resourceType: 'teacher' | 'room' | 'subject' | 'section',
    resourceId: string,
    userId: string
): Promise<boolean> {
    const { error } = await supabase.rpc('revoke_resource_access', {
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_user_id: userId
    });

    if (error) throw error;
    return true;
}

export async function getIncomingSharingRequests(): Promise<SharingRequest[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
        .from('sharing_requests')
        .select('*, from_user:profiles(*), to_user:profiles(*)')
        .eq('to_user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as SharingRequest[];
}

export async function getOutgoingSharingRequests(): Promise<SharingRequest[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
        .from('sharing_requests')
        .select('*, from_user:profiles(*), to_user:profiles(*)')
        .eq('from_user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as SharingRequest[];
}

export async function getMySharedResources(
    resourceType: 'teacher' | 'room' | 'subject' | 'section'
): Promise<Teacher[] | Room[] | Subject[] | Section[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const tableName = resourceType === 'teacher' ? 'teachers' : 
                     resourceType === 'room' ? 'rooms' :
                     resourceType === 'subject' ? 'subjects' : 'sections';

    const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .or(`owner_id.eq.${user.id},is_public.eq.true,shared_with.cs.{${user.id}}`)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function getResourcesSharedWithMe(
    resourceType: 'teacher' | 'room' | 'subject' | 'section'
): Promise<(Teacher | Room | Subject | Section)[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const tableName = resourceType === 'teacher' ? 'teachers' : 
                     resourceType === 'room' ? 'rooms' :
                     resourceType === 'subject' ? 'subjects' : 'sections';

    const { data, error } = await supabase
        .from(tableName)
        .select('*, owner:profiles(*)')
        .not('owner_id', 'is', null)
        .not('owner_id', 'eq', user.id)
        .not('is_public', 'eq', true)
        .contains('shared_with', [user.id])
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function setResourcePublic(
    resourceType: 'teacher' | 'room' | 'subject' | 'section',
    resourceId: string,
    isPublic: boolean
): Promise<void> {
    const tableName = resourceType === 'teacher' ? 'teachers' : 
                     resourceType === 'room' ? 'rooms' :
                     resourceType === 'subject' ? 'subjects' : 'sections';

    const { error } = await supabase
        .from(tableName)
        .update({ is_public: isPublic })
        .eq('id', resourceId);

    if (error) throw error;
}

export async function getUsers(): Promise<Profile[]> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

    if (error) throw error;
    return data || [];
}
