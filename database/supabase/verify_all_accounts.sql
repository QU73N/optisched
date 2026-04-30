-- Verify all accounts from QUICK_LOGIN.md exist and are properly set up

-- Check admin roles
SELECT 'Admin Roles' as category, email, full_name, role 
FROM profiles 
WHERE email IN (
  'admin.9999@optisched.sti.edu',
  'system.admin@optisched.sti.edu',
  'schedule.admin@optisched.sti.edu',
  'schedule.manager@optisched.sti.edu'
)
ORDER BY role;

-- Check teachers
SELECT 'Teachers' as category, email, full_name, role 
FROM profiles 
WHERE email IN (
  'bea.magno@optisched.sti.edu',
  'edgar.habana@optisched.sti.edu',
  'ello.egnacio@optisched.sti.edu',
  'john.calizon@optisched.sti.edu',
  'mark.doblon@optisched.sti.edu',
  'mary.balando@optisched.sti.edu',
  'psalmmiracle.mariano@optisched.sti.edu',
  'reneil.arnado@optisched.sti.edu'
)
ORDER BY full_name;

-- Check students
SELECT 'Students' as category, email, full_name, role 
FROM profiles 
WHERE email IN (
  'abmstudent11.123456@optisched.sti.edu',
  'mawd11.student@optisched.sti.edu',
  'stem12test.123456@optisched.sti.edu',
  'abm12.student@optisched.sti.edu',
  'morgado.399541@optisched.sti.edu',
  'cama.496878@optisched.sti.edu',
  'paterno.395180@optisched.sti.edu',
  'pineda.400593@optisched.sti.edu',
  'perez.398308@optisched.sti.edu',
  'stem12.student@optisched.sti.edu'
)
ORDER BY full_name;

-- Check that all profiles have corresponding auth users
SELECT p.email, p.full_name, 
  CASE WHEN a.id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_auth_user
FROM profiles p
LEFT JOIN auth.users a ON p.id = a.id
WHERE p.email IN (
  'admin.9999@optisched.sti.edu',
  'system.admin@optisched.sti.edu',
  'schedule.admin@optisched.sti.edu',
  'schedule.manager@optisched.sti.edu',
  'bea.magno@optisched.sti.edu',
  'edgar.habana@optisched.sti.edu',
  'ello.egnacio@optisched.sti.edu',
  'john.calizon@optisched.sti.edu',
  'mark.doblon@optisched.sti.edu',
  'mary.balando@optisched.sti.edu',
  'psalmmiracle.mariano@optisched.sti.edu',
  'reneil.arnado@optisched.sti.edu',
  'abmstudent11.123456@optisched.sti.edu',
  'mawd11.student@optisched.sti.edu',
  'stem12test.123456@optisched.sti.edu',
  'abm12.student@optisched.sti.edu',
  'morgado.399541@optisched.sti.edu',
  'cama.496878@optisched.sti.edu',
  'paterno.395180@optisched.sti.edu',
  'pineda.400593@optisched.sti.edu',
  'perez.398308@optisched.sti.edu',
  'stem12.student@optisched.sti.edu'
)
ORDER BY p.role, p.full_name;
