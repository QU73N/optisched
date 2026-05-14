-- Check weekend teachers (availability = Saturday only)
SELECT 
    'WEEKEND TEACHERS' as section,
    t.id as teacher_id,
    p.full_name,
    tp.availability
FROM teachers t
LEFT JOIN profiles p ON p.id = t.profile_id
LEFT JOIN teacher_preferences tp ON tp.teacher_id = t.id
WHERE tp.availability::text = '["Saturday"]'::text
   OR tp.availability::text = '["Sunday"]'::text
ORDER BY p.full_name;

-- Check schedules for weekend teachers
SELECT 
    'WEEKEND TEACHERS SCHEDULES' as section,
    t.id as teacher_id,
    p.full_name,
    tp.availability as teacher_availability,
    s.day_of_week,
    s.start_time,
    s.end_time,
    sub.code as subject_code,
    sub.name as subject_name,
    sec.name as section_name
FROM teachers t
LEFT JOIN profiles p ON p.id = t.profile_id
LEFT JOIN teacher_preferences tp ON tp.teacher_id = t.id
LEFT JOIN schedules s ON s.teacher_id = t.id AND s.is_active = true AND s.status = 'published'
LEFT JOIN subjects sub ON sub.id = s.subject_id
LEFT JOIN sections sec ON sec.id = s.section_id
WHERE tp.availability::text = '["Saturday"]'::text
   OR tp.availability::text = '["Sunday"]'::text
ORDER BY p.full_name, s.day_of_week, s.start_time;
