-- ============================================================================
-- FIX PART-TIME TEACHER AVAILABILITY
-- ============================================================================
-- This script fixes the availability for part-time teachers to ensure they
-- are only scheduled on weekends (Saturday), not weekdays.
-- ============================================================================

-- Part-time teachers (from update_teacher_assignments.sql)
-- 31c5a71a-a5f6-4203-b262-2d603351f5d2 - Mary Jane Balando
-- bc211fd8-9917-4114-af3c-6b4694a9cc1c - Mark Gerald Doblon

-- Update preferred_days to Saturday only
UPDATE teacher_preferences
SET preferred_days = ARRAY['Saturday']::text[]
WHERE teacher_id IN ('31c5a71a-a5f6-4203-b262-2d603351f5d2', 'bc211fd8-9917-4114-af3c-6b4694a9cc1c');

-- Update availability map to Saturday only (8:00-17:00)
-- The map format is: {"Saturday-08:00": true, "Saturday-08:30": true, ...}
UPDATE teacher_preferences
SET availability = jsonb_build_object(
    'Saturday-08:00', true,
    'Saturday-08:30', true,
    'Saturday-09:00', true,
    'Saturday-09:30', true,
    'Saturday-10:00', true,
    'Saturday-10:30', true,
    'Saturday-11:00', true,
    'Saturday-11:30', true,
    'Saturday-12:00', true,
    'Saturday-12:30', true,
    'Saturday-13:00', true,
    'Saturday-13:30', true,
    'Saturday-14:00', true,
    'Saturday-14:30', true,
    'Saturday-15:00', true,
    'Saturday-15:30', true,
    'Saturday-16:00', true,
    'Saturday-16:30', true,
    'Saturday-17:00', true
)
WHERE teacher_id IN ('31c5a71a-a5f6-4203-b262-2d603351f5d2', 'bc211fd8-9917-4114-af3c-6b4694a9cc1c');

-- Verify the changes
SELECT 
    'PART-TIME TEACHERS AFTER FIX' as section,
    tp.teacher_id,
    p.full_name,
    tp.preferred_days,
    tp.availability
FROM teacher_preferences tp
LEFT JOIN teachers t ON t.id = tp.teacher_id
LEFT JOIN profiles p ON p.id = t.profile_id
WHERE tp.teacher_id IN ('31c5a71a-a5f6-4203-b262-2d603351f5d2', 'bc211fd8-9917-4114-af3c-6b4694a9cc1c')
ORDER BY p.full_name;

-- Check if these teachers have any weekday schedules
SELECT 
    'PART-TIME TEACHERS WEEKDAY SCHEDULES (SHOULD BE EMPTY)' as section,
    s.teacher_id,
    p.full_name,
    s.day_of_week,
    s.start_time,
    s.end_time,
    sub.code as subject_code
FROM schedules s
LEFT JOIN teachers t ON t.id = s.teacher_id
LEFT JOIN profiles p ON p.id = t.profile_id
LEFT JOIN subjects sub ON sub.id = s.subject_id
WHERE s.teacher_id IN ('31c5a71a-a5f6-4203-b262-2d603351f5d2', 'bc211fd8-9917-4114-af3c-6b4694a9cc1c')
  AND s.day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
  AND s.is_active = true
  AND s.status = 'published'
ORDER BY p.full_name, s.day_of_week, s.start_time;
