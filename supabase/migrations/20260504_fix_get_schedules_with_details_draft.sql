-- Fix get_schedules_with_details to include draft schedules
-- The function was only returning published schedules, causing draft schedules to be hidden

DROP FUNCTION IF EXISTS public.get_schedules_with_details CASCADE;

CREATE OR REPLACE FUNCTION get_schedules_with_details()
RETURNS TABLE (
    id uuid,
    day_of_week text,
    start_time time without time zone,
    end_time time without time zone,
    status text,
    semester text,
    academic_year text,
    subject_name text,
    subject_code text,
    teacher_name text,
    room_name text,
    room_building text,
    section_name text,
    section_program text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT 
        s.id,
        s.day_of_week,
        s.start_time,
        s.end_time,
        s.status,
        s.semester,
        s.academic_year,
        sub.name as subject_name,
        sub.code as subject_code,
        p.full_name as teacher_name,
        r.name as room_name,
        r.building as room_building,
        sec.name as section_name,
        sec.program as section_program
    FROM public.schedules s
    LEFT JOIN public.subjects sub ON sub.id = s.subject_id
    LEFT JOIN public.teachers t ON t.id = s.teacher_id
    LEFT JOIN public.profiles p ON p.id = t.profile_id
    LEFT JOIN public.rooms r ON r.id = s.room_id
    LEFT JOIN public.sections sec ON sec.id = s.section_id
    WHERE s.status IN ('published', 'draft') AND s.is_active = true;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_schedules_with_details TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_schedules_with_details TO anon;
