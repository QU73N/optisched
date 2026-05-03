-- RPC function to insert schedules without triggering versioning
-- This bypasses the Supabase client's query builder issues

CREATE OR REPLACE FUNCTION public.insert_schedules_batch(
    p_schedules jsonb
)
RETURNS void AS $$
BEGIN
    INSERT INTO public.schedules (
        subject_id,
        teacher_id,
        room_id,
        section_id,
        day_of_week,
        start_time,
        end_time,
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
        (elem->>'status')::text,
        (elem->>'is_active')::boolean
    FROM jsonb_array_elements(p_schedules) AS elem;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.insert_schedules_batch TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.insert_schedules_batch IS 'Inserts multiple schedule records from JSON array without triggering versioning';
