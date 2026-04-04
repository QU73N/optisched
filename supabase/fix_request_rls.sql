-- Fix RLS policies for schedule_change_requests
-- Ensures admins can SELECT, UPDATE, and DELETE all requests

-- Drop existing policies
DROP POLICY IF EXISTS "Teachers see own requests" ON schedule_change_requests;
DROP POLICY IF EXISTS "Teachers can create requests" ON schedule_change_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON schedule_change_requests;
DROP POLICY IF EXISTS "Admins can delete requests" ON schedule_change_requests;

-- SELECT: Teachers see their own, admins see all
CREATE POLICY "Teachers see own requests" ON schedule_change_requests FOR
SELECT USING (
    teacher_id = auth.uid()
    OR EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid() AND role IN ('admin', 'system_admin', 'power_admin', 'schedule_admin', 'schedule_manager')
    )
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"admin"%'
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"system_admin"%'
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"power_admin"%'
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"schedule_admin"%'
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"schedule_manager"%'
);

-- INSERT: Teachers and admins can create
CREATE POLICY "Teachers can create requests" ON schedule_change_requests FOR
INSERT WITH CHECK (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid() AND role IN ('teacher', 'admin', 'system_admin', 'power_admin', 'schedule_admin', 'schedule_manager')
    )
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"teacher"%'
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"admin"%'
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"system_admin"%'
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"power_admin"%'
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"schedule_admin"%'
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"schedule_manager"%'
);

-- UPDATE: Admins can approve/reject
CREATE POLICY "Admins can update requests" ON schedule_change_requests FOR
UPDATE USING (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid() AND role IN ('admin', 'system_admin', 'power_admin', 'schedule_admin', 'schedule_manager')
    )
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"admin"%'
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"system_admin"%'
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"power_admin"%'
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"schedule_admin"%'
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"schedule_manager"%'
);

-- DELETE: Admins can dismiss/delete requests
CREATE POLICY "Admins can delete requests" ON schedule_change_requests FOR
DELETE USING (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE id = auth.uid() AND role IN ('admin', 'system_admin', 'power_admin', 'schedule_admin', 'schedule_manager')
    )
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"admin"%'
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"system_admin"%'
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"power_admin"%'
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"schedule_admin"%'
    OR auth.jwt() -> 'user_metadata' ->> 'additional_roles' LIKE '%"schedule_manager"%'
);
