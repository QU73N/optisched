-- Update subject types from lecture/laboratory to common/special
-- This aligns with the PRD requirement for only two subject types

-- Step 1: Drop the old check constraint
ALTER TABLE public.subjects DROP CONSTRAINT IF EXISTS subjects_type_check;

-- Step 2: Update existing subjects to new type values
UPDATE public.subjects SET type = 'special' WHERE type = 'laboratory';
UPDATE public.subjects SET type = 'common' WHERE type = 'lecture';

-- Step 3: Add new check constraint for common/special only
ALTER TABLE public.subjects ADD CONSTRAINT subjects_type_check CHECK (type = ANY (ARRAY['common'::text, 'special'::text]));

-- Verification
SELECT type, COUNT(*) as count FROM public.subjects GROUP BY type ORDER BY type;
