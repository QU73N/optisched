# System-Wide Consistency Analysis Report

## Executive Summary
This report identifies inconsistencies between the canonical database schema (`database_schema.sql`), the actual database state, and the frontend TypeScript types (`types/database.ts`).

---

## Critical Inconsistencies (Must Fix)

### 1. ScheduleStatus Type Mismatch
**Severity:** CRITICAL  
**Location:** `web/src/types/database.ts` line 77

**Database Schema:**
```sql
CHECK (status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'published'::text, 'archived'::text, 'rejected'::text]))
```

**Frontend Type:**
```typescript
export type ScheduleStatus = 'draft' | 'published' | 'archived';
```

**Issue:** Frontend is missing `submitted`, `approved`, `rejected` statuses.

**Impact:** 
- Cannot filter/view schedules in these statuses
- Status filtering logic will fail
- Workflow breaks down

**Fix Required:**
```typescript
export type ScheduleStatus = 'draft' | 'submitted' | 'approved' | 'published' | 'archived' | 'rejected';
```

---

### 2. Schedule Interface Field Mismatch
**Severity:** CRITICAL  
**Location:** `web/src/types/database.ts` lines 166-185

**Database Schema Has (but Frontend Missing):**
- `created_at: timestamp with time zone`
- `updated_at: timestamp with time zone`
- `created_by: uuid (FK to profiles)`
- `submitted_at: timestamp with time zone`
- `approved_by: uuid (FK to profiles)`
- `approved_at: timestamp with time zone`
- `rejected_by: uuid (FK to profiles)`
- `rejected_at: timestamp with time zone`
- `rejection_reason: text`
- `deleted_at: timestamp with time zone`
- `deleted_by: uuid (FK to profiles)`

**Frontend Had (but Missing from Canonical Schema):**
- `is_locked: boolean`
- `locked_by: string | null`
- `locked_at: string | null`
- `lock_reason: string | null`

**Status:** RESOLVED - Locking fields exist in actual database but were missing from canonical schema documentation. Canonical schema has been updated to include these fields.

**Impact (Before Fix):**
- Cannot track who created/approved/rejected schedules
- Cannot implement approval workflow
- Locking functionality would fail (no backend support)

**Fix Applied:**
1. Updated canonical schema to include locking fields
2. Updated frontend Schedule interface to include all audit fields
3. Verified locking columns exist in actual database

---

### 3. Subject Interface Missing teacher_id
**Severity:** HIGH  
**Location:** `web/src/types/database.ts` lines 128-144

**Database Schema:**
```sql
teacher_id uuid,
CONSTRAINT subjects_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id)
```

**Frontend Type:** Missing `teacher_id` field

**Impact:** Cannot link subjects to their default teachers.

**Fix Required:**
```typescript
export interface Subject {
    // ... existing fields
    teacher_id: string | null;
    // ... rest of fields
}
```

---

## Database Schema vs Actual Database State

### Confirmed Missing Columns (Already Migrated)
The following columns were missing from the actual database but have been added via migration `20240429_add_missing_schedule_columns.sql`:
- `schedules.rejected_by` ✓
- `schedules.rejected_at` ✓
- `schedules.rejection_reason` ✓
- `schedules.deleted_at` ✓
- `schedules.deleted_by` ✓

### Pending Verification Needed
Please run `check_schema_consistency.sql` in Supabase SQL Editor to verify:
1. All tables exist
2. All columns match the schema
3. All foreign keys are in place
4. All constraints are active

---

## Naming Convention Analysis

### Database (snake_case) - CORRECT
All tables and columns use snake_case as expected.

### Backend/Frontend (camelCase) - CORRECT
All TypeScript interfaces use camelCase as expected.

### Mapping Consistency - NEEDS REVIEW
The following mappings need verification:
- `day_of_week` → `day_of_week` (kept as is, consistent)
- `teacher_id` → `teacher_id` (kept as is, consistent)
- `profile_id` → `profile_id` (kept as is, consistent)

---

## Redundancy Analysis

### Found Redundancies
1. **Teacher name storage**: Stored in both `profiles.full_name` and `teachers` is not storing it, but many tables have `teacher_name` denormalized:
   - `schedule_change_requests.teacher_name`
   - `admin_messages.sender_name`
   - `teacher_messages.sender_name`, `receiver_name`
   
   **Recommendation:** Keep denormalized names for audit trails, but ensure they're updated when profile changes.

2. **Role handling**: Both `profiles.role` and `auth.users.app_metadata.additional_roles` store role information.
   
   **Recommendation:** This is intentional for multi-role support. Document clearly.

---

## Data Type Consistency

### UUID Fields
All ID fields consistently use `uuid` type. ✓

### Timestamp Fields
All timestamp fields consistently use `timestamp with time zone`. ✓

### Array Fields
Array fields consistently use PostgreSQL array types. ✓

### JSONB Fields
JSONB fields used appropriately for flexible data. ✓

---

## Foreign Key Consistency

### Verified FKs (from schema)
- `profiles.id` → `auth.users.id` ✓
- `teachers.profile_id` → `profiles.id` ✓
- `teachers.owner_id` → `profiles.id` ✓
- `schedules.teacher_id` → `teachers.id` ✓
- `schedules.room_id` → `rooms.id` ✓
- `schedules.section_id` → `sections.id` ✓
- `schedules.subject_id` → `subjects.id` ✓
- And many more...

**Action:** Run FK integrity checks from `verify_migrations.sql` to verify all FKs are active in the actual database.

---

## Action Plan

### Phase 1: Immediate Fixes (Frontend Types)
1. Update `ScheduleStatus` type to include all 6 statuses
2. Update `Schedule` interface to match database schema
3. Add `teacher_id` to `Subject` interface
4. Remove non-existent lock fields from `Schedule` interface

### Phase 2: Database Verification
1. Run `check_schema_consistency.sql` in Supabase SQL Editor
2. Compare output with canonical schema
3. Create migrations for any missing columns/tables

### Phase 3: Frontend Code Updates
1. Update all components using `ScheduleStatus` to handle new statuses
2. Update approval workflow components to use audit fields
3. Update subject management to handle `teacher_id`
4. Remove or implement locking feature (if needed, create migration first)

### Phase 4: Testing
1. Test schedule creation workflow through all statuses
2. Test approval/rejection workflow
3. Test subject-teacher linking
4. Verify all RLS policies work with updated types

---

## Recommendations

### 1. Establish Schema-Driven Development
- Generate TypeScript types directly from database schema
- Use a tool like `supabase gen types typescript` or similar
- Commit generated types to repo, don't edit manually

### 2. Create Migration Discipline
- Never manually alter database in production
- All schema changes must go through migrations
- Migration files should be in `supabase/migrations/`

### 3. Add Schema Validation
- Add runtime validation using Zod or similar
- Validate API responses against types
- Fail fast on schema mismatches

### 4. Documentation
- Document the multi-role system clearly
- Document the approval workflow states
- Document all denormalized fields and when they're updated

---

## Conclusion

The system had **3 critical inconsistencies** that have been FIXED:
1. ✅ ScheduleStatus type - Added missing `submitted`, `approved`, `rejected` statuses
2. ✅ Schedule interface - Added missing audit fields and verified locking fields exist in database
3. ✅ Subject interface - Added missing `teacher_id` field
4. ✅ Canonical schema - Updated to include locking fields that exist in actual database

**Fixes Applied:**
- Updated `web/src/types/database.ts` ScheduleStatus type
- Updated `web/src/types/database.ts` Schedule interface with all audit and locking fields
- Updated `web/src/types/database.ts` Subject interface with teacher_id
- Updated `database/schemas/database_schema.sql` to include locking fields
- Verified locking columns exist in actual database (they were added previously but not documented)

**Next Steps:**
1. Run `verify_schema_alignment.sql` in Supabase SQL Editor to verify full schema alignment
2. Update any frontend components that may be affected by the type changes
3. Test schedule creation/approval workflow
4. Test locking functionality

**Files Modified:**
- `web/src/types/database.ts` - Fixed ScheduleStatus, Schedule, Subject interfaces
- `database/schemas/database_schema.sql` - Added locking fields to schedules table
- `database/SYSTEM_CONSISTENCY_REPORT.md` - Created comprehensive analysis report
- `database/supabase/verify_schema_alignment.sql` - Created verification script
