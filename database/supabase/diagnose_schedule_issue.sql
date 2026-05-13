-- ============================================================================
-- DIAGNOSE SCHEDULE VISIBILITY ISSUE
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: CHECK STUDENT RECORD
-- ============================================================================

SELECT 
    'STUDENT RECORD' as section,
    profile_id,
    section_id,
    is_active
FROM public.students
WHERE profile_id = '913d7fcb-bd4b-4360-83f4-d4d054f6aaac';

-- ============================================================================
-- PART 2: CHECK WEDNESDAY SCHEDULES BY SECTION
-- ============================================================================

SELECT 
    'WEDNESDAY SCHEDULES BY SECTION' as section,
    section_id,
    section_name,
    COUNT(*) as count
FROM (
    SELECT 
        s.section_id,
        sec.name as section_name
    FROM public.schedules s
    LEFT JOIN public.sections sec ON sec.id = s.section_id
    WHERE s.status = 'published' 
        AND s.day_of_week = 'Wednesday'
        AND s.is_active = true
) grouped
GROUP BY section_id, section_name
ORDER BY count DESC;

-- ============================================================================
-- PART 3: CHECK ALL WEDNESDAY SCHEDULES WITH DETAILS
-- ============================================================================

SELECT 
    'WEDNESDAY SCHEDULES DETAIL' as section,
    s.id,
    s.section_id,
    sec.name as section_name,
    s.day_of_week,
    s.start_time,
    s.end_time,
    sub.name as subject_name,
    s.is_active,
    s.updated_at
FROM public.schedules s
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
LEFT JOIN public.sections sec ON sec.id = s.section_id
WHERE s.status = 'published' 
    AND s.day_of_week = 'Wednesday'
ORDER BY s.section_id, s.start_time, s.updated_at DESC
LIMIT 30;

-- ============================================================================
-- PART 4: CHECK IF DEACTIVATION WORKED
-- ============================================================================

SELECT 
    'PUBLISHED BY IS_ACTIVE' as section,
    is_active,
    COUNT(*) as count
FROM public.schedules
WHERE status = 'published'
GROUP BY is_active;

SELECT 
    'WEDNESDAY BY IS_ACTIVE' as section,
    is_active,
    COUNT(*) as count
FROM public.schedules
WHERE status = 'published' 
    AND day_of_week = 'Wednesday'
GROUP BY is_active;

-- ============================================================================
-- PART 5: CHECK RLS POLICIES ON STUDENTS TABLE
-- ============================================================================

SELECT 
    'STUDENTS RLS POLICIES' as section,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'students';

-- ============================================================================
-- PART 6: TEST STUDENT QUERY AS THE USER
-- ============================================================================

-- This simulates what the frontend is trying to do
SELECT 
    'TEST STUDENT QUERY' as section,
    profile_id,
    section_id,
    is_active
FROM public.students
WHERE profile_id = '913d7fcb-bd4b-4360-83f4-d4d054f6aaac'
    AND is_active = true;
