-- Check unique schedules (grouped by teacher, subject, room, section)
SELECT 
    teacher_id,
    subject_id,
    room_id,
    section_id,
    COUNT(*) as session_count
FROM schedules
GROUP BY teacher_id, subject_id, room_id, section_id
ORDER BY session_count DESC
LIMIT 10;

-- Count unique schedule combinations
SELECT COUNT(DISTINCT (teacher_id, subject_id, room_id, section_id)) as unique_schedules
FROM schedules;
