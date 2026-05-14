-- Check top teacher workload after fix
SELECT 
    'TEACHER WORKLOAD AFTER FIX V2' as section,
    teacher_id,
    teacher_name,
    COUNT(*) as class_count,
    SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) as total_hours
FROM get_schedules_with_details()
WHERE teacher_id = 'bbc91167-72c7-4244-9b4d-27efbe79f4c3'
GROUP BY teacher_id, teacher_name;
