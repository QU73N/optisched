-- List all teachers with their details
SELECT 
    t.id,
    p.full_name,
    p.email,
    t.department,
    t.employment_type,
    t.max_hours,
    t.is_active,
    t.is_public,
    COUNT(DISTINCT st.subject_id) as subject_count
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
LEFT JOIN subject_teachers st ON st.teacher_id = t.id
GROUP BY t.id, p.full_name, p.email, t.department, t.employment_type, t.max_hours, t.is_active, t.is_public
ORDER BY p.full_name;
