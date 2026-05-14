-- ============================================================================
-- VERIFY COMPLETE TEACHER DATA
-- ============================================================================
-- This script verifies all teachers have complete and valid data
-- ============================================================================

-- Check for any teachers with NULL or empty availability
SELECT 
    'TEACHERS WITH INCOMPLETE AVAILABILITY (SHOULD BE 0)' as section,
    t.id as teacher_id,
    p.full_name,
    t.employment_type,
    CASE 
        WHEN tp.availability IS NULL THEN 'NULL'
        WHEN tp.availability::text = '{}' THEN 'EMPTY'
        ELSE 'OK'
    END as availability_status
FROM teachers t
LEFT JOIN profiles p ON p.id = t.profile_id
LEFT JOIN teacher_preferences tp ON tp.teacher_id = t.id
WHERE tp.availability IS NULL OR tp.availability::text = '{}'
ORDER BY p.full_name;

-- Check for any teachers with NULL or empty preferred_days
SELECT 
    'TEACHERS WITH INCOMPLETE PREFERRED_DAYS (SHOULD BE 0)' as section,
    t.id as teacher_id,
    p.full_name,
    t.employment_type,
    tp.preferred_days
FROM teachers t
LEFT JOIN profiles p ON p.id = t.profile_id
LEFT JOIN teacher_preferences tp ON tp.teacher_id = t.id
WHERE tp.preferred_days IS NULL OR array_length(tp.preferred_days, 1) = 0
ORDER BY p.full_name;

-- Summary of all teachers with their data completeness
SELECT 
    'TEACHER DATA COMPLETENESS SUMMARY' as section,
    t.id as teacher_id,
    p.full_name,
    t.employment_type,
    tp.preferred_days,
    (SELECT COUNT(*) FROM jsonb_object_keys(tp.availability)) as availability_key_count,
    tp.preferred_time_start,
    tp.preferred_time_end,
    tp.max_classes_per_day,
    tp.max_consecutive_classes,
    CASE 
        WHEN tp.availability IS NULL OR tp.availability::text = '{}' THEN 'INCOMPLETE'
        WHEN tp.preferred_days IS NULL OR array_length(tp.preferred_days, 1) = 0 THEN 'INCOMPLETE'
        ELSE 'COMPLETE'
    END as overall_status
FROM teachers t
LEFT JOIN profiles p ON p.id = t.profile_id
LEFT JOIN teacher_preferences tp ON tp.teacher_id = t.id
ORDER BY p.full_name;

-- Count of teachers by completeness status
SELECT 
    'COMPLETENESS COUNT' as section,
    CASE 
        WHEN tp.availability IS NULL OR tp.availability::text = '{}' THEN 'INCOMPLETE'
        WHEN tp.preferred_days IS NULL OR array_length(tp.preferred_days, 1) = 0 THEN 'INCOMPLETE'
        ELSE 'COMPLETE'
    END as status,
    COUNT(*) as count
FROM teachers t
LEFT JOIN teacher_preferences tp ON tp.teacher_id = t.id
GROUP BY 
    CASE 
        WHEN tp.availability IS NULL OR tp.availability::text = '{}' THEN 'INCOMPLETE'
        WHEN tp.preferred_days IS NULL OR array_length(tp.preferred_days, 1) = 0 THEN 'INCOMPLETE'
        ELSE 'COMPLETE'
    END
ORDER BY status;
