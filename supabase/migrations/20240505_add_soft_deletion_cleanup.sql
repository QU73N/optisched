-- Migration: Soft Deletion Cleanup
-- Purpose: Implement automatic cleanup of soft-deleted schedules after 30 days
-- PRD Requirement: §15.4 - Schedules use soft deletion with automatic permanent deletion after 30 days

-- Create function to clean up soft-deleted schedules older than 30 days
CREATE OR REPLACE FUNCTION cleanup_soft_deleted_schedules()
RETURNS TABLE(
    cleaned_count BIGINT,
    details TEXT
) AS $$
DECLARE
    v_cleaned_count BIGINT;
    v_details TEXT;
    v_deleted_schedule_ids UUID[];
BEGIN
    -- Get IDs of schedules deleted more than 30 days ago
    SELECT ARRAY_AGG(id) INTO v_deleted_schedule_ids
    FROM public.schedules
    WHERE deleted_at IS NOT NULL
    AND deleted_at < NOW() - INTERVAL '30 days';
    
    -- If no schedules to clean up, return early
    IF v_deleted_schedule_ids IS NULL OR array_length(v_deleted_schedule_ids, 1) = 0 THEN
        v_cleaned_count := 0;
        v_details := 'No soft-deleted schedules older than 30 days found';
        RETURN QUERY SELECT v_cleaned_count, v_details;
        RETURN;
    END IF;
    
    -- Log the cleanup action before deletion
    INSERT INTO public.audit_logs (
        actor_id,
        actor_role,
        action,
        target_table,
        target_id,
        details,
        created_at
    )
    SELECT 
        NULL,
        'system',
        'soft_delete_cleanup',
        'schedules',
        id,
        jsonb_build_object(
            'reason', 'Automatic cleanup after 30-day retention period',
            'deleted_at', deleted_at,
            'deleted_by', deleted_by
        ),
        NOW()
    FROM unnest(v_deleted_schedule_ids) AS id
    JOIN public.schedules ON schedules.id = id;
    
    -- Permanently delete the schedules
    DELETE FROM public.schedule_versions
    WHERE schedule_id = ANY(v_deleted_schedule_ids);
    
    DELETE FROM public.schedules
    WHERE id = ANY(v_deleted_schedule_ids);
    
    GET DIAGNOSTICS v_cleaned_count = ROW_COUNT;
    
    v_details := format('Cleaned up %s soft-deleted schedules', v_cleaned_count);
    
    RETURN QUERY SELECT v_cleaned_count, v_details;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check soft-deleted schedule count
CREATE OR REPLACE FUNCTION get_soft_deleted_schedule_count()
RETURNS TABLE(
    total_count BIGINT,
    older_than_30_days BIGINT,
    details TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS total_count,
        COUNT(*) FILTER (WHERE deleted_at < NOW() - INTERVAL '30 days') AS older_than_30_days,
        format('Total soft-deleted: %s, Ready for cleanup: %s', 
            COUNT(*) FILTER (WHERE deleted_at IS NOT NULL),
            COUNT(*) FILTER (WHERE deleted_at < NOW() - INTERVAL '30 days')
        ) AS details
    FROM public.schedules;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_soft_deleted_schedules() TO authenticated;
GRANT EXECUTE ON FUNCTION get_soft_deleted_schedule_count() TO authenticated;

-- Create a view for monitoring soft-deleted schedules
CREATE OR REPLACE VIEW soft_deleted_schedules_monitor AS
SELECT 
    id,
    subject_id,
    teacher_id,
    room_id,
    section_id,
    day_of_week,
    start_time,
    end_time,
    semester,
    academic_year,
    status,
    deleted_at,
    deleted_by,
    EXTRACT(DAY FROM (NOW() - deleted_at)) AS days_since_deletion,
    CASE 
        WHEN deleted_at < NOW() - INTERVAL '30 days' THEN 'READY_FOR_CLEANUP'
        WHEN deleted_at < NOW() - INTERVAL '25 days' THEN 'APPROACHING_CLEANUP'
        ELSE 'ACTIVE_RETENTION'
    END AS cleanup_status
FROM public.schedules
WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC;

-- Grant select on view to authenticated users
GRANT SELECT ON soft_deleted_schedules_monitor TO authenticated;

-- Add comment to document the cleanup function
COMMENT ON FUNCTION cleanup_soft_deleted_schedules() IS 
'Automatically cleans up soft-deleted schedules that are older than 30 days. 
Logs each deletion to audit_logs before permanent deletion. 
Can be scheduled via pg_cron or run manually by Power Admins.';

COMMENT ON FUNCTION get_soft_deleted_schedule_count() IS 
'Returns count of soft-deleted schedules and how many are ready for cleanup (older than 30 days).';

COMMENT ON VIEW soft_deleted_schedules_monitor IS 
'Monitoring view for soft-deleted schedules with cleanup status. 
Shows days since deletion and cleanup readiness status.';

-- Create a policy to allow Power Admins to manually trigger cleanup
CREATE POLICY "Power admins can execute cleanup"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('power_admin', 'admin')
    )
    AND action = 'soft_delete_cleanup'
);

-- Verification query to check cleanup function works
DO $$
BEGIN
    RAISE NOTICE 'Soft deletion cleanup migration completed successfully';
    RAISE NOTICE 'Function cleanup_soft_deleted_schedules() created';
    RAISE NOTICE 'Function get_soft_deleted_schedule_count() created';
    RAISE NOTICE 'View soft_deleted_schedules_monitor created';
    RAISE NOTICE 'To schedule automatic cleanup, use pg_cron: SELECT cron.schedule(''schedule-cleanup'', ''0 2 * * *'', ''SELECT cleanup_soft_deleted_schedules()'')';
END $$;
