-- ============================================================================
-- DEBUG FACULTY LOAD ISSUE - COMPREHENSIVE ANALYSIS
-- ============================================================================
-- This script analyzes why faculty load might be showing high values
-- It checks for duplicate schedules and verifies only one schedule is counted
-- ============================================================================

-- ============================================================================
-- PART 1: CHECK CURRENT SCHEDULE COUNTS BY STATUS AND IS_ACTIVE
-- ============================================================================
SELECT 
    'TOTAL SCHEDULES BY STATUS' as section,
    status,
    is_active,
    COUNT(*) as count
FROM public.schedules
GROUP BY status, is_active
ORDER BY status, is_active;

SELECT 
    'TOTAL SCHEDULES COUNT' as section,
    COUNT(*) as total_schedules
FROM public.schedules;

-- ============================================================================
-- PART 2: CHECK FOR DUPLICATE SCHEDULES
-- ============================================================================
-- Check for exact duplicates (same section, day, time, subject with different IDs)
SELECT 
    'POTENTIAL DUPLICATES' as section,
    section_id,
    day_of_week,
    start_time,
    end_time,
    subject_id,
    teacher_id,
    room_id,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ') as schedule_ids,
    STRING_AGG(status, ', ') as statuses,
    STRING_AGG(is_active::text, ', ') as is_active_flags
FROM public.schedules
GROUP BY section_id, day_of_week, start_time, end_time, subject_id, teacher_id, room_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, section_id, day_of_week, start_time
LIMIT 50;

-- Check for duplicates by section, day, time, subject (ignoring teacher/room)
SELECT 
    'DUPLICATES BY SECTION/DAY/TIME/SUBJECT' as section,
    section_id,
    day_of_week,
    start_time,
    end_time,
    subject_id,
    COUNT(*) as duplicate_count,
    STRING_AGG(DISTINCT teacher_id::text, ', ') as different_teachers,
    STRING_AGG(DISTINCT room_id::text, ', ') as different_rooms,
    STRING_AGG(DISTINCT status, ', ') as statuses,
    STRING_AGG(DISTINCT is_active::text, ', ') as is_active_flags
FROM public.schedules
GROUP BY section_id, day_of_week, start_time, end_time, subject_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, section_id, day_of_week, start_time
LIMIT 50;

-- ============================================================================
-- PART 3: CHECK CURRENT RPC FUNCTION DEFINITION
-- ============================================================================
SELECT 
    'CURRENT RPC FUNCTION' as section,
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name = 'get_schedules_with_details';

-- ============================================================================
-- PART 4: TEST CURRENT RPC FUNCTION
-- ============================================================================
SELECT 
    'RPC FUNCTION RESULT COUNT' as section,
    COUNT(*) as count
FROM get_schedules_with_details();

SELECT 
    'RPC BY STATUS' as section,
    status,
    COUNT(*) as count
FROM get_schedules_with_details()
GROUP BY status;

SELECT 
    'RPC BY IS_ACTIVE' as section,
    is_active,
    COUNT(*) as count
FROM get_schedules_with_details()
GROUP BY is_active;

-- ============================================================================
-- PART 5: CHECK SCHEDULE VERSIONS TABLE
-- ============================================================================
SELECT 
    'SCHEDULE VERSIONS COUNT' as section,
    COUNT(*) as total_versions
FROM schedule_versions;

SELECT 
    'VERSIONS BY CHANGE TYPE' as section,
    change_type,
    is_active,
    COUNT(*) as count
FROM schedule_versions
GROUP BY change_type, is_active
ORDER BY change_type, is_active;

-- Check for multiple active versions in the same batch
SELECT 
    'MULTIPLE ACTIVE VERSIONS IN SAME BATCH' as section,
    batch_id,
    COUNT(*) as active_count,
    STRING_AGG(version_number::text, ', ') as version_numbers,
    STRING_AGG(change_type, ', ') as change_types
FROM schedule_versions
WHERE is_active = true
GROUP BY batch_id
HAVING COUNT(*) > 1;

-- ============================================================================
-- PART 6: CHECK WHICH BATCH HAS THE LATEST ACTIVE SCHEDULES
-- ============================================================================
-- Find the batch with the most recent active published schedule
SELECT 
    'LATEST ACTIVE BATCH' as section,
    batch_id,
    MAX(changed_at) as latest_change,
    COUNT(*) as version_count
FROM schedule_versions
WHERE is_active = true
GROUP BY batch_id
ORDER BY latest_change DESC
LIMIT 5;

-- ============================================================================
-- PART 7: ANALYZE TEACHER WORKLOAD FROM CURRENT RPC
-- ============================================================================
SELECT 
    'TEACHER WORKLOAD FROM RPC' as section,
    teacher_id,
    teacher_name,
    COUNT(*) as class_count,
    SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) as total_hours
FROM get_schedules_with_details()
GROUP BY teacher_id, teacher_name
ORDER BY total_hours DESC
LIMIT 20;

-- ============================================================================
-- PART 8: COMPARE WITH DIRECT SCHEDULES TABLE QUERY
-- ============================================================================
SELECT 
    'TEACHER WORKLOAD FROM DIRECT QUERY (ALL ACTIVE)' as section,
    teacher_id,
    COUNT(*) as class_count,
    SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) as total_hours
FROM public.schedules
WHERE is_active = true
GROUP BY teacher_id
ORDER BY total_hours DESC
LIMIT 20;

-- ============================================================================
-- PART 9: CHECK IF THERE ARE BOTH DRAFT AND PUBLISHED ACTIVE SCHEDULES
-- ============================================================================
SELECT 
    'ACTIVE BY STATUS' as section,
    status,
    is_active,
    COUNT(*) as count
FROM public.schedules
WHERE is_active = true
GROUP BY status, is_active;

-- ============================================================================
-- PART 10: RECOMMENDATION SUMMARY
-- ============================================================================
SELECT 
    'ANALYSIS COMPLETE' as section,
    'Please review the results above to identify the root cause of high faculty load' as note;
