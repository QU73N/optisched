-- Fix RLS policies that use true for INSERT/UPDATE/DELETE

-- Drop overly permissive policies that have better alternatives
DROP POLICY IF EXISTS "Authenticated users can insert password_reset_requests" ON public.password_reset_requests;

-- For schedule_version_set_items, the permissive INSERT is intentional for version management
-- Keep it as is but document it

-- For schedule_versions, the permissive INSERT is intentional for version management
-- Keep it as is but document it

-- For subject_rooms, restrict DELETE/UPDATE/INSERT to admins only
DROP POLICY IF EXISTS "Authenticated users can delete subject_rooms" ON public.subject_rooms;
DROP POLICY IF EXISTS "Authenticated users can insert subject_rooms" ON public.subject_rooms;
DROP POLICY IF EXISTS "Authenticated users can update subject_rooms" ON public.subject_rooms;

CREATE POLICY "Admins can delete subject_rooms"
ON public.subject_rooms
FOR DELETE
TO authenticated
USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = ANY (ARRAY['admin'::text, 'power_admin'::text, 'system_admin'::text])
));

CREATE POLICY "Admins can insert subject_rooms"
ON public.subject_rooms
FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = ANY (ARRAY['admin'::text, 'power_admin'::text, 'system_admin'::text])
));

CREATE POLICY "Admins can update subject_rooms"
ON public.subject_rooms
FOR UPDATE
TO authenticated
USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = ANY (ARRAY['admin'::text, 'power_admin'::text, 'system_admin'::text])
))
WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = ANY (ARRAY['admin'::text, 'power_admin'::text, 'system_admin'::text])
));
