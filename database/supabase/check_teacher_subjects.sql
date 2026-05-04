-- Check which teachers have subjects assigned
SELECT 
    t.id,
    p.full_name,
    COUNT(DISTINCT sub.id) as subject_count,
    t.created_at
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
LEFT JOIN subjects sub ON sub.teacher_id = t.id
GROUP BY t.id, p.full_name, t.created_at
ORDER BY p.full_name, t.created_at;
