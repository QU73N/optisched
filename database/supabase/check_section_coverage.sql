-- Check student section coverage
SELECT sec.name as section, sec.year_level, COUNT(s.id) as student_count
FROM sections sec
LEFT JOIN students s ON sec.id = s.section_id
GROUP BY sec.name, sec.year_level
ORDER BY sec.year_level, sec.name;
