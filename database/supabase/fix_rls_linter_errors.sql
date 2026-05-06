-- Fix RLS linter errors
-- Enable RLS on tables that don't have it
-- Fix policies that reference user_metadata insecurely

-- 1. Enable RLS on user_activity_logs_archive
ALTER TABLE public.user_activity_logs_archive ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Archive logs are viewable by admins" ON public.user_activity_logs_archive;
DROP POLICY IF EXISTS "Archive logs are viewable by owner" ON public.user_activity_logs_archive;

-- Create proper RLS policies for user_activity_logs_archive
CREATE POLICY "Archive logs are viewable by admins"
ON public.user_activity_logs_archive FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
);

CREATE POLICY "Archive logs are viewable by owner"
ON public.user_activity_logs_archive FOR SELECT
USING (user_id = auth.uid());

-- 2. Enable RLS on teacher_messages
ALTER TABLE public.teacher_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Messages are viewable by sender" ON public.teacher_messages;
DROP POLICY IF EXISTS "Messages are viewable by receiver" ON public.teacher_messages;
DROP POLICY IF EXISTS "Messages are viewable by admins" ON public.teacher_messages;
DROP POLICY IF EXISTS "Teachers can send messages" ON public.teacher_messages;

-- Create proper RLS policies for teacher_messages
CREATE POLICY "Messages are viewable by sender"
ON public.teacher_messages FOR SELECT
USING (sender_id = auth.uid());

CREATE POLICY "Messages are viewable by receiver"
ON public.teacher_messages FOR SELECT
USING (receiver_id = auth.uid());

CREATE POLICY "Messages are viewable by admins"
ON public.teacher_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
);

CREATE POLICY "Teachers can send messages"
ON public.teacher_messages FOR INSERT
WITH CHECK (sender_id = auth.uid());

-- 3. Fix schedule_change_requests policies to NOT use user_metadata
-- Drop existing policies that use user_metadata
DROP POLICY IF EXISTS "Teachers see own requests" ON public.schedule_change_requests;
DROP POLICY IF EXISTS "Teachers can create requests" ON public.schedule_change_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON public.schedule_change_requests;
DROP POLICY IF EXISTS "Admins can delete requests" ON public.schedule_change_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON public.schedule_change_requests;

-- Create proper policies using auth.uid() instead of user_metadata
CREATE POLICY "Teachers see own requests"
ON public.schedule_change_requests FOR SELECT
USING (teacher_id = auth.uid());

CREATE POLICY "Admins can view all requests"
ON public.schedule_change_requests FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'power_admin', 'schedule_admin')
    )
);

CREATE POLICY "Teachers can create requests"
ON public.schedule_change_requests FOR INSERT
WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Admins can update requests"
ON public.schedule_change_requests FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'power_admin', 'schedule_admin')
    )
);

CREATE POLICY "Admins can delete requests"
ON public.schedule_change_requests FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'power_admin', 'schedule_admin')
    )
);

-- Verify the fixes
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
WHERE tablename IN ('user_activity_logs_archive', 'teacher_messages', 'schedule_change_requests')
ORDER BY tablename, policyname;
