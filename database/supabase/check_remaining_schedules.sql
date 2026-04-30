-- Check which duplicate accounts still have schedules
SELECT COUNT(*) as count, p.email, p.full_name
FROM schedules sch
JOIN profiles p ON sch.created_by = p.id
WHERE p.email IN (
    'magno.123456@optisched.sti.edu',
    'calizon.123456@optisched.sti.edu',
    'arnado.123456@optisched.sti.edu',
    'mariano.123456@optisched.sti.edu',
    'egnacio.123456@meycauayan.sti.edu.ph'
)
GROUP BY p.email, p.full_name;
