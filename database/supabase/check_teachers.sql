-- Check teachers table
SELECT t.id, p.email, p.full_name, t.is_public, t.department
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
ORDER BY p.full_name;
