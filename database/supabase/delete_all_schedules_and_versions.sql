-- Delete all schedules and versions
-- WARNING: This will permanently delete ALL schedule data
-- Run this only if you want to completely reset the schedules

BEGIN;

-- Drop the trigger function that's causing issues
DROP FUNCTION IF EXISTS trg_schedule_delete_version() CASCADE;

-- Delete all schedule versions first (due to foreign key constraints)
DELETE FROM schedule_version_set_items;
DELETE FROM schedule_versions;
DELETE FROM schedule_version_sets;

-- Delete all schedules
DELETE FROM schedules;

-- Delete related conflicts
DELETE FROM conflicts;

COMMIT;

-- Verify deletion
SELECT 
    (SELECT COUNT(*) FROM schedules) as schedules_count,
    (SELECT COUNT(*) FROM schedule_versions) as versions_count,
    (SELECT COUNT(*) FROM schedule_version_sets) as version_sets_count,
    (SELECT COUNT(*) FROM conflicts) as conflicts_count;
