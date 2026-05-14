-- ============================================================================
-- FIX FACULTY LOAD ISSUE - UPDATE RPC TO RETURN ONLY ONE SCHEDULE PER SLOT
-- ============================================================================
-- Problem: RPC returns both draft and published schedules, causing duplicates
-- Solution: Return only published schedules if available, otherwise drafts
-- ============================================================================

-- Drop and recreate get_schedules_with_details to filter by status
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
    -- Use a subquery to get only one schedule per slot
    -- Priority: published > submitted > draft (only if is_active)
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
                PARTITION BY s.section_id, s.day_of_week, s.start_time, s.end_time, s.subject_id
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

-- Test the RPC function
SELECT 
    'RPC FUNCTION RESULT COUNT' as section,
    COUNT(*) as count
FROM get_schedules_with_details();

-- Check by status
SELECT 
    'RPC BY STATUS' as section,
    status,
    COUNT(*) as count
FROM get_schedules_with_details()
GROUP BY status;

-- Check for any remaining duplicates
SELECT 
    'CHECK FOR DUPLICATES AFTER FIX' as section,
    section_id,
    day_of_week,
    start_time,
    end_time,
    subject_id,
    COUNT(*) as duplicate_count
FROM get_schedules_with_details()
GROUP BY section_id, day_of_week, start_time, end_time, subject_id
HAVING COUNT(*) > 1;

-- Compare with original schedules count
SELECT 
    'COMPARISON' as section,
    'Original active schedules' as metric,
    COUNT(*) as count
FROM public.schedules
WHERE is_active = true

UNION ALL

SELECT 
    'COMPARISON' as section,
    'RPC result (deduplicated)' as metric,
    COUNT(*) as count
FROM get_schedules_with_details();

SELECT 
    'FIX COMPLETE' as section,
    'RPC now returns only one schedule per slot (published priority)' as note;
