-- Migrate student profiles to students table with proper section matching
-- This handles the formatting differences between profile.section and sections.name

-- Profile sections use format: "MAWD 12A", "STEM 11A", "ABM 11A"
-- Section names use format: "MAWD-12a", "STEM-11a", "ABM-11a"

-- Clear any existing student records (in case of re-run)
DELETE FROM public.students;

-- Insert students with proper section matching using string normalization
INSERT INTO public.students (profile_id, section_id, student_number)
SELECT 
    p.id as profile_id,
    s.id as section_id,
    p.email as student_number
FROM public.profiles p
JOIN public.sections s ON REPLACE(LOWER(p.section), ' ', '-') = LOWER(s.name)
WHERE p.role = 'student' AND p.section IS NOT NULL
ON CONFLICT (profile_id, section_id) DO NOTHING;

-- Verify the migration
SELECT 
    'Students migrated' as status,
    COUNT(*) as count
FROM public.students;

-- Show which students were migrated
SELECT 
    p.email,
    p.full_name,
    p.section as profile_section,
    s.name as section_name
FROM public.students st
JOIN public.profiles p ON st.profile_id = p.id
JOIN public.sections s ON st.section_id = s.id
ORDER BY p.full_name;
