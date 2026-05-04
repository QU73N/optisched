-- Fix: Create auth.users records for profiles that don't have them
-- This script creates auth.users records for all profiles without corresponding auth entries
-- Default passwords: "student123" for students, "teacher" for teachers

-- First, let's verify the issue
SELECT 'Profiles without auth.users' as check, COUNT(*) as count
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE au.id IS NULL;

-- Modify the handle_new_user trigger to be idempotent (skip if profile already exists)
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create auth.user record with password
-- This function uses the auth.users table directly (requires service role key)
CREATE OR REPLACE FUNCTION create_auth_user_for_profile(
    p_user_id uuid,
    p_email text,
    p_password text
)
RETURNS void AS $$
DECLARE
    v_meta_data jsonb;
    v_app_meta_data jsonb;
BEGIN
    v_meta_data := jsonb_build_object(
        'provider', 'email',
        'provider_uid', lower(p_email)
    );
    
    v_app_meta_data := jsonb_build_object(
        'provider', 'email',
        'providers', jsonb_build_array('email')
    );
    
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
        p_user_id,
        lower(p_email),
        crypt(p_password, gen_salt('bf')),
        now(),
        now(),
        now(),
        v_meta_data,
        v_app_meta_data
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create auth.users for all student accounts without them
DO $$
DECLARE
    v_profile RECORD;
BEGIN
    FOR v_profile IN 
        SELECT p.id, p.email
        FROM profiles p
        LEFT JOIN auth.users au ON p.id = au.id
        WHERE au.id IS NULL 
        AND p.role = 'student'
    LOOP
        PERFORM create_auth_user_for_profile(v_profile.id, v_profile.email, 'student123');
        RAISE NOTICE 'Created auth user for student: %', v_profile.email;
    END LOOP;
END $$;

-- Create auth.users for all teacher accounts without them
DO $$
DECLARE
    v_profile RECORD;
BEGIN
    FOR v_profile IN 
        SELECT p.id, p.email
        FROM profiles p
        LEFT JOIN auth.users au ON p.id = au.id
        WHERE au.id IS NULL 
        AND p.role = 'teacher'
    LOOP
        PERFORM create_auth_user_for_profile(v_profile.id, v_profile.email, 'teacher');
        RAISE NOTICE 'Created auth user for teacher: %', v_profile.email;
    END LOOP;
END $$;

-- Verify the fix
SELECT 'Profiles without auth.users after fix' as check, COUNT(*) as count
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE au.id IS NULL;

-- Show summary
SELECT 'Total profiles' as summary, COUNT(*) as count FROM profiles
UNION ALL
SELECT 'Total auth.users', COUNT(*) FROM auth.users
UNION ALL
SELECT 'Profiles with auth.users', COUNT(*) FROM profiles p WHERE EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.id);

-- Clean up the helper function
DROP FUNCTION IF EXISTS create_auth_user_for_profile(uuid, text, text);
