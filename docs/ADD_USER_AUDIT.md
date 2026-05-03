# Add User Functionality - Comprehensive Audit Report

**Date:** May 3, 2026  
**Component:** `web/src/pages/admin/AddUser.tsx`  
**Severity:** CRITICAL ISSUES FOUND

---

## Executive Summary

The Add User functionality has **4 CRITICAL BUGS** that will cause data corruption, race conditions, and database inconsistencies. These issues must be fixed before the feature can be used in production.

---

## Critical Issues

### 1. ❌ CRITICAL: Subject Assignment Overwrites Previous Teachers
**Severity:** CRITICAL  
**Location:** Lines 381-386  
**Impact:** Data corruption - multiple teachers cannot teach the same subject

**Problem:**
```typescript
// Link subjects to teacher by updating subjects table
if (formData.selectedSubjects.length > 0) {
    for (const subjectId of formData.selectedSubjects) {
        await supabase.from('subjects').update({ teacher_id: userId }).eq('id', subjectId);
    }
}
```

**Issue:** The `subjects` table has a single `teacher_id` field. When you assign a subject to a new teacher, it **overwrites** the previous teacher's assignment. This means:
- If Teacher A is assigned to "Calculus", then Teacher B is also assigned to "Calculus", Teacher A loses the assignment
- Multiple teachers cannot teach the same subject
- This is a fundamental data model flaw

**Database Schema (from database_schema.sql):**
```sql
CREATE TABLE public.subjects (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  units integer NOT NULL DEFAULT 3,
  type text NOT NULL CHECK (type = ANY (ARRAY['common'::text, 'special'::text])),
  duration_hours numeric NOT NULL DEFAULT 1.5,
  program text NOT NULL,
  year_level integer NOT NULL DEFAULT 1,
  requires_lab boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  teacher_id uuid,  -- SINGLE TEACHER ONLY
  -- ...
);
```

**Required Fix:**
The subjects table needs a junction table to support many-to-many relationships:
```sql
CREATE TABLE subject_teachers (
    subject_id uuid REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id uuid REFERENCES teachers(id) ON DELETE CASCADE,
    PRIMARY KEY (subject_id, teacher_id)
);
```

**Workaround (if junction table cannot be added):**
- Remove subject assignment from teacher creation
- Add a note that subjects must be assigned manually via the subjects management page
- Or allow only one teacher per subject and warn users about overwriting

---

### 2. ❌ CRITICAL: Race Condition in Profile Creation
**Severity:** CRITICAL  
**Location:** Line 321  
**Impact:** Profile update may fail if trigger hasn't completed

**Problem:**
```typescript
// Wait for profile creation trigger
await new Promise(resolve => setTimeout(resolve, 500));
```

**Issue:** Using a fixed 500ms timeout is unreliable:
- If the trigger takes longer than 500ms, the profile won't exist yet
- If the trigger completes in 100ms, we're wasting 400ms
- Network latency and database load can vary significantly
- This is a race condition that will cause intermittent failures

**Example Failure Scenario:**
1. `supabase.auth.signUp()` succeeds
2. Database trigger starts creating profile
3. 500ms timeout expires
4. Code tries to update profile
5. Profile doesn't exist yet → UPDATE fails
6. User is left in inconsistent state (auth user exists but profile is incomplete)

**Required Fix:**
Use a retry mechanism with proper error handling:
```typescript
// Retry profile update with exponential backoff
let retries = 0;
const maxRetries = 5;
while (retries < maxRetries) {
    const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', userId);
    
    if (!profileError) break;
    
    if (profileError.code === 'PGRST116') { // Not found
        retries++;
        await new Promise(resolve => setTimeout(resolve, 200 * Math.pow(2, retries)));
    } else {
        throw profileError;
    }
}

if (retries === maxRetries) {
    throw new Error('Failed to create profile after retries');
}
```

---

### 3. ❌ CRITICAL: Hardcoded Departments Don't Match Database
**Severity:** CRITICAL  
**Location:** Lines 126-134  
**Impact:** Department dropdown shows wrong options, data inconsistencies

**Problem:**
```typescript
const hardcodedDepartments = [
    { id: 'cs', name: 'Computer Science' },
    { id: 'it', name: 'Information Technology' },
    { id: 'hm', name: 'Hospitality Management' },
    { id: 'ba', name: 'Business Administration' },
    { id: 'eng', name: 'Engineering' },
    { id: 'arts', name: 'Arts and Sciences' },
];
```

**Actual Database Departments (from recent fix):**
- Mathematics
- Physical Education
- Research
- Information Technology
- Business
- Science

**Mismatch:**
- Hardcoded: "Computer Science" → Database: "Mathematics"
- Hardcoded: "Hospitality Management" → Database: "Physical Education"
- Hardcoded: "Business Administration" → Database: "Business"
- Hardcoded: "Engineering" → Database: "Science"
- Hardcoded: "Arts and Sciences" → Database: "Research"
- Hardcoded: "Information Technology" → Database: "Information Technology" (only match)

**Impact:**
- Users will select "Computer Science" but the database stores "Mathematics"
- Department filtering in schedule generation will fail
- Data inconsistencies across the system

**Required Fix:**
Fetch departments from the database or use the correct department names:
```typescript
const hardcodedDepartments = [
    { id: 'math', name: 'Mathematics' },
    { id: 'pe', name: 'Physical Education' },
    { id: 'research', name: 'Research' },
    { id: 'it', name: 'Information Technology' },
    { id: 'business', name: 'Business' },
    { id: 'science', name: 'Science' },
];
```

Or better, fetch from database:
```typescript
const { data: deptData } = await supabase
    .from('teachers')
    .select('department')
    .not('department', 'is', null)
    .order('department');
const uniqueDepts = [...new Set(deptData?.map(d => d.department))];
setDepartments(uniqueDepts.map((name, i) => ({ id: i.toString(), name })));
```

---

### 4. ⚠️ HIGH: Teacher Preferences Incomplete
**Severity:** HIGH  
**Location:** Lines 372-379  
**Impact:** Teacher preferences may be incomplete or incorrect

**Problem:**
```typescript
const { error: prefError } = await supabase.from('teacher_preferences').insert({
    teacher_id: userId,
    preferred_days: formData.availability.map(a => a.day),
    preferred_time_start: formData.availability[0]?.start_time || '08:00',
    preferred_time_end: formData.availability[0]?.end_time || '17:00',
});
```

**Issues:**
1. **Only uses first availability slot for time range:** If a teacher has multiple availability slots (e.g., Monday 8-12, Wednesday 14-18), only the first slot's time is used for `preferred_time_start` and `preferred_time_end`
2. **No preferred_subjects:** The `preferred_subjects` field is not populated even though the user selected subjects
3. **No preferred_rooms:** The `preferred_rooms` field is empty
4. **Availability stored as array of days only:** The `availability` JSONB field is not used to store the detailed time slots

**Database Schema (teacher_preferences):**
```sql
CREATE TABLE public.teacher_preferences (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  teacher_id uuid NOT NULL UNIQUE,
  preferred_days ARRAY DEFAULT '{Monday,Tuesday,Wednesday,Thursday,Friday}'::text[],
  preferred_subjects ARRAY DEFAULT '{}'::uuid[],
  preferred_rooms ARRAY DEFAULT '{}'::uuid[],
  notes text,
  last_updated timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  availability jsonb DEFAULT '{}'::jsonb,
  preferred_time_start text DEFAULT '8:00'::text,
  preferred_time_end text DEFAULT '17:00'::text,
  max_classes_per_day integer DEFAULT 5,
  max_consecutive_classes integer DEFAULT 3,
  -- ...
);
```

**Required Fix:**
```typescript
const { error: prefError } = await supabase.from('teacher_preferences').insert({
    teacher_id: userId,
    preferred_days: formData.availability.map(a => a.day),
    preferred_subjects: formData.selectedSubjects,
    preferred_time_start: formData.availability[0]?.start_time || '08:00',
    preferred_time_end: formData.availability[formData.availability.length - 1]?.end_time || '17:00',
    availability: {
        slots: formData.availability.map(a => ({
            day: a.day,
            start_time: a.start_time,
            end_time: a.end_time
        }))
    },
    max_classes_per_day: formData.employmentStatus === 'full-time' ? 5 : 3,
    max_consecutive_classes: formData.employmentStatus === 'full-time' ? 3 : 2,
});
```

---

## Additional Issues

### 5. ⚠️ MEDIUM: No Rollback on Partial Failure
**Severity:** MEDIUM  
**Location:** Lines 293-419 (handleCreateUser)  
**Impact:** User may be left in inconsistent state if creation fails midway

**Problem:** If any step fails after auth user creation, there's no rollback:
- Auth user is created
- Profile update fails
- User can log in but has incomplete data
- No cleanup mechanism

**Required Fix:**
Implement transaction-like rollback:
```typescript
try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({...});
    if (authError) throw authError;
    
    try {
        // Update profile
        const { error: profileError } = await supabase.from('profiles').update(...);
        if (profileError) throw profileError;
        
        // Create teacher record
        if (formData.role === 'teacher') {
            const { error: teacherError } = await supabase.from('teachers').insert(...);
            if (teacherError) throw teacherError;
        }
        
        // Success
        
    } catch (dbError) {
        // Rollback: delete auth user
        await supabase.auth.admin.deleteUser(userId);
        throw dbError;
    }
} catch (error) {
    // Handle error
}
```

**Note:** This requires service role key for admin operations, which should be done via Edge Function for security.

---

### 6. ⚠️ MEDIUM: Student Section Lookup by Name is Fragile
**Severity:** MEDIUM  
**Location:** Lines 391-406  
**Impact:** May fail if section names are not unique

**Problem:**
```typescript
const { data: sectionData } = await supabase
    .from('sections')
    .select('id')
    .eq('name', formData.section)
    .single();
```

**Issue:** Looking up section by name assumes names are unique. If there are two sections with the same name (e.g., "Section A" in different programs), this will fail or return the wrong one.

**Required Fix:**
Use the section ID directly or include program in the lookup:
```typescript
const { data: sectionData } = await supabase
    .from('sections')
    .select('id')
    .eq('name', formData.section)
    .eq('program', formData.program || null)
    .single();
```

---

### 7. ℹ️ LOW: Missing Validation for Time Slots
**Severity:** LOW  
**Location:** Lines 835-913  
**Impact:** User can create invalid time slots

**Problem:** No validation that:
- `start_time` is before `end_time`
- Time slots don't overlap
- Time slots are within reasonable hours (e.g., not 2 AM)

**Required Fix:**
Add validation in `updateAvailabilitySlot`:
```typescript
const updateAvailabilitySlot = (index: number, field: keyof AvailabilitySlot, value: string) => {
    setFormData(prev => ({
        ...prev,
        availability: prev.availability.map((slot, i) => {
            if (i === index) {
                const updated = { ...slot, [field]: value };
                // Validate
                if (updated.start_time && updated.end_time) {
                    const start = parseInt(updated.start_time.replace(':', ''));
                    const end = parseInt(updated.end_time.replace(':', ''));
                    if (start >= end) {
                        setError('Start time must be before end time');
                        return slot; // Don't update
                    }
                }
                return updated;
            }
            return slot;
        })
    }));
};
```

---

## Security Concerns

### 8. ⚠️ MEDIUM: Client-Side Password Generation
**Severity:** MEDIUM  
**Location:** Lines 166-172  
**Impact:** Passwords may be weak or predictable

**Problem:**
```typescript
const generateEmail = (fullName: string, idNumber: string) => {
    const nameParts = fullName.trim().split(' ');
    const surname = nameParts[nameParts.length - 1]?.toLowerCase() || 'user';
    const idStr = idNumber?.trim() || Math.random().toString(36).slice(-6);
    const last6 = idStr.slice(-6);
    return `${surname}.${last6}@${EMAIL_DOMAIN}`;
};
```

**Issue:** 
- If ID number is not provided, uses random 6-character string
- No password generation function (password is user-provided)
- No password strength validation beyond length

**Required Fix:**
- Implement secure password generation if auto-generating
- Add password strength requirements (uppercase, lowercase, number, special char)
- Consider using a secure random generator

---

## Data Integrity Concerns

### 9. ℹ️ LOW: No Verification of Data Persistence
**Severity:** LOW  
**Location:** Lines 293-419  
**Impact:** Cannot verify if data was actually saved

**Problem:** After creating records, there's no verification that:
- Profile was actually updated
- Teacher record was created
- Student record was created
- Preferences were saved

**Required Fix:**
Add verification queries after each insert/update:
```typescript
const { data: verifyProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

if (!verifyProfile) {
    throw new Error('Profile creation verification failed');
}
```

---

## Recommendations

### Immediate Actions (Before Production):
1. **FIX CRITICAL #1:** Remove subject assignment from teacher creation OR add junction table
2. **FIX CRITICAL #2:** Implement retry mechanism for profile update
3. **FIX CRITICAL #3:** Update hardcoded departments to match database
4. **FIX HIGH #4:** Complete teacher preferences implementation

### Short-term Improvements:
5. Add rollback mechanism for partial failures
6. Fix section lookup to include program
7. Add time slot validation
8. Add data verification after creation

### Long-term Improvements:
9. Move auth operations to Edge Functions (security)
10. Add comprehensive error logging
11. Add audit trail for user creation
12. Implement proper transaction handling

---

## Test Scenarios to Validate

### Basic Functionality:
- [ ] Create student with all fields
- [ ] Create teacher with all fields
- [ ] Create schedule manager with all fields
- [ ] Create admin user

### Error Handling:
- [ ] Duplicate email
- [ ] Duplicate ID number
- [ ] Invalid email format
- [ ] Password too short
- [ ] Passwords don't match
- [ ] Missing required fields

### Edge Cases:
- [ ] No email provided (auto-generate)
- [ ] No ID number provided
- [ ] SHS student (no program/year level)
- [ ] College student (with program/year level)
- [ ] Part-time teacher
- [ ] Full-time teacher
- [ ] Multiple availability slots
- [ ] No availability slots (should be caught by validation)

### Data Persistence:
- [ ] Verify user can log in with created password
- [ ] Verify profile data is correct
- [ ] Verify teacher record exists
- [ ] Verify teacher preferences are correct
- [ ] Verify student record exists
- [ ] Verify department is correct
- [ ] Verify section is correct

---

## Conclusion

**Status:** ❌ NOT READY FOR PRODUCTION

The Add User functionality has **4 CRITICAL BUGS** that must be fixed before it can be used safely. The most severe issue is the subject assignment overwriting previous teachers, which will cause data corruption in production.

**Estimated Fix Time:** 4-6 hours for critical issues, 8-12 hours for all issues.

**Recommendation:** Fix critical issues #1, #2, #3, and #4 before allowing any user creation in production.
