-- ============================================================================
-- SIMPLE DIAGNOSTIC - Check student record and schedule sections
-- ============================================================================

-- 1. Check if student record exists
SELECT 'STUDENT RECORD' as info, profile_id, section_id, is_active
FROM public.students
WHERE profile_id = '913d7fcb-bd4b-4360-83f4-d4d054f6aaac';

-- 2. Count Wednesday schedules by section
SELECT 'WEDNESDAY BY SECTION' as info, section_id, COUNT(*) as count
FROM public.schedules
WHERE status = 'published' AND day_of_week = 'Wednesday'
GROUP BY section_id;

-- 3. Show all Wednesday schedules with section names
SELECT 'WEDNESDAY DETAIL' as info, 
    s.section_id, 
    sec.name as section_name,
    s.day_of_week,
    s.start_time,
    sub.name as subject_name,
    s.is_active
FROM public.schedules s
LEFT JOIN public.sections sec ON sec.id = s.section_id
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
WHERE s.status = 'published' AND s.day_of_week = 'Wednesday'
ORDER BY s.section_id, s.start_time;
