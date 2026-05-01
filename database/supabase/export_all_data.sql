-- ============================================================================
-- COMPREHENSIVE DATA EXPORT SCRIPT
-- Exports all data from all tables for backup purposes
-- Run this in Supabase SQL Editor to export data
-- ============================================================================

-- ============================================================================
-- EXPORT ALL TABLES
-- ============================================================================

-- Admin Messages
COPY (SELECT * FROM public.admin_messages ORDER BY created_at) TO STDOUT WITH CSV HEADER;

-- Admin Tasks
COPY (SELECT * FROM public.admin_tasks ORDER BY created_at) TO STDOUT WITH CSV HEADER;

-- Announcements
COPY (SELECT * FROM public.announcements ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER;

-- Approval Audit Log
COPY (SELECT * FROM public.approval_audit_log ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER;

-- Approval Requests
COPY (SELECT * FROM public.approval_requests ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER;

-- Audit Logs
COPY (SELECT * FROM public.audit_logs ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER;

-- Backup Jobs
COPY (SELECT * FROM public.backup_jobs ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER;

-- Chat Messages
COPY (SELECT * FROM public.chat_messages ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER;

-- Client Error Logs
COPY (SELECT * FROM public.client_error_logs ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER;

-- Conflicts
COPY (SELECT * FROM public.conflicts ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER;

-- Custom Events
COPY (SELECT * FROM public.custom_events ORDER BY event_date DESC) TO STDOUT WITH CSV HEADER;

-- Emergency Overrides
COPY (SELECT * FROM public.emergency_overrides ORDER BY activated_at DESC) TO STDOUT WITH CSV HEADER;

-- Feature Flags
COPY (SELECT * FROM public.feature_flags ORDER BY updated_at DESC) TO STDOUT WITH CSV HEADER;

-- Institution Breaks
COPY (SELECT * FROM public.institution_breaks ORDER BY name) TO STDOUT WITH CSV HEADER;

-- Notifications
COPY (SELECT * FROM public.notifications ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER;

-- Password Reset Requests
COPY (SELECT * FROM public.password_reset_requests ORDER BY requested_at DESC) TO STDOUT WITH CSV HEADER;

-- Priority Config
COPY (SELECT * FROM public.priority_config ORDER BY updated_at DESC) TO STDOUT WITH CSV HEADER;

-- Profiles
COPY (SELECT * FROM public.profiles ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER;

-- Rate Limit Buckets
COPY (SELECT * FROM public.rate_limit_buckets ORDER BY last_hit DESC) TO STDOUT WITH CSV HEADER;

-- Room Issues
COPY (SELECT * FROM public.room_issues ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER;

-- Rooms
COPY (SELECT * FROM public.rooms ORDER BY name) TO STDOUT WITH CSV HEADER;

-- Schedule Change Requests
COPY (SELECT * FROM public.schedule_change_requests ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER;

-- Schedule Version Set Items
COPY (SELECT * FROM public.schedule_version_set_items ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Schedule Version Sets
COPY (SELECT * FROM public.schedule_version_sets ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER;

-- Schedule Versions
COPY (SELECT * FROM public.schedule_versions ORDER BY changed_at DESC) TO STDOUT WITH CSV HEADER;

-- Schedules
COPY (SELECT * FROM public.schedules ORDER BY day_of_week, start_time) TO STDOUT WITH CSV HEADER;

-- Sections
COPY (SELECT * FROM public.sections ORDER BY program, year_level, name) TO STDOUT WITH CSV HEADER;

-- Sharing Requests
COPY (SELECT * FROM public.sharing_requests ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER;

-- Subjects
COPY (SELECT * FROM public.subjects ORDER BY name) TO STDOUT WITH CSV HEADER;

-- System Rules
COPY (SELECT * FROM public.system_rules ORDER BY id) TO STDOUT WITH CSV HEADER;

-- Teacher Messages
COPY (SELECT * FROM public.teacher_messages ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER;

-- Teacher Preferences
COPY (SELECT * FROM public.teacher_preferences ORDER BY teacher_id) TO STDOUT WITH CSV HEADER;

-- Teachers
COPY (SELECT * FROM public.teachers ORDER BY department, id) TO STDOUT WITH CSV HEADER;

-- User Activity Logs
COPY (SELECT * FROM public.user_activity_logs ORDER BY created_at DESC LIMIT 10000) TO STDOUT WITH CSV HEADER;

-- User Activity Logs Archive
COPY (SELECT * FROM public.user_activity_logs_archive ORDER BY created_at DESC LIMIT 10000) TO STDOUT WITH CSV HEADER;

-- User Permission Overrides
COPY (SELECT * FROM public.user_permission_overrides ORDER BY created_at DESC) TO STDOUT WITH CSV HEADER;

-- ============================================================================
-- ALTERNATIVE: SELECT ALL DATA (for viewing in SQL Editor)
-- ============================================================================

-- Uncomment the queries below to view all data in SQL Editor instead of exporting

-- SELECT * FROM public.admin_messages ORDER BY created_at;
-- SELECT * FROM public.admin_tasks ORDER BY created_at;
-- SELECT * FROM public.announcements ORDER BY created_at DESC;
-- SELECT * FROM public.approval_audit_log ORDER BY created_at DESC;
-- SELECT * FROM public.approval_requests ORDER BY created_at DESC;
-- SELECT * FROM public.audit_logs ORDER BY created_at DESC;
-- SELECT * FROM public.backup_jobs ORDER BY created_at DESC;
-- SELECT * FROM public.chat_messages ORDER BY created_at DESC;
-- SELECT * FROM public.client_error_logs ORDER BY created_at DESC;
-- SELECT * FROM public.conflicts ORDER BY created_at DESC;
-- SELECT * FROM public.custom_events ORDER BY event_date DESC;
-- SELECT * FROM public.emergency_overrides ORDER BY activated_at DESC;
-- SELECT * FROM public.feature_flags ORDER BY updated_at DESC;
-- SELECT * FROM public.institution_breaks ORDER BY name;
-- SELECT * FROM public.notifications ORDER BY created_at DESC;
-- SELECT * FROM public.password_reset_requests ORDER BY requested_at DESC;
-- SELECT * FROM public.priority_config ORDER BY updated_at DESC;
-- SELECT * FROM public.profiles ORDER BY created_at DESC;
-- SELECT * FROM public.rate_limit_buckets ORDER BY last_hit DESC;
-- SELECT * FROM public.room_issues ORDER BY created_at DESC;
-- SELECT * FROM public.rooms ORDER BY name;
-- SELECT * FROM public.schedule_change_requests ORDER BY created_at DESC;
-- SELECT * FROM public.schedule_version_set_items ORDER BY id;
-- SELECT * FROM public.schedule_version_sets ORDER BY created_at DESC;
-- SELECT * FROM public.schedule_versions ORDER BY changed_at DESC;
-- SELECT * FROM public.schedules ORDER BY day_of_week, start_time;
-- SELECT * FROM public.sections ORDER BY program, year_level, name;
-- SELECT * FROM public.sharing_requests ORDER BY created_at DESC;
-- SELECT * FROM public.subjects ORDER BY name;
-- SELECT * FROM public.system_rules ORDER BY id;
-- SELECT * FROM public.teacher_messages ORDER BY created_at DESC;
-- SELECT * FROM public.teacher_preferences ORDER BY teacher_id;
-- SELECT * FROM public.teachers ORDER BY department, id;
-- SELECT * FROM public.user_activity_logs ORDER BY created_at DESC LIMIT 10000;
-- SELECT * FROM public.user_activity_logs_archive ORDER BY created_at DESC LIMIT 10000;
-- SELECT * FROM public.user_permission_overrides ORDER BY created_at DESC;

-- ============================================================================
-- DATA COUNT SUMMARY
-- ============================================================================

SELECT 
    'DATA COUNT SUMMARY' as summary_type,
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
