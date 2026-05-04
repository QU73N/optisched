-- Fix function search paths with correct signatures
-- This script sets search_path = public for all public functions

DO $$
DECLARE
    func_record RECORD;
    func_signature text;
BEGIN
    FOR func_record IN 
        SELECT 
            p.proname,
            pg_get_function_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
        AND p.prokind = 'f'
    LOOP
        BEGIN
            func_signature := format('public.%I(%s)', func_record.proname, func_record.args);
            EXECUTE format('ALTER FUNCTION %s SET search_path = public', func_signature);
            RAISE NOTICE 'Fixed search path for: %', func_signature;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not fix search path for: % - %', func_signature, SQLERRM;
            CONTINUE;
        END;
    END LOOP;
END $$;
