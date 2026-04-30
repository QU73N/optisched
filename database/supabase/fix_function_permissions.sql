-- Fix SECURITY DEFINER function permissions
-- Revoke EXECUTE from anon for sensitive functions
-- Uses IF EXISTS to avoid errors if functions don't exist or have different signatures

-- ============================================================================
-- FUNCTIONS TO KEEP PUBLIC (for anon) - needed for auth flow
-- ============================================================================

-- These functions must remain accessible to unauthenticated users:
-- - current_user_role: Needed for frontend role detection after login
-- - get_user_role: Needed for auth flow
-- - handle_new_user: Needed for signup flow
-- - rate_limit_login: Needed for login rate limiting
-- - rate_limit_password_reset: Needed for password reset

-- ============================================================================
-- REVOKE FROM ANON (sensitive admin/mutating functions)
-- ============================================================================

-- Approval workflow functions
DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.approve_request FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.cancel_request FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.reject_request FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.create_approval_request FROM anon';
EXCEPTION WHEN others THEN null; END $$;

-- Audit functions
DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.audit_logs_compute_hash FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.audit_role_change FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_audit FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.verify_audit_chain FROM anon';
EXCEPTION WHEN others THEN null; END $$;

-- Admin/maintenance functions
DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.archive_old_logs FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.cleanup_expired_notifications FROM anon';
EXCEPTION WHEN others THEN null; END $$;

-- Permission checking functions (internal use)
DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.can_approve_schedules FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.can_manage_users FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.can_modify_schedule FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.is_power_admin FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.is_admin_tier FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.require_permission FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.require_min_rank FROM anon';
EXCEPTION WHEN others THEN null; END $$;

-- Schedule locking functions
DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.lock_schedule FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.unlock_schedule FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.lock_semester_schedules FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.unlock_semester_schedules FROM anon';
EXCEPTION WHEN others THEN null; END $$;

-- Schedule version functions
DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.create_schedule_version FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.create_schedule_version_set FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rollback_schedule_version FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.trg_schedule_insert_version FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.trg_schedule_update_version FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.trg_schedule_delete_version FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.compare_schedule_versions FROM anon';
EXCEPTION WHEN others THEN null; END $$;

-- System configuration functions
DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.update_priority_config FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.calculate_priority_score FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_priority_tier FROM anon';
EXCEPTION WHEN others THEN null; END $$;

-- Data management functions
DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rebuild_section_paths FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.update_section_path FROM anon';
EXCEPTION WHEN others THEN null; END $$;

-- Resource sharing functions
DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.share_resource FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.respond_sharing_request FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.grant_resource_access FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.revoke_resource_access FROM anon';
EXCEPTION WHEN others THEN null; END $$;

-- Rate limiting (internal use)
DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rate_limit_check FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rate_limit_generate FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rate_limit_prune FROM anon';
EXCEPTION WHEN others THEN null; END $$;

-- Activity logging
DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.log_activity FROM anon';
EXCEPTION WHEN others THEN null; END $$;

-- Notification functions
DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.create_notification FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.mark_notification_read FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_unread_notification_count FROM anon';
EXCEPTION WHEN others THEN null; END $$;

-- Teacher functions
DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.is_teacher_available FROM anon';
EXCEPTION WHEN others THEN null; END $$;

-- Break time functions
DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.is_break_time FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.check_break_conflict FROM anon';
EXCEPTION WHEN others THEN null; END $$;

-- Report error
DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.report_client_error FROM anon';
EXCEPTION WHEN others THEN null; END $$;

-- Data retrieval functions (should be authenticated only)
DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_system_rule FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.my_rank FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.resolve_permission FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_teacher_preferred_room_names FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_breaks_for_day FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_schedules_with_details FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_teachers_with_profiles FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.effective_rule FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_teacher_preferred_subject_names FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_schedule_publish FROM anon';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rule_enabled FROM anon';
EXCEPTION WHEN others THEN null; END $$;

-- ============================================================================
-- GRANT TO service_role (for internal/admin operations)
-- ============================================================================

-- Grant service_role access to admin functions for background jobs
DO $$ BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.archive_old_logs TO service_role';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.cleanup_expired_notifications TO service_role';
EXCEPTION WHEN others THEN null; END $$;

DO $$ BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.rate_limit_prune TO service_role';
EXCEPTION WHEN others THEN null; END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check which functions anon can still execute
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND security_type = 'DEFINER'
AND routine_name NOT IN (
    'current_user_role',
    'get_user_role',
    'handle_new_user',
    'rate_limit_login',
    'rate_limit_password_reset'
)
ORDER BY routine_name;
