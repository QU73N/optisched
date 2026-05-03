# Version Control System - Deep Audit Report

## Executive Summary
**Status: ALL ISSUES FIXED ✓**

The current version control system has fundamental architectural mismatches with the application's use case. The system was designed to version individual schedule entries, but the application needs to version batches of 42+ schedule entries together as a single "schedule".

**All 11 critical issues have been resolved.**

## Progress Tracking
- [x] Audit completed
- [x] Database schema redesign
- [x] Fix rollback function
- [x] Fix version creation logic
- [x] Fix state hash computation
- [x] Fix previous version ID linking
- [x] Add batch-level versioning
- [x] Fix restoreVersion function
- [x] Add conflict rescan after rollback
- [x] Testing and validation

## Summary
All critical issues have been fixed:
1. Database schema redesigned with schedule_batches table
2. publishSchedule rewritten to use batch-level versioning
3. rollbackToVersion rewritten to work with batches
4. restoreVersion rewritten to work with batches
5. State hash computation fixed (computed at batch level)
6. Previous version ID linking fixed (links to batch versions)
7. All queries updated to filter by is_active=true
8. Conflict rescan added after rollback operations
9. Conflict counts updated in database after rollback
10. Soft deletion implemented (is_active column)
11. Batch-level snapshot storage (JSON array)

The version control system is now fully functional with batch-level versioning support.

---

## Critical Issues

### 1. **Fundamental Architectural Mismatch** - CRITICAL
**Location:** Database function `create_schedule_version` (line 184 of 20240511_add_schedule_versioning.sql)

**Problem:**
- The function takes a single `p_schedule_id` (UUID of one schedule entry)
- It stores a snapshot using `row_to_json(s)` which captures a SINGLE row
- The application needs to version 42+ schedule entries together as a batch

**Impact:**
- Cannot properly version the entire generated schedule
- Rollback functionality is broken (see issue #2)
- Version history is fragmented across individual entries instead of cohesive batches

**Evidence:**
```sql
-- Current implementation (line 184)
(SELECT row_to_json(s) FROM public.schedules s WHERE s.id = p_schedule_id)
-- This stores ONE row, not the entire schedule batch
```

---

### 2. **Rollback Function Broken** - CRITICAL
**Location:** `scheduleVersionService.ts` line 168-253

**Problems:**

**a) Type Mismatch (Line 186):**
```typescript
const snapshot = version.snapshot as Schedule[];
```
- Expects `snapshot` to be an array of schedules
- But `create_schedule_version` stores a single row as JSON
- Will fail at runtime with "snapshot is not iterable" error

**b) Incorrect Array Access (Line 235):**
```typescript
p_schedule_id: snapshot[0].id,
```
- Tries to access `snapshot[0]` when snapshot is a single object
- Will fail with "Cannot read property '0' of undefined"

**c) Wrong Data Structure:**
- The rollback inserts `snapshot.map(s => ...)` expecting an array
- But receives a single object
- Will not restore the full schedule

**Impact:**
- Rollback is completely non-functional
- Cannot restore previous schedules
- Data loss risk if rollback is attempted

---

### 3. **Version Creation Loop Inefficient** - HIGH
**Location:** `scheduleVersionService.ts` line 424-449

**Problem:**
```typescript
// Step 4 - Create versions for each schedule
for (const schedule of insertedSchedules || []) {
    const { data: version, error: versionError } = await this.supabase
        .rpc('create_schedule_version', {
            p_schedule_id: schedule.id,
            // ...
        });
}
```

**Issues:**
- Creates 42+ separate version entries for each schedule batch
- Each version stores the same state_hash (computed from entire batch)
- Each version has the same previous_version_id (linking to one previous version)
- This creates a fragmented version history that doesn't represent cohesive batches

**Impact:**
- Version history is confusing and not useful
- Cannot easily see "what was the schedule at version X?"
- Database bloat with redundant version entries
- Performance impact from N+1 queries

---

### 4. **State Hash Computation Mismatch** - MEDIUM
**Location:** `scheduleVersionService.ts` line 353, 432

**Problem:**
```typescript
// Line 353 - Computed from entire batch
const stateHash = scheduleValidation.computeStateHash(schedules);

// Line 432 - Same hash stored for each individual entry
p_state_hash: stateHash,
```

**Issue:**
- State hash is computed from the entire schedule batch
- But stored in individual version entries for each schedule row
- This creates a mismatch: one hash represents 42 entries, but stored 42 times

**Impact:**
- State hash verification is meaningless
- Cannot detect if individual row changed
- Violates the purpose of state hashing

---

### 5. **Previous Version ID Linking Broken** - MEDIUM
**Location:** `scheduleVersionService.ts` line 336, 436

**Problem:**
```typescript
// Line 336 - Gets only ONE schedule ID
const { data: currentSchedules } = await this.supabase
    .from('schedules')
    .select('id')
    .eq('status', 'published')
    .eq('is_active', true)
    .limit(1);  // <-- Only gets one!

// Line 343 - Uses that one ID for all versions
deletedScheduleIds = currentSchedules.map(s => s.id);

const { data: activeVersion } = await this.supabase
    .rpc('get_active_schedule_version', { p_schedule_id: currentSchedules[0].id });

// Line 436 - All new versions link to this one previous version
p_previous_version_id: previousActiveVersionId,
```

**Issue:**
- Only queries for ONE schedule entry (limit(1))
- But there are 42+ active schedule entries
- All new versions link to the same previous version ID
- This breaks the version chain for all but one entry

**Impact:**
- Version chain is broken for most schedule entries
- Cannot trace history for individual entries
- Rollback cannot properly link to previous versions

---

### 6. **Missing Batch-Level Versioning** - CRITICAL
**Problem:**
- No concept of a "schedule batch" ID
- Each schedule entry is independent
- No way to group 42 entries as one versioned entity

**Impact:**
- Cannot version the entire schedule as a cohesive unit
- Cannot compare schedule versions at the batch level
- Cannot rollback the entire schedule atomically

**Required Fix:**
- Add `schedule_batch_id` column to schedules table
- Create schedule_batches table to track batch metadata
- Modify versioning to work at batch level, not entry level

---

## Secondary Issues

### 7. **No Version Set Linking to Schedules** - RESOLVED ✓
**Status:** Obsolete with batch-level versioning

**Resolution:**
- Version sets are no longer used
- Batches now link directly to schedules via `batch_id` foreign key
- Querying schedules for a batch is straightforward: `WHERE batch_id = ?`

---

### 8. **Rollback Creates New IDs** - RESOLVED ✓
**Status:** This is correct behavior for proper versioning

**Resolution:**
- Rollback creates new batches with new IDs
- This is proper versioning - each version has its own identity
- Old schedules are preserved with `is_active=false` for history
- This allows for true version history tracking
- No database bloat - old versions can be archived if needed

---

### 9. **Missing is_active in Version Queries** - RESOLVED ✓
**Status:** Fixed

**Resolution:**
- All queries now consistently filter by `is_active=true` on schedules
- `schedule_versions.is_active` is used for version activation
- Clear pattern: schedules use `is_active` for soft deletion, versions use `is_active` for activation

---

### 10. **No Conflict Count in Rollback** - RESOLVED ✓
**Status:** Fixed

**Resolution:**
- Added conflict rescan after rollback operations
- Conflict counts are updated in the version record
- Detected conflicts are saved to the conflicts table
- Rollback messages now include conflict count

---

## Database Schema Issues

### 11. **schedule_versions.schedule_id Ambiguity** - RESOLVED ✓
**Status:** Fixed

**Resolution:**
- Added `batch_id` column to both `schedules` and `schedule_versions` tables
- Created `schedule_batches` table to track batch metadata
- Batch-level versioning now properly implemented
- All version operations work at batch level

---

## Recommended Fixes - COMPLETED ✓

### Phase 1: Critical Fixes (Immediate) - COMPLETED ✓
1. **Fix rollback function** - Handle single object snapshot correctly ✓
2. **Fix version creation** - Store entire batch as JSON array, not individual rows ✓
3. **Add batch_id concept** - Schema change to support batch-level versioning ✓

### Phase 2: Architecture Redesign (Required) - COMPLETED ✓
1. **Redesign versioning for batches:** ✓
   - Add schedule_batches table ✓
   - Modify schedules to have batch_id foreign key ✓
   - Modify schedule_versions to reference batch_id, not individual schedule_id ✓
   - Store batch snapshot as JSON array in schedule_versions ✓

2. **Rewrite publishSchedule:** ✓
   - Create one batch entry ✓
   - Link all schedules to the batch ✓
   - Create one version entry for the entire batch ✓
   - Store batch snapshot ✓

3. **Rewrite rollback:** ✓
   - Query by batch_id ✓
   - Restore all schedules for that batch ✓
   - Create new batch for rollback ✓
   - Rescan for conflicts ✓

### Phase 3: Enhancements - OPTIONAL
1. Add batch-level conflict detection
2. Add batch comparison functionality
3. Add batch-level diff viewer
4. Add batch-level approval workflow

**Note:** Phase 3 enhancements are not required for the system to function. They can be added in future iterations as needed.

---

## Conclusion

**All version control issues have been successfully resolved.**

The versioning system has been completely redesigned to work at the batch level:
1. Schema changes (add schedule_batches table) ✓
2. Rewrite version creation logic ✓
3. Rewrite rollback logic ✓
4. Update all version queries to work with batches ✓
5. Add conflict rescan after rollback ✓
6. Implement soft deletion with is_active ✓

**Effort Completed:** 4 commits over multiple sessions, all critical issues resolved.

The version control system is now production-ready with:
- Batch-level versioning (42+ entries versioned together)
- Functional rollback capability with conflict detection
- Proper state hash computation at batch level
- Correct version chain linking
- Soft deletion for history preservation
- Compensating transaction pattern for safety
