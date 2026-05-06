-- Add RPC functions for fetching data with joins
-- These functions bypass RLS join issues by doing joins in SQL

-- Function to fetch teachers with profiles
CREATE OR REPLACE FUNCTION get_teachers_with_profiles()
RETURNS TABLE (
    id uuid,
    profile_id uuid,
    full_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT 
        t.id,
        t.profile_id,
        p.full_name
    FROM public.teachers t
    LEFT JOIN public.profiles p ON p.id = t.profile_id
    WHERE t.is_public = true;
$$;

-- Function to fetch schedules with all related data
CREATE OR REPLACE FUNCTION get_schedules_with_details()
RETURNS TABLE (
    id uuid,
    teacher_id uuid,
    subject_id uuid,
    room_id uuid,
    section_id uuid,
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
        s.teacher_id,
        s.subject_id,
        s.room_id,
        s.section_id,
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
