-- Revoke EXECUTE on all SECURITY DEFINER functions from PUBLIC (which includes anon)
-- Then grant back to authenticated and service_role
DO $$
DECLARE
    func_record RECORD;
    func_signature text;
BEGIN
    FOR func_record IN 
        SELECT 
            p.proname,
            pg_get_function_arguments(p.oid) as args,
            p.prosecdef
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
        AND p.prokind = 'f'
        AND p.prosecdef = true
    LOOP
        BEGIN
            func_signature := format('public.%I(%s)', func_record.proname, func_record.args);
            EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', func_signature);
            EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', func_signature);
            RAISE NOTICE 'Fixed EXECUTE privileges for: %', func_signature;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not fix EXECUTE privileges for: % - %', func_signature, SQLERRM;
            CONTINUE;
        END;
    END LOOP;
END $$;
