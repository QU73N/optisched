# OptiSched Hardening & Polish Plan — v1.0

**Status:** Draft for execution
**Owner:** Cascade + USER
**Scope:** Everything between "feature-complete v1.2" and "board-defensible v2.0"
**Reading order:** §0 → §1 (priority matrix) → individual workstreams §A–§J → §11 sequencing

---

## §0 Conventions used in this document

- Every task has: **ID** · **Title** · **Goal** · **Files** · **Steps** · **Acceptance criteria (AC)** · **Risks** · **Effort (S/M/L)**.
- Effort key: **S** = under 1 hour focused work, **M** = 1–3 hours, **L** = half-day or more.
- File paths are absolute when introducing new files; relative-to-repo when modifying existing.
- SQL discipline: per user rule, **never edit existing SQL files**. Every DB change creates a new file under `database/supabase/`.
- "RPC" = Postgres function exposed to PostgREST/Supabase.
- "AC" must be objectively checkable (a query, a curl, a Lighthouse score, a Playwright assertion).

---

## §1 Priority matrix

| Tier | Workstream | Why | Blocks |
|------|------------|-----|--------|
| P0 | §C Security | Board-defensibility, lockout protection, tamper-evident audit | Production launch |
| P0 | §B A11y | Legal exposure (WCAG AA), board scrutiny | Production launch |
| P1 | §A UI consistency | First impression; already 70% done | Marketing demos |
| P1 | §H Shared states | Eliminates per-page rhythm drift | A11y polish |
| P1 | §D Storage | Performance at scale, data integrity | Multi-tenant onboarding |
| P2 | §E Robustness | Reduces support tickets | — |
| P2 | §G Testing | Regression safety net | Refactors |
| P3 | §F Observability | Production diagnostics | Real users |
| P3 | §I Performance | Only when measured slow | Large datasets |
| P3 | §J Documentation | Onboarding next devs | Team growth |

---

## §A — UI consistency & spacing rhythm

### Status snapshot
✅ Token scale `--space-*` added in `web/src/index.css`
✅ Primitives (`.card`, `.stat-card`, `.input`, `.modal-content`, `.modal-form`, `.page-header`, `th/td`, `.badge`) tokenized
✅ Dark palette retuned for WCAG AA contrast
🟡 Component-level CSS files still contain hardcoded spacing
🔴 No `<EmptyState>` / `<LoadingState>` / `<ErrorState>` primitives
🔴 Page-level layouts inconsistent (some pages use `padding: 24px`, some 32px)

### Tasks

#### A1. Audit & tokenize component CSS files — **M**
- **Goal:** Every `padding`, `margin`, `gap` in CSS uses `var(--space-*)` or is explicitly off-grid by intent.
- **Files:** `web/src/components/Layout.css`, `web/src/pages/admin/Dashboard.css`, `web/src/pages/admin/SystemRules.css`, `web/src/pages/admin/AuditLogPage.css`, plus any `*.css` under `web/src/pages`.
- **Steps:**
  1. Run `rg "padding:\s*\d" web/src --type css` and `rg "gap:\s*\d" web/src --type css`.
  2. Categorize hits: ✅ on-grid (multiples of 4) → leave or tokenize; ❌ off-grid → fix.
  3. Replace with token references; if a value isn't on the scale, add to scale or round to nearest.
  4. Snapshot with Playwright before/after to catch regressions.
- **AC:**
  - `rg "padding:\s*\d+(?:\.\d+)?px" web/src --type css | grep -vE ":\s*(0|2|4|6|8|10|12|14|16|18|20|22|24|28|32|40|48)px"` returns 0 hits OR every hit has an inline `/* off-grid */` justification.
  - Visual diff shows ≤ 2 px shift on any element.
- **Risks:** Visual regressions in dashboard widgets. Mitigation: ship behind preview branch, eyeball each role.

#### A2. Page-level layout standardization — **S**
- **Goal:** Every `<Layout>` child page has identical outer padding and `.page-header` rhythm.
- **Files:** `web/src/components/Layout.tsx`, `web/src/components/Layout.css` `.main-content`.
- **Steps:**
  1. Define `.main-content` `padding: var(--space-8) var(--space-6)` (32 / 24).
  2. Remove per-page outer padding overrides.
  3. Standardize `<header className="page-header">` usage in all 35+ pages.
- **AC:** Every page renders with the same horizontal/vertical edge whitespace at 1440 px.

#### A3. Form-field rhythm — **S**
- **Goal:** Label → input → help-text → error message follow a single vertical pattern.
- **Files:** `index.css` `.modal-form`, plus any custom form CSS.
- **Steps:**
  1. Define `.field { display: flex; flex-direction: column; gap: var(--space-1); }`.
  2. Define `.field-label`, `.field-help`, `.field-error` text styles.
  3. Adopt in highest-traffic forms first: `LoginModal`, `AdminManageUsers`, `SystemRules`, `TeacherRequests`.
- **AC:** All forms in those four pages use `.field` wrapper; visual rhythm identical.

#### A4. Icon-text gap unification — **S**
- **Goal:** Single rule: icons inside buttons/links use `gap: var(--space-2)` (8 px).
- **Files:** `index.css` `.btn`, sidebar links, table action buttons.
- **Steps:** Replace `gap: 6/10px` with `gap: var(--space-2)` in `.btn`. Audit `Sidebar.tsx` link gap.
- **AC:** No `gap: [^space-2]` near icon containers.

#### A5. Print stylesheet — **M**
- **Goal:** `Ctrl+P` on schedule, audit log, faculty load gives a clean printable page.
- **Files:** New `web/src/styles/print.css`, imported from `index.css`.
- **Steps:**
  1. `@media print { .sidebar, .topbar, .btn, .dash-quick-actions { display: none; } }`.
  2. Force light theme tokens in `@media print`.
  3. Add page-break-inside avoid on `.card`, `.dash-card`.
- **AC:** Print preview of `/admin/schedules` shows only the schedule grid + header.

---

## §B — Accessibility (WCAG 2.1 AA)

### Status snapshot
✅ Reduced-motion media query exists in `index.css`
✅ Semantic HTML in most pages
🟡 Focus rings inconsistent (some elements lose `:focus-visible`)
🔴 Icon-only buttons missing `aria-label`
🔴 No skip-to-content link
🔴 Modals don't trap focus
🔴 No automated a11y test in CI

### Tasks

#### B1. ARIA labels on icon-only controls — **S**
- **Goal:** Every clickable element with no visible text has an accessible name.
- **Files:** `Layout.tsx` (logout button has `title` but needs `aria-label`), `Sidebar.tsx` (search clear, pin toggle), `ThemeToggle.tsx`, table action buttons in `AdminManageUsers.tsx`, `ApprovalsPage.tsx`.
- **Steps:** Audit with axe DevTools; add `aria-label` to every flagged element; prefer `aria-label` over `title` for screen readers.
- **AC:** `npx playwright test --grep "a11y"` (new test) reports 0 axe violations of rule `button-name`.

#### B2. Skip-to-content link — **S**
- **Goal:** Keyboard users can bypass the sidebar.
- **Files:** `Layout.tsx`.
- **Steps:**
  ```tsx
  <a href="#main-content" className="skip-link">Skip to content</a>
  ```
  Style it visually-hidden until focus.
- **AC:** Tab as first action lands on the skip link.

#### B3. Modal focus trap — **M**
- **Goal:** Focus stays inside modal until dismissed; ESC closes.
- **Files:** `LoginModal` in `LandingPage.tsx`, any `dash-modal-*` usage.
- **Steps:**
  1. Install `focus-trap-react` OR write 30-line custom trap.
  2. Wrap `.modal-content`; restore focus to opener on close.
  3. Bind ESC handler.
- **AC:** Manual test: open LoginModal, Tab cycles only inside; ESC closes; focus returns to login button.

#### B4. Focus-visible audit — **S**
- **Goal:** Every interactive element shows a visible focus ring.
- **Files:** `index.css` (already defines `:focus-visible` on `.btn`); audit links, sidebar items, table rows, badges.
- **Steps:** Add global `*:focus-visible { outline: 2px solid var(--accent-primary); outline-offset: 2px; }` as fallback; remove from elements with custom rings.
- **AC:** Tab through entire app; every stop has a visible indicator.

#### B5. Form error announcements — **S**
- **Goal:** Screen reader announces validation errors.
- **Files:** All forms.
- **Steps:** Add `role="alert"` or `aria-live="polite"` to `.field-error`. Associate via `aria-describedby` from input.
- **AC:** NVDA reads error within 1 s of form submit.

#### B6. Color contrast verification — **S**
- **Goal:** Every text/background pair meets AA (4.5:1 normal, 3:1 large).
- **Files:** `index.css` palette.
- **Steps:** Run `web/scripts/check-contrast.mjs` (new script using `chroma-js` or `wcag-contrast` package) over all token pairs.
- **AC:** Script exits 0; report file generated.

#### B7. `prefers-reduced-motion` audit — **S**
- **Goal:** All animations honour the preference.
- **Files:** Component-level CSS that defines its own `animation:` (Recharts wrapper, `dash-stagger`).
- **Steps:** Wrap in `@media (prefers-reduced-motion: no-preference)`.
- **AC:** With OS reduced-motion ON, no animation fires.

#### B8. Automated a11y CI — **M**
- **Goal:** Every PR runs axe against representative pages.
- **Files:** New `web/tests/a11y.spec.ts` (Playwright + `@axe-core/playwright`).
- **Steps:** Login as each role → visit dashboard → run `injectAxe`/`checkA11y`.
- **AC:** CI fails if any new violation.

---

## §C — Security & RBAC hardening (P0)

### Status snapshot
✅ Hierarchical role rank in DB (`create_governance_v2.sql`)
✅ Power Admin lockout protection trigger
✅ Three-tier permission overrides
✅ Activity & audit log tables
🟡 RLS policies cover read paths; write/delete coverage unverified
🔴 No tamper-evidence on audit logs (admins can DELETE rows directly)
🔴 No rate limiting on login or generate
🔴 No idle session timeout
🔴 CSV export vulnerable to formula injection
🔴 Client-side `usePermissions` not duplicated server-side for every RPC

### Tasks

#### C1. Audit-log tamper-evidence — **M**
- **Goal:** Audit log rows cannot be modified or deleted, even by Power Admin via direct SQL.
- **New file:** `database/supabase/create_audit_tamper_evidence.sql`
- **Steps:**
  ```sql
  CREATE OR REPLACE FUNCTION reject_audit_mutation() RETURNS trigger AS $$
  BEGIN RAISE EXCEPTION 'audit_logs are append-only'; END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
  CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
  ```
- **Optional hash chain:** add `prev_hash text`, `row_hash text` columns; trigger computes `row_hash = sha256(prev_hash || row::text)` on INSERT.
- **AC:** `DELETE FROM audit_logs;` as `power_admin` via SQL editor returns the exception. Hash chain (if enabled) verifiable by re-walking rows.
- **Risks:** Legitimate retention requires an archive table + signed tombstone (covered in D2).

#### C2. Server-side rule recheck wrapper — **L**
- **Goal:** Every RPC that mutates state re-evaluates the same permission tree as the client.
- **New file:** `database/supabase/create_rpc_permission_guard.sql`
- **Steps:**
  ```sql
  CREATE OR REPLACE FUNCTION require_permission(p_rule text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
  DECLARE allowed boolean;
  BEGIN
    SELECT resolve_permission(auth.uid(), p_rule) INTO allowed;
    IF NOT allowed THEN
      INSERT INTO audit_logs(actor_id, action, target, metadata)
      VALUES (auth.uid(), 'permission_denied', p_rule, jsonb_build_object('rpc', current_query()));
      RAISE EXCEPTION 'Permission denied: %', p_rule USING ERRCODE = '42501';
    END IF;
  END $$;
  ```
- **Steps (cont.):** Adopt at top of every mutating RPC: `PERFORM require_permission('schedule.publish');`
- **AC:** Bypassing the React UI and calling the RPC directly with a low-rank user yields 42501.

#### C3. Rate limiting — **M**
- **Goal:** Throttle login attempts and expensive operations.
- **New file:** `database/supabase/create_rate_limits.sql`
- **Steps:**
  1. Table `rate_limit_buckets(key text, window_start timestamptz, count int)` keyed by `(action, actor_or_ip)`.
  2. Function `rate_limit_check(p_action text, p_max int, p_window interval)` increments and rejects.
  3. Wire into:
     - `signIn` flow (5 attempts / 5 min / IP)
     - `generate_schedule` RPC (3 / hour / user)
     - bulk imports (1 / minute / user)
- **AC:** Six rapid login attempts with wrong password return rate-limit error on the 6th.

#### C4. Idle session timeout — **M**
- **Goal:** Inactive sessions sign out after N minutes (configurable per role rank).
- **Files:** `web/src/contexts/AuthContext.tsx`, new `web/src/hooks/useIdleTimeout.ts`.
- **Steps:**
  1. Hook listens for `mousemove`/`keydown`/`focus`; resets timer.
  2. After `idle_timeout_minutes` (system rule, default: 60 for low rank, 30 for admins, 15 for Power Admin), show modal with 30 s grace, then `signOut()`.
  3. Read setting from `system_rules` table.
- **AC:** Idle for >timeout triggers modal; clicking "Stay" resets; ignoring signs out.

#### C5. CSV export sanitization — **S**
- **Goal:** Prevent formula injection in any cell beginning with `= + - @ \t \r`.
- **Files:** New `web/src/utils/csv.ts` exporting `sanitizeCsvCell` and `toCsv`.
- **Steps:**
  ```ts
  export const sanitizeCsvCell = (v: unknown) => {
    const s = String(v ?? '');
    return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  };
  ```
- **Adopters:** `AuditLogPage`, `UserActivityPage`, any `Export CSV` button.
- **AC:** Unit test with malicious values renders escaped.

#### C6. PII redaction in logs — **S**
- **Goal:** No password, token, or full email in `activity_logs.metadata`.
- **Files:** Existing `useActivityLogger.ts`, RPCs that write logs.
- **Steps:** Define a allowlist of metadata keys per action; reject others server-side; redact emails to `j***@domain`.
- **AC:** Insert with disallowed key fails; tested.

#### C7. RLS coverage matrix — **L**
- **Goal:** For each `(table, role, verb)` exactly one expected outcome documented and enforced.
- **Files:** New `database/supabase/create_rls_coverage_matrix.sql` (optional defensive policies) + `docs/rls_matrix.md` (the spec).
- **Steps:**
  1. List all tables.
  2. For each role × {SELECT, INSERT, UPDATE, DELETE}, fill cell: `allow / allow_own / deny`.
  3. Write SQL test (§G2) that asserts each cell.
- **AC:** Matrix file exists; pg-tap suite covers every cell; all green.

#### C8. CORS / API surface review — **S**
- Verify Supabase project: anon key permissions, JWT expiry, allowed origins.
- Document in `docs/security_posture.md`.
- **AC:** Doc committed.

#### C9. Power Admin self-protection extra — **S**
- **Goal:** Beyond existing trigger, ensure Power Admin cannot have `is_active=false` set.
- **New file:** `database/supabase/create_power_admin_active_guard.sql`
- **AC:** Update of `is_active=false` on Power Admin row raises exception.

---

## §D — Storage, schema integrity & retention

### Status snapshot
✅ Schema in `database/schemas/database_schema.sql`
✅ Governance tables added in v2
🔴 Hot-path indexes unaudited
🔴 No retention/archive policy
🔴 FK ON DELETE behaviour not unified
🔴 `/admin/backup` is a placeholder

### Tasks

#### D1. Index audit — **M**
- **Goal:** Every query path used by the app is index-supported.
- **New file:** `database/supabase/create_performance_indexes.sql`
- **Suggested indexes:**
  ```sql
  CREATE INDEX IF NOT EXISTS ix_activity_logs_actor_created  ON activity_logs(actor_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS ix_activity_logs_action_created ON activity_logs(action, created_at DESC);
  CREATE INDEX IF NOT EXISTS ix_audit_logs_target_created    ON audit_logs(target_user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS ix_schedules_status_updated     ON schedules(status, updated_at DESC);
  CREATE INDEX IF NOT EXISTS ix_sections_dept_grade          ON sections(department_id, grade_level);
  CREATE INDEX IF NOT EXISTS ix_assignments_teacher_section  ON assignments(teacher_id, section_id);
  CREATE INDEX IF NOT EXISTS ix_change_requests_status       ON change_requests(status) WHERE status IN ('pending','in_review');
  ```
- **AC:** `EXPLAIN` on representative queries shows Index Scan, not Seq Scan, for tables > 1k rows.

#### D2. Retention & archive policy — **M**
- **Goal:** Activity logs older than 365 d move to `activity_logs_archive`; audit logs never deleted but compressed after 730 d.
- **New file:** `database/supabase/create_retention_policy.sql`
- **Steps:**
  1. `CREATE TABLE activity_logs_archive (LIKE activity_logs INCLUDING ALL);`
  2. Function `archive_old_logs()` runs nightly via `pg_cron` (Supabase extension).
  3. Document retention in `docs/data_retention.md`.
- **AC:** Manually invoking the function moves rows; live table count drops; archive count rises by same amount.

#### D3. FK ON DELETE review — **M**
- **Goal:** Deleting a user, section, or schedule has predictable, documented effects.
- **New file:** `database/supabase/create_fk_policy_normalized.sql` (only if changes required)
- **Steps:**
  1. List every FK currently in schema.
  2. Decide policy per relationship (CASCADE / SET NULL / RESTRICT / NO ACTION).
  3. Soft-delete preferred for `users`, `schedules`; hard-delete for ephemeral rows like `notifications`.
- **AC:** Doc + SQL match. Deleting test user does not orphan audit rows.

#### D4. Soft-delete unification — **S**
- **Goal:** Every "important" entity has `deleted_at timestamptz` and a global RLS predicate that hides them.
- **Tables:** `users`, `schedules`, `sections`, `subjects`.
- **AC:** A deleted user disappears from all UI but their audit log entries remain referenceable.

#### D5. Real backup endpoint — **L**
- **Goal:** `/admin/backup` actually creates downloadable backup snapshots.
- **Files:** New `web/src/pages/admin/BackupPage.tsx`, new edge function `supabase/functions/backup/index.ts`.
- **Steps:**
  1. Edge function calls `pg_dump` (or queries each table → JSON) and stores in Supabase Storage bucket `backups/`.
  2. UI lists past backups, download links, "Backup now" button.
  3. Restore flow guarded by Power Admin only + confirmation typing of "RESTORE".
- **AC:** Click "Backup now" → row appears in list; download yields valid JSON.

#### D6. Migration discipline doc — **S**
- **New file:** `docs/sql_workflow.md`
- Documents: never edit existing SQL; new file per change; naming `YYYYMMDD_description.sql`; how to roll forward.
- **AC:** Doc committed.

---

## §E — Logic, robustness & UX safety nets

### Status snapshot
✅ Activity logging on login/logout/page-view
🔴 No global error boundary
🔴 No toast notification system (alerts/console scattered)
🔴 No optimistic-update rollback helper
🔴 Timezone handling ad-hoc

### Tasks

#### E1. Route-level ErrorBoundary — **S**
- **Files:** New `web/src/components/RouteErrorBoundary.tsx`, wired in `App.tsx` around each `<Route>` element.
- **Steps:** Class component with `componentDidCatch`; on error log to `client_error_logs` (see F1) and show friendly fallback with "Reload" + "Report" buttons.
- **AC:** Forcibly throwing in a child renders the fallback, not a white screen.

#### E2. Toast system — **M**
- **Files:** New `web/src/components/Toast.tsx` + `web/src/contexts/ToastContext.tsx`; replace existing `alert()` calls.
- **Steps:**
  1. `useToast()` returns `{ success, error, info, warning }`.
  2. Stack of up to 4 toasts, auto-dismiss 4 s, hover-to-pause.
  3. ARIA `role="status"` for success, `role="alert"` for error.
- **AC:** Every `alert(` removed from codebase; replaced. Visual stack respects `--space-*`.

#### E3. Optimistic update rollback helper — **M**
- **Files:** New `web/src/utils/optimistic.ts`.
- **Steps:** Generic `useOptimisticMutation` that snapshots state, applies update, rolls back on RPC failure, shows error toast.
- **AC:** Approvals page uses it; turning network off mid-approve restores prior state.

#### E4. Race condition: schedule generate — **M**
- **Goal:** Two managers cannot generate the same schedule version simultaneously.
- **New file:** `database/supabase/create_schedule_generation_lock.sql`
- **Steps:** Advisory lock on `schedule_id` inside `generate_schedule` RPC; second caller gets clear error.
- **AC:** Concurrent test in pg-tap shows second call rejected.

#### E5. Timezone handling — **S**
- **Goal:** All timestamps stored UTC; displayed in school TZ from `system_rules.school_timezone`.
- **Files:** New `web/src/utils/datetime.ts` with `formatInSchoolTz()`; remove ad-hoc `toLocaleString()` calls.
- **AC:** Codebase grep `toLocaleString\(` returns only the helper or 0 hits.

#### E6. Conflict re-detection trigger — **M**
- **Goal:** Any insert/update on `schedule_blocks` recomputes conflicts for affected rows.
- **New file:** `database/supabase/create_conflict_recompute.sql`
- **AC:** Manually inserting an overlapping block creates a `conflicts` row.

---

## §F — Observability

### Tasks

#### F1. `client_error_logs` table + reporter — **M**
- **New file:** `database/supabase/create_client_error_logs.sql`
- Table: `id, user_id, url, message, stack, user_agent, created_at`.
- RLS: insert allowed for any authenticated user; select Power Admin only.
- Reporter: `web/src/utils/reportError.ts` called from ErrorBoundary (E1) and `window.onerror`.
- **AC:** Throw in dev → row appears.

#### F2. RPC duration logging — **S**
- Wrap `useActivityLogger` to record `duration_ms` for "rpc.*" actions.
- **AC:** Activity log shows RPC call durations.

#### F3. Real `/admin/health` page — **M**
- **Files:** Replace placeholder route in `App.tsx`; new `web/src/pages/admin/HealthPage.tsx`.
- **Checks:**
  - DB ping via `select 1` RPC.
  - Storage bucket reachable.
  - Last backup age.
  - Recent error count (last 1 h).
  - Edge function ping (if any).
- **AC:** Page shows green/amber/red badge per check, refreshes every 30 s.

#### F4. Sentry integration (optional) — **S**
- If user opts in, drop `@sentry/react` with DSN env var.
- **AC:** Production errors appear in Sentry dashboard.

---

## §G — Testing harness

### Tasks

#### G1. Permission hook unit tests — **M**
- **Files:** New `web/src/hooks/__tests__/usePermissions.test.ts` (Vitest).
- **Cover:** All three override layers, default deny, rank-based `canEditUser`.
- **AC:** ≥ 95 % branch coverage on `usePermissions.ts`.

#### G2. RLS pg-tap suite — **L**
- **New file:** `database/tests/rls_matrix.sql` (pg-tap).
- Generated from §C7 matrix doc.
- Run via `pg_prove` in CI.
- **AC:** Suite green; runs in < 10 s.

#### G3. Playwright per-role smoke — **M**
- **New file:** `web/tests/smoke.spec.ts`.
- For each of the 6 roles: login → dashboard renders → one critical action.
- **AC:** All 6 pass headless; CI runs them.

#### G4. Visual regression (optional) — **M**
- Playwright screenshots of dashboards at 1440 / 1024 / 600 px.
- **AC:** Diff < 0.1 % on baseline.

---

## §H — Shared UI primitives

### Tasks

#### H1. `<EmptyState>` — **S**
- **File:** New `web/src/components/states/EmptyState.tsx` + `.empty-state` CSS.
- **Props:** `icon`, `title`, `description`, `action?`.
- **Adopters:** `ApprovalsPage`, `AuditLogPage`, `UserActivityPage`, `TeacherRequests`, `Announcements`.
- **AC:** Every page that previously rendered "No results" / "Nothing here" uses it.

#### H2. `<LoadingState>` — **S**
- **File:** Same folder.
- **Variants:** `inline` (small spinner + text), `block` (centered, large), `skeleton` (uses `dash-skeleton`).
- **AC:** No raw `<div>Loading...</div>` left in pages.

#### H3. `<ErrorState>` — **S**
- **File:** Same folder.
- **Props:** `error`, `retry?`.
- **AC:** Used by ErrorBoundary fallback (§E1).

#### H4. `<ConfirmDialog>` — **S**
- Replace `confirm()` calls (e.g. `AdminManageUsers` delete).
- **AC:** No `window.confirm` in repo.

#### H5. `<DataTable>` (optional, **L**)
- Wrap recurring table patterns: pagination, sort, CSV export.
- Defer until 3+ tables share enough logic.

---

## §I — Performance

### Tasks

#### I1. Bundle audit — **S**
- Run `vite build --report` (or `rollup-plugin-visualizer`).
- Identify > 100 kB chunks; lazy-load admin pages.
- **AC:** Initial bundle < 350 kB gzipped.

#### I2. Route-level code splitting — **S**
- All admin pages: `const AdminPage = lazy(() => import('./pages/admin/...'))`.
- **AC:** Network tab shows separate chunks per route.

#### I3. Recharts trim — **S**
- Import only used pieces from `recharts` to reduce 90 kB cost; or evaluate `nivo` lite alternative.
- **AC:** Charts subtree < 50 kB.

#### I4. Query memoization — **S**
- Audit `useEffect`-driven Supabase queries; add SWR/React Query OR memoized fetcher.
- **AC:** Sidebar role badges/dashboard counts don't re-fetch on every render.

---

## §J — Documentation

### Tasks

#### J1. README.md polish — **S**
- Setup, dev, deploy, env vars, role matrix link.

#### J2. `docs/security_posture.md` — **M**
- Threat model, RLS matrix link, audit guarantees, retention, incident playbook.

#### J3. `docs/role_capability_matrix.md` — **S**
- Generated from `usePermissions` definitions.

#### J4. `docs/release_runbook.md` — **S**
- Pre-flight checklist, SQL deploy order, smoke tests, rollback.

#### J5. ADRs (Architecture Decision Records) — **M**
- One markdown per major decision (3-tier permissions, append-only audit, soft-delete strategy).

---

## §11 Sequencing & dependency graph

### Recommended execution order (8 working sessions)

1. **Session 1 — Security P0 part 1** · C1 (audit tamper) → C5 (CSV) → C9 (active guard) → C6 (PII)
2. **Session 2 — Security P0 part 2** · C2 (RPC guard) → C3 (rate limit) → C4 (idle timeout)
3. **Session 3 — A11y P0** · B1 → B2 → B4 → B5 → B7 → B3
4. **Session 4 — UI consistency finish** · A1 → A2 → A3 → A4 + H1 + H2 + H3 + H4
5. **Session 5 — Storage** · D1 → D3 → D4 → D2 → D6
6. **Session 6 — Robustness** · E1 → E2 → E3 → E5 → E4 → E6
7. **Session 7 — Observability + perf** · F1 → F3 → F2 → I1 → I2
8. **Session 8 — Testing + docs** · G1 → G2 → G3 → C7 (matrix doc) → J1–J5 → A5 (print)

### Dependency edges

- `E1 (ErrorBoundary)` depends on `F1 (client_error_logs)` for full benefit → do F1 first or no-op the reporter.
- `G2 (RLS pg-tap)` depends on `C7 (matrix doc)`.
- `B8 (a11y CI)` depends on `G3 (Playwright smoke)`.
- `H1–H4` should land before `A1–A4` adopt them.
- `E2 (toast)` should land before `E3 (optimistic)` (optimistic uses toasts on rollback).
- `D5 (backup)` requires `F3 (health)` link; do F3 first.

### Out-of-band quick wins (can be done anytime)

- A4 (icon-text gap) · J3 (capability matrix) · I3 (Recharts trim)

---

## §12 Acceptance gate for "v2.0 board-defensible"

All of the following must be true:

- [ ] All P0 tasks (§B + §C tier P0) complete and AC verified.
- [ ] RLS matrix doc + pg-tap suite green.
- [ ] Playwright smoke green on all 6 roles.
- [ ] Lighthouse a11y ≥ 95 on dashboard (each role).
- [ ] Bundle < 350 kB gz initial.
- [ ] No `alert()` / `window.confirm()` / hardcoded color in `web/src`.
- [ ] `/admin/health` returns all green for 24 h continuous.
- [ ] Last backup < 24 h old.
- [ ] Audit log tamper-evidence verified by external review (test deletion attempt).
- [ ] Documentation §J1–J4 complete.

---

## §13 Things explicitly OUT of scope for v2.0

- Multi-tenant org switching (deferred to v3).
- Mobile native apps.
- Real-time collaborative editing of schedules.
- Machine-learning conflict resolution.
- i18n beyond English.

These are noted to keep v2.0 finite.

---

## §14 Open questions for the USER

1. **Idle timeout values** — Confirm: Power Admin 15 min, System/Schedule Admin 30 min, Manager 30 min, Teacher 60 min, Student 60 min?
2. **Retention period** — 365 d for activity, 730 d for audit acceptable?
3. **Backup target** — Supabase Storage (default) or external (S3, Drive)?
4. **Sentry vs custom error logs** — Add Sentry, or rely solely on `client_error_logs` table?
5. **Print stylesheet priority** — Required for v2 or defer?
6. **Power Admin idle behaviour** — Auto-logout or only lock screen + re-auth prompt?
7. **Order preference** — Confirm or amend the 8-session sequence in §11.

---

*End of plan. After approval, work proceeds session by session, each closing with its AC checked and a one-line entry appended to `docs/CHANGELOG.md`.*
