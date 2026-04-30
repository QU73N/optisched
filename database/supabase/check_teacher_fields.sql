-- Check if teachers have all required fields for FacultyHub
SELECT t.id, p.email, p.full_name, t.department, t.employment_type, t.max_hours, t.is_public, t.is_active
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
ORDER BY p.full_name;
