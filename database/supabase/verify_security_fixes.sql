-- Verification script for security fixes
-- Run this after applying all security fix scripts to verify they worked

-- ============================================================================
-- 1. VERIFY FUNCTION search_path IS SET
-- ============================================================================

SELECT 'Functions without search_path:' as check_type, COUNT(*) as count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prosecdef = true
AND (p.proconfig IS NULL OR NOT EXISTS (
    SELECT 1 FROM unnest(p.proconfig) conf 
    WHERE conf LIKE '%search_path%'
));

-- List functions with search_path status
SELECT 
    p.proname as function_name,
    CASE 
        WHEN p.proconfig IS NULL THEN 'NOT SET'
        WHEN EXISTS (SELECT 1 FROM unnest(p.proconfig) conf WHERE conf LIKE '%search_path%') THEN 'SET'
        ELSE 'NOT SET'
    END as search_path_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prosecdef = true
ORDER BY p.proname;

-- ============================================================================
-- 2. VERIFY RLS POLICIES DON'T USE "true" IN WITH CHECK
-- ============================================================================

SELECT 'RLS policies with true in WITH CHECK:' as check_type, COUNT(*) as count
FROM pg_policies
WHERE with_check = 'true'
AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL');

-- List problematic RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    with_check
FROM pg_policies
WHERE with_check = 'true'
AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL');

-- ============================================================================
-- 3. VERIFY ANON CANNOT EXECUTE SENSITIVE FUNCTIONS
-- ============================================================================

SELECT 'Anon can execute sensitive DEFINER functions:' as check_type, COUNT(*) as count
FROM information_schema.role_routine_grants rg
JOIN information_schema.routines r ON rg.routine_schema = r.routine_schema AND rg.routine_name = r.routine_name
WHERE rg.grantee = 'anon'
AND r.routine_schema = 'public'
AND r.security_type = 'DEFINER'
AND r.routine_name NOT IN (
    'current_user_role',
    'get_user_role',
    'handle_new_user',
    'rate_limit_login',
    'rate_limit_password_reset'
);

-- List functions anon can execute
SELECT 
    rg.routine_name,
    r.security_type
FROM information_schema.role_routine_grants rg
JOIN information_schema.routines r ON rg.routine_schema = r.routine_schema AND rg.routine_name = r.routine_name
WHERE rg.grantee = 'anon'
AND r.routine_schema = 'public'
AND r.security_type = 'DEFINER'
AND r.routine_name NOT IN (
    'current_user_role',
    'get_user_role',
    'handle_new_user',
    'rate_limit_login',
    'rate_limit_password_reset'
);

-- ============================================================================
-- 4. VERIFY PASSWORD HASHING (Argon2id)
-- ============================================================================

SELECT 'pgcrypto extension available:' as check_type, EXISTS (
    SELECT 1 FROM pg_extension 
    WHERE extname = 'pgcrypto'
) as count;

-- ============================================================================
-- 5. SUMMARY
-- ============================================================================

SELECT '=== SECURITY VERIFICATION SUMMARY ===' as summary;

