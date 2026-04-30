-- List all public functions
SELECT 
    routine_name,
    routine_type,
    external_language,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;
