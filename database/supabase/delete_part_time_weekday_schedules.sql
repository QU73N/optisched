-- ============================================================================
-- DELETE PART-TIME TEACHER WEEKDAY SCHEDULES
-- ============================================================================
-- This script deletes existing weekday schedules for part-time teachers
-- since they should only be scheduled on Saturday.
-- ============================================================================

-- Delete weekday schedules for part-time teachers
DELETE FROM schedules
WHERE teacher_id IN ('31c5a71a-a5f6-4203-b262-2d603351f5d2', 'bc211fd8-9917-4114-af3c-6b4694a9cc1c')
  AND day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
  AND is_active = true
  AND status = 'published';

-- Verify deletion - should return 0 rows
SELECT 
    'PART-TIME TEACHERS WEEKDAY SCHEDULES AFTER DELETION (SHOULD BE EMPTY)' as section,
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

-- Check remaining schedules (should only be Saturday or no schedules)
SELECT 
    'PART-TIME TEACHERS REMAINING SCHEDULES' as section,
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
  AND s.is_active = true
  AND s.status = 'published'
ORDER BY p.full_name, s.day_of_week, s.start_time;
