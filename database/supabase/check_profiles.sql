-- Check existing users (all profiles)
SELECT id, email, full_name, role FROM profiles ORDER BY role, full_name;
