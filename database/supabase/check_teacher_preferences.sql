-- Check which teachers have preferences
SELECT 
    tp.teacher_id,
    p.full_name,
    tp.preferred_days,
    tp.preferred_time_start,
    tp.preferred_time_end
FROM teacher_preferences tp
JOIN teachers t ON tp.teacher_id = t.id
JOIN profiles p ON t.profile_id = p.id
ORDER BY p.full_name;
