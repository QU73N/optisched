-- Quick check of data counts for critical tables
SELECT 
    'subjects' as table_name, COUNT(*) as row_count FROM subjects
UNION ALL
SELECT 
    'teachers' as table_name, COUNT(*) as row_count FROM teachers
UNION ALL
SELECT 
    'rooms' as table_name, COUNT(*) as row_count FROM rooms
UNION ALL
SELECT 
    'sections' as table_name, COUNT(*) as row_count FROM sections
UNION ALL
SELECT 
    'schedules' as table_name, COUNT(*) as row_count FROM schedules
UNION ALL
SELECT 
    'students' as table_name, COUNT(*) as row_count FROM students
ORDER BY table_name;
