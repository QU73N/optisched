-- Check for duplicate teacher names
SELECT 
    p.full_name,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(t.id ORDER BY t.created_at) as teacher_ids,
    ARRAY_AGG(t.created_at ORDER BY t.created_at) as created_dates
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
GROUP BY p.full_name
HAVING COUNT(*) > 1
ORDER BY p.full_name;
