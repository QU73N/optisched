-- Compare original active schedules count with RPC result
SELECT 
    'COMPARISON' as section,
    'Original active schedules (draft + published + submitted)' as metric,
    COUNT(*) as count
FROM public.schedules
WHERE is_active = true AND status IN ('draft', 'published', 'submitted')

UNION ALL

SELECT 
    'COMPARISON' as section,
    'RPC result (deduplicated by slot)' as metric,
    COUNT(*) as count
FROM get_schedules_with_details()

UNION ALL

SELECT 
    'COMPARISON' as section,
    'Published only' as metric,
    COUNT(*) as count
FROM public.schedules
WHERE is_active = true AND status = 'published';
