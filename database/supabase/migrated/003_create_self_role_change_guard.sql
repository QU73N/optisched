-- ============================================================================
-- create_self_role_change_guard.sql
-- Session 1 / Task C9 of HARDENING_PLAN.md (refined)
--
-- Original C9 plan: "Power Admin active guard" — but `profiles` has no
-- `is_active` column, and `protect_power_admin` (governance v2) already
-- prevents Power Admin demotion/deletion. So C9 is repurposed to plug a
-- discovered gap:
--
--   GAP: profiles_update_hierarchical permits `id = auth.uid()` updates
--   without restricting which columns may change. A user can therefore
--   PATCH their own profile and set role='power_admin' directly via the
--   REST API, bypassing the UI.
--
-- This trigger blocks any self-update that mutates `role` — only an admin
-- of higher rank may change someone's role. Power Admin is still allowed
-- to be re-promoted/repaired by a service-role process (retention/seed).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- service_role (Supabase admin SDK) is allowed for legitimate seeding
    -- and recovery flows; everything else is gated.
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE'
       AND NEW.role IS DISTINCT FROM OLD.role
       AND NEW.id = auth.uid() THEN
        RAISE EXCEPTION
            'Self role change is not allowed (account: %). Ask a higher-ranked admin.',
            OLD.email
            USING ERRCODE = '42501';
    END IF;

    -- Defence in depth: even an admin-tier user must outrank the target's
    -- *new* role. This catches a power_admin trying to elevate someone TO
    -- power_admin via a peer (which the WITH CHECK already covers, but a
    -- trigger is harder to misconfigure than a policy).
    IF TG_OP = 'UPDATE'
       AND NEW.role IS DISTINCT FROM OLD.role
       AND NEW.id <> auth.uid() THEN
        IF public.my_rank() <= public.role_rank(NEW.role) THEN
            RAISE EXCEPTION
                'Cannot assign role % — your rank does not outrank the target role.',
                NEW.role
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_role_change ON public.profiles;
CREATE TRIGGER trg_prevent_self_role_change
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_self_role_change();

-- ----------------------------------------------------------------------------
-- Bonus: also write an audit row whenever a role actually changes, so the
-- audit log captures privilege escalations even if performed legitimately.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        INSERT INTO public.audit_logs (
            actor_id, actor_role, action, target_table, target_id, details
        ) VALUES (
            auth.uid(),
            public.current_user_role(),
            'role_changed',
            'profiles',
            NEW.id,
            jsonb_build_object(
                'from', OLD.role,
                'to',   NEW.role,
                'target_email', NEW.email
            )
        );
    END IF;
    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_audit_role_change ON public.profiles;
CREATE TRIGGER trg_audit_role_change
    AFTER UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_role_change();

-- ============================================================================
-- END
-- Test:
--   -- as any non-service user:
--   UPDATE public.profiles SET role='power_admin' WHERE id = auth.uid();
--   -- expect 42501 'Self role change is not allowed'
-- ============================================================================
