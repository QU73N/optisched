-- Fix Notifications System
-- This script ensures the notifications table and RPC functions are properly set up

-- Step 1: Create the notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (
        type IN ('schedule_change', 'sharing_request', 'approval', 'system', 'reminder', 'conflict_alert', 'announcement')
    ),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Step 3: Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can update notifications" ON public.notifications;

-- Step 5: Create RLS policies
CREATE POLICY "Users can read own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
    ON public.notifications FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update notifications"
    ON public.notifications FOR UPDATE
    USING (auth.role() = 'service_role');

-- Step 6: Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;

-- Step 7: Create or replace RPC functions with proper security
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id uuid,
    p_type text,
    p_title text,
    p_message text,
    p_data jsonb DEFAULT '{}'::jsonb,
    p_action_url text DEFAULT NULL,
    p_expires_hours integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_notification_id uuid;
    v_expires_at timestamp with time zone;
BEGIN
    -- Calculate expiration if provided
    IF p_expires_hours IS NOT NULL THEN
        v_expires_at := NOW() + (p_expires_hours || ' hours')::interval;
    END IF;
    
    -- Insert notification
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        data,
        action_url,
        expires_at
    ) VALUES (
        p_user_id,
        p_type,
        p_title,
        p_message,
        p_data,
        p_action_url,
        v_expires_at
    ) RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$;

CREATE OR REPLACE FUNCTION mark_notification_read(
    p_notification_id uuid,
    p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.notifications
    SET is_read = true
    WHERE id = p_notification_id
    AND user_id = p_user_id;
    
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION mark_all_notifications_read(
    p_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE public.notifications
    SET is_read = true
    WHERE user_id = p_user_id
    AND is_read = false;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION get_unread_notification_count(
    p_user_id uuid
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COUNT(*)
    FROM public.notifications
    WHERE user_id = p_user_id
    AND is_read = false
    AND (expires_at IS NULL OR expires_at > NOW());
$$;

-- Step 8: Grant execute permissions on RPC functions
GRANT EXECUTE ON FUNCTION create_notification(uuid, text, text, text, jsonb, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification(uuid, text, text, text, jsonb, text, integer) TO service_role;

GRANT EXECUTE ON FUNCTION mark_notification_read(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read(uuid, uuid) TO service_role;

GRANT EXECUTE ON FUNCTION mark_all_notifications_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read(uuid) TO service_role;

GRANT EXECUTE ON FUNCTION get_unread_notification_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count(uuid) TO service_role;

-- Step 9: Verification
SELECT 
    'Notifications system fix completed' as status,
    (SELECT COUNT(*) FROM public.notifications) as notification_count,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') as table_exists,
    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'create_notification') as create_notification_func_exists,
    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'mark_notification_read') as mark_notification_read_func_exists,
    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'mark_all_notifications_read') as mark_all_notifications_read_func_exists,
    (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'get_unread_notification_count') as get_unread_notification_count_func_exists;
