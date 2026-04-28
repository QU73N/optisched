# OptiSched Product Requirements Document

## Document Information

- **Product Name:** OptiSched
- **Document Version:** 1.2
- **Last Updated:** April 28, 2026
- **Status:** Draft (Board Review Ready)

### Changelog
- **1.2 (2026-04-28):** Finalized comprehensive tab structure per role with grouped sidebar sections. Added role-rank hierarchy enforcement, user activity logging, three-tier permission overrides (global → role → per-user), lockout-proof Power Admin design, and board-defensible rationale for each governance decision.
- **1.1 (2026-04-28):** Expanded roles from 5 to 6 (split "Administrator" into System Admin and Schedule Admin). Added Permission Rules Engine concept. Added tab matrix and per-role dashboard content specifications. Added role-data-access table.

---

## 1. Product Summary

OptiSched is an academic scheduling platform designed for institutions that use fixed block scheduling for Senior High School and College. It centralizes schedule generation, manual editing, approval, publishing, viewing, and future expansion into mobile and multi-branch support. The system is presentation-ready now, but it must also be structured so it can scale into a real deployment later.

The product has two major entry points:
1. A landing page that introduces the system with polished motion, modern visuals, and a professional academic tone
2. An authenticated dashboard experience, where users are routed based on role after logging in

---

## 2. Product Vision

The vision is to replace manual and spreadsheet-based schedule building with a structured, intelligent, and collaborative system. The platform should:
- Reduce schedule conflicts
- Help managers work efficiently
- Protect data through versioning and approval
- Give teachers and students clean schedule access

The product should feel like a serious institutional tool, not a toy. It should look modern and creative, but still match academic use. Motion is important, but it must remain refined and professional.

---

## 3. Target Users

OptiSched supports **6 distinct roles**. Roles are hierarchical in trust level but not all roles share the same domain of authority.

| # | Role | Domain | Description |
|---|------|--------|-------------|
| 1 | **Power Admin** | Security & recovery | Emergency-only system authority. Full override, audit log access, can impersonate. Inherits every System Admin power. |
| 2 | **System Admin** | Access governance & system health | Creates accounts, monitors system, configures the **Permission Rules Engine** that shapes what every other role can see or do. Does not approve or edit schedules. |
| 3 | **Schedule Admin** | Approval & review | Reviews Schedule Manager output, approves or rejects schedules, can edit any schedule, can lock versions. Cannot manage users or system rules. |
| 4 | **Schedule Manager** | Schedule construction | Builds and manages teachers, rooms, subjects, sections, teacher roles. Generates schedules, edits manually, submits for approval (or publishes directly if Rules Engine allows). |
| 5 | **Teacher** | Personal operations | Views own approved schedule, workload stats, submits schedule change requests, messages admins. Can optionally hold additional roles (Schedule Manager or Schedule Admin). |
| 6 | **Student** | View-only | Views own and section-level approved schedules, upcoming classes, breaks, announcements. No multi-role. |

### 3.1 Multi-Role Support
- A **Teacher** may additionally hold `schedule_manager` or `schedule_admin` role. When this happens, the sidebar exposes the extra tabs, but their primary dashboard remains the Teacher dashboard unless they navigate explicitly.
- **Students** cannot have additional roles.
- **Admin-tier roles** (Power Admin, System Admin, Schedule Admin, Schedule Manager) cannot be added on top of each other; each is a single primary role.

### 3.2 Permission Rules Engine
System Admins configure runtime permission rules stored in a `system_rules` table. Example rules:
- `teachers_can_see_student_schedules` : boolean
- `schedule_managers_require_approval` : boolean (if `false`, managers may publish directly)
- `students_can_see_teacher_names` : boolean
- `teachers_can_message_admins` : boolean
- `per_user_overrides` : JSONB keyed by user ID for granular overrides

All dashboards and data queries must consult the Rules Engine before rendering or fetching sensitive cross-role data. Rules Engine changes are audit-logged.

---

## 4. Core Product Flow

1. A visitor lands on the OptiSched landing page
2. The landing page presents the product clearly, with animations that feel polished, calm, and academic
3. The user clicks the login tab or button
4. The user logs in
5. The system checks the user's role
6. The system sends the user to the correct dashboard
7. Schedule Managers create data, generate schedules, preview results, edit conflicts, and submit schedules
8. Administrators review, approve, or edit schedules
9. Approved schedules are distributed to teachers and students
10. Version history and audit logs preserve every important action

---

## 5. Landing Page Requirements

### 5.1 Visual Design
- Must be the most visually creative part of the system, but still look serious and credible
- Should feel like a modern enterprise academic platform
- Should use motion well, but not overload the user
- Should not feel cartoonish or playful in a childish way
- Animations should feel smooth, premium, and intentional

### 5.2 Content Structure
- Strong hero section
- Short explanation of what OptiSched does
- Feature highlights
- Visible login path
- Demonstration of scheduling complexity, collaboration, approval, AI assistance, and role-based access

### 5.3 User Experience
- Login tab should be easy to find
- Should transition cleanly into the authenticated experience
- Support both light mode and dark mode (light mode as default)

### 5.4 Color Palette
Blue academic family with colors like:
- `#0F2854`
- `#1C4D8D`
- `#4988C4`
- `#BDE8F5`

(Slight adjustments allowed for design refinement)

---

## 6. Roles and Permissions

### 6.1 Power Admin
- Full access to everything System Admin can do, plus:
- Can override or unlock any schedule regardless of approval state
- Can inspect full audit logs
- Can impersonate (with logging) for debugging
- Can recover locked systems, reset credentials in emergencies
- Intended for security incidents only — not routine use

### 6.2 System Admin
- Can create, edit, deactivate user accounts
- Configures the Permission Rules Engine (§3.2)
- Monitors system health (uptime, DB health, active sessions)
- Posts broadcast announcements
- Cannot approve or edit schedules
- Cannot access Power Admin audit overrides

### 6.3 Schedule Admin
- Reviews schedules submitted by Schedule Managers
- Approves, rejects, or edits schedules before publication
- Locks/unlocks schedule versions
- Cannot manage users or Rules Engine
- Receives Teacher schedule change requests and resolves them

### 6.4 Schedule Manager
- Creates and manages teachers, rooms, subjects, sections, teacher roles
- Generates schedules (full or partial regeneration)
- Manually edits draft schedules
- Submits for approval (or publishes directly if Rules Engine allows)
- Shares elements; marks public/private
- Cannot approve own output unless Rules Engine grants direct-publish

### 6.5 Teachers
- Views only their own approved schedules
- Views personal workload stats (weekly hours, utilization vs max)
- Submits schedule change requests to Schedule Admin
- Messages admins (if Rules Engine allows)
- Updates teaching preferences
- May hold additional `schedule_manager` or `schedule_admin` role

### 6.6 Students
- Views own and assigned-section approved schedules
- Views upcoming classes, breaks, announcements
- Cannot edit anything
- Cannot hold additional roles

### 6.7 Approval Authority
- Only Schedule Admin and Power Admin can finalize schedules
- System Admin has no approval power (separation of concerns)

### 6.8 Tab Access Matrix

Legend: ● = full access · ◐ = view-only · — = no access

| Tab / Feature          | Power Admin | System Admin | Schedule Admin | Schedule Manager | Teacher | Student |
|------------------------|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard              | ● | ● | ● | ● | ● | ● |
| Audit Logs             | ● | — | — | — | — | — |
| System Rules (Engine)  | ● | ● | — | — | — | — |
| Users (CRUD)           | ● | ● | — | — | — | — |
| System Health          | ● | ● | — | — | — | — |
| Approvals              | ● | — | ● | — | — | — |
| Schedules (edit)       | ● | ◐ | ● | ● own drafts | own | section+own |
| Data (teachers/rooms/subjects/sections) | ● | ◐ | ◐ | ● | — | — |
| Generate               | ● | — | — | ● | — | — |
| Conflicts              | ● | ◐ | ● | ● | — | — |
| Faculty Load           | ● | ◐ | ◐ | ● | own | — |
| Change Requests (inbox)| ● | — | ● | — | — | — |
| My Requests            | — | — | — | — | ● | — |
| Preferences            | — | — | — | — | ● | — |
| Announcements (post)   | ● | ● | ● | — | — | — |
| Announcements (view)   | ● | ● | ● | ● | ● | ● |
| Messages               | ● | ● | ● | ● | ● | — |
| Tasks                  | ● | ● | — | — | — | — |
| OptiBot (AI)           | ● | ● | ● | ● | ● | ● |
| Settings               | ● | ● | ● | ● | ● | ● |

---

## 7. Academic Structure

### 7.1 Institution Model
- Supports one institution per deployment for now
- Architecture must be easy to expand later for multi-branch or multi-institution use
- Scheduling model based on fixed blocks
- Supports Senior High School and College inside the same institution
- Does not manage yearly school calendars
- Focuses only on weekly schedules

### 7.2 Section Hierarchy
- Sections are arranged in a hierarchical grouping structure (similar to folders)
- A parent node can contain groups and sections
- Example structure: STI College → SHS and College → Grade 11 and Grade 12 → Program groups (STEM 11, ABM 11)
- Each node in the hierarchy can have a weight or priority
- Weight influences scheduling priority and optimization
- Hierarchy must be visible and editable in the interface

---

## 8. Teacher Management

### 8.1 Availability
- Teacher availability is not gathered inside OptiSched itself
- Schedule Managers collect availability outside the system through personal communication, institutional forms, or other methods
- Managers input availability into OptiSched
- **Hard constraint:** Teachers must never be assigned outside their availability

### 8.2 Teacher Roles
- Each teacher can have one role only
- Teacher role defines:
  - Max hours per day
  - Max hours per week
  - Load rules
- Supports deloading, especially for teachers who are also administrators

### 8.3 Faculty Load Calculation
- System must calculate faculty load automatically
- System should show whether a teacher is:
  - Overloaded
  - Underloaded
  - Within target range

### 8.4 Teaching Constraints
- **Hard constraint:** Must enforce maximum consecutive teaching hours per day
- **Soft constraint:** Should try to spread teacher load evenly throughout the week

---

## 9. Subject Management

### 9.1 Subject Properties
- Subjects are core scheduling elements
- Each subject can have multiple qualified teachers, but only one teacher is used per session
- System does not handle substitute teacher assignment

### 9.2 Hours and Sessions
- Subjects can have required weekly hours
- Subjects can support split sessions
- Preferred split (when applicable): 1 hour 30 minutes per part
- Schedule Managers must be able to manually adjust required hours per week or per month

### 9.3 Subject Types
- Standard lecture subjects
- Special subjects (have special room requirements)

### 9.4 Subject Metadata
- Duration preferences
- Room compatibility
- Teacher qualification mapping

---

## 10. Room Management

### 10.1 Room Types
- **Common rooms:** Rooms wherein any subject can be taught. These are general-purpose classrooms without specialized equipment.
- **Special rooms:** Rooms that have equipment a specific subject needs (e.g., computer labs, science labs, studios, workshops). These are reserved preferentially for subjects that require them.
- **Hard constraint:** Special subjects (subjects with `requires_lab = true` or marked as requiring special equipment) can only be assigned to special rooms.
- **Soft constraint:** Special rooms are less likely to be used by common subjects (subjects that don't need special rooms). This maximizes room availability for subjects that actually require the specialized equipment.
- When conflicts exist, the scheduler prioritizes special subjects for special rooms, leaving common rooms available for general use.

### 10.2 Room Constraints
- **Hard constraint:** Room capacity must always be greater than or equal to section size
- **Hard constraint:** Only one section may occupy a room during a given session

### 10.3 Room Details
- Building
- Floor
- Room number
- Capacity
- These details are needed for soft constraint optimization (room movement and walking distance)

### 10.4 Room Optimization
- **Soft optimization goal:** Attempt to minimize unnecessary movement between buildings and floors

---

## 11. Section Management

### 11.1 Section Properties
- Sections represent fixed student groups
- Students belong to one section
- System does not support many sections in one room or one shared class slot
- Each section has its own schedule
- Section size must be stored (for room capacity checking)

### 11.2 Section Hierarchy
- Sections can be grouped into a folder-style hierarchy with weights
- Weights help the generator decide which section group to prioritize first when conflicts exist
- Hierarchy should support compact, nested groups for college and senior high structure
- Interface should let schedule managers expand and collapse groups

---

## 12. Schedule Generation

### 12.1 Generator Requirements
- Must generate conflict-free weekly schedules
- Must respect:
  - Teacher availability
  - Room capacity
  - Room compatibility
  - Section overlap rules
  - Teacher role limits
  - Subject hours
  - Break times

### 12.2 Scheduling Models
- Support fixed and block scheduling
- Support split sessions
- Allow managers to define or adjust class durations and session structure
- Support institutional free periods
- Support custom break times
  - Breaks may be shared across all sections or arranged differently
  - Break lengths must be customizable
  - Breaks can be turned on or off based on institutional rules

### 12.3 Generation Modes
- Full generation
- Partial regeneration (when only one section, teacher, room, or subject changes)

### 12.4 Workflow States
- Draft generation
- Manager review
- Submission
- Administrator approval

---

## 13. Constraints

### 13.1 Hard Constraints (Must Never Be Violated)
- No teacher overlap
- No room overlap
- No section overlap
- Room capacity compliance
- Subject-hour completion
- Room-subject compatibility
- Teacher qualification enforcement
- Teacher load requirement according to role
- Teacher availability enforcement
- Maximum consecutive hours per day
- Maximum daily teaching hours
- Break enforcement when enabled
- Single teacher per session
- Single room per session
- Fixed-time enforcement
- Locked schedule enforcement
- Hierarchy integrity
- Active version integrity

### 13.2 Soft Constraints (Optimization Goals)
- Teacher preferences
- Time-of-day preferences
- Compact schedules
- Reduced idle gaps
- Balanced daily loads
- Room utilization efficiency
- Fair teacher workload distribution
- Priority weighting
- Special room priority bias
- Minimized room switching
- Minimized teacher room switching
- Consistent subject spacing
- Preferred sequencing
- Even distribution across hierarchy
- Soft load smoothing
- Late-day minimization
- Early-day minimization

### 13.3 Priority System
- Priority weighting should be configurable
- System should be able to rank sections, groups, subjects, teachers, or other elements by importance
- Recommended: Normalized scoring system (0 to 100 scale) or weighted multiplier system
- Section hierarchy weights should influence scheduling priority
- Special room pressure should influence scheduling priority
- Generator should attempt to schedule higher-priority items first whenever possible

---

## 14. Collaboration and Sharing

### 14.1 Sharing Features
- Schedule Managers must be able to collaborate
- Should be able to share teachers, rooms, sections, and subjects with one another
- Should be able to mark shared elements public or private
- Public elements can be reused across schedule manager workspaces
- Private elements remain visible only to the manager or team allowed to see them

### 14.2 Versioning
- Versioning is required
- Every important edit or generation step should be trackable
- Managers should be able to:
  - Compare versions
  - Roll back versions
  - Review change history
- Protects against accidental overwrites and makes collaboration safer

---

## 15. Approval Workflow

### 15.1 Workflow States
- Draft
- Submitted
- Approved
- Published
- Locked

### 15.2 Workflow Steps
1. Schedule Managers generate schedules
2. Administrators review them
3. Administrators approve them before they reach users
4. Users only receive schedules after approval
5. Power Admin can intervene in emergencies

### 15.3 Logging
- Every state transition should be logged

---

## 16. AI Features

### 16.1 AI Capabilities

**For Teachers and Students:**
- Answer schedule questions (today's schedule, next class, break time, room location)

**For Schedule Managers:**
- Help create records
- Interpret natural language instructions

### 16.2 AI Constraints
- AI must not bypass hard constraints
- AI must not write directly to the database without validation and permission checks

### 16.3 AI Architecture
- AI should be able to run locally during development to reduce cost
- AI should be swappable to cloud AI later without changing the entire app
- AI should be wrapped in a provider layer so the system can use local or cloud models through the same interface

---

## 17. Notifications

### 17.1 Notification Triggers
- Teachers and students should receive notifications after schedule approval or change
- Notifications should be tied only to the relevant user

### 17.2 Future Support
- Should support future mobile notifications
- Offline access support should be planned for the app
- In-app notifications should be part of the initial design even if push notifications are added later

---

## 18. Dashboard Experience

There are **6 dedicated dashboards**, one per role. Each dashboard only queries and renders data its role is allowed to see. Every stat and graph must be **accurate** (reflect real DB state) and **professionally presented** (consistent typography hierarchy, calm color palette, clear empty states, accessible labels).

### 18.1 Power Admin Dashboard
- **Stats:** Total users (all roles), active sessions, DB health indicator, unresolved critical conflicts, pending approvals across system, failed logins (24h), audit events (24h)
- **Graphs:** System activity trend (7d), user role distribution (donut), audit event volume trend (14d)
- **Lists:** Recent audit log entries, active incidents, recent Power Admin actions, impersonation history
- **Actions:** Emergency override panel, unlock schedule, impersonate user, force password reset

### 18.2 System Admin Dashboard
- **Stats:** Total users by role, new signups (7d), pending password reset requests, unread messages, rules engine changes (7d)
- **Graphs:** User role distribution (donut), signup trend (30d), system uptime/activity (7d)
- **Lists:** Recent user registrations, pending password resets, unread system messages, recent rules engine changes
- **Actions:** Create user, edit system rules, broadcast announcement, resolve password reset

### 18.3 Schedule Admin Dashboard
- **Stats:** Pending approvals, published schedules this term, open conflicts in submitted schedules, teacher change requests pending
- **Graphs:** Approval funnel last 30 days (submitted/approved/rejected), conflicts trend (14d) filtered to submitted+published only, room load (top 8)
- **Lists:** Schedules awaiting approval (sorted by submission date), teacher schedule change requests, recent approval decisions
- **Actions:** Approve, reject, edit, post announcement, resolve change request

### 18.4 Schedule Manager Dashboard
- **Stats:** My drafts, my submitted (awaiting approval), my approved (last 7d), conflicts in my drafts, teachers/rooms/sections/subjects totals
- **Graphs:** My draft conflicts by type, teacher load balance (from my drafts), load by day (from my drafts)
- **Lists:** My draft schedules, my recent submissions + feedback from Schedule Admin, conflicts in my drafts
- **Actions:** New schedule/generate, new subject/teacher/room/section, submit for approval

### 18.5 Teacher Dashboard
- **Stats:** Classes today, weekly hours, max hours (from teacher record), utilization percentage, pending change requests, unread admin messages
- **Graphs:** Weekly load hours by day, subject distribution (from published schedules)
- **Lists:** Today's classes (with live "now" indicator), next class, upcoming events, announcements, recent admin messages
- **Actions:** Submit schedule change request, message admin, update preferences

### 18.6 Student Dashboard
- **Stats:** Classes today, next class countdown, next break, weekly class count
- **Graphs:** Weekly schedule load (hours by day)
- **Lists:** Today's classes, upcoming events, announcements (for section + global)
- **Actions:** Open OptiBot, view full schedule

### 18.7 Dashboard Principles
- Each dashboard is role-based; never expose widgets for functions outside the role
- All schedule-related stats filter by `status='published'` unless the role is the creator of drafts
- All counts use role-filtered queries (e.g., "Teachers" stat uses `profiles WHERE role='teacher'`)
- Conflict counts filter by `is_resolved=false`
- Charts must render with defined min-height to prevent Recharts collapse in narrow grid cells
- Consult Permission Rules Engine for cross-role visibility before querying
- Frontend role gating is cosmetic only; backend RLS is the source of truth

---

## 19. Design and UX Requirements

### 19.1 Overall Feel
- Professional, modern, and easy to use
- Landing page can be the most creative part of the system
- Authenticated dashboards should feel efficient and clean

### 19.2 Theme
- Light mode should be default
- Dark mode should still look excellent
- Color palette should remain in the blue academic family

### 19.3 Visual Quality
- UI should feel polished and serious enough for institutional presentation
- Animations should feel smooth, fast, and refined
- Animations should enhance the interface rather than distract from it

---

## 20. Cross-Platform and Future Mobile Support

### 20.1 Architecture
- Backend must be API-first
- Web app and future mobile app both connect to the same backend
- Backend should remain the single source of truth

### 20.2 Mobile App Scope
- Mobile app should not generate schedules locally
- Mobile app should focus on:
  - Viewing schedules
  - Receiving notifications
  - Asking schedule questions

---

## 21. Security Requirements

### 21.1 Authentication
- System must use secure authentication
- Passwords should be hashed using Argon2id

### 21.2 Access Control
- Role-based access control should be enforced on the backend
- Frontend should never be trusted for security decisions

### 21.3 Data Protection
- All secrets must live server-side
- Database should never be directly exposed to clients

### 21.4 Logging
- All admin actions, especially schedule changes and Power Admin overrides, should be logged

### 21.5 Transport
- System should support HTTPS in production

---

## 22. Performance and Scale

### 22.1 Target Load
- Around 30 teachers
- 15 to 20 rooms
- About 30 sections
- Large subject set

### 22.2 Performance Requirements
- Should remain responsive during generation
- Should be fast during schedule viewing

### 22.3 Scalability
- Should be easy to expand later for multiple branches or institutions
- Architecture should be modular so that each institution can eventually run in its own environment if necessary

---

## 23. Deployment Goals

- System is being built for presentation first
- Must still be easy to deploy later
- Backend, frontend, and database should all be designed in a way that can support production deployment later without major rewrites

---

## 24. Monetization Direction

- Long-term monetization model: Partnership-based licensing with institutions
- Schools would pay for usage and support as part of a licensing agreement
- This is not meant to be a user-paid consumer subscription model

---

## 25. Acceptance Criteria

The product is acceptable when:

1. A user can:
   - Open the landing page
   - See a polished professional academic experience
   - Log in
   - Be routed to the correct dashboard
   - Interact only with the functions allowed to that role

2. The system allows:
   - Schedule managers to create and generate schedules
   - Administrators to approve them
   - Users to view their schedules
   - Hard constraints to be enforced

3. The following features work in a coherent and expandable way:
   - Schedule versioning
   - Collaboration
   - Room and section hierarchy
   - Teacher role limits
   - AI support

4. The landing page:
   - Looks creative, modern, and animated
   - Still feels appropriate for a serious academic institution

---

## 26. Appendix

### 26.1 Color Palette Reference
- Dark Blue: `#0F2854`
- Medium Blue: `#1C4D8D`
- Light Blue: `#4988C4`
- Pale Blue: `#BDE8F5`

### 26.2 Known Schema Debt (to reconcile)
- `profiles.role` CHECK currently `'admin'|'teacher'|'student'` in `database_schema.sql`. Live DB must allow `power_admin`, `system_admin`, `schedule_admin`, `schedule_manager`. A new migration SQL file should extend the CHECK (per rule, existing SQL is not edited; new file will be created).
- `custom_events.creator_role` CHECK only allows `'admin'|'teacher'`. Should be extended to include all admin sub-roles + schedule_manager.
- `schedules.status` CHECK currently `'draft'|'published'|'archived'`. Approval workflow (§15) needs an additional `'submitted'` state to distinguish "awaiting approval" from "draft".

### 26.3 Required New Tables (for this revision)
- `system_rules` — Permission Rules Engine storage
- `audit_logs` — Power Admin audit trail
- `schedule_versions` — versioning (already implied but not defined in current schema)

### 26.4 Key Terms
- **Hard Constraint:** A rule that must never be violated
- **Soft Constraint:** An optimization goal
- **Role Rank:** Numeric tier (1–6) used for hierarchical authorization
- **Rules Engine:** Runtime configurable permission system (global/role/per-user)
- **Activity Log:** Per-user action trail for troubleshooting and security
- **Audit Log:** System-wide privileged-action trail (Power Admin only)

---

## 27. Governance Model (Board Reference)

This section formalizes every authority decision so each can be defended in board review. Every choice has a stated **purpose**, **risk it mitigates**, and **fallback**.

### 27.1 Role Rank Hierarchy

| Rank | Role | Headcount | Purpose |
|:---:|------|-----------|---------|
| 6 | Power Admin | 1 (system developer) | Last-resort recovery, vendor support, emergency override |
| 5 | System Admin | 1–3 institutional IT/Registrar | Account governance, system rules, troubleshooting |
| 4 | Schedule Admin | 1–4 academic deans/heads | Approval authority for schedules |
| 3 | Schedule Manager | 3–10 program coordinators | Schedule construction |
| 2 | Teacher | 30+ | Personal operations |
| 1 | Student | 500+ | View-only |

**Authority rule:** A user can only modify another user whose rank is *strictly lower*. Equal-rank users cannot edit each other. No user can edit themselves administratively (only personal Settings). This is enforced in **both** RLS and UI.

**Why this matters for the board:** It makes privilege escalation provably impossible at the database level. A Schedule Admin cannot promote themselves to Power Admin even if they discover a UI bug, because Postgres rejects the row update.

### 27.2 Power Admin Design — Lockout-Proof

The Power Admin is a single user (the system developer/vendor), not an institutional staff member. Design choices:

- **Cannot be deactivated through the UI.** Hard-coded RLS policy prevents any role from updating `profiles` rows where target rank ≥ 6.
- **Cannot be demoted.** Same RLS principle — `profiles_role_check` policy rejects role downgrades on Power Admin rows.
- **Cannot be deleted.** A `BEFORE DELETE` trigger raises an exception when target is Power Admin.
- **Recovery path exists.** If the Power Admin loses MFA, a service-account credential (kept by vendor in cold storage) can restore access via direct DB. This is documented and audit-logged.
- **Power Admin actions are still logged.** Even though Power Admin can override anything, every override is recorded in `audit_logs` with full context.

**Board defense:** "What if the Power Admin is compromised?" — Answer: All Power Admin actions are logged in append-only `audit_logs`, retention 730+ days, readable by Power Admin only. Compromise is detectable post-hoc; before that, MFA + IP allowlist + session timeouts mitigate it. The institution can rotate to a new Power Admin in cooperation with the vendor (manual DB key rotation).

### 27.3 Three-Tier Permission Overrides

Lookup precedence (most-specific wins):
1. **Per-user override** (`user_permission_overrides` table)
2. **Role override** (`system_rules.role_overrides` JSONB)
3. **Global rule** (`system_rules.rule_value`)
4. **Hardcoded default** (in `usePermissions` fallback)

**Why three tiers:** Institutions need both blanket policy ("teachers can message admins") and exception handling ("…except this teacher under investigation"). Two tiers force ugly workarounds; four tiers add no clarity.

**Who can edit what:**
- **Power Admin:** Edits any rule at any tier for any user except themselves.
- **System Admin:** Edits global, role, and per-user overrides — but cannot edit a Power Admin's per-user overrides, cannot edit themselves, cannot edit any same-rank System Admin.
- **Other roles:** Read-only access to global rules (so the UI can self-gate); cannot edit anything.

### 27.4 Activity Logging — Board-Defensible Privacy

Two log streams, deliberately separated:

**`user_activity_logs`** — granular per-user trail for troubleshooting:
- Login attempts (success + failure with reason)
- Page navigation
- Database mutations (insert/update/delete)
- RLS denials (security signal)
- AI prompts (OptiBot interactions)
- Failed validations (UI errors)

**Visibility:** Power Admin and System Admin only. Schedule Admin / Schedule Manager / Teacher / Student cannot view any activity logs (theirs or others'). A user may export their *own* activity log for personal review (GDPR-style data portability).

**`audit_logs`** — system-wide privileged-action trail:
- Role changes
- Rule edits
- Schedule approvals/rejections
- Manual overrides (Power Admin)
- Account creation/deletion
- Permission override grants

**Visibility:** Power Admin only.

**Why two streams:** Activity logs are high-volume operational data needed for support. Audit logs are low-volume integrity-of-record data needed for compliance. Mixing them makes both worse — operational queries swamp the audit table, and audit retention costs balloon. Separating them lets us tune retention and access independently.

**Retention defaults:**
- Activity logs: 90 days (configurable via `activity_log_retention_days` rule)
- Audit logs: 730 days (configurable via `audit_log_retention_days` rule)

**Board defense:** "Doesn't this surveil teachers?" — Answer: Activity logs are operational data for troubleshooting, not performance evaluation. Logs are technical (page views, DB queries) — not content (chat messages already require RLS). Access is restricted to two roles with documented duty. Teachers can export their own logs to verify what is collected. Logs auto-purge after 90 days. This is industry-standard for any SaaS handling academic records (FERPA-aligned).

### 27.5 Comprehensive Tab Map (Final)

Sidebar uses **grouped sections** with collapsible headers. Each role sees only the groups and tabs relevant to it. Badge counts (pending approvals, unread messages, conflicts) appear inline.

#### Power Admin (full control, all groups)

**Overview**
- Dashboard
- Live Activity Feed (real-time stream of system actions)

**Operations**
- Schedules · Approvals · Generate · Conflicts · Faculty Load · Data

**Governance**
- Users (CRUD all roles except self)
- System Rules (global + role + per-user overrides)
- Audit Log (privileged actions, all users)
- User Activity (per-user troubleshooting trail)
- Sessions (active sessions, force-logout)
- System Health (DB, RLS state, API latency)
- Backup & Recovery (snapshots, point-in-time restore)
- Emergency Override (force-publish, force-archive, unlock)
- Feature Flags (beta features)

**Communication**
- Announcements · Messages · Broadcasts · OptiBot

**Personal**
- Tasks · My Settings

#### System Admin

**Overview**
- Dashboard

**Governance**
- Users (CRUD ranks 1–4; view-only for Power Admin)
- System Rules (edit global + role + per-user overrides for ranks 1–4)
- User Activity (per-user troubleshooting trail for ranks 1–4)
- Sessions (force-logout for ranks 1–4)
- System Health
- Account Lifecycle (bulk import/export, deactivation)
- Department & Program Setup (institutional structure)
- Theme & Branding (logo, colors, terminology)

**Communication**
- Announcements · Messages · Broadcasts · OptiBot

**Personal**
- Tasks · My Settings

> Hidden from System Admin: Audit Log (Power-only), Backup & Recovery, Emergency Override, Feature Flags. Rationale: these tools mutate or expose data at a level only the system vendor should reach. Limiting them prevents an institutional admin from accidentally destroying records.

#### Schedule Admin

**Overview**
- Dashboard

**Operations**
- Approvals (queue with inline approve/reject)
- Schedules (view all, edit any)
- Schedule History (versions, diff, rollback)
- Conflicts
- Change Requests (from teachers)
- Faculty Load (read-only)

**Communication**
- Announcements (post + read) · Messages · OptiBot

**Personal**
- My Settings

> Schedule Admin cannot view activity logs or manage users — this preserves separation of concerns. Their authority is over schedules; account governance lives with System Admin.

#### Schedule Manager

**Overview**
- Dashboard

**Operations**
- My Schedules (drafts, submitted, approved)
- Generate
- Data (Teachers, Rooms, Subjects, Sections, Teacher Roles)
- Conflicts (in own drafts)
- Faculty Load
- Sharing (public/private elements)
- Templates (save/reuse)

**Communication**
- Messages · OptiBot

**Personal**
- My Settings

#### Teacher

**Overview**
- Dashboard

**Personal**
- My Schedule
- My Workload (hours, utilization, projection)
- My Preferences (availability)
- My Requests (change request history)
- My Sections (students/sections I teach)

**Communication**
- Messages (with admins, with peers if rule allows)
- Announcements (read)
- OptiBot

**Personal Settings**
- My Settings (theme, password, notifications, export my activity log)

> Teachers with multi-role pick up the relevant admin tabs automatically.

#### Student

**Overview**
- Dashboard

**Personal**
- My Schedule
- Section Schedule (if rule allows)
- Upcoming (next class, next break, events)

**Communication**
- Announcements (read)
- OptiBot
- Help / Contact (guided form, creates a tagged message)

**Personal Settings**
- My Settings (theme, password, notifications)

### 27.6 Tab-Naming Principles

Every tab name was chosen by these rules — board can verify clarity:

1. **Verb or noun, never both.** "Generate" not "Generate Schedule" (action implied).
2. **Personal prefix "My"** for own data. Reduces confusion (My Schedule vs Schedules).
3. **Plural nouns** for collections (Users, Schedules, Conflicts).
4. **Singular nouns** for single workspaces (Dashboard, Generate, Audit Log).
5. **No acronyms** in sidebar. "OptiBot" is a product name, allowed.
6. **6–14 characters** target length so the sidebar stays narrow.

### 27.7 Sidebar UX Improvements

1. **Grouped sections** with a small group label (e.g., "Operations") and 4–8 items beneath.
2. **Collapsible groups** — chevron toggles; state persisted per user in `localStorage`.
3. **Search** at top of sidebar (⌘K opens it). Fuzzy-finds tabs and pages.
4. **Pinned tabs** — user can star up to 5 tabs that stick to top above groups.
5. **Recent** auto-list shows last 3 visited (between Pinned and Groups).
6. **Badge counts** — Approvals (3), Messages (12), Conflicts (1) shown inline.
7. **Compact (icon-only) mode** for narrow viewports; hover reveals labels.
8. **Active route highlight** with left accent bar (4px), not full-row tint.
9. **Keyboard nav:** ⌘1–⌘9 jumps to first 9 tabs; arrow keys navigate within group.

### 27.8 Design System Tokens (v1.2)

Selected via `ui-ux-pro-max` skill (academic dashboard, professional, secure):

- **Pattern:** Data-Dense Dashboard
- **Heading font:** Crimson Pro (academic, scholarly serif)
- **Body font:** Atkinson Hyperlegible (highly readable, accessible)
- **Primary:** `#0F2854` (existing OptiSched dark blue)
- **Secondary:** `#1C4D8D` (existing medium blue)
- **Accent CTA:** `#22C55E` (success green for primary actions)
- **Negative:** `#EF4444` (error red for conflicts)
- **Warning:** `#F59E0B` (amber for pending state)
- **Effects:** Hover tooltips, smooth row highlighting, 150–250ms transitions
- **Avoid:** ornate decorations, excessive shadows, no-filter tables, layout-shifting hover scales

### 27.9 Security Posture (Board Summary)

| Risk | Mitigation | Residual |
|------|-----------|----------|
| Privilege escalation | RLS rank checks on `profiles` updates | Low — DB-enforced |
| Compromised admin account | Activity logs + audit logs + session timeout (60min default) + MFA option | Low — detectable + recoverable |
| Data leakage to wrong role | RLS policies on every sensitive table; rules engine adds per-rule gating | Low — defense in depth |
| Lockout (lost admin) | Power Admin cannot be locked out by RLS design; vendor recovery path | Very low |
| SQL injection | All queries via Supabase client (parameterized); no raw string concatenation | Very low |
| XSS | React auto-escapes output; sanitize Markdown rendering | Low |
| Insider threat (malicious admin) | All privileged actions logged; rank prevents same-tier override | Medium — depends on log review cadence |
| Schedule data tampering | Versioning + audit_logs + RLS edit gate | Low |

**Recommendation for board:** quarterly review of `audit_logs` by an independent stakeholder (not the System Admin) to catch insider threat patterns. This requires no engineering change; it's a process control.
