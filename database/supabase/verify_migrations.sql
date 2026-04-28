-- ============================================================================
-- Migration Verification Script
-- Run this in Supabase SQL Editor to verify if migrations 005, 006, 007, 014, 015 are applied
-- ============================================================================

-- ============================================================================
-- Verify Migration 005: Section Hierarchy
-- ============================================================================

-- Check if hierarchy columns exist in sections table
SELECT 
    '005 - Section Hierarchy' as migration,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'sections' 
AND column_name IN ('parent_id', 'weight', 'path', 'node_type', 'is_active', 'description', 'metadata', 'sort_order')
ORDER BY column_name;

-- Expected result: 8 rows (all columns present)
-- If 0 rows, migration 005 is NOT applied

-- ============================================================================
-- Verify Migration 006: Schedule Versioning
-- ============================================================================

-- Check if schedule_versions table exists
SELECT 
    '006 - Schedule Versions Table' as check_item,
    EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'schedule_versions'
    ) as exists;

-- Expected: true
-- If false, migration 006 is NOT applied

-- Check if schedule_version_sets table exists
SELECT 
    '006 - Schedule Version Sets Table' as check_item,
    EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'schedule_version_sets'
    ) as exists;

-- Expected: true
-- If false, migration 006 is NOT applied

-- Check if versioning functions exist
SELECT 
    '006 - Versioning Functions' as check_item,
    COUNT(*) as function_count
FROM information_schema.routines
WHERE routine_name IN (
    'get_next_schedule_version',
    'create_schedule_version',
    'compare_schedule_versions',
    'rollback_schedule_version',
    'create_schedule_version_set'
) AND routine_schema = 'public';

-- Expected: 5
-- If 0, migration 006 is NOT applied

-- ============================================================================
-- Verify Migration 007: Priority System
-- ============================================================================

-- Check if teachers has priority columns
SELECT 
    '007 - Teachers Priority Columns' as check_item,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'teachers' 
AND column_name IN ('weight', 'priority_note')
ORDER BY column_name;

-- Expected: 2 rows
-- If 0 rows, migration 007 is NOT applied

-- Check if subjects has priority columns
SELECT 
    '007 - Subjects Priority Columns' as check_item,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'subjects' 
AND column_name IN ('weight', 'priority_note')
ORDER BY column_name;

-- Expected: 2 rows
-- If 0 rows, migration 007 is NOT applied

-- Check if rooms has priority columns
SELECT 
    '007 - Rooms Priority Columns' as check_item,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'rooms' 
AND column_name IN ('weight', 'priority_note')
ORDER BY column_name;

-- Expected: 2 rows
-- If 0 rows, migration 007 is NOT applied

-- Check if priority_config table exists
SELECT 
    '007 - Priority Config Table' as check_item,
    EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'priority_config'
    ) as exists;

-- Expected: true
-- If false, migration 007 is NOT applied

-- Check if priority functions exist
SELECT 
    '007 - Priority Functions' as check_item,
    COUNT(*) as function_count
FROM information_schema.routines
WHERE routine_name IN (
    'calculate_priority_score',
    'get_priority_tier',
    'update_priority_config'
) AND routine_schema = 'public';

-- Expected: 3
-- If 0, migration 007 is NOT applied

-- ============================================================================
-- Summary
-- ============================================================================

-- Run this to get a quick summary
WITH migration_checks AS (
    SELECT '005 - Section Hierarchy' as migration,
           COUNT(*) as column_count
    FROM information_schema.columns
    WHERE table_name = 'sections'
    AND column_name IN ('parent_id', 'weight', 'path', 'node_type', 'is_active', 'description', 'metadata', 'sort_order')

    UNION ALL

    SELECT '006 - Schedule Versions' as migration,
           CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'schedule_versions') THEN 1 ELSE 0 END as column_count

    UNION ALL

    SELECT '007 - Priority System' as migration,
           COUNT(*) as column_count
    FROM information_schema.columns
    WHERE table_name = 'teachers'
    AND column_name IN ('weight', 'priority_note')

    UNION ALL

    SELECT '014 - Departments and Governance' as migration,
           CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'departments') THEN 1 ELSE 0 END as column_count

    UNION ALL

    SELECT '015 - Sessions Per Week' as migration,
           CASE WHEN EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'subjects' AND column_name = 'sessions_per_week') THEN 1 ELSE 0 END as column_count
)
SELECT
    migration,
    CASE
        WHEN column_count > 0 THEN 'APPLIED'
        ELSE 'NOT APPLIED'
    END as status,
    column_count as check_count
FROM migration_checks;

-- ============================================================================
-- Verify Migration 014: Departments and Governance Rules
-- ============================================================================

-- Check if departments table exists
SELECT
    '014 - Departments Table' as check_item,
    EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'departments'
    ) as exists;

-- Expected: true
-- If false, migration 014 is NOT applied

-- Check if department_id column exists in profiles
SELECT
    '014 - Department ID in Profiles' as check_item,
    EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'profiles'
        AND column_name = 'department_id'
    ) as exists;

-- Expected: true
-- If false, migration 014 is NOT applied

-- Check if governance system rules exist
SELECT
    '014 - Governance Rules' as check_item,
    COUNT(*) as rule_count
FROM public.system_rules
WHERE rule_key IN (
    'schedule_managers_can_create_without_approval',
    'schedule_managers_can_edit_without_approval',
    'schedule_managers_access_all_data',
    'default_session_length_minutes'
);

-- Expected: 4
-- If 0, migration 014 is NOT applied

-- Check if departments trigger exists
SELECT
    '014 - Departments Trigger' as check_item,
    EXISTS (
        SELECT FROM information_schema.triggers
        WHERE trigger_name = 'trigger_update_departments_updated_at'
    ) as exists;

-- Expected: true
-- If false, migration 014 is NOT applied

-- ============================================================================
-- Verify Migration 015: Sessions Per Week
-- ============================================================================

-- Check if sessions_per_week column exists in subjects
SELECT
    '015 - Sessions Per Week in Subjects' as check_item,
    EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'subjects'
        AND column_name = 'sessions_per_week'
    ) as exists;

-- Expected: true
-- If false, migration 015 is NOT applied
