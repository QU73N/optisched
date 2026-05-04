-- Update room data with proper types and capacities

-- Update room types
UPDATE rooms SET type = 'common' WHERE name IN ('Room 101', 'Room 102', 'Room 103', 'Room 104', 'Room 105', 'Room 106', 'Room 107', 'Room 108', 'Amphitheater');
UPDATE rooms SET type = 'special' WHERE name IN ('Physics Laboratory', 'Chemical Laboratory', 'Kitchen', 'P.E. Hall', 'Computer Laboratory');

-- Update room capacities
UPDATE rooms SET capacity = 35 WHERE name IN ('Room 101', 'Room 102', 'Room 103', 'Room 104', 'Room 105', 'Room 106', 'Room 107', 'Room 108', 'Amphitheater', 'Physics Laboratory', 'Chemical Laboratory', 'Computer Laboratory');
UPDATE rooms SET capacity = 20 WHERE name = 'P.E. Hall';
UPDATE rooms SET capacity = 15 WHERE name = 'Kitchen';

-- Verify updates
SELECT name, type, capacity FROM rooms ORDER BY type, name;
