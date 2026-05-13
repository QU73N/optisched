-- ============================================================================
-- COMPREHENSIVE STUDENT RECORD CHECK AND ASSIGNMENT
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Check profile details
SELECT 'PROFILE DETAILS' as info, id, full_name, email, role
FROM public.profiles
WHERE id = '913d7fcb-bd4b-4360-83f4-d4d054f6aaac';

-- 2. Check if ANY student record exists for this profile
SELECT 'EXISTING STUDENT RECORDS' as info, profile_id, section_id, is_active
FROM public.students
WHERE profile_id = '913d7fcb-bd4b-4360-83f4-d4d054f6aaac';

-- 3. Check MAWD-12a section details
SELECT 'TARGET SECTION' as info, id, name, program, year_level
FROM public.sections
WHERE id = '9cc7c9ce-d40e-45fc-8594-7108ca322eb0';

-- 4. If student record exists, update it to MAWD-12a
UPDATE public.students
SET section_id = '9cc7c9ce-d40e-45fc-8594-7108ca322eb0', is_active = true
WHERE profile_id = '913d7fcb-bd4b-4360-83f4-d4d054f6aaac';

-- 5. If no student record exists, create one
INSERT INTO public.students (profile_id, section_id, is_active)
SELECT '913d7fcb-bd4b-4360-83f4-d4d054f6aaac', '9cc7c9ce-d40e-45fc-8594-7108ca322eb0', true
WHERE NOT EXISTS (
    SELECT 1 FROM public.students 
    WHERE profile_id = '913d7fcb-bd4b-4360-83f4-d4d054f6aaac'
);

-- 6. Verify the assignment
SELECT 'FINAL STUDENT RECORD' as info, profile_id, section_id, is_active
FROM public.students
WHERE profile_id = '913d7fcb-bd4b-4360-83f4-d4d054f6aaac';

-- 7. Show MAWD-12a schedules for Wednesday
SELECT 'MAWD-12a WEDNESDAY SCHEDULES' as info,
    s.day_of_week,
    s.start_time,
    s.end_time,
    sub.name as subject_name,
    s.is_active
FROM public.schedules s
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
WHERE s.section_id = '9cc7c9ce-d40e-45fc-8594-7108ca322eb0'
    AND s.status = 'published'
    AND s.day_of_week = 'Wednesday'
ORDER BY s.start_time;
