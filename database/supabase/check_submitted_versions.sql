-- Check the relationship between change_type and schedule status
SELECT 
    'CHANGE TYPE VS SCHEDULE STATUS' as section,
    v.change_type,
    v.is_active as version_is_active,
    s.status as schedule_status,
    s.is_active as schedule_is_active,
    COUNT(*) as count
FROM schedule_versions v
JOIN schedules s ON s.batch_id = v.batch_id
GROUP BY v.change_type, v.is_active, s.status, s.is_active
ORDER BY v.change_type, s.status;

-- Check the most recent status_change version in detail
SELECT 
    'STATUS_CHANGE VERSION DETAIL' as section,
    v.id as version_id,
    v.version_number,
    v.change_type,
    v.is_active as version_is_active,
    s.id as schedule_id,
    s.status as schedule_status,
    s.is_active as schedule_is_active
FROM schedule_versions v
JOIN schedules s ON s.batch_id = v.batch_id
WHERE v.change_type = 'status_change'
ORDER BY v.changed_at DESC
LIMIT 5;
