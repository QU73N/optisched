# Role Capability Matrix

This document defines the capabilities and permissions for each user role in OptiSched, aligned with the PRD (Product Requirements Document v1.2).

## Roles

| # | Role | Domain | Description |
|---|------|--------|-------------|
| 1 | **Power Admin** | Security & recovery | Emergency-only system authority. Full override, audit log access, can impersonate. Inherits every System Admin power. |
| 2 | **System Admin** | Access governance & system health | Creates accounts, monitors system, configures the Permission Rules Engine that shapes what every other role can see or do. Does not approve or edit schedules. |
| 3 | **Schedule Admin** | Approval & review | Reviews Schedule Manager output, approves or rejects schedules, can edit any schedule, can lock versions. Cannot manage users or system rules. |
| 4 | **Schedule Manager** | Schedule construction | Builds and manages teachers, rooms, subjects, sections, teacher roles. Generates schedules, edits manually, submits for approval (or publishes directly if Rules Engine allows). |
| 5 | **Teacher** | Personal operations | Views own approved schedule, workload stats, submits schedule change requests, messages admins. Can optionally hold additional roles (Schedule Manager or Schedule Admin). |
| 6 | **Student** | View-only | Views own and section-level approved schedules, upcoming classes, breaks, announcements. No multi-role. |

## Role Rank Hierarchy

| Rank | Role | Headcount | Purpose |
|:---:|------|-----------|---------|
| 6 | Power Admin | 1 (system developer) | Last-resort recovery, vendor support, emergency override |
| 5 | System Admin | 1–3 institutional IT/Registrar | Account governance, system rules, troubleshooting |
| 4 | Schedule Admin | 1–4 academic deans/heads | Approval authority for schedules |
| 3 | Schedule Manager | 3–10 program coordinators | Schedule construction |
| 2 | Teacher | 30+ | Personal operations |
| 1 | Student | 500+ | View-only |

**Authority rule:** A user can only modify another user whose rank is *strictly lower*. Equal-rank users cannot edit each other. No user can edit themselves administratively (only personal Settings).

## Multi-Role Support

- A **Teacher** may additionally hold `schedule_manager` and/or `schedule_admin` role (can hold all three simultaneously).
- A **Schedule Manager** may additionally hold `schedule_admin` role (and teacher role if applicable).
- A **Schedule Admin** may additionally hold `schedule_manager` role (and teacher role if applicable).
- When a user has multiple roles, clicking the role badge in the UI opens a role selector panel to switch between roles. The sidebar tabs update based on the selected role.
- **Students** cannot have additional roles (student only).
- **Power Admin** and **System Admin** cannot have additional roles (single primary role only for security reasons).

## Tab Access Matrix

Legend: ● = full access · ◐ = view-only · — = no access

| Tab / Feature | Power Admin | System Admin | Schedule Admin | Schedule Manager | Teacher | Student |
|---------------|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard | ● | ● | ● | ● | ● | ● |
| Audit Logs | ● | — | — | — | — | — |
| System Rules (Engine) | ● | ● | — | — | — | — |
| Users (CRUD) | ● | ● | — | — | — | — |
| System Health | ● | ● | — | — | — | — |
| Approvals | ● | — | ● | — | — | — |
| Schedules (edit) | ● | ◐ | ● | ● own drafts | own | section+own |
| Data (teachers/rooms/subjects/sections) | ● | ◐ | ◐ | ● | — | — |
| Generate | ● | — | — | ● | — | — |
| Conflicts | ● | ◐ | ● | ● | — | — |
| Faculty Load | ● | ◐ | ◐ | ● | own | — |
| Change Requests (inbox) | ● | — | ● | — | — | — |
| My Requests | — | — | — | — | ● | — |
| Preferences | — | — | — | — | ● | — |
| Announcements (post) | ● | ● | ● | — | — | — |
| Announcements (view) | ● | ● | ● | ● | ● | ● |
| Messages | ● | ● | ● | ● | ● | — |
| Tasks | ● | ● | — | — | — | — |
| OptiBot (AI) | ● | ● | ● | ● | ● | ● |
| Settings | ● | ● | ● | ● | ● | ● |

## Capability Matrix

| Capability | Power Admin | System Admin | Schedule Admin | Schedule Manager | Teacher | Student |
|------------|:---:|:---:|:---:|:---:|:---:|:---:|
| **Scheduling** |
| View own schedule | ● | ● | ● | ● | ● | ● |
| View all schedules | ● | ● | ● | ● | — | — |
| Edit all schedules | ● | — | ● | ● own drafts | own | section+own |
| Generate schedules | ● | — | — | ● | — | — |
| Approve/reject schedules | ● | — | ● | — | — | — |
| Resolve conflicts | ● | — | ● | ● | — | — |
| View conflicts | ● | ● | ● | ● | — | — |
| **User Management** |
| View user list | ● | ● | — | — | — | — |
| Create users | ● | ● | — | — | — | — |
| Edit users | ● | ● | — | — | — | — |
| Deactivate users | ● | ● | — | — | — | — |
| Assign roles | ● | ● | — | — | — | — |
| Impersonate users | ● | — | — | — | — | — |
| **System Administration** |
| View audit logs | ● | — | — | — | — | — |
| View user activity logs | ● | ● | — | — | — | — |
| Manage sessions | ● | ● | — | — | — | — |
| View system health | ● | ● | — | — | — | — |
| Manage system rules | ● | ● | — | — | — | — |
| Configure permission rules | ● | ● | — | — | — | — |
| **Data Management** |
| View all teachers/rooms/subjects/sections | ● | ● | ◐ | ● | — | — |
| Create teachers/rooms/subjects/sections | ● | — | — | ● | — | — |
| Edit teachers/rooms/subjects/sections | ● | — | — | ● own | — | — |
| Delete teachers/rooms/subjects/sections | ● | — | — | ● own | — | — |
| Share resources | ● | — | — | ● | — | — |
| Export data | ● | ● | ◐ | ● | — | — |
| Import data | ● | — | — | ● | — | — |
| **Faculty Management** |
| View faculty load | ● | ● | ◐ | ● | own | — |
| Assign departments | ● | — | — | — | — | — |
| Manage teacher preferences | ● | — | — | — | own | — |
| **Communication** |
| View announcements | ● | ● | ● | ● | ● | ● |
| Create announcements | ● | ● | ● | — | — | — |
| View messages | ● | ● | ● | ● | ● | — |
| Send messages | ● | ● | ● | ● | ● | — |
| Teacher-to-teacher chat | ● | ● | ● | ● | ● | — |
| Group chats | ● | ● | ● | ● | ● | — |
| **AI Features** |
| OptiBot access | ● | ● | ● | ● | ● | ● |
| AI schedule assistance | ● | ● | ● | ● | — | — |
| **Security & Recovery** |
| Emergency overrides | ● | — | — | — | — | — |
| Manage backups | ● | ● | — | — | — | — |
| Manage feature flags | ● | ● | — | — | — | — |
| Force password reset | ● | ● | — | — | — | — |

## Permission Rules Engine

System Admins configure runtime permission rules stored in a `system_rules` table. Example rules:
- `teachers_can_see_student_schedules` : boolean
- `schedule_managers_can_create_without_approval` : boolean (if `true`, managers can create and publish schedules without approval)
- `schedule_managers_can_edit_without_approval` : boolean (if `true`, managers can edit published schedules without re-approval)
- `schedule_managers_access_all_data` : boolean (if `true`, managers access all data; if `false`, only their assigned department data)
- `students_can_see_teacher_names` : boolean
- `teachers_can_message_admins` : boolean
- `per_user_overrides` : JSONB keyed by user ID for granular overrides

All dashboards and data queries must consult the Rules Engine before rendering or fetching sensitive cross-role data. Rules Engine changes are audit-logged.

## Three-Tier Permission Overrides

Lookup precedence (most-specific wins):
1. **Per-user override** (`user_permission_overrides` table)
2. **Role override** (`system_rules.role_overrides` JSONB)
3. **Global rule** (`system_rules.rule_value`)
4. **Hardcoded default** (in `usePermissions` fallback)

## Notes

- **Row-Level Security (RLS)**: Database policies enforce role-based access at the data layer. Frontend role gating is cosmetic only; backend RLS is the source of truth.
- **Audit trail**: All privileged actions are logged in `audit_logs` (Power Admin only) and `user_activity_logs` (all users).
- **Rate limiting**: Sensitive operations (login, schedule generation, bulk imports) are throttled.
- **Session timeout**: Per-role configurable idle timeouts.
- **Power Admin self-protection**: Cannot change own role, cannot be deactivated, cannot be deleted through UI.
