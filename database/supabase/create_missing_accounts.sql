-- Create missing admin role accounts
-- These will be created in the profiles table
-- Note: Auth users must be created via Supabase Auth API/CLI first
-- Then we insert the profile records here

-- Get section IDs for student assignment
DO $$
DECLARE
  mawd_11a_id uuid;
  abm_12a_id uuid;
  stem_12a_id uuid;
BEGIN
  SELECT id INTO mawd_11a_id FROM sections WHERE name = 'MAWD-11a' LIMIT 1;
  SELECT id INTO abm_12a_id FROM sections WHERE name = 'ABM-12a' LIMIT 1;
  SELECT id INTO stem_12a_id FROM sections WHERE name = 'STEM-12a' LIMIT 1;
  
  RAISE NOTICE 'MAWD-11a ID: %', mawd_11a_id;
  RAISE NOTICE 'ABM-12a ID: %', abm_12a_id;
  RAISE NOTICE 'STEM-12a ID: %', stem_12a_id;
END $$;

-- After creating auth users, insert profile records with these IDs
-- Power Admin
INSERT INTO profiles (id, email, full_name, role) 
VALUES ('power-admin-uuid-1', 'power.admin@optisched.sti.edu', 'Power Admin', 'power_admin')
ON CONFLICT (id) DO NOTHING;

-- System Admin
INSERT INTO profiles (id, email, full_name, role) 
VALUES ('system-admin-uuid-1', 'system.admin@optisched.sti.edu', 'System Admin', 'system_admin')
ON CONFLICT (id) DO NOTHING;

-- Schedule Admin
INSERT INTO profiles (id, email, full_name, role) 
VALUES ('schedule-admin-uuid-1', 'schedule.admin@optisched.sti.edu', 'Schedule Admin', 'schedule_admin')
ON CONFLICT (id) DO NOTHING;

-- Schedule Manager
INSERT INTO profiles (id, email, full_name, role) 
VALUES ('schedule-manager-uuid-1', 'schedule.manager@optisched.sti.edu', 'Schedule Manager', 'schedule_manager')
ON CONFLICT (id) DO NOTHING;

-- Student for MAWD-11a
INSERT INTO profiles (id, email, full_name, role) 
VALUES ('student-mawd11-uuid-1', 'mawd11.student@optisched.sti.edu', 'MAWD11 Student', 'student')
ON CONFLICT (id) DO NOTHING;

-- Student for ABM-12a
INSERT INTO profiles (id, email, full_name, role) 
VALUES ('student-abm12-uuid-1', 'abm12.student@optisched.sti.edu', 'ABM12 Student', 'student')
ON CONFLICT (id) DO NOTHING;

-- Student for STEM-12a
INSERT INTO profiles (id, email, full_name, role) 
VALUES ('student-stem12-uuid-1', 'stem12.student@optisched.sti.edu', 'STEM12 Student', 'student')
ON CONFLICT (id) DO NOTHING;

-- After creating student profiles, create student records
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
  
  -- Create student records
  INSERT INTO students (profile_id, section_id, student_number, is_active)
  VALUES (mawd11_profile_id, mawd_11a_id, 'MAWD11-001', true)
  ON CONFLICT DO NOTHING;
  
  INSERT INTO students (profile_id, section_id, student_number, is_active)
  VALUES (abm12_profile_id, abm_12a_id, 'ABM12-001', true)
  ON CONFLICT DO NOTHING;
  
  INSERT INTO students (profile_id, section_id, student_number, is_active)
  VALUES (stem12_profile_id, stem_12a_id, 'STEM12-001', true)
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE 'Student records created';
END $$;
