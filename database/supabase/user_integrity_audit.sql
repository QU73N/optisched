-- Comprehensive User Integrity and Authentication Audit
-- This script performs a full audit of user handling, storage, and authentication integrity

-- ============================================================================
-- SECTION 1: BASIC INVENTORY CHECK
-- ============================================================================
SELECT '=== SECTION 1: BASIC INVENTORY ===' AS audit_section;

SELECT 'Total auth.users' as check_name, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'Total profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'Profiles with auth.users match', COUNT(*) FROM profiles p 
    WHERE EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.id)
UNION ALL
SELECT 'Profiles WITHOUT auth.users', COUNT(*) FROM profiles p 
    WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.id)
UNION ALL
SELECT 'Auth.users WITHOUT profiles', COUNT(*) FROM auth.users au 
    WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = au.id);

-- ============================================================================
-- SECTION 2: PROFILES WITHOUT AUTH USERS (CRITICAL)
-- ============================================================================
SELECT '=== SECTION 2: PROFILES WITHOUT AUTH USERS ===' AS audit_section;

SELECT 
    p.id,
    p.email,
    p.role,
    p.full_name,
    p.created_at,
    'MISSING AUTH USER' as issue
FROM profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.id)
ORDER BY p.created_at DESC;

-- ============================================================================
-- SECTION 3: AUTH USERS WITHOUT PROFILES (DATA INCONSISTENCY)
-- ============================================================================
SELECT '=== SECTION 3: AUTH USERS WITHOUT PROFILES ===' AS audit_section;

SELECT 
    au.id,
    au.email,
    au.email_confirmed_at,
    au.created_at,
    au.updated_at,
    'ORPHANED AUTH USER' as issue
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = au.id)
ORDER BY au.created_at DESC;

-- ============================================================================
-- SECTION 4: EMAIL CONSISTENCY CHECK
-- ============================================================================
SELECT '=== SECTION 4: EMAIL CONSISTENCY ===' AS audit_section;

SELECT 
    p.id,
    p.email as profile_email,
    au.email as auth_email,
    CASE 
        WHEN p.email = au.email THEN 'MATCH'
        ELSE 'MISMATCH' 
    END as email_status
FROM profiles p
JOIN auth.users au ON p.id = au.id
WHERE p.email <> au.email;

-- If no rows, all emails match (good)
SELECT COUNT(*) as email_mismatch_count
FROM profiles p
JOIN auth.users au ON p.id = au.id
WHERE p.email <> au.email;

-- ============================================================================
-- SECTION 5: EMAIL CONFIRMATION STATUS
-- ============================================================================
SELECT '=== SECTION 5: EMAIL CONFIRMATION ===' AS audit_section;

SELECT 
    'Auth users with email confirmed' as check_name,
    COUNT(*) as count
FROM auth.users
WHERE email_confirmed_at IS NOT NULL
UNION ALL
SELECT 
    'Auth users WITHOUT email confirmed',
    COUNT(*)
FROM auth.users
WHERE email_confirmed_at IS NULL;

-- Show which users cannot login due to unconfirmed email
SELECT 
    au.id,
    au.email,
    'CANNOT LOGIN - UNCONFIRMED EMAIL' as issue
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE au.email_confirmed_at IS NULL
ORDER BY au.created_at DESC;

-- ============================================================================
-- SECTION 6: ROLE CONSISTENCY
-- ============================================================================
SELECT '=== SECTION 6: ROLE CONSISTENCY ===' AS audit_section;

SELECT 
    role,
    COUNT(*) as profile_count
FROM profiles
GROUP BY role
ORDER BY profile_count DESC
UNION ALL
SELECT 
    'TOTAL',
    COUNT(*)
FROM profiles;

-- Check for invalid roles
SELECT DISTINCT role FROM profiles WHERE role NOT IN (
    'student', 'teacher', 'admin', 'power_admin', 'system_admin', 
    'schedule_admin', 'schedule_manager'
);

-- ============================================================================
-- SECTION 7: TRIGGER VERIFICATION
-- ============================================================================
SELECT '=== SECTION 7: TRIGGER VERIFICATION ===' AS audit_section;

-- Check if handle_new_user trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created'
   OR trigger_name ILIKE '%handle%'
   OR event_object_table = 'users';

-- ============================================================================
-- SECTION 8: RLS POLICIES CHECK
-- ============================================================================
SELECT '=== SECTION 8: RLS POLICIES ===' AS audit_section;

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    qual as condition,
    with_check as check_condition
FROM pg_policies
WHERE tablename IN ('profiles', 'users')
ORDER BY tablename, policyname;

-- Verify RLS is enabled on profiles table
SELECT 
    relname,
    relrowsecurity
FROM pg_class
WHERE relname = 'profiles';

-- ============================================================================
-- SECTION 9: PASSWORD INTEGRITY (encrypted passwords exist)
-- ============================================================================
SELECT '=== SECTION 9: PASSWORD INTEGRITY ===' AS audit_section;

SELECT 
    'Auth users with encrypted password' as check_name,
    COUNT(*) as count
FROM auth.users
WHERE encrypted_password IS NOT NULL AND encrypted_password <> ''
UNION ALL
SELECT 
    'Auth users WITHOUT encrypted password',
    COUNT(*)
FROM auth.users
WHERE encrypted_password IS NULL OR encrypted_password = '';

-- ============================================================================
-- SECTION 10: ACCOUNT STATUS CHECK
-- ============================================================================
SELECT '=== SECTION 10: ACCOUNT STATUS ===' AS audit_section;

-- Users who can login (confirmed email)
SELECT 
    'LOGINABLE: Confirmed email' as status,
    COUNT(*) as count
FROM auth.users
WHERE email_confirmed_at IS NOT NULL;

-- Users who cannot login (unconfirmed email)
SELECT 
    'NOT LOGINABLE: Unconfirmed email' as status,
    COUNT(*) as count
FROM auth.users
WHERE email_confirmed_at IS NULL;

-- ============================================================================
-- SECTION 11: DUPLICATE EMAIL CHECK
-- ============================================================================
SELECT '=== SECTION 11: DUPLICATE EMAIL CHECK ===' AS audit_section;

-- Check for duplicate emails in profiles
SELECT 
    email,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(id) as user_ids
FROM profiles
GROUP BY email
HAVING COUNT(*) > 1;

-- Check for duplicate emails in auth.users
SELECT 
    email,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(id) as user_ids
FROM auth.users
GROUP BY email
HAVING COUNT(*) > 1;

-- ============================================================================
-- SECTION 12: MISSING DATA INTEGRITY
-- ============================================================================
SELECT '=== SECTION 12: MISSING DATA INTEGRITY ===' AS audit_section;

-- Profiles with missing required fields
SELECT 
    id,
    email,
    full_name,
    role,
    CASE 
        WHEN email IS NULL THEN 'missing email'
        WHEN full_name IS NULL THEN 'missing full_name'
        WHEN role IS NULL THEN 'missing role'
        ELSE 'incomplete'
    END as missing_field
FROM profiles
WHERE email IS NULL OR full_name IS NULL OR role IS NULL;

-- ============================================================================
-- SECTION 13: CREATION TIMESTAMP CONSISTENCY
-- ============================================================================
SELECT '=== SECTION 13: TIMESTAMP ANALYSIS ===' AS audit_section;

SELECT 
    'Profiles created' as check_name,
    MIN(created_at) as earliest,
    MAX(created_at) as latest,
    COUNT(*) as total
FROM profiles
UNION ALL
SELECT 
    'Auth users created',
    MIN(created_at),
    MAX(created_at),
    COUNT(*)
FROM auth.users;

-- ============================================================================
-- SECTION 14: SUMMARY AND RECOMMENDATIONS
-- ============================================================================
SELECT '=== SECTION 14: AUDIT SUMMARY ===' AS audit_section;

-- Count all issues found
WITH issues AS (
    SELECT 'Profiles without auth.users' as issue_type, COUNT(*) as count
    FROM profiles p
    WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.id)
    UNION ALL
    SELECT 'Auth users without profiles', COUNT(*)
    FROM auth.users au
    WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = au.id)
    UNION ALL
    SELECT 'Unconfirmed email addresses', COUNT(*)
    FROM auth.users
    WHERE email_confirmed_at IS NULL
    UNION ALL
    SELECT 'Email mismatches', COUNT(*)
    FROM profiles p
    JOIN auth.users au ON p.id = au.id
    WHERE p.email <> au.email
    UNION ALL
    SELECT 'Duplicate emails in profiles', COUNT(*)
    FROM (
        SELECT email FROM profiles GROUP BY email HAVING COUNT(*) > 1
    ) t
    UNION ALL
    SELECT 'Duplicate emails in auth.users', COUNT(*)
    FROM (
        SELECT email FROM auth.users GROUP BY email HAVING COUNT(*) > 1
    ) t
)
SELECT 
    COALESCE(issue_type, 'TOTAL ISSUES') as audit_item,
    COALESCE(SUM(count), 0) as issue_count
FROM issues
GROUP BY ROLLUP (issue_type)
ORDER BY GROUPING(issue_type), issue_count DESC;

-- ============================================================================
-- FINAL VERIFICATION STATEMENT
-- ============================================================================
SELECT '=== AUDIT COMPLETE ===' AS final_statement;
