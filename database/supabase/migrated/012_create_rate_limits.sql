-- ============================================================================
-- create_rate_limits.sql
-- Session 2 / Task C3 of HARDENING_PLAN.md
--
-- Goal: server-enforced sliding-window rate limits for sensitive operations.
--   - Login attempts (per email)            : 5 per 5 min
--   - Password-reset requests (per email)   : 3 per 15 min
--   - Schedule generation (per user)        : 3 per hour
--   - Bulk imports (per user)               : 1 per minute
--
-- Storage is a single counter table keyed by (action, subject). Counters
-- reset by recreating the bucket when the window expires; we keep one
-- row per (action, subject) and update it in place.
--
-- The check function is SECURITY DEFINER so it can be called pre-auth
-- (login). Anonymous callers must pass an explicit subject (typically the
-- lowercased email or a hashed IP); authenticated callers default to
-- auth.uid().
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Bucket table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
    action        text NOT NULL,
    subject       text NOT NULL,         -- email, user-id, ip — caller-supplied
    window_start  timestamptz NOT NULL DEFAULT now(),
    count         integer NOT NULL DEFAULT 0,
    last_hit      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (action, subject)
);

CREATE INDEX IF NOT EXISTS idx_rlb_window
    ON public.rate_limit_buckets(window_start);

-- RLS: nobody can read or write directly. The check function is the only
-- legitimate access path and bypasses RLS via SECURITY DEFINER.
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rlb_no_access ON public.rate_limit_buckets;
CREATE POLICY rlb_no_access ON public.rate_limit_buckets FOR ALL USING (false) WITH CHECK (false);

-- ----------------------------------------------------------------------------
-- 2. rate_limit_check(action, subject, max, window) -> jsonb
--    Returns:
--      { allowed: true,  remaining: N, reset_at: ts }   on success
--      { allowed: false, remaining: 0, reset_at: ts, retry_after_seconds: N }
--    Never raises — caller decides what to do with the result. (Login
--    flows want to abort; soft features may want to degrade.)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rate_limit_check(
    p_action   text,
    p_subject  text,
    p_max      integer,
    p_window   interval
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_bucket  public.rate_limit_buckets%ROWTYPE;
    v_now     timestamptz := now();
    v_reset   timestamptz;
BEGIN
    IF p_subject IS NULL OR length(trim(p_subject)) = 0 THEN
        RAISE EXCEPTION 'rate_limit_check: subject required';
    END IF;

    SELECT * INTO v_bucket
      FROM public.rate_limit_buckets
     WHERE action = p_action AND subject = lower(p_subject)
     FOR UPDATE;

    -- New bucket OR window expired -> reset.
    IF NOT FOUND OR v_bucket.window_start + p_window <= v_now THEN
        INSERT INTO public.rate_limit_buckets (action, subject, window_start, count, last_hit)
        VALUES (p_action, lower(p_subject), v_now, 1, v_now)
        ON CONFLICT (action, subject) DO UPDATE
          SET window_start = EXCLUDED.window_start,
              count        = 1,
              last_hit     = EXCLUDED.last_hit;
        RETURN jsonb_build_object(
            'allowed',   true,
            'remaining', p_max - 1,
            'reset_at',  v_now + p_window
        );
    END IF;

    v_reset := v_bucket.window_start + p_window;

    IF v_bucket.count >= p_max THEN
        RETURN jsonb_build_object(
            'allowed',             false,
            'remaining',           0,
            'reset_at',            v_reset,
            'retry_after_seconds', GREATEST(1, EXTRACT(EPOCH FROM (v_reset - v_now))::int)
        );
    END IF;

    UPDATE public.rate_limit_buckets
       SET count = count + 1, last_hit = v_now
     WHERE action = p_action AND subject = lower(p_subject);

    RETURN jsonb_build_object(
        'allowed',   true,
        'remaining', p_max - v_bucket.count - 1,
        'reset_at',  v_reset
    );
END
$$;

-- Grant to anon AND authenticated so the login flow (pre-auth) can call it.
GRANT EXECUTE ON FUNCTION public.rate_limit_check(text, text, integer, interval) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Convenience wrappers with project-default limits.
--    Tunable later by changing these wrappers (or by adding system_rules
--    rows and reading them, if the limits need runtime config).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rate_limit_login(p_email text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
    SELECT public.rate_limit_check('login', p_email, 5, interval '5 minutes');
$$;

CREATE OR REPLACE FUNCTION public.rate_limit_password_reset(p_email text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
    SELECT public.rate_limit_check('password_reset', p_email, 3, interval '15 minutes');
$$;

CREATE OR REPLACE FUNCTION public.rate_limit_generate(p_uid uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
    SELECT public.rate_limit_check(
        'generate_schedule',
        COALESCE(p_uid::text, auth.uid()::text),
        3, interval '1 hour'
    );
$$;

GRANT EXECUTE ON FUNCTION public.rate_limit_login(text)          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_password_reset(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_generate(uuid)       TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. Janitor: delete stale buckets ( > 24h old window ) so the table never
--    grows unbounded. Run via pg_cron in D2; safe to call manually.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rate_limit_prune()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_deleted integer;
BEGIN
    DELETE FROM public.rate_limit_buckets
     WHERE last_hit < now() - interval '24 hours';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END
$$;

-- ============================================================================
-- END
-- Smoke test:
--   SELECT public.rate_limit_check('login', 'test@example.com', 5, interval '5 min');
--   -- run 6× quickly: 6th returns { allowed: false, retry_after_seconds: ... }
-- ============================================================================
