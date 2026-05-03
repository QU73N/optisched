-- ============================================================================
-- CRITICAL TEACHER DATA CHECKS
-- Focus on issues that could hurt schedule generation
-- ============================================================================

-- ============================================================================
-- CHECK 1: PART-TIME TEACHERS SCHEDULED ON NON-SATURDAY DAYS
-- ============================================================================

SELECT 
    'PART-TIME ON NON-SATURDAY' as issue_type,
    t.id as teacher_id,
    p.full_name,
    t.employment_type,
    s.day_of_week,
    sub.name as subject_name,
    COUNT(*) as count
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
JOIN schedules s ON t.id = s.teacher_id
JOIN subjects sub ON s.subject_id = sub.id
WHERE t.employment_type = 'part-time'
AND s.day_of_week != 'Saturday'
AND s.status = 'published'
GROUP BY t.id, p.full_name, t.employment_type, s.day_of_week, sub.name
ORDER BY p.full_name, s.day_of_week;

-- ============================================================================
-- CHECK 2: TEACHERS DEPARTMENT VS SUBJECT PROGRAM MISMATCH
-- ============================================================================

SELECT 
    'DEPARTMENT/PROGRAM MISMATCH' as issue_type,
    t.id as teacher_id,
    p.full_name,
    t.department as teacher_department,
    sub.name as subject_name,
    sub.program as subject_program
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
ORDER BY p.full_name, sub.name;

-- ============================================================================
-- CHECK 3: TEACHERS WITHOUT DEPARTMENTS
-- ============================================================================

SELECT 
    'NO DEPARTMENT' as issue_type,
    t.id,
    p.full_name,
    p.email
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
WHERE t.department IS NULL OR t.department = ''
ORDER BY p.full_name;

-- ============================================================================
-- CHECK 4: SUBJECTS WITHOUT PROGRAM
-- ============================================================================

SELECT 
    'NO PROGRAM' as issue_type,
    sub.id,
    sub.name,
    sub.code
FROM subjects sub
WHERE sub.program IS NULL OR sub.program = ''
ORDER BY sub.name;

-- ============================================================================
-- CHECK 5: TEACHERS WITHOUT PREFERENCES
-- ============================================================================

SELECT 
    'NO PREFERENCES' as issue_type,
    t.id,
    p.full_name,
    p.email
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
LEFT JOIN teacher_preferences tp ON t.id = tp.teacher_id
WHERE tp.teacher_id IS NULL
ORDER BY p.full_name;

-- ============================================================================
-- CHECK 6: LIST ALL TEACHERS WITH THEIR DEPARTMENTS AND EMPLOYMENT TYPE
-- ============================================================================

SELECT 
    'TEACHER LIST' as issue_type,
    t.id,
    p.full_name,
    p.email,
    t.department,
    t.employment_type,
    t.max_hours,
    t.is_active
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
ORDER BY t.employment_type, p.full_name;

-- ============================================================================
-- CHECK 7: LIST ALL SUBJECTS WITH THEIR PROGRAMS
-- ============================================================================

SELECT 
    'SUBJECT LIST' as issue_type,
    sub.id,
    sub.name,
    sub.code,
    sub.program,
    sub.units,
    sub.type
FROM subjects sub
ORDER BY sub.program, sub.name;
