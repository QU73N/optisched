# Database Migrations

This directory contains SQL migration files for OptiSched. Run them in numerical order.

## Migration Order

### Root Directory (New Migrations)

Run these after the base schema from `migrated/000_migration.sql`:

1. **001_create_power_admin_features.sql** - Power Admin features (backup_jobs, emergency_overrides, feature_flags tables)
2. **002_create_client_error_logs.sql** - Client error logging table and RPC
3. **003_create_performance_indexes.sql** - Performance indexes for hot-path queries
4. **004_create_retention_policy.sql** - Retention policy and archive tables

### Migrated Directory (Base Schema & Features)

Run these in order for a fresh installation:

0. **000_migration.sql** - Base schema (profiles, teachers, rooms, subjects, sections, schedules, conflicts)
1. **001_create_system_rules_and_rbac.sql** - System rules table and RBAC foundation
2. **002_create_governance_v2.sql** - Governance v2 (user_activity_logs, user_permission_overrides, role hierarchy)
3. **003_create_self_role_change_guard.sql** - Prevent users from changing their own role
4. **004_create_rpc_permission_guard.sql** - Server-side permission guard for RPCs
5. **005_create_session_idle_rules.sql** - Per-role idle timeout configuration
6. **006_create_announcements.sql** - Announcements table
7. **007_create_analytics_history.sql** - Analytics history tracking
8. **008_create_schedule_change_requests.sql** - Schedule change request workflow
9. **009_create_features_tables.sql** - Additional feature tables
10. **010_fix_request_rls.sql** - RLS policy fixes for requests
11. **011_create_audit_tamper_evidence.sql** - Audit log tamper-evidence with hash chain verification
12. **012_create_rate_limits.sql** - Rate limiting for sensitive operations
13. **013_seed_users.sql** - Seed initial users
14. **014_seed_real_data.sql** - Seed real test data

### Utility Scripts (Not Migrations)

- `create_all_users.mjs` - Script to create all users
- `create_morgado.mjs` - Script for specific user creation
- `create_users.js` - Legacy user creation script
- `create_users.mjs` - User creation script
- `999_migration_copy.sql` - Backup copy of original migration

## Running Migrations

### For Fresh Installation

Run files in order from `migrated/000_migration.sql` through `migrated/014_seed_real_data.sql`, then run the root directory migrations `001` through `005`.

### For Existing Database

Only run migrations that haven't been applied yet. Check which migrations have been applied by comparing with your current schema.

## SQL Workflow Discipline

Per `docs/sql_workflow.md`:
- Never edit existing SQL migration files
- Create new files for schema changes
- Use naming convention: `YYYYMMDD_description.sql` or `NNN_description.sql` for numbered order
- All migrations should be idempotent (safe to run multiple times)
