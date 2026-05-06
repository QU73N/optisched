-- Fix RLS policies for subjects and rooms to allow authenticated users to read them
-- This fixes the 400 errors when loading subjects and rooms

-- Drop all existing RLS policies on subjects
DROP POLICY IF EXISTS "Public subjects are viewable by everyone" ON subjects;
DROP POLICY IF EXISTS "Subjects are insertable by admins" ON subjects;
DROP POLICY IF EXISTS "Subjects owned by user are viewable" ON subjects;
DROP POLICY IF EXISTS "Subjects shared with user are viewable" ON subjects;
DROP POLICY IF EXISTS "subjects_admin_all" ON subjects;
DROP POLICY IF EXISTS "subjects_bypass_rls" ON subjects;
DROP POLICY IF EXISTS "subjects_insert_own" ON subjects;
DROP POLICY IF EXISTS "subjects_read_shared" ON subjects;
DROP POLICY IF EXISTS "subjects_select" ON subjects;
DROP POLICY IF EXISTS "subjects_update_own" ON subjects;
DROP POLICY IF EXISTS "subjects_write" ON subjects;

-- Drop all existing RLS policies on rooms
DROP POLICY IF EXISTS "Public rooms are viewable by everyone" ON rooms;
DROP POLICY IF EXISTS "Rooms are insertable by admins" ON rooms;
DROP POLICY IF EXISTS "Rooms owned by user are viewable" ON rooms;
DROP POLICY IF EXISTS "Rooms shared with user are viewable" ON rooms;
DROP POLICY IF EXISTS "rooms_admin_all" ON rooms;
DROP POLICY IF EXISTS "rooms_bypass_rls" ON rooms;
DROP POLICY IF EXISTS "rooms_insert_own" ON rooms;
DROP POLICY IF EXISTS "rooms_read_shared" ON rooms;
DROP POLICY IF EXISTS "rooms_select" ON rooms;
DROP POLICY IF EXISTS "rooms_update_own" ON rooms;
DROP POLICY IF EXISTS "rooms_write" ON rooms;

-- Create simple RLS policies for subjects
CREATE POLICY "subjects_select_all" ON subjects
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "subjects_insert_admin" ON subjects
    FOR INSERT
    TO public
    WITH CHECK (
        auth.uid() IS NOT NULL 
        AND EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = ANY (ARRAY['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'])
        )
    );

CREATE POLICY "subjects_update_admin" ON subjects
    FOR UPDATE
    TO public
    USING (
        auth.uid() IS NOT NULL 
        AND EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = ANY (ARRAY['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'])
        )
    );

-- Create simple RLS policies for rooms
CREATE POLICY "rooms_select_all" ON rooms
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "rooms_insert_admin" ON rooms
    FOR INSERT
    TO public
    WITH CHECK (
        auth.uid() IS NOT NULL 
        AND EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = ANY (ARRAY['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'])
        )
    );

CREATE POLICY "rooms_update_admin" ON rooms
    FOR UPDATE
    TO public
    USING (
        auth.uid() IS NOT NULL 
        AND EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = ANY (ARRAY['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'])
        )
    );

-- Verify the new policies
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('subjects', 'rooms')
ORDER BY tablename, policyname;
