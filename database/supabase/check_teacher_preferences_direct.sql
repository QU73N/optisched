-- Check teacher preferences data directly
SELECT 
    tp.teacher_id,
    p.full_name,
    tp.availability
FROM teacher_preferences tp
LEFT JOIN profiles p ON p.id = (SELECT profile_id FROM teachers WHERE id = tp.teacher_id)
ORDER BY p.full_name;
