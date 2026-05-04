-- Update combine_full_name function to use new format: First Middle Last Suffix
-- Example: "Egnacio Y. Ello Jr."

DROP FUNCTION IF EXISTS combine_full_name(text, text, text, text);

CREATE OR REPLACE FUNCTION combine_full_name(
    p_last_name text,
    p_first_name text,
    p_middle_initial text,
    p_suffix text
) RETURNS text AS $$
DECLARE
    parts text[];
BEGIN
    -- Add first name
    IF p_first_name IS NOT NULL AND p_first_name != '' THEN
        parts := array_append(parts, trim(p_first_name));
    END IF;
    
    -- Add middle initial if present
    IF p_middle_initial IS NOT NULL AND p_middle_initial != '' THEN
        parts := array_append(parts, trim(p_middle_initial));
    END IF;
    
    -- Add last name
    IF p_last_name IS NOT NULL AND p_last_name != '' THEN
        parts := array_append(parts, trim(p_last_name));
    END IF;
    
    -- Add suffix if present
    IF p_suffix IS NOT NULL AND p_suffix != '' THEN
        parts := array_append(parts, trim(p_suffix));
    END IF;
    
    RETURN array_to_string(parts, ' ');
END;
$$ LANGUAGE plpgsql;

-- Update all full_names with new format
UPDATE profiles
SET full_name = combine_full_name(last_name, first_name, middle_initial, suffix)
WHERE last_name IS NOT NULL AND first_name IS NOT NULL;

-- Verify the results
SELECT 
    id,
    email,
    full_name,
    last_name,
    first_name,
    middle_initial,
    suffix
FROM profiles
WHERE role = 'teacher'
ORDER BY full_name;
