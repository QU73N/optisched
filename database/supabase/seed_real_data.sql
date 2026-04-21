-- ============================================
-- OptiSched: Real Schedule Data for MAWD 12A-2
-- Run this in Supabase SQL Editor AFTER migration.sql
-- ============================================

-- Clean existing seed data conflicts
DELETE FROM public.schedules
WHERE
    section_id IN (
        SELECT id
        FROM public.sections
        WHERE
            name = 'MAWD 12A-2'
    );

DELETE FROM public.sections WHERE name = 'MAWD 12A-2';

-- Rooms (upsert)
INSERT INTO
    public.rooms (
        name,
        capacity,
        type,
        building,
        floor,
        equipment
    )
VALUES (
        'PEH001',
        50,
        'gymnasium',
        'Main',
        1,
        '{"sports_equipment"}'
    ),
    (
        'COM001',
        40,
        'computer_lab',
        'IT Building',
        1,
        '{"computers","projector","whiteboard"}'
    ),
    (
        'RM101',
        45,
        'lecture',
        'Main',
        1,
        '{"whiteboard","projector"}'
    ),
    (
        'RM102',
        45,
        'lecture',
        'Main',
        1,
        '{"whiteboard","projector"}'
    ) ON CONFLICT (name) DO NOTHING;

-- Section
INSERT INTO
    public.sections (
        name,
        program,
        year_level,
        student_count
    )
VALUES ('MAWD 12A-2', 'MAWD', 12, 35) ON CONFLICT (name) DO NOTHING;

-- Subjects
INSERT INTO
    public.subjects (
        code,
        name,
        units,
        type,
        duration_hours,
        program,
        year_level,
        requires_lab
    )
VALUES (
        'PEH4',
        'Physical Education and Health 4',
        2,
        'lecture',
        2.0,
        'MAWD',
        12,
        false
    ),
    (
        'CWPNC3',
        'Computer/Web Programming NC III',
        3,
        'laboratory',
        3.0,
        'MAWD',
        12,
        true
    ),
    (
        'MAP2',
        'Mobile App Programming 2',
        3,
        'laboratory',
        3.0,
        'MAWD',
        12,
        true
    ),
    (
        'CPAR',
        'Contemporary Philippine Arts from the Regions',
        3,
        'lecture',
        3.0,
        'MAWD',
        12,
        false
    ),
    (
        'HR',
        'Homeroom',
        1,
        'lecture',
        1.0,
        'MAWD',
        12,
        false
    ),
    (
        'WIP',
        'Work Immersion-Practicum Type',
        3,
        'lecture',
        3.0,
        'MAWD',
        12,
        false
    ),
    (
        'III',
        'Inquiries, Investigations and Immersion',
        3,
        'lecture',
        1.5,
        'MAWD',
        12,
        false
    ),
    (
        'ETICT',
        'Empowerment Technologies: ICT',
        3,
        'laboratory',
        3.0,
        'MAWD',
        12,
        true
    ),
    (
        'ENTREP',
        'Entrepreneurship',
        3,
        'lecture',
        3.0,
        'MAWD',
        12,
        false
    ) ON CONFLICT (code) DO NOTHING;

-- Done! Now run create_all_users.mjs to create teacher accounts.
-- Then run seed_schedule_entries.sql to insert schedule entries.