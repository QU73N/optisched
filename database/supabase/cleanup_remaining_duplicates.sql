-- Delete remaining duplicate teacher profile accounts (the .123456 ones)
DELETE FROM profiles WHERE email IN (
    'magno.123456@optisched.sti.edu',
    'calizon.123456@optisched.sti.edu',
    'arnado.123456@optisched.sti.edu',
    'mariano.123456@optisched.sti.edu',
    'egnacio.123456@meycauayan.sti.edu.ph'
);

-- Update department names to match standard departments
UPDATE teachers 
SET department = 'Physical Education' 
WHERE department = 'Arts & PE';

UPDATE teachers 
SET department = 'Science' 
WHERE department IN ('Chemistry', 'Physics');

UPDATE teachers 
SET department = 'Information Technology' 
WHERE department = 'Computer Science';

-- Verify the changes
SELECT t.id, p.email, p.full_name, t.is_public, t.department
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
ORDER BY p.full_name;

-- Verify no duplicates remain
SELECT email, full_name, role, COUNT(*) as count
FROM profiles
GROUP BY email, full_name, role
HAVING COUNT(*) > 1;
