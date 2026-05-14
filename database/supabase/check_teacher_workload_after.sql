-- Check teacher workload from RPC result (deduplicated)
SELECT 
    'TEACHER WORKLOAD FROM RPC (DEDUPLICATED)' as section,
    teacher_id,
    teacher_name,
    COUNT(*) as class_count,
    SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) as total_hours
FROM get_schedules_with_details()
GROUP BY teacher_id, teacher_name
ORDER BY total_hours DESC
LIMIT 10;
