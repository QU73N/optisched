-- Check if trigger exists
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgenabled as enabled
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- Check if function exists
SELECT 
    proname as function_name,
    prokind as function_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND proname = 'handle_new_user';

-- Show function definition
SELECT pg_get_functiondef(pg_proc.oid) as function_definition
FROM pg_proc
JOIN pg_namespace n ON pg_proc.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND proname = 'handle_new_user';
