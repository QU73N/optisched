-- Create profile records for admin roles and missing students
-- IMPORTANT: Auth users must be created first via Supabase Dashboard or CLI
-- Then run this script to create the corresponding profile records

-- Get section IDs
DO $$
DECLARE
  mawd_11a_id uuid;
  abm_12a_id uuid;
  stem_12a_id uuid;
BEGIN
  SELECT id INTO mawd_11a_id FROM sections WHERE name = 'MAWD-11a' LIMIT 1;
  SELECT id INTO abm_12a_id FROM sections WHERE name = 'ABM-12a' LIMIT 1;
  SELECT id INTO stem_12a_id FROM sections WHERE name = 'STEM-12a' LIMIT 1;
  
  RAISE NOTICE 'Section IDs - MAWD-11a: %, ABM-12a: %, STEM-12a: %', mawd_11a_id, abm_12a_id, stem_12a_id;
END $$;

-- Power Admin Profile (replace UUID with actual auth user ID)
INSERT INTO profiles (id, email, full_name, role) 
VALUES ('REPLACE-WITH-POWER-ADMIN-UUID', 'power.admin@optisched.sti.edu', 'Power Admin', 'power_admin')
ON CONFLICT (id) DO NOTHING;

-- System Admin Profile (replace UUID with actual auth user ID)
INSERT INTO profiles (id, email, full_name, role) 
VALUES ('REPLACE-WITH-SYSTEM-ADMIN-UUID', 'system.admin@optisched.sti.edu', 'System Admin', 'system_admin')
ON CONFLICT (id) DO NOTHING;

-- Schedule Admin Profile (replace UUID with actual auth user ID)
INSERT INTO profiles (id, email, full_name, role) 
VALUES ('REPLACE-WITH-SCHEDULE-ADMIN-UUID', 'schedule.admin@optisched.sti.edu', 'Schedule Admin', 'schedule_admin')
ON CONFLICT (id) DO NOTHING;

-- Schedule Manager Profile (replace UUID with actual auth user ID)
INSERT INTO profiles (id, email, full_name, role) 
VALUES ('REPLACE-WITH-SCHEDULE-MANAGER-UUID', 'schedule.manager@optisched.sti.edu', 'Schedule Manager', 'schedule_manager')
ON CONFLICT (id) DO NOTHING;

-- Student for MAWD-11a (replace UUID with actual auth user ID)
INSERT INTO profiles (id, email, full_name, role) 
VALUES ('REPLACE-WITH-MAWD11-STUDENT-UUID', 'mawd11.student@optisched.sti.edu', 'MAWD11 Student', 'student')
ON CONFLICT (id) DO NOTHING;

-- Student for ABM-12a (replace UUID with actual auth user ID)
INSERT INTO profiles (id, email, full_name, role) 
VALUES ('REPLACE-WITH-ABM12-STUDENT-UUID', 'abm12.student@optisched.sti.edu', 'ABM12 Student', 'student')
ON CONFLICT (id) DO NOTHING;

-- Student for STEM-12a (replace UUID with actual auth user ID)
INSERT INTO profiles (id, email, full_name, role) 
VALUES ('REPLACE-WITH-STEM12-STUDENT-UUID', 'stem12.student@optisched.sti.edu', 'STEM12 Student', 'student')
ON CONFLICT (id) DO NOTHING;

-- Create student records after profiles are created
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
    RAISE NOTICE 'Created student for MAWD-11a';
  END IF;
  
  IF abm_12a_id IS NOT NULL AND abm12_profile_id IS NOT NULL THEN
    INSERT INTO students (profile_id, section_id, student_number, is_active)
    VALUES (abm12_profile_id, abm_12a_id, 'ABM12-001', true)
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Created student for ABM-12a';
  END IF;
  
  IF stem_12a_id IS NOT NULL AND stem12_profile_id IS NOT NULL THEN
    INSERT INTO students (profile_id, section_id, student_number, is_active)
    VALUES (stem12_profile_id, stem_12a_id, 'STEM12-001', true)
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Created student for STEM-12a';
  END IF;
END $$;

-- Verify created profiles
SELECT id, email, full_name, role FROM profiles 
WHERE email IN (
  'power.admin@optisched.sti.edu',
  'system.admin@optisched.sti.edu',
  'schedule.admin@optisched.sti.edu',
  'schedule.manager@optisched.sti.edu',
  'mawd11.student@optisched.sti.edu',
  'abm12.student@optisched.sti.edu',
  'stem12.student@optisched.sti.edu'
)
ORDER BY role, full_name;
