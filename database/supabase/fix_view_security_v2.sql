-- Fix SECURITY DEFINER view issue
-- Explicitly recreate view as SECURITY INVOKER

DROP VIEW IF EXISTS public.soft_deleted_schedules_monitor;

CREATE VIEW public.soft_deleted_schedules_monitor
SECURITY INVOKER
AS
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

-- Add comment to document the view
COMMENT ON VIEW soft_deleted_schedules_monitor IS 
'Monitoring view for soft-deleted schedules with cleanup status. 
Shows days since deletion and cleanup readiness status. 
Created as SECURITY INVOKER to enforce RLS policies of the querying user.';
