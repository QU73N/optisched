-- ============================================================================
-- FIX TEACHER AVAILABILITY FORMAT
-- ============================================================================
-- This script fixes the availability format for part-time teachers.
-- Old format: {"slots": [{"day": "Monday", "start_time": "08:00", "end_time": "17:00"}]}
-- New format: {"Monday-08:00": true, "Monday-08:30": true, ...}
-- ============================================================================

-- Step 1: Identify teachers with old slots format
SELECT 
    tp.teacher_id,
    p.full_name,
    tp.availability
FROM teacher_preferences tp
JOIN profiles p ON tp.teacher_id = p.id
WHERE tp.availability::text LIKE '%slots%'
ORDER BY p.full_name;

-- Step 2: Convert old slots format to new map format
-- This will convert records that have the old slots array format to the new map format
UPDATE teacher_preferences tp
SET availability = (
    SELECT jsonb_object_agg(
        day_time_key,
        CASE 
            WHEN time_minutes >= slot_start_minutes AND time_minutes < slot_end_minutes THEN true
            ELSE false
        END
    )
    FROM (
        SELECT 
            slot.day || '-' || time_slot AS day_time_key,
            (SUBSTRING(time_slot, 1, 2)::int * 60 + SUBSTRING(time_slot, 4, 2)::int) AS time_minutes,
            (SUBSTRING(slot.start_time, 1, 2)::int * 60 + SUBSTRING(slot.start_time, 4, 2)::int) AS slot_start_minutes,
            (SUBSTRING(slot.end_time, 1, 2)::int * 60 + SUBSTRING(slot.end_time, 4, 2)::int) AS slot_end_minutes
        FROM jsonb_array_elements(tp.availability->'slots') AS slot
        CROSS JOIN (VALUES 
            ('7:00'), ('7:30'), ('8:00'), ('8:30'), ('9:00'), ('9:30'), ('10:00'), ('10:30'),
            ('11:00'), ('11:30'), ('12:00'), ('12:30'), ('13:00'), ('13:30'), ('14:00'), ('14:30'),
            ('15:00'), ('15:30'), ('16:00'), ('16:30'), ('17:00'), ('17:30'), ('18:00')
        ) AS time_slot(time_slot)
    ) expanded
)
WHERE tp.availability::text LIKE '%slots%';

-- Step 3: Verify the conversion
SELECT 
    tp.teacher_id,
    p.full_name,
    tp.availability
FROM teacher_preferences tp
JOIN profiles p ON tp.teacher_id = p.id
WHERE tp.availability::text LIKE '%slots%'
ORDER BY p.full_name;

-- If the above query returns no results, the conversion was successful

-- Step 4: Show sample of converted availability for verification
SELECT 
    p.full_name,
    tp.availability->'Monday-08:00' AS monday_0800,
    tp.availability->'Monday-17:00' AS monday_1700,
    tp.availability->'Saturday-08:00' AS saturday_0800
FROM teacher_preferences tp
JOIN profiles p ON tp.teacher_id = p.id
WHERE tp.availability IS NOT NULL
LIMIT 5;
