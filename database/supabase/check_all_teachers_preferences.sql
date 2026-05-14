-- Check all teachers with their preferences
SELECT 
    t.id as teacher_id,
    p.full_name,
    t.employment_type,
    tp.preferred_days,
    tp.preferred_time_start,
    tp.preferred_time_end,
    tp.max_classes_per_day,
    tp.max_consecutive_classes,
    CASE 
        WHEN tp.availability::text = '{}' THEN 'EMPTY'
        WHEN tp.availability IS NULL THEN 'NULL'
        ELSE 'HAS_DATA'
    END as availability_status
FROM teachers t
LEFT JOIN profiles p ON p.id = t.profile_id
LEFT JOIN teacher_preferences tp ON tp.teacher_id = t.id
ORDER BY p.full_name;
