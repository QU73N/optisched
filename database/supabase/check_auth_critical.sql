-- Critical authentication checks

-- 1. Check profile creation trigger
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'on_auth_user_created'
    ) THEN
        RAISE NOTICE '✓ Trigger on_auth_user_created exists';
    ELSE
        RAISE NOTICE '✗ Trigger on_auth_user_created MISSING';
    END IF;
END $$;

-- 2. Check handle_new_user function
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'handle_new_user'
    ) THEN
        RAISE NOTICE '✓ Function handle_new_user exists';
    ELSE
        RAISE NOTICE '✗ Function handle_new_user MISSING';
    END IF;
END $$;

-- 3. Count auth users vs profiles
SELECT 
    (SELECT COUNT(*) FROM auth.users) as auth_users_count,
    (SELECT COUNT(*) FROM public.profiles) as profiles_count,
    CASE 
        WHEN (SELECT COUNT(*) FROM auth.users) = (SELECT COUNT(*) FROM public.profiles) 
        THEN 'MATCH'
        ELSE 'MISMATCH'
    END as status;

-- 4. Check for orphaned records
SELECT 'Orphaned profiles (no auth user)' as check_type, COUNT(*) as count
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = p.id)

UNION ALL

SELECT 'Orphaned auth users (no profile)' as check_type, COUNT(*) as count
FROM auth.users a
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = a.id);

-- 5. Check recent profile creations
SELECT 
    p.id,
    p.full_name,
    p.email,
    p.role,
    p.created_at,
    a.email_confirmed_at,
    a.last_sign_in_at
FROM public.profiles p
JOIN auth.users a ON p.id = a.id
ORDER BY p.created_at DESC
LIMIT 5;
