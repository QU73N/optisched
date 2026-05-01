# Comprehensive Implementation Plan
**OptiSched - Complete Feature Roadmap**

**Created:** April 28, 2026
**Last Updated:** April 28, 2026
**Purpose:** Implementation plan for all PRD features
**Scope:** From critical foundation to enhancement features

---

## Executive Summary

**Current Status:**
- ✅ Core infrastructure complete (auth, RLS, governance, security)
- ✅ All 6 role dashboards exist with basic functionality
- ✅ Schedule generation engine exists (CSP-based)
- ✅ Database migrations created and moved to `migrated/` directory
- ✅ Section Hierarchy fully implemented (Migration 005)
- ✅ Schedule Versioning fully implemented (Migration 006)
- ✅ Priority System fully implemented (Migration 007)
- ✅ Sharing/Collaboration fully implemented (Migration 008)
- ✅ Teacher Availability Input fully implemented (Migration 009)
- ✅ Break Times fully implemented (Migration 010)
- ✅ Notifications fully implemented (Migration 011)
- ✅ Approval Workflow fully implemented (Migration 012)
- ✅ Governance features fully implemented (Migration 014) - Role Selector, Department Assignment, Approval Bypass Rules, Session Length Configuration
- ✅ Database schema updated - removed locking system, added soft deletion with 30-day cleanup, added rejected_by/rejected_at columns
- ✅ Documentation fully aligned across PRD, USER_GUIDE, IMPLEMENTATION_PLAN, STATUS_REPORT
- ✅ AI backend implemented (OptiBot w/ Gemini + Groq + OpenRouter fallback, full DB context, admin action execution)
- ✅ Mobile app implemented (React Native + Expo, 22 screens, auth, offline sync queue, role dashboards)
- 🟡 Generator soft constraints partial (3 of 9 PRD §13.2 objectives; teacher availability not integrated)

**Migration Status:**
- `005_create_section_hierarchy.sql` - IMPLEMENTED
- `006_create_schedule_versioning.sql` - IMPLEMENTED
- `007_create_priority_system.sql` - IMPLEMENTED
- `008_create_sharing.sql` - IMPLEMENTED
- `009_update_teacher_preferences.sql` - IMPLEMENTED
- `010_create_break_times.sql` - IMPLEMENTED
- `011_create_notifications.sql` - IMPLEMENTED
- `012_create_approval_workflow.sql` - IMPLEMENTED
- `014_create_departments_and_governance_rules.sql` - IMPLEMENTED

**Note:** Migration 013 (schedule locking) has been removed as the locking system was replaced with role-based edit control via RLS policies.

All core PRD features are now implemented. Remaining work focuses on AI integration and mobile app connectivity.

---

## Phase 1: Governance Features (COMPLETED)

**Status:** ✅ COMPLETED (Migration 014)

### 1.1 Role Selector Panel & Department Assignment

**Implementation Summary:**
- Created `RoleSelector.tsx` component with modal UI for multi-role users
- Added `switchRole` function to `AuthContext` with localStorage persistence
- Integrated role selector into `Layout.tsx` with clickable badge
- Created `departments` table with RLS policies
- Added `department_id` column to `profiles` table
- Inserted governance system rules:
  - `schedule_managers_can_create_without_approval` (default: false)
  - `schedule_managers_can_edit_without_approval` (default: false)
  - `schedule_managers_access_all_data` (default: false)
  - `default_session_length_minutes` (default: 60)
- Updated `usePermissions.ts` with new rule keys and capability checks
- Department assignment UI already exists in `AdminManageUsers.tsx`

**Files Created/Modified:**
- `database/supabase/migrated/014_create_departments_and_governance_rules.sql` - NEW
- `web/src/components/RoleSelector.tsx` - NEW
- `web/src/components/RoleSelector.css` - NEW
- `web/src/contexts/AuthContext.tsx` - MODIFIED (added switchRole)
- `web/src/hooks/usePermissions.ts` - MODIFIED (added new rules)
- `web/src/hooks/useActivityLogger.ts` - MODIFIED (added role_switch activity type)
- `web/src/components/Layout.tsx` - MODIFIED (integrated role selector)
- `web/src/index.css` - MODIFIED (added clickable badge styles)

**Deliverables:**
- ✅ Role selector panel UI
- ✅ Department assignment system (for teachers and schedule managers)
- ✅ Department-based data access filtering infrastructure
- ✅ Configurable approval bypass rules
- ✅ Session length configuration (block length)
- ✅ Updated RLS policies for department-based access
- ✅ Documentation updates

---

## Phase 2: Core Workflow Features (COMPLETED)

**Status:** ✅ COMPLETED

All core workflow features are implemented via migrations 008-012 and 014.

### 2.1 Sharing/Collaboration (Migration 008)
### 2.2 Teacher Availability Input (Migration 009)
### 2.3 Break Times Configuration (Migration 010)
### 2.4 Notification System (Migration 011)
### 2.5 Approval Workflow (Migration 012)

See individual implementation documents for details:
- `docs/PRIORITY_SYSTEM_IMPLEMENTATION.md`
- `docs/SCHEDULE_VERSIONING_IMPLEMENTATION.md`
- `docs/SECTION_HIERARCHY_IMPLEMENTATION.md`

---

## Phase 3: Enhancement Features

### 3.1 AI Features Backend (PRD §16)

**Status:** ✅ IMPLEMENTED

**Implementation:** `web/src/services/optibotService.ts` + `mobile/src/services/optibotService.ts`
- Multi-provider chain: Gemini 2.5 → Groq (Llama 3.3 70B) → OpenRouter (Llama 3.3 70B) fallback
- Full database context injection (schedules, teachers, rooms, subjects, sections, conflicts, events, users, announcements)
- Admin action execution via `$$ACTION{...}$$` blocks (create/delete users, events, schedules, subjects, rooms, sections, announcements; update profiles)
- Hard constraint guardrails (zero-overlap, capacity compliance, subject-room match)
- System prompt enforces no academic assistance, no personal advice, school-only scope
- Bilingual support (English/Tagalog/Taglish)

### 3.2 Mobile App Integration (PRD §20.2)

**Status:** ✅ IMPLEMENTED

**Implementation:** `mobile/` (React Native + Expo)
- Supabase configured, full auth with role-based routing
- 22 screens across admin (10), teacher (5), student (2), shared (4), auth (1)
- Teacher dashboard, preferences, chat (admin + teacher-to-teacher)
- Student dashboard, schedule viewer
- Offline sync queue (`src/utils/offlineQueue.ts`)
- Custom toasts, alerts, theme provider with dark mode
- Services: analytics, conflict detection, notifications, OptiBot, schedule engine

### 3.3 Soft Constraints Optimization (PRD §13.2)

**Status:** ✅ IMPLEMENTED

**Implementation in `web/src/pages/admin/ScheduleGenerate/generator.ts::scoreAttempt`:**
- ✅ Balanced teacher load (std-dev of sessions per teacher)
- ✅ Compact schedules (gaps within section/day)
- ✅ Minimize room switching (distinct rooms per teacher)
- ✅ Teacher preferred time window (preferred_time_start/end + preferred_days)
- ✅ Daily load balance (std-dev of sessions per teacher per day)
- ✅ Workload fairness (now hard constraint - max_classes_per_day / max_hours enforced during placement)
- ✅ Subject spacing (penalises stacking same subject on same day)
- ✅ Room utilization (rewards usage of scarce special rooms)

**Hard constraints added:**
- Teacher per-slot availability (`teacher_preferences.availability` map)
- Teacher preferred_days (placement skips days outside this list when set)
- Teacher max_classes_per_day (hard constraint, prevents placement if exceeded)
- Teacher max_hours (hard constraint, prevents placement if exceeded)
- Split sessions support (calculates sessions_needed from duration_hours/sessionMinutes)

**Files Modified:**
- `web/src/pages/admin/ScheduleGenerate/types.ts` — extended `Teacher` and `SoftWeights`, updated `DEFAULT_CONFIG`, added `sessions_per_week` to Subject
- `web/src/pages/admin/ScheduleGenerate/generator.ts` — `scoreAttempt` now takes 8 weights, placement enforces availability/preferred_days/max_hours/max_classes_per_day as hard constraints, added split sessions logic with `sessionsNeeded` helper
- `web/src/pages/admin/ScheduleGenerate/index.tsx` — loads `teacher_preferences` alongside teachers, ConstraintsStage shows 8 sliders

---

## Phase 4: Polish and Testing (PENDING)

### 4.1 End-to-End Testing
### 4.2 Performance Testing
### 4.3 Security Audit
### 4.4 Documentation Completion

---

## Implementation Timeline Estimate

**Phase 1: Governance Features** - COMPLETED
**Phase 2: Core Workflow Features** - COMPLETED
**Phase 3: Enhancement Features** - 2-3 weeks (estimated)
**Phase 4: Polish and Testing** - 1-2 weeks (estimated)

**Total Remaining: 3-5 weeks**

---

## Risk Assessment

**High Risk:**
- AI provider integration complexity (mitigation: start with local LLM, cloud optional)
- Mobile app integration complexity (mitigation: focus on core features first)

**Medium Risk:**
- Soft constraint optimization performance (mitigation: limit optimization iterations)

**Low Risk:**
- UI component development (standard React patterns)
- Service layer implementation (well-defined interfaces)

---

## Success Criteria

**Phase 1 & 2 Success:** ✅ ACHIEVED
- All migrations verified as applied
- All features implemented and documented

**Phase 3 Success:**
- AI features working (at minimum, local LLM)
- Mobile app functional for basic viewing
- Soft constraints optimized

**Phase 4 Success:**
- All test scenarios passing
- Performance within acceptable limits
- Security audit passed
- Complete documentation

---

## Next Immediate Actions

1. **Verify Governance Features** - Test RoleSelector, department assignment, approval bypass rules
2. **AI Backend Integration** - Start Phase 3.1
3. **Mobile App Integration** - Start Phase 3.2
4. **Soft Constraints** - Start Phase 3.3

---

## Notes

- All core PRD features are now implemented
- Remaining work is enhancement features (AI, mobile, optimization)
- Locking system was removed in favor of role-based edit control via RLS
- Soft deletion with 30-day cleanup implemented
- Power Admin can approve schedules (not System Admin)
- Instant distribution upon approval implemented
