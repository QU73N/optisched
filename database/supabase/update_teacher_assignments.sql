-- Update teacher assignments based on subject requirements
-- Clear existing subject_teachers data first
DELETE FROM subject_teachers;

-- Teacher IDs (using first record for each teacher)
-- Reneil P. Arnado: aa846fa8-bebd-4371-99d0-e1f16e14dbce (business subjects)
-- Bea Angely Magno: 56064537-cd79-47aa-915d-b94058417f7e (math subjects)
-- Ello Jr., Egnacio Y.: bbc91167-72c7-4244-9b4d-27efbe79f4c3 (research/immersion subjects)
-- Edgar Habana: 7949b2d0-4c7c-4849-b6f5-17a78ce1c1a8 (contemporary arts and PE)
-- John Michael Calizon: ad94a951-40b4-4c52-acc2-738eee2a805a (computer programming and empowerment technologies)
-- Psalmmiracle Pineda Mariano: ffcc2c0a-9c1d-49b1-b248-9e42f3414c4d (mobile programming)
-- Mary Jane Balando: 31c5a71a-a5f6-4203-b262-2d603351f5d2 (physics, part-time, Saturday only)
-- Mark Gerald Doblon: bc211fd8-9917-4114-af3c-6b4694a9cc1c (chemistry, part-time, Saturday only)

-- Reneil P. Arnado - Business subjects
INSERT INTO subject_teachers (subject_id, teacher_id)
SELECT id, 'aa846fa8-bebd-4371-99d0-e1f16e14dbce'
FROM subjects
WHERE name IN (
    'Accountancy & Business Management',
    'Business Ethics & Social Responsibility',
    'Entrepreneurship',
    'Applied Economics'
)
ON CONFLICT (subject_id, teacher_id) DO NOTHING;

-- Bea Angely Magno - Math subjects
INSERT INTO subject_teachers (subject_id, teacher_id)
SELECT id, '56064537-cd79-47aa-915d-b94058417f7e'
FROM subjects
WHERE name IN (
    'Basic Calculus',
    'Statistics and Probability'
)
ON CONFLICT (subject_id, teacher_id) DO NOTHING;

-- Ello Jr., Egnacio Y. - Research/Immersion subjects
INSERT INTO subject_teachers (subject_id, teacher_id)
SELECT id, 'bbc91167-72c7-4244-9b4d-27efbe79f4c3'
FROM subjects
WHERE name IN (
    'Practical Research 1',
    'Inquiries, Investigation, and Immersion',
    'Work Immersion'
)
ON CONFLICT (subject_id, teacher_id) DO NOTHING;

-- Edgar Habana - Contemporary Arts and PE
INSERT INTO subject_teachers (subject_id, teacher_id)
SELECT id, '7949b2d0-4c7c-4849-b6f5-17a78ce1c1a8'
FROM subjects
WHERE name IN (
    'Contemporary Philippine Arts from the Regions',
    'Physical Education and Health 1',
    'Physical Education and Health 2'
)
ON CONFLICT (subject_id, teacher_id) DO NOTHING;

-- John Michael Calizon - Computer Programming and Empowerment Technologies
INSERT INTO subject_teachers (subject_id, teacher_id)
SELECT id, 'ad94a951-40b4-4c52-acc2-738eee2a805a'
FROM subjects
WHERE name IN (
    'Computer Programming 1',
    'Computer Programming 2',
    'Computer Programming 3',
    'Computer Programming 4',
    'Empowerment Technologies: ICT',
    'Empowerment Technologies: STEM',
    'Empowerment Technologies: ABM'
)
ON CONFLICT (subject_id, teacher_id) DO NOTHING;

-- Psalmmiracle Pineda Mariano - Mobile Programming
INSERT INTO subject_teachers (subject_id, teacher_id)
SELECT id, 'ffcc2c0a-9c1d-49b1-b248-9e42f3414c4d'
FROM subjects
WHERE name IN (
    'Mobile Programming 1',
    'Mobile Programming 2'
)
ON CONFLICT (subject_id, teacher_id) DO NOTHING;

-- Mary Jane Balando - Physics (part-time, Saturday only)
INSERT INTO subject_teachers (subject_id, teacher_id)
SELECT id, '31c5a71a-a5f6-4203-b262-2d603351f5d2'
FROM subjects
WHERE name IN (
    'Physical Science',
    'General Physics 1',
    'General Physics 2'
)
ON CONFLICT (subject_id, teacher_id) DO NOTHING;

-- Mark Gerald Doblon - Chemistry (part-time, Saturday only)
INSERT INTO subject_teachers (subject_id, teacher_id)
SELECT id, 'bc211fd8-9917-4114-af3c-6b4694a9cc1c'
FROM subjects
WHERE name IN (
    'Chemical Science',
    'General Chemistry 1',
    'General Chemistry 2'
)
ON CONFLICT (subject_id, teacher_id) DO NOTHING;

-- Remaining subjects (Electronics, Robotics, Media Information Literacy, Understanding Culture, Society, and Politics)
-- Assign to Reneil P. Arnado as default for now (can be reassigned later)
INSERT INTO subject_teachers (subject_id, teacher_id)
SELECT id, 'aa846fa8-bebd-4371-99d0-e1f16e14dbce'
FROM subjects
WHERE name IN (
    'Electronics',
    'Robotics',
    'Media Information Literacy',
    'Understanding Culture, Society, and Politics'
)
ON CONFLICT (subject_id, teacher_id) DO NOTHING;

-- Update teacher employment type and availability for part-time teachers
UPDATE teachers
SET employment_type = 'part-time'
WHERE id IN ('31c5a71a-a5f6-4203-b262-2d603351f5d2', 'bc211fd8-9917-4114-af3c-6b4694a9cc1c');

-- Update teacher preferences for part-time teachers (Saturday only)
UPDATE teacher_preferences
SET preferred_days = ARRAY['Saturday']::text[]
WHERE teacher_id IN ('31c5a71a-a5f6-4203-b262-2d603351f5d2', 'bc211fd8-9917-4114-af3c-6b4694a9cc1c');

-- Verify assignments
SELECT s.name as subject, p.full_name as teacher, t.employment_type
FROM subject_teachers st
JOIN subjects s ON st.subject_id = s.id
JOIN teachers t ON st.teacher_id = t.id
JOIN profiles p ON t.profile_id = p.id
ORDER BY s.name;
