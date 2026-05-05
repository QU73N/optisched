-- Setup script for rooms, subjects, and sections
-- This script resets the data and populates it according to requirements
-- Note: Teachers are not created here as they require Supabase Auth users
-- Existing admin profile is used as temporary teacher assignment

-- Step 1: Delete existing data in correct order (respecting foreign keys)
DELETE FROM public.schedules;
DELETE FROM public.teacher_preferences;
DELETE FROM public.subjects;
DELETE FROM public.sections;
DELETE FROM public.teachers;
DELETE FROM public.rooms;

-- Step 2: Create rooms
DO $$
BEGIN
    INSERT INTO public.rooms (id, name, type, building, floor, capacity, is_available, is_public, created_at) VALUES
        -- Common rooms (all floor 2, all Main Building)
        (gen_random_uuid(), 'Room 101', 'common', 'Main Building', 2, 30, true, true, NOW()),
        (gen_random_uuid(), 'Room 102', 'common', 'Main Building', 2, 30, true, true, NOW()),
        (gen_random_uuid(), 'Room 103', 'common', 'Main Building', 2, 30, true, true, NOW()),
        (gen_random_uuid(), 'Room 104', 'common', 'Main Building', 2, 30, true, true, NOW()),
        (gen_random_uuid(), 'Room 105', 'common', 'Main Building', 2, 30, true, true, NOW()),
        (gen_random_uuid(), 'Room 106', 'common', 'Main Building', 2, 30, true, true, NOW()),
        (gen_random_uuid(), 'Room 107', 'common', 'Main Building', 2, 30, true, true, NOW()),
        (gen_random_uuid(), 'Room 108', 'common', 'Main Building', 2, 30, true, true, NOW()),
        (gen_random_uuid(), 'Amphitheater', 'common', 'Main Building', 2, 35, true, true, NOW()),
        (gen_random_uuid(), 'Network Laboratory', 'common', 'Main Building', 2, 30, true, true, NOW()),
        -- Special rooms (all floor 2, all Main Building)
        (gen_random_uuid(), 'Physics Laboratory', 'special', 'Main Building', 2, 30, true, true, NOW()),
        (gen_random_uuid(), 'Chemical Laboratory', 'special', 'Main Building', 2, 30, true, true, NOW()),
        (gen_random_uuid(), 'Kitchen', 'special', 'Main Building', 2, 15, true, true, NOW()),
        (gen_random_uuid(), 'P.E. Hall', 'special', 'Main Building', 1, 35, true, true, NOW());
    
    RAISE NOTICE 'Rooms created';
END $$;

-- Step 3: Create sections
DO $$
BEGIN
    INSERT INTO public.sections (id, name, program, year_level, student_count, is_public, created_at) VALUES
        (gen_random_uuid(), 'MAWD-11a', 'MAWD', 11, 30, true, NOW()),
        (gen_random_uuid(), 'MAWD-12a', 'MAWD', 12, 30, true, NOW()),
        (gen_random_uuid(), 'STEM-11a', 'STEM', 11, 30, true, NOW()),
        (gen_random_uuid(), 'STEM-12a', 'STEM', 12, 30, true, NOW()),
        (gen_random_uuid(), 'ABM-11a', 'ABM', 11, 30, true, NOW()),
        (gen_random_uuid(), 'ABM-12a', 'ABM', 12, 30, true, NOW());
    
    RAISE NOTICE 'Sections created';
END $$;

-- Step 4: Create subjects (without teacher_id - to be assigned later)
DO $$
DECLARE
    admin_id UUID;
BEGIN
    -- Get admin profile ID for owner_id
    SELECT id INTO admin_id FROM public.profiles WHERE email = 'admin.9999@optisched.sti.edu' LIMIT 1;
    
    -- Special subjects (requires_lab = true, type = special)
    INSERT INTO public.subjects (id, code, name, type, program, year_level, requires_lab, sessions_per_week, duration_hours, owner_id, is_public, created_at) VALUES
        (gen_random_uuid(), 'PHYS12', 'Physical Science', 'special', 'MAWD', 12, true, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'CHEM11', 'Chemical Science', 'special', 'MAWD', 11, true, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'CP1', 'Computer Programming 1', 'special', 'MAWD', 11, true, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'CP2', 'Computer Programming 2', 'special', 'MAWD', 11, true, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'CP3', 'Computer Programming 3', 'special', 'MAWD', 12, true, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'CP4', 'Computer Programming 4', 'special', 'MAWD', 11, true, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'MP1', 'Mobile Programming 1', 'special', 'MAWD', 11, true, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'MP2', 'Mobile Programming 2', 'special', 'MAWD', 12, true, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'PEH1', 'Physical Education and Health 1', 'special', 'ALL', 11, true, 2, 2, admin_id, true, NOW()),
        (gen_random_uuid(), 'PEH2', 'Physical Education and Health 2', 'special', 'ALL', 12, true, 2, 2, admin_id, true, NOW()),
        (gen_random_uuid(), 'GC1', 'General Chemistry 1', 'special', 'STEM', 11, true, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'GC2', 'General Chemistry 2', 'special', 'STEM', 12, true, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'GP1', 'General Physics 1', 'special', 'STEM', 11, true, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'GP2', 'General Physics 2', 'special', 'STEM', 12, true, 3, 3, admin_id, true, NOW());
    
    -- Common subjects (requires_lab = false, type = common)
    -- Core subjects (apply to ALL programs)
    INSERT INTO public.subjects (id, code, name, type, program, year_level, requires_lab, sessions_per_week, duration_hours, owner_id, is_public, created_at) VALUES
        (gen_random_uuid(), 'MIL', 'Media Information Literacy', 'common', 'ALL', 11, false, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'UCSP', 'Understanding Culture, Society, and Politics', 'common', 'ALL', 11, false, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'PR1', 'Practical Research 1', 'common', 'ALL', 11, false, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'III', 'Inquiries, Investigation, and Immersion', 'common', 'ALL', 12, false, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'WI', 'Work Immersion', 'common', 'ALL', 12, false, 2, 2, admin_id, true, NOW()),
        (gen_random_uuid(), 'CPAR', 'Contemporary Philippine Arts from the Regions', 'common', 'ALL', 12, false, 3, 3, admin_id, true, NOW());
    
    -- Specialized subjects (program-specific)
    INSERT INTO public.subjects (id, code, name, type, program, year_level, requires_lab, sessions_per_week, duration_hours, owner_id, is_public, created_at) VALUES
        (gen_random_uuid(), 'ENTREP', 'Entrepreneurship', 'common', 'MAWD', 12, false, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'STAT', 'Statistics and Probability', 'common', 'MAWD', 11, false, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'ABM', 'Accountancy & Business Management', 'common', 'ABM', 11, false, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'BESR', 'Business Ethics & Social Responsibility', 'common', 'ABM', 12, false, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'CALC', 'Basic Calculus', 'common', 'ABM', 11, false, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'APECON', 'Applied Economics', 'common', 'ABM', 12, false, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'ELEC', 'Electronics', 'common', 'STEM', 11, false, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'ROBO', 'Robotics', 'common', 'STEM', 12, false, 3, 3, admin_id, true, NOW());
    
    -- Applied subjects (program-specific)
    INSERT INTO public.subjects (id, code, name, type, program, year_level, requires_lab, sessions_per_week, duration_hours, owner_id, is_public, created_at) VALUES
        (gen_random_uuid(), 'ET-ABM', 'Empowerment Technologies: ABM', 'common', 'ABM', 12, false, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'ET-ICT', 'Empowerment Technologies: ICT', 'common', 'MAWD', 12, false, 3, 3, admin_id, true, NOW()),
        (gen_random_uuid(), 'ET-STEM', 'Empowerment Technologies: STEM', 'common', 'STEM', 12, false, 3, 3, admin_id, true, NOW());
    
    RAISE NOTICE 'Subjects created';
END $$;

-- Verification queries
SELECT 'Rooms' as table_name, COUNT(*) as count FROM public.rooms
UNION ALL
SELECT 'Subjects', COUNT(*) FROM public.subjects
UNION ALL
SELECT 'Teachers', COUNT(*) FROM public.teachers
UNION ALL
SELECT 'Sections', COUNT(*) FROM public.sections;
