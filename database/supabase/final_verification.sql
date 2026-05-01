-- Final verification - check no duplicates exist
SELECT email, full_name, role, COUNT(*) as count
FROM profiles
GROUP BY email, full_name, role
HAVING COUNT(*) > 1;

-- Check teacher departments
SELECT t.id, p.email, p.full_name, t.department
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
ORDER BY t.department, p.full_name;

-- Check student section coverage
SELECT sec.name as section, sec.year_level, COUNT(s.id) as student_count
FROM sections sec
LEFT JOIN students s ON sec.id = s.section_id
GROUP BY sec.name, sec.year_level
ORDER BY sec.year_level, sec.name;

-- Check admin roles
SELECT id, email, full_name, role FROM profiles 
WHERE role IN ('power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
ORDER BY role;
