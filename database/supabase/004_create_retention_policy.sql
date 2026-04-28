-- =====================================================================
-- Retention & Archive Policy
-- Idempotent — safe to re-run.
-- =====================================================================

-- Only create archive table if user_activity_logs exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user_activity_logs'
    ) THEN
        -- User activity logs archive table
        CREATE TABLE IF NOT EXISTS public.user_activity_logs_archive (
            LIKE public.user_activity_logs INCLUDING ALL
        );

        -- Add archive-specific metadata
        ALTER TABLE public.user_activity_logs_archive
            ADD COLUMN IF NOT EXISTS archived_at timestamptz NOT NULL DEFAULT now();
    END IF;
END $$;

-- Archive function
CREATE OR REPLACE FUNCTION public.archive_old_logs()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    cutoff_date timestamptz := now() - interval '365 days';
    archived_count bigint;
BEGIN
    -- Only archive if both tables exist
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user_activity_logs'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user_activity_logs_archive'
    ) THEN
        -- Move old user activity logs to archive
        WITH moved AS (
            DELETE FROM public.user_activity_logs
            WHERE created_at < cutoff_date
            RETURNING *
        )
        INSERT INTO public.user_activity_logs_archive
        SELECT *, now() as archived_at FROM moved;

        GET DIAGNOSTICS archived_count = ROW_COUNT;
        RAISE NOTICE 'Archived % user activity logs older than %', archived_count, cutoff_date;
    END IF;
END;
$$;

-- Note: pg_cron extension is available in Supabase.
-- To enable nightly archiving, run in Supabase SQL editor:
-- SELECT cron.schedule('archive-activity-logs', '0 2 * * *', 'SELECT public.archive_old_logs();');

-- Audit logs are append-only (tamper-evidence from C1).
-- After 730 days, they can be compressed (not deleted).
-- This is handled by a separate maintenance function if needed.

-- Retention documentation
-- - User activity logs: 365 days in live table, then moved to archive
-- - Audit logs: 730 days retention minimum (append-only)
-- - Sessions: 90 days (idle timeout cleanup)
-- - Change requests: 365 days after final resolution
-- - Backup jobs: 365 days after completion
