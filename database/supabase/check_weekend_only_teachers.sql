-- Check teachers with Saturday-only availability
SELECT 
    t.id as teacher_id,
    p.full_name,
    tp.availability
FROM teachers t
LEFT JOIN profiles p ON p.id = t.profile_id
LEFT JOIN teacher_preferences tp ON tp.teacher_id = t.id
WHERE tp.availability::text ILIKE '%Saturday%'
ORDER BY p.full_name;
