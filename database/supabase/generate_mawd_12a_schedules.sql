-- ============================================================================
-- GENERATE SCHEDULES FOR MAWD-12a
-- This script copies schedules from MAWD-11a as a template and adjusts for MAWD-12a
-- Run this in Supabase SQL Editor
-- ============================================================================

-- First, check what subjects are available for MAWD-12a
SELECT 'MAWD-12a SUBJECTS' as info, id, name, code
FROM public.subjects
WHERE program = 'MAWD'
ORDER BY name;

-- Copy MAWD-11a schedules to MAWD-12a (as a starting template)
INSERT INTO public.schedules (
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
    academic_year
)
SELECT 
    s.teacher_id,
    s.subject_id,
    s.room_id,
    '9cc7c9ce-d40e-45fc-8594-7108ca322eb0' as section_id,  -- MAWD-12a
    s.day_of_week,
    s.start_time,
    s.end_time,
    'published' as status,
    true as is_active,
    s.semester,
    s.academic_year
FROM public.schedules s
WHERE s.section_id = '600875a9-8fc2-4c0c-a7c6-f2c76645a39a'  -- MAWD-11a
    AND s.status = 'published'
    AND s.is_active = true;

-- Verify the schedules were created
SELECT 'MAWD-12a SCHEDULES CREATED' as info, COUNT(*) as count
FROM public.schedules
WHERE section_id = '9cc7c9ce-d40e-45fc-8594-7108ca322eb0';

-- Show Wednesday schedules for MAWD-12a
SELECT 'MAWD-12a WEDNESDAY SCHEDULES' as info,
    s.day_of_week,
    s.start_time,
    s.end_time,
    sub.name as subject_name,
    t.profile_id,
    p.full_name as teacher_name,
    r.name as room_name
FROM public.schedules s
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
LEFT JOIN public.teachers t ON t.id = s.teacher_id
LEFT JOIN public.profiles p ON p.id = t.profile_id
LEFT JOIN public.rooms r ON r.id = s.room_id
WHERE s.section_id = '9cc7c9ce-d40e-45fc-8594-7108ca322eb0'
    AND s.day_of_week = 'Wednesday'
    AND s.status = 'published'
ORDER BY s.start_time;
