-- Migration: 017_seed_teachers_if_empty.sql
-- Description: Seed teachers if teachers table is empty (fix for faculty hub showing no teachers)

-- Only seed if teachers table is empty to avoid conflicts
DO $$
BEGIN
    -- Seed teachers if empty (create sample teachers with profiles)
    IF NOT EXISTS (SELECT 1 FROM public.teachers LIMIT 1) THEN
        -- First, create sample profiles for teachers if they don't exist
        INSERT INTO public.profiles (id, full_name, email, role, department)
        VALUES
            ('d1111111-1111-1111-1111-111111111111', 'Dr. Maria Santos', 'maria.santos@optisched.sti.edu', 'teacher', 'Computer Science'),
            ('e2222222-2222-2222-2222-222222222222', 'Prof. Juan dela Cruz', 'juan.delacruz@optisched.sti.edu', 'teacher', 'Information Technology'),
            ('f3333333-3333-3333-3333-333333333333', 'Engr. Ana Reyes', 'ana.reyes@optisched.sti.edu', 'teacher', 'Computer Science'),
            ('g4444444-4444-4444-4444-444444444444', 'Ms. Carla Mendoza', 'carla.mendoza@optisched.sti.edu', 'teacher', 'Mathematics'),
            ('h5555555-5555-5555-5555-555555555555', 'Dr. Robert Tan', 'robert.tan@optisched.sti.edu', 'teacher', 'Information Technology')
        ON CONFLICT (id) DO NOTHING;

        -- Create teacher records linked to profiles
        INSERT INTO public.teachers (profile_id, department, employment_type, max_hours, current_load_percentage, is_active)
        VALUES
            ('d1111111-1111-1111-1111-111111111111', 'Computer Science', 'full-time', 40, 75.0, true),
            ('e2222222-2222-2222-2222-222222222222', 'Information Technology', 'full-time', 40, 80.0, true),
            ('f3333333-3333-3333-3333-333333333333', 'Computer Science', 'full-time', 40, 65.0, true),
            ('g4444444-4444-4444-4444-444444444444', 'Mathematics', 'part-time', 20, 90.0, true),
            ('h5555555-5555-5555-5555-555555555555', 'Information Technology', 'full-time', 40, 70.0, true)
        ON CONFLICT DO NOTHING;

        -- Create teacher preferences for each
        INSERT INTO public.teacher_preferences (teacher_id, preferred_days, morning_available, afternoon_available, evening_available, max_consecutive_hours, notes)
        SELECT t.id, '{"Monday","Tuesday","Wednesday","Thursday","Friday"}', true, true, false, 4, 'Standard availability'
        FROM public.teachers t
        WHERE t.profile_id IN ('d1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222', 'f3333333-3333-3333-3333-333333333333', 'g4444444-4444-4444-4444-444444444444', 'h5555555-5555-5555-5555-555555555555')
        ON CONFLICT (teacher_id) DO NOTHING;
    END IF;

    -- Seed sample schedules if empty (so teachers have workloads to show)
    IF NOT EXISTS (SELECT 1 FROM public.schedules LIMIT 1) THEN
        INSERT INTO public.schedules (subject_id, teacher_id, room_id, section_id, day_of_week, start_time, end_time, status)
        SELECT
            s.id, t.id, r.id, sec.id,
            'Monday', '08:00', '10:00', 'published'
        FROM public.subjects s, public.teachers t, public.rooms r, public.sections sec
        WHERE s.code = 'CS101' AND t.profile_id = 'd1111111-1111-1111-1111-111111111111'
            AND r.name = 'Room 101' AND sec.name = 'BSIT 101-A'
        LIMIT 1;

        INSERT INTO public.schedules (subject_id, teacher_id, room_id, section_id, day_of_week, start_time, end_time, status)
        SELECT
            s.id, t.id, r.id, sec.id,
            'Tuesday', '10:00', '12:00', 'published'
        FROM public.subjects s, public.teachers t, public.rooms r, public.sections sec
        WHERE s.code = 'IT201' AND t.profile_id = 'e2222222-2222-2222-2222-222222222222'
            AND r.name = 'Lab 1' AND sec.name = 'BSIT 201-A'
        LIMIT 1;

        INSERT INTO public.schedules (subject_id, teacher_id, room_id, section_id, day_of_week, start_time, end_time, status)
        SELECT
            s.id, t.id, r.id, sec.id,
            'Wednesday', '13:00', '15:00', 'published'
        FROM public.subjects s, public.teachers t, public.rooms r, public.sections sec
        WHERE s.code = 'CS301' AND t.profile_id = 'f3333333-3333-3333-3333-333333333333'
            AND r.name = 'Lab 2' AND sec.name = 'BSIT 301-A'
        LIMIT 1;
    END IF;

    RAISE NOTICE 'Teachers and sample schedules seeded successfully (if tables were empty)';
END $$;
