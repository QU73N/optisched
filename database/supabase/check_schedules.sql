-- Check if there are any schedules in the database
SELECT COUNT(*) as total_schedules, status FROM schedules GROUP BY status;

-- Check sample schedules with teacher info
SELECT s.id, s.day_of_week, s.start_time, s.end_time, s.status, p.full_name as teacher_name
FROM schedules s
LEFT JOIN teachers t ON s.teacher_id = t.id
LEFT JOIN profiles p ON t.profile_id = p.id
LIMIT 10;
