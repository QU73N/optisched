-- Add max_hours_per_day to teachers table per PRD requirement
-- Section 8.3: Teacher employment type defines Max hours per day, Max hours per week, Load rules
-- Section 13.1 (Hard Constraints): Maximum daily teaching hours must be enforced

-- Add max_hours_per_day column to teachers table
ALTER TABLE public.teachers 
ADD COLUMN IF NOT EXISTS max_hours_per_day integer DEFAULT 8 CHECK (max_hours_per_day > 0);

-- Add comment for documentation
COMMENT ON COLUMN public.teachers.max_hours_per_day IS 'Maximum teaching hours per day for this teacher. Hard constraint enforced by scheduler.';

-- Verification
SELECT 
    'teachers.max_hours_per_day added successfully' as status,
    column_name,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'teachers' 
  AND column_name = 'max_hours_per_day';
