-- ============================================================================
-- FIX RPC DEDUPLICATION - INCLUDE TEACHER AND ROOM IN PARTITION KEY
-- ============================================================================
-- Previous fix partitioned by section_id, day_of_week, start_time, end_time, subject_id
-- But duplicates can have the same section, day, time, subject with different teacher/room
-- New fix partitions by ALL fields that define a unique schedule
-- ============================================================================

-- Drop and recreate get_schedules_with_details with improved deduplication
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
    -- Use a subquery to get only one schedule per unique slot
    -- Partition by ALL fields that define a unique schedule
    WITH ranked_schedules AS (
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
            sec.program as section_program,
            -- Rank by status priority (published first, then submitted, then draft)
            -- Only include is_active = true
            ROW_NUMBER() OVER (
                PARTITION BY s.section_id, s.day_of_week, s.start_time, s.end_time, s.subject_id, s.teacher_id, s.room_id
                ORDER BY 
                    CASE s.status
                        WHEN 'published' THEN 1
                        WHEN 'submitted' THEN 2
                        WHEN 'draft' THEN 3
                        ELSE 4
                    END,
                    s.updated_at DESC
            ) as rn
        FROM public.schedules s
        LEFT JOIN public.subjects sub ON sub.id = s.subject_id
        LEFT JOIN public.teachers t ON t.id = s.teacher_id
        LEFT JOIN public.profiles p ON p.id = t.profile_id
        LEFT JOIN public.rooms r ON r.id = s.room_id
        LEFT JOIN public.sections sec ON sec.id = s.section_id
        WHERE s.is_active = true
    )
    SELECT
        id,
        teacher_id,
        subject_id,
        room_id,
        section_id,
        day_of_week,
        start_time,
        end_time,
        status,
        is_active,
        semester,
        academic_year,
        subject_name,
        subject_code,
        teacher_name,
        room_name,
        room_building,
        section_name,
        section_program
    FROM ranked_schedules
    WHERE rn = 1;
$$;

-- ============================================================================
-- VERIFY THE FIX
-- ============================================================================

-- Test the RPC function count
SELECT 
    'RPC FUNCTION RESULT COUNT V2' as section,
    COUNT(*) as count
FROM get_schedules_with_details();

-- Check by status
SELECT 
    'RPC BY STATUS V2' as section,
    status,
    COUNT(*) as count
FROM get_schedules_with_details()
GROUP BY status;

-- Check for any remaining duplicates by full key
SELECT 
    'CHECK FOR DUPLICATES BY FULL KEY' as section,
    section_id,
    day_of_week,
    start_time,
    end_time,
    subject_id,
    teacher_id,
    room_id,
    COUNT(*) as duplicate_count
FROM get_schedules_with_details()
GROUP BY section_id, day_of_week, start_time, end_time, subject_id, teacher_id, room_id
HAVING COUNT(*) > 1;

-- Compare with original schedules count
SELECT 
    'COMPARISON V2' as section,
    'Original active schedules (all statuses)' as metric,
    COUNT(*) as count
FROM public.schedules
WHERE is_active = true

UNION ALL

SELECT 
    'COMPARISON V2' as section,
    'RPC result (deduplicated by full key)' as metric,
    COUNT(*) as count
FROM get_schedules_with_details()

UNION ALL

SELECT 
    'COMPARISON V2' as section,
    'Published only' as metric,
    COUNT(*) as count
FROM public.schedules
WHERE is_active = true AND status = 'published';

-- Check top teacher workload after fix
SELECT 
    'TEACHER WORKLOAD AFTER FIX V2' as section,
    teacher_id,
    teacher_name,
    COUNT(*) as class_count,
    SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) as total_hours
FROM get_schedules_with_details()
WHERE teacher_id = 'bbc91167-72c7-4244-9b4d-27efbe79f4c3'
GROUP BY teacher_id, teacher_name;

SELECT 
    'FIX COMPLETE V2' as section,
    'RPC now deduplicates by full key (section, day, time, subject, teacher, room)' as note;
