-- Check the severity constraint on conflicts table
SELECT conname, consrc 
FROM pg_constraint 
WHERE conrelid = 'public.conflicts'::regclass 
AND conname LIKE '%severity%';
