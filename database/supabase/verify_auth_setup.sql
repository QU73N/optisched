-- Comprehensive verification of authentication setup

-- 1. Check if profile creation trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%profile%'
   OR trigger_name LIKE '%auth%'
ORDER BY trigger_name;

-- 2. Check profiles table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 3. Check for any RLS policies on profiles
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 4. Check auth.users to see if there are any users
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    last_sign_in_at,
    raw_user_meta_data
FROM auth.users
LIMIT 5;

-- 5. Check profiles to see if they match auth users
SELECT 
    p.id,
    p.full_name,
    p.email,
    p.role,
    p.created_at,
    a.email as auth_email,
    a.created_at as auth_created_at,
    CASE 
        WHEN a.email = p.email THEN 'MATCH'
        ELSE 'MISMATCH'
    END as email_match
FROM public.profiles p
LEFT JOIN auth.users a ON p.id = a.id
ORDER BY p.created_at DESC
LIMIT 10;

-- 6. Check for orphaned profiles (profile without auth user)
SELECT 
    id,
    full_name,
    email,
    role,
    created_at
FROM public.profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users a WHERE a.id = p.id
);

-- 7. Check for orphaned auth users (auth user without profile)
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    last_sign_in_at
FROM auth.users a
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = a.id
);

-- 8. Verify profile creation trigger function
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname LIKE '%profile%'
OR p.proname LIKE '%auth%'
OR p.proname LIKE '%user%';
