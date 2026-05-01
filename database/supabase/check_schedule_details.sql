-- Check schedule details with subject and section info
SELECT 
    s.id,
    s.day_of_week,
    s.start_time,
    s.end_time,
    s.status,
    p.full_name as teacher_name,
    sub.name as subject_name,
    sec.name as section_name
FROM schedules s
LEFT JOIN teachers t ON s.teacher_id = t.id
LEFT JOIN profiles p ON t.profile_id = p.id
LEFT JOIN subjects sub ON s.subject_id = sub.id
LEFT JOIN sections sec ON s.section_id = sec.id;
