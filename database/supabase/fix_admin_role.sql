-- Fix admin role for the working power admin account
UPDATE profiles 
SET role = 'power_admin' 
WHERE email = 'admin.9999@optisched.sti.edu';

-- Verify the change
SELECT id, email, full_name, role FROM profiles WHERE email = 'admin.9999@optisched.sti.edu';
