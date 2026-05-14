-- Check all teachers with their availability
SELECT 
    t.id as teacher_id,
    p.full_name,
    tp.availability
FROM teachers t
LEFT JOIN profiles p ON p.id = t.profile_id
LEFT JOIN teacher_preferences tp ON tp.teacher_id = t.id
ORDER BY p.full_name;

-- Check all schedules to see which teachers are assigned to which days
SELECT 
    s.teacher_id,
    p.full_name,
    s.day_of_week,
    COUNT(*) as schedule_count
FROM schedules s
LEFT JOIN teachers t ON t.id = s.teacher_id
LEFT JOIN profiles p ON p.id = t.profile_id
WHERE s.is_active = true AND s.status = 'published'
GROUP BY s.teacher_id, p.full_name, s.day_of_week
ORDER BY p.full_name, s.day_of_week;
