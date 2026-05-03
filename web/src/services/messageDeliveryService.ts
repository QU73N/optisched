import { supabase } from '../lib/supabase';

export type MessageType = 'teacher_message' | 'admin_message' | 'group_chat_message';

export interface DeliveryStatus {
    delivery_status: 'pending' | 'delivered' | 'failed';
    delivered_at: string | null;
    read_status: 'unread' | 'read' | null;
    read_at: string | null;
    read_receipts_count: number;
}

export interface UnreadMessageCount {
    teacher_messages_unread: number;
    admin_messages_unread: number;
    group_chat_messages_unread: number;
    total_unread: number;
}

/**
 * Mark a message as delivered
 * @param messageId - The ID of the message
 * @param messageType - The type of message (teacher_message, admin_message, group_chat_message)
 */
export async function markMessageDelivered(messageId: string, messageType: MessageType): Promise<void> {
    const { error } = await supabase.rpc('mark_message_delivered', {
        p_message_id: messageId,
        p_message_type: messageType
    });
    
    if (error) throw error;
}

/**
 * Mark a message as read by a user
 * @param messageId - The ID of the message
 * @param userId - The ID of the user who read the message
 * @param messageType - The type of message (teacher_message, admin_message, group_chat_message)
 */
export async function markMessageRead(messageId: string, userId: string, messageType: MessageType): Promise<void> {
    const { error } = await supabase.rpc('mark_message_read', {
        p_message_id: messageId,
        p_user_id: userId,
        p_message_type: messageType
    });
    
    if (error) throw error;
}

/**
 * Get delivery and read status for a message
 * @param messageId - The ID of the message
 * @param messageType - The type of message (teacher_message, admin_message, group_chat_message)
 * @returns Delivery status information
 */
export async function getMessageDeliveryStatus(messageId: string, messageType: MessageType): Promise<DeliveryStatus> {
    const { data, error } = await supabase.rpc('get_message_delivery_status', {
        p_message_id: messageId,
        p_message_type: messageType
    });
    
    if (error) throw error;
    
    return data as DeliveryStatus;
}

/**
 * Get unread message count for a user
 * @param userId - The ID of the user
 * @returns Unread message count across all message types
 */
export async function getUnreadMessageCount(userId: string): Promise<UnreadMessageCount> {
    const { data, error } = await supabase.rpc('get_unread_message_count', {
        p_user_id: userId
    });
    
    if (error) throw error;
    
    return data as UnreadMessageCount;
}

/**
 * Mark all messages in a conversation as read
 * @param userId - The ID of the user
 * @param otherUserId - The ID of the other user in the conversation
 */
export async function markConversationAsRead(userId: string, otherUserId: string): Promise<void> {
    // Mark all teacher messages as read
    const { error: teacherError } = await supabase
        .from('teacher_messages')
        .update({ read_status: 'read', read_at: new Date().toISOString() })
        .eq('receiver_id', userId)
        .eq('sender_id', otherUserId);
    
    if (teacherError) throw teacherError;
    
    // Mark all admin messages as read
    const { error: adminError } = await supabase
        .from('admin_messages')
        .update({ read_status: 'read', read_at: new Date().toISOString() })
        .eq('receiver_id', userId)
        .eq('sender_id', otherUserId);
    
    if (adminError) throw adminError;
}

/**
 * Mark all messages in a group chat as read for a user
 * @param userId - The ID of the user
 * @param groupChatId - The ID of the group chat
 */
export async function markGroupChatAsRead(userId: string, groupChatId: string): Promise<void> {
    // Get all unread messages in the group chat
    const { data: messages, error: fetchError } = await supabase
        .from('group_chat_messages')
        .select('id')
        .eq('group_chat_id', groupChatId)
        .neq('sender_id', userId);
    
    if (fetchError) throw fetchError;
    
    // Add read receipts for all messages
    if (messages && messages.length > 0) {
        for (const msg of messages) {
            const { error: insertError } = await supabase
                .from('message_read_receipts')
                .insert({ message_id: msg.id, user_id: userId });
            
            // Ignore duplicate errors
            if (insertError && insertError.code !== '23505') {
                throw insertError;
            }
        }
    }
}

/**
 * Get read receipts for a group chat message
 * @param messageId - The ID of the message
 * @returns Array of user IDs who have read the message
 */
export async function getMessageReadReceipts(messageId: string): Promise<string[]> {
    const { data, error } = await supabase
        .from('message_read_receipts')
        .select('user_id')
        .eq('message_id', messageId);
    
    if (error) throw error;
    
    return data?.map(r => r.user_id) || [];
}
