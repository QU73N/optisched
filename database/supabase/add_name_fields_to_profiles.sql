-- Add structured name fields to profiles table
-- This migration adds last_name, first_name, middle_initial, suffix fields
-- and creates a trigger to auto-generate full_name from these components

-- Add new columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS middle_initial text,
ADD COLUMN IF NOT EXISTS suffix text;

-- Create a function to generate full_name from name components
CREATE OR REPLACE FUNCTION public.generate_full_name()
RETURNS trigger AS $$
DECLARE
    full_name text;
BEGIN
    -- Build full name from components
    full_name := COALESCE(NEW.last_name, '');
    
    IF NEW.first_name IS NOT NULL AND NEW.first_name != '' THEN
        IF full_name != '' THEN
            full_name := full_name || ', ' || NEW.first_name;
        ELSE
            full_name := NEW.first_name;
        END IF;
    END IF;
    
    IF NEW.middle_initial IS NOT NULL AND NEW.middle_initial != '' THEN
        full_name := full_name || ' ' || UPPER(NEW.middle_initial) || '.';
    END IF;
    
    IF NEW.suffix IS NOT NULL AND NEW.suffix != '' THEN
        full_name := full_name || ' ' || NEW.suffix;
    END IF;
    
    -- If no name components, use existing full_name or default
    IF full_name = '' THEN
        full_name := COALESCE(NEW.full_name, 'Unknown');
    END IF;
    
    NEW.full_name := full_name;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate full_name on insert/update
DROP TRIGGER IF EXISTS set_full_name ON public.profiles;
CREATE TRIGGER set_full_name
    BEFORE INSERT OR UPDATE OF last_name, first_name, middle_initial, suffix ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_full_name();

-- Migrate existing data: try to parse existing full_name into components
-- This is a best-effort migration for existing records
UPDATE public.profiles
SET 
    last_name = SUBSTRING(full_name FROM '^(.+?)(?:,|$)'),
    first_name = CASE 
        WHEN full_name ~ ', ' THEN SUBSTRING(full_name FROM ', (.+?)(?: |$)')
        ELSE NULL
    END
WHERE last_name IS NULL AND full_name IS NOT NULL AND full_name != 'Unknown';

-- Verify the migration
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' 
AND table_schema = 'public'
AND column_name IN ('last_name', 'first_name', 'middle_initial', 'suffix', 'full_name')
ORDER BY column_name;

-- Sample records to verify
SELECT 
    id,
    email,
    role,
    full_name,
    last_name,
    first_name,
    middle_initial,
    suffix
FROM public.profiles
LIMIT 5;
