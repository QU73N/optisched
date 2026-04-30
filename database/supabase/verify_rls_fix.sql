-- Verify RLS is enabled on all tables
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('user_activity_logs_archive', 'teacher_messages', 'schedule_change_requests')
ORDER BY tablename;

-- Verify no policies reference user_metadata
SELECT 
    schemaname,
    tablename,
    policyname,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'schedule_change_requests'
AND (qual::text LIKE '%user_metadata%' OR with_check::text LIKE '%user_metadata%');
