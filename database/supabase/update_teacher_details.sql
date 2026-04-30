-- Update teacher details with correct departments and employment types

UPDATE public.teachers t
SET department = 'Business', employment_type = 'full-time', max_hours = 40
FROM public.profiles p
WHERE t.profile_id = p.id AND p.email = 'reneil.arnado@optisched.sti.edu';

UPDATE public.teachers t
SET department = 'Mathematics', employment_type = 'full-time', max_hours = 40
FROM public.profiles p
WHERE t.profile_id = p.id AND p.email = 'bea.magno@optisched.sti.edu';

UPDATE public.teachers t
SET department = 'Research', employment_type = 'full-time', max_hours = 40
FROM public.profiles p
WHERE t.profile_id = p.id AND p.email = 'ello.egnacio@optisched.sti.edu';

UPDATE public.teachers t
SET department = 'Arts & PE', employment_type = 'full-time', max_hours = 40
FROM public.profiles p
WHERE t.profile_id = p.id AND p.email = 'edgar.habana@optisched.sti.edu';

UPDATE public.teachers t
SET department = 'Computer Science', employment_type = 'full-time', max_hours = 40
FROM public.profiles p
WHERE t.profile_id = p.id AND p.email = 'john.calizon@optisched.sti.edu';

UPDATE public.teachers t
SET department = 'Computer Science', employment_type = 'full-time', max_hours = 40
FROM public.profiles p
WHERE t.profile_id = p.id AND p.email = 'psalmmiracle.mariano@optisched.sti.edu';

UPDATE public.teachers t
SET department = 'Physics', employment_type = 'part-time', max_hours = 20
FROM public.profiles p
WHERE t.profile_id = p.id AND p.email = 'mary.balando@optisched.sti.edu';

UPDATE public.teachers t
SET department = 'Chemistry', employment_type = 'part-time', max_hours = 20
FROM public.profiles p
WHERE t.profile_id = p.id AND p.email = 'mark.doblon@optisched.sti.edu';

-- Create teacher preferences for part-time teachers (Saturday only)
INSERT INTO public.teacher_preferences (teacher_id, preferred_days, max_classes_per_day, created_at)
SELECT t.id, ARRAY['Saturday'], 4, NOW()
FROM public.teachers t
JOIN public.profiles p ON t.profile_id = p.id
WHERE p.email IN ('mary.balando@optisched.sti.edu', 'mark.doblon@optisched.sti.edu')
ON CONFLICT (teacher_id) DO NOTHING;

-- Verification
SELECT t.department, t.employment_type, t.max_hours, p.full_name, p.email
FROM public.teachers t
JOIN public.profiles p ON t.profile_id = p.id
ORDER BY p.full_name;
