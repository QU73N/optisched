-- Check for potential duplicates (same section, day, time, subject with different IDs)
SELECT 
    'POTENTIAL DUPLICATES' as section,
    section_id,
    day_of_week,
    start_time,
    end_time,
    subject_id,
    COUNT(*) as duplicate_count,
    STRING_AGG(DISTINCT status, ', ') as statuses,
    STRING_AGG(DISTINCT is_active::text, ', ') as is_active_flags
FROM public.schedules
GROUP BY section_id, day_of_week, start_time, end_time, subject_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, section_id, day_of_week, start_time
LIMIT 20;
