-- Count total schedules
SELECT COUNT(*) as total_schedules FROM schedules;

-- Count by status
SELECT status, COUNT(*) as count FROM schedules GROUP BY status;
