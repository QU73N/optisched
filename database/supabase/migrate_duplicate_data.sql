-- Migrate data from duplicate accounts to primary accounts before deletion
-- Then delete the duplicates

-- First, check which duplicates have data
SELECT 'Schedules by duplicate:' as info;
SELECT COUNT(*) as count, p.email, p.full_name
FROM schedules sch
JOIN profiles p ON sch.created_by = p.id
WHERE p.email IN (
    'magno.123456@optisched.sti.edu',
    'habana.123456@optisched.sti.edu',
    'calizon.123456@optisched.sti.edu',
    'arnado.123456@optisched.sti.edu',
    'mariano.123456@optisched.sti.edu',
    'egnacio.123456@meycauayan.sti.edu.ph'
)
GROUP BY p.email, p.full_name;

SELECT 'Teacher records for duplicates:' as info;
SELECT t.id, p.email, p.full_name
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
WHERE p.email IN (
    'magno.123456@optisched.sti.edu',
    'habana.123456@optisched.sti.edu',
    'calizon.123456@optisched.sti.edu',
    'arnado.123456@optisched.sti.edu',
    'mariano.123456@optisched.sti.edu',
    'egnacio.123456@meycauayan.sti.edu.ph'
);

SELECT 'Teacher preferences for duplicates:' as info;
SELECT tp.id, p.email, p.full_name
FROM teacher_preferences tp
JOIN profiles p ON tp.teacher_id = p.id
WHERE p.email IN (
    'magno.123456@optisched.sti.edu',
    'habana.123456@optisched.sti.edu',
    'calizon.123456@optisched.sti.edu',
    'arnado.123456@optisched.sti.edu',
    'mariano.123456@optisched.sti.edu',
    'egnacio.123456@meycauayan.sti.edu.ph'
);

SELECT 'Subjects by duplicates:' as info;
SELECT s.id, s.name, p.email
FROM subjects s
JOIN profiles p ON s.teacher_id = p.id
WHERE p.email IN (
    'magno.123456@optisched.sti.edu',
    'habana.123456@optisched.sti.edu',
    'calizon.123456@optisched.sti.edu',
    'arnado.123456@optisched.sti.edu',
    'mariano.123456@optisched.sti.edu',
    'egnacio.123456@meycauayan.sti.edu.ph'
);
