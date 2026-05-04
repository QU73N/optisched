-- Fix SECURITY DEFINER view issue
-- Recreate view without SECURITY DEFINER (defaults to SECURITY INVOKER)

DROP VIEW IF EXISTS public.soft_deleted_schedules_monitor;

CREATE VIEW public.soft_deleted_schedules_monitor AS
SELECT id,
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
    EXTRACT(day FROM (now() - deleted_at)) AS days_since_deletion,
    CASE
        WHEN (deleted_at < (now() - '30 days'::interval)) THEN 'READY_FOR_CLEANUP'::text
        WHEN (deleted_at < (now() - '25 days'::interval)) THEN 'APPROACHING_CLEANUP'::text
        ELSE 'ACTIVE_RETENTION'::text
    END AS cleanup_status
FROM schedules
WHERE (deleted_at IS NOT NULL)
ORDER BY deleted_at DESC;
