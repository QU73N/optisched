# User Creation to Login - Comprehensive Fixes

**Date:** May 3, 2026  
**Status:** ✅ ALL FIXED

---

## Executive Summary

Fixed all critical issues in the user creation to login flow that were causing 406 errors and preventing successful user creation and login. The root cause was improper use of `.single()` which throws 406 errors when no record is found, instead of `.maybeSingle()` which returns null.

---

## Issues Identified and Fixed

### 1. AddUser.tsx - Section Lookup Issue
**Problem:**
```typescript
// Old code - caused 406 error when program was null
.eq('program', formData.program || null)
.single();
```
**Error:** `program=eq.null` in URL → 406 Not Acceptable

**Fix:**
```typescript
// New code - only filter by program if provided
let sectionQuery = supabase
    .from('sections')
    .select('id')
    .eq('name', formData.section);

if (formData.program) {
    sectionQuery = sectionQuery.eq('program', formData.program);
}

const { data: sectionData } = await sectionQuery.maybeSingle();
```

**Impact:** Students can now be created without program filtering errors.

---

### 2. AddUser.tsx - Duplicate Email Check
**Problem:**
```typescript
// Old code - threw 406 if email not found
.single();
```
**Error:** 406 Not Acceptable when checking if email exists

**Fix:**
```typescript
// New code - returns null if not found
.maybeSingle();
```

**Impact:** Email duplicate checking works without errors.

---

### 3. AddUser.tsx - Duplicate ID Number Check
**Problem:**
```typescript
// Old code - threw 406 if ID number not found
.single();
```
**Error:** 406 Not Acceptable when checking if ID number exists

**Fix:**
```typescript
// New code - returns null if not found
.maybeSingle();
```

**Impact:** ID number duplicate checking works without errors.

---

### 4. AddUser.tsx - Profile Verification
**Problem:**
```typescript
// Old code - threw 406 if profile not yet created
.single();
```
**Error:** 406 Not Acceptable during profile verification

**Fix:**
```typescript
// New code - returns null if not found
.maybeSingle();
```

**Impact:** Profile verification works without errors.

---

### 5. AddUser.tsx - Teacher Preferences Verification
**Problem:**
```typescript
// Old code - threw 406 if preferences not yet created
.single();
```
**Error:** 406 Not Acceptable during preferences verification

**Fix:**
```typescript
// New code - returns null if not found
.maybeSingle();
```

**Impact:** Teacher preferences verification works without errors.

---

### 6. AddUser.tsx - Student Record Verification
**Problem:**
```typescript
// Old code - threw 406 if student record not yet created
.single();
```
**Error:** 406 Not Acceptable during student verification

**Fix:**
```typescript
// New code - returns null if not found
.maybeSingle();
```

**Impact:** Student record verification works without errors.

---

### 7. AddUser.tsx - userId Type Error
**Problem:**
```typescript
// Old code - userId could be undefined
userId = authData.user?.id;
```
**Error:** Type 'string | undefined' not assignable to 'string | null'

**Fix:**
```typescript
// New code - explicitly handle undefined
userId = authData.user?.id || null;
```

**Impact:** Type safety improved, no TypeScript errors.

---

### 8. AddUser.tsx - Unused Function
**Problem:**
```typescript
const getDepartmentPrograms = (displayName: string): string[] => {
    return DEPARTMENT_MAPPING[displayName as keyof typeof DEPARTMENT_MAPPING]?.programs || [];
};
```
**Error:** Function declared but never used

**Fix:**
```typescript
// Removed unused function
```

**Impact:** Cleaner code, no lint errors.

---

### 9. AuthContext.tsx - Profile Fetch on Login
**Problem:**
```typescript
// Old code - threw 406 if profile not found
.single();
```
**Error:** 406 Not Acceptable when fetching profile after login

**Fix:**
```typescript
// New code - returns null if not found
.maybeSingle();

// Added null check
if (!data) {
    console.warn('Profile not found for user:', userId);
    setProfile(null);
    setRole(null);
    setRoles([]);
    setIsLoading(false);
    return;
}
```

**Impact:** Login works even if profile is missing (graceful degradation).

---

## Root Cause Analysis

### Why .single() Causes 406 Errors

Supabase's `.single()` method:
- Expects exactly one record to exist
- Throws a 406 (Not Acceptable) error if:
  - No record found
  - Multiple records found
- This is by design to enforce data integrity

Supabase's `.maybeSingle()` method:
- Returns null if no record found
- Returns the record if exactly one exists
- Throws error only if multiple records found
- Better for optional lookups and existence checks

### When to Use Each

**Use `.single()` when:**
- You are certain the record must exist
- You want an error if it doesn't
- Example: Fetching a user's own profile after authentication

**Use `.maybeSingle()` when:**
- The record might not exist
- You want to handle the null case gracefully
- Example: Checking if email/ID already exists, verifying data creation

---

## Files Modified

1. **web/src/pages/admin/AddUser.tsx**
   - Fixed 6 `.single()` calls → `.maybeSingle()`
   - Fixed section lookup to handle null program
   - Fixed userId type error
   - Removed unused function

2. **web/src/contexts/AuthContext.tsx**
   - Fixed 1 `.single()` call → `.maybeSingle()`
   - Added null check for missing profiles

---

## Testing Checklist

- [x] Student creation with program
- [x] Student creation without program
- [x] Teacher creation
- [x] Schedule manager creation
- [x] Admin creation
- [x] Duplicate email detection
- [x] Duplicate ID number detection
- [x] Profile verification after creation
- [x] Teacher preferences verification
- [x] Student record verification
- [x] Login with existing user
- [x] Login with missing profile (graceful degradation)

---

## Prevention Measures

### Code Review Guidelines

1. **Always use `.maybeSingle()` for:**
   - Duplicate checks (email, ID number, etc.)
   - Verification queries after creation
   - Optional lookups
   - Any query where the record might not exist

2. **Only use `.single()` for:**
   - Queries where the record MUST exist
   - When you want an error if it doesn't exist
   - Critical data that should always be present

3. **Always handle null/undefined:**
   - Check for null after `.maybeSingle()`
   - Use `|| null` for optional chaining results
   - Add proper error messages for missing data

### Linting Rules

Consider adding ESLint rules to prevent this:
```json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "CallExpression[callee.property.name='single']",
        "message": "Use .maybeSingle() instead of .single() to avoid 406 errors"
      }
    ]
  }
}
```

---

## Conclusion

**Status:** ✅ ALL FIXED

All 406 errors in the user creation to login flow have been resolved by:
1. Replacing `.single()` with `.maybeSingle()` for all optional lookups
2. Adding proper null checks for missing data
3. Fixing type errors
4. Removing unused code

The user creation and login flow is now robust and handles all edge cases gracefully without 406 errors.
