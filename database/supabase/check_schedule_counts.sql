-- Check schedule counts by status and is_active
SELECT 
    'TOTAL SCHEDULES BY STATUS' as section,
    status,
    is_active,
    COUNT(*) as count
FROM public.schedules
GROUP BY status, is_active
ORDER BY status, is_active;
