-- Verify teachers have teacher records
SELECT p.email, p.full_name,
  CASE WHEN t.id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_teacher_record,
  t.department
FROM profiles p
LEFT JOIN teachers t ON p.id = t.profile_id
WHERE p.role = 'teacher'
ORDER BY p.full_name;

-- Verify students have student records with sections
SELECT p.email, p.full_name,
  CASE WHEN s.id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_student_record,
  sec.name as section_name,
  sec.year_level
FROM profiles p
LEFT JOIN students s ON p.id = s.profile_id
LEFT JOIN sections sec ON s.section_id = sec.id
WHERE p.role = 'student'
ORDER BY sec.year_level, sec.name, p.full_name;
