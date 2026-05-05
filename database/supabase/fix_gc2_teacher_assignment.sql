-- Fix GC2 (General Chemistry 2) teacher assignment
-- GC2 should be taught by Mark Gerald Doblon (chemistry specialist)
-- Currently it may be assigned to wrong teacher or have no fixed teacher

-- Update GC2 to have Mark Gerald Doblon as the fixed teacher
UPDATE subjects
SET teacher_id = 'bc211fd8-9917-4114-af3c-6b4694a9cc1c'
WHERE code = 'GC2';

-- Verify the change
SELECT id, code, name, teacher_id 
FROM subjects 
WHERE code = 'GC2';

-- Also verify Mark Gerald Doblon's record (join with profiles to get full_name)
SELECT t.id, p.full_name FROM teachers t JOIN profiles p ON t.profile_id = p.id WHERE t.id = 'bc211fd8-9917-4114-af3c-6b4694a9cc1c';
