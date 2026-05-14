-- Check version change types and their corresponding schedule statuses
SELECT 
    'VERSION CHANGE TYPES' as section,
    change_type,
    is_active,
    COUNT(*) as count
FROM schedule_versions
GROUP BY change_type, is_active
ORDER BY change_type, is_active;

-- Check schedule statuses by version change type
SELECT 
    'SCHEDULE STATUS BY CHANGE TYPE' as section,
    v.change_type,
    s.status as schedule_status,
    COUNT(*) as count
FROM schedule_versions v
JOIN schedules s ON s.batch_id = v.batch_id
GROUP BY v.change_type, s.status
ORDER BY v.change_type, s.status;

-- Check a sample of recent versions
SELECT 
    'RECENT VERSIONS SAMPLE' as section,
    id,
    version_number,
    change_type,
    is_active,
    changed_at,
    changed_by
FROM schedule_versions
ORDER BY changed_at DESC
LIMIT 10;
