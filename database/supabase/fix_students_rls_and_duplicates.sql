-- ============================================================================
-- FIX STUDENTS RLS AND DEACTIVATE DUPLICATES
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: FIX STUDENTS TABLE RLS POLICY
-- ============================================================================

-- Enable RLS on students table
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "students_select_own" ON public.students;
DROP POLICY IF EXISTS "students_insert_own" ON public.students;
DROP POLICY IF EXISTS "students_update_own" ON public.students;

-- Create policy to allow students to view their own record
CREATE POLICY "students_select_own" ON public.students
    FOR SELECT
    USING (auth.uid() = profile_id);

-- Create policy to allow admins to view all students
CREATE POLICY "students_select_admin" ON public.students
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
        )
    );

-- ============================================================================
-- PART 2: CHECK CURRENT SCHEDULE STATE
-- ============================================================================

-- Count all published schedules
SELECT 
    'TOTAL PUBLISHED SCHEDULES' as section,
    COUNT(*) as count
FROM public.schedules
WHERE status = 'published';

-- Count by is_active
SELECT 
    'PUBLISHED BY IS_ACTIVE' as section,
    is_active,
    COUNT(*) as count
FROM public.schedules
WHERE status = 'published'
GROUP BY is_active;

-- ============================================================================
-- PART 3: AGGRESSIVE DEACTIVATION OF DUPLICATES
-- ============================================================================

-- Method 1: Direct UPDATE with subquery (more reliable than temp table)
UPDATE public.schedules s1
SET is_active = false
WHERE status = 'published'
    AND id NOT IN (
        SELECT DISTINCT ON (section_id, day_of_week, start_time, end_time, subject_id)
            id
        FROM public.schedules
        WHERE status = 'published'
        ORDER BY 
            section_id, 
            day_of_week, 
            start_time, 
            end_time, 
            subject_id, 
            updated_at DESC
    );

-- Verify the fix
SELECT 
    'AFTER FIX: PUBLISHED BY IS_ACTIVE' as section,
    is_active,
    COUNT(*) as count
FROM public.schedules
WHERE status = 'published'
GROUP BY is_active;

-- ============================================================================
-- PART 4: UPDATE RPC FUNCTION TO FILTER BY is_active
-- ============================================================================

DROP FUNCTION IF EXISTS get_schedules_with_details();

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
    is_active boolean,
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
        s.is_active,
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
    WHERE s.is_active = true;
$$;

-- ============================================================================
-- PART 5: VERIFY RPC FUNCTION
-- ============================================================================

-- Test the RPC function
SELECT 
    'RPC FUNCTION TEST' as section,
    COUNT(*) as result_count
FROM get_schedules_with_details();

-- Test RPC for Wednesday only
SELECT 
    'RPC WEDNESDAY TEST' as section,
    COUNT(*) as result_count
FROM get_schedules_with_details()
WHERE day_of_week = 'Wednesday';

-- ============================================================================
-- PART 6: CHECK STUDENT RECORD
-- ============================================================================

-- Check if the student record exists
SELECT 
    'STUDENT RECORD CHECK' as section,
    profile_id,
    section_id,
    is_active
FROM public.students
WHERE profile_id = '913d7fcb-bd4b-4360-83f4-d4d054f6aaac';

SELECT 
    'FIX COMPLETE' as section,
    'RLS policy fixed, duplicates deactivated, RPC updated' as note;
