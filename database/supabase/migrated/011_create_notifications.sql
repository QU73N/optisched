-- ============================================================================
-- Migration 011: Notification System
-- Enables in-app notifications for schedule changes, sharing requests, etc.
-- Supports real-time delivery via Supabase realtime
-- ============================================================================

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('schedule_change', 'sharing_request', 'approval', 'system', 'reminder')),
    title text NOT NULL,
    message text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false,
    action_url text,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS ix_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS ix_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS ix_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS ix_notifications_created ON notifications(created_at DESC);

-- Function to create a notification
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id uuid,
    p_type text,
    p_title text,
    p_message text,
    p_data jsonb DEFAULT '{}'::jsonb,
    p_action_url text DEFAULT NULL,
    p_expires_hours integer DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_notification_id uuid;
    v_expires_at timestamptz;
BEGIN
    IF p_expires_hours IS NOT NULL THEN
        v_expires_at := now() + (p_expires_hours || ' hours')::interval;
    END IF;
    
    INSERT INTO notifications (user_id, type, title, message, data, action_url, expires_at)
    VALUES (p_user_id, p_type, p_title, p_message, p_data, p_action_url, v_expires_at)
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(
    p_notification_id uuid,
    p_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE notifications
    SET is_read = true
    WHERE id = p_notification_id
    AND user_id = p_user_id;
    
    RETURN FOUND;
END;
$$;

-- Function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(
    p_user_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE notifications
    SET is_read = true
    WHERE user_id = p_user_id
    AND is_read = false;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION get_unread_notification_count(
    p_user_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count integer;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM notifications
    WHERE user_id = p_user_id
    AND is_read = false
    AND (expires_at IS NULL OR expires_at > now());
    
    RETURN v_count;
END;
$$;

-- Function to clean up expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count integer;
BEGIN
    DELETE FROM notifications
    WHERE expires_at IS NOT NULL
    AND expires_at < now();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- RLS policies for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_read_own ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY notifications_insert_own ON notifications
    FOR INSERT WITH CHECK (auth.uid() = user_id OR 
                          EXISTS (
                              SELECT 1 FROM profiles p
                              WHERE p.id = auth.uid()
                              AND p.role IN ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
                          ));

CREATE POLICY notifications_update_own ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY notifications_delete_own ON notifications
    FOR DELETE USING (auth.uid() = user_id OR
                      EXISTS (
                          SELECT 1 FROM profiles p
                          WHERE p.id = auth.uid()
                          AND p.role IN ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
                      ));

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION create_notification(uuid, text, text, text, jsonb, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_notifications() TO authenticated;

-- Enable realtime for notifications (for real-time notifications)
-- Note: This requires enabling replication in Supabase dashboard
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
