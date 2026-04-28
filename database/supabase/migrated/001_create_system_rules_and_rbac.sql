-- ============================================================================
-- OptiSched: System Rules Engine, Audit Logs, Schema Debt Fixes, RLS Policies
-- Version: 1.0  (created 2026-04-28)
-- Safe to run multiple times (uses IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================================
--
-- This file is ADDITIVE. It never edits or drops existing SQL files.
-- It expects the tables defined in database/schemas/database_schema.sql to
-- already exist.
--
-- Sections:
--   1. Schema debt fixes (role CHECK extensions, schedule status, creator_role)
--   2. system_rules table (Permission Rules Engine)
--   3. audit_logs table (Power Admin audit trail)
--   4. Helper functions (current_role, has_rule, is_admin_tier)
--   5. RLS policies per table (role-based access at DB level)
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. SCHEMA DEBT FIXES
-- ---------------------------------------------------------------------------

-- 1a. Extend profiles.role CHECK to allow all 6 roles
DO $$
BEGIN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
        CHECK (role = ANY (ARRAY[
            'admin'::text,           -- legacy alias for power_admin
            'power_admin'::text,
            'system_admin'::text,
            'schedule_admin'::text,
            'schedule_manager'::text,
            'teacher'::text,
            'student'::text
        ]));
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'profiles table not present yet; skipping role CHECK extension';
END $$;

-- 1b. Extend custom_events.creator_role CHECK
DO $$
BEGIN
    ALTER TABLE public.custom_events DROP CONSTRAINT IF EXISTS custom_events_creator_role_check;
    ALTER TABLE public.custom_events ADD CONSTRAINT custom_events_creator_role_check
        CHECK (creator_role = ANY (ARRAY[
            'admin'::text,
            'power_admin'::text,
            'system_admin'::text,
            'schedule_admin'::text,
            'schedule_manager'::text,
            'teacher'::text
        ]));
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'custom_events table not present; skipping';
END $$;

-- 1c. Extend schedules.status to support the approval workflow (§15)
DO $$
BEGIN
    ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_status_check;
    ALTER TABLE public.schedules ADD CONSTRAINT schedules_status_check
        CHECK (status = ANY (ARRAY[
            'draft'::text,
            'submitted'::text,   -- awaiting Schedule Admin approval
            'published'::text,
            'archived'::text,
            'rejected'::text     -- Schedule Admin rejected
        ]));
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'schedules table not present; skipping';
END $$;

-- 1d. Add created_by to schedules so RLS can identify Schedule Manager ownership
ALTER TABLE public.schedules
    ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
    ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS approved_at timestamptz,
    ADD COLUMN IF NOT EXISTS rejection_reason text;


-- ---------------------------------------------------------------------------
-- 2. system_rules  -- Permission Rules Engine
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_key text UNIQUE NOT NULL,
    rule_value jsonb NOT NULL DEFAULT 'true'::jsonb,
    description text,
    category text NOT NULL DEFAULT 'general',
    updated_by uuid REFERENCES public.profiles(id),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_rules_key ON public.system_rules(rule_key);

-- Seed default rules (insert only if missing)
INSERT INTO public.system_rules (rule_key, rule_value, description, category) VALUES
    ('teachers_can_see_student_schedules', 'false'::jsonb,
        'When true, teachers may view student section schedules.', 'visibility'),
    ('students_can_see_teacher_names', 'true'::jsonb,
        'When true, students see teacher names on their schedule.', 'visibility'),
    ('schedule_managers_require_approval', 'true'::jsonb,
        'When false, Schedule Managers may publish directly without Schedule Admin approval.', 'workflow'),
    ('teachers_can_message_admins', 'true'::jsonb,
        'When false, admin messaging is disabled for teachers.', 'communication'),
    ('teachers_can_submit_change_requests', 'true'::jsonb,
        'When false, the Schedule Change Request form is hidden from teachers.', 'workflow'),
    ('students_can_see_section_wide_schedule', 'true'::jsonb,
        'When true, students can see all schedules for their section.', 'visibility'),
    ('schedule_managers_can_edit_others_drafts', 'false'::jsonb,
        'When true, Schedule Managers can edit drafts created by other managers.', 'workflow'),
    ('per_user_overrides', '{}'::jsonb,
        'JSONB keyed by user ID for granular per-user rule overrides.', 'overrides')
ON CONFLICT (rule_key) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 3. audit_logs  -- Power Admin trail (every sensitive action)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid REFERENCES public.profiles(id),
    actor_role text,
    action text NOT NULL,
    target_table text,
    target_id uuid,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    ip_address inet,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);


-- ---------------------------------------------------------------------------
-- 4. HELPER FUNCTIONS
-- ---------------------------------------------------------------------------

-- current_user_role() -- returns the caller's role from profiles
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- is_power_admin() -- true if caller is admin or power_admin
CREATE OR REPLACE FUNCTION public.is_power_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT public.current_user_role() IN ('admin','power_admin');
$$;

-- is_admin_tier() -- true if caller is any admin sub-role
CREATE OR REPLACE FUNCTION public.is_admin_tier()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT public.current_user_role() IN (
        'admin','power_admin','system_admin','schedule_admin','schedule_manager'
    );
$$;

-- can_approve_schedules()
CREATE OR REPLACE FUNCTION public.can_approve_schedules()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT public.current_user_role() IN ('admin','power_admin','schedule_admin');
$$;

-- can_manage_users()
CREATE OR REPLACE FUNCTION public.can_manage_users()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT public.current_user_role() IN ('admin','power_admin','system_admin');
$$;

-- get_system_rule(key) -- returns the rule_value or NULL
CREATE OR REPLACE FUNCTION public.get_system_rule(p_key text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT rule_value FROM public.system_rules WHERE rule_key = p_key;
$$;

-- rule_enabled(key) -- convenience: treats rule_value as boolean
CREATE OR REPLACE FUNCTION public.rule_enabled(p_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
    SELECT COALESCE((public.get_system_rule(p_key))::boolean, false);
$$;


-- ---------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY POLICIES
-- ---------------------------------------------------------------------------
-- Every policy below is per-role. Frontend is untrusted.
-- ---------------------------------------------------------------------------

-- system_rules: Power+System Admin read/write; all others read-only
ALTER TABLE public.system_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS system_rules_read ON public.system_rules;
DROP POLICY IF EXISTS system_rules_write ON public.system_rules;
CREATE POLICY system_rules_read ON public.system_rules FOR SELECT
    USING (true); -- everyone can read rules (to check their own permissions)
CREATE POLICY system_rules_write ON public.system_rules FOR ALL
    USING (public.can_manage_users())
    WITH CHECK (public.can_manage_users());

-- audit_logs: Power Admin read; any admin-tier can insert; nobody updates/deletes
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_select ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT
    USING (public.is_power_admin());
CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT
    WITH CHECK (public.is_admin_tier());

-- profiles: users see self; admin-tier sees all; user-managers can modify
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_self_or_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_modify ON public.profiles;
CREATE POLICY profiles_self_or_admin ON public.profiles FOR SELECT
    USING (id = auth.uid() OR public.is_admin_tier());
CREATE POLICY profiles_modify ON public.profiles FOR ALL
    USING (id = auth.uid() OR public.can_manage_users())
    WITH CHECK (id = auth.uid() OR public.can_manage_users());

-- schedules: visibility depends on role + status + ownership
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS schedules_select ON public.schedules;
DROP POLICY IF EXISTS schedules_insert ON public.schedules;
DROP POLICY IF EXISTS schedules_update ON public.schedules;
DROP POLICY IF EXISTS schedules_delete ON public.schedules;

-- SELECT: power/sched admin see all; managers see all + their drafts;
-- teachers see only published matching them; students see only published for their section
CREATE POLICY schedules_select ON public.schedules FOR SELECT
    USING (
        public.is_power_admin()
        OR public.current_user_role() IN ('system_admin','schedule_admin')
        OR (
            public.current_user_role() = 'schedule_manager'
            AND (status IN ('published','submitted') OR created_by = auth.uid())
        )
        OR (
            public.current_user_role() = 'teacher'
            AND status = 'published'
            AND teacher_id IN (
                SELECT id FROM public.teachers WHERE profile_id = auth.uid()
            )
        )
        OR (
            public.current_user_role() = 'student'
            AND status = 'published'
            AND section_id IN (
                SELECT s.id FROM public.sections s
                JOIN public.profiles p ON p.section = s.name
                WHERE p.id = auth.uid()
            )
        )
    );

-- INSERT: only schedule managers/admins/power
CREATE POLICY schedules_insert ON public.schedules FOR INSERT
    WITH CHECK (
        public.current_user_role() IN
            ('admin','power_admin','schedule_admin','schedule_manager')
    );

-- UPDATE: power/sched admin always; manager only own drafts unless rule allows
CREATE POLICY schedules_update ON public.schedules FOR UPDATE
    USING (
        public.is_power_admin()
        OR public.current_user_role() = 'schedule_admin'
        OR (
            public.current_user_role() = 'schedule_manager'
            AND (
                created_by = auth.uid()
                OR public.rule_enabled('schedule_managers_can_edit_others_drafts')
            )
            AND status IN ('draft','rejected')
        )
    );

-- DELETE: only power admin + owner manager drafts
CREATE POLICY schedules_delete ON public.schedules FOR DELETE
    USING (
        public.is_power_admin()
        OR (
            public.current_user_role() = 'schedule_manager'
            AND created_by = auth.uid()
            AND status = 'draft'
        )
    );

-- conflicts: admin-tier reads all; teachers/students no direct access
ALTER TABLE public.conflicts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conflicts_select ON public.conflicts;
DROP POLICY IF EXISTS conflicts_modify ON public.conflicts;
CREATE POLICY conflicts_select ON public.conflicts FOR SELECT
    USING (public.is_admin_tier());
CREATE POLICY conflicts_modify ON public.conflicts FOR ALL
    USING (public.is_admin_tier())
    WITH CHECK (public.is_admin_tier());

-- announcements: everyone reads; only admin-tier (not manager) can write
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS announcements_select ON public.announcements;
DROP POLICY IF EXISTS announcements_write ON public.announcements;
CREATE POLICY announcements_select ON public.announcements FOR SELECT
    USING (true);
CREATE POLICY announcements_write ON public.announcements FOR ALL
    USING (public.current_user_role() IN
        ('admin','power_admin','system_admin','schedule_admin'))
    WITH CHECK (public.current_user_role() IN
        ('admin','power_admin','system_admin','schedule_admin'));

-- schedule_change_requests: teachers submit own; admin-tier resolve
ALTER TABLE public.schedule_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scr_select ON public.schedule_change_requests;
DROP POLICY IF EXISTS scr_insert ON public.schedule_change_requests;
DROP POLICY IF EXISTS scr_update ON public.schedule_change_requests;
CREATE POLICY scr_select ON public.schedule_change_requests FOR SELECT
    USING (
        teacher_id = auth.uid()
        OR public.current_user_role() IN
            ('admin','power_admin','schedule_admin')
    );
CREATE POLICY scr_insert ON public.schedule_change_requests FOR INSERT
    WITH CHECK (
        public.current_user_role() = 'teacher'
        AND teacher_id = auth.uid()
        AND public.rule_enabled('teachers_can_submit_change_requests')
    );
CREATE POLICY scr_update ON public.schedule_change_requests FOR UPDATE
    USING (public.current_user_role() IN ('admin','power_admin','schedule_admin'));

-- admin_messages: admin-tier sees all; teachers see their own sent/received
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_messages_select ON public.admin_messages;
DROP POLICY IF EXISTS admin_messages_insert ON public.admin_messages;
CREATE POLICY admin_messages_select ON public.admin_messages FOR SELECT
    USING (
        public.is_admin_tier()
        OR sender_id = auth.uid()
        OR recipient_id = auth.uid()
    );
CREATE POLICY admin_messages_insert ON public.admin_messages FOR INSERT
    WITH CHECK (
        sender_id = auth.uid()
        AND (
            public.is_admin_tier()
            OR public.rule_enabled('teachers_can_message_admins')
        )
    );

-- password_reset_requests: self insert; admin-tier resolve
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prr_select ON public.password_reset_requests;
DROP POLICY IF EXISTS prr_insert ON public.password_reset_requests;
DROP POLICY IF EXISTS prr_update ON public.password_reset_requests;
CREATE POLICY prr_select ON public.password_reset_requests FOR SELECT
    USING (user_id = auth.uid() OR public.can_manage_users());
CREATE POLICY prr_insert ON public.password_reset_requests FOR INSERT
    WITH CHECK (true); -- pre-auth allowed (by email lookup)
CREATE POLICY prr_update ON public.password_reset_requests FOR UPDATE
    USING (public.can_manage_users());

-- teachers, rooms, subjects, sections: read for admin-tier; write for manager+
DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['teachers','rooms','subjects','sections','teacher_preferences'] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
        EXECUTE format('DROP POLICY IF EXISTS %I_write ON public.%I', t, t);
        EXECUTE format($f$
            CREATE POLICY %I_select ON public.%I FOR SELECT USING (true)
        $f$, t, t);
        EXECUTE format($f$
            CREATE POLICY %I_write ON public.%I FOR ALL
            USING (public.current_user_role() IN ('admin','power_admin','schedule_manager','schedule_admin'))
            WITH CHECK (public.current_user_role() IN ('admin','power_admin','schedule_manager','schedule_admin'))
        $f$, t, t);
    END LOOP;
END $$;

-- custom_events: all authenticated read; admin-tier + teachers write own
ALTER TABLE public.custom_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS custom_events_select ON public.custom_events;
DROP POLICY IF EXISTS custom_events_write ON public.custom_events;
CREATE POLICY custom_events_select ON public.custom_events FOR SELECT
    USING (auth.uid() IS NOT NULL);
CREATE POLICY custom_events_write ON public.custom_events FOR ALL
    USING (public.is_admin_tier() OR created_by = auth.uid())
    WITH CHECK (public.is_admin_tier() OR created_by = auth.uid());

-- ============================================================================
-- END OF FILE
-- ============================================================================
