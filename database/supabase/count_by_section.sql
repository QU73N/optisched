-- Count schedules by section
SELECT 
    section_id,
    s.name as section_name,
    COUNT(*) as schedule_count
FROM schedules sc
JOIN sections s ON sc.section_id = s.id
GROUP BY section_id, s.name
ORDER BY schedule_count DESC;

-- Count by teacher
SELECT 
    teacher_id,
    p.full_name as teacher_name,
    COUNT(*) as schedule_count
FROM schedules sc
JOIN teachers t ON sc.teacher_id = t.id
JOIN profiles p ON t.profile_id = p.id
GROUP BY teacher_id, p.full_name
ORDER BY schedule_count DESC;
