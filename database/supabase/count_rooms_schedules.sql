-- Count unique rooms with schedules
SELECT COUNT(DISTINCT room_id) as unique_rooms_with_schedules
FROM schedules
WHERE room_id IS NOT NULL;

-- Count schedules by room
SELECT 
    r.name as room_name,
    COUNT(*) as schedule_count
FROM schedules s
JOIN rooms r ON s.room_id = r.id
GROUP BY r.id, r.name
ORDER BY schedule_count DESC;
