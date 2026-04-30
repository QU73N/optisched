-- Check which students are in which sections
SELECT s.id, p.email, p.full_name, sec.name as section_name, sec.year_level 
FROM students s 
JOIN profiles p ON s.profile_id = p.id 
JOIN sections sec ON s.section_id = sec.id 
ORDER BY sec.year_level, sec.name, p.full_name;
