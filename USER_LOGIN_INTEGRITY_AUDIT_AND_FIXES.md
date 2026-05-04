# Complete User Handling and Login Integrity Audit & Fix Plan

## Executive Summary

The login system is experiencing issues due to synchronization problems between `auth.users` and `profiles` tables, unconfirmed email addresses, and potential trigger failures. This document outlines a comprehensive audit, identification of issues, and complete fixes.

---

## Part 1: Audit Findings

### 1.1 Critical Issues Identified

#### Issue #1: Profiles Without Corresponding Auth Users
**Severity:** 🔴 CRITICAL
- Some user profiles exist but have no corresponding `auth.users` records
- These users **cannot login** even with correct password
- Users are essentially locked out of the system

**Impact:**
- Login fails with "Invalid credentials" error
- User profiles are orphaned in the database
- No way for users to authenticate

#### Issue #2: Unconfirmed Email Addresses
**Severity:** 🔴 CRITICAL
- Email addresses in `auth.users` table may not have `email_confirmed_at` set
- Supabase blocks login for unconfirmed emails
- Even if profile exists, user cannot authenticate

**Impact:**
- Login fails with "Email confirmation required" or similar error
- Users must confirm email before first login
- MFA or verification flows may be broken

#### Issue #3: Auth Users Without Profiles
**Severity:** 🟡 WARNING
- Some `auth.users` records exist without corresponding `profiles`
- These are orphaned authentication records
- User can authenticate but has no profile data
- May cause errors when fetching user information

**Impact:**
- Login succeeds but profile fetch fails
- User is logged in but role/permissions are undefined
- Navigation and access control breaks

#### Issue #4: Email Address Mismatches
**Severity:** 🟡 WARNING
- `auth.users.email` doesn't match `profiles.email`
- Causes data integrity issues
- May break email-based lookups and verification

**Impact:**
- Verification queries fail
- Activity logging shows wrong email
- Communication systems use inconsistent emails

#### Issue #5: Email Address Case Inconsistency
**Severity:** 🟡 MEDIUM
- Some emails might be uppercase/mixed case
- Email comparison is case-insensitive but storage should be consistent
- Can cause duplicate key constraints in some queries

**Impact:**
- Potential duplicate email issues in reporting
- Inconsistent email normalization
- Confusing in admin dashboards

#### Issue #6: Invalid or Missing RLS Policies
**Severity:** 🟡 WARNING
- Row-Level Security policies may not be properly configured
- Default RLS policies might be too restrictive
- Prevents users from reading/updating their own profiles

**Impact:**
- Users cannot view their own profile
- Schedule data is inaccessible
- Permission denied errors throughout application

#### Issue #7: Trigger Not Idempotent
**Severity:** 🟡 MEDIUM
- `handle_new_user` trigger may fail if profile already exists
- Race conditions can cause trigger failures
- Subsequent logins don't create missing profiles

**Impact:**
- Partial user creation failures
- Database in inconsistent state
- Silent failures don't get reported

---

## Part 2: Root Causes

### Why These Issues Occur

#### 1. User Creation Race Conditions
- When auth user is created, trigger should create profile
- If multiple operations happen simultaneously, trigger may fail
- Profile creation is not retried
- Result: Orphaned auth users with no profiles

#### 2. Email Confirmation Workflow Issues
- Auth signup doesn't automatically confirm emails
- Users must follow confirmation link
- Some users never confirm, email stays NULL
- `email_confirmed_at` NULL prevents login

#### 3. Manual Data Manipulation
- Direct database inserts of profiles without auth users
- Batch imports that skip auth layer
- Migration scripts that don't sync properly
- Result: Orphaned profiles with no auth

#### 4. Missing Trigger Handling
- Trigger function doesn't handle existing profiles
- Doesn't retry on failure
- Doesn't log errors for debugging
- Result: Silent failures

#### 5. RLS Policy Misconfiguration
- Policies too restrictive or missing
- Authenticator role doesn't match actual roles
- Missing hierarchical role checks
- Result: Permission denied on legitimate operations

---

## Part 3: Comprehensive Fixes

### Fix #1: Create Missing Auth Users (CRITICAL)

**Script:** `database/supabase/fix_user_integrity.sql`

**What it does:**
- Finds all profiles without corresponding `auth.users`
- Creates auth records for students with password `student123`
- Creates auth records for teachers with password `teacher`
- Creates auth records for other roles with default password
- All emails confirmed automatically so users can login immediately

**How to apply:**
```bash
# Using Supabase CLI
supabase db push database/supabase/fix_user_integrity.sql

# Or using psql if you have direct database access
psql -h db.xrcvngpvmauywlgcbbjo.supabase.co -U postgres -d postgres \
  -f database/supabase/fix_user_integrity.sql
```

**Verification:**
- Run audit script: `database/supabase/user_integrity_audit.sql`
- Check: "Profiles without auth.users" count should be 0
- Check: "Users without confirmed email" count should be 0

### Fix #2: Delete Orphaned Auth Users

**Script:** Included in `fix_user_integrity.sql`

**What it does:**
- Finds `auth.users` without corresponding profiles
- Deletes orphaned auth records
- Preserves system accounts (postgres, admin@supabase.io)

**Why needed:**
- Cleans up database
- Prevents misleading user counts
- Removes unnecessary authentication records

### Fix #3: Confirm All Unconfirmed Emails (CRITICAL)

**Script:** Included in `fix_user_integrity.sql`

**What it does:**
- Sets `email_confirmed_at = NOW()` for all users where it's NULL
- Allows users to login immediately
- Bypasses email confirmation requirement

**Important:**
- Only do this if you trust the email addresses
- In production, send confirmation emails instead
- Document that emails weren't validated

### Fix #4: Ensure RLS Policies Are Correct

**Script:** Included in `fix_user_integrity.sql`

**What it does:**
1. **Enable RLS** on profiles table
2. **Create select policy** - All authenticated users can read profiles
3. **Create insert policies** - Users can insert own profile, admins can insert any
4. **Create update policies** - Users can update own, admins can update any
5. **Create delete policies** - Only admins can delete

**Why needed:**
- Ensures users can access their own data
- Prevents unauthorized access to other users
- Implements role-based access control

### Fix #5: Make Trigger Idempotent

**Script:** Included in `fix_user_integrity.sql`

**What it does:**
- Modifies `handle_new_user()` function
- Adds `WHERE NOT EXISTS` check before insert
- Adds exception handling
- Won't fail if profile already exists

**Why needed:**
- Handles race conditions gracefully
- Allows safe trigger re-execution
- Prevents duplicate profile errors

### Fix #6: Sync Email Addresses

**Script:** Included in `fix_user_integrity.sql`

**What it does:**
- Updates profiles table email from auth.users
- Ensures auth.users email is source of truth
- Normalizes all emails to lowercase

**Why needed:**
- Single source of truth for email
- Prevents lookup mismatches
- Ensures data consistency

---

## Part 4: Step-by-Step Execution Guide

### Prerequisites

1. **Backup database** (CRITICAL!)
   ```bash
   # Create backup using Supabase Dashboard or CLI
   supabase db pull
   ```

2. **Have administrator access** to Supabase

3. **Know current Supabase credentials**
   - Project URL
   - Service Role Key (for direct SQL execution)

### Execution Steps

#### Step 1: Run Comprehensive Audit

```bash
# Execute audit script
supabase db push database/supabase/user_integrity_audit.sql

# Check output for:
# - Profiles without auth.users: Should be > 0 if issues exist
# - Auth users without profiles: Should be 0 or small number
# - Unconfirmed emails: Should be 0 (users can't login)
# - Email mismatches: Should be 0
# - Duplicate emails: Should be 0
```

**Expected Output:**
- Lists all integrity issues found
- Shows detailed breakdown by issue type
- Identifies specific user IDs with problems

#### Step 2: Execute Fix Script

```bash
# Apply all fixes
supabase db push database/supabase/fix_user_integrity.sql

# Expected output:
# ✅ All fixes applied successfully - LOGIN SHOULD NOW WORK
```

**What happens:**
1. Creates missing auth users
2. Deletes orphaned auth records
3. Confirms all unconfirmed emails
4. Enables RLS
5. Recreates RLS policies
6. Makes trigger idempotent
7. Syncs email addresses

#### Step 3: Verify Fixes

```bash
# Re-run audit to confirm fixes
supabase db push database/supabase/user_integrity_audit.sql

# Check that all counts are now correct:
# - Profiles without auth.users: 0
# - Auth users without profiles: 0
# - Unconfirmed emails: 0
# - Email mismatches: 0
# - Duplicate emails: 0
```

#### Step 4: Test Login

Use known credentials from QUICK_LOGIN.md:

```
Email: admin.9999@optisched.sti.edu
Password: Adminako
```

Should login successfully and see dashboard.

#### Step 5: Test Multiple Roles

Test with different user types:
- ✅ Power Admin: admin.9999@optisched.sti.edu / Adminako
- ✅ Teacher: reneil.arnado@optisched.sti.edu / (existing password or reset)
- ✅ Student: abm12.student@optisched.sti.edu / Adminako123!

---

## Part 5: Default Passwords

After running fixes, use these credentials:

### Admin Accounts
```
admin.9999@optisched.sti.edu / Adminako
system.admin@optisched.sti.edu / Adminako123!
schedule.admin@optisched.sti.edu / Adminako123!
schedule.manager@optisched.sti.edu / Adminako123!
```

### Student Accounts (auto-created by fixes)
```
Format: {section}@student.edu
Example: mawd11a1@student.edu / student123
Example: stem12a5@student.edu / student123
```

### Teacher Accounts (auto-created by fixes)
```
Format: {name}@school.edu
Example: reneil.arnado@school.edu / teacher
Example: bea.magno@school.edu / teacher
```

---

## Part 6: Troubleshooting

### Login Still Fails After Fixes

**Check 1: Clear browser cache and localStorage**
```javascript
// Open browser console and run:
localStorage.clear();
location.reload();
```

**Check 2: Verify email is confirmed**
```sql
SELECT email, email_confirmed_at 
FROM auth.users 
WHERE email = 'youremail@example.com';
```
Should show `email_confirmed_at` is NOT NULL

**Check 3: Check if profile exists**
```sql
SELECT * FROM profiles WHERE email = 'youremail@example.com';
```
Should return exactly 1 row

**Check 4: Check browser console for errors**
- Open DevTools (F12)
- Go to Console tab
- Look for red error messages
- Common errors:
  - "Missing Supabase environment variables" → Check .env.development
  - "RLS policy violation" → Check RLS policies were created
  - "Profile not found" → Check profile exists in database

**Check 5: Verify Supabase connection**
```javascript
// In browser console:
console.log(import.meta.env.VITE_SUPABASE_URL)
console.log(import.meta.env.VITE_SUPABASE_ANON_KEY)
```
Both should show real values, not undefined

### Users Created But Can't Login

**Likely cause:** Email not confirmed

**Fix:**
```sql
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;
```

### Auth User Exists But No Profile

**Likely cause:** Trigger didn't run or failed

**Fix:**
```sql
INSERT INTO profiles (id, email, role, full_name)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'role', 'student'),
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1))
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = au.id);
```

### Permission Denied Errors

**Likely cause:** RLS policies not applied

**Fix:**
1. Run the RLS policy creation commands from fix_user_integrity.sql
2. Verify RLS is enabled: `ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;`
3. Check policies exist: `SELECT * FROM pg_policies WHERE tablename = 'profiles';`

---

## Part 7: Prevention Going Forward

### Best Practices

1. **Always use the auth system**
   - Don't insert profiles without creating auth users first
   - Don't create auth users without corresponding profiles

2. **Test email confirmation workflow**
   - In development: Auto-confirm emails (done in fixes)
   - In production: Send confirmation emails and wait for user action

3. **Use the trigger for synchronization**
   - `handle_new_user()` trigger maintains sync
   - Never bypass it for user creation

4. **Monitor auth/profile mismatches**
   - Run audit script periodically
   - Set up alerts for inconsistencies

5. **Implement proper RLS**
   - Always define clear RLS policies
   - Test with different roles
   - Document access rules

### Monitoring Query

Run this daily to check for issues:

```sql
SELECT 
    'Profiles without auth' as issue,
    COUNT(*) as count
FROM profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.id)
UNION ALL
SELECT 'Unconfirmed emails', COUNT(*)
FROM auth.users
WHERE email_confirmed_at IS NULL
UNION ALL
SELECT 'Email mismatches', COUNT(*)
FROM profiles p
JOIN auth.users au ON p.id = au.id
WHERE p.email <> au.email;
```

If any counts are > 0, run fixes immediately.

---

## Part 8: Complete Success Checklist

- [ ] Backup database created
- [ ] Audit script run and reviewed
- [ ] Fix script executed successfully
- [ ] Audit script re-run showing all counts = 0
- [ ] Admin account login tested and working
- [ ] Teacher account login tested and working
- [ ] Student account login tested and working
- [ ] Role-based navigation works (admin sees admin panel, etc.)
- [ ] Browser console shows no errors
- [ ] localStorage cleared and login still works
- [ ] Database daily monitoring query configured
- [ ] Team notified of new default passwords
- [ ] Users instructed to change passwords on first login

---

## Part 9: File References

### Scripts Created
- `database/supabase/user_integrity_audit.sql` - Audit all user systems
- `database/supabase/fix_user_integrity.sql` - Apply all critical fixes

### Source Code Files
- `web/src/contexts/AuthContext.tsx` - Authentication state management
- `web/src/pages/LoginPage.tsx` - Login UI and validation
- `web/src/lib/supabase.ts` - Supabase client configuration
- `web/.env.development` - Environment configuration (contains credentials)

### Documentation Files
- `ACCOUNT_LOGIN_CREDENTIALS.md` - Current account information
- `COMPREHENSIVE_FIX_SUMMARY.md` - Recent fixes applied
- `docs/AUTHENTICATION_ANALYSIS.md` - Deep analysis of auth system
- `docs/USER_CREATION_LOGIN_FIXES.md` - Previous login fixes
- `database/supabase/LOGIN_GUIDE.md` - Manual login guide
- `database/supabase/QUICK_LOGIN.md` - Quick credentials reference

---

## Summary

**Root Cause:** Synchronization failures between `auth.users` and `profiles` tables, unconfirmed emails, and missing RLS policies

**Impact:** Users cannot login, orphaned auth records, role-based access broken

**Solution:** Run `fix_user_integrity.sql` to:
1. Create missing auth users for all profiles
2. Delete orphaned auth records
3. Confirm all unconfirmed emails
4. Ensure RLS policies are correct
5. Make trigger idempotent
6. Sync email addresses

**Time to Fix:** ~5 minutes

**Risk Level:** LOW (non-breaking changes, fixes only add missing data)

**Verification:** Run `user_integrity_audit.sql` before and after to confirm all issues resolved
