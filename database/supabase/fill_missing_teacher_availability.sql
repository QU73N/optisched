-- ============================================================================
-- FILL MISSING TEACHER AVAILABILITY DATA
-- ============================================================================
-- This script fills in the availability map for teachers with empty availability
-- based on their preferred_days and preferred_time_start/end
-- ============================================================================

-- Function to generate availability map for a teacher
CREATE OR REPLACE FUNCTION generate_availability_map(
    p_preferred_days text[],
    p_preferred_time_start text,
    p_preferred_time_end text
)
RETURNS jsonb AS $$
DECLARE
    availability_map jsonb := '{}'::jsonb;
    time_slot text;
    day_name text;
BEGIN
    -- Time slots in 30-minute increments
    FOR time_slot IN VALUES
        ('08:00'), ('08:30'), ('09:00'), ('09:30'), ('10:00'), ('10:30'),
        ('11:00'), ('11:30'), ('12:00'), ('12:30'), ('13:00'), ('13:30'),
        ('14:00'), ('14:30'), ('15:00'), ('15:30'), ('16:00'), ('16:30'),
        ('17:00'), ('17:30'), ('18:00')
    LOOP
        -- Only include time slots within the preferred time window
        IF time_slot >= p_preferred_time_start AND time_slot <= p_preferred_time_end THEN
            -- Add time slot for each preferred day
            FOR day_name IN SELECT unnest(p_preferred_days) LOOP
                availability_map := availability_map || jsonb_build_object(
                    day_name || '-' || time_slot, true
                );
            END LOOP;
        END IF;
    END LOOP;
    
    RETURN availability_map;
END;
$$ LANGUAGE plpgsql;

-- Update teachers with empty availability
UPDATE teacher_preferences tp
SET availability = generate_availability_map(
    COALESCE(tp.preferred_days, ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']::text[]),
    COALESCE(tp.preferred_time_start, '08:00'),
    COALESCE(tp.preferred_time_end, '17:00')
)
WHERE tp.availability::text = '{}'::text
   OR tp.availability IS NULL;

-- Verify the update
SELECT 
    'TEACHERS AVAILABILITY AFTER UPDATE' as section,
    t.id as teacher_id,
    p.full_name,
    t.employment_type,
    tp.preferred_days,
    tp.preferred_time_start,
    tp.preferred_time_end,
    CASE 
        WHEN tp.availability::text = '{}' THEN 'EMPTY'
        WHEN tp.availability IS NULL THEN 'NULL'
        ELSE 'HAS_DATA (' || (SELECT COUNT(*) FROM jsonb_object_keys(tp.availability))::text || ' keys)'
    END as availability_status
FROM teachers t
LEFT JOIN profiles p ON p.id = t.profile_id
LEFT JOIN teacher_preferences tp ON tp.teacher_id = t.id
ORDER BY p.full_name;
