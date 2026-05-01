-- Set all teachers to public so they can be viewed by admin users
UPDATE teachers SET is_public = true WHERE is_public = false;

-- Verify the change
SELECT t.id, p.email, p.full_name, t.is_public, t.department
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
ORDER BY p.full_name;
