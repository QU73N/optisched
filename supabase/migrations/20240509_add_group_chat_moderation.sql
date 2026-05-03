-- Migration: Group Chat Moderation Tools
-- Purpose: Add moderation features for group chats (message deletion, user muting, moderation logs)
-- Best practice: Group chats need moderation tools to prevent inappropriate content

-- Add moderation fields to group_chat_messages table
ALTER TABLE public.group_chat_messages
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS flagged_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS flag_reason TEXT;

-- Add moderation fields to group_chat_members table
ALTER TABLE public.group_chat_members
ADD COLUMN IF NOT EXISTS is_muted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS muted_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS muted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS muted_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS mute_reason TEXT;

-- Create table for moderation logs
CREATE TABLE IF NOT EXISTS public.moderation_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    action TEXT NOT NULL CHECK (action IN ('delete_message', 'flag_message', 'mute_user', 'unmute_user', 'remove_user', 'ban_user')),
    resource_type TEXT NOT NULL CHECK (resource_type IN ('message', 'user', 'group_chat')),
    resource_id UUID NOT NULL,
    group_chat_id UUID REFERENCES public.group_chats(id) ON DELETE CASCADE,
    performed_by UUID NOT NULL REFERENCES public.profiles(id),
    target_user_id UUID REFERENCES public.profiles(id),
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_moderation_logs_group_chat_id ON public.moderation_logs(group_chat_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_performed_by ON public.moderation_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_target_user_id ON public.moderation_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_created_at ON public.moderation_logs(created_at DESC);

-- Function to delete a group chat message (soft delete)
CREATE OR REPLACE FUNCTION delete_group_chat_message(p_message_id UUID, p_performed_by UUID, p_reason TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE public.group_chat_messages
    SET 
        is_deleted = true,
        deleted_by = p_performed_by,
        deleted_at = NOW()
    WHERE id = p_message_id;
    
    -- Log the moderation action
    INSERT INTO public.moderation_logs (
        action,
        resource_type,
        resource_id,
        group_chat_id,
        performed_by,
        reason
    )
    SELECT 
        'delete_message',
        'message',
        p_message_id,
        group_chat_id,
        p_performed_by,
        p_reason
    FROM public.group_chat_messages
    WHERE id = p_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to flag a group chat message
CREATE OR REPLACE FUNCTION flag_group_chat_message(p_message_id UUID, p_flagged_by UUID, p_reason TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE public.group_chat_messages
    SET 
        is_flagged = true,
        flagged_by = p_flagged_by,
        flagged_at = NOW(),
        flag_reason = p_reason
    WHERE id = p_message_id;
    
    -- Log the moderation action
    INSERT INTO public.moderation_logs (
        action,
        resource_type,
        resource_id,
        group_chat_id,
        performed_by,
        target_user_id,
        reason
    )
    SELECT 
        'flag_message',
        'message',
        p_message_id,
        group_chat_id,
        p_flagged_by,
        sender_id,
        p_reason
    FROM public.group_chat_messages
    WHERE id = p_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mute a user in a group chat
CREATE OR REPLACE FUNCTION mute_group_chat_user(p_group_chat_id UUID, p_user_id UUID, p_performed_by UUID, p_duration_hours INTEGER, p_reason TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE public.group_chat_members
    SET 
        is_muted = true,
        muted_by = p_performed_by,
        muted_at = NOW(),
        muted_until = NOW() + (p_duration_hours || ' hours')::INTERVAL,
        mute_reason = p_reason
    WHERE group_chat_id = p_group_chat_id AND member_id = p_user_id;
    
    -- Log the moderation action
    INSERT INTO public.moderation_logs (
        action,
        resource_type,
        resource_id,
        group_chat_id,
        performed_by,
        target_user_id,
        reason,
        metadata
    )
    VALUES (
        'mute_user',
        'user',
        p_user_id,
        p_group_chat_id,
        p_performed_by,
        p_user_id,
        p_reason,
        jsonb_build_object('duration_hours', p_duration_hours)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to unmute a user in a group chat
CREATE OR REPLACE FUNCTION unmute_group_chat_user(p_group_chat_id UUID, p_user_id UUID, p_performed_by UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.group_chat_members
    SET 
        is_muted = false,
        muted_by = NULL,
        muted_at = NULL,
        muted_until = NULL,
        mute_reason = NULL
    WHERE group_chat_id = p_group_chat_id AND member_id = p_user_id;
    
    -- Log the moderation action
    INSERT INTO public.moderation_logs (
        action,
        resource_type,
        resource_id,
        group_chat_id,
        performed_by,
        target_user_id
    )
    VALUES (
        'unmute_user',
        'user',
        p_user_id,
        p_group_chat_id,
        p_performed_by,
        p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove a user from a group chat
CREATE OR REPLACE FUNCTION remove_group_chat_user(p_group_chat_id UUID, p_user_id UUID, p_performed_by UUID, p_reason TEXT)
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.group_chat_members
    WHERE group_chat_id = p_group_chat_id AND member_id = p_user_id;
    
    -- Log the moderation action
    INSERT INTO public.moderation_logs (
        action,
        resource_type,
        resource_id,
        group_chat_id,
        performed_by,
        target_user_id,
        reason
    )
    VALUES (
        'remove_user',
        'user',
        p_user_id,
        p_group_chat_id,
        p_performed_by,
        p_user_id,
        p_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if a user is muted in a group chat
CREATE OR REPLACE FUNCTION is_user_muted(p_group_chat_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_muted BOOLEAN;
    v_muted_until TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT 
        gcm.is_muted,
        gcm.muted_until
    INTO v_is_muted, v_muted_until
    FROM public.group_chat_members gcm
    WHERE gcm.group_chat_id = p_group_chat_id AND gcm.member_id = p_user_id;
    
    -- Return true if muted and mute hasn't expired
    RETURN v_is_muted AND (v_muted_until IS NULL OR v_muted_until > NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get moderation logs for a group chat
CREATE OR REPLACE FUNCTION get_group_chat_moderation_logs(p_group_chat_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
    id UUID,
    action TEXT,
    resource_type TEXT,
    resource_id UUID,
    performed_by UUID,
    performed_by_name TEXT,
    target_user_id UUID,
    target_user_name TEXT,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ml.id,
        ml.action,
        ml.resource_type,
        ml.resource_id,
        ml.performed_by,
        p1.full_name as performed_by_name,
        ml.target_user_id,
        p2.full_name as target_user_name,
        ml.reason,
        ml.created_at
    FROM public.moderation_logs ml
    LEFT JOIN public.profiles p1 ON p1.id = ml.performed_by
    LEFT JOIN public.profiles p2 ON p2.id = ml.target_user_id
    WHERE ml.group_chat_id = p_group_chat_id
    ORDER BY ml.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION delete_group_chat_message(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION flag_group_chat_message(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION mute_group_chat_user(UUID, UUID, UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION unmute_group_chat_user(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_group_chat_user(UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_user_muted(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_group_chat_moderation_logs(UUID, INTEGER) TO authenticated;

-- Grant permissions on moderation_logs
GRANT SELECT, INSERT ON public.moderation_logs TO authenticated;

-- Enable RLS on moderation_logs
ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for moderation_logs
CREATE POLICY "Group chat members can view moderation logs"
ON public.moderation_logs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.group_chat_members
        WHERE group_chat_members.group_chat_id = moderation_logs.group_chat_id
        AND group_chat_members.member_id = auth.uid()
    )
);

CREATE POLICY "Admins can view all moderation logs"
ON public.moderation_logs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('power_admin', 'system_admin', 'schedule_admin', 'admin')
    )
);

CREATE POLICY "Admins can insert moderation logs"
ON public.moderation_logs FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('power_admin', 'system_admin', 'schedule_admin', 'admin')
    )
);

-- Add comments
COMMENT ON TABLE public.moderation_logs IS 'Logs all moderation actions in group chats (deletions, flags, mutes, removals)';
COMMENT ON FUNCTION delete_group_chat_message(UUID, UUID, TEXT) IS 'Soft deletes a group chat message and logs the action';
COMMENT ON FUNCTION flag_group_chat_message(UUID, UUID, TEXT) IS 'Flags a group chat message for review and logs the action';
COMMENT ON FUNCTION mute_group_chat_user(UUID, UUID, UUID, INTEGER, TEXT) IS 'Mutes a user in a group chat for specified duration';
COMMENT ON FUNCTION unmute_group_chat_user(UUID, UUID, UUID) IS 'Removes mute from a user in a group chat';
COMMENT ON FUNCTION remove_group_chat_user(UUID, UUID, UUID, TEXT) IS 'Removes a user from a group chat and logs the action';
COMMENT ON FUNCTION is_user_muted(UUID, UUID) IS 'Checks if a user is currently muted in a group chat';
COMMENT ON FUNCTION get_group_chat_moderation_logs(UUID, INTEGER) IS 'Returns moderation logs for a group chat';

-- Verification
DO $$
BEGIN
    RAISE NOTICE 'Group chat moderation migration completed successfully';
    RAISE NOTICE 'Added moderation fields to group_chat_messages and group_chat_members';
    RAISE NOTICE 'Created moderation_logs table for tracking all moderation actions';
    RAISE NOTICE 'Created functions: delete_group_chat_message, flag_group_chat_message, mute_group_chat_user, unmute_group_chat_user, remove_group_chat_user, is_user_muted, get_group_chat_moderation_logs';
END $$;
