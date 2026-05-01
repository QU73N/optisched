-- ============================================================================
-- COMPREHENSIVE DATABASE HEALTH CHECK SCRIPT
-- Based on database/schemas/database_schema.sql
-- Run this in Supabase SQL Editor to verify database integrity and fix issues
-- ============================================================================

-- ============================================================================
-- SECTION 1: TABLE EXISTENCE CHECKS (All 32 tables)
-- ============================================================================

SELECT 
    'TABLE EXISTENCE' as category,
    table_name,
    CASE WHEN EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = t.table_name
    ) THEN '✓ EXISTS' ELSE '✗ MISSING' END as status
FROM (VALUES 
    ('admin_messages'),
    ('admin_tasks'),
    ('announcements'),
    ('approval_audit_log'),
    ('approval_requests'),
    ('audit_logs'),
    ('backup_jobs'),
    ('chat_messages'),
    ('client_error_logs'),
    ('conflicts'),
    ('custom_events'),
    ('emergency_overrides'),
    ('feature_flags'),
    ('institution_breaks'),
    ('notifications'),
    ('password_reset_requests'),
    ('priority_config'),
    ('profiles'),
    ('rate_limit_buckets'),
    ('room_issues'),
    ('rooms'),
    ('schedule_change_requests'),
    ('schedule_version_set_items'),
    ('schedule_version_sets'),
    ('schedule_versions'),
    ('schedules'),
    ('sections'),
    ('sharing_requests'),
    ('subjects'),
    ('system_rules'),
    ('teacher_messages'),
    ('teacher_preferences'),
    ('teachers'),
    ('user_activity_logs'),
    ('user_activity_logs_archive'),
    ('user_permission_overrides')
) AS t(table_name)
ORDER BY table_name;

-- ============================================================================
-- SECTION 2: SCHEMA COLUMN VERIFICATION (All tables)
-- ============================================================================

-- Profiles table
SELECT 
    'SCHEMA: profiles' as category,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Teachers table
SELECT 
    'SCHEMA: teachers' as category,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'teachers'
ORDER BY ordinal_position;

-- Teacher preferences table
SELECT 
    'SCHEMA: teacher_preferences' as category,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'teacher_preferences'
ORDER BY ordinal_position;

-- Subjects table
SELECT 
    'SCHEMA: subjects' as category,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'subjects'
ORDER BY ordinal_position;

-- Rooms table
SELECT 
    'SCHEMA: rooms' as category,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'rooms'
ORDER BY ordinal_position;

-- Sections table
SELECT 
    'SCHEMA: sections' as category,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'sections'
ORDER BY ordinal_position;

-- Schedules table
SELECT 
    'SCHEMA: schedules' as category,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'schedules'
ORDER BY ordinal_position;

-- Conflicts table
SELECT 
    'SCHEMA: conflicts' as category,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'conflicts'
ORDER BY ordinal_position;

-- System rules table
SELECT 
    'SCHEMA: system_rules' as category,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'system_rules'
ORDER BY ordinal_position;

-- ============================================================================
-- SECTION 3: FOREIGN KEY INTEGRITY CHECKS
-- ============================================================================

-- Check: Teachers -> Profiles
SELECT 
    'FK INTEGRITY' as category,
    'Teachers profile_id -> Profiles' as check_item,
    COUNT(*) as orphaned_count,
    'Teacher records with invalid profile_id' as description
FROM public.teachers t
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = t.profile_id
);

-- Check: Teacher Preferences -> Teachers
SELECT 
    'FK INTEGRITY' as category,
    'Teacher preferences teacher_id -> Teachers' as check_item,
    COUNT(*) as orphaned_count,
    'Teacher preferences with invalid teacher_id' as description
FROM public.teacher_preferences tp
WHERE NOT EXISTS (
    SELECT 1 FROM public.teachers t WHERE t.id = tp.teacher_id
);

-- Check: Schedules -> Teachers
SELECT 
    'FK INTEGRITY' as category,
    'Schedules teacher_id -> Teachers' as check_item,
    COUNT(*) as orphaned_count,
    'Schedules with invalid teacher_id' as description
FROM public.schedules s
WHERE s.teacher_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.teachers t WHERE t.id = s.teacher_id
    );

-- Check: Schedules -> Subjects
SELECT 
    'FK INTEGRITY' as category,
    'Schedules subject_id -> Subjects' as check_item,
    COUNT(*) as orphaned_count,
    'Schedules with invalid subject_id' as description
FROM public.schedules s
WHERE s.subject_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.subjects sub WHERE sub.id = s.subject_id
    );

-- Check: Schedules -> Rooms
SELECT 
    'FK INTEGRITY' as category,
    'Schedules room_id -> Rooms' as check_item,
    COUNT(*) as orphaned_count,
    'Schedules with invalid room_id' as description
FROM public.schedules s
WHERE s.room_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.rooms r WHERE r.id = s.room_id
    );

-- Check: Schedules -> Sections
SELECT 
    'FK INTEGRITY' as category,
    'Schedules section_id -> Sections' as check_item,
    COUNT(*) as orphaned_count,
    'Schedules with invalid section_id' as description
FROM public.schedules s
WHERE s.section_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.sections sec WHERE sec.id = s.section_id
    );

-- Check: Schedules -> Profiles (created_by)
SELECT 
    'FK INTEGRITY' as category,
    'Schedules created_by -> Profiles' as check_item,
    COUNT(*) as orphaned_count,
    'Schedules with invalid created_by' as description
FROM public.schedules s
WHERE s.created_by IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = s.created_by
    );

-- Check: Schedules -> Profiles (approved_by)
SELECT 
    'FK INTEGRITY' as category,
    'Schedules approved_by -> Profiles' as check_item,
    COUNT(*) as orphaned_count,
    'Schedules with invalid approved_by' as description
FROM public.schedules s
WHERE s.approved_by IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = s.approved_by
    );

-- Check: Conflicts -> Schedules
SELECT 
    'FK INTEGRITY' as category,
    'Conflicts schedule_a_id -> Schedules' as check_item,
    COUNT(*) as orphaned_count,
    'Conflicts with invalid schedule_a_id' as description
FROM public.conflicts c
WHERE c.schedule_a_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.schedules s WHERE s.id = c.schedule_a_id
    );

-- Check: Conflicts -> Schedules (schedule_b)
SELECT 
    'FK INTEGRITY' as category,
    'Conflicts schedule_b_id -> Schedules' as check_item,
    COUNT(*) as orphaned_count,
    'Conflicts with invalid schedule_b_id' as description
FROM public.conflicts c
WHERE c.schedule_b_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.schedules s WHERE s.id = c.schedule_b_id
    );

-- Check: Conflicts -> Profiles (resolved_by)
SELECT 
    'FK INTEGRITY' as category,
    'Conflicts resolved_by -> Profiles' as check_item,
    COUNT(*) as orphaned_count,
    'Conflicts with invalid resolved_by' as description
FROM public.conflicts c
WHERE c.resolved_by IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = c.resolved_by
    );

-- Check: Schedule Change Requests -> Schedules
SELECT 
    'FK INTEGRITY' as category,
    'Schedule change requests schedule_id -> Schedules' as check_item,
    COUNT(*) as orphaned_count,
    'Change requests with invalid schedule_id' as description
FROM public.schedule_change_requests scr
WHERE scr.schedule_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.schedules s WHERE s.id = scr.schedule_id
    );

-- Check: Schedule Change Requests -> auth.users (teacher_id references auth.users, not teachers table)
SELECT 
    'FK INTEGRITY' as category,
    'Schedule change requests teacher_id -> auth.users' as check_item,
    COUNT(*) as orphaned_count,
    'Change requests with invalid teacher_id (references auth.users)' as description
FROM public.schedule_change_requests scr
WHERE scr.teacher_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM auth.users u WHERE u.id = scr.teacher_id
    );

-- Check: Subjects -> Teachers
SELECT 
    'FK INTEGRITY' as category,
    'Subjects teacher_id -> Teachers' as check_item,
    COUNT(*) as orphaned_count,
    'Subjects with invalid teacher_id' as description
FROM public.subjects sub
WHERE sub.teacher_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.teachers t WHERE t.id = sub.teacher_id
    );

-- Check: Subjects -> Profiles (owner_id)
SELECT 
    'FK INTEGRITY' as category,
    'Subjects owner_id -> Profiles' as check_item,
    COUNT(*) as orphaned_count,
    'Subjects with invalid owner_id' as description
FROM public.subjects sub
WHERE sub.owner_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = sub.owner_id
    );

-- Check: Room Issues -> Rooms (by room_name)
SELECT 
    'FK INTEGRITY' as category,
    'Room issues room_name -> Rooms' as check_item,
    COUNT(*) as orphaned_count,
    'Room issues with invalid room_name (room does not exist)' as description
FROM public.room_issues ri
WHERE ri.room_name IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.rooms r WHERE r.name = ri.room_name
    );

-- Check: Room Issues -> Profiles (reported_by)
SELECT 
    'FK INTEGRITY' as category,
    'Room issues reported_by -> Profiles' as check_item,
    COUNT(*) as orphaned_count,
    'Room issues with invalid reported_by' as description
FROM public.room_issues ri
WHERE ri.reported_by IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = ri.reported_by
    );

-- Check: Approval Requests -> Profiles (requested_by)
SELECT 
    'FK INTEGRITY' as category,
    'Approval requests requested_by -> Profiles' as check_item,
    COUNT(*) as orphaned_count,
    'Approval requests with invalid requested_by' as description
FROM public.approval_requests ar
WHERE ar.requested_by IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = ar.requested_by
    );

-- Check: Approval Requests -> Profiles (approved_by)
SELECT 
    'FK INTEGRITY' as category,
    'Approval requests approved_by -> Profiles' as check_item,
    COUNT(*) as orphaned_count,
    'Approval requests with invalid approved_by' as description
FROM public.approval_requests ar
WHERE ar.approved_by IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = ar.approved_by
    );

-- Check: Notifications -> Profiles (user_id)
SELECT 
    'FK INTEGRITY' as category,
    'Notifications user_id -> Profiles' as check_item,
    COUNT(*) as orphaned_count,
    'Notifications with invalid user_id' as description
FROM public.notifications n
WHERE n.user_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = n.user_id
    );

-- Check: User Activity Logs -> Profiles (user_id)
SELECT 
    'FK INTEGRITY' as category,
    'User activity logs user_id -> Profiles' as check_item,
    COUNT(*) as orphaned_count,
    'User activity logs with invalid user_id' as description
FROM public.user_activity_logs ual
WHERE ual.user_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = ual.user_id
    );

-- Check: User Permission Overrides -> Profiles (user_id)
SELECT 
    'FK INTEGRITY' as category,
    'User permission overrides user_id -> Profiles' as check_item,
    COUNT(*) as orphaned_count,
    'User permission overrides with invalid user_id' as description
FROM public.user_permission_overrides upo
WHERE upo.user_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = upo.user_id
    );

-- Check: User Permission Overrides -> Profiles (set_by)
SELECT 
    'FK INTEGRITY' as category,
    'User permission overrides set_by -> Profiles' as check_item,
    COUNT(*) as orphaned_count,
    'User permission overrides with invalid set_by' as description
FROM public.user_permission_overrides upo
WHERE upo.set_by IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = upo.set_by
    );

-- ============================================================================
-- SECTION 4: DATA INTEGRITY CHECKS
-- ============================================================================

-- Check: Teacher profiles without teacher records
SELECT 
    'DATA INTEGRITY' as category,
    'Teacher profiles without teacher records' as check_item,
    COUNT(*) as issue_count,
    'Profiles with role=teacher but no corresponding teacher record' as description
FROM public.profiles p
WHERE p.role = 'teacher'
    AND NOT EXISTS (
        SELECT 1 FROM public.teachers t WHERE t.profile_id = p.id
    );

-- FIX QUERY (uncomment and run if issue_count > 0):
-- INSERT INTO public.teachers (
--     profile_id, department, employment_type, max_hours, current_load_percentage,
--     is_active, is_public, shared_with, owner_id
-- )
-- SELECT 
--     p.id, COALESCE(p.department, 'General'), 'full-time', 40, 0.0,
--     true, true, ARRAY[]::uuid[], NULL
-- FROM public.profiles p
-- WHERE p.role = 'teacher'
--     AND NOT EXISTS (SELECT 1 FROM public.teachers t WHERE t.profile_id = p.id)
-- ON CONFLICT (profile_id) DO NOTHING;

-- Check: Teachers not public (RLS visibility issue)
SELECT 
    'DATA INTEGRITY' as category,
    'Teachers not public' as check_item,
    COUNT(*) as issue_count,
    'Teachers with is_public=false (will not be visible in frontend)' as description
FROM public.teachers
WHERE is_public = false OR is_public IS NULL;

-- FIX QUERY (uncomment and run if issue_count > 0):
-- UPDATE public.teachers
-- SET is_public = true, shared_with = ARRAY[]::uuid[], owner_id = NULL
-- WHERE is_public = false OR is_public IS NULL;

-- Check: Teachers without teacher preferences
SELECT 
    'DATA INTEGRITY' as category,
    'Teachers without preferences' as check_item,
    COUNT(*) as issue_count,
    'Teachers without corresponding teacher_preferences record' as description
FROM public.teachers t
WHERE NOT EXISTS (
    SELECT 1 FROM public.teacher_preferences tp WHERE tp.teacher_id = t.id
);

-- FIX QUERY (uncomment and run if issue_count > 0):
-- INSERT INTO public.teacher_preferences (
--     teacher_id, preferred_days, availability, preferred_time_start, preferred_time_end,
--     max_classes_per_day, max_consecutive_classes, notes
-- )
-- SELECT 
--     t.id, ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']::text[],
--     '{"Monday":{"morning":true,"afternoon":true,"evening":false},"Tuesday":{"morning":true,"afternoon":true,"evening":false},"Wednesday":{"morning":true,"afternoon":true,"evening":false},"Thursday":{"morning":true,"afternoon":true,"evening":false},"Friday":{"morning":true,"afternoon":true,"evening":false}}'::jsonb,
--     '8:00', '17:00', 5, 3, 'Default availability - backfilled'
-- FROM public.teachers t
-- WHERE NOT EXISTS (SELECT 1 FROM public.teacher_preferences tp WHERE tp.teacher_id = t.id)
-- ON CONFLICT (teacher_id) DO NOTHING;

-- Check: Subjects not public (if applicable)
SELECT 
    'DATA INTEGRITY' as category,
    'Subjects not public' as check_item,
    COUNT(*) as issue_count,
    'Subjects with is_public=false (if applicable)' as description
FROM public.subjects sub
WHERE is_public = false OR is_public IS NULL;

-- Check: Rooms not public (if applicable)
SELECT 
    'DATA INTEGRITY' as category,
    'Rooms not public' as check_item,
    COUNT(*) as issue_count,
    'Rooms with is_public=false (if applicable)' as description
FROM public.rooms r
WHERE is_public = false OR is_public IS NULL;

-- ============================================================================
-- SECTION 5: RLS POLICY CHECKS (All tables with RLS)
-- ============================================================================

-- Get all RLS policies for all tables
SELECT 
    'RLS POLICIES' as category,
    tablename as table_name,
    policyname,
    permissive,
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN substring(qual, 1, 100)
        ELSE 'N/A'
    END as qual_preview
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================================================
-- SECTION 6: TRIGGER CHECKS
-- ============================================================================

-- Check for auto-create teacher trigger
SELECT 
    'TRIGGERS' as category,
    'Auto-create teacher trigger' as check_item,
    EXISTS (
        SELECT FROM information_schema.triggers
        WHERE trigger_name = 'auto_create_teacher_trigger'
    ) as exists,
    CASE WHEN EXISTS (
        SELECT FROM information_schema.triggers
        WHERE trigger_name = 'auto_create_teacher_trigger'
    ) THEN '✓ OK' ELSE '✗ MISSING' END as status;

-- List all triggers
SELECT 
    'TRIGGERS' as category,
    event_object_table as table_name,
    trigger_name,
    action_statement,
    event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- SECTION 7: FUNCTION CHECKS
-- ============================================================================

-- List all custom functions (excluding system functions)
SELECT 
    'FUNCTIONS' as category,
    routine_name,
    routine_type,
    data_type,
    CASE 
        WHEN external_name IS NOT NULL THEN 'EXTERNAL'
        ELSE 'INTERNAL'
    END as function_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name NOT LIKE 'pg_%'
    AND routine_name NOT LIKE '_pg_%'
ORDER BY routine_name;

-- ============================================================================
-- SECTION 8: DATA COUNTS (All tables)
-- ============================================================================

SELECT 
    'DATA COUNTS' as category,
    table_name,
    row_count
FROM (
    SELECT 'admin_messages' as table_name, COUNT(*) as row_count FROM public.admin_messages
    UNION ALL
    SELECT 'admin_tasks', COUNT(*) FROM public.admin_tasks
    UNION ALL
    SELECT 'announcements', COUNT(*) FROM public.announcements
    UNION ALL
    SELECT 'approval_audit_log', COUNT(*) FROM public.approval_audit_log
    UNION ALL
    SELECT 'approval_requests', COUNT(*) FROM public.approval_requests
    UNION ALL
    SELECT 'audit_logs', COUNT(*) FROM public.audit_logs
    UNION ALL
    SELECT 'backup_jobs', COUNT(*) FROM public.backup_jobs
    UNION ALL
    SELECT 'chat_messages', COUNT(*) FROM public.chat_messages
    UNION ALL
    SELECT 'client_error_logs', COUNT(*) FROM public.client_error_logs
    UNION ALL
    SELECT 'conflicts', COUNT(*) FROM public.conflicts
    UNION ALL
    SELECT 'custom_events', COUNT(*) FROM public.custom_events
    UNION ALL
    SELECT 'emergency_overrides', COUNT(*) FROM public.emergency_overrides
    UNION ALL
    SELECT 'feature_flags', COUNT(*) FROM public.feature_flags
    UNION ALL
    SELECT 'institution_breaks', COUNT(*) FROM public.institution_breaks
    UNION ALL
    SELECT 'notifications', COUNT(*) FROM public.notifications
    UNION ALL
    SELECT 'password_reset_requests', COUNT(*) FROM public.password_reset_requests
    UNION ALL
    SELECT 'priority_config', COUNT(*) FROM public.priority_config
    UNION ALL
    SELECT 'profiles', COUNT(*) FROM public.profiles
    UNION ALL
    SELECT 'rate_limit_buckets', COUNT(*) FROM public.rate_limit_buckets
    UNION ALL
    SELECT 'room_issues', COUNT(*) FROM public.room_issues
    UNION ALL
    SELECT 'rooms', COUNT(*) FROM public.rooms
    UNION ALL
    SELECT 'schedule_change_requests', COUNT(*) FROM public.schedule_change_requests
    UNION ALL
    SELECT 'schedule_version_set_items', COUNT(*) FROM public.schedule_version_set_items
    UNION ALL
    SELECT 'schedule_version_sets', COUNT(*) FROM public.schedule_version_sets
    UNION ALL
    SELECT 'schedule_versions', COUNT(*) FROM public.schedule_versions
    UNION ALL
    SELECT 'schedules', COUNT(*) FROM public.schedules
    UNION ALL
    SELECT 'sections', COUNT(*) FROM public.sections
    UNION ALL
    SELECT 'sharing_requests', COUNT(*) FROM public.sharing_requests
    UNION ALL
    SELECT 'subjects', COUNT(*) FROM public.subjects
    UNION ALL
    SELECT 'system_rules', COUNT(*) FROM public.system_rules
    UNION ALL
    SELECT 'teacher_messages', COUNT(*) FROM public.teacher_messages
    UNION ALL
    SELECT 'teacher_preferences', COUNT(*) FROM public.teacher_preferences
    UNION ALL
    SELECT 'teachers', COUNT(*) FROM public.teachers
    UNION ALL
    SELECT 'user_activity_logs', COUNT(*) FROM public.user_activity_logs
    UNION ALL
    SELECT 'user_activity_logs_archive', COUNT(*) FROM public.user_activity_logs_archive
    UNION ALL
    SELECT 'user_permission_overrides', COUNT(*) FROM public.user_permission_overrides
) counts
ORDER BY table_name;

-- ============================================================================
-- SECTION 9: SUMMARY REPORT
-- ============================================================================

WITH all_checks AS (
    -- Table existence
    SELECT 'Table: admin_messages' as check_name, 
           CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_messages') THEN 0 ELSE 1 END as issues
    UNION ALL
    SELECT 'Table: admin_tasks', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_tasks') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: announcements', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'announcements') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: approval_audit_log', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'approval_audit_log') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: approval_requests', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'approval_requests') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: audit_logs', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: backup_jobs', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'backup_jobs') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: chat_messages', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_messages') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: client_error_logs', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_error_logs') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: conflicts', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conflicts') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: custom_events', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'custom_events') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: emergency_overrides', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'emergency_overrides') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: feature_flags', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feature_flags') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: institution_breaks', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'institution_breaks') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: notifications', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: password_reset_requests', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'password_reset_requests') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: priority_config', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'priority_config') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: profiles', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: rate_limit_buckets', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rate_limit_buckets') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: room_issues', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'room_issues') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: rooms', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rooms') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: schedule_change_requests', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schedule_change_requests') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: schedule_version_set_items', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schedule_version_set_items') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: schedule_version_sets', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schedule_version_sets') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: schedule_versions', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schedule_versions') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: schedules', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schedules') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: sections', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sections') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: sharing_requests', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sharing_requests') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: subjects', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subjects') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: system_rules', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_rules') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: teacher_messages', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teacher_messages') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: teacher_preferences', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teacher_preferences') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: teachers', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teachers') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: user_activity_logs', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_activity_logs') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: user_activity_logs_archive', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_activity_logs_archive') THEN 0 ELSE 1 END
    UNION ALL
    SELECT 'Table: user_permission_overrides', CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_permission_overrides') THEN 0 ELSE 1 END
    
    UNION ALL
    
    -- Data integrity
    SELECT 'Data: Teacher profiles without records', COUNT(*) FROM public.profiles p WHERE p.role = 'teacher' AND NOT EXISTS (SELECT 1 FROM public.teachers t WHERE t.profile_id = p.id)
    UNION ALL
    SELECT 'Data: Teachers not public', COUNT(*) FROM public.teachers WHERE is_public = false OR is_public IS NULL
    UNION ALL
    SELECT 'Data: Teachers without preferences', COUNT(*) FROM public.teachers t WHERE NOT EXISTS (SELECT 1 FROM public.teacher_preferences tp WHERE tp.teacher_id = t.id)
    
    UNION ALL
    
    -- FK integrity (sample of critical ones)
    SELECT 'FK: Teachers->Profiles', COUNT(*) FROM public.teachers t WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = t.profile_id)
    UNION ALL
    SELECT 'FK: TeacherPrefs->Teachers', COUNT(*) FROM public.teacher_preferences tp WHERE NOT EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = tp.teacher_id)
    UNION ALL
    SELECT 'FK: Schedules->Teachers', COUNT(*) FROM public.schedules s WHERE s.teacher_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = s.teacher_id)
    UNION ALL
    SELECT 'FK: Schedules->Subjects', COUNT(*) FROM public.schedules s WHERE s.subject_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.subjects sub WHERE sub.id = s.subject_id)
    UNION ALL
    SELECT 'FK: Schedules->Rooms', COUNT(*) FROM public.schedules s WHERE s.room_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = s.room_id)
    UNION ALL
    SELECT 'FK: Schedules->Sections', COUNT(*) FROM public.schedules s WHERE s.section_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.sections sec WHERE sec.id = s.section_id)
    
    UNION ALL
    
    -- Triggers
    SELECT 'Trigger: Auto-create teacher', CASE WHEN EXISTS (SELECT FROM information_schema.triggers WHERE trigger_name = 'auto_create_teacher_trigger') THEN 0 ELSE 1 END
)
SELECT 
    'DATABASE HEALTH SUMMARY' as report,
    check_name,
    issues,
    CASE 
        WHEN issues = 0 THEN '✓ OK'
        WHEN issues > 0 THEN '⚠ ISSUE FOUND'
    END as status
FROM all_checks
ORDER BY 
    CASE WHEN issues = 0 THEN 1 ELSE 0 END,
    check_name;
