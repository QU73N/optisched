-- Fix duplicate active versions
-- This script deactivates all status_change versions that are marked as active
-- Only published/overwrite/restore versions should be active

-- First, let's see the current active versions
SELECT id, version_number, change_type, batch_id, is_active, changed_at
FROM schedule_versions
WHERE is_active = true
ORDER BY changed_at DESC;

-- Deactivate all status_change versions that are active
-- These should not be active - only publish/overwrite/restore should be
UPDATE schedule_versions
SET is_active = false
WHERE is_active = true
AND change_type = 'status_change';

-- Verify the fix
SELECT id, version_number, change_type, batch_id, is_active, changed_at
FROM schedule_versions
WHERE is_active = true
ORDER BY changed_at DESC;
