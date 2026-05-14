-- Test the RPC function count
SELECT 
    'RPC FUNCTION RESULT COUNT V2' as section,
    COUNT(*) as count
FROM get_schedules_with_details();
