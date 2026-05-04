-- ============================================================
-- Fix Duplicate Teacher Accounts
-- ============================================================
-- This script identifies and removes duplicate teacher accounts
-- that have no schedules assigned to them.
-- ============================================================

-- Step 1: Analyze current teacher records and schedule counts
-- ============================================================

SELECT 
    t.id,
    p.full_name,
    COUNT(DISTINCT s.id) as schedule_count,
    COUNT(DISTINCT sub.id) as subject_count,
    t.is_public,
    t.created_at
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
LEFT JOIN schedules s ON s.teacher_id = t.id
LEFT JOIN subjects sub ON sub.teacher_id = t.id
GROUP BY t.id, p.full_name, t.is_public, t.created_at
ORDER BY p.full_name, t.created_at;

-- Step 2: Identify duplicate teachers by name
-- ============================================================

WITH teacher_duplicates AS (
    SELECT 
        p.full_name,
        COUNT(*) as duplicate_count,
        ARRAY_AGG(t.id ORDER BY t.created_at) as teacher_ids,
        ARRAY_AGG(t.created_at ORDER BY t.created_at) as created_dates
    FROM teachers t
    JOIN profiles p ON t.profile_id = p.id
    GROUP BY p.full_name
    HAVING COUNT(*) > 1
)
SELECT 
    full_name,
    duplicate_count,
    teacher_ids,
    created_dates
FROM teacher_duplicates
ORDER BY full_name;

-- Step 3: For each duplicate, identify which one has schedules and which doesn't
-- ============================================================

WITH teacher_schedule_counts AS (
    SELECT 
        t.id,
        p.full_name,
        t.created_at,
        COUNT(DISTINCT s.id) as schedule_count,
        COUNT(DISTINCT sub.id) as subject_count
    FROM teachers t
    JOIN profiles p ON t.profile_id = p.id
    LEFT JOIN schedules s ON s.teacher_id = t.id
    LEFT JOIN subjects sub ON sub.teacher_id = t.id
    GROUP BY t.id, p.full_name, t.created_at
),
duplicates AS (
    SELECT 
        p.full_name,
        COUNT(*) as duplicate_count
    FROM teachers t
    JOIN profiles p ON t.profile_id = p.id
    GROUP BY p.full_name
    HAVING COUNT(*) > 1
)
SELECT 
    tsc.id,
    tsc.full_name,
    tsc.schedule_count,
    tsc.subject_count,
    tsc.created_at,
    d.duplicate_count,
    CASE 
        WHEN tsc.schedule_count = 0 AND tsc.subject_count = 0 THEN 'DELETE - No schedules or subjects'
        WHEN tsc.schedule_count > 0 OR tsc.subject_count > 0 THEN 'KEEP - Has schedules or subjects'
        ELSE 'REVIEW'
    END as action
FROM teacher_schedule_counts tsc
JOIN duplicates d ON tsc.full_name = d.full_name
ORDER BY tsc.full_name, tsc.schedule_count DESC, tsc.created_at;

-- ============================================================
-- DELETION QUERIES (Run after reviewing the analysis above)
-- ============================================================

-- WARNING: These queries will delete teacher records.
-- Review the analysis above before running these.
-- Only delete teachers that have:
-- - Duplicate names (same full_name)
-- - 0 schedules assigned
-- - 0 subjects assigned
-- - Are the newer/less complete record

-- Example deletion (customize based on analysis):
-- DELETE FROM teachers WHERE id = 'specific_teacher_id_to_delete';

-- ============================================================
-- VERIFICATION QUERIES (Run after deletion)
-- ============================================================

-- Verify no duplicates remain
SELECT 
    p.full_name,
    COUNT(*) as count
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
GROUP BY p.full_name
HAVING COUNT(*) > 1;

-- Verify all remaining teachers have data
SELECT 
    t.id,
    p.full_name,
    COUNT(DISTINCT s.id) as schedule_count,
    COUNT(DISTINCT sub.id) as subject_count
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
LEFT JOIN schedules s ON s.teacher_id = t.id
LEFT JOIN subjects sub ON sub.teacher_id = t.id
GROUP BY t.id, p.full_name
HAVING COUNT(DISTINCT s.id) = 0 AND COUNT(DISTINCT sub.id) = 0;
