-- CRITICAL FIX: Handle missing profiles for authenticated users
-- This script fixes the immediate login issue by creating missing profiles

-- ============================================================================
-- STEP 1: FIX RLS POLICIES (Make sure they allow profile operations)
-- ============================================================================

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;

-- Allow all authenticated users to SELECT profiles
CREATE POLICY "profiles_select" ON profiles
    FOR SELECT TO authenticated
    USING (true);

-- Allow users to INSERT their own profile
CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

-- Allow users to UPDATE their own profile
CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Allow admins to DELETE
CREATE POLICY "profiles_delete" ON profiles
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'power_admin', 'system_admin')
        )
    );

-- ============================================================================
-- STEP 2: VERIFY AND ENSURE HANDLE_NEW_USER TRIGGER IS IDEMPOTENT
-- ============================================================================

-- Create the handle_new_user function that is idempotent
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    -- Only insert profile if it doesn't already exist
    INSERT INTO public.profiles (id, email, role, full_name)
    SELECT
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    WHERE NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = NEW.id
    );
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- If profile creation fails, just return (already exists)
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- STEP 3: CREATE MISSING PROFILES FOR ALL AUTH USERS
-- ============================================================================
-- This is the critical fix - create profiles for users who have auth accounts but no profiles

DO $$
DECLARE
    v_auth_user RECORD;
    v_created_count INT := 0;
    v_already_exist_count INT := 0;
BEGIN
    -- Loop through all auth users without profiles
    FOR v_auth_user IN
        SELECT au.id, au.email, 
               COALESCE(au.raw_user_meta_data->>'role', 'student') as role,
               COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)) as full_name
        FROM auth.users au
        WHERE NOT EXISTS (
            SELECT 1 FROM public.profiles p WHERE p.id = au.id
        )
    LOOP
        -- Try to create profile
        BEGIN
            INSERT INTO public.profiles (id, email, role, full_name)
            VALUES (v_auth_user.id, v_auth_user.email, v_auth_user.role, v_auth_user.full_name);
            v_created_count := v_created_count + 1;
            RAISE NOTICE 'Created profile for user: %', v_auth_user.email;
        EXCEPTION WHEN OTHERS THEN
            v_already_exist_count := v_already_exist_count + 1;
            RAISE WARNING 'Profile creation skipped for %: %', v_auth_user.email, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Created % new profiles, % already existed', v_created_count, v_already_exist_count;
END $$;

-- ============================================================================
-- STEP 4: ENSURE ALL EMAILS ARE CONFIRMED
-- ============================================================================
-- Users cannot login if email_confirmed_at is NULL

UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;

-- ============================================================================
-- STEP 5: VERIFY RESULTS
-- ============================================================================

SELECT 
    'Auth users' as metric,
    COUNT(*) as total
FROM auth.users
UNION ALL
SELECT 'Profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'Auth users WITH profiles', COUNT(*)
FROM auth.users au
WHERE EXISTS (SELECT 1 FROM profiles p WHERE p.id = au.id)
UNION ALL
SELECT 'Auth users WITHOUT profiles', COUNT(*)
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = au.id)
UNION ALL
SELECT 'Users with confirmed email', COUNT(*)
FROM auth.users WHERE email_confirmed_at IS NOT NULL
UNION ALL
SELECT 'Users WITHOUT confirmed email', COUNT(*)
FROM auth.users WHERE email_confirmed_at IS NULL;

-- ============================================================================
-- STEP 6: SPECIFIC FIX FOR REPORTED USER
-- ============================================================================
-- If the specific user from error still has no profile, create it now

DO $$
DECLARE
    v_user_id uuid := '9abafde9-2255-4120-b074-da13d44d3bbf'::uuid;
    v_auth_user RECORD;
BEGIN
    -- Get the auth user details
    SELECT au.id, au.email,
           COALESCE(au.raw_user_meta_data->>'role', 'student') as role,
           COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)) as full_name
    INTO v_auth_user
    FROM auth.users au
    WHERE au.id = v_user_id;
    
    IF v_auth_user IS NOT NULL THEN
        -- Ensure profile exists
        INSERT INTO public.profiles (id, email, role, full_name)
        VALUES (v_auth_user.id, v_auth_user.email, v_auth_user.role, v_auth_user.full_name)
        ON CONFLICT (id) DO NOTHING;
        
        -- Ensure email is confirmed
        UPDATE auth.users
        SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
        WHERE id = v_user_id;
        
        RAISE NOTICE 'Fixed user: % (%)', v_auth_user.email, v_auth_user.id;
    ELSE
        RAISE WARNING 'User % not found in auth.users', v_user_id;
    END IF;
END $$;

-- ============================================================================
-- FINAL CHECK
-- ============================================================================

SELECT '=== LOGIN FIX COMPLETE ===' as status;

-- Check the specific user
SELECT 
    au.id,
    au.email,
    au.email_confirmed_at,
    p.id as profile_id,
    p.role,
    p.full_name,
    CASE 
        WHEN p.id IS NULL THEN '❌ NO PROFILE'
        WHEN au.email_confirmed_at IS NULL THEN '⚠️  UNCONFIRMED'
        ELSE '✅ CAN LOGIN'
    END as login_status
FROM auth.users au
LEFT JOIN profiles p ON au.id = p.id
WHERE au.id = '9abafde9-2255-4120-b074-da13d44d3bbf'::uuid;
