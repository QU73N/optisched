-- Check which teacher profiles have associated data
-- This will help us identify which duplicates to keep

-- Check teachers table
SELECT t.id, p.email, p.full_name, t.is_public, t.department
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
ORDER BY p.full_name;

-- Check teacher_preferences
SELECT tp.id, p.email, p.full_name
FROM teacher_preferences tp
JOIN profiles p ON tp.teacher_id = p.id
ORDER BY p.full_name;

-- Check subjects assigned to teachers
SELECT s.id, s.name, p.email as teacher_email
FROM subjects s
JOIN profiles p ON s.teacher_id = p.id
ORDER BY s.name;

-- Check schedules created by teachers
SELECT COUNT(*) as count, p.email, p.full_name
FROM schedules sch
JOIN profiles p ON sch.created_by = p.id
WHERE p.role = 'teacher'
GROUP BY p.email, p.full_name
ORDER BY p.full_name;
