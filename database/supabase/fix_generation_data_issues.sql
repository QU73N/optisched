-- Comprehensive fix for generation data issues
-- This script fixes all identified data integrity issues that prevent schedule generation

-- ============================================================================
-- ISSUE 1: teacher_eligibility_pool is empty for all subjects
-- ============================================================================
-- The generator reads teacher_eligibility_pool to find eligible teachers,
-- but this field was empty (map[]). The actual teacher assignments are in
-- the subject_teachers junction table. This fix populates teacher_eligibility_pool
-- from the junction table.

UPDATE subjects s
SET teacher_eligibility_pool = (
    SELECT jsonb_agg(DISTINCT st.teacher_id)
    FROM subject_teachers st
    WHERE st.subject_id = s.id
)
WHERE teacher_eligibility_pool = '{}'::jsonb 
   OR teacher_eligibility_pool IS NULL 
   OR jsonb_array_length(teacher_eligibility_pool) = 0;

-- ============================================================================
-- ISSUE 2: Missing teacher records for teacher profiles
-- ============================================================================
-- There are 24 profiles with role='teacher' but only 9 teachers in the teachers table.
-- This creates teacher records for profiles with role='teacher' that don't have one.

INSERT INTO teachers (id, profile_id, department, employment_type, max_hours, is_active, created_at, updated_at, weight, priority_note, is_public, shared_with, shared_assignment)
SELECT 
    gen_random_uuid(),
    p.id,
    'General',
    'full-time',
    40,
    true,
    now(),
    now(),
    50,
    NULL,
    true,
    '{}'::uuid[],
    false
FROM profiles p
WHERE p.role = 'teacher'
  AND NOT EXISTS (SELECT 1 FROM teachers t WHERE t.profile_id = p.id);

-- ============================================================================
-- ISSUE 3: Missing teacher preferences for teachers
-- ============================================================================
-- Create teacher preferences for teachers without them

INSERT INTO teacher_preferences (id, teacher_id, preferred_days, preferred_time_start, preferred_time_end, max_classes_per_day, max_consecutive_classes, availability, created_at, last_updated)
SELECT 
    gen_random_uuid(),
    t.id,
    ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']::text[],
    '08:00',
    '17:00',
    6,
    3,
    '{}'::jsonb,
    now(),
    now()
FROM teachers t
WHERE NOT EXISTS (SELECT 1 FROM teacher_preferences tp WHERE tp.teacher_id = t.id);

-- ============================================================================
-- ISSUE 4: Set teachers to public
-- ============================================================================
-- Teachers need to be public for the generator to access them

UPDATE teachers
SET is_public = true
WHERE is_public = false;

-- ============================================================================
-- ISSUE 5: Set subjects to public
-- ============================================================================
-- Subjects need to be public for the generator to access them

UPDATE subjects
SET is_public = true
WHERE is_public = false;

-- ============================================================================
-- ISSUE 6: Set rooms to public
-- ============================================================================
-- Rooms need to be public for the generator to access them

UPDATE rooms
SET is_public = true
WHERE is_public = false;

-- ============================================================================
-- ISSUE 7: Set sections to public
-- ============================================================================
-- Sections need to be public for the generator to access them

UPDATE sections
SET is_public = true
WHERE is_public = false;

-- ============================================================================
-- VERIFICATION REPORT
-- ============================================================================

SELECT 'Teacher eligibility pool' as check_name,
       COUNT(*) FILTER (WHERE jsonb_array_length(teacher_eligibility_pool) > 0) as passed,
       COUNT(*) FILTER (WHERE jsonb_array_length(teacher_eligibility_pool) = 0) as failed
FROM subjects

UNION ALL

SELECT 'Teacher records for teacher profiles' as check_name,
       (SELECT COUNT(*) FROM teachers t JOIN profiles p ON t.profile_id = p.id WHERE p.role = 'teacher') as passed,
       (SELECT COUNT(*) FROM profiles p WHERE p.role = 'teacher' AND NOT EXISTS (SELECT 1 FROM teachers t WHERE t.profile_id = p.id)) as failed

UNION ALL

SELECT 'Teacher preferences' as check_name,
       (SELECT COUNT(*) FROM teacher_preferences) as passed,
       (SELECT COUNT(*) FROM teachers t WHERE NOT EXISTS (SELECT 1 FROM teacher_preferences tp WHERE tp.teacher_id = t.id)) as failed

UNION ALL

SELECT 'Teachers public' as check_name,
       COUNT(*) FILTER (WHERE is_public = true) as passed,
       COUNT(*) FILTER (WHERE is_public = false) as failed
FROM teachers

UNION ALL

SELECT 'Subjects public' as check_name,
       COUNT(*) FILTER (WHERE is_public = true) as passed,
       COUNT(*) FILTER (WHERE is_public = false) as failed
FROM subjects

UNION ALL

SELECT 'Rooms public' as check_name,
       COUNT(*) FILTER (WHERE is_public = true) as passed,
       COUNT(*) FILTER (WHERE is_public = false) as failed
FROM rooms

UNION ALL

SELECT 'Sections public' as check_name,
       COUNT(*) FILTER (WHERE is_public = true) as passed,
       COUNT(*) FILTER (WHERE is_public = false) as failed
FROM sections;
