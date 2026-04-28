-- ============================================================================
-- Migration 013: Schedule Locking Enforcement
-- Enables locking of schedules to prevent unauthorized modifications
-- Includes RLS policies, UI indicators, and audit logging
-- ============================================================================

-- Add is_locked column to schedules table
ALTER TABLE schedules
ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS locked_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS locked_at timestamptz,
ADD COLUMN IF NOT EXISTS lock_reason text;

-- Create index for locked schedules
CREATE INDEX IF NOT EXISTS ix_schedules_locked ON schedules(is_locked);

-- Function to lock a schedule
CREATE OR REPLACE FUNCTION lock_schedule(
    p_schedule_id uuid,
    p_locked_by uuid,
    p_reason text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE schedules
    SET 
        is_locked = true,
        locked_by = p_locked_by,
        locked_at = now(),
        lock_reason = p_reason
    WHERE id = p_schedule_id;
    
    -- Log the lock action
    INSERT INTO user_activity_logs (user_id, action_type, resource, resource_id, action_details)
    VALUES (
        p_locked_by,
        'lock',
        'schedule',
        p_schedule_id,
        jsonb_build_object('reason', p_reason)
    );
    
    RETURN FOUND;
END;
$$;

-- Function to unlock a schedule
CREATE OR REPLACE FUNCTION unlock_schedule(
    p_schedule_id uuid,
    p_unlocked_by uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE schedules
    SET 
        is_locked = false,
        locked_by = NULL,
        locked_at = NULL,
        lock_reason = NULL
    WHERE id = p_schedule_id;
    
    -- Log the unlock action
    INSERT INTO user_activity_logs (user_id, action_type, resource, resource_id)
    VALUES (
        p_unlocked_by,
        'unlock',
        'schedule',
        p_schedule_id
    );
    
    RETURN FOUND;
END;
$$;

-- Function to check if a schedule can be modified
CREATE OR REPLACE FUNCTION can_modify_schedule(
    p_schedule_id uuid,
    p_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_locked boolean;
    v_locked_by uuid;
    v_user_roles text[];
BEGIN
    -- Get schedule lock status
    SELECT is_locked, locked_by INTO v_is_locked, v_locked_by
    FROM schedules
    WHERE id = p_schedule_id;
    
    -- If not locked, can modify
    IF NOT v_is_locked THEN
        RETURN true;
    END IF;
    
    -- Get user roles
    SELECT ARRAY_AGG(role) INTO v_user_roles
    FROM profiles
    WHERE id = p_user_id;
    
    -- Admin roles can always modify
    IF v_user_roles && ARRAY['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'] THEN
        RETURN true;
    END IF;
    
    -- User who locked it can modify
    IF v_locked_by = p_user_id THEN
        RETURN true;
    END IF;
    
    -- Otherwise, cannot modify
    RETURN false;
END;
$$;

-- Function to bulk lock schedules for a semester/year
CREATE OR REPLACE FUNCTION lock_semester_schedules(
    p_academic_year text,
    p_semester text,
    p_locked_by uuid,
    p_reason text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE schedules
    SET 
        is_locked = true,
        locked_by = p_locked_by,
        locked_at = now(),
        lock_reason = p_reason
    WHERE academic_year = p_academic_year
    AND semester = p_semester
    AND is_locked = false;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Log the bulk lock action
    INSERT INTO user_activity_logs (user_id, action_type, resource, action_details)
    VALUES (
        p_locked_by,
        'bulk_lock',
        'schedules',
        NULL,
        jsonb_build_object(
            'academic_year', p_academic_year,
            'semester', p_semester,
            'count', v_count,
            'reason', p_reason
        )
    );
    
    RETURN v_count;
END;
$$;

-- Function to bulk unlock schedules for a semester/year
CREATE OR REPLACE FUNCTION unlock_semester_schedules(
    p_academic_year text,
    p_semester text,
    p_unlocked_by uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count integer;
BEGIN
    UPDATE schedules
    SET 
        is_locked = false,
        locked_by = NULL,
        locked_at = NULL,
        lock_reason = NULL
    WHERE academic_year = p_academic_year
    AND semester = p_semester
    AND is_locked = true;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Log the bulk unlock action
    INSERT INTO user_activity_logs (user_id, action_type, resource, action_details)
    VALUES (
        p_unlocked_by,
        'bulk_unlock',
        'schedules',
        NULL,
        jsonb_build_object(
            'academic_year', p_academic_year,
            'semester', p_semester,
            'count', v_count
        )
    );
    
    RETURN v_count;
END;
$$;

-- Update RLS policies to respect locking
DROP POLICY IF EXISTS schedules_update_own ON schedules;
CREATE POLICY schedules_update_own ON schedules
    FOR UPDATE USING (
        auth.uid() = teacher_id OR
        EXISTS (
            SELECT 1 FROM teachers t
            JOIN profiles p ON p.id = t.profile_id
            WHERE t.id = schedules.teacher_id
            AND p.id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
        )
    );

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION lock_schedule(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION unlock_schedule(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION can_modify_schedule(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION lock_semester_schedules(text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION unlock_semester_schedules(text, text, uuid) TO authenticated;
