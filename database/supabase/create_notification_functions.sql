-- Create notification RPC functions and trigger for schedule publishing
-- This ensures teachers and students are notified when schedules are published

-- Function to create a notification
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

-- Function to mark notification as read
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

-- Function to mark all notifications as read for a user
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

-- Function to get unread notification count
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

-- Function to notify affected users when a schedule is published
CREATE OR REPLACE FUNCTION notify_schedule_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_teacher_id uuid;
    v_section_id uuid;
    v_teacher_profile_id uuid;
    v_notification_id uuid;
BEGIN
    -- Only trigger when status changes to 'published'
    IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
        -- Get the teacher and section for this schedule
        SELECT teacher_id, section_id INTO v_teacher_id, v_section_id
        FROM public.schedules
        WHERE id = NEW.id;
        
        -- Notify the teacher if assigned
        IF v_teacher_id IS NOT NULL THEN
            -- Get the teacher's profile_id
            SELECT profile_id INTO v_teacher_profile_id
            FROM public.teachers
            WHERE id = v_teacher_id;
            
            IF v_teacher_profile_id IS NOT NULL THEN
                -- Create notification for teacher
                v_notification_id := create_notification(
                    p_user_id => v_teacher_profile_id,
                    p_type => 'schedule_change',
                    p_title => 'New Schedule Published',
                    p_message => 'A new schedule has been published. Please check your schedule for updates.',
                    p_data => jsonb_build_object(
                        'schedule_id', NEW.id,
                        'day_of_week', NEW.day_of_week,
                        'start_time', NEW.start_time
                    ),
                    p_action_url => '/schedule',
                    p_expires_hours => 168 -- 7 days
                );
            END IF;
        END IF;
        
        -- Notify all students in the section
        -- Note: This requires a students table which doesn't exist yet
        -- When students table is implemented, add logic here to notify students
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger on schedules table
DROP TRIGGER IF EXISTS trg_notify_schedule_publish ON public.schedules;
CREATE TRIGGER trg_notify_schedule_publish
    AFTER UPDATE OF status ON public.schedules
    FOR EACH ROW
    EXECUTE FUNCTION notify_schedule_publish();

-- Verification
SELECT 'Notification functions created' as status;
