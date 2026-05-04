-- Fix Security Definer View Issue
-- Drop and recreate soft_deleted_schedules_monitor view without SECURITY DEFINER

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

-- Fix RLS Disabled Issue
-- Enable RLS on subject_rooms table and create appropriate policies

ALTER TABLE public.subject_rooms ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view subject_rooms" ON public.subject_rooms;
DROP POLICY IF EXISTS "Users can insert subject_rooms" ON public.subject_rooms;
DROP POLICY IF EXISTS "Users can update subject_rooms" ON public.subject_rooms;
DROP POLICY IF EXISTS "Users can delete subject_rooms" ON public.subject_rooms;

-- Create RLS policies for subject_rooms
-- Public can view subject_rooms
CREATE POLICY "Public can view subject_rooms"
ON public.subject_rooms
FOR SELECT
TO public
USING (true);

-- Authenticated users can insert subject_rooms
CREATE POLICY "Authenticated users can insert subject_rooms"
ON public.subject_rooms
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Authenticated users can update subject_rooms
CREATE POLICY "Authenticated users can update subject_rooms"
ON public.subject_rooms
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Authenticated users can delete subject_rooms
CREATE POLICY "Authenticated users can delete subject_rooms"
ON public.subject_rooms
FOR DELETE
TO authenticated
USING (true);
