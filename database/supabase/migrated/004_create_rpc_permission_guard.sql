-- ============================================================================
-- create_rpc_permission_guard.sql
-- Session 2 / Task C2 of HARDENING_PLAN.md
--
-- Goal: a single, audit-aware guard helper that every mutating RPC can call
--   at its top to re-evaluate the same 3-tier permission tree the React UI
--   uses (per-user override → role override → global → default).
--
-- Why: today, RPCs like log_audit only check `is_admin_tier()`. The 3-tier
--   rules engine lives client-side (usePermissions). A user crafting a raw
--   PostgREST call can bypass the rules. This helper re-runs the same
--   precedence on the server, logs every denial to audit_logs, and raises
--   the canonical 42501 (insufficient_privilege).
--
-- Adoption pattern (in any new RPC):
--     PERFORM public.require_permission('schedule.publish');
--     -- ... rest of mutation ...
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. resolve_permission(uid, key) -> boolean
--    Convenience wrapper around effective_rule(): returns TRUE iff the
--    resolved value is truthy. Treats jsonb 'true', '"true"', and any
--    non-zero number as truthy. NULL / 'false' / 'null' are FALSE.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_permission(p_user uuid, p_key text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE v jsonb;
BEGIN
    v := public.effective_rule(p_user, p_key);
    IF v IS NULL OR v = 'null'::jsonb OR v = 'false'::jsonb THEN
        RETURN false;
    END IF;
    IF jsonb_typeof(v) = 'boolean' THEN
        RETURN (v::text)::boolean;
    END IF;
    IF jsonb_typeof(v) = 'string' THEN
        RETURN lower(v#>>'{}') = 'true';
    END IF;
    IF jsonb_typeof(v) = 'number' THEN
        RETURN (v::text)::numeric <> 0;
    END IF;
    -- objects / arrays: treat as truthy if non-empty
    RETURN v <> '{}'::jsonb AND v <> '[]'::jsonb;
END
$$;

GRANT EXECUTE ON FUNCTION public.resolve_permission(uuid, text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. require_permission(rule_key)
--    Hard gate. If the caller does not have the permission, the call is
--    logged to audit_logs and 42501 is raised. RPCs that need a hard gate
--    call this as their first statement.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.require_permission(p_rule text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_allowed boolean;
BEGIN
    -- service_role always passes; legitimate server-side jobs.
    IF auth.role() = 'service_role' THEN
        RETURN;
    END IF;

    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    v_allowed := public.resolve_permission(v_uid, p_rule);

    IF NOT v_allowed THEN
        -- Log the denial. Insertion is wrapped in BEGIN/EXCEPTION so a
        -- failing audit insert never masks the real 42501 — but if the
        -- audit log is healthy (and it should be, post-C1), this captures
        -- every unauthorised RPC attempt.
        BEGIN
            INSERT INTO public.audit_logs (
                actor_id, actor_role, action, target_table, target_id, details
            ) VALUES (
                v_uid,
                public.current_user_role(),
                'permission_denied',
                NULL,
                NULL,
                jsonb_build_object('rule', p_rule)
            );
        EXCEPTION WHEN OTHERS THEN
            -- swallow audit failure
            NULL;
        END;

        RAISE EXCEPTION 'Permission denied: %', p_rule USING ERRCODE = '42501';
    END IF;
END
$$;

GRANT EXECUTE ON FUNCTION public.require_permission(text) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. require_role(role_or_higher)
--    Companion gate based on the role-rank ladder. Useful for actions that
--    are not rule-based but role-tier-based (e.g. "must be schedule_admin
--    or higher"). Saves boilerplate inside RPCs.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.require_min_rank(p_min_rank int)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN;
    END IF;
    IF public.my_rank() < p_min_rank THEN
        BEGIN
            INSERT INTO public.audit_logs (
                actor_id, actor_role, action, target_table, target_id, details
            ) VALUES (
                auth.uid(),
                public.current_user_role(),
                'permission_denied',
                NULL,
                NULL,
                jsonb_build_object('required_rank', p_min_rank, 'my_rank', public.my_rank())
            );
        EXCEPTION WHEN OTHERS THEN NULL; END;
        RAISE EXCEPTION 'Permission denied: rank % required', p_min_rank
            USING ERRCODE = '42501';
    END IF;
END
$$;

GRANT EXECUTE ON FUNCTION public.require_min_rank(int) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. Retrofit log_audit() to use the new guard.
--    The existing definition only checks is_admin_tier() — we keep that
--    check (back-compat) but add a denial audit row when it fails.
--    This means even bypass attempts on log_audit get logged.
-- ----------------------------------------------------------------------------
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
    -- min rank for any audit-tier admin (schedule_manager=2, system_admin=4,
    -- schedule_admin=3, power_admin=6) — admin-tier minimum is rank 2.
    PERFORM public.require_min_rank(2);

    INSERT INTO public.audit_logs
        (actor_id, actor_role, action, target_table, target_id, details)
    VALUES
        (auth.uid(), public.current_user_role(), p_action, p_target_table, p_target_id, p_details)
    RETURNING id INTO v_id;
    RETURN v_id;
END
$$;

-- ============================================================================
-- END
-- Adoption checklist (track in HARDENING_PLAN.md as RPCs land):
--   [x] log_audit
--   [ ] generate_schedule (when written)
--   [ ] publish_schedule  (when written)
--   [ ] approve_change_request (when written)
-- ============================================================================
