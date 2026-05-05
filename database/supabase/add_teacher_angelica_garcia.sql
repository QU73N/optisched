-- Add Angelica Marie R. Garcia with same capabilities as Reneil P. Arnado
-- This script creates a complete teacher record with all data needed for generation

-- Step 0: Create auth user for Angelica (for login)
-- Note: This requires admin privileges. If this fails, create the user manually in Supabase Dashboard
-- Email: angelica.garcia@optisched.sti.edu
-- Password: (You'll need to set this manually or use Supabase Dashboard)
-- The profile will be linked to this auth user via email

-- Step 1: Create profile for Angelica Marie R. Garcia
INSERT INTO profiles (id, email, full_name, role, avatar_url)
VALUES (
    gen_random_uuid(),
    'angelica.garcia@optisched.sti.edu',
    'Angelica Marie R. Garcia',
    'teacher',
    NULL
)
ON CONFLICT (email) DO NOTHING
RETURNING id as profile_id;

-- Store the profile_id for later use (you'll need to replace this with the actual ID from above)
-- For this script, we'll use a variable-like approach with CTE

WITH new_profile AS (
    SELECT id FROM profiles WHERE email = 'angelica.garcia@optisched.sti.edu'
),
new_teacher AS (
    INSERT INTO teachers (id, profile_id, full_name, email, employment_type, max_hours, max_classes_per_day, is_public, is_available)
    SELECT 
        gen_random_uuid(),
        (SELECT id FROM new_profile),
        'Angelica Marie R. Garcia',
        'angelica.garcia@optisched.sti.edu',
        'full-time',
        40,
        8,
        true,
        true
    FROM new_profile
    ON CONFLICT (email) DO NOTHING
    RETURNING id as teacher_id
)
-- Step 2: Create teacher preferences (same as Reneil - all days, all time slots)
INSERT INTO teacher_preferences (teacher_id, preferred_days, preferred_time_start, preferred_time_end)
SELECT 
    (SELECT id FROM new_teacher),
    ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']::text[],
    '07:00',
    '17:30'
FROM new_teacher
ON CONFLICT (teacher_id) DO NOTHING;

-- Step 3: Assign Angelica the same subjects as Reneil P. Arnado
-- Business subjects
INSERT INTO subject_teachers (subject_id, teacher_id)
SELECT 
    s.id, 
    (SELECT id FROM new_teacher)
FROM subjects s
WHERE s.name IN (
    'Accountancy & Business Management',
    'Business Ethics & Social Responsibility',
    'Entrepreneurship',
    'Applied Economics'
)
ON CONFLICT (subject_id, teacher_id) DO NOTHING;

-- Remaining subjects (Electronics, Robotics, Media Information Literacy, Understanding Culture, Society, and Politics)
INSERT INTO subject_teachers (subject_id, teacher_id)
SELECT 
    s.id, 
    (SELECT id FROM new_teacher)
FROM subjects s
WHERE s.name IN (
    'Electronics',
    'Robotics',
    'Media Information Literacy',
    'Understanding Culture, Society, and Politics'
)
ON CONFLICT (subject_id, teacher_id) DO NOTHING;

-- Verification: Show the created teacher and their subjects
SELECT 
    t.id as teacher_id,
    t.full_name,
    t.email,
    t.employment_type,
    t.max_hours,
    t.max_classes_per_day,
    t.is_public,
    t.is_available
FROM teachers t
WHERE t.email = 'angelica.garcia@optisched.sti.edu';

-- Show assigned subjects
SELECT 
    s.code,
    s.name,
    s.program,
    s.year_level,
    s.duration_hours
FROM subject_teachers st
JOIN subjects s ON st.subject_id = s.id
WHERE st.teacher_id = (SELECT id FROM teachers WHERE email = 'angelica.garcia@optisched.sti.edu')
ORDER BY s.code;

-- Show teacher preferences
SELECT 
    tp.teacher_id,
    t.full_name,
    tp.preferred_days,
    tp.preferred_time_start,
    tp.preferred_time_end
FROM teacher_preferences tp
JOIN teachers t ON tp.teacher_id = t.id
WHERE t.email = 'angelica.garcia@optisched.sti.edu';
