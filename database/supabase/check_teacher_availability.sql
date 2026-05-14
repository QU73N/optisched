-- Check teacher preferences table structure
SELECT 
    'TEACHER PREFERENCES COLUMNS' as section,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'teacher_preferences'
ORDER BY ordinal_position;

-- Check teacher preferences data
SELECT 
    'TEACHER PREFERENCES DATA' as section,
    *
FROM teacher_preferences
LIMIT 10;

-- Check weekend teachers and their schedules
SELECT 
    'WEEKEND TEACHERS SCHEDULES' as section,
    t.id as teacher_id,
    p.full_name,
    tp.availability,
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
ORDER BY p.full_name, s.day_of_week;
