import { supabase } from '../lib/supabase';

export interface ModerationLog {
    id: string;
    action: 'delete_message' | 'flag_message' | 'mute_user' | 'unmute_user' | 'remove_user' | 'ban_user';
    resource_type: 'message' | 'user' | 'group_chat';
    resource_id: string;
    performed_by: string;
    performed_by_name: string;
    target_user_id: string | null;
    target_user_name: string | null;
    reason: string | null;
    created_at: string;
}

/**
 * Delete a group chat message (soft delete)
 * @param messageId - The ID of the message to delete
 * @param performedBy - The ID of the user performing the deletion
 * @param reason - The reason for deletion
 */
export async function deleteGroupChatMessage(messageId: string, performedBy: string, reason?: string): Promise<void> {
    const { error } = await supabase.rpc('delete_group_chat_message', {
        p_message_id: messageId,
        p_performed_by: performedBy,
        p_reason: reason
    });
    
    if (error) throw error;
}

/**
 * Flag a group chat message for review
 * @param messageId - The ID of the message to flag
 * @param flaggedBy - The ID of the user flagging the message
 * @param reason - The reason for flagging
 */
export async function flagGroupChatMessage(messageId: string, flaggedBy: string, reason?: string): Promise<void> {
    const { error } = await supabase.rpc('flag_group_chat_message', {
        p_message_id: messageId,
        p_flagged_by: flaggedBy,
        p_reason: reason
    });
    
    if (error) throw error;
}

/**
 * Mute a user in a group chat
 * @param groupChatId - The ID of the group chat
 * @param userId - The ID of the user to mute
 * @param performedBy - The ID of the user performing the mute
 * @param durationHours - Duration of mute in hours
 * @param reason - The reason for muting
 */
export async function muteGroupChatUser(
    groupChatId: string,
    userId: string,
    performedBy: string,
    durationHours: number,
    reason?: string
): Promise<void> {
    const { error } = await supabase.rpc('mute_group_chat_user', {
        p_group_chat_id: groupChatId,
        p_user_id: userId,
        p_performed_by: performedBy,
        p_duration_hours: durationHours,
        p_reason: reason
    });
    
    if (error) throw error;
}

/**
 * Unmute a user in a group chat
 * @param groupChatId - The ID of the group chat
 * @param userId - The ID of the user to unmute
 * @param performedBy - The ID of the user performing the unmute
 */
export async function unmuteGroupChatUser(groupChatId: string, userId: string, performedBy: string): Promise<void> {
    const { error } = await supabase.rpc('unmute_group_chat_user', {
        p_group_chat_id: groupChatId,
        p_user_id: userId,
        p_performed_by: performedBy
    });
    
    if (error) throw error;
}

/**
 * Remove a user from a group chat
 * @param groupChatId - The ID of the group chat
 * @param userId - The ID of the user to remove
 * @param performedBy - The ID of the user performing the removal
 * @param reason - The reason for removal
 */
export async function removeGroupChatUser(
    groupChatId: string,
    userId: string,
    performedBy: string,
    reason?: string
): Promise<void> {
    const { error } = await supabase.rpc('remove_group_chat_user', {
        p_group_chat_id: groupChatId,
        p_user_id: userId,
        p_performed_by: performedBy,
        p_reason: reason
    });
    
    if (error) throw error;
}

/**
 * Check if a user is muted in a group chat
 * @param groupChatId - The ID of the group chat
 * @param userId - The ID of the user to check
 * @returns True if the user is muted, false otherwise
 */
export async function isUserMuted(groupChatId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('is_user_muted', {
        p_group_chat_id: groupChatId,
        p_user_id: userId
    });
    
    if (error) throw error;
    
    return data as boolean;
}

/**
 * Get moderation logs for a group chat
 * @param groupChatId - The ID of the group chat
 * @param limit - Maximum number of logs to return
 * @returns Array of moderation logs
 */
export async function getGroupChatModerationLogs(groupChatId: string, limit: number = 50): Promise<ModerationLog[]> {
    const { data, error } = await supabase.rpc('get_group_chat_moderation_logs', {
        p_group_chat_id: groupChatId,
        p_limit: limit
    });
    
    if (error) throw error;
    
    return data as ModerationLog[];
}

/**
 * Get flagged messages in a group chat
 * @param groupChatId - The ID of the group chat
 * @returns Array of flagged messages
 */
export async function getFlaggedMessages(groupChatId: string): Promise<unknown[]> {
    const { data, error } = await supabase
        .from('group_chat_messages')
        .select(`
            *,
            sender:sender_id(full_name, email),
            flagger:flagged_by(full_name, email)
        `)
        .eq('group_chat_id', groupChatId)
        .eq('is_flagged', true)
        .order('flagged_at', { ascending: false });
    
    if (error) throw error;
    
    return data || [];
}

/**
 * Get muted users in a group chat
 * @param groupChatId - The ID of the group chat
 * @returns Array of muted users
 */
export async function getMutedUsers(groupChatId: string): Promise<unknown[]> {
    const { data, error } = await supabase
        .from('group_chat_members')
        .select(`
            *,
            member:member_id(full_name, email),
            muter:muted_by(full_name, email)
        `)
        .eq('group_chat_id', groupChatId)
        .eq('is_muted', true)
        .order('muted_at', { ascending: false });
    
    if (error) throw error;
    
    return data || [];
}

/**
 * Unflag a message (remove flag)
 * @param messageId - The ID of the message to unflag
 */
export async function unflagMessage(messageId: string): Promise<void> {
    const { error } = await supabase
        .from('group_chat_messages')
        .update({
            is_flagged: false,
            flagged_by: null,
            flagged_at: null,
            flag_reason: null
        })
        .eq('id', messageId);
    
    if (error) throw error;
}

/**
 * Restore a deleted message
 * @param messageId - The ID of the message to restore
 */
export async function restoreMessage(messageId: string): Promise<void> {
    const { error } = await supabase
        .from('group_chat_messages')
        .update({
            is_deleted: false,
            deleted_by: null,
            deleted_at: null
        })
        .eq('id', messageId);
    
    if (error) throw error;
}
