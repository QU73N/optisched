-- ============================================================
-- Migration: Add Name Fields to Profiles Table
-- ============================================================
-- This migration adds separate name fields (last_name, first_name, 
-- middle_initial, suffix) to the profiles table and parses existing
-- full_name values into the new structure.
-- ============================================================

-- Step 1: Add new columns to profiles table
-- ============================================================

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS middle_initial text,
ADD COLUMN IF NOT EXISTS suffix text;

-- Step 2: Create a function to parse full_name into components
-- ============================================================

CREATE OR REPLACE FUNCTION parse_name_components(full_name text)
RETURNS TABLE(last_name text, first_name text, middle_initial text, suffix text) AS $$
DECLARE
    parts text[];
    last_part text;
    suffix_part text;
    remaining_name text;
    first_parts text[];
    parsed_last_name text;
    parsed_first_name text;
    parsed_middle_initial text;
    parsed_suffix text;
    match_result text[];
BEGIN
    -- Split full_name by comma to handle suffix (e.g., "Ello Jr., Egnacio Y.")
    parts := regexp_split_to_array(full_name, ',');
    
    IF array_length(parts, 1) > 1 THEN
        -- Has suffix (e.g., "Ello Jr., Egnacio Y.")
        last_part := trim(parts[1]);
        remaining_name := trim(parts[2]);
        
        -- Extract suffix from last_part (e.g., "Ello Jr." -> suffix="Jr.", last_name="Ello")
        match_result := regexp_matches(last_part, '\s+(Jr\.|Sr\.|II|III|IV)$', 'i');
        IF match_result IS NOT NULL THEN
            parsed_suffix := match_result[1];
            parsed_last_name := regexp_replace(last_part, '\s+(Jr\.|Sr\.|II|III|IV)$', '', 'i');
        ELSE
            parsed_last_name := last_part;
            parsed_suffix := NULL;
        END IF;
    ELSE
        -- No suffix (e.g., "Bea Angely Magno")
        remaining_name := trim(full_name);
        parsed_last_name := NULL;
        parsed_suffix := NULL;
    END IF;
    
    -- Split remaining name by space to get first name and middle initial
    first_parts := regexp_split_to_array(remaining_name, '\s+');
    
    IF array_length(first_parts, 1) = 1 THEN
        -- Only first name (e.g., "John")
        parsed_first_name := first_parts[1];
        parsed_middle_initial := NULL;
    ELSIF array_length(first_parts, 1) = 2 THEN
        -- First name and last name (e.g., "John Doe")
        -- But we already extracted last name, so this is first name only
        parsed_first_name := first_parts[1];
        parsed_middle_initial := NULL;
        -- If last_name wasn't set, use the last part
        IF parsed_last_name IS NULL THEN
            parsed_last_name := first_parts[2];
        END IF;
    ELSIF array_length(first_parts, 1) >= 3 THEN
        -- First name, middle, and last name (e.g., "John A. Doe")
        parsed_first_name := first_parts[1];
        parsed_middle_initial := first_parts[2];
        -- If last_name wasn't set, use the last part
        IF parsed_last_name IS NULL THEN
            parsed_last_name := first_parts[array_length(first_parts, 1)];
        END IF;
    END IF;
    
    RETURN QUERY SELECT 
        parsed_last_name,
        parsed_first_name,
        parsed_middle_initial,
        parsed_suffix;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Parse existing full_names and populate new fields
-- ============================================================

UPDATE profiles p
SET 
    last_name = parsed.last_name,
    first_name = parsed.first_name,
    middle_initial = parsed.middle_initial,
    suffix = parsed.suffix
FROM (
    SELECT 
        id,
        (parse_name_components(full_name)).*
    FROM profiles
) parsed
WHERE p.id = parsed.id
AND (p.last_name IS NULL OR p.first_name IS NULL);

-- Step 4: Create a function to combine name components into full_name
-- ============================================================

CREATE OR REPLACE FUNCTION combine_full_name(
    p_last_name text,
    p_first_name text,
    p_middle_initial text,
    p_suffix text
) RETURNS text AS $$
DECLARE
    result text;
BEGIN
    -- If suffix exists, format as: "Last Suffix, First Middle"
    IF p_suffix IS NOT NULL AND p_suffix != '' THEN
        IF p_middle_initial IS NOT NULL AND p_middle_initial != '' THEN
            result := p_last_name || ' ' || p_suffix || ', ' || p_first_name || ' ' || p_middle_initial;
        ELSE
            result := p_last_name || ' ' || p_suffix || ', ' || p_first_name;
        END IF;
    ELSE
        -- No suffix, format as: "First Middle Last"
        IF p_middle_initial IS NOT NULL AND p_middle_initial != '' THEN
            result := p_first_name || ' ' || p_middle_initial || ' ' || p_last_name;
        ELSE
            result := p_first_name || ' ' || p_last_name;
        END IF;
    END IF;
    
    RETURN trim(result);
END;
$$ LANGUAGE plpgsql;

-- Step 5: Update full_name to be computed from components
-- ============================================================

UPDATE profiles
SET full_name = combine_full_name(last_name, first_name, middle_initial, suffix)
WHERE last_name IS NOT NULL AND first_name IS NOT NULL;

-- Step 6: Add a trigger to auto-update full_name when name components change
-- ============================================================

CREATE OR REPLACE FUNCTION update_full_name_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.full_name := combine_full_name(
        NEW.last_name,
        NEW.first_name,
        NEW.middle_initial,
        NEW.suffix
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_full_name_trigger
BEFORE INSERT OR UPDATE OF last_name, first_name, middle_initial, suffix ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_full_name_trigger();

-- Step 7: Verification - Show the parsed results
-- ============================================================

SELECT 
    id,
    email,
    full_name as original_full_name,
    last_name,
    first_name,
    middle_initial,
    suffix,
    combine_full_name(last_name, first_name, middle_initial, suffix) as computed_full_name
FROM profiles
WHERE role = 'teacher'
ORDER BY full_name;
