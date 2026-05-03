-- Drop the severity and type check constraints that are blocking scanner data
-- The scanner should be the source of truth for valid values

ALTER TABLE public.conflicts DROP CONSTRAINT IF EXISTS conflicts_severity_check;
ALTER TABLE public.conflicts DROP CONSTRAINT IF EXISTS conflicts_type_check;

-- Verify constraints were dropped
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    CASE contype
        WHEN 'c' THEN 'CHECK'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'u' THEN 'UNIQUE'
        WHEN 'x' THEN 'EXCLUSION'
    END as constraint_type_name
FROM pg_constraint 
WHERE conrelid = 'public.conflicts'::regclass;
