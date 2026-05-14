-- Check subject types and their distribution
SELECT 
    'SUBJECT TYPES' as section,
    type,
    COUNT(*) as count
FROM subjects
GROUP BY type
ORDER BY type;

-- Check special subjects details
SELECT 
    'SPECIAL SUBJECTS' as section,
    id,
    code,
    name,
    type,
    program,
    teacher_id,
    requires_special_room,
    requires_lab,
    year_level
FROM subjects
WHERE type = 'special'
LIMIT 10;

-- Check common subjects details
SELECT 
    'COMMON SUBJECTS' as section,
    id,
    code,
    name,
    type,
    program,
    teacher_id,
    requires_special_room,
    requires_lab,
    year_level
FROM subjects
WHERE type = 'common'
LIMIT 10;

-- Check teacher eligibility pool sizes for subjects
SELECT 
    'TEACHER POOL SIZES' as section,
    id,
    code,
    name,
    type,
    teacher_eligibility_pool
FROM subjects
LIMIT 20;
