# OptiSched Security Posture

## Overview

This document describes the security measures implemented in OptiSched to protect data, prevent unauthorized access, and ensure compliance with security best practices.

## Database Security

### Row-Level Security (RLS)

All tables in the database have Row-Level Security enabled. Policies are defined to ensure:

- **Public tables** (teachers, subjects, rooms, sections): Public records are viewable by everyone, owned records by owners, shared records by shared users
- **Schedule tables**: Published schedules are viewable by everyone, draft/owned schedules by creators, admin functions by authorized roles
- **Admin tables**: Restricted to Power Admin, System Admin, and Schedule Admin roles

### SECURITY DEFINER Functions

All SECURITY DEFINER functions have `SET search_path = public` to prevent SQL injection via search path manipulation.

### Function Permissions

- **Anon role**: Can only execute authentication-related functions (current_user_role, get_user_role, handle_new_user, rate_limit_login, rate_limit_password_reset)
- **Authenticated role**: Can execute business logic functions (permission checks happen inside functions)
- **Service role**: Can execute maintenance functions (archive_old_logs, cleanup_expired_notifications, etc.)

### Audit Logs

Audit logs are append-only with tamper-evidence triggers. Direct modification or deletion is prevented even by Power Admin.

## Authentication

### Password Hashing

**Status**: Supabase Auth uses Argon2id for password hashing (industry standard, memory-hard algorithm)

**Configuration**: This is handled by Supabase Auth service, not in the database schema. Passwords are never stored in plain text.

**Action Required**: Enable "Leaked password protection" in Supabase Dashboard:
1. Go to Supabase Dashboard → Authentication → Policies
2. Enable "Leaked password protection"
3. This checks passwords against HaveIBeenPwned.org on registration and password changes

### Session Management

- JWT tokens issued by Supabase Auth
- Token expiry configured in Supabase Auth settings
- Role information embedded in JWT claims
- Session timeout: Configurable per role rank (default: Power Admin 15min, Admins 30min, others 60min)

## Access Control

### Role Hierarchy

OptiSched uses a hierarchical role system with numeric ranks:

| Rank | Role | Authority |
|------|------|-----------|
| 100 | power_admin | Full system access, emergency recovery |
| 90 | super_admin | System administration (legacy, mapped to power_admin) |
| 80 | schedule_admin | Schedule approval and editing |
| 70 | admin | General administration (legacy) |
| 50 | teacher | Personal operations, can hold additional roles |
| 30 | student | View-only access |

### Permission Rules Engine

Runtime-configurable permission rules stored in `system_rules` table:
- `teachers_can_see_student_schedules`: boolean
- `schedule_managers_can_create_without_approval`: boolean
- `schedule_managers_can_edit_without_approval`: boolean
- `schedule_managers_access_all_data`: boolean
- `students_can_see_teacher_names`: boolean
- `teachers_can_message_admins`: boolean
- `per_user_overrides`: JSONB for granular user-specific permissions

### Three-Tier Permission Overrides

Lookup precedence (most-specific wins):
1. Per-user override (`user_permission_overrides` table)
2. Role override (`system_rules.role_overrides` JSONB)
3. Global rule (`system_rules.rule_value`)
4. Hardcoded default (in `usePermissions` fallback)

## Data Protection

### Secrets Management

- All secrets (API keys, database credentials) stored server-side
- Environment variables used for configuration
- No secrets exposed to client-side code
- Supabase anon/public keys are safe to expose (they have RLS restrictions)

### Transport Security

- HTTPS required in production
- Supabase provides SSL/TLS encryption
- All API calls use secure endpoints

### PII Redaction

- Passwords never logged
- Emails redacted in activity logs (j***@domain)
- Full email addresses only in profiles table (protected by RLS)

## Storage Security

### Avatars Bucket

- Direct file access allowed (needed for avatar display)
- Listing disabled (prevents enumeration of all files)
- Users can only upload to their own folder
- Admins can delete any avatar

### File Access Pattern

- Files stored in user-specific folders: `avatars/{user_id}/{filename}`
- Public read allowed for direct file access
- No wildcard access (prevents listing)

## Rate Limiting

Rate limiting implemented for:
- Login attempts: 5 attempts per 15 minutes per IP
- Password reset: 3 attempts per hour per email
- API requests: Configurable per endpoint
- Schedule generation: 3 per hour per user

## Audit and Logging

### Activity Logs

- User actions logged in `user_activity_logs` table
- Includes: action_type, resource, resource_id, success, error_message, duration_ms
- Retention: 90 days (then archived)
- Accessible to Power Admin only

### Audit Logs

- Privileged actions logged in `audit_logs` table
- Append-only (tamper-evident)
- Includes: action, target_table, target_id, details, performed_by
- Retention: 730 days (2 years)
- Accessible to Power Admin only
- Hash chain for integrity verification

### Client Error Logs

- Frontend errors logged to `client_errors` table
- Includes: URL, message, stack, user_agent, component_stack, metadata
- Accessible to Power Admin only
- Used for debugging and monitoring

## Threat Model

### Mitigated Threats

1. **SQL Injection**: search_path set to public on all SECURITY DEFINER functions
2. **Privilege Escalation**: Role-based RLS, rank-based restrictions, Power Admin lockout protection
3. **Data Enumeration**: Storage listing disabled, RLS prevents unauthorized data access
4. **Credential Stuffing**: Rate limiting on login, leaked password protection
5. **Session Hijacking**: JWT tokens, HTTPS, session timeout
6. **Audit Tampering**: Append-only audit logs with tamper-evidence triggers

### Remaining Considerations

1. **Social Engineering**: User education needed for phishing awareness
2. **Insider Threat**: Audit logs detect suspicious admin activity
3. **DDoS**: Supabase provides DDoS protection at infrastructure level
4. **Zero-Day Vulnerabilities**: Keep dependencies updated, monitor security advisories

## Compliance

### Data Retention

- Activity logs: 90 days (archived after)
- Audit logs: 730 days (2 years)
- Schedule versions: Retained indefinitely (version history)
- Soft-deleted records: 30 days then permanently deleted

### GDPR Considerations

- Right to access: Users can view their own data via dashboards
- Right to deletion: Soft-delete implemented, hard-delete after 30 days
- Right to rectification: Users can edit their preferences
- Data portability: Export functionality available

## Incident Response

### Security Incident Procedure

1. Detection: Audit logs, client error logs, monitoring alerts
2. Containment: Lock affected accounts, revoke sessions
3. Investigation: Audit log analysis, hash chain verification
4. Recovery: Restore from backups if needed, rotate credentials
5. Post-mortem: Document incident, update policies

### Power Admin Recovery

If Power Admin loses access:
1. Use service-account credential (kept in cold storage by vendor)
2. Direct database access to restore access
3. Document and audit-log the recovery action
4. Rotate to new Power Admin credential

## Deployment Checklist

- [ ] Enable "Leaked password protection" in Supabase Auth (SKIPPED - presentation deployment)
- [ ] Configure JWT expiry in Supabase Auth
- [ ] Set up session timeout per role rank
- [ ] Verify RLS policies are active on all tables ✅
- [ ] Verify SECURITY DEFINER functions have search_path = public ✅
- [ ] Verify anon cannot execute sensitive functions ✅
- [ ] Verify storage policies disable listing
- [ ] Test rate limiting endpoints
- [ ] Test audit log tamper-evidence
- [ ] Configure backup schedule
- [ ] Set up monitoring alerts
- [ ] Document emergency contact procedures

## References

- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [PRD Security Requirements](docs/PRD.md#21-security-requirements)
- [Hardening Plan](docs/HARDENING_PLAN.md#C-security-rbac-hardening-p0)
