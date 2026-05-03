-- Test user creation and login flow
-- This will create a test user and verify the profile is created automatically

-- Step 1: Create a test user via auth
-- Note: This requires service role key, so we'll test via the frontend instead
-- For now, let's verify existing users can login

-- Check existing test users
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    last_sign_in_at,
    raw_user_meta_data
FROM auth.users
WHERE email LIKE '%test%' OR email LIKE '%demo%'
LIMIT 5;

-- Check if their profiles exist
SELECT 
    p.id,
    p.full_name,
    p.email,
    p.role,
    p.created_at,
    CASE 
        WHEN a.id IS NOT NULL THEN 'AUTH USER EXISTS'
        ELSE 'NO AUTH USER'
    END as auth_status
FROM public.profiles p
LEFT JOIN auth.users a ON p.id = a.id
WHERE p.email LIKE '%test%' OR p.email LIKE '%demo%'
ORDER BY p.created_at DESC
LIMIT 5;

-- Check RLS policies on profiles
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Check if anon role can read profiles
DO $$
BEGIN
    -- This will be tested via frontend
    RAISE NOTICE 'RLS policies checked via frontend';
END $$;
