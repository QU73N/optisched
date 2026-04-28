-- Migration: 016_reseed_data_if_empty.sql
-- Description: Re-seed data if tables are empty (fix for "all data showing 0" issue)

-- Only seed if data is missing to avoid conflicts
DO $$
BEGIN
    -- Seed subjects if empty
    IF NOT EXISTS (SELECT 1 FROM public.subjects LIMIT 1) THEN
        INSERT INTO public.subjects (code, name, units, type, duration_hours, program, year_level, requires_lab)
        VALUES
            ('CS101', 'Introduction to Computer Science', 3, 'lecture', 3.0, 'BSIT', 1, false),
            ('CS201', 'Data Structures', 3, 'lecture', 3.0, 'BSIT', 2, false),
            ('CS301', 'Database Systems', 3, 'laboratory', 3.0, 'BSIT', 3, true),
            ('CS401', 'Software Engineering', 3, 'lecture', 3.0, 'BSIT', 4, false),
            ('IT101', 'Fundamentals of IT', 3, 'lecture', 3.0, 'BSIT', 1, false),
            ('IT201', 'Web Development', 3, 'laboratory', 3.0, 'BSIT', 2, true),
            ('IT301', 'Network Fundamentals', 3, 'lecture', 3.0, 'BSIT', 3, false),
            ('IT401', 'Capstone Project', 3, 'lecture', 3.0, 'BSIT', 4, false),
            ('MATH101', 'College Algebra', 3, 'lecture', 3.0, 'BSIT', 1, false),
            ('MATH201', 'Calculus', 3, 'lecture', 3.0, 'BSIT', 2, false);
    END IF;

    -- Seed rooms if empty
    IF NOT EXISTS (SELECT 1 FROM public.rooms LIMIT 1) THEN
        INSERT INTO public.rooms (name, capacity, type, building, floor, equipment)
        VALUES
            ('Room 101', 50, 'lecture', 'Main Building', 1, '{"whiteboard","projector"}'),
            ('Room 102', 45, 'lecture', 'Main Building', 1, '{"whiteboard","projector"}'),
            ('Room 201', 40, 'lecture', 'Main Building', 2, '{"whiteboard","projector"}'),
            ('Room 202', 40, 'lecture', 'Main Building', 2, '{"whiteboard","projector"}'),
            ('Lab 1', 30, 'computer_lab', 'IT Building', 1, '{"computers","projector","whiteboard"}'),
            ('Lab 2', 30, 'computer_lab', 'IT Building', 1, '{"computers","projector","whiteboard"}'),
            ('Lab 3', 30, 'computer_lab', 'IT Building', 2, '{"computers","projector","whiteboard"}'),
            ('Conference Room', 20, 'conference', 'Admin Building', 1, '{"projector","whiteboard"}');
    END IF;

    -- Seed sections if empty
    IF NOT EXISTS (SELECT 1 FROM public.sections LIMIT 1) THEN
        INSERT INTO public.sections (name, program, year_level, student_count)
        VALUES
            ('BSIT 101-A', 'BSIT', 1, 35),
            ('BSIT 101-B', 'BSIT', 1, 35),
            ('BSIT 201-A', 'BSIT', 2, 30),
            ('BSIT 201-B', 'BSIT', 2, 30),
            ('BSIT 301-A', 'BSIT', 3, 25),
            ('BSIT 301-B', 'BSIT', 3, 25),
            ('BSIT 401-A', 'BSIT', 4, 20),
            ('BSIT 401-B', 'BSIT', 4, 20),
            ('BSCS 101-A', 'BSCS', 1, 35),
            ('BSCS 201-B', 'BSCS', 2, 30);
    END IF;

    RAISE NOTICE 'Data re-seeded successfully (if tables were empty)';
END $$;
