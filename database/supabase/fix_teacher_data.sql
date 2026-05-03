-- ============================================================================
-- FIX TEACHER DATA INTEGRITY
-- 1. Update subject programs to match teacher departments
-- 2. Update part-time teachers to only prefer Saturday
-- ============================================================================

-- ============================================================================
-- STEP 1: UPDATE SUBJECT PROGRAMS TO MATCH TEACHER DEPARTMENTS
-- ============================================================================

-- Mathematics subjects → Mathematics
UPDATE subjects SET program = 'Mathematics' WHERE program = 'ABM';

-- Physical Education subjects → Physical Education  
UPDATE subjects SET program = 'Physical Education' WHERE name LIKE '%Physical Education%';

-- Research subjects → Research
UPDATE subjects SET program = 'Research' WHERE name LIKE '%Research%' OR name LIKE '%Inquiries%';

-- IT/Programming subjects → Information Technology
UPDATE subjects SET program = 'Information Technology' WHERE program = 'MAWD';

-- Business subjects → Business
UPDATE subjects SET program = 'Business' WHERE name IN (
    'Accountancy & Business Management',
    'Applied Economics',
    'Business Ethics & Social Responsibility',
    'Empowerment Technologies: ABM'
) OR code IN ('ABM', 'APECON', 'BESR', 'ET-ABM');

-- Science subjects → Science
UPDATE subjects SET program = 'Science' WHERE name LIKE '%Chemistry%' 
    OR name LIKE '%Physics%' 
    OR name LIKE '%Science%'
    OR name LIKE '%Electronics%'
    OR name LIKE '%Robotics%'
    OR code IN ('CHEM11', 'GC1', 'GC2', 'GP1', 'GP2', 'ELEC', 'ROBO');

-- Core subjects (that can be taught by any department) → ALL
UPDATE subjects SET program = 'ALL' WHERE name IN (
    'Contemporary Philippine Arts from the Regions',
    'Media Information Literacy',
    'Practical Research 1',
    'Understanding Culture, Society, and Politics',
    'Work Immersion'
) OR code IN ('CPAR', 'MIL', 'PR1', 'UCSP', 'WI');

-- ============================================================================
-- STEP 2: UPDATE PART-TIME TEACHERS TO ONLY PREFER SATURDAY
-- ============================================================================

-- Mark Gerald Doblon (Science, part-time)
UPDATE teacher_preferences 
SET preferred_days = ARRAY['Saturday']
WHERE teacher_id = 'cdd55db8-f18d-4030-83f5-5bb7a52b07e8';

-- Mary Jane Balando (Science, part-time)
UPDATE teacher_preferences 
SET preferred_days = ARRAY['Saturday']
WHERE teacher_id = 'a9174ff6-b29d-45a0-844a-d99049264d48';

-- ============================================================================
-- STEP 3: VERIFICATION - SHOW UPDATED DATA
-- ============================================================================

-- Show all subjects with updated programs
SELECT 
    'UPDATED SUBJECTS' as category,
    sub.id,
    sub.name,
    sub.code,
    sub.program
FROM subjects sub
ORDER BY sub.program, sub.name;

-- Show all teachers with their departments
SELECT 
    'TEACHERS' as category,
    t.id,
    p.full_name,
    t.department,
    t.employment_type,
    tp.preferred_days
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
LEFT JOIN teacher_preferences tp ON t.id = tp.teacher_id
ORDER BY t.employment_type, p.full_name;
