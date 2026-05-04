-- Fix function search_path mutable warnings
-- Drop and recreate all functions with SET search_path = public

-- Drop all functions first
DROP FUNCTION IF EXISTS rate_limit_check CASCADE;
DROP FUNCTION IF EXISTS rate_limit_login CASCADE;
DROP FUNCTION IF EXISTS rate_limit_password_reset CASCADE;
DROP FUNCTION IF EXISTS rate_limit_generate CASCADE;
DROP FUNCTION IF EXISTS rate_limit_prune CASCADE;
DROP FUNCTION IF EXISTS rollback_schedule_version CASCADE;
DROP FUNCTION IF EXISTS touch_feature_flags_updated_at CASCADE;
DROP FUNCTION IF EXISTS report_client_error CASCADE;
DROP FUNCTION IF EXISTS create_schedule_version_set CASCADE;
DROP FUNCTION IF EXISTS trg_schedule_insert_version CASCADE;
DROP FUNCTION IF EXISTS archive_old_logs CASCADE;
DROP FUNCTION IF EXISTS trg_schedule_update_version CASCADE;
DROP FUNCTION IF EXISTS trg_schedule_delete_version CASCADE;
DROP FUNCTION IF EXISTS update_section_path CASCADE;
DROP FUNCTION IF EXISTS rebuild_section_paths CASCADE;
DROP FUNCTION IF EXISTS get_section_level CASCADE;
DROP FUNCTION IF EXISTS get_section_descendants CASCADE;
DROP FUNCTION IF EXISTS get_section_ancestors CASCADE;
DROP FUNCTION IF EXISTS calculate_priority_score CASCADE;
DROP FUNCTION IF EXISTS get_priority_tier CASCADE;
DROP FUNCTION IF EXISTS update_priority_config CASCADE;
DROP FUNCTION IF EXISTS share_resource CASCADE;
DROP FUNCTION IF EXISTS current_user_role CASCADE;
DROP FUNCTION IF EXISTS is_power_admin CASCADE;
DROP FUNCTION IF EXISTS is_admin_tier CASCADE;
DROP FUNCTION IF EXISTS can_approve_schedules CASCADE;
DROP FUNCTION IF EXISTS can_manage_users CASCADE;
DROP FUNCTION IF EXISTS get_system_rule CASCADE;
DROP FUNCTION IF EXISTS rule_enabled CASCADE;
DROP FUNCTION IF EXISTS protect_power_admin CASCADE;
DROP FUNCTION IF EXISTS role_rank CASCADE;
DROP FUNCTION IF EXISTS my_rank CASCADE;
DROP FUNCTION IF EXISTS effective_rule CASCADE;
DROP FUNCTION IF EXISTS log_activity CASCADE;
DROP FUNCTION IF EXISTS get_next_schedule_version CASCADE;
DROP FUNCTION IF EXISTS audit_logs_compute_hash CASCADE;
DROP FUNCTION IF EXISTS reject_audit_mutation CASCADE;
DROP FUNCTION IF EXISTS is_teacher_available CASCADE;
DROP FUNCTION IF EXISTS verify_audit_chain CASCADE;
DROP FUNCTION IF EXISTS get_teacher_preferred_subject_names CASCADE;
DROP FUNCTION IF EXISTS prevent_self_role_change CASCADE;
DROP FUNCTION IF EXISTS audit_role_change CASCADE;
DROP FUNCTION IF EXISTS create_schedule_version CASCADE;
DROP FUNCTION IF EXISTS resolve_permission CASCADE;
DROP FUNCTION IF EXISTS get_teacher_preferred_room_names CASCADE;
DROP FUNCTION IF EXISTS require_permission CASCADE;
DROP FUNCTION IF EXISTS update_updated_at CASCADE;
DROP FUNCTION IF EXISTS get_user_role CASCADE;
DROP FUNCTION IF EXISTS handle_new_user CASCADE;
DROP FUNCTION IF EXISTS require_min_rank CASCADE;
DROP FUNCTION IF EXISTS log_audit CASCADE;
DROP FUNCTION IF EXISTS compare_schedule_versions CASCADE;
DROP FUNCTION IF EXISTS respond_sharing_request CASCADE;
DROP FUNCTION IF EXISTS grant_resource_access CASCADE;
DROP FUNCTION IF EXISTS revoke_resource_access CASCADE;
DROP FUNCTION IF EXISTS get_breaks_for_day CASCADE;
DROP FUNCTION IF EXISTS is_break_time CASCADE;
DROP FUNCTION IF EXISTS check_break_conflict CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_notifications CASCADE;
DROP FUNCTION IF EXISTS lock_schedule CASCADE;
DROP FUNCTION IF EXISTS create_approval_request CASCADE;
DROP FUNCTION IF EXISTS approve_request CASCADE;
DROP FUNCTION IF EXISTS cancel_request CASCADE;
DROP FUNCTION IF EXISTS unlock_schedule CASCADE;
DROP FUNCTION IF EXISTS can_modify_schedule CASCADE;
DROP FUNCTION IF EXISTS lock_semester_schedules CASCADE;
DROP FUNCTION IF EXISTS reject_request CASCADE;
DROP FUNCTION IF EXISTS unlock_semester_schedules CASCADE;
DROP FUNCTION IF EXISTS create_teacher_record CASCADE;

-- Recreate all functions with SET search_path = public

-- Rate limiting functions
CREATE OR REPLACE FUNCTION rate_limit_check(p_action text, p_subject text, p_max integer, p_window interval)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
    v_window_start timestamp with time zone;
BEGIN
    v_window_start := now() - p_window;
    
    DELETE FROM rate_limits
    WHERE created_at < v_window_start;
    
    SELECT COUNT(*) INTO v_count
    FROM rate_limits
    WHERE action = p_action
    AND subject = p_subject
    AND created_at >= v_window_start;
    
    RETURN v_count < p_max;
END;
$$;

CREATE OR REPLACE FUNCTION rate_limit_login(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT rate_limit_check('login', p_email, 5, interval '15 minutes');
$$;

CREATE OR REPLACE FUNCTION rate_limit_password_reset(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT rate_limit_check('password_reset', p_email, 3, interval '1 hour');
$$;

CREATE OR REPLACE FUNCTION rate_limit_generate(p_uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO rate_limits (action, subject, user_id)
    VALUES ('api_request', 'default', p_uid)
    ON CONFLICT DO NOTHING;
    SELECT true;
$$;

CREATE OR REPLACE FUNCTION rate_limit_prune()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM rate_limits
    WHERE created_at < now() - interval '24 hours';
END;
$$;

-- Schedule version functions
CREATE OR REPLACE FUNCTION rollback_schedule_version(p_version_id uuid, p_rollback_reason text, p_rolled_back_by uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_schedule_id uuid;
    v_new_version_id uuid;
BEGIN
    SELECT schedule_id INTO v_schedule_id
    FROM schedule_versions
    WHERE id = p_version_id;
    
    INSERT INTO schedule_versions (schedule_id, version_number, data, created_by, change_reason)
    SELECT v_schedule_id, 
           (SELECT COALESCE(MAX(version_number), 0) + 1 FROM schedule_versions WHERE schedule_id = v_schedule_id),
           (SELECT data FROM schedule_versions WHERE id = p_version_id),
           p_rolled_back_by,
           p_rollback_reason
    RETURNING id INTO v_new_version_id;
    
    RETURN v_new_version_id;
END;
$$;

CREATE OR REPLACE FUNCTION touch_feature_flags_updated_at()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    UPDATE feature_flags SET updated_at = now();
$$;

CREATE OR REPLACE FUNCTION report_client_error(p_url text, p_message text, p_stack text, p_user_agent text, p_component_stack text, p_metadata jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_error_id uuid;
BEGIN
    INSERT INTO client_errors (url, message, stack, user_agent, component_stack, metadata)
    VALUES (p_url, p_message, p_stack, p_user_agent, p_component_stack, p_metadata)
    RETURNING id INTO v_error_id;
    
    RETURN v_error_id;
END;
$$;

CREATE OR REPLACE FUNCTION create_schedule_version_set(p_schedule_id uuid, p_version_data jsonb, p_created_by uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_version_id uuid;
BEGIN
    INSERT INTO schedule_versions (schedule_id, version_number, data, created_by, change_reason)
    VALUES (p_schedule_id, 
            (SELECT COALESCE(MAX(version_number), 0) + 1 FROM schedule_versions WHERE schedule_id = p_schedule_id),
            p_version_data,
            p_created_by,
            'Manual version creation')
    RETURNING id INTO v_version_id;
    
    RETURN v_version_id;
END;
$$;

CREATE OR REPLACE FUNCTION trg_schedule_insert_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO schedule_versions (schedule_id, version_number, data, created_by, change_reason)
    VALUES (NEW.id, 1, row_to_json(NEW), NEW.created_by, 'Initial creation');
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION archive_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO user_activity_logs_archive (user_id, action_type, resource, resource_id, details, session_id, ip_address, user_agent, success, error_message, duration_ms, created_at, archived_at)
    SELECT user_id, action_type, resource, resource_id, details, session_id, ip_address, user_agent, success, error_message, duration_ms, created_at, now()
    FROM user_activity_logs
    WHERE created_at < now() - interval '90 days';
    
    DELETE FROM user_activity_logs
    WHERE created_at < now() - interval '90 days';
END;
$$;

CREATE OR REPLACE FUNCTION trg_schedule_update_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_version_number integer;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version_number
    FROM schedule_versions
    WHERE schedule_id = NEW.id;
    
    INSERT INTO schedule_versions (schedule_id, version_number, data, created_by, change_reason)
    VALUES (NEW.id, v_version_number, row_to_json(NEW), NEW.updated_by, 'Schedule update');
    
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION trg_schedule_delete_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO schedule_versions (schedule_id, version_number, data, created_by, change_reason)
    VALUES (OLD.id, 
            (SELECT COALESCE(MAX(version_number), 0) + 1 FROM schedule_versions WHERE schedule_id = OLD.id),
            row_to_json(OLD),
            auth.uid(),
            'Schedule deletion');
    
    RETURN OLD;
END;
$$;

-- Section path functions
CREATE OR REPLACE FUNCTION update_section_path()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.path := COALESCE(
        (SELECT path FROM sections WHERE id = NEW.parent_id),
        ''
    ) || '/' || NEW.name;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION rebuild_section_paths(p_parent_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    WITH RECURSIVE section_tree AS (
        SELECT id, parent_id, name, name as path
        FROM sections
        WHERE parent_id = p_parent_id
        
        UNION ALL
        
        SELECT s.id, s.parent_id, s.name, st.path || '/' || s.name
        FROM sections s
        INNER JOIN section_tree st ON s.parent_id = st.id
    )
    UPDATE sections
    SET path = st.path
    FROM section_tree st
    WHERE sections.id = st.id;
END;
$$;

CREATE OR REPLACE FUNCTION get_section_level(p_section_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT LENGTH(path) - LENGTH(REPLACE(path, '/', '')) - 1
    FROM sections
    WHERE id = p_section_id;
$$;

CREATE OR REPLACE FUNCTION get_section_descendants(p_section_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    WITH RECURSIVE descendants AS (
        SELECT id FROM sections WHERE parent_id = p_section_id
        UNION ALL
        SELECT s.id FROM sections s
        INNER JOIN descendants d ON s.parent_id = d.id
    )
    SELECT id FROM descendants;
$$;

CREATE OR REPLACE FUNCTION get_section_ancestors(p_section_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    WITH RECURSIVE ancestors AS (
        SELECT parent_id as id FROM sections WHERE id = p_section_id AND parent_id IS NOT NULL
        UNION ALL
        SELECT s.parent_id FROM sections s
        INNER JOIN ancestors a ON s.id = a.id
        WHERE s.parent_id IS NOT NULL
    )
    SELECT id FROM ancestors;
$$;

-- Priority functions
CREATE OR REPLACE FUNCTION calculate_priority_score(p_teacher_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_score numeric := 0;
    v_config jsonb;
BEGIN
    SELECT value INTO v_config FROM priority_config WHERE key = 'weights';
    
    IF v_config IS NOT NULL THEN
        v_score := v_score + COALESCE((v_config->>'employment_type')::numeric, 0) * 
            CASE WHEN (SELECT employment_type FROM teachers WHERE id = p_teacher_id) = 'full-time' THEN 1 ELSE 0 END;
    END IF;
    
    RETURN v_score;
END;
$$;

CREATE OR REPLACE FUNCTION get_priority_tier(p_score numeric)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE 
        WHEN p_score >= 80 THEN 'high'
        WHEN p_score >= 50 THEN 'medium'
        ELSE 'low'
    END;
$$;

CREATE OR REPLACE FUNCTION update_priority_config(p_key text, p_value jsonb, p_updated_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO priority_config (key, value, updated_by)
    VALUES (p_key, p_value, p_updated_by)
    ON CONFLICT (key) 
    DO UPDATE SET 
        value = EXCLUDED.value,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();
END;
$$;

-- Permission functions
CREATE OR REPLACE FUNCTION share_resource(p_resource_type text, p_resource_id uuid, p_from_user_id uuid, p_to_user_id uuid, p_message text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request_id uuid;
BEGIN
    INSERT INTO sharing_requests (resource_type, resource_id, from_user_id, to_user_id, message)
    VALUES (p_resource_type, p_resource_id, p_from_user_id, p_to_user_id, p_message)
    RETURNING id INTO v_request_id;
    
    RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_power_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('power_admin', 'super_admin')
    );
$$;

CREATE OR REPLACE FUNCTION is_admin_tier()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'power_admin', 'super_admin', 'schedule_admin')
    );
$$;

CREATE OR REPLACE FUNCTION can_approve_schedules()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'power_admin', 'super_admin', 'schedule_admin')
    );
$$;

CREATE OR REPLACE FUNCTION can_manage_users()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'power_admin', 'super_admin')
    );
$$;

CREATE OR REPLACE FUNCTION get_system_rule(p_key text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT value FROM system_rules WHERE key = p_key;
$$;

CREATE OR REPLACE FUNCTION rule_enabled(p_key text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE((value->>'enabled')::boolean, false) 
    FROM system_rules 
    WHERE key = p_key;
$$;

CREATE OR REPLACE FUNCTION protect_power_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.role = 'super_admin' AND NEW.role != 'super_admin' THEN
        RAISE EXCEPTION 'Cannot change super_admin role';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION role_rank(p_role text)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE p_role
        WHEN 'super_admin' THEN 100
        WHEN 'power_admin' THEN 90
        WHEN 'schedule_admin' THEN 80
        WHEN 'admin' THEN 70
        WHEN 'teacher' THEN 50
        WHEN 'student' THEN 30
        ELSE 0
    END;
$$;

CREATE OR REPLACE FUNCTION my_rank()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role_rank(role) FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION effective_rule(p_key text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT value FROM system_rules WHERE key = p_key),
        (SELECT value FROM system_rules WHERE key = 'default_' || p_key),
        '{}'::jsonb
    );
$$;

CREATE OR REPLACE FUNCTION log_activity(p_action_type text, p_resource text, p_resource_id uuid, p_details jsonb, p_success boolean, p_error text, p_duration_ms integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id uuid;
BEGIN
    INSERT INTO user_activity_logs (user_id, action_type, resource, resource_id, details, success, error_message, duration_ms)
    VALUES (auth.uid(), p_action_type, p_resource, p_resource_id, p_details, p_success, p_error, p_duration_ms)
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_next_schedule_version(p_schedule_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(MAX(version_number), 0) + 1 
    FROM schedule_versions 
    WHERE schedule_id = p_schedule_id;
$$;

CREATE OR REPLACE FUNCTION audit_logs_compute_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    NEW.data_hash := md5(row_to_json(NEW)::text);
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION 'Cannot modify audit logs directly';
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION is_teacher_available(p_teacher_id uuid, p_day text, p_time text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM schedules
        WHERE teacher_id = p_teacher_id
        AND day_of_week = p_day
        AND start_time <= p_time
        AND end_time > p_time
        AND status IN ('approved', 'published')
    );
END;
$$;

CREATE OR REPLACE FUNCTION verify_audit_chain()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM audit_logs a1
        JOIN audit_logs a2 ON a1.id = a2.parent_id
        WHERE a1.data_hash != md5(a2.data::text)
    );
$$;

CREATE OR REPLACE FUNCTION get_teacher_preferred_subject_names(p_teacher_id uuid)
RETURNS SETOF text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT s.name 
    FROM subjects s
    JOIN teacher_preferences tp ON s.id = ANY(tp.preferred_subjects)
    WHERE tp.teacher_id = p_teacher_id;
$$;

CREATE OR REPLACE FUNCTION prevent_self_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.id = auth.uid() AND OLD.role != NEW.role THEN
        RAISE EXCEPTION 'Users cannot change their own role';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION audit_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF OLD.role != NEW.role THEN
        INSERT INTO audit_logs (action, target_table, target_id, details)
        VALUES ('role_change', 'profiles', NEW.id, 
                jsonb_build_object(
                    'old_role', OLD.role,
                    'new_role', NEW.role,
                    'changed_by', auth.uid()
                ));
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION create_schedule_version(p_schedule_id uuid, p_change_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_version_id uuid;
    v_schedule_data jsonb;
BEGIN
    SELECT row_to_json(s.*) INTO v_schedule_data
    FROM schedules s
    WHERE s.id = p_schedule_id;
    
    INSERT INTO schedule_versions (schedule_id, version_number, data, created_by, change_reason)
    VALUES (p_schedule_id,
            (SELECT COALESCE(MAX(version_number), 0) + 1 FROM schedule_versions WHERE schedule_id = p_schedule_id),
            v_schedule_data,
            auth.uid(),
            p_change_reason)
    RETURNING id INTO v_version_id;
    
    RETURN v_version_id;
END;
$$;

CREATE OR REPLACE FUNCTION resolve_permission(p_user uuid, p_key text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT (value->>'granted')::boolean FROM user_permission_overrides WHERE user_id = p_user AND permission_key = p_key),
        (SELECT (value->>'enabled')::boolean FROM system_rules WHERE key = p_key),
        false
    );
$$;

CREATE OR REPLACE FUNCTION get_teacher_preferred_room_names(p_teacher_id uuid)
RETURNS SETOF text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT r.name 
    FROM rooms r
    JOIN teacher_preferences tp ON r.id = ANY(tp.preferred_rooms)
    WHERE tp.teacher_id = p_teacher_id;
$$;

CREATE OR REPLACE FUNCTION require_permission(p_rule text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT resolve_permission(auth.uid(), p_rule) THEN
        RAISE EXCEPTION 'Permission denied: %', p_rule;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name, role, created_at)
    VALUES (auth.uid(), auth.jwt()->>'email', auth.jwt()->>'full_name', 'student', now())
    ON CONFLICT (id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION require_min_rank(p_min_rank integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF my_rank() < p_min_rank THEN
        RAISE EXCEPTION 'Insufficient rank';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION log_audit(p_action text, p_target_table text, p_target_id uuid, p_details jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_audit_id uuid;
BEGIN
    INSERT INTO audit_logs (action, target_table, target_id, details, performed_by)
    VALUES (p_action, p_target_table, p_target_id, p_details, auth.uid())
    RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$;

CREATE OR REPLACE FUNCTION compare_schedule_versions(p_version_id_1 uuid, p_version_id_2 uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'version_1', (SELECT data FROM schedule_versions WHERE id = p_version_id_1),
        'version_2', (SELECT data FROM schedule_versions WHERE id = p_version_id_2),
        'diff', (
            SELECT jsonb_object_agg(key, jsonb_build_object('old', v1_data->key, 'new', v2_data->key))
            FROM (
                SELECT jsonb_object_keys(v1.data) as key
                FROM schedule_versions v1
                WHERE v1.id = p_version_id_1
            ) k
            CROSS JOIN (SELECT data FROM schedule_versions WHERE id = p_version_id_1) v1_data
            CROSS JOIN (SELECT data FROM schedule_versions WHERE id = p_version_id_2) v2_data
            WHERE v1_data->key IS DISTINCT FROM v2_data->key
        )
    );
$$;

CREATE OR REPLACE FUNCTION respond_sharing_request(p_request_id uuid, p_status text, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE sharing_requests
    SET status = p_status, responded_at = now()
    WHERE id = p_request_id AND to_user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION grant_resource_access(p_resource_type text, p_resource_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO resource_shares (resource_type, resource_id, user_id, granted_by)
    VALUES (p_resource_type, p_resource_id, p_user_id, auth.uid())
    ON CONFLICT (resource_type, resource_id, user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION revoke_resource_access(p_resource_type text, p_resource_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM resource_shares
    WHERE resource_type = p_resource_type
    AND resource_id = p_resource_id
    AND user_id = p_user_id;
END;
$$;

-- Break time functions
CREATE OR REPLACE FUNCTION get_breaks_for_day(p_day text, p_academic_year text DEFAULT '2025-2026', p_semester text DEFAULT '1st Semester')
RETURNS SETOF jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT breaks
    FROM semester_breaks
    WHERE day = p_day
    AND academic_year = p_academic_year
    AND semester = p_semester;
$$;

CREATE OR REPLACE FUNCTION is_break_time(p_day text, p_time text, p_academic_year text DEFAULT '2025-2026', p_semester text DEFAULT '1st Semester')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_break jsonb;
BEGIN
    SELECT breaks INTO v_break
    FROM semester_breaks
    WHERE day = p_day
    AND academic_year = p_academic_year
    AND semester = p_semester;
    
    IF v_break IS NULL THEN
        RETURN false;
    END IF;
    
    RETURN EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_break) as b
        WHERE (b->>'start')::time <= p_time::time
        AND (b->>'end')::time > p_time::time
    );
END;
$$;

CREATE OR REPLACE FUNCTION check_break_conflict(p_schedule_id uuid, p_day text, p_time text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT is_break_time(p_day, p_time);
$$;

-- Notification functions
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM notifications
    WHERE expires_at < now();
END;
$$;

-- Lock functions
CREATE OR REPLACE FUNCTION lock_schedule(p_schedule_id uuid, p_locked_by uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE schedules
    SET locked_by = p_locked_by,
        locked_at = now(),
        lock_reason = p_reason
    WHERE id = p_schedule_id;
END;
$$;

CREATE OR REPLACE FUNCTION create_approval_request(p_schedule_id uuid, p_requested_by uuid, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_request_id uuid;
BEGIN
    INSERT INTO approval_requests (schedule_id, requested_by, reason)
    VALUES (p_schedule_id, p_requested_by, p_reason)
    RETURNING id INTO v_request_id;
    
    RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION approve_request(p_request_id uuid, p_approved_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE approval_requests
    SET status = 'approved', approved_by = p_approved_by, approved_at = now()
    WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION cancel_request(p_request_id uuid, p_cancelled_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE approval_requests
    SET status = 'cancelled', cancelled_by = p_cancelled_by, cancelled_at = now()
    WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION unlock_schedule(p_schedule_id uuid, p_unlocked_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE schedules
    SET locked_by = NULL, locked_at = NULL, lock_reason = NULL
    WHERE id = p_schedule_id;
END;
$$;

CREATE OR REPLACE FUNCTION can_modify_schedule(p_schedule_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        is_admin_tier() 
        OR (SELECT locked_by FROM schedules WHERE id = p_schedule_id) IS NULL
        OR (SELECT locked_by FROM schedules WHERE id = p_schedule_id) = auth.uid();
$$;

CREATE OR REPLACE FUNCTION lock_semester_schedules(p_academic_year text, p_semester text, p_locked_by uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE schedules
    SET locked_by = p_locked_by,
        locked_at = now(),
        lock_reason = p_reason
    WHERE academic_year = p_academic_year
    AND semester = p_semester;
END;
$$;

CREATE OR REPLACE FUNCTION reject_request(p_request_id uuid, p_rejected_by uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE approval_requests
    SET status = 'rejected', rejected_by = p_rejected_by, rejected_at = now(), rejection_reason = p_reason
    WHERE id = p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION unlock_semester_schedules(p_academic_year text, p_semester text, p_unlocked_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE schedules
    SET locked_by = NULL, locked_at = NULL, lock_reason = NULL
    WHERE academic_year = p_academic_year
    AND semester = p_semester;
END;
$$;

CREATE OR REPLACE FUNCTION create_teacher_record(p_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_teacher_id uuid;
BEGIN
    INSERT INTO teachers (profile_id, department, employment_type, max_hours, is_public, is_active)
    VALUES (p_profile_id, 'Unassigned', 'full-time', 40, true, true)
    RETURNING id INTO v_teacher_id;
    
    RETURN v_teacher_id;
END;
$$;

-- Reattach triggers that depend on these functions
DROP TRIGGER IF EXISTS trg_schedule_insert ON schedules;
CREATE TRIGGER trg_schedule_insert
    BEFORE INSERT ON schedules
    FOR EACH ROW
    EXECUTE FUNCTION trg_schedule_insert_version();

DROP TRIGGER IF EXISTS trg_schedule_update ON schedules;
CREATE TRIGGER trg_schedule_update
    BEFORE UPDATE ON schedules
    FOR EACH ROW
    EXECUTE FUNCTION trg_schedule_update_version();

DROP TRIGGER IF EXISTS trg_schedule_delete ON schedules;
CREATE TRIGGER trg_schedule_delete
    BEFORE DELETE ON schedules
    FOR EACH ROW
    EXECUTE FUNCTION trg_schedule_delete_version();

DROP TRIGGER IF EXISTS trg_section_update ON sections;
CREATE TRIGGER trg_section_update
    BEFORE INSERT OR UPDATE ON sections
    FOR EACH ROW
    EXECUTE FUNCTION update_section_path();

DROP TRIGGER IF EXISTS trg_profile_role_change ON profiles;
CREATE TRIGGER trg_profile_role_change
    BEFORE UPDATE OF role ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION protect_power_admin();

DROP TRIGGER IF EXISTS trg_audit_role_change ON profiles;
CREATE TRIGGER trg_audit_role_change
    AFTER UPDATE OF role ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION audit_role_change();

DROP TRIGGER IF EXISTS trg_audit_logs_hash ON audit_logs;
CREATE TRIGGER trg_audit_logs_hash
    BEFORE INSERT OR UPDATE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION audit_logs_compute_hash();

DROP TRIGGER IF EXISTS trg_prevent_audit_mutation ON audit_logs;
CREATE TRIGGER trg_prevent_audit_mutation
    BEFORE INSERT OR UPDATE OR DELETE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION reject_audit_mutation();

DROP TRIGGER IF EXISTS trg_update_updated_at ON profiles;
CREATE TRIGGER trg_update_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Verify search_path is set
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('rate_limit_check', 'rate_limit_login', 'current_user_role', 'is_power_admin')
LIMIT 5;
