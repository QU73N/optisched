-- Update subject durations
-- Most subjects: 3 hours/week
-- PE and Work Immersion: 2 hours/week

-- Update PE subjects to 2 hours
UPDATE subjects
SET duration_hours = 2
WHERE name IN ('Physical Education and Health 1', 'Physical Education and Health 2');

-- Update Work Immersion to 2 hours
UPDATE subjects
SET duration_hours = 2
WHERE name = 'Work Immersion';

-- Update all other subjects to 3 hours
UPDATE subjects
SET duration_hours = 3
WHERE duration_hours IS NULL OR duration_hours NOT IN (2, 3);

-- Verify
SELECT name, duration_hours, sessions_per_week FROM subjects ORDER BY name;
