# Save as Draft and Save and Submit - Comprehensive Fix

## Problem
The original implementation of "Save as Draft" and "Save and Submit" in the Schedule Generate page did not properly integrate with the version control system. It directly inserted schedules into the database without:
- Creating version records in `schedule_versions` table
- Using batch-level versioning
- Properly tracking status transitions
- Maintaining audit trail integrity

## Database Schema Issue Fixed
During implementation, encountered error: `null value in column "schedule_id" of relation "schedule_versions" violates not-null constraint`.

**Root Cause:** The `schedule_versions` table had `schedule_id` set to `NOT NULL`, but batch-level versioning requires `schedule_id` to be NULL (since a batch contains multiple schedules, not a single schedule).

**Fix Applied:** Created migration `20260504_make_schedule_id_nullable.sql` to make `schedule_id` nullable in the `schedule_versions` table. This allows:
- Batch-level versions: `schedule_id = NULL`, `batch_id = <batch_uuid>`
- Legacy single-schedule versions: `schedule_id = <schedule_uuid>`, `batch_id = NULL`

## State Hash Verification Issue Fixed
After fixing the schema issue, encountered error: `Persistence verification failed: State hash mismatch`.

**Root Cause:** The verification step was querying ALL draft schedules with `status='draft'` and `is_active=true`, not just the schedules in the batch we just created. Since there might be other draft schedules in the database, the hash wouldn't match.

**Fix Applied:** Changed the verification query to filter by `batch_id` instead of status:
```typescript
// Before: All draft schedules
.eq('status', 'draft').eq('is_active', true)

// After: Only schedules in the specific batch
.eq('batch_id', createdBatchId).eq('is_active', true)
```

## Solution

### 1. Added `saveDraft` Method to scheduleVersionService.ts

**Location:** `web/src/services/scheduleVersionService.ts` (lines 350-529)

**Functionality:**
- Creates a new batch using `create_schedule_batch` RPC
- Deactivates existing draft schedules (keeps only one active draft)
- Inserts new draft schedules with `status='draft'` and links them to the batch
- Creates a batch-level version using `create_batch_version` RPC with:
  - `change_type='created'`
  - Proper state hash computation
  - Soft score and conflict count tracking
- Activates the draft batch
- **Verifies state hash after persistence** (critical for data integrity)
- Updates the canonical state manager
- Includes rollback mechanisms at each step

**Rollback Protection:**
- If insert fails: Deletes the batch
- If version creation fails: Deletes schedules and batch
- If verification fails: Throws error with state hash mismatch details

### 2. Added `submitSchedule` Method to scheduleVersionService.ts

**Location:** `web/src/services/scheduleVersionService.ts` (lines 531-647)

**Functionality:**
- Gets the draft batch and its active version
- Updates schedules to `status='submitted'` with `submitted_at` timestamp
- Creates a new version for the status change with:
  - `change_type='status_change'`
  - Links to previous version
- Activates the new version
- Includes rollback if version creation fails

**Rollback Protection:**
- If version creation fails: Reverts status back to 'draft'

### 3. Updated `performSave` Function in index.tsx

**Location:** `web/src/pages/admin/ScheduleGenerate/index.tsx` (lines 497-664)

**Changes:**
- Initializes the version service with current user ID
- Converts result entries to Schedule format
- **For 'draft' status:**
  - Calls `scheduleVersionService.saveDraft()`
  - Sets `savedId='draft'` on success
- **For 'submitted' status:**
  - First calls `scheduleVersionService.saveDraft()`
  - Then calls `scheduleVersionService.submitSchedule()` with the returned batch ID
  - Sets `savedId='submitted'` on success
- Removed direct insert logic (no longer uses `directInsert` or RPC fallback)
- Kept conflict detection and audit logging
- Kept student notification logic

### 4. Updated `handleOverwriteConfirm` Function

**Location:** `web/src/pages/admin/ScheduleGenerate/index.tsx` (lines 666-710)

**Changes:**
- Added version service initialization
- No other changes needed (already uses `publishSchedule`)

## Database Infrastructure Verification

All required database components verified:

### Tables:
- ✅ `schedule_batches` - exists with correct columns
- ✅ `schedules` - has `batch_id` column
- ✅ `schedule_versions` - has `batch_id` column

### RPC Functions:
- ✅ `create_schedule_batch` - exists
- ✅ `create_batch_version` - exists
- ✅ `get_active_batch_version` - exists
- ✅ `activate_batch_version` - exists

## Workflow

### Save as Draft:
1. User clicks "Save as draft"
2. `saveAs('draft')` is called
3. `performSave('draft')` is executed
4. `scheduleVersionService.saveDraft()` is called:
   - Creates draft batch
   - Inserts schedules with `status='draft'`
   - Creates version record
   - Verifies state hash
   - Updates state manager
5. Conflict detection runs
6. Audit logging performed
7. Students notified (if applicable)

### Save and Submit:
1. User clicks "Save and submit for approval"
2. `saveAs('submitted')` is called
3. Checks for existing active schedule (shows confirmation if exists)
4. `performSave('submitted')` is executed
5. `scheduleVersionService.saveDraft()` is called first:
   - Creates draft batch
   - Inserts schedules with `status='draft'`
   - Creates version record
6. `scheduleVersionService.submitSchedule()` is called:
   - Updates schedules to `status='submitted'`
   - Sets `submitted_at` timestamp
   - Creates new version for status change
7. Conflict detection runs
8. Audit logging performed
9. Students notified (if applicable)

## Benefits

1. **Proper Version Tracking:** All drafts and submitted schedules are now versioned
2. **Audit Trail:** Every status change creates a version record with full metadata
3. **Data Integrity:** State hash verification ensures data consistency
4. **Rollback Protection:** Compensating transaction pattern with rollback at each step
5. **State Manager Integration:** Canonical state manager is updated with each save
6. **Batch-Level Versioning:** All schedules in a draft/submit operation share a batch ID
7. **Workflow Compliance:** Follows the proper draft → submitted → approved → published workflow

## Testing Recommendations

1. Test "Save as Draft":
   - Verify draft is created in database with `status='draft'`
   - Verify batch record is created
   - Verify version record is created
   - Verify schedules have correct `batch_id`
   - Verify state hash matches

2. Test "Save and Submit":
   - Verify draft is created first
   - Verify status changes to `submitted`
   - Verify `submitted_at` is set
   - Verify two version records are created (draft + status change)
   - Verify second version links to first version

3. Test Error Handling:
   - Test with network errors
   - Test with permission errors
   - Verify rollback mechanisms work
   - Verify error messages are clear

4. Test Overwrite Confirmation:
   - Test when active schedule exists
   - Verify confirmation modal appears
   - Verify overwrite works correctly

## Files Modified

1. `web/src/services/scheduleVersionService.ts`
   - Added `saveDraft()` method
   - Added `submitSchedule()` method

2. `web/src/pages/admin/ScheduleGenerate/index.tsx`
   - Updated `performSave()` function
   - Updated `handleOverwriteConfirm()` function

3. `supabase/migrations/20260504_make_schedule_id_nullable.sql`
   - NEW: Made `schedule_id` column nullable in `schedule_versions` table
   - Required for batch-level versioning where `schedule_id` is NULL

## Status

✅ Implementation complete
✅ Database infrastructure verified
✅ TypeScript compilation successful (no new errors)
✅ Rollback mechanisms in place
✅ State hash verification added
✅ Canonical state manager integration maintained
✅ **Database schema fixed** (schedule_id now nullable for batch versioning)
✅ **State hash verification fixed** (now queries by batch_id instead of status)
✅ **All critical migrations applied** (batch versioning, RPC functions, etc.)
