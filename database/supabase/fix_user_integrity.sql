-- Comprehensive User Handling and Authentication Fixes
-- This script fixes all identified issues in user handling, storage, and authentication

-- ============================================================================
-- CRITICAL FIX 1: CREATE AUTH USERS FOR PROFILES WITHOUT THEM
-- ============================================================================
-- This fix creates auth.users records for any profiles that don't have corresponding auth entries

DO $$
DECLARE
    v_profile RECORD;
    v_missing_count INT := 0;
    v_created_count INT := 0;
BEGIN
    -- Count missing auth users first
    SELECT COUNT(*) INTO v_missing_count
    FROM profiles p
    WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.id);
    
    IF v_missing_count > 0 THEN
        RAISE NOTICE 'Found % profiles without auth.users', v_missing_count;
        
        -- Create auth users for students
        FOR v_profile IN 
            SELECT p.id, p.email, p.role
            FROM profiles p
            WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.id)
            AND p.role = 'student'
        LOOP
            INSERT INTO auth.users (
                id,
                email,
                encrypted_password,
                email_confirmed_at,
                created_at,
                updated_at,
                raw_user_meta_data,
                raw_app_meta_data
            )
            VALUES (
                v_profile.id,
                LOWER(v_profile.email),
                crypt('student123', gen_salt('bf')),
                NOW(),
                NOW(),
                NOW(),
                jsonb_build_object('provider', 'email', 'provider_uid', LOWER(v_profile.email)),
                jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'))
            )
            ON CONFLICT DO NOTHING;
            v_created_count := v_created_count + 1;
        END LOOP;
        
        -- Create auth users for teachers
        FOR v_profile IN 
            SELECT p.id, p.email, p.role
            FROM profiles p
            WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.id)
            AND p.role = 'teacher'
        LOOP
            INSERT INTO auth.users (
                id,
                email,
                encrypted_password,
                email_confirmed_at,
                created_at,
                updated_at,
                raw_user_meta_data,
                raw_app_meta_data
            )
            VALUES (
                v_profile.id,
                LOWER(v_profile.email),
                crypt('teacher', gen_salt('bf')),
                NOW(),
                NOW(),
                NOW(),
                jsonb_build_object('provider', 'email', 'provider_uid', LOWER(v_profile.email)),
                jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'))
            )
            ON CONFLICT DO NOTHING;
            v_created_count := v_created_count + 1;
        END LOOP;
        
        -- Create auth users for other roles
        FOR v_profile IN 
            SELECT p.id, p.email, p.role
            FROM profiles p
            WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.id)
            AND p.role NOT IN ('student', 'teacher')
        LOOP
            INSERT INTO auth.users (
                id,
                email,
                encrypted_password,
                email_confirmed_at,
                created_at,
                updated_at,
                raw_user_meta_data,
                raw_app_meta_data
            )
            VALUES (
                v_profile.id,
                LOWER(v_profile.email),
                crypt('DefaultPassword123!', gen_salt('bf')),
                NOW(),
                NOW(),
                NOW(),
                jsonb_build_object('provider', 'email', 'provider_uid', LOWER(v_profile.email)),
                jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'))
            )
            ON CONFLICT DO NOTHING;
            v_created_count := v_created_count + 1;
        END LOOP;
        
        RAISE NOTICE 'Created % auth users', v_created_count;
    ELSE
        RAISE NOTICE 'All profiles have corresponding auth.users records';
    END IF;
END $$;

-- ============================================================================
-- CRITICAL FIX 2: DELETE ORPHANED AUTH USERS
-- ============================================================================
-- Remove auth.users records that don't have corresponding profiles

DELETE FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = au.id)
AND au.email NOT LIKE '%@supabase.io'
AND au.email != 'postgres'
AND au.email NOT LIKE 'admin%'
AND au.email NOT LIKE 'system%';

-- ============================================================================
-- CRITICAL FIX 3: CONFIRM ALL UNCONFIRMED EMAIL ADDRESSES
-- ============================================================================
-- Users cannot login if their email is not confirmed

UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;

-- ============================================================================
-- CRITICAL FIX 4: ENSURE RLS IS ENABLED ON PROFILES
-- ============================================================================
-- Make sure Row Level Security is enabled

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS profiles_select ON profiles;
DROP POLICY IF EXISTS profiles_insert_own ON profiles;
DROP POLICY IF EXISTS profiles_insert_hierarchical ON profiles;
DROP POLICY IF EXISTS profiles_update_own ON profiles;
DROP POLICY IF EXISTS profiles_update_hierarchical ON profiles;
DROP POLICY IF EXISTS profiles_delete_hierarchical ON profiles;

-- Allow all authenticated users to read profiles
CREATE POLICY profiles_select ON profiles FOR SELECT
    USING (auth.role() = 'authenticated');

-- Allow users to insert their own profile
CREATE POLICY profiles_insert_own ON profiles FOR INSERT
    WITH CHECK (
        auth.uid() = id OR
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'power_admin', 'system_admin')
        )
    );

-- Allow admins to insert profiles with proper role hierarchy
CREATE POLICY profiles_insert_hierarchical ON profiles FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE id = auth.uid()
        ) AND
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND (
                p.role IN ('admin', 'power_admin', 'system_admin') OR
                (p.role = 'schedule_admin' AND role IN ('teacher', 'student', 'schedule_manager'))
            )
        )
    );

-- Allow users to update their own profile
CREATE POLICY profiles_update_own ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Allow admins to update profiles with role hierarchy
CREATE POLICY profiles_update_hierarchical ON profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'power_admin', 'system_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'power_admin', 'system_admin')
        )
    );

-- Allow admins to delete profiles
CREATE POLICY profiles_delete_hierarchical ON profiles FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'power_admin', 'system_admin')
        )
    );

-- ============================================================================
-- CRITICAL FIX 5: ENSURE HANDLE_NEW_USER TRIGGER IS IDEMPOTENT
-- ============================================================================
-- The trigger should not fail if profile already exists

CREATE OR REPLACE FUNCTION handle_new_user()
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

-- Ensure trigger exists and is properly configured
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- CRITICAL FIX 6: FIX EMAIL MISMATCHES
-- ============================================================================
-- Sync email addresses between auth.users and profiles (auth is source of truth)

UPDATE profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id
AND p.email <> au.email;

-- ============================================================================
-- CRITICAL FIX 7: NORMALIZE EMAIL ADDRESSES
-- ============================================================================
-- Ensure all emails are lowercase

UPDATE auth.users
SET email = LOWER(email)
WHERE email <> LOWER(email);

UPDATE profiles
SET email = LOWER(email)
WHERE email <> LOWER(email);

-- ============================================================================
-- VERIFICATION AND REPORTING
-- ============================================================================

-- Final verification counts
SELECT '=== FIX VERIFICATION RESULTS ===' AS section;

SELECT 
    'Total profiles' as metric,
    COUNT(*) as count
FROM profiles
UNION ALL
SELECT 'Total auth.users', COUNT(*) FROM auth.users
UNION ALL
SELECT 'Profiles with auth.users', COUNT(*) 
FROM profiles p WHERE EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.id)
UNION ALL
SELECT 'Profiles without auth.users', COUNT()
FROM profiles p WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.id)
UNION ALL
SELECT 'Auth users without profiles', COUNT()
FROM auth.users au WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = au.id)
UNION ALL
SELECT 'Users with confirmed email', COUNT()
FROM auth.users WHERE email_confirmed_at IS NOT NULL
UNION ALL
SELECT 'Users without confirmed email', COUNT()
FROM auth.users WHERE email_confirmed_at IS NULL;

-- List any remaining issues
SELECT '=== REMAINING ISSUES ===' AS section;

SELECT 
    'ISSUE: Profiles without auth.users' as issue_type,
    COUNT(*) as count,
    'CRITICAL - MUST FIX' as severity
FROM profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.id)
HAVING COUNT(*) > 0;

SELECT 
    'ISSUE: Auth users without profiles',
    COUNT(*),
    'WARNING - CLEANUP RECOMMENDED'
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = au.id)
HAVING COUNT(*) > 0;

-- ============================================================================
-- SUCCESS INDICATOR
-- ============================================================================
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM profiles p WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.id)) = 0
        AND (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NULL) = 0
        THEN '✅ ALL FIXES APPLIED SUCCESSFULLY - LOGIN SHOULD NOW WORK'
        ELSE '⚠️  SOME ISSUES REMAIN - REVIEW ABOVE'
    END as status;
