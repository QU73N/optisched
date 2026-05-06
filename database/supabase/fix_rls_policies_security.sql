-- Fix RLS policies with "true" in WITH CHECK clauses
-- These policies bypass row-level security for INSERT/UPDATE/DELETE operations

-- Fix admin_messages INSERT policy
DROP POLICY IF EXISTS "Allow all insert on admin_messages" ON admin_messages;
DROP POLICY IF EXISTS "Admins can insert admin_messages" ON admin_messages;
CREATE POLICY "Admins can insert admin_messages" ON admin_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('power_admin', 'super_admin', 'admin', 'schedule_admin')
        )
    );

-- Fix admin_messages UPDATE policy
DROP POLICY IF EXISTS "Allow all update on admin_messages" ON admin_messages;
DROP POLICY IF EXISTS "Admins can update own admin_messages" ON admin_messages;
CREATE POLICY "Admins can update own admin_messages" ON admin_messages
    FOR UPDATE
    TO authenticated
    USING (
        sender_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('power_admin', 'super_admin')
        )
    )
    WITH CHECK (
        sender_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('power_admin', 'super_admin')
        )
    );

-- Fix custom_events INSERT policy
DROP POLICY IF EXISTS "Creators can insert" ON custom_events;
DROP POLICY IF EXISTS "Users can insert own custom_events" ON custom_events;
CREATE POLICY "Users can insert own custom_events" ON custom_events
    FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

-- Fix password_reset_requests INSERT policy (allow anon for password reset flow)
DROP POLICY IF EXISTS "Allow all insert on password_reset_requests" ON password_reset_requests;
DROP POLICY IF EXISTS "Anyone can insert password_reset_requests" ON password_reset_requests;
CREATE POLICY "Anyone can insert password_reset_requests" ON password_reset_requests
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);  -- Intentionally public for password reset flow

-- Fix password_reset_requests UPDATE policy (restrict to admins)
DROP POLICY IF EXISTS "Allow all update on password_reset_requests" ON password_reset_requests;
DROP POLICY IF EXISTS "Admins can update password_reset_requests" ON password_reset_requests;
CREATE POLICY "Admins can update password_reset_requests" ON password_reset_requests
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('power_admin', 'super_admin', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('power_admin', 'super_admin', 'admin')
        )
    );

-- Fix password_reset_requests INSERT policy to allow user to create own reset request
DROP POLICY IF EXISTS "prr_insert" ON password_reset_requests;
DROP POLICY IF EXISTS "Users can insert own password_reset_requests" ON password_reset_requests;
CREATE POLICY "Users can insert own password_reset_requests" ON password_reset_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Fix room_issues policy (allow teachers to report and admins to manage)
DROP POLICY IF EXISTS "allow_all_room_issues" ON room_issues;
DROP POLICY IF EXISTS "Admins can manage room_issues" ON room_issues;
DROP POLICY IF EXISTS "Teachers can report room issues" ON room_issues;
CREATE POLICY "Teachers can report room issues" ON room_issues
    FOR INSERT
    TO authenticated
    WITH CHECK (reported_by = auth.uid());
DROP POLICY IF EXISTS "Teachers can view and admins can manage room_issues" ON room_issues;
CREATE POLICY "Teachers can view and admins can manage room_issues" ON room_issues
    FOR SELECT
    TO authenticated
    USING (true);
DROP POLICY IF EXISTS "Admins can update room_issues" ON room_issues;
CREATE POLICY "Admins can update room_issues" ON room_issues
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('power_admin', 'super_admin', 'admin', 'schedule_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('power_admin', 'super_admin', 'admin', 'schedule_admin')
        )
    );

-- Fix schedule_change_requests policies (allow teachers to request, admins to view and manage)
DROP POLICY IF EXISTS "Teachers see own requests" ON schedule_change_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON schedule_change_requests;
DROP POLICY IF EXISTS "Teachers can create requests" ON schedule_change_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON schedule_change_requests;
DROP POLICY IF EXISTS "Admins can delete requests" ON schedule_change_requests;

CREATE POLICY "Teachers see own requests" ON schedule_change_requests
    FOR SELECT
    TO authenticated
    USING (teacher_id = auth.uid());

CREATE POLICY "Admins can view all requests" ON schedule_change_requests
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('power_admin', 'super_admin', 'admin', 'schedule_admin')
        )
    );

CREATE POLICY "Teachers can create requests" ON schedule_change_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Admins can update requests" ON schedule_change_requests
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('power_admin', 'super_admin', 'admin', 'schedule_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('power_admin', 'super_admin', 'admin', 'schedule_admin')
        )
    );

CREATE POLICY "Admins can delete requests" ON schedule_change_requests
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('power_admin', 'super_admin', 'admin', 'schedule_admin')
        )
    );

-- Fix announcements policies (allow teachers to create, admins/teachers to view)
DROP POLICY IF EXISTS "Anyone can view announcements" ON announcements;
DROP POLICY IF EXISTS "Teachers can create announcements" ON announcements;
DROP POLICY IF EXISTS "Admins can delete announcements" ON announcements;
DROP POLICY IF EXISTS "Teachers can delete own announcements" ON announcements;

CREATE POLICY "Anyone can view announcements" ON announcements
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Teachers can create announcements" ON announcements
    FOR INSERT
    TO authenticated
    WITH CHECK (author_id = auth.uid());

CREATE POLICY "Teachers can delete own announcements" ON announcements
    FOR DELETE
    TO authenticated
    USING (author_id = auth.uid());

CREATE POLICY "Admins can delete announcements" ON announcements
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('power_admin', 'super_admin', 'admin', 'schedule_admin')
        )
    );

-- Verification query
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('admin_messages', 'custom_events', 'password_reset_requests', 'room_issues', 'schedule_change_requests')
ORDER BY tablename, policyname;
