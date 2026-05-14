-- Check by status
SELECT 
    'RPC BY STATUS' as section,
    status,
    COUNT(*) as count
FROM get_schedules_with_details()
GROUP BY status;
