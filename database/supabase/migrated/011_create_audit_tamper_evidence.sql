-- ============================================================================
-- create_audit_tamper_evidence.sql
-- Session 1 / Task C1 of HARDENING_PLAN.md
--
-- Goal: make `audit_logs` and `user_activity_logs` append-only and verifiable.
--   1. Block UPDATE and DELETE on both tables for every role except service_role
--      (service_role is required for the legitimate retention/archive job in D2).
--   2. Add a hash chain to `audit_logs`: each row stores sha256(prev_hash || row).
--      This makes silent tampering detectable: any modification breaks the chain.
--
-- Per project rule: this file ONLY adds new objects; it does not edit existing
-- SQL files. Safe to re-run (idempotent).
-- ============================================================================

-- pgcrypto provides digest(); already used by gen_random_uuid() in this DB,
-- but declare the dependency explicitly so this script is self-contained.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Hash-chain columns on audit_logs
-- ---------------------------------------------------------------------------
ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS prev_hash text,
    ADD COLUMN IF NOT EXISTS row_hash  text;

CREATE INDEX IF NOT EXISTS idx_audit_logs_row_hash ON public.audit_logs(row_hash);

-- ---------------------------------------------------------------------------
-- 2. Compute hash on INSERT (BEFORE so the value is stored on the new row).
--    Hash input is deterministic: prev tail hash + canonical column values.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_logs_compute_hash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prev text;
    v_payload text;
BEGIN
    SELECT row_hash
      INTO v_prev
      FROM public.audit_logs
     ORDER BY created_at DESC, id DESC
     LIMIT 1;

    NEW.prev_hash := COALESCE(v_prev, '0');

    v_payload := concat_ws(
        '|',
        NEW.prev_hash,
        NEW.id::text,
        COALESCE(NEW.actor_id::text, ''),
        COALESCE(NEW.actor_role, ''),
        NEW.action,
        COALESCE(NEW.target_table, ''),
        COALESCE(NEW.target_id::text, ''),
        COALESCE(NEW.details::text, '{}'),
        COALESCE(NEW.ip_address::text, ''),
        NEW.created_at::text
    );

    NEW.row_hash := encode(digest(v_payload, 'sha256'), 'hex');
    RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS audit_logs_hash_chain ON public.audit_logs;
CREATE TRIGGER audit_logs_hash_chain
    BEFORE INSERT ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_logs_compute_hash();

-- ---------------------------------------------------------------------------
-- 3. Tamper rejection: no UPDATE, no DELETE — except for service_role
--    which the retention job (D2) uses to move rows to the archive table.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF auth.role() = 'service_role' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    RAISE EXCEPTION
        'Audit table % is append-only (operation: %). Mutation rejected.',
        TG_TABLE_NAME, TG_OP
        USING ERRCODE = '42501';
END
$$;

DROP TRIGGER IF EXISTS audit_logs_no_update ON public.audit_logs;
CREATE TRIGGER audit_logs_no_update
    BEFORE UPDATE ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.reject_audit_mutation();

DROP TRIGGER IF EXISTS audit_logs_no_delete ON public.audit_logs;
CREATE TRIGGER audit_logs_no_delete
    BEFORE DELETE ON public.audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.reject_audit_mutation();

DROP TRIGGER IF EXISTS user_activity_logs_no_update ON public.user_activity_logs;
CREATE TRIGGER user_activity_logs_no_update
    BEFORE UPDATE ON public.user_activity_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.reject_audit_mutation();

DROP TRIGGER IF EXISTS user_activity_logs_no_delete ON public.user_activity_logs;
CREATE TRIGGER user_activity_logs_no_delete
    BEFORE DELETE ON public.user_activity_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.reject_audit_mutation();

-- ---------------------------------------------------------------------------
-- 4. Verifier: walks the chain and reports the first inconsistency.
--    Returns NULL when the chain is intact, otherwise the offending id.
--    Power Admin only (enforced by SECURITY DEFINER + check inside).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_audit_chain()
RETURNS TABLE (status text, broken_at uuid, expected_hash text, stored_hash text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r record;
    v_prev text := '0';
    v_calc text;
    v_payload text;
BEGIN
    IF NOT public.is_power_admin() THEN
        RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
    END IF;

    FOR r IN
        SELECT * FROM public.audit_logs
         ORDER BY created_at ASC, id ASC
    LOOP
        v_payload := concat_ws(
            '|',
            COALESCE(r.prev_hash, '0'),
            r.id::text,
            COALESCE(r.actor_id::text, ''),
            COALESCE(r.actor_role, ''),
            r.action,
            COALESCE(r.target_table, ''),
            COALESCE(r.target_id::text, ''),
            COALESCE(r.details::text, '{}'),
            COALESCE(r.ip_address::text, ''),
            r.created_at::text
        );
        v_calc := encode(digest(v_payload, 'sha256'), 'hex');

        IF r.prev_hash IS DISTINCT FROM v_prev THEN
            RETURN QUERY SELECT 'broken_link'::text, r.id, v_prev, r.prev_hash;
            RETURN;
        END IF;
        IF r.row_hash IS DISTINCT FROM v_calc THEN
            RETURN QUERY SELECT 'altered_row'::text, r.id, v_calc, r.row_hash;
            RETURN;
        END IF;
        v_prev := r.row_hash;
    END LOOP;

    RETURN QUERY SELECT 'intact'::text, NULL::uuid, NULL::text, NULL::text;
END
$$;

GRANT EXECUTE ON FUNCTION public.verify_audit_chain() TO authenticated;

-- ============================================================================
-- END
-- Verify with:   SELECT * FROM public.verify_audit_chain();
-- Tamper test:   DELETE FROM public.audit_logs;   -- expect 42501
-- ============================================================================
