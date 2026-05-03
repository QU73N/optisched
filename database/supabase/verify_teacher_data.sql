-- ============================================================================
-- TEACHER DATA INTEGRITY VERIFICATION
-- Checks for missing teacher data, department assignments, and scheduling rules
-- ============================================================================

-- ============================================================================
-- SECTION 1: TEACHER PROFILE COMPLETENESS
-- ============================================================================

SELECT 
    'TEACHER PROFILE COMPLETENESS' as category,
    COUNT(*) as total_teachers,
    COUNT(CASE WHEN p.full_name IS NULL OR p.full_name = '' THEN 1 END) as missing_name,
    COUNT(CASE WHEN p.email IS NULL OR p.email = '' THEN 1 END) as missing_email,
    COUNT(CASE WHEN t.department IS NULL OR t.department = '' THEN 1 END) as missing_department,
    COUNT(CASE WHEN t.employment_type IS NULL OR t.employment_type = '' THEN 1 END) as missing_employment_type
FROM teachers t
JOIN profiles p ON t.profile_id = p.id;

-- ============================================================================
-- SECTION 2: TEACHERS WITHOUT DEPARTMENTS
-- ============================================================================

SELECT 
    'TEACHERS WITHOUT DEPARTMENTS' as category,
    t.id,
    p.full_name,
    p.email,
    t.department
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
WHERE t.department IS NULL OR t.department = ''
ORDER BY p.full_name;

-- ============================================================================
-- SECTION 3: PART-TIME TEACHERS SCHEDULED ON NON-SATURDAY DAYS
-- ============================================================================

SELECT 
    'PART-TIME TEACHERS ON NON-SATURDAY' as category,
    t.id as teacher_id,
    p.full_name,
    t.employment_type,
    s.day_of_week,
    COUNT(*) as schedule_count
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
JOIN schedules s ON t.id = s.teacher_id
WHERE t.employment_type = 'part-time'
AND s.day_of_week != 'Saturday'
AND s.status = 'published'
GROUP BY t.id, p.full_name, t.employment_type, s.day_of_week
ORDER BY p.full_name, s.day_of_week;

-- ============================================================================
-- SECTION 4: TEACHERS DEPARTMENT VS SUBJECT PROGRAM MISMATCH
-- ============================================================================

SELECT 
    'DEPARTMENT/PROGRAM MISMATCH' as category,
    t.id as teacher_id,
    p.full_name,
    t.department as teacher_department,
    sub.id as subject_id,
    sub.name as subject_name,
    sub.program as subject_program,
    COUNT(*) as schedule_count
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
JOIN schedules s ON t.id = s.teacher_id
JOIN subjects sub ON s.subject_id = sub.id
WHERE t.department IS NOT NULL 
AND t.department != ''
AND sub.program IS NOT NULL
AND sub.program != ''
AND t.department != sub.program
AND s.status = 'published'
GROUP BY t.id, p.full_name, t.department, sub.id, sub.name, sub.program
ORDER BY p.full_name, sub.name;

-- ============================================================================
-- SECTION 5: TEACHERS WITHOUT PREFERENCES
-- ============================================================================

SELECT 
    'TEACHERS WITHOUT PREFERENCES' as category,
    t.id,
    p.full_name,
    p.email
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
LEFT JOIN teacher_preferences tp ON t.id = tp.teacher_id
WHERE tp.teacher_id IS NULL
ORDER BY p.full_name;

-- ============================================================================
-- SECTION 6: TEACHERS WITH INCOMPLETE PREFERENCES
-- ============================================================================

SELECT 
    'TEACHERS WITH INCOMPLETE PREFERENCES' as category,
    tp.teacher_id,
    p.full_name,
    COUNT(CASE WHEN tp.preferred_days IS NULL THEN 1 END) as missing_days,
    COUNT(CASE WHEN tp.preferred_time_start IS NULL THEN 1 END) as missing_time_start,
    COUNT(CASE WHEN tp.preferred_time_end IS NULL THEN 1 END) as missing_time_end,
    COUNT(CASE WHEN tp.max_classes_per_day IS NULL THEN 1 END) as missing_max_classes
FROM teacher_preferences tp
JOIN teachers t ON tp.teacher_id = t.id
JOIN profiles p ON t.profile_id = p.id
GROUP BY tp.teacher_id, p.full_name
HAVING 
    COUNT(CASE WHEN tp.preferred_days IS NULL THEN 1 END) > 0
    OR COUNT(CASE WHEN tp.preferred_time_start IS NULL THEN 1 END) > 0
    OR COUNT(CASE WHEN tp.preferred_time_end IS NULL THEN 1 END) > 0
    OR COUNT(CASE WHEN tp.max_classes_per_day IS NULL THEN 1 END) > 0
ORDER BY p.full_name;

-- ============================================================================
-- SECTION 7: SUBJECTS WITHOUT PROGRAM
-- ============================================================================

SELECT 
    'SUBJECTS WITHOUT PROGRAM' as category,
    sub.id,
    sub.name,
    sub.code,
    sub.program
FROM subjects sub
WHERE sub.program IS NULL OR sub.program = ''
ORDER BY sub.name;

-- ============================================================================
-- SECTION 8: SUMMARY REPORT
-- ============================================================================

SELECT 
    'SUMMARY' as category,
    'Total Teachers' as metric,
    COUNT(*) as value
FROM teachers
UNION ALL
SELECT 
    'SUMMARY',
    'Teachers with Department',
    COUNT(*)
FROM teachers
WHERE department IS NOT NULL AND department != ''
UNION ALL
SELECT 
    'SUMMARY',
    'Teachers without Department',
    COUNT(*)
FROM teachers
WHERE department IS NULL OR department = ''
UNION ALL
SELECT 
    'SUMMARY',
    'Part-time Teachers',
    COUNT(*)
FROM teachers
WHERE employment_type = 'part-time'
UNION ALL
SELECT 
    'SUMMARY',
    'Full-time Teachers',
    COUNT(*)
FROM teachers
WHERE employment_type = 'full-time'
UNION ALL
SELECT 
    'SUMMARY',
    'Teachers with Preferences',
    COUNT(DISTINCT tp.teacher_id)
FROM teacher_preferences tp
UNION ALL
SELECT 
    'SUMMARY',
    'Teachers without Preferences',
    COUNT(*)
FROM teachers t
LEFT JOIN teacher_preferences tp ON t.id = tp.teacher_id
WHERE tp.teacher_id IS NULL
UNION ALL
SELECT 
    'SUMMARY',
    'Subjects with Program',
    COUNT(*)
FROM subjects
WHERE program IS NOT NULL AND program != ''
UNION ALL
SELECT 
    'SUMMARY',
    'Subjects without Program',
    COUNT(*)
FROM subjects
WHERE program IS NULL OR program = '';
