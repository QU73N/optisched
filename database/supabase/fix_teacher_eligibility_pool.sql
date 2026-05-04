-- Fix teacher_eligibility_pool by populating from subject_teachers junction table
-- This ensures the generator can find eligible teachers for each subject

-- Step 1: Populate teacher_eligibility_pool from subject_teachers junction table
-- This creates a JSONB array of teacher IDs for each subject
UPDATE subjects s
SET teacher_eligibility_pool = (
    SELECT jsonb_agg(DISTINCT st.teacher_id)
    FROM subject_teachers st
    WHERE st.subject_id = s.id
)
WHERE teacher_eligibility_pool = '{}'::jsonb OR teacher_eligibility_pool IS NULL OR jsonb_array_length(teacher_eligibility_pool) = 0;

-- Step 2: Verify the fix
SELECT 
    s.id,
    s.name,
    s.teacher_eligibility_pool,
    jsonb_array_length(s.teacher_eligibility_pool) as pool_size,
    (SELECT COUNT(*) FROM subject_teachers st WHERE st.subject_id = s.id) as junction_count
FROM subjects s
ORDER BY s.name;

-- Step 3: Summary report
SELECT 
    COUNT(*) as total_subjects,
    COUNT(*) FILTER (WHERE jsonb_array_length(teacher_eligibility_pool) > 0) as subjects_with_teachers,
    COUNT(*) FILTER (WHERE jsonb_array_length(teacher_eligibility_pool) = 0) as subjects_without_teachers
FROM subjects;
