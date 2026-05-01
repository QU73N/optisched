-- Test the exact query that useTeachers uses
SELECT t.*, p.*
FROM teachers t
JOIN profiles p ON t.profile_id = p.id;
