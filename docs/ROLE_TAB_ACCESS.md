# OptiSched Role-Based Tab Access Documentation

**Version:** 1.2  
**Last Updated:** May 9, 2026  
**Source:** `src/config/sidebar.ts`

---

## Overview

This document provides a comprehensive list of all tabs/pages accessible by each user role in OptiSched. The navigation structure is defined in `src/config/sidebar.ts` and follows the PRD §27.5 Comprehensive Tab Map.

---

## Role Hierarchy

1. **Power Admin** (`admin`, `power_admin`) - Full system control
2. **System Admin** (`system_admin`) - Governance & system health (no schedule editing)
3. **Schedule Admin** (`schedule_admin`) - Approval & review
4. **Schedule Manager** (`schedule_manager`) - Schedule construction
5. **Teacher** (`teacher`) - Personal operations
6. **Student** (`student`) - View-only personal

---

## Power Admin (`admin`, `power_admin`)

**Total Tabs:** 18  
**Full Access:** All system features including schedule editing, governance, and system operations  
**Note:** Power Admin has access to ALL tabs available to any admin role (System Admin, Schedule Admin, Schedule Manager)

### Overview (1 tab)
- **Dashboard** (`/admin`) - Main dashboard with system overview

### Operations (7 tabs)
- **Schedules** (`/admin/schedules`) - Schedule management
- **Approvals** (`/admin/approvals`) - Approval workflow with badge counter
- **Generate** (`/admin/generate`) - Schedule generation
- **Conflicts** (`/admin/conflicts`) - Conflict detection with badge counter
- **Faculty** (`/admin/faculty`) - Faculty management
- **Rooms** (`/admin/rooms`) - Room management
- **Data** (`/admin/data`) - Data management

### Governance (8 tabs)
- **Users** (`/admin/users`) - User management
- **Rules** (`/admin/rules`) - System rules configuration
- **Audit** (`/admin/audit`) - Audit log (Power Admin only)
- **Activity** (`/admin/activity`) - User activity tracking
- **Sessions** (`/admin/sessions`) - Active sessions management
- **Health** (`/admin/health`) - System health monitoring
- **Backup** (`/admin/backup`) - Database backup (Power Admin only)
- **Override** (`/admin/override`) - Admin overrides (Power Admin only)
- **Flags** (`/admin/flags`) - Feature flags (Power Admin only)

### Communication (2 tabs)
- **Announcements** (`/admin/announcements`) - Broadcast announcements
- **Messages** (`/admin/messages`) - Message hub with badge counter

### Personal (2 tabs)
- **Tasks** (`/admin/tasks`) - Personal task list
- **Settings** (`/admin/settings`) - Application settings

---

## System Admin (`system_admin`)

**Total Tabs:** 12  
**Scope:** Governance & system health only (no schedule editing capabilities)

### Overview (1 tab)
- **Dashboard** (`/admin`) - System overview dashboard

### Governance (7 tabs)
- **Users** (`/admin/users`) - User management
- **Rules** (`/admin/rules`) - System rules configuration
- **Activity** (`/admin/activity`) - User activity tracking
- **Sessions** (`/admin/sessions`) - Active sessions management
- **Health** (`/admin/health`) - System health monitoring
- **Lifecycle** (`/admin/lifecycle`) - User lifecycle management
- **Departments** (`/admin/structure`) - Department structure
- **Branding** (`/admin/branding`) - System branding

### Communication (2 tabs)
- **Announcements** (`/admin/announcements`) - Broadcast announcements
- **Messages** (`/admin/messages`) - Message hub with badge counter

### Personal (2 tabs)
- **Tasks** (`/admin/tasks`) - Personal task list
- **Settings** (`/admin/settings`) - Application settings

**Missing compared to Power Admin:**
- Generate, Conflicts, Faculty, Rooms, Data, Audit, Backup, Override, Flags

---

## Schedule Admin (`schedule_admin`)

**Total Tabs:** 11  
**Scope:** Approval workflow and schedule review (no generation or editing)

### Overview (1 tab)
- **Dashboard** (`/admin`) - Approval dashboard

### Operations (7 tabs)
- **Approvals** (`/admin/approvals`) - Approval workflow with badge counter
- **Schedules** (`/admin/schedules`) - Schedule viewing
- **History** (`/admin/history`) - Schedule history
- **Conflicts** (`/admin/conflicts`) - Conflict detection with badge counter
- **Requests** (`/admin/requests`) - Change requests with badge counter
- **Faculty** (`/admin/faculty`) - Faculty viewing
- **Rooms** (`/admin/rooms`) - Room viewing

### Communication (2 tabs)
- **Announcements** (`/admin/announcements`) - Broadcast announcements
- **Messages** (`/admin/messages`) - Message hub with badge counter

### Personal (1 tab)
- **Settings** (`/admin/settings`) - Application settings

**Missing compared to Power Admin:**
- Generate, Data, Users, Rules, Audit, Activity, Sessions, Health, Backup, Override, Flags, Tasks

---

## Schedule Manager (`schedule_manager`)

**Total Tabs:** 10  
**Scope:** Schedule construction and data management (no approval workflow)

### Overview (1 tab)
- **Dashboard** (`/admin`) - Schedule construction dashboard

### Operations (7 tabs)
- **Schedules** (`/admin/schedules`) - Schedule management
- **Generate** (`/admin/generate`) - Schedule generation
- **Data** (`/admin/data`) - Data management
- **Conflicts** (`/admin/conflicts`) - Conflict detection with badge counter
- **Faculty** (`/admin/faculty`) - Faculty management
- **Rooms** (`/admin/rooms`) - Room management
- **Sharing** (`/admin/sharing`) - Resource sharing
- **Templates** (`/admin/templates`) - Schedule templates

### Communication (1 tab)
- **Messages** (`/admin/messages`) - Message hub with badge counter

### Personal (1 tab)
- **Settings** (`/admin/settings`) - Application settings

**Missing compared to Power Admin:**
- Approvals, Users, Rules, Audit, Activity, Sessions, Health, Backup, Override, Flags, Tasks, Announcements

---

## Teacher (`teacher`)

**Total Tabs:** 11 (base) + additional for multi-role teachers  
**Scope:** Personal schedule, workload, preferences, and communication

### Overview (1 tab)
- **Dashboard** (`/teacher`) - Teacher dashboard

### Personal (5 tabs)
- **Schedule** (`/teacher/schedule`) - Personal teaching schedule
- **Workload** (`/teacher/workload`) - Teaching workload analysis
- **Preferences** (`/teacher/preferences`) - Teaching preferences
- **Requests** (`/teacher/requests`) - Schedule change requests
- **Sections** (`/teacher/sections`) - Assigned sections

### Communication (3 tabs)
- **Messages** (`/teacher/chat`) - Message hub with badge counter
- **Announcements** (`/teacher/announcements`) - Broadcast announcements
- **Group Chats** (`/teacher/group-chats`) - Teacher group chats
- **Peer Chat** (`/teacher/peer-chat`) - Teacher-to-teacher chat

### Settings (1 tab)
- **Settings** (`/teacher/settings`) - Application settings

### Multi-Role Extensions
**If teacher also has `schedule_admin` role:**
- Adds **Approvals** group with: Approvals, Schedules, History, Conflicts, Requests, Faculty, Rooms

**If teacher also has `schedule_manager` role:**
- Adds **Build** group with: Schedules, Generate, Data, Conflicts, Faculty, Rooms, Sharing, Templates

---

## Student (`student`)

**Total Tabs:** 8  
**Scope:** View-only personal schedule and information

### Overview (1 tab)
- **Dashboard** (`/student`) - Student dashboard

### Personal (3 tabs)
- **Schedule** (`/student/schedule`) - Class schedule
- **Upcoming** (`/student/upcoming`) - Upcoming classes
- **Section** (`/student/section`) - Section information

### Communication (3 tabs)
- **Announcements** (`/student/announcements`) - Broadcast announcements
- **OptiBot** (`/student/optibot`) - AI assistant
- **Help** (`/student/help`) - Help documentation

### Settings (1 tab)
- **Settings** (`/student/settings`) - Application settings

---

## Badge Counters

Certain tabs display badge counters for unread items:

| Tab | Badge Key | Description |
|-----|-----------|-------------|
| Approvals | `approvals` | Pending approval count |
| Conflicts | `conflicts` | Active conflict count |
| Requests | `requests` | Pending request count |
| Messages | `messages` | Unread message count |

---

## Power Admin Only Tabs

These tabs are marked with `powerOnly: true` and are hidden even from System Admin:

- **Audit** (`/admin/audit`) - Audit log access
- **Backup** (`/admin/backup`) - Database backup operations
- **Override** (`/admin/override`) - Admin override capabilities
- **Flags** (`/admin/flags`) - Feature flag management

---

## Multi-Role Support

Users with multiple roles can access tabs from all their assigned roles:

- **Teacher + Schedule Admin:** Teacher base tabs + Approvals group
- **Teacher + Schedule Manager:** Teacher base tabs + Build group
- **Admin/Power Admin:** Automatically gets full Power Admin navigation regardless of other roles

The `resolveNav()` function in `sidebar.ts` handles role resolution and tab combination logic.

---

## Route Protection

All routes are protected by `ProtectedRoute` wrapper in `App.tsx`:

- **Admin routes:** Require any admin sub-role (`admin`, `power_admin`, `system_admin`, `schedule_admin`, `schedule_manager`)
- **Teacher routes:** Require `teacher`, `schedule_admin`, or `schedule_manager` role
- **Student routes:** Require `student` role

Users are redirected to their role-appropriate dashboard if they attempt to access unauthorized routes.

---

## Public Routes

These routes are accessible without authentication:

- `/` - Landing page (redirects to dashboard if logged in)
- `/login` - Login page (redirects to dashboard if logged in)
- `/help` - Help documentation

---

## Notes

1. **Tab Count:** Total tabs shown in sidebar navigation. Additional sub-routes may exist (e.g., `/admin/schedules/current`, `/admin/schedules/versions`).
2. **Badge Keys:** Dashboard components read counts from system state to display notification badges.
3. **Navigation:** Sidebar navigation is the primary UI; direct URL access is also possible but subject to role checks.
4. **Future Tabs:** Some icons are imported but unused, reserved for future tab additions (e.g., `User`, `Inbox`).

---

**Related Files:**
- `src/config/sidebar.ts` - Navigation configuration
- `src/App.tsx` - Route definitions and protection
- `src/components/Layout.tsx` - Layout wrapper
- `src/components/Sidebar.tsx` - Sidebar rendering
