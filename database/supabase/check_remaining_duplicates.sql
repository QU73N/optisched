-- Check for any remaining duplicates in RPC result
SELECT 
    'CHECK FOR DUPLICATES AFTER FIX' as section,
    section_id,
    day_of_week,
    start_time,
    end_time,
    subject_id,
    COUNT(*) as duplicate_count
FROM get_schedules_with_details()
GROUP BY section_id, day_of_week, start_time, end_time, subject_id
HAVING COUNT(*) > 1;
