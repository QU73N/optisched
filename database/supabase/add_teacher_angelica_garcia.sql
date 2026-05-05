-- Add Angelica Marie R. Garcia as new teacher with same capabilities as Reneil P. Arnado
-- This script creates a complete teacher record with all data needed for generation

-- Name breakdown:
-- First name: Angelica Marie
-- Middle initial: R.
-- Last name: Garcia
-- Full name: Angelica Marie R. Garcia

-- Step 0: Create auth user for Angelica (for login)
-- Note: This requires admin privileges. If this fails, create the user manually in Supabase Dashboard
-- Email: angelica.garcia@optisched.sti.edu
-- Password: (You'll need to set this manually or use Supabase Dashboard)
-- The profile will be linked to this auth user via email

-- Step 1: Create profile for Angelica Marie R. Garcia
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE email = 'angelica.garcia@optisched.sti.edu') THEN
        INSERT INTO profiles (id, email, full_name, role, avatar_url)
        VALUES (
            gen_random_uuid(),
            'angelica.garcia@optisched.sti.edu',
            'Angelica Marie R. Garcia',
            'teacher',
            NULL
        );
    ELSE
        -- Profile exists, ensure full_name is correct
        UPDATE profiles 
        SET full_name = 'Angelica Marie R. Garcia'
        WHERE email = 'angelica.garcia@optisched.sti.edu';
    END IF;
END $$;

-- Step 2: Create teacher record
DO $$
DECLARE
    v_profile_id uuid;
    v_teacher_id uuid;
BEGIN
    -- Get the profile ID
    SELECT id INTO v_profile_id FROM profiles WHERE email = 'angelica.garcia@optisched.sti.edu';
    
    -- Check if teacher already exists (using profile_id since teachers table doesn't have email column)
    IF NOT EXISTS (SELECT 1 FROM teachers WHERE profile_id = v_profile_id) THEN
        -- Create teacher record (using correct column names)
        INSERT INTO teachers (id, profile_id, department, employment_type, max_hours, is_public, is_active)
        VALUES (
            gen_random_uuid(),
            v_profile_id,
            'Business',
            'full-time',
            40,
            true,
            true
        )
        RETURNING id INTO v_teacher_id;
        
        -- Create teacher preferences
        INSERT INTO teacher_preferences (teacher_id, preferred_days, preferred_time_start, preferred_time_end)
        VALUES (
            v_teacher_id,
            ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']::text[],
            '07:00',
            '17:30'
        );
    END IF;
END $$;

-- Step 3: Assign Angelica the same subjects as Reneil P. Arnado
-- Business subjects
DO $$
DECLARE
    v_teacher_id uuid;
BEGIN
    -- Get teacher ID via profile
    SELECT t.id INTO v_teacher_id 
    FROM teachers t 
    JOIN profiles p ON t.profile_id = p.id 
    WHERE p.email = 'angelica.garcia@optisched.sti.edu';
    
    IF v_teacher_id IS NOT NULL THEN
        INSERT INTO subject_teachers (subject_id, teacher_id)
        SELECT s.id, v_teacher_id
        FROM subjects s
        WHERE s.name IN (
            'Accountancy & Business Management',
            'Business Ethics & Social Responsibility',
            'Entrepreneurship',
            'Applied Economics'
        )
        ON CONFLICT DO NOTHING;
        
        -- Remaining subjects (Electronics, Robotics, Media Information Literacy, Understanding Culture, Society, and Politics)
        INSERT INTO subject_teachers (subject_id, teacher_id)
        SELECT s.id, v_teacher_id
        FROM subjects s
        WHERE s.name IN (
            'Electronics',
            'Robotics',
            'Media Information Literacy',
            'Understanding Culture, Society, and Politics'
        )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Verification: Show the created teacher and their subjects
SELECT 
    t.id as teacher_id,
    p.full_name,
    p.email,
    t.department,
    t.employment_type,
    t.max_hours,
    t.is_public,
    t.is_active
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
WHERE p.email = 'angelica.garcia@optisched.sti.edu';

-- Show assigned subjects
SELECT 
    s.code,
    s.name,
    s.program,
    s.year_level,
    s.duration_hours
FROM subject_teachers st
JOIN subjects s ON st.subject_id = s.id
WHERE st.teacher_id = (
    SELECT t.id 
    FROM teachers t 
    JOIN profiles p ON t.profile_id = p.id 
    WHERE p.email = 'angelica.garcia@optisched.sti.edu'
)
ORDER BY s.code;

-- Show teacher preferences
SELECT 
    tp.teacher_id,
    p.full_name,
    tp.preferred_days,
    tp.preferred_time_start,
    tp.preferred_time_end
FROM teacher_preferences tp
JOIN teachers t ON tp.teacher_id = t.id
JOIN profiles p ON t.profile_id = p.id
WHERE p.email = 'angelica.garcia@optisched.sti.edu';
