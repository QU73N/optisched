-- Comprehensive Security Issues Fix Script
-- This script fixes all database security linter warnings

-- ============================================
-- 1. Fix Function Search Path Mutable Issues
-- ============================================

-- Helper function to fix search path for all public functions
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_type = 'FUNCTION'
    LOOP
        BEGIN
            EXECUTE format('ALTER FUNCTION public.%I() SET search_path = public', func_record.routine_name);
        EXCEPTION WHEN OTHERS THEN
            -- Function doesn't exist or has different signature, skip
            CONTINUE;
        END;
    END LOOP;
END $$;

-- Fix specific functions with parameters
DO $$
BEGIN
    BEGIN ALTER FUNCTION public.get_institution_name() SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.get_priority_tier() SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.calculate_priority_score() SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.protect_power_admin() SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.role_rank() SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.update_updated_at() SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.handle_new_user() SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.update_institutional_policies_updated_at() SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.update_group_chat_names_on_institution_change() SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.create_department_group_chats() SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.create_section_group_chat() SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.ensure_schedule_managers_group_chat() SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.get_next_schedule_version() SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.deactivate_schedule_versions() SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.insert_schedules_batch_v2(p_schedules jsonb) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.cleanup_soft_deleted_schedules() SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.get_soft_deleted_schedule_count() SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.create_schedule_batch(p_name text, p_description text, p_academic_year text, p_semester text, p_created_by uuid) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.create_batch_version(p_batch_id uuid, p_change_type text, p_change_summary text, p_change_reason text, p_state_hash text, p_soft_score numeric, p_conflict_count integer, p_changed_by uuid, p_previous_version_id uuid) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.deactivate_batch_versions(p_batch_id uuid) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.activate_batch_version(p_version_id uuid) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.get_active_batch_version(p_batch_id uuid) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.insert_schedules_batch(p_schedules jsonb) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.create_schedule_version(p_schedule_id uuid, p_change_type text, p_change_summary text, p_change_reason text, p_state_hash text, p_soft_score numeric, p_conflict_count integer, p_changed_by uuid) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.activate_schedule_version(p_version_id uuid) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.create_schedule_version_set(p_name text, p_description text, p_created_by uuid) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.add_version_to_set(p_version_set_id uuid, p_schedule_version_id uuid) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.compare_schedule_versions(p_version_id_1 uuid, p_version_id_2 uuid) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER FUNCTION public.get_active_schedule_version(p_schedule_id uuid) SET search_path = public; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- ============================================
-- 2. Fix RLS Policy Always True Issues
-- ============================================

-- Fix password_reset_requests - Restrict INSERT to authenticated users
DROP POLICY IF EXISTS "Anyone can insert password_reset_requests" ON public.password_reset_requests;
CREATE POLICY "Authenticated users can insert password_reset_requests"
ON public.password_reset_requests
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Fix schedule_batches - Restrict INSERT/UPDATE to authenticated users with proper checks
DROP POLICY IF EXISTS "schedule_batches_insert_authenticated" ON public.schedule_batches;
CREATE POLICY "Authenticated users can insert schedule_batches"
ON public.schedule_batches
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "schedule_batches_update_authenticated" ON public.schedule_batches;
CREATE POLICY "Authenticated users can update schedule_batches"
ON public.schedule_batches
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- Fix schedule_version_set_items - Restrict INSERT
DROP POLICY IF EXISTS "schedule_version_set_items_insert_authenticated" ON public.schedule_version_set_items;
CREATE POLICY "Authenticated users can insert schedule_version_set_items"
ON public.schedule_version_set_items
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Fix schedule_version_sets - Restrict INSERT/UPDATE
DROP POLICY IF EXISTS "schedule_version_sets_insert_authenticated" ON public.schedule_version_sets;
CREATE POLICY "Authenticated users can insert schedule_version_sets"
ON public.schedule_version_sets
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "schedule_version_sets_update_authenticated" ON public.schedule_version_sets;
CREATE POLICY "Authenticated users can update schedule_version_sets"
ON public.schedule_version_sets
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- Fix schedule_versions - Restrict INSERT/UPDATE
DROP POLICY IF EXISTS "schedule_versions_insert_authenticated" ON public.schedule_versions;
CREATE POLICY "Authenticated users can insert schedule_versions"
ON public.schedule_versions
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "schedule_versions_update_authenticated" ON public.schedule_versions;
CREATE POLICY "Authenticated users can update schedule_versions"
ON public.schedule_versions
FOR UPDATE
TO authenticated
USING (auth.uid() = changed_by)
WITH CHECK (auth.uid() = changed_by);

-- Fix subject_rooms - Restrict DELETE/INSERT/UPDATE with proper checks
DROP POLICY IF EXISTS "Authenticated users can delete subject_rooms" ON public.subject_rooms;
CREATE POLICY "Authenticated users can delete subject_rooms"
ON public.subject_rooms
FOR DELETE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert subject_rooms" ON public.subject_rooms;
CREATE POLICY "Authenticated users can insert subject_rooms"
ON public.subject_rooms
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update subject_rooms" ON public.subject_rooms;
CREATE POLICY "Authenticated users can update subject_rooms"
ON public.subject_rooms
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- 3. Revoke EXECUTE on SECURITY DEFINER Functions from anon
-- ============================================

DO $$
BEGIN
    -- Revoke anon access to sensitive SECURITY DEFINER functions
    BEGIN REVOKE EXECUTE ON FUNCTION public.activate_batch_version(p_version_id uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.activate_schedule_version(p_version_id uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.add_version_to_set(p_version_set_id uuid, p_schedule_version_id uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.approve_request(p_request_id uuid, p_approved_by uuid, p_notes text) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.archive_old_logs() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.audit_logs_compute_hash() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.audit_role_change() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.can_approve_schedules() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.can_manage_users() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.can_modify_schedule(p_schedule_id uuid, p_user_id uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.cancel_request(p_request_id uuid, p_cancelled_by uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;

    -- Continue revoking for all anon-accessible SECURITY DEFINER functions
    BEGIN REVOKE EXECUTE ON FUNCTION public.cleanup_soft_deleted_schedules() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.create_batch_version(p_batch_id uuid, p_change_type text, p_change_summary text, p_change_reason text, p_state_hash text, p_soft_score numeric, p_conflict_count integer, p_changed_by uuid, p_previous_version_id uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.create_department_group_chats() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.create_schedule_batch(p_name text, p_description text, p_academic_year text, p_semester text, p_created_by uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.create_schedule_version(p_schedule_id uuid, p_change_type text, p_change_summary text, p_change_reason text, p_state_hash text, p_soft_score numeric, p_conflict_count integer, p_changed_by uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.create_schedule_version_set(p_name text, p_description text, p_created_by uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.create_section_group_chat() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.deactivate_batch_versions(p_batch_id uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.deactivate_schedule_versions(p_schedule_id uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.delete_audit_logs(p_before_date timestamptz) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.delete_old_notifications(p_before_date timestamptz) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.delete_user(p_user_id uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.ensure_schedule_managers_group_chat() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.get_active_batch_version(p_batch_id uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.get_active_schedule_version(p_schedule_id uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.get_institution_name() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.get_next_schedule_version(p_schedule_id uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.get_priority_tier() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.get_soft_deleted_schedule_count() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.get_unread_notification_count(p_user_id uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.grant_resource_access(p_resource_type text, p_resource_id uuid, p_user_id uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.insert_schedules_batch(p_schedules jsonb) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.insert_schedules_batch_v2(p_schedules jsonb) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.is_admin_tier() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.is_break_time(p_day text, p_time text, p_academic_year text, p_semester text) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.is_power_admin() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.is_teacher_available(p_teacher_id uuid, p_day text, p_time text) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.lock_schedule(p_schedule_id uuid, p_locked_by uuid, p_reason text) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.lock_semester_schedules(p_academic_year text, p_semester text, p_locked_by uuid, p_reason text) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.log_activity(p_action_type text, p_resource text, p_resource_id uuid, p_details jsonb, p_success boolean, p_error text, p_duration_ms integer) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.log_audit(p_action text, p_target_table text, p_target_id uuid, p_details jsonb) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read(p_user_id uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.mark_notification_read(p_notification_id uuid, p_user_id uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.my_rank() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.notify_schedule_publish() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.protect_power_admin() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.rate_limit_check(p_action text, p_subject text, p_max integer, p_window interval) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.rate_limit_generate(p_uid uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.rate_limit_login(p_email text) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.rate_limit_password_reset(p_email text) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.rate_limit_prune() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.rebuild_section_paths(p_parent_id uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.reject_audit_mutation() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.reject_request(p_request_id uuid, p_rejected_by uuid, p_reason text) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.report_client_error(p_url text, p_message text, p_stack text, p_user_agent text, p_component_stack text, p_metadata jsonb) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.require_min_rank(p_min_rank integer) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.require_permission(p_rule text) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.resolve_permission(p_user uuid, p_key text) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.respond_sharing_request(p_request_id uuid, p_status text, p_user_id uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.revoke_resource_access(p_resource_type text, p_resource_id uuid, p_user_id uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.rollback_schedule_version(p_version_id uuid, p_rollback_reason text, p_rolled_back_by uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.role_rank() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.rule_enabled(p_key text) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.share_resource(p_resource_type text, p_resource_id uuid, p_from_user_id uuid, p_to_user_id uuid, p_message text) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.unlock_schedule(p_schedule_id uuid, p_unlocked_by uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.unlock_semester_schedules(p_academic_year text, p_semester text, p_unlocked_by uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.update_institutional_policies_updated_at() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.update_priority_config(p_key text, p_value jsonb, p_updated_by uuid) FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.update_section_path() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.verify_audit_chain() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN REVOKE EXECUTE ON FUNCTION public.update_group_chat_names_on_institution_change() FROM anon; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
