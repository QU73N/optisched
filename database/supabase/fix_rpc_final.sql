-- ============================================================================
-- FIX RPC - RETURN ONLY PUBLISHED SCHEDULES
-- ============================================================================
-- The issue: FacultyHub counts both draft and published schedules
-- Solution: Only return published schedules (is_active=true, status='published')
-- This ensures only one version of the schedule is counted
-- ============================================================================

-- Drop and recreate get_schedules_with_details to return only published
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
    WHERE s.is_active = true AND s.status = 'published';
$$;

-- ============================================================================
-- VERIFY THE FIX
-- ============================================================================

-- Test the RPC function count
SELECT 
    'RPC FUNCTION RESULT COUNT (PUBLISHED ONLY)' as section,
    COUNT(*) as count
FROM get_schedules_with_details();

-- Check by status (should only be published)
SELECT 
    'RPC BY STATUS' as section,
    status,
    COUNT(*) as count
FROM get_schedules_with_details()
GROUP BY status;

-- Compare with original schedules count
SELECT 
    'COMPARISON' as section,
    'Original active schedules (all statuses)' as metric,
    COUNT(*) as count
FROM public.schedules
WHERE is_active = true

UNION ALL

SELECT 
    'COMPARISON' as section,
    'RPC result (published only)' as metric,
    COUNT(*) as count
FROM get_schedules_with_details()

UNION ALL

SELECT 
    'COMPARISON' as section,
    'Published schedules in DB' as metric,
    COUNT(*) as count
FROM public.schedules
WHERE is_active = true AND status = 'published';

-- Check top teacher workload after fix
SELECT 
    'TEACHER WORKLOAD AFTER FIX (PUBLISHED ONLY)' as section,
    teacher_id,
    teacher_name,
    COUNT(*) as class_count,
    SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) as total_hours
FROM get_schedules_with_details()
WHERE teacher_id = 'bbc91167-72c7-4244-9b4d-27efbe79f4c3'
GROUP BY teacher_id, teacher_name;

-- Check all teachers' workload after fix
SELECT 
    'ALL TEACHERS WORKLOAD (PUBLISHED ONLY)' as section,
    teacher_id,
    teacher_name,
    COUNT(*) as class_count,
    SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) as total_hours
FROM get_schedules_with_details()
GROUP BY teacher_id, teacher_name
ORDER BY total_hours DESC
LIMIT 10;

SELECT 
    'FIX COMPLETE' as section,
    'RPC now returns only published schedules (no duplicates)' as note;
