-- ============================================================================
-- ANALYZE TEACHER PREFERENCES COMPLETENESS
-- ============================================================================
-- This script checks all teacher preferences to identify missing data
-- ============================================================================

-- Check all teachers and their preferences
SELECT 
    'ALL TEACHERS WITH PREFERENCES' as section,
    t.id as teacher_id,
    p.full_name,
    t.employment_type,
    tp.preferred_days,
    tp.preferred_time_start,
    tp.preferred_time_end,
    tp.max_classes_per_day,
    tp.max_consecutive_classes,
    tp.availability
FROM teachers t
LEFT JOIN profiles p ON p.id = t.profile_id
LEFT JOIN teacher_preferences tp ON tp.teacher_id = t.id
ORDER BY p.full_name;

-- Check teachers without preferences
SELECT 
    'TEACHERS WITHOUT PREFERENCES' as section,
    t.id as teacher_id,
    p.full_name,
    t.employment_type
FROM teachers t
LEFT JOIN profiles p ON p.id = t.profile_id
LEFT JOIN teacher_preferences tp ON tp.teacher_id = t.id
WHERE tp.teacher_id IS NULL
ORDER BY p.full_name;

-- Check teachers with empty availability map
SELECT 
    'TEACHERS WITH EMPTY AVAILABILITY' as section,
    t.id as teacher_id,
    p.full_name,
    t.employment_type,
    tp.availability
FROM teachers t
LEFT JOIN profiles p ON p.id = t.profile_id
LEFT JOIN teacher_preferences tp ON tp.teacher_id = t.id
WHERE tp.availability::text = '{}'::text
   OR tp.availability IS NULL
ORDER BY p.full_name;

-- Check teachers with empty preferred_days
SELECT 
    'TEACHERS WITH EMPTY PREFERRED_DAYS' as section,
    t.id as teacher_id,
    p.full_name,
    t.employment_type,
    tp.preferred_days
FROM teachers t
LEFT JOIN profiles p ON p.id = t.profile_id
LEFT JOIN teacher_preferences tp ON tp.teacher_id = t.id
WHERE tp.preferred_days IS NULL
   OR array_length(tp.preferred_days, 1) = 0
ORDER BY p.full_name;

-- Check employment type distribution
SELECT 
    'EMPLOYMENT TYPE DISTRIBUTION' as section,
    t.employment_type,
    COUNT(*) as count
FROM teachers t
GROUP BY t.employment_type
ORDER BY t.employment_type;

-- Check part-time teachers specifically
SELECT 
    'PART-TIME TEACHERS DETAILS' as section,
    t.id as teacher_id,
    p.full_name,
    t.employment_type,
    tp.preferred_days,
    tp.availability
FROM teachers t
LEFT JOIN profiles p ON p.id = t.profile_id
LEFT JOIN teacher_preferences tp ON tp.teacher_id = t.id
WHERE t.employment_type = 'part-time'
ORDER BY p.full_name;
