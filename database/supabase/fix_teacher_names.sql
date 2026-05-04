-- Fix teacher name parsing to match expected format
-- Based on user's example: "Ello Jr., Egnacio Y." → Last: Ello, First: Egnacio, Middle: Y., Suffix: Jr.

-- Disable trigger temporarily
DROP TRIGGER IF EXISTS profiles_full_name_trigger ON profiles;

-- Fix Ello Jr., Egnacio Y.
UPDATE profiles
SET 
    first_name = 'Egnacio',
    middle_initial = 'Y.',
    last_name = 'Ello',
    suffix = 'Jr.',
    full_name = combine_full_name('Ello', 'Egnacio', 'Y.', 'Jr.')
WHERE full_name LIKE '%Ello%' AND role = 'teacher';

-- Re-enable trigger
CREATE TRIGGER profiles_full_name_trigger
BEFORE INSERT OR UPDATE OF last_name, first_name, middle_initial, suffix ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_full_name_trigger();

-- Verify the fixes
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
