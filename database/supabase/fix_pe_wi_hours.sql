-- Fix PE and Work Immersion hours to work with 90-minute sessions
-- PE and Work Immersion currently have duration_hours=2, which doesn't divide into 90-minute sessions
-- Change to 3 hours (2 sessions of 90 minutes each)

UPDATE subjects
SET duration_hours = 3
WHERE name IN (
    'Physical Education and Health 1',
    'Physical Education and Health 2',
    'Work Immersion'
);

-- Verify the changes
SELECT name, duration_hours, sessions_per_week FROM subjects 
WHERE name IN (
    'Physical Education and Health 1',
    'Physical Education and Health 2',
    'Work Immersion'
);
