-- ============================================================================
-- VERIFY TEACHER DATA COMPLETENESS
-- ============================================================================
-- This script verifies that all teacher data is complete and consistent
-- ============================================================================

-- Check all teachers with their employment type and preferences
SELECT 
    'ALL TEACHERS WITH COMPLETE DATA' as section,
    t.id as teacher_id,
    p.full_name,
    t.employment_type,
    tp.preferred_days,
    tp.preferred_time_start,
    tp.preferred_time_end,
    tp.max_classes_per_day,
    tp.max_consecutive_classes,
    CASE 
        WHEN tp.availability::text = '{}' THEN 'EMPTY'
        WHEN tp.availability IS NULL THEN 'NULL'
        ELSE 'HAS_DATA (' || (SELECT COUNT(*) FROM jsonb_object_keys(tp.availability))::text || ' keys)'
    END as availability_status
FROM teachers t
LEFT JOIN profiles p ON p.id = t.profile_id
LEFT JOIN teacher_preferences tp ON tp.teacher_id = t.id
ORDER BY p.full_name;

-- Count teachers by employment type
SELECT 
    'EMPLOYMENT TYPE COUNT' as section,
    employment_type,
    COUNT(*) as count
FROM teachers
GROUP BY employment_type
ORDER BY employment_type;

-- Check if the generate_availability_map function exists
SELECT 
    'FUNCTION EXISTS' as section,
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_name = 'generate_availability_map'
  AND routine_schema = 'public';
