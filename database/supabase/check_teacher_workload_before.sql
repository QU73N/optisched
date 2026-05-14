-- Check teacher workload from original schedules table (all active)
SELECT 
    'TEACHER WORKLOAD FROM SCHEDULES TABLE (ALL ACTIVE)' as section,
    teacher_id,
    COUNT(*) as class_count,
    SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) as total_hours
FROM public.schedules
WHERE is_active = true
GROUP BY teacher_id
ORDER BY total_hours DESC
LIMIT 10;
