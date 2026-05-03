-- Fix create_schedule_version function
DROP FUNCTION IF EXISTS public.create_schedule_version CASCADE;

CREATE OR REPLACE FUNCTION public.create_schedule_version(
    p_schedule_id uuid,
    p_change_type text,
    p_change_summary text,
    p_change_reason text,
    p_state_hash text,
    p_soft_score numeric,
    p_conflict_count integer,
    p_changed_by uuid,
    p_previous_version_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    v_version_id uuid;
    v_schedule_data jsonb;
BEGIN
    -- Get full schedule data as JSON
    SELECT jsonb_agg(
        jsonb_build_object(
            'subject_id', s.subject_id,
            'teacher_id', s.teacher_id,
            'room_id', s.room_id,
            'section_id', s.section_id,
            'day_of_week', s.day_of_week,
            'start_time', s.start_time,
            'end_time', s.end_time
        )
    ) INTO v_schedule_data
    FROM schedules s
    WHERE s.schedule_id = p_schedule_id;
    
    -- If no schedule data, return null
    IF v_schedule_data IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Insert new version
    INSERT INTO schedule_versions (
        schedule_id,
        version_number,
        data,
        change_type,
        change_summary,
        change_reason,
        state_hash,
        soft_score,
        conflict_count,
        created_by,
        previous_version_id
    )
    VALUES (
        p_schedule_id,
        (SELECT COALESCE(MAX(version_number), 0) + 1 FROM schedule_versions WHERE schedule_id = p_schedule_id),
        v_schedule_data,
        p_change_type,
        p_change_summary,
        p_change_reason,
        p_state_hash,
        p_soft_score,
        p_conflict_count,
        p_changed_by,
        p_previous_version_id
    )
    RETURNING id INTO v_version_id;
    
    RETURN v_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_schedule_version TO authenticated;
