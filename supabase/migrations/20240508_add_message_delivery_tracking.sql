-- Migration: Message Delivery Confirmation
-- Purpose: Add read receipts and delivery status tracking for messaging system
-- PRD Requirement: §17 - notification delivery confirmation

-- Add delivery tracking to teacher_messages table
ALTER TABLE public.teacher_messages
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'failed')),
ADD COLUMN IF NOT EXISTS read_status TEXT DEFAULT 'unread' CHECK (read_status IN ('unread', 'read'));

-- Add delivery tracking to admin_messages table
ALTER TABLE public.admin_messages
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'failed')),
ADD COLUMN IF NOT EXISTS read_status TEXT DEFAULT 'unread' CHECK (read_status IN ('unread', 'read'));

-- Add delivery tracking to group_chat_messages table
ALTER TABLE public.group_chat_messages
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'failed'));

-- Create table for message read receipts (group chat)
CREATE TABLE IF NOT EXISTS public.message_read_receipts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id UUID NOT NULL,
    user_id UUID NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT message_read_receipts_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.group_chat_messages(id) ON DELETE CASCADE,
    CONSTRAINT message_read_receipts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    UNIQUE(message_id, user_id)
);

-- Create index on read receipts
CREATE INDEX IF NOT EXISTS idx_message_read_receipts_message_id ON public.message_read_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_message_read_receipts_user_id ON public.message_read_receipts(user_id);

-- Function to mark message as delivered
CREATE OR REPLACE FUNCTION mark_message_delivered(p_message_id UUID, p_message_type TEXT)
RETURNS VOID AS $$
BEGIN
    CASE p_message_type
        WHEN 'teacher_message' THEN
            UPDATE public.teacher_messages
            SET delivery_status = 'delivered', delivered_at = NOW()
            WHERE id = p_message_id;
        WHEN 'admin_message' THEN
            UPDATE public.admin_messages
            SET delivery_status = 'delivered', delivered_at = NOW()
            WHERE id = p_message_id;
        WHEN 'group_chat_message' THEN
            UPDATE public.group_chat_messages
            SET delivery_status = 'delivered', delivered_at = NOW()
            WHERE id = p_message_id;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark message as read
CREATE OR REPLACE FUNCTION mark_message_read(p_message_id UUID, p_user_id UUID, p_message_type TEXT)
RETURNS VOID AS $$
BEGIN
    CASE p_message_type
        WHEN 'teacher_message' THEN
            UPDATE public.teacher_messages
            SET read_status = 'read', read_at = NOW()
            WHERE id = p_message_id AND receiver_id = p_user_id;
        WHEN 'admin_message' THEN
            UPDATE public.admin_messages
            SET read_status = 'read', read_at = NOW()
            WHERE id = p_message_id AND receiver_id = p_user_id;
        WHEN 'group_chat_message' THEN
            -- Update read status
            UPDATE public.group_chat_messages
            SET read_at = NOW()
            WHERE id = p_message_id AND sender_id = p_user_id;
            
            -- Add read receipt
            INSERT INTO public.message_read_receipts (message_id, user_id)
            VALUES (p_message_id, p_user_id)
            ON CONFLICT (message_id, user_id) DO NOTHING;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get message delivery status
CREATE OR REPLACE FUNCTION get_message_delivery_status(p_message_id UUID, p_message_type TEXT)
RETURNS TABLE(
    delivery_status TEXT,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_status TEXT,
    read_at TIMESTAMP WITH TIME ZONE,
    read_receipts_count BIGINT
) AS $$
BEGIN
    CASE p_message_type
        WHEN 'teacher_message' THEN
            RETURN QUERY
            SELECT 
                tm.delivery_status,
                tm.delivered_at,
                tm.read_status,
                tm.read_at,
                0::BIGINT as read_receipts_count
            FROM public.teacher_messages tm
            WHERE tm.id = p_message_id;
        WHEN 'admin_message' THEN
            RETURN QUERY
            SELECT 
                am.delivery_status,
                am.delivered_at,
                am.read_status,
                am.read_at,
                0::BIGINT as read_receipts_count
            FROM public.admin_messages am
            WHERE am.id = p_message_id;
        WHEN 'group_chat_message' THEN
            RETURN QUERY
            SELECT 
                gcm.delivery_status,
                gcm.delivered_at,
                CASE WHEN gcm.read_at IS NOT NULL THEN 'read' ELSE 'unread' END as read_status,
                gcm.read_at,
                COUNT(mrr.id) as read_receipts_count
            FROM public.group_chat_messages gcm
            LEFT JOIN public.message_read_receipts mrr ON mrr.message_id = gcm.id
            WHERE gcm.id = p_message_id
            GROUP BY gcm.id, gcm.delivery_status, gcm.delivered_at, gcm.read_at;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread message count for a user
CREATE OR REPLACE FUNCTION get_unread_message_count(p_user_id UUID)
RETURNS TABLE(
    teacher_messages_unread BIGINT,
    admin_messages_unread BIGINT,
    group_chat_messages_unread BIGINT,
    total_unread BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM public.teacher_messages WHERE receiver_id = p_user_id AND read_status = 'unread') as teacher_messages_unread,
        (SELECT COUNT(*) FROM public.admin_messages WHERE receiver_id = p_user_id AND read_status = 'unread') as admin_messages_unread,
        (
            SELECT COUNT(DISTINCT gcm.id)
            FROM public.group_chat_messages gcm
            INNER JOIN public.group_chat_members gcmem ON gcmem.group_chat_id = gcm.group_chat_id
            WHERE gcmem.member_id = p_user_id
            AND gcm.sender_id != p_user_id
            AND NOT EXISTS (
                SELECT 1 FROM public.message_read_receipts mrr
                WHERE mrr.message_id = gcm.id AND mrr.user_id = p_user_id
            )
        ) as group_chat_messages_unread,
        (
            (SELECT COUNT(*) FROM public.teacher_messages WHERE receiver_id = p_user_id AND read_status = 'unread')
            + (SELECT COUNT(*) FROM public.admin_messages WHERE receiver_id = p_user_id AND read_status = 'unread')
            + (
                SELECT COUNT(DISTINCT gcm.id)
                FROM public.group_chat_messages gcm
                INNER JOIN public.group_chat_members gcmem ON gcmem.group_chat_id = gcm.group_chat_id
                WHERE gcmem.member_id = p_user_id
                AND gcm.sender_id != p_user_id
                AND NOT EXISTS (
                    SELECT 1 FROM public.message_read_receipts mrr
                    WHERE mrr.message_id = gcm.id AND mrr.user_id = p_user_id
                )
            )
        ) as total_unread;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION mark_message_delivered(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_message_read(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_message_delivery_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_message_count(UUID) TO authenticated;

-- Grant permissions on read receipts table
GRANT SELECT, INSERT ON public.message_read_receipts TO authenticated;

-- Enable RLS on read receipts
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;

-- RLS policies for read receipts
CREATE POLICY "Users can view own read receipts"
ON public.message_read_receipts FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own read receipts"
ON public.message_read_receipts FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Add comments
COMMENT ON TABLE public.message_read_receipts IS 'Tracks read receipts for group chat messages';
COMMENT ON FUNCTION mark_message_delivered(UUID, TEXT) IS 'Marks a message as delivered with timestamp';
COMMENT ON FUNCTION mark_message_read(UUID, UUID, TEXT) IS 'Marks a message as read by a user';
COMMENT ON FUNCTION get_message_delivery_status(UUID, TEXT) IS 'Returns delivery and read status for a message';
COMMENT ON FUNCTION get_unread_message_count(UUID) IS 'Returns unread message count for a user across all message types';

-- Verification
DO $$
BEGIN
    RAISE NOTICE 'Message delivery tracking migration completed successfully';
    RAISE NOTICE 'Added delivery tracking to teacher_messages, admin_messages, group_chat_messages';
    RAISE NOTICE 'Created message_read_receipts table for group chat read receipts';
    RAISE NOTICE 'Created functions: mark_message_delivered, mark_message_read, get_message_delivery_status, get_unread_message_count';
END $$;
