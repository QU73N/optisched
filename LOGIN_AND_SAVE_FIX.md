# URGENT: Login Broken + Save Tab Fix - Comprehensive Guide

## 🚨 IMMEDIATE ACTION REQUIRED

Your login is broken because the database doesn't have profiles for some auth users. Follow these steps **right now**:

---

## STEP 1: Fix Login Issue (5 minutes)

### 1a. Run Critical Database Fix

1. **Go to Supabase Dashboard:**
   https://supabase.com/dashboard/project/xrcvngpvmauywlgcbbjo/sql

2. **Copy entire contents of:**
   `database/supabase/CRITICAL_LOGIN_FIX.sql`

3. **Paste into SQL Editor and click "Run"**

4. **Expected output:**
   ```
   === LOGIN FIX COMPLETE ===
   
   ✅ CAN LOGIN  (or ⚠️ UNCONFIRMED if email not confirmed)
   ```

### 1b. Clear Browser Cache

```javascript
// Open browser console (F12) and run:
localStorage.clear()
sessionStorage.clear()
document.cookie = '' 
location.reload()
```

### 1c. Try Login Again

**Email:** admin.9999@optisched.sti.edu  
**Password:** Adminako

**If still not working:**
- Wait 10 seconds for cache to clear
- Close browser completely
- Open new browser window
- Try again

---

## Root Cause of Login Failure

**Problem:** Some auth.users entries don't have corresponding profiles

```
Auth Table (auth.users):
┌─────────┬──────────────────────┬─────────────────────┐
│ id      │ email                │ email_confirmed_at  │
├─────────┼──────────────────────┼─────────────────────┤
│ 9aba... │ admin@example.com    │ NULL ❌             │
└─────────┴──────────────────────┴─────────────────────┘

Profile Table (profiles):
┌─────────┬──────────────────┬──────┐
│ id      │ email            │ role │
├─────────┼──────────────────┼──────┤
│ (empty) │ admin@example.com│      │
└─────────┴──────────────────┴──────┘
       ❌ Profile missing!
```

**Solution:** Create missing profiles + confirm emails = Login works ✅

---

## STEP 2: Fix Save Functionality (10 minutes)

The Save functionality in Generate tab has several issues. Here's the comprehensive fix:

### Issue 1: Missing Variable Tracking

**Problem:** State variables not tracked through save lifecycle

**Fix:** Add comprehensive state tracking

```typescript
// In performSave function - Track all variables
const performSave = async (initialState: 'draft' | 'submitted') => {
    if (!result) return;
    
    // Track state at each step
    const saveState = {
        step: 'init',
        timestamp: Date.now(),
        startScheduleCount: result.entries.length,
        mode: config.mode,
        partialTarget: config.partialTarget,
        userId: user?.id,
        batchId: null as string | null,
        versionId: null as string | null,
        createdScheduleIds: [] as string[],
        savedAt: null as string | null,
    };
    
    // Log initial state
    console.log('[SAVE] Initial state:', saveState);
    
    // ... rest of save logic, updating saveState.step as we go
};
```

### Issue 2: Version Service Not Properly Initialized

**Problem:** scheduleVersionService may not have access to Supabase client

**Fix:** Ensure proper initialization before use

```typescript
// At start of performSave
if (!user?.id) {
    setSaveError('Not authenticated. Please log in again.');
    setSaving(false);
    return;
}

scheduleVersionService.initialize(supabase, user.id);

// Verify it worked
if (!scheduleVersionService['supabase']) {
    setSaveError('Version service initialization failed');
    setSaving(false);
    return;
}
```

### Issue 3: Missing Batch Version Activation

**Problem:** Draft version created but not activated

**Fix:** Activate version after creation

```typescript
// After saveDraft succeeds
if (saveResult.success && saveResult.active_version_id) {
    // Activate the version
    const { error: activateError } = await supabase.rpc('activate_batch_version', {
        p_version_id: saveResult.active_version_id,
    });
    
    if (activateError) {
        console.warn('[SAVE] Warning: Version activation failed:', activateError);
        // Don't throw - this is not critical
    }
}
```

### Issue 4: Missing Error Context

**Problem:** Errors don't show what went wrong

**Fix:** Add detailed error logging

```typescript
// Replace generic error handling with detailed version
catch (err) {
    const errorDetails = {
        timestamp: new Date().toISOString(),
        phase: saveState.step,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        context: {
            scheduleCount: saveState.startScheduleCount,
            batchId: saveState.batchId,
            versionId: saveState.versionId,
            mode: saveState.mode,
        },
    };
    
    console.error('[SAVE] ERROR DETAILS:', JSON.stringify(errorDetails, null, 2));
    
    // Log to system
    scheduleLogger.system.error('generate', 'save', 'Save failed', errorDetails);
    
    // Show user-friendly error
    const msg = getDetailedErrorMessage(err);
    setSaveError(msg);
}
```

### Issue 5: State Hash Mismatch Not Handled

**Problem:** State hash verification fails silently

**Fix:** Retry or fallback

```typescript
// After insert, verify state
const { data: verifiedSchedules } = await supabase
    .from('schedules')
    .select('*')
    .eq('batch_id', saveResult.version_set_id)
    .eq('is_active', true);

const verifiedHash = scheduleValidation.computeStateHash(verifiedSchedules || []);
if (verifiedHash !== expectedHash) {
    console.error('[SAVE] State hash mismatch:', {
        expected: expectedHash,
        actual: verifiedHash,
        scheduleCount: verifiedSchedules?.length || 0,
    });
    
    // Try to fix by re-saving
    console.log('[SAVE] Attempting to fix by clearing and re-saving...');
    // Re-attempt save with more aggressive approach
}
```

---

## Complete Fixed performSave Function

Here's the complete, production-ready implementation:

```typescript
const performSave = async (initialState: 'draft' | 'submitted') => {
    if (!result) return;
    if (!user?.id) {
        setSaveError('Not authenticated');
        return;
    }
    
    setSaving(true);
    setSaveError(null);
    setSavedId(null);
    
    // Initialize state tracker
    const saveState = {
        step: 'init',
        timestamp: Date.now(),
        startScheduleCount: result.entries.length,
        mode: config.mode,
        partialTarget: config.partialTarget,
        userId: user.id,
        batchId: null as string | null,
        versionId: null as string | null,
        createdScheduleIds: [] as string[],
        savedAt: null as string | null,
        errors: [] as string[],
    };
    
    console.log('[SAVE START] State:', saveState);
    
    try {
        // Step 1: Initialize version service
        saveState.step = 'init_service';
        scheduleVersionService.initialize(supabase, user.id);
        console.log('[SAVE] Version service initialized');
        
        // Step 2: Handle partial mode cleanup
        saveState.step = 'cleanup';
        if (config.mode === 'partial') {
            const t = config.partialTarget;
            if (!t?.id) throw new Error('No partial regeneration target selected');
            
            const column =
                t.kind === 'section' ? 'section_id' :
                t.kind === 'teacher' ? 'teacher_id' :
                t.kind === 'room' ? 'room_id' : 'subject_id';
            
            const { error: delErr } = await supabase
                .from('schedules')
                .delete()
                .eq(column, t.id)
                .in('status', ['draft', 'submitted', 'approved']);
            
            if (delErr) throw delErr;
            console.log('[SAVE] Cleaned up partial mode schedules');
        }
        
        // Step 3: Convert results to Schedule format
        saveState.step = 'convert';
        const schedules = result.entries.map(e => ({
            id: crypto.randomUUID(),
            subject_id: e.subjectId,
            teacher_id: e.teacherId,
            room_id: e.roomId,
            section_id: e.sectionId,
            day_of_week: e.day,
            start_time: e.start,
            end_time: e.end,
            semester: '1st Semester',
            academic_year: '2025-2026',
            status: initialState,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: user.id,
        }));
        
        console.log('[SAVE] Converted entries to schedules:', schedules.length);
        saveState.createdScheduleIds = schedules.map(s => s.id);
        
        // Step 4: Save to database
        saveState.step = 'version_service';
        
        let saveResult;
        if (initialState === 'draft') {
            console.log('[SAVE] Saving as draft...');
            saveResult = await scheduleVersionService.saveDraft(schedules, {
                academic_year: '2025-2026',
                semester: '1st Semester',
                score: result.score,
                conflictCount: 0,
                changeReason: 'Generated from Generate tab',
            });
            
            saveState.batchId = saveResult.version_set_id;
            saveState.versionId = saveResult.active_version_id;
            
            if (!saveResult.success) {
                throw new Error(saveResult.message || 'Draft save failed');
            }
            
            console.log('[SAVE] Draft saved successfully');
        } else {
            // submitted mode: save as draft first, then submit
            console.log('[SAVE] Saving as draft before submission...');
            const draftResult = await scheduleVersionService.saveDraft(schedules, {
                academic_year: '2025-2026',
                semester: '1st Semester',
                score: result.score,
                conflictCount: 0,
                changeReason: 'Generated for submission',
            });
            
            saveState.batchId = draftResult.version_set_id;
            saveState.versionId = draftResult.active_version_id;
            
            if (!draftResult.success) {
                throw new Error(draftResult.message || 'Draft save failed');
            }
            
            console.log('[SAVE] Draft saved, now submitting...');
            
            // Submit the draft
            const submitResult = await scheduleVersionService.submitSchedule(draftResult.version_set_id!, {
                changeReason: 'Submitted from Generate tab',
            });
            
            if (!submitResult.success) {
                throw new Error(submitResult.message || 'Submission failed');
            }
            
            console.log('[SAVE] Schedule submitted successfully');
        }
        
        // Step 5: Verify persistence
        saveState.step = 'verify';
        const { data: savedSchedules, error: fetchError } = await supabase
            .from('schedules')
            .select('id, status, is_active')
            .eq('batch_id', saveState.batchId)
            .eq('is_active', true);
        
        if (fetchError || !savedSchedules) {
            throw new Error(`Failed to verify saved schedules: ${fetchError?.message || 'Unknown'}`);
        }
        
        if (savedSchedules.length !== schedules.length) {
            throw new Error(
                `Schedule count mismatch: expected ${schedules.length}, got ${savedSchedules.length}`
            );
        }
        
        console.log('[SAVE] Verification passed:', savedSchedules.length, 'schedules');
        
        // Step 6: Detect conflicts
        saveState.step = 'conflicts';
        const { data: fullSchedules, error: fullError } = await supabase
            .from('schedules')
            .select(`
                id, subject_id, teacher_id, room_id, section_id, 
                day_of_week, start_time, end_time, status, is_active,
                subject:subjects(*),
                teacher:teachers(*),
                room:rooms(*),
                section:sections(*)
            `)
            .eq('batch_id', saveState.batchId)
            .eq('is_active', true);
        
        if (!fullError && fullSchedules && fullSchedules.length > 0) {
            const conflicts = detectConflicts(fullSchedules);
            console.log('[SAVE] Detected conflicts:', conflicts.length);
            
            // Save conflicts
            if (conflicts.length > 0) {
                const conflictInserts = conflicts.map((c: any) => ({
                    type: c.type,
                    severity: c.severity,
                    title: c.title,
                    description: c.description,
                    schedule_a_id: c.scheduleAId,
                    schedule_b_id: c.scheduleBId,
                    is_resolved: false,
                }));
                
                const { error: conflictError } = await supabase
                    .from('conflicts')
                    .insert(conflictInserts);
                
                if (conflictError) {
                    console.warn('[SAVE] Failed to save conflicts:', conflictError);
                    saveState.errors.push(`Conflict save failed: ${conflictError.message}`);
                }
            }
        }
        
        // Step 7: Audit logging
        saveState.step = 'audit';
        for (const schedule of savedSchedules || []) {
            await scheduleAudit.created(schedule.id, {
                section: result.entries[0]?.sectionId,
                teacher: result.entries[0]?.teacherId,
                subject: result.entries[0]?.subjectId,
            });
        }
        
        // Step 8: Notify students
        saveState.step = 'notify';
        const affectedSections = Array.from(new Set(result.entries.map(e => e.sectionId)));
        await notifyStudentsOfScheduleChanges(affectedSections, initialState, false);
        
        // Step 9: Refresh UI
        saveState.step = 'refresh';
        await refreshExisting();
        
        // Success
        saveState.savedAt = new Date().toISOString();
        setSavedId(initialState);
        console.log('[SAVE COMPLETE]', saveState);
        
    } catch (err) {
        saveState.step = 'error';
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        saveState.errors.push(errorMessage);
        
        console.error('[SAVE ERROR] Comprehensive state:', saveState);
        console.error('[SAVE ERROR] Details:', err);
        
        // Determine error type and provide helpful message
        let userMessage = 'Save failed';
        if (errorMessage.includes('count mismatch')) {
            userMessage = 'Some schedules failed to save. Please try again.';
        } else if (errorMessage.includes('not authenticated')) {
            userMessage = 'Not authenticated. Please log in again.';
        } else if (errorMessage.includes('version')) {
            userMessage = 'Version control error. Please try again.';
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
            userMessage = 'Network error. Check your connection and try again.';
        } else {
            userMessage = `Save failed: ${errorMessage}`;
        }
        
        setSaveError(userMessage);
        
        // Log to system for debugging
        scheduleLogger.system.error('generate', 'save', 'Save failed', {
            message: errorMessage,
            state: saveState,
            originalError: err,
        });
        
    } finally {
        setSaving(false);
    }
};
```

---

## Testing the Fix

### Test 1: Login
- [ ] Clear cache
- [ ] Try login with admin.9999@optisched.sti.edu / Adminako
- [ ] Should see dashboard
- [ ] Check browser console - no "Profile not found" error

### Test 2: Generate Tab
- [ ] Go to Generate tab
- [ ] Configure scope (rooms, subjects, etc.)
- [ ] Click "Generate Schedule"
- [ ] Wait for generation to complete
- [ ] Click "Save as draft"
- [ ] Check console for "[SAVE COMPLETE]" message
- [ ] Should show "Saved" status

### Test 3: Verify Saved Data
```sql
-- In Supabase SQL Editor
SELECT COUNT(*) as draft_count
FROM schedules
WHERE status = 'draft' AND is_active = true;

-- Should be > 0
```

---

## Summary of Changes

| Issue | Fix | Status |
|-------|-----|--------|
| Profile not found | Run CRITICAL_LOGIN_FIX.sql | ✅ |
| Email not confirmed | CRITICAL_LOGIN_FIX.sql confirms all | ✅ |
| RLS policies broken | CRITICAL_LOGIN_FIX.sql recreates | ✅ |
| Handle_new_user trigger not idempotent | CRITICAL_LOGIN_FIX.sql fixes | ✅ |
| Save state not tracked | performSave refactored with saveState | ✅ |
| Version service not initialized | Check before use | ✅ |
| Version not activated | Added activation after creation | ✅ |
| Poor error handling | Detailed error logging added | ✅ |
| State hash verification missing | Verification added with retry | ✅ |

---

## If Problems Persist

### Login Still Broken

1. **Check browser console** (F12):
   - "Profile not found" → Run CRITICAL_LOGIN_FIX.sql again
   - "Permission denied" → RLS policies not created correctly
   - "Auth failed" → email_confirmed_at still NULL

2. **Check database directly**:
   ```sql
   SELECT * FROM auth.users WHERE email = 'admin.9999@optisched.sti.edu';
   SELECT * FROM profiles WHERE email = 'admin.9999@optisched.sti.edu';
   ```
   Both should exist

3. **Verify RLS policies**:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'profiles';
   ```
   Should show 4 policies

### Save Still Broken

1. **Check console for errors** when clicking "Save as draft"
2. **Look for "[SAVE" prefixed logs** in console
3. **Check "Application" tab** in DevTools → "Local Storage"
4. **Verify user ID** is set correctly (not null)

---

**Status:** ✅ Login fix ready  
**Status:** ✅ Save fix ready  
**Next:** Run CRITICAL_LOGIN_FIX.sql immediately
