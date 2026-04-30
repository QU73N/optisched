-- Check existing users (all profiles)
SELECT id, email, full_name, role FROM profiles ORDER BY role, full_name;

-- Check existing sections
SELECT id, name, year_level FROM sections ORDER BY year_level, name;
