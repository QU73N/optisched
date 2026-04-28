-- ============================================================================
-- create_session_idle_rules.sql
-- Session 2 / Task C4 of HARDENING_PLAN.md  (data layer only)
--
-- Goal: seed per-role idle-timeout values so the React client can read them
--   from system_rules without a release. Uses jsonb objects keyed by role.
--
-- Decisions confirmed by USER:
--   power_admin     : 15 min  (re-auth modal, NOT full sign-out)
--   system_admin    : 30 min  (full sign-out)
--   schedule_admin  : 30 min  (full sign-out)
--   schedule_manager: 30 min  (full sign-out)
--   teacher         : 60 min  (full sign-out)
--   student         : 60 min  (full sign-out)
-- The legacy global `session_timeout_minutes` (60) is kept as a fallback.
-- ============================================================================

INSERT INTO public.system_rules (rule_key, rule_value, description, category) VALUES
    (
        'idle_timeout_minutes_by_role',
        jsonb_build_object(
            'power_admin',      15,
            'admin',            15,
            'system_admin',     30,
            'schedule_admin',   30,
            'schedule_manager', 30,
            'teacher',          60,
            'student',          60
        ),
        'Per-role idle timeout in minutes. UI reads this map; falls back to session_timeout_minutes.',
        'security'
    ),
    (
        'idle_timeout_grace_seconds',
        '30'::jsonb,
        'Seconds the user has on the warning modal before forced action (sign-out / re-auth).',
        'security'
    ),
    (
        'idle_reauth_roles',
        jsonb_build_array('admin', 'power_admin'),
        'Roles whose idle timeout shows a re-auth modal instead of a full sign-out.',
        'security'
    )
ON CONFLICT (rule_key) DO NOTHING;

-- ============================================================================
-- END
-- ============================================================================
