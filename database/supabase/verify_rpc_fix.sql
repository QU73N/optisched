-- Test the RPC function count
SELECT 
    'RPC FUNCTION RESULT COUNT' as section,
    COUNT(*) as count
FROM get_schedules_with_details();
