-- Add max_hours_per_day column to teachers table
-- This implements PRD Section 8.3: Teacher employment type defines "Max hours per day"
-- This implements PRD Section 13.1: "Maximum daily teaching hours" as a hard constraint

-- Step 1: Add the column with a default
ALTER TABLE public.teachers 
ADD COLUMN IF NOT EXISTS max_hours_per_day integer NOT NULL DEFAULT 8;

-- Step 2: Set appropriate values based on employment type
-- Full-time: 8 hours/day (5 days × 8 = 40 hours/week)
-- Part-time: 4 hours/day (5 days × 4 = 20 hours/week)
UPDATE public.teachers 
SET max_hours_per_day = CASE 
    WHEN employment_type = 'full-time' THEN 8
    WHEN employment_type = 'part-time' THEN 4
    ELSE 8
END;

-- Step 3: Verify the changes
SELECT 
    t.id,
    p.full_name,
    t.employment_type,
    t.max_hours as max_hours_weekly,
    t.max_hours_per_day,
    (t.max_hours_per_day * 5) as expected_weekly_hours
FROM public.teachers t
JOIN public.profiles p ON t.profile_id = p.id
ORDER BY p.full_name;
