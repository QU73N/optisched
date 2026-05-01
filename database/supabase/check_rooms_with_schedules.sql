-- Count unique rooms with schedules
SELECT COUNT(DISTINCT room_id) as unique_rooms_with_schedules
FROM schedules
WHERE room_id IS NOT NULL;

-- Check schedules without room_id
SELECT COUNT(*) as schedules_without_room
FROM schedules
WHERE room_id IS NULL;

-- List all rooms
SELECT id, name, building
FROM rooms
ORDER BY name;
