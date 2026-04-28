-- ============================================================================
-- OptiSched Governance v2  (created 2026-04-28)
-- ============================================================================
-- This file is ADDITIVE. It builds on create_system_rules_and_rbac.sql.
--
-- Adds:
--   1. role_rank() helper function (1..6)
--   2. user_activity_logs table (per-user troubleshooting trail)
--   3. user_permission_overrides table (per-user rules engine tier)
--   4. Hierarchy-enforced RLS on profiles (cannot edit equal/higher rank)
--   5. Lockout-proof Power Admin guards (cannot demote/delete)
--   6. log_audit() and log_activity() RPC helpers (callable from client)
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. role_rank()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.role_rank(p_role text)
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
    SELECT CASE p_role
        WHEN 'admin'            THEN 6  -- legacy alias for power_admin
        WHEN 'power_admin'      THEN 6
        WHEN 'system_admin'     THEN 5
        WHEN 'schedule_admin'   THEN 4
        WHEN 'schedule_manager' THEN 3
        WHEN 'teacher'          THEN 2
        WHEN 'student'          THEN 1
        ELSE 0
    END;
$$;

CREATE OR REPLACE FUNCTION public.my_rank()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT public.role_rank(public.current_user_role());
$$;


-- ---------------------------------------------------------------------------
-- 2. user_activity_logs  -- per-user trail (Power + System Admin readable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id              bigserial PRIMARY KEY,
    user_id         uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    action_type     text NOT NULL,             -- 'login','logout','page_view','mutation','rls_denied','ai_prompt','error'
    resource        text,                       -- e.g. '/admin/schedules', 'schedules:UPDATE'
    resource_id     uuid,
    details         jsonb NOT NULL DEFAULT '{}'::jsonb,
    session_id      text,
    ip_address      inet,
    user_agent      text,
    success         boolean NOT NULL DEFAULT true,
    error_message   text,
    duration_ms     integer,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ual_user      ON public.user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ual_created   ON public.user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ual_action    ON public.user_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_ual_user_time ON public.user_activity_logs(user_id, created_at DESC);

ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ual_select ON public.user_activity_logs;
DROP POLICY IF EXISTS ual_insert ON public.user_activity_logs;
DROP POLICY IF EXISTS ual_self_export ON public.user_activity_logs;

-- Power Admin + System Admin can see all activity logs.
-- A user can ALSO see their own log (for self-export / GDPR).
CREATE POLICY ual_select ON public.user_activity_logs FOR SELECT
    USING (
        public.current_user_role() IN ('admin','power_admin','system_admin')
        OR user_id = auth.uid()
    );

-- Anyone authenticated can insert their own activity log entry.
-- Service role can insert for any user (for triggers and server hooks).
CREATE POLICY ual_insert ON public.user_activity_logs FOR INSERT
    WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');


-- ---------------------------------------------------------------------------
-- 3. user_permission_overrides  -- per-user rules engine tier
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rule_key    text NOT NULL,
    rule_value  jsonb NOT NULL,
    reason      text,
    set_by      uuid REFERENCES public.profiles(id),
    expires_at  timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, rule_key)
);

CREATE INDEX IF NOT EXISTS idx_upo_user ON public.user_permission_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_upo_rule ON public.user_permission_overrides(rule_key);

ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS upo_select ON public.user_permission_overrides;
DROP POLICY IF EXISTS upo_modify ON public.user_permission_overrides;

-- Read: admin tier (so the gating works); user can read their own
CREATE POLICY upo_select ON public.user_permission_overrides FOR SELECT
    USING (
        public.is_admin_tier()
        OR user_id = auth.uid()
    );

-- Write: only Power + System Admin, and target rank must be < my rank
CREATE POLICY upo_modify ON public.user_permission_overrides FOR ALL
    USING (
        public.current_user_role() IN ('admin','power_admin','system_admin')
        AND public.my_rank() > public.role_rank(
            (SELECT role FROM public.profiles WHERE id = user_id)
        )
    )
    WITH CHECK (
        public.current_user_role() IN ('admin','power_admin','system_admin')
        AND public.my_rank() > public.role_rank(
            (SELECT role FROM public.profiles WHERE id = user_id)
        )
    );


-- ---------------------------------------------------------------------------
-- 4. system_rules: add role_overrides column for the role-tier
-- ---------------------------------------------------------------------------
ALTER TABLE public.system_rules
    ADD COLUMN IF NOT EXISTS role_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;


-- ---------------------------------------------------------------------------
-- 5. Hierarchy-enforced profiles policy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_self_or_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_modify ON public.profiles;
DROP POLICY IF EXISTS profiles_update_hierarchical ON public.profiles;
DROP POLICY IF EXISTS profiles_delete_hierarchical ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_hierarchical ON public.profiles;

-- SELECT: self, or any admin tier
CREATE POLICY profiles_self_or_admin ON public.profiles FOR SELECT
    USING (id = auth.uid() OR public.is_admin_tier());

-- INSERT: only roles that can manage users (power+system admin)
CREATE POLICY profiles_insert_hierarchical ON public.profiles FOR INSERT
    WITH CHECK (
        public.current_user_role() IN ('admin','power_admin','system_admin')
        AND public.my_rank() > public.role_rank(role)
    );

-- UPDATE: self for non-privileged fields only; otherwise must outrank target
-- Note: column-level filtering for "non-privileged" is enforced via grants
-- and via UI; here we ensure that any update by a non-self user must outrank.
CREATE POLICY profiles_update_hierarchical ON public.profiles FOR UPDATE
    USING (
        id = auth.uid()
        OR (
            public.is_admin_tier()
            AND public.my_rank() > public.role_rank(role)
        )
    )
    WITH CHECK (
        id = auth.uid()
        OR (
            public.is_admin_tier()
            AND public.my_rank() > public.role_rank(role)
        )
    );

-- DELETE: only Power Admin, and never on another Power Admin or self
CREATE POLICY profiles_delete_hierarchical ON public.profiles FOR DELETE
    USING (
        public.is_power_admin()
        AND id <> auth.uid()
        AND public.role_rank(role) < 6
    );


-- ---------------------------------------------------------------------------
-- 6. Lockout-proof Power Admin trigger
--    A safety net beyond RLS: even if a policy is misconfigured,
--    trigger blocks demotion/deletion of any rank-6 row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_power_admin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF public.role_rank(OLD.role) >= 6 THEN
            RAISE EXCEPTION 'Power Admin cannot be deleted (account: %)', OLD.email;
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF public.role_rank(OLD.role) >= 6 AND public.role_rank(NEW.role) < 6 THEN
            RAISE EXCEPTION 'Power Admin cannot be demoted (account: %)', OLD.email;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_power_admin ON public.profiles;
CREATE TRIGGER trg_protect_power_admin
    BEFORE UPDATE OR DELETE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_power_admin();


-- ---------------------------------------------------------------------------
-- 7. Effective rule lookup function (for usePermissions hook + server use)
--    Resolves precedence: per-user override → role override → global → null
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.effective_rule(p_user uuid, p_key text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
    v_role text;
    v_value jsonb;
BEGIN
    -- 1. per-user override (must not be expired)
    SELECT rule_value INTO v_value
    FROM public.user_permission_overrides
    WHERE user_id = p_user
      AND rule_key = p_key
      AND (expires_at IS NULL OR expires_at > now());
    IF v_value IS NOT NULL THEN RETURN v_value; END IF;

    -- 2. role override
    SELECT role INTO v_role FROM public.profiles WHERE id = p_user;
    IF v_role IS NOT NULL THEN
        SELECT role_overrides -> v_role -> p_key INTO v_value FROM public.system_rules WHERE rule_key = p_key;
        IF v_value IS NOT NULL AND v_value <> 'null'::jsonb THEN RETURN v_value; END IF;
    END IF;

    -- 3. global rule
    SELECT rule_value INTO v_value FROM public.system_rules WHERE rule_key = p_key;
    RETURN v_value;
END;
$$;


-- ---------------------------------------------------------------------------
-- 8. RPC helpers (callable from client via supabase.rpc)
-- ---------------------------------------------------------------------------

-- log_activity: insert a row into user_activity_logs for the current user
CREATE OR REPLACE FUNCTION public.log_activity(
    p_action_type text,
    p_resource    text DEFAULT NULL,
    p_resource_id uuid DEFAULT NULL,
    p_details     jsonb DEFAULT '{}'::jsonb,
    p_success     boolean DEFAULT true,
    p_error       text DEFAULT NULL,
    p_duration_ms integer DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_id bigint;
BEGIN
    INSERT INTO public.user_activity_logs
        (user_id, action_type, resource, resource_id, details, success, error_message, duration_ms)
    VALUES
        (auth.uid(), p_action_type, p_resource, p_resource_id, p_details, p_success, p_error, p_duration_ms)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- log_audit: append-only audit log; admin-tier only
CREATE OR REPLACE FUNCTION public.log_audit(
    p_action       text,
    p_target_table text DEFAULT NULL,
    p_target_id    uuid DEFAULT NULL,
    p_details      jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_id uuid;
BEGIN
    IF NOT public.is_admin_tier() THEN
        RAISE EXCEPTION 'Only admin-tier users may write to audit_logs';
    END IF;
    INSERT INTO public.audit_logs
        (actor_id, actor_role, action, target_table, target_id, details)
    VALUES
        (auth.uid(), public.current_user_role(), p_action, p_target_table, p_target_id, p_details)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;


-- ---------------------------------------------------------------------------
-- 9. Seed additional rules referenced by v1.2 PRD
-- ---------------------------------------------------------------------------
INSERT INTO public.system_rules (rule_key, rule_value, description, category) VALUES
    ('teachers_can_message_other_teachers', 'true'::jsonb,
        'When false, teacher-to-teacher messaging is disabled.', 'communication'),
    ('teachers_can_view_section_rosters', 'false'::jsonb,
        'When true, teachers can see student rosters of their assigned sections.', 'visibility'),
    ('students_can_see_classmates', 'false'::jsonb,
        'When true, students see their section directory.', 'visibility'),
    ('students_can_use_optibot', 'true'::jsonb,
        'When false, OptiBot is hidden from student dashboards.', 'communication'),
    ('auto_archive_old_schedules_days', '365'::jsonb,
        'Schedules in published state for longer than this auto-archive.', 'workflow'),
    ('session_timeout_minutes', '60'::jsonb,
        'Inactive session is signed out after this many minutes.', 'security'),
    ('password_min_length', '12'::jsonb,
        'Minimum allowed password length on account creation.', 'security'),
    ('require_2fa_for_admins', 'false'::jsonb,
        'When true, admin-tier accounts must enable TOTP MFA.', 'security'),
    ('audit_log_retention_days', '730'::jsonb,
        'Days to retain audit_logs before automatic purge.', 'security'),
    ('activity_log_retention_days', '90'::jsonb,
        'Days to retain user_activity_logs before automatic purge.', 'security')
ON CONFLICT (rule_key) DO NOTHING;


-- ============================================================================
-- END OF FILE
-- ============================================================================
