-- Check which subjects are assigned to duplicate accounts
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

-- Also check the primary accounts' subjects for comparison
SELECT s.id, s.name, p.email
FROM subjects s
JOIN profiles p ON s.teacher_id = p.id
WHERE p.email IN (
    'bea.magno@optisched.sti.edu',
    'edgar.habana@optisched.sti.edu',
    'john.calizon@optisched.sti.edu',
    'reneil.arnado@optisched.sti.edu',
    'psalmmiracle.mariano@optisched.sti.edu',
    'ello.egnacio@optisched.sti.edu'
);
