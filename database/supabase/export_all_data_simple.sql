-- ============================================================================
-- SIMPLE DATA EXPORT SCRIPT
-- Exports all data from all tables for viewing in SQL Editor
-- Run this in Supabase SQL Editor to view all data
-- ============================================================================

-- Profiles (users)
SELECT * FROM public.profiles ORDER BY created_at DESC;

-- Teachers
SELECT * FROM public.teachers ORDER BY department, id;

-- Teacher Preferences
SELECT * FROM public.teacher_preferences ORDER BY teacher_id;

-- Subjects
SELECT * FROM public.subjects ORDER BY name;

-- Rooms
SELECT * FROM public.rooms ORDER BY name;

-- Sections
SELECT * FROM public.sections ORDER BY program, year_level, name;

-- Schedules
SELECT * FROM public.schedules ORDER BY day_of_week, start_time;

-- Conflicts
SELECT * FROM public.conflicts ORDER BY created_at DESC;

-- Announcements
SELECT * FROM public.announcements ORDER BY created_at DESC;

-- Custom Events
SELECT * FROM public.custom_events ORDER BY event_date DESC;

-- Approval Requests
SELECT * FROM public.approval_requests ORDER BY created_at DESC;

-- Approval Audit Log
SELECT * FROM public.approval_audit_log ORDER BY created_at DESC;

-- Schedule Change Requests
SELECT * FROM public.schedule_change_requests ORDER BY created_at DESC;

-- Schedule Versions
SELECT * FROM public.schedule_versions ORDER BY changed_at DESC;

-- Schedule Version Sets
SELECT * FROM public.schedule_version_sets ORDER BY created_at DESC;

-- Schedule Version Set Items
SELECT * FROM public.schedule_version_set_items ORDER BY id;

-- Notifications
SELECT * FROM public.notifications ORDER BY created_at DESC;

-- Chat Messages
SELECT * FROM public.chat_messages ORDER BY created_at DESC;

-- Teacher Messages
SELECT * FROM public.teacher_messages ORDER BY created_at DESC;

-- Admin Messages
SELECT * FROM public.admin_messages ORDER BY created_at DESC;

-- Admin Tasks
SELECT * FROM public.admin_tasks ORDER BY created_at DESC;

-- Audit Logs
SELECT * FROM public.audit_logs ORDER BY created_at DESC;

-- User Activity Logs (last 10000)
SELECT * FROM public.user_activity_logs ORDER BY created_at DESC LIMIT 10000;

-- User Activity Logs Archive (last 10000)
SELECT * FROM public.user_activity_logs_archive ORDER BY created_at DESC LIMIT 10000;

-- User Permission Overrides
SELECT * FROM public.user_permission_overrides ORDER BY created_at DESC;

-- Password Reset Requests
SELECT * FROM public.password_reset_requests ORDER BY requested_at DESC;

-- Room Issues
SELECT * FROM public.room_issues ORDER BY created_at DESC;

-- Emergency Overrides
SELECT * FROM public.emergency_overrides ORDER BY activated_at DESC;

-- Feature Flags
SELECT * FROM public.feature_flags ORDER BY updated_at DESC;

-- Institution Breaks
SELECT * FROM public.institution_breaks ORDER BY name;

-- Priority Config
SELECT * FROM public.priority_config ORDER BY updated_at DESC;

-- Rate Limit Buckets
SELECT * FROM public.rate_limit_buckets ORDER BY last_hit DESC;

-- Backup Jobs
SELECT * FROM public.backup_jobs ORDER BY created_at DESC;

-- Client Error Logs
SELECT * FROM public.client_error_logs ORDER BY created_at DESC;

-- Sharing Requests
SELECT * FROM public.sharing_requests ORDER BY created_at DESC;

-- System Rules
SELECT * FROM public.system_rules ORDER BY id;
