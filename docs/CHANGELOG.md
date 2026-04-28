# OptiSched Changelog

## [Unreleased]

### Security Hardening - Session 1 (P0)
- New SQL migration `20250128_audit_tamper_evidence.sql`: added triggers to prevent UPDATE/DELETE on audit_logs table for tamper-evident audit trail
- CSV export sanitization already implemented in `utils/csv.ts` with formula injection prevention via cell prefix escaping
- Power Admin self-protection already implemented in `create_self_role_change_guard.sql`: prevents users from changing their own role and enforces rank-based role assignment
- PII redaction already implemented in `utils/pii.ts`: strips sensitive keys, truncates long strings, masks emails, with integration in useActivityLogger

### Security Hardening - Session 2 (P0)
- Server-side permission guard already implemented in `create_rpc_permission_guard.sql`: `require_permission()` RPC with audit logging for denials
- New SQL migration `20250128_rate_limits.sql`: sliding window rate limiting for login (5/5min/IP), generate_schedule (3/hour/user), bulk_import (1/minute/user)
- Idle session timeout already implemented in `useIdleTimeout.ts` hook with per-role configuration in `create_session_idle_rules.sql` (Power Admin 15min, others 30-60min)

### Accessibility (Session 3)
- Added ARIA labels to all icon-only buttons across Layout, Sidebar, ThemeToggle, AdminManageUsers, ApprovalsPage, UserActivityPage, and OptiBot
- Implemented skip-to-content link in Layout with visual-hidden styling until focus
- Added global focus-visible fallback in index.css with outline removal for custom-styled elements
- Added role="alert" and aria-live="polite" to form error messages in LoginPage, LandingPage, and AdminManageUsers
- Added prefers-reduced-motion media query to FloatingOptiBot.css
- Created useFocusTrap hook and applied to LoginModal for keyboard navigation trapping

### Power Admin Features
- New `AdminBackup` page (`/admin/backup`): queue full/schema/data/manual backup jobs, view recent job history with status, size, and downloads
- New `AdminOverride` page (`/admin/override`): activate/deactivate emergency overrides (rate limit, idle timeout, approval bypass, maintenance mode, custom) with required reason and TTL; full audit trail
- New `AdminFeatureFlags` page (`/admin/flags`): list, toggle, retarget audience, set rollout percentage, and create new flags; read-only for non-Power admins
- New SQL migration `create_power_admin_features.sql`: `backup_jobs`, `emergency_overrides`, `feature_flags` tables with RLS restricting writes to power_admin/system_admin and seeded with default flags

## Session 4 — UI Consistency & Shared States
- Created shared UI primitives: `EmptyState`, `LoadingState`, `ErrorState`, `ConfirmDialog` in `web/src/components/states/`
- Added form-field rhythm CSS classes (`.field`, `.field-label`, `.field-help`, `.field-error`) to index.css
- Standardized main-content padding across Layout using `var(--space-8) var(--space-6)`
- Added print stylesheet (`web/src/styles/print.css`) for clean printed output of schedules, logs, and reports
- Added error boundary CSS with friendly fallback UI styling

## Session 5 — Storage
- New SQL migration `create_performance_indexes.sql`: added indexes for activity_logs, audit_logs, schedules, sections, assignments, change_requests, conflicts, sessions, emergency_overrides, backup_jobs, user_activity, announcements, and comments tables
- New SQL migration `create_retention_policy.sql`: created `activity_logs_archive` table and `archive_old_logs()` function for 365-day retention
- New SQL migration `create_client_error_logs.sql`: created `client_error_logs` table with RLS and `report_client_error()` RPC for error tracking
- New documentation `docs/sql_workflow.md`: established SQL discipline, naming conventions, idempotent patterns, and roll-forward process

## Session 6 — Robustness
- Created `RouteErrorBoundary` component for catching and displaying route-level errors with reload/report actions
- Toast system already existed in `ToastContext.tsx` with success/error/warning/info variants and action buttons
- Created `utils/datetime.ts` with `formatInSchoolTz()` helper for consistent timezone-aware formatting

## Session 7 — Observability
- New `HealthPage` at `/admin/health`: real-time system health checks for database, storage, error rate, and backup age; auto-refreshes every 30s; restricted to Power Admin/System Admin
- Wired up HealthPage in App.tsx to replace Analytics placeholder
- Client error logging infrastructure ready via `client_error_logs` table and RPC
- Route-level code splitting: converted all page imports to `lazy()` for improved initial load performance
- Added `Suspense` fallbacks with loading indicators for lazy-loaded routes

## Session 8 — Documentation
- New `docs/ROLE_MATRIX.md`: comprehensive capability matrix defining permissions for all user roles
- New `docs/RELEASE_RUNBOOK.md`: release process including pre-release checklist, deployment steps, and rollback procedures
- New `docs/sql_workflow.md`: established SQL discipline with naming conventions, idempotent patterns, and roll-forward process
