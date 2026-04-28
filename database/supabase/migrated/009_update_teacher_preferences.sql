-- ============================================================================
-- Migration 009: Update Teacher Preferences for Detailed Availability
-- Updates teacher_preferences table to support detailed time-slot availability
-- and other preference fields from the UI
-- ============================================================================

-- Drop old columns that will be replaced
ALTER TABLE teacher_preferences 
DROP COLUMN IF EXISTS morning_available,
DROP COLUMN IF EXISTS afternoon_available,
DROP COLUMN IF EXISTS evening_available,
DROP COLUMN IF EXISTS max_consecutive_hours;

-- Add new columns for detailed availability
ALTER TABLE teacher_preferences
ADD COLUMN IF NOT EXISTS availability jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS preferred_time_start text DEFAULT '8:00',
ADD COLUMN IF NOT EXISTS preferred_time_end text DEFAULT '17:00',
ADD COLUMN IF NOT EXISTS max_classes_per_day integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS max_consecutive_classes integer DEFAULT 3;

-- Update preferred_subjects and preferred_rooms to store names instead of UUIDs
-- (This requires data migration if the table has data)

-- Function to check teacher availability for a specific day and time
CREATE OR REPLACE FUNCTION is_teacher_available(
    p_teacher_id uuid,
    p_day text,
    p_time text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pref jsonb;
    v_key text;
BEGIN
    SELECT availability INTO v_pref
    FROM teacher_preferences
    WHERE teacher_id = p_teacher_id;
    
    IF v_pref IS NULL THEN
        RETURN true; -- Default to available if no preferences set
    END IF;
    
    v_key := p_day || '-' || p_time;
    RETURN COALESCE((v_pref->>v_key)::boolean, true);
END;
$$;

-- Function to get teacher's preferred subjects by name
CREATE OR REPLACE FUNCTION get_teacher_preferred_subject_names(
    p_teacher_id uuid
) RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_subject_ids uuid[];
    v_subject_names text[];
BEGIN
    SELECT preferred_subjects INTO v_subject_ids
    FROM teacher_preferences
    WHERE teacher_id = p_teacher_id;
    
    IF v_subject_ids IS NULL OR array_length(v_subject_ids, 1) = 0 THEN
        RETURN ARRAY[]::text[];
    END IF;
    
    SELECT array_agg(name) INTO v_subject_names
    FROM subjects
    WHERE id = ANY(v_subject_ids);
    
    RETURN COALESCE(v_subject_names, ARRAY[]::text[]);
END;
$$;

-- Function to get teacher's preferred rooms by name
CREATE OR REPLACE FUNCTION get_teacher_preferred_room_names(
    p_teacher_id uuid
) RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_room_ids uuid[];
    v_room_names text[];
BEGIN
    SELECT preferred_rooms INTO v_room_ids
    FROM teacher_preferences
    WHERE teacher_id = p_teacher_id;
    
    IF v_room_ids IS NULL OR array_length(v_room_ids, 1) = 0 THEN
        RETURN ARRAY[]::text[];
    END IF;
    
    SELECT array_agg(name) INTO v_room_names
    FROM rooms
    WHERE id = ANY(v_room_ids);
    
    RETURN COALESCE(v_room_names, ARRAY[]::text[]);
END;
$$;

-- Update RLS policies for teacher_preferences
ALTER TABLE teacher_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY teacher_preferences_read_own ON teacher_preferences
    FOR SELECT USING (auth.uid() = teacher_id OR 
                      EXISTS (SELECT 1 FROM teachers WHERE id = teacher_preferences.teacher_id AND profile_id = auth.uid()));

CREATE POLICY teacher_preferences_update_own ON teacher_preferences
    FOR UPDATE USING (auth.uid() = teacher_id OR 
                     EXISTS (SELECT 1 FROM teachers WHERE id = teacher_preferences.teacher_id AND profile_id = auth.uid()));

CREATE POLICY teacher_preferences_insert_own ON teacher_preferences
    FOR INSERT WITH CHECK (auth.uid() = teacher_id OR 
                          EXISTS (SELECT 1 FROM teachers WHERE id = teacher_preferences.teacher_id AND profile_id = auth.uid()));

CREATE POLICY teacher_preferences_read_admin ON teacher_preferences
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN teachers t ON t.profile_id = p.id
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
        )
    );

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION is_teacher_available(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_teacher_preferred_subject_names(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_teacher_preferred_room_names(uuid) TO authenticated;
