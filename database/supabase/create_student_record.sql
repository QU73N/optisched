-- ============================================================================
-- CHECK AND CREATE STUDENT RECORD
-- Run this in Supabase SQL Editor
-- ============================================================================

-- First, check if the profile exists
SELECT 'PROFILE CHECK' as info, id, full_name, email, role
FROM public.profiles
WHERE id = '913d7fcb-bd4b-4360-83f4-d4d054f6aaac';

-- Check if student record exists
SELECT 'STUDENT RECORD CHECK' as info, profile_id, section_id, is_active
FROM public.students
WHERE profile_id = '913d7fcb-bd4b-4360-83f4-d4d054f6aaac';

-- List all available sections
SELECT 'AVAILABLE SECTIONS' as info, id, name, program, year_level
FROM public.sections
ORDER BY program, year_level, name;

-- If student record doesn't exist, uncomment and run the following:
-- Replace 'SECTION_ID_HERE' with the actual section_id from the list above

/*
INSERT INTO public.students (profile_id, section_id, is_active)
VALUES ('913d7fcb-bd4b-4360-83f4-d4d054f6aaac', 'SECTION_ID_HERE', true);
*/
