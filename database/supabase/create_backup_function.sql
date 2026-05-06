-- ============================================================================
-- COMPREHENSIVE DATABASE BACKUP FUNCTION
-- Exports all tables to JSON for backup and restore
-- ============================================================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS public.create_database_backup(p_backup_job_id UUID, p_kind TEXT, p_note TEXT);

-- Create comprehensive backup function
CREATE OR REPLACE FUNCTION public.create_database_backup(
    p_backup_job_id UUID,
    p_kind TEXT DEFAULT 'full',
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_backup_data JSONB;
    v_table_name TEXT;
    v_table_data JSONB;
    v_row_count INTEGER;
    v_backup_size INTEGER;
    v_file_path TEXT;
    v_timestamp TEXT;
    v_columns TEXT;
BEGIN
    -- Set timestamp
    v_timestamp := to_char(now(), 'YYYY-MM-DD HH24:MI:SS');
    
    -- Initialize backup structure
    v_backup_data := jsonb_build_object(
        'metadata', jsonb_build_object(
            'backup_id', gen_random_uuid(),
            'timestamp', v_timestamp,
            'kind', p_kind,
            'note', p_note,
            'version', '1.0'
        ),
        'tables', '{}'::jsonb,
        'table_counts', '{}'::jsonb
    );
    
    -- Backup each table
    FOR v_table_name IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT IN ('backup_jobs', 'audit_logs', 'user_activity_logs', 'client_error_logs')
        ORDER BY table_name
    LOOP
        BEGIN
            -- Get column names for this table
            SELECT string_agg(column_name, ', ')
            INTO v_columns
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = v_table_name
            ORDER BY ordinal_position;
            
            -- Get table data as JSON
            EXECUTE format('
                SELECT jsonb_agg(jsonb_build_object(%s))
                FROM (SELECT %s FROM public.%I) t
            ', v_columns, v_columns, v_table_name) INTO v_table_data;
            
            -- Get row count
            EXECUTE format('SELECT COUNT(*) FROM public.%I', v_table_name) INTO v_row_count;
            
            -- Add to backup (skip if empty)
            IF v_table_data IS NOT NULL AND jsonb_array_length(v_table_data) > 0 THEN
                v_backup_data := jsonb_set(
                    v_backup_data,
                    array['tables', v_table_name],
                    v_table_data
                );
            END IF;
            
            -- Add row count
            v_backup_data := jsonb_set(
                v_backup_data,
                array['table_counts', v_table_name],
                to_jsonb(v_row_count)
            );
            
        EXCEPTION WHEN OTHERS THEN
            -- Log error but continue with other tables
            RAISE NOTICE 'Error backing up table %: %', v_table_name, SQLERRM;
        END;
    END LOOP;
    
    -- Calculate backup size
    v_backup_size := pg_column_size(v_backup_data);
    
    -- Generate file path (simulated - in production, store in storage bucket)
    v_file_path := format('backups/optisched_backup_%s.json', replace(v_timestamp, ' ', '_'));
    
    -- Update backup job
    UPDATE public.backup_jobs
    SET 
        status = 'succeeded',
        started_at = now(),
        finished_at = now(),
        file_path = v_file_path,
        size_bytes = v_backup_size
    WHERE id = p_backup_job_id;
    
    -- Return backup data
    RETURN v_backup_data;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_database_backup(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_database_backup(UUID, TEXT, TEXT) TO service_role;

-- ============================================================================
-- RESTORE FUNCTION
-- Restores database from backup JSON
-- Note: This is a simplified restore that works for most cases
-- For complex restores, use application-level restore logic
-- ============================================================================

DROP FUNCTION IF EXISTS public.restore_database_backup(p_backup_data JSONB);

CREATE OR REPLACE FUNCTION public.restore_database_backup(
    p_backup_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_metadata JSONB;
    v_tables JSONB;
    v_table_name TEXT;
    v_table_data JSONB;
    v_row JSONB;
    v_result JSONB;
    v_restored_count INTEGER;
BEGIN
    -- Extract metadata
    v_metadata := p_backup_data->'metadata';
    v_tables := p_backup_data->'tables';
    
    -- Initialize result
    v_result := jsonb_build_object(
        'success', true,
        'message', 'Restore completed',
        'restored_tables', '{}'::jsonb,
        'errors', '[]'::jsonb
    );
    
    -- Restore each table
    FOR v_table_name IN SELECT jsonb_object_keys(v_tables)
    LOOP
        BEGIN
            v_table_data := v_tables->v_table_name;
            v_restored_count := 0;
            
            -- Clear existing data (skip for certain tables)
            IF v_table_name NOT IN ('profiles', 'backup_jobs') THEN
                EXECUTE format('DELETE FROM public.%I', v_table_name);
            END IF;
            
            -- Insert each row using JSONB
            FOR v_row IN SELECT jsonb_array_elements(v_table_data)
            LOOP
                BEGIN
                    -- For tables with JSONB data, use jsonb_to_record
                    IF v_table_name IN ('schedule_versions', 'schedule_version_sets') THEN
                        EXECUTE format('
                            INSERT INTO public.%I 
                            SELECT * FROM jsonb_to_record(%L) AS t(data JSONB)
                        ', v_table_name, v_row);
                    ELSE
                        -- For regular tables, use jsonb_populate_record
                        EXECUTE format('
                            INSERT INTO public.%I 
                            SELECT (jsonb_populate_record(NULL::public.%I))(%L)
                        ', v_table_name, v_table_name, v_row);
                    END IF;
                    v_restored_count := v_restored_count + 1;
                EXCEPTION WHEN OTHERS THEN
                    -- Log error but continue
                    v_result := jsonb_set(
                        v_result,
                        array['errors'],
                        (v_result->'errors') || to_jsonb(jsonb_build_object(
                            'table', v_table_name,
                            'error', SQLERRM
                        ))
                    );
                END;
            END LOOP;
            
            -- Add to result
            v_result := jsonb_set(
                v_result,
                array['restored_tables', v_table_name],
                to_jsonb(v_restored_count)
            );
            
        EXCEPTION WHEN OTHERS THEN
            v_result := jsonb_set(
                v_result,
                array['errors'],
                (v_result->'errors') || to_jsonb(jsonb_build_object(
                    'table', v_table_name,
                    'error', SQLERRM
                ))
            );
        END;
    END LOOP;
    
    -- Check for errors
    IF jsonb_array_length(v_result->'errors') > 0 THEN
        v_result := jsonb_set(v_result, array['success'], to_jsonb(false));
        v_result := jsonb_set(v_result, array['message'], 'Restore completed with errors');
    END IF;
    
    RETURN v_result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.restore_database_backup(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_database_backup(JSONB) TO service_role;

-- ============================================================================
-- TRIGGER TO RUN BACKUP JOBS AUTOMATICALLY
-- ============================================================================

DROP TRIGGER IF EXISTS on_backup_job_insert ON public.backup_jobs;
DROP FUNCTION IF EXISTS public.process_backup_job();

CREATE OR REPLACE FUNCTION public.process_backup_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only process queued jobs
    IF NEW.status = 'queued' THEN
        -- Update to running
        UPDATE public.backup_jobs
        SET status = 'running', started_at = now()
        WHERE id = NEW.id;
        
        -- Execute backup
        PERFORM public.create_database_backup(NEW.id, NEW.kind, NEW.note);
    END IF;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_backup_job_insert
    AFTER INSERT ON public.backup_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.process_backup_job();

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if functions exist
SELECT 
    'Functions created' as status,
    proname as function_name
FROM pg_proc
WHERE proname IN ('create_database_backup', 'restore_database_backup', 'process_backup_job')
ORDER BY proname;

-- Check trigger exists
SELECT 
    'Trigger created' as status,
    tgname as trigger_name
FROM pg_trigger
WHERE tgname = 'on_backup_job_insert';
