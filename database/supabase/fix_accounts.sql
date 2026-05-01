-- Fix account roles and clean up duplicates

-- Step 1: Update admin.9999@optisched.sti.edu to power_admin (this is the working power admin)
UPDATE profiles 
SET role = 'power_admin' 
WHERE email = 'admin.9999@optisched.sti.edu';

-- Step 2: Delete duplicate teacher accounts (keep the main email, delete the .123456 duplicates)
DELETE FROM profiles WHERE email IN (
    'magno.123456@optisched.sti.edu',
    'habana.123456@optisched.sti.edu',
    'calizon.123456@optisched.sti.edu',
    'arnado.123456@optisched.sti.edu',
    'mariano.123456@optisched.sti.edu'
);

-- Step 3: Delete the duplicate egnacio account (keep ello.egnacio@optisched.sti.edu)
DELETE FROM profiles WHERE email = 'egnacio.123456@meycauayan.sti.edu.ph';

-- Step 4: Verify remaining profiles
SELECT id, email, full_name, role FROM profiles ORDER BY role, full_name;
