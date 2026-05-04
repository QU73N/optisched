-- Fix function search_path by using ALTER FUNCTION
-- This is safer than dropping and recreating

ALTER FUNCTION approve_request SET search_path = public;
ALTER FUNCTION archive_old_logs SET search_path = public;
ALTER FUNCTION audit_logs_compute_hash SET search_path = public, extensions;
ALTER FUNCTION audit_role_change SET search_path = public;
ALTER FUNCTION can_approve_schedules SET search_path = public;
ALTER FUNCTION can_manage_users SET search_path = public;
ALTER FUNCTION can_modify_schedule SET search_path = public;
ALTER FUNCTION cancel_request SET search_path = public;
ALTER FUNCTION check_break_conflict SET search_path = public;
ALTER FUNCTION cleanup_expired_notifications SET search_path = public;
ALTER FUNCTION create_approval_request SET search_path = public;
ALTER FUNCTION create_schedule_version SET search_path = public;
ALTER FUNCTION create_schedule_version_set SET search_path = public;
ALTER FUNCTION create_teacher_record SET search_path = public;
ALTER FUNCTION current_user_role SET search_path = public;
ALTER FUNCTION effective_rule SET search_path = public;
ALTER FUNCTION get_breaks_for_day SET search_path = public;
ALTER FUNCTION get_next_schedule_version SET search_path = public;
ALTER FUNCTION get_section_ancestors SET search_path = public;
ALTER FUNCTION get_section_descendants SET search_path = public;
ALTER FUNCTION get_section_level SET search_path = public;
ALTER FUNCTION get_system_rule SET search_path = public;
ALTER FUNCTION get_teacher_preferred_room_names SET search_path = public;
ALTER FUNCTION get_teacher_preferred_subject_names SET search_path = public;
ALTER FUNCTION get_unread_notification_count SET search_path = public;
ALTER FUNCTION get_user_role SET search_path = public;
ALTER FUNCTION grant_resource_access SET search_path = public;
ALTER FUNCTION handle_new_user SET search_path = public;
ALTER FUNCTION is_admin_tier SET search_path = public;
ALTER FUNCTION is_break_time SET search_path = public;
ALTER FUNCTION is_power_admin SET search_path = public;
ALTER FUNCTION is_teacher_available SET search_path = public;
ALTER FUNCTION lock_schedule SET search_path = public;
ALTER FUNCTION lock_semester_schedules SET search_path = public;
ALTER FUNCTION log_activity SET search_path = public;
ALTER FUNCTION log_audit SET search_path = public;
ALTER FUNCTION mark_all_notifications_read SET search_path = public;
ALTER FUNCTION mark_notification_read SET search_path = public;
ALTER FUNCTION my_rank SET search_path = public;
ALTER FUNCTION notify_schedule_publish SET search_path = public;
ALTER FUNCTION prevent_self_role_change SET search_path = public;
ALTER FUNCTION rate_limit_check SET search_path = public;
ALTER FUNCTION rate_limit_generate SET search_path = public;
ALTER FUNCTION rate_limit_login SET search_path = public;
ALTER FUNCTION rate_limit_password_reset SET search_path = public;
ALTER FUNCTION rate_limit_prune SET search_path = public;
ALTER FUNCTION rebuild_section_paths SET search_path = public;
ALTER FUNCTION reject_audit_mutation SET search_path = public;
ALTER FUNCTION reject_request SET search_path = public;
ALTER FUNCTION report_client_error SET search_path = public;
ALTER FUNCTION require_min_rank SET search_path = public;
ALTER FUNCTION require_permission SET search_path = public;
ALTER FUNCTION resolve_permission SET search_path = public;
ALTER FUNCTION respond_sharing_request SET search_path = public;
ALTER FUNCTION revoke_resource_access SET search_path = public;
ALTER FUNCTION rollback_schedule_version SET search_path = public;
ALTER FUNCTION rule_enabled SET search_path = public;
ALTER FUNCTION share_resource SET search_path = public;
ALTER FUNCTION touch_feature_flags_updated_at SET search_path = public;
ALTER FUNCTION trg_schedule_delete_version SET search_path = public;
ALTER FUNCTION trg_schedule_insert_version SET search_path = public;
ALTER FUNCTION trg_schedule_update_version SET search_path = public;
ALTER FUNCTION unlock_schedule SET search_path = public;
ALTER FUNCTION unlock_semester_schedules SET search_path = public;
ALTER FUNCTION update_priority_config SET search_path = public;
ALTER FUNCTION update_section_path SET search_path = public;
ALTER FUNCTION verify_audit_chain SET search_path = public;

-- Verify search_path is set
SELECT 
    routine_name,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND security_type = 'DEFINER'
AND routine_name IN ('rate_limit_check', 'rate_limit_login', 'current_user_role', 'is_power_admin', 'get_user_role')
ORDER BY routine_name;
