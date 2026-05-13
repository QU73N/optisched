-- ============================================================================
-- FIX SCHEDULE VISIBILITY - ENSURE ONLY ACTIVE SCHEDULES ARE VISIBLE
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: DIAGNOSTICS - CHECK CURRENT STATE
-- ============================================================================

-- Check how many schedules exist per status
SELECT 
    'SCHEDULES BY STATUS' as section,
    status,
    is_active,
    COUNT(*) as count
FROM public.schedules
GROUP BY status, is_active
ORDER BY status, is_active;

-- Check for duplicate schedules (same section, day, time, subject)
SELECT 
    'POTENTIAL DUPLICATES' as section,
    section_id,
    day_of_week,
    start_time,
    end_time,
    subject_id,
    COUNT(*) as count
FROM public.schedules
WHERE status = 'published'
GROUP BY section_id, day_of_week, start_time, end_time, subject_id
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Check how many published schedules are inactive
SELECT 
    'INACTIVE PUBLISHED SCHEDULES' as section,
    COUNT(*) as count
FROM public.schedules
WHERE status = 'published' AND is_active = false;

-- ============================================================================
-- PART 2: DEACTIVATE OLD SCHEDULE VERSIONS
-- ============================================================================

-- Strategy: Keep only the most recently updated schedule for each unique slot
-- A "unique slot" is defined by: section_id, day_of_week, start_time, end_time, subject_id
-- For each slot, keep the one with the latest updated_at and set others to is_active = false

-- First, identify which schedules to keep (most recent per slot)
WITH ranked_schedules AS (
    SELECT 
        id,
        section_id,
        day_of_week,
        start_time,
        end_time,
        subject_id,
        updated_at,
        ROW_NUMBER() OVER (
            PARTITION BY section_id, day_of_week, start_time, end_time, subject_id
            ORDER BY updated_at DESC
        ) as rn
    FROM public.schedules
    WHERE status = 'published'
)
UPDATE public.schedules
SET is_active = false
WHERE id IN (
    SELECT id FROM ranked_schedules WHERE rn > 1
);

-- Verify the fix
SELECT 
    'AFTER FIX: INACTIVE PUBLISHED SCHEDULES' as section,
    COUNT(*) as count
FROM public.schedules
WHERE status = 'published' AND is_active = false;

-- ============================================================================
-- PART 3: UPDATE RLS POLICY TO FILTER BY is_active
-- ============================================================================

-- Drop existing schedules_select policy
DROP POLICY IF EXISTS "schedules_select" ON public.schedules;
DROP POLICY IF EXISTS "Published schedules are viewable by everyone" ON public.schedules;

-- Create new policy that filters by is_active for students and teachers
CREATE POLICY "schedules_select" ON public.schedules
    FOR SELECT
    USING (
        is_power_admin() OR 
        (current_user_role() = ANY (ARRAY['system_admin'::text, 'schedule_admin'::text])) OR 
        ((current_user_role() = 'schedule_manager'::text) AND ((status = ANY (ARRAY['published'::text, 'submitted'::text])) OR (created_by = auth.uid()))) OR 
        ((current_user_role() = 'teacher'::text) AND (status = 'published'::text) AND (is_active = true) AND (teacher_id IN ( 
            SELECT teachers.id FROM teachers WHERE teachers.profile_id = auth.uid()
        ))) OR 
        ((current_user_role() = 'student'::text) AND (status = 'published'::text) AND (is_active = true) AND (section_id IN ( 
            SELECT section_id FROM students WHERE profile_id = auth.uid()
        )))
    );

-- ============================================================================
-- PART 4: VERIFY THE FIX
-- ============================================================================

-- Show the new policy
SELECT 
    'NEW RLS POLICY' as section,
    policyname,
    qual
FROM pg_policies 
WHERE schemaname = 'public'
    AND tablename = 'schedules'
    AND policyname = 'schedules_select';

-- Count active published schedules
SELECT 
    'ACTIVE PUBLISHED SCHEDULES' as section,
    COUNT(*) as count
FROM public.schedules
WHERE status = 'published' AND is_active = true;

-- ============================================================================
-- PART 5: UPDATE RPC FUNCTION TO FILTER BY is_active
-- ============================================================================

-- Drop and recreate get_schedules_with_details to filter by is_active
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
-- PART 6: FINAL VERIFICATION
-- ============================================================================

-- Test the RPC function
SELECT 
    'RPC FUNCTION TEST' as section,
    COUNT(*) as result_count
FROM get_schedules_with_details();

SELECT 
    'FIX COMPLETE' as section,
    'Please verify that students now see only active schedules' as note;
