-- Update room types from lecture/laboratory/gymnasium/computer_lab to common/special
-- This aligns with the PRD requirement for only two room types

-- Step 1: Drop the old check constraint
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_type_check;

-- Step 2: Update existing rooms to new type values
UPDATE public.rooms SET type = 'common' WHERE type IN ('lecture', 'computer_lab');
UPDATE public.rooms SET type = 'special' WHERE type IN ('laboratory', 'gymnasium');

-- Step 3: Add new check constraint for common/special only
ALTER TABLE public.rooms ADD CONSTRAINT rooms_type_check CHECK (type = ANY (ARRAY['common'::text, 'special'::text]));

-- Verification
SELECT type, COUNT(*) as count FROM public.rooms GROUP BY type ORDER BY type;
