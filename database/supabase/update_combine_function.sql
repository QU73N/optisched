-- Update combine_full_name function and recalculate full_names

-- Drop and recreate the function
DROP FUNCTION IF EXISTS combine_full_name(text, text, text, text);

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

-- Update all full_names
UPDATE profiles
SET full_name = combine_full_name(last_name, first_name, middle_initial, suffix)
WHERE last_name IS NOT NULL AND first_name IS NOT NULL;

-- Verify
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
