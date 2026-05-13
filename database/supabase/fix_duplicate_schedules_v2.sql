-- ============================================================================
-- FIX DUPLICATE SCHEDULES - AGGRESSIVE VERSION
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: DIAGNOSTICS - SEE THE PROBLEM
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

-- Show sample of Wednesday published schedules
SELECT 
    id,
    section_id,
    day_of_week,
    start_time,
    end_time,
    subject_id,
    is_active,
    updated_at
FROM public.schedules
WHERE status = 'published' 
    AND day_of_week = 'Wednesday'
ORDER BY section_id, day_of_week, start_time, updated_at
LIMIT 30;

-- ============================================================================
-- PART 2: IDENTIFY AND DEACTIVATE DUPLICATES
-- ============================================================================

-- Create a temporary table to identify which schedules to keep
CREATE TEMP TABLE schedules_to_keep AS
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
    updated_at DESC;

-- Show how many unique slots we have
SELECT 
    'UNIQUE SLOTS TO KEEP' as section,
    COUNT(*) as count
FROM schedules_to_keep;

-- Deactivate all published schedules that are NOT in the keep list
UPDATE public.schedules
SET is_active = false
WHERE status = 'published'
    AND id NOT IN (SELECT id FROM schedules_to_keep);

-- Verify the fix
SELECT 
    'AFTER FIX: PUBLISHED BY IS_ACTIVE' as section,
    is_active,
    COUNT(*) as count
FROM public.schedules
WHERE status = 'published'
GROUP BY is_active;

-- Show Wednesday schedules after fix
SELECT 
    id,
    section_id,
    day_of_week,
    start_time,
    end_time,
    subject_id,
    is_active,
    updated_at
FROM public.schedules
WHERE status = 'published' 
    AND day_of_week = 'Wednesday'
ORDER BY section_id, day_of_week, start_time, is_active DESC, updated_at DESC
LIMIT 30;

-- Drop temp table
DROP TABLE schedules_to_keep;

-- ============================================================================
-- PART 3: UPDATE RPC FUNCTION TO FILTER BY is_active
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
-- PART 4: FINAL VERIFICATION
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

SELECT 
    'FIX COMPLETE' as section,
    'Schedules deactivated. RPC updated to filter by is_active.' as note;
