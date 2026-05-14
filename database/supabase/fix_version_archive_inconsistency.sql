-- Fix Version Archive Inconsistency
-- This script fixes versions that are marked as 'draft' but have archived schedules
-- Run this to ensure consistency between schedule_versions and schedules tables

-- Find versions marked as draft (change_type='created') but with archived schedules
SELECT 
    sv.id,
    sv.change_type,
    sv.change_summary,
    sv.batch_id,
    COUNT(s.id) as schedule_count,
    SUM(CASE WHEN s.status = 'archived' THEN 1 ELSE 0 END) as archived_count
FROM schedule_versions sv
LEFT JOIN schedules s ON sv.batch_id = s.batch_id
WHERE sv.change_type = 'created'
GROUP BY sv.id, sv.change_type, sv.change_summary, sv.batch_id
HAVING SUM(CASE WHEN s.status = 'archived' THEN 1 ELSE 0 END) > 0;

-- Fix: Update these versions to reflect their actual state
UPDATE schedule_versions
SET 
    change_type = 'status_change',
    change_summary = 'Version archived'
WHERE change_type = 'created'
AND id IN (
    SELECT sv.id
    FROM schedule_versions sv
    LEFT JOIN schedules s ON sv.batch_id = s.batch_id
    WHERE sv.change_type = 'created'
    GROUP BY sv.id
    HAVING SUM(CASE WHEN s.status = 'archived' THEN 1 ELSE 0 END) > 0
);

-- Verify the fix
SELECT 
    sv.id,
    sv.change_type,
    sv.change_summary,
    sv.batch_id,
    COUNT(s.id) as schedule_count,
    SUM(CASE WHEN s.status = 'archived' THEN 1 ELSE 0 END) as archived_count
FROM schedule_versions sv
LEFT JOIN schedules s ON sv.batch_id = s.batch_id
WHERE sv.change_type = 'created'
GROUP BY sv.id, sv.change_type, sv.change_summary, sv.batch_id
HAVING SUM(CASE WHEN s.status = 'archived' THEN 1 ELSE 0 END) > 0;

-- This should return no rows if the fix was successful
