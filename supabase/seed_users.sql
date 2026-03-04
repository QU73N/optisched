-- ============================================
-- OptiSched: Create Demo Auth Users
-- Run this AFTER running migration.sql
-- ============================================
-- This uses Supabase's built-in auth.users insert.
-- The handle_new_user trigger will auto-create profiles.

-- ADMIN USER
-- Email: admin@optisched.sti.edu
-- Password: Admin123!
SELECT auth.uid(); -- just to verify auth schema is accessible

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, raw_user_meta_data,
  created_at, updated_at, confirmation_token, aud, role
) VALUES (
  'a1111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'admin@optisched.sti.edu',
  crypt('Admin123!', gen_salt('bf')),
  NOW(),
  '{"role": "admin", "full_name": "Dr. Admin User"}'::jsonb,
  NOW(), NOW(), '', 'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- TEACHER USER
-- Email: teacher@optisched.sti.edu
-- Password: Teacher123!
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, raw_user_meta_data,
  created_at, updated_at, confirmation_token, aud, role
) VALUES (
  'b2222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'teacher@optisched.sti.edu',
  crypt('Teacher123!', gen_salt('bf')),
  NOW(),
  '{"role": "teacher", "full_name": "Bea Angely Magno"}'::jsonb,
  NOW(), NOW(), '', 'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- STUDENT USER
-- Email: student@optisched.sti.edu
-- Password: Student123!
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, raw_user_meta_data,
  created_at, updated_at, confirmation_token, aud, role
) VALUES (
  'c3333333-3333-3333-3333-333333333333',
  '00000000-0000-0000-0000-000000000000',
  'student@optisched.sti.edu',
  crypt('Student123!', gen_salt('bf')),
  NOW(),
  '{"role": "student", "full_name": "Mark Angelo Cruz"}'::jsonb,
  NOW(), NOW(), '', 'authenticated', 'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Create teacher record for the teacher user
INSERT INTO public.teachers (profile_id, department, employment_type, max_hours, current_load_percentage, is_active)
SELECT 'b2222222-2222-2222-2222-222222222222', 'Computer Science', 'full-time', 40, 85.0, true
WHERE EXISTS (SELECT 1 FROM public.profiles WHERE id = 'b2222222-2222-2222-2222-222222222222');

-- Create teacher preferences
INSERT INTO public.teacher_preferences (teacher_id, preferred_days, morning_available, afternoon_available, evening_available, max_consecutive_hours, notes)
SELECT t.id, '{"Monday","Tuesday","Wednesday","Thursday","Friday"}', true, true, false, 4, 'Prefers morning classes on Monday and Wednesday'
FROM public.teachers t WHERE t.profile_id = 'b2222222-2222-2222-2222-222222222222'
ON CONFLICT (teacher_id) DO NOTHING;

-- Update profiles with extra info
UPDATE public.profiles SET department = 'Administration' WHERE id = 'a1111111-1111-1111-1111-111111111111';
UPDATE public.profiles SET department = 'Computer Science' WHERE id = 'b2222222-2222-2222-2222-222222222222';
UPDATE public.profiles SET program = 'BSIT', year_level = 3, section = 'BSIT 301-A' WHERE id = 'c3333333-3333-3333-3333-333333333333';

-- Create some demo schedules
INSERT INTO public.schedules (subject_id, teacher_id, room_id, section_id, day_of_week, start_time, end_time, status)
SELECT
  s.id, t.id, r.id, sec.id,
  'Tuesday', '08:00', '10:00', 'published'
FROM public.subjects s, public.teachers t, public.rooms r, public.sections sec
WHERE s.code = 'CS201' AND t.profile_id = 'b2222222-2222-2222-2222-222222222222'
  AND r.name = 'Room 302' AND sec.name = 'BSIT 301-A';

INSERT INTO public.schedules (subject_id, teacher_id, room_id, section_id, day_of_week, start_time, end_time, status)
SELECT
  s.id, t.id, r.id, sec.id,
  'Tuesday', '10:00', '12:00', 'published'
FROM public.subjects s, public.teachers t, public.rooms r, public.sections sec
WHERE s.code = 'IT301' AND t.profile_id = 'b2222222-2222-2222-2222-222222222222'
  AND r.name = 'Lab 3' AND sec.name = 'BSCS 201-B';

INSERT INTO public.schedules (subject_id, teacher_id, room_id, section_id, day_of_week, start_time, end_time, status)
SELECT
  s.id, t.id, r.id, sec.id,
  'Tuesday', '13:00', '15:00', 'published'
FROM public.subjects s, public.teachers t, public.rooms r, public.sections sec
WHERE s.code = 'IT302' AND t.profile_id = 'b2222222-2222-2222-2222-222222222222'
  AND r.name = 'Room 305' AND sec.name = 'BSIT 401-A';

-- Done!
-- Login credentials:
-- Admin:   admin@optisched.sti.edu   / Admin123!
-- Teacher: teacher@optisched.sti.edu / Teacher123!
-- Student: student@optisched.sti.edu / Student123!
