# Faculty Load Issue - Root Cause and Fix

## Problem
Faculty load was showing extremely high values (e.g., 58 classes, 92.5 hours per week for top teacher).

## Root Cause Analysis

### Database State (Before Fix)
The `schedules` table contained:
- **Draft (active)**: 93 schedules
- **Published (active)**: 87 schedules
- **Submitted (active)**: 93 schedules
- **Rejected (active)**: 93 schedules
- **Total active**: 366 schedules

### The Issue
The RPC function `get_schedules_with_details()` was returning ALL schedules where `is_active = true`, regardless of status. This meant:
- Draft schedules were being counted
- Submitted schedules were being counted
- Published schedules were being counted
- Rejected schedules were being counted

Additionally, there were many duplicate schedules - the same section, day, time, subject appearing multiple times with different statuses (draft, published, rejected, submitted).

### Example of Duplicates Found
For the top teacher (Egnacio Y. Ello Jr.), the same slot appeared multiple times:
- Section 095bb930-8324-47b7-9ec8-ddf205c9e342
- Monday 07:00-08:30
- Subject dc745ec6-ac87-4b59-84bd-b5debeef689e
- **5 duplicate records** with statuses: draft, published, rejected

### Impact on FacultyHub
FacultyHub uses `useSchedules({ isActive: true })` which calls the RPC function. Since the RPC returned all active schedules (366 total), faculty workload was calculated based on:
- 58 classes
- 92.5 hours per week (for top teacher)

This is clearly incorrect and unrealistic.

## The Fix

### Solution
Updated the RPC function `get_schedules_with_details()` to return **only published schedules**:
```sql
WHERE s.is_active = true AND s.status = 'published'
```

### Rationale
- Published schedules represent the current, approved schedule
- Draft schedules are work-in-progress and should not be counted
- Submitted schedules are pending approval and should not be counted
- Rejected schedules are not valid and should not be counted
- Each slot can only have one published version, eliminating duplicates

### Results After Fix
- **RPC result**: 87 schedules (published only)
- **Top teacher workload**: 13 classes, 20.5 hours
- **Second teacher**: 14 classes, 21 hours
- **Third teacher**: 13 classes, 19.5 hours

### Verification
```sql
-- Before fix
SELECT COUNT(*) FROM public.schedules WHERE is_active = true;
-- Result: 366

-- After fix
SELECT COUNT(*) FROM get_schedules_with_details();
-- Result: 87

-- Published schedules in DB
SELECT COUNT(*) FROM public.schedules WHERE is_active = true AND status = 'published';
-- Result: 87
```

## Files Modified
- `database/supabase/fix_rpc_final.sql` - Updated RPC function to filter by published status only

## Consistency Check
The fix ensures that:
1. Only published schedules are counted in faculty workload
2. No duplicates are counted (each slot has only one published version)
3. Faculty load reflects the actual current schedule
4. RoomHub will also benefit from this fix (uses the same RPC)

## Next Steps
The fix has been applied to the database. The FacultyHub should now display correct faculty workload values based on published schedules only.

## Additional Notes
- If there are no published schedules yet, the RPC will return 0 results
- This is expected behavior - faculty load should only be calculated from approved/published schedules
- Draft schedules can still be viewed in the ScheduleGenerate tab during the generation process
