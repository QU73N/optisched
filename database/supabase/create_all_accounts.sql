-- Create all missing admin and student accounts
-- This script creates auth users and profile records

-- Default password for all new accounts: OptiSched2024!
-- Users should change their password on first login

-- Power Admin
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'power.admin@optisched.sti.edu',
  crypt('OptiSched2024!', gen_salt('bf')),
  now(),
  '{"full_name":"Power Admin","role":"power_admin"}',
  '{"provider":"email"}',
  now(),
  now()
)
ON CONFLICT (email) DO NOTHING;

-- System Admin
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'system.admin@optisched.sti.edu',
  crypt('OptiSched2024!', gen_salt('bf')),
  now(),
  '{"full_name":"System Admin","role":"system_admin"}',
  '{"provider":"email"}',
  now(),
  now()
)
ON CONFLICT (email) DO NOTHING;

-- Schedule Admin
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'schedule.admin@optisched.sti.edu',
  crypt('OptiSched2024!', gen_salt('bf')),
  now(),
  '{"full_name":"Schedule Admin","role":"schedule_admin"}',
  '{"provider":"email"}',
  now(),
  now()
)
ON CONFLICT (email) DO NOTHING;

-- Schedule Manager
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'schedule.manager@optisched.sti.edu',
  crypt('OptiSched2024!', gen_salt('bf')),
  now(),
  '{"full_name":"Schedule Manager","role":"schedule_manager"}',
  '{"provider":"email"}',
  now(),
  now()
)
ON CONFLICT (email) DO NOTHING;

-- Student for MAWD-11a
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'mawd11.student@optisched.sti.edu',
  crypt('OptiSched2024!', gen_salt('bf')),
  now(),
  '{"full_name":"MAWD11 Student","role":"student"}',
  '{"provider":"email"}',
  now(),
  now()
)
ON CONFLICT (email) DO NOTHING;

-- Student for ABM-12a
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'abm12.student@optisched.sti.edu',
  crypt('OptiSched2024!', gen_salt('bf')),
  now(),
  '{"full_name":"ABM12 Student","role":"student"}',
  '{"provider":"email"}',
  now(),
  now()
)
ON CONFLICT (email) DO NOTHING;

-- Student for STEM-12a
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'stem12.student@optisched.sti.edu',
  crypt('OptiSched2024!', gen_salt('bf')),
  now(),
  '{"full_name":"STEM12 Student","role":"student"}',
  '{"provider":"email"}',
  now(),
  now()
)
ON CONFLICT (email) DO NOTHING;

-- Create profile records for the new auth users
INSERT INTO profiles (id, email, full_name, role)
SELECT 
  id, 
  email, 
  (raw_user_meta_data->>'full_name')::text as full_name,
  (raw_user_meta_data->>'role')::text as role
FROM auth.users
WHERE email IN (
  'power.admin@optisched.sti.edu',
  'system.admin@optisched.sti.edu',
  'schedule.admin@optisched.sti.edu',
  'schedule.manager@optisched.sti.edu',
  'mawd11.student@optisched.sti.edu',
  'abm12.student@optisched.sti.edu',
  'stem12.student@optisched.sti.edu'
)
ON CONFLICT (id) DO NOTHING;

-- Create student records for the new students
DO $$
DECLARE
  mawd_11a_id uuid;
  abm_12a_id uuid;
  stem_12a_id uuid;
  mawd11_profile_id uuid;
  abm12_profile_id uuid;
  stem12_profile_id uuid;
BEGIN
  SELECT id INTO mawd_11a_id FROM sections WHERE name = 'MAWD-11a' LIMIT 1;
  SELECT id INTO abm_12a_id FROM sections WHERE name = 'ABM-12a' LIMIT 1;
  SELECT id INTO stem_12a_id FROM sections WHERE name = 'STEM-12a' LIMIT 1;
  
  SELECT id INTO mawd11_profile_id FROM profiles WHERE email = 'mawd11.student@optisched.sti.edu' LIMIT 1;
  SELECT id INTO abm12_profile_id FROM profiles WHERE email = 'abm12.student@optisched.sti.edu' LIMIT 1;
  SELECT id INTO stem12_profile_id FROM profiles WHERE email = 'stem12.student@optisched.sti.edu' LIMIT 1;
  
  IF mawd_11a_id IS NOT NULL AND mawd11_profile_id IS NOT NULL THEN
    INSERT INTO students (profile_id, section_id, student_number, is_active)
    VALUES (mawd11_profile_id, mawd_11a_id, 'MAWD11-001', true)
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF abm_12a_id IS NOT NULL AND abm12_profile_id IS NOT NULL THEN
    INSERT INTO students (profile_id, section_id, student_number, is_active)
    VALUES (abm12_profile_id, abm_12a_id, 'ABM12-001', true)
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF stem_12a_id IS NOT NULL AND stem12_profile_id IS NOT NULL THEN
    INSERT INTO students (profile_id, section_id, student_number, is_active)
    VALUES (stem12_profile_id, stem_12a_id, 'STEM12-001', true)
    ON CONFLICT DO NOTHING;
  END IF;
  
  RAISE NOTICE 'Student records created successfully';
END $$;
