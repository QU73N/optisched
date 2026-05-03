-- Enhanced RPC function to insert schedules with all required fields
-- Returns the inserted IDs for audit logging

CREATE OR REPLACE FUNCTION public.insert_schedules_batch_v2(
    p_schedules jsonb
)
RETURNS TABLE (id uuid) AS $$
DECLARE
    v_count integer;
BEGIN
    -- Validate input
    IF p_schedules IS NULL OR jsonb_array_length(p_schedules) = 0 THEN
        RAISE EXCEPTION 'No schedules provided';
    END IF;
    
    -- Insert schedules with all required fields
    RETURN QUERY
    INSERT INTO public.schedules (
        subject_id,
        teacher_id,
        room_id,
        section_id,
        day_of_week,
        start_time,
        end_time,
        semester,
        academic_year,
        status,
        is_active
    )
    SELECT
        (elem->>'subject_id')::uuid,
        (elem->>'teacher_id')::uuid,
        (elem->>'room_id')::uuid,
        (elem->>'section_id')::uuid,
        (elem->>'day_of_week')::text,
        (elem->>'start_time')::time,
        (elem->>'end_time')::time,
        COALESCE((elem->>'semester')::text, '1st Semester'),
        COALESCE((elem->>'academic_year')::text, '2025-2026'),
        (elem->>'status')::text,
        COALESCE((elem->>'is_active')::boolean, true)
    FROM jsonb_array_elements(p_schedules) AS elem
    RETURNING public.schedules.id;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RAISE NOTICE 'Inserted % schedules', v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.insert_schedules_batch_v2 TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.insert_schedules_batch_v2 IS 'Enhanced version that inserts schedules with all required fields and returns inserted IDs';
