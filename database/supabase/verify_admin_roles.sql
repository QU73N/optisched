-- Verify admin roles
SELECT id, email, full_name, role 
FROM profiles 
WHERE role IN ('power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
ORDER BY role;
