-- Verify part-time teacher availability was updated correctly
SELECT 
    tp.teacher_id,
    p.full_name,
    tp.preferred_days,
    tp.availability
FROM teacher_preferences tp
LEFT JOIN teachers t ON t.id = tp.teacher_id
LEFT JOIN profiles p ON p.id = t.profile_id
WHERE tp.teacher_id IN ('31c5a71a-a5f6-4203-b262-2d603351f5d2', 'bc211fd8-9917-4114-af3c-6b4694a9cc1c')
ORDER BY p.full_name;
