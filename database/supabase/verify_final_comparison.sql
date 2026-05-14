-- Compare with original schedules count
SELECT 
    'COMPARISON' as section,
    'Original active schedules (all statuses)' as metric,
    COUNT(*) as count
FROM public.schedules
WHERE is_active = true

UNION ALL

SELECT 
    'COMPARISON' as section,
    'RPC result (published only)' as metric,
    COUNT(*) as count
FROM get_schedules_with_details()

UNION ALL

SELECT 
    'COMPARISON' as section,
    'Published schedules in DB' as metric,
    COUNT(*) as count
FROM public.schedules
WHERE is_active = true AND status = 'published';
