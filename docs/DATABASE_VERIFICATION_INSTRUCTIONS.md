# Database Verification & Auto-Fix Instructions

## Quick Start

**Run this script in Supabase SQL Editor:**
`database/supabase/auto_fix_database.sql`

This script will:
1. ✅ Create teacher records for profiles with role=teacher but no teacher entry
2. ✅ Create teacher preferences for teachers without preferences
3. ✅ Set teachers to public (fixes RLS visibility issues)
4. ✅ Set subjects to public
5. ✅ Set rooms to public
6. ✅ Verify all required columns exist in schedules table
7. ✅ Verify teacher_id column exists in subjects table
8. ✅ Verify locking foreign keys exist
9. ✅ Report data counts
10. ✅ Test frontend fetch queries

---

## What Was Fixed

### 1. Frontend Types (`web/src/types/database.ts`)
- ✅ Added `submitted`, `approved`, `rejected` to ScheduleStatus type
- ✅ Added missing audit fields to Schedule interface (created_at, updated_at, created_by, submitted_at, approved_by, approved_at, rejected_by, rejected_at, rejection_reason, deleted_at, deleted_by)
- ✅ Added locking fields to Schedule interface (is_locked, locked_by, locked_at, lock_reason)
- ✅ Added teacher_id to Subject interface

### 2. Canonical Schema (`database/schemas/database_schema.sql`)
- ✅ Added locking fields to schedules table (is_locked, locked_by, locked_at, lock_reason)
- ✅ Added locked_by foreign key to profiles table

### 3. Database Integrity
- 🔄 Run auto_fix_database.sql to fix data issues

---

## Verification Steps

### Step 1: Run Auto-Fix Script
1. Open Supabase SQL Editor: https://supabase.com/dashboard/project/xrcvngpvmauywlgcbbjo/sql/new
2. Copy contents of `database/supabase/auto_fix_database.sql`
3. Paste into SQL Editor
4. Click "Run"
5. Review the output - should see all ✓ marks

### Step 2: Refresh Frontend
1. Refresh browser (Ctrl+F5)
2. Navigate to Faculty Hub - teachers should now appear
3. Navigate to Schedule Management - schedules should now appear

### Step 3: Verify Data Loading
Check browser console (F12) - should see no more:
- 400 Bad Request errors
- CORS errors
- "Error fetching teachers" errors

---

## Expected Results After Fix

### Faculty Hub
- ✅ Teachers count should show actual number
- ✅ Teacher list should populate with names
- ✅ No "Unknown error" messages

### Schedule Management
- ✅ Published schedules should load
- ✅ Teacher names should display
- ✅ Room names should display
- ✅ Section names should display

---

## If Issues Persist

### Check 1: RLS Policies
Run this in Supabase SQL Editor:
```sql
SELECT 
    tablename,
    policyname,
    permissive,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public'
    AND tablename IN ('teachers', 'schedules')
ORDER BY tablename, policyname;
```

### Check 2: Verify Teachers Are Public
```sql
SELECT id, profile_id, is_public 
FROM public.teachers 
LIMIT 10;
```

All should have `is_public = true`.

### Check 3: Verify Teacher Records Exist
```sql
SELECT COUNT(*) as teacher_count
FROM public.teachers;

SELECT COUNT(*) as profile_teacher_count
FROM public.profiles
WHERE role = 'teacher';
```

These should be equal or close.

---

## Files Modified

1. `web/src/types/database.ts` - Fixed all type definitions
2. `database/schemas/database_schema.sql` - Added locking fields
3. `database/SYSTEM_CONSISTENCY_REPORT.md` - Created analysis report
4. `database/supabase/verify_schema_alignment.sql` - Created verification script
5. `database/supabase/auto_fix_database.sql` - Created auto-fix script
6. `database/supabase/check_schema_consistency.sql` - Created column checker

---

## System Consistency Status

### ✅ RESOLVED
- ScheduleStatus type mismatch
- Schedule interface missing audit fields
- Subject interface missing teacher_id
- Canonical schema missing locking fields

### 🔄 PENDING USER ACTION
- Run auto_fix_database.sql in Supabase SQL Editor
- Refresh frontend
- Verify data loads correctly

### 📋 VERIFIED
- Naming conventions (snake_case in DB, camelCase in frontend)
- Foreign key relationships
- Data type consistency
- Table structure alignment
