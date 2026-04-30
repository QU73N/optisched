-- Verify RPC functions have correct structure
SELECT 
    routine_name,
    routine_type,
    external_language,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('get_teachers_with_profiles', 'get_schedules_with_details')
ORDER BY routine_name;
