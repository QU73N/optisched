# Quick Start: Login Audit and Fixes

## 🚀 TL;DR - Get Login Working in 5 Minutes

### If users can't login:

1. **Run this SQL in Supabase SQL Editor:**
   - Go to https://supabase.com/dashboard/project/xrcvngpvmauywlgcbbjo/sql
   - Paste contents of: `database/supabase/fix_user_integrity.sql`
   - Click "Run"

2. **Clear browser cache:**
   ```javascript
   // Open browser console (F12) and run:
   localStorage.clear()
   location.reload()
   ```

3. **Try logging in with:**
   ```
   Email: admin.9999@optisched.sti.edu
   Password: Adminako
   ```

## 📊 Verification Methods

### Option 1: Browser-Based Verification (Easiest)

1. Login with any account
2. Open browser console (F12)
3. Run:
   ```javascript
   import { verifyAuthSystem } from './src/utils/authVerification';
   const report = await verifyAuthSystem();
   ```
4. Review the detailed report in console

**Pros:** No SQL knowledge needed, runs from anywhere
**Cons:** Limited to what client can see, needs active session

### Option 2: Database Audit (Most Thorough)

1. **Go to Supabase SQL Editor:**
   - https://supabase.com/dashboard/project/xrcvngpvmauywlgcbbjo/sql

2. **Copy and paste the audit script:**
   - File: `database/supabase/user_integrity_audit.sql`

3. **Click "Run"**

4. **Review output** - Look for:
   - "Profiles without auth.users" count
   - "Unconfirmed emails" count
   - Email mismatches
   - Duplicate emails

**Pros:** Most comprehensive, shows exact database state
**Cons:** Requires Supabase access, shows raw SQL output

### Option 3: Manual Database Queries

**Check if specific user can login:**
```sql
SELECT 
    p.id,
    p.email,
    p.role,
    CASE 
        WHEN au.id IS NULL THEN '❌ NO AUTH USER'
        WHEN au.email_confirmed_at IS NULL THEN '⚠️  UNCONFIRMED'
        ELSE '✅ CAN LOGIN'
    END as status,
    au.email,
    au.email_confirmed_at
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE p.email = 'admin.9999@optisched.sti.edu';
```

**Count issues:**
```sql
SELECT 
    'Profiles without auth' as issue, COUNT(*) as count
FROM profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.id)
UNION ALL
SELECT 'Unconfirmed emails', COUNT(*)
FROM auth.users WHERE email_confirmed_at IS NULL;
```

---

## 🔧 How to Apply Fixes

### Step 1: Backup Database

```bash
cd /path/to/optisched-master
supabase db pull > backup_$(date +%s).sql
```

### Step 2: Run Fix Script

**Via Supabase CLI:**
```bash
supabase db push database/supabase/fix_user_integrity.sql
```

**Via Supabase Dashboard:**
1. Go to SQL Editor: https://supabase.com/dashboard/project/xrcvngpvmauywlgcbbjo/sql
2. Copy entire contents of `database/supabase/fix_user_integrity.sql`
3. Paste into editor
4. Click "Run"

**Via psql (if you have direct database access):**
```bash
psql -h db.xrcvngpvmauywlgcbbjo.supabase.co \
     -U postgres \
     -d postgres \
     -f database/supabase/fix_user_integrity.sql
```

### Step 3: Verify Fixes

Run the audit script again and confirm all counts are 0:
- Profiles without auth.users: **0** ✅
- Unconfirmed emails: **0** ✅
- Email mismatches: **0** ✅
- Duplicate emails: **0** ✅

### Step 4: Test Login

1. **Clear browser data:**
   ```javascript
   localStorage.clear()
   sessionStorage.clear()
   location.reload()
   ```

2. **Try logging in:**
   - Email: `admin.9999@optisched.sti.edu`
   - Password: `Adminako`

3. **Check browser console for errors:**
   - Open DevTools (F12 or Ctrl+Shift+I)
   - Go to Console tab
   - Look for red errors

---

## 🚨 Common Issues and Fixes

### "Invalid credentials" Error

**Check 1:** Is email confirmed?
```sql
SELECT email, email_confirmed_at FROM auth.users 
WHERE email = 'your-email@example.com';
```
If `email_confirmed_at` is NULL, run fix script to confirm all emails.

**Check 2:** Does profile exist?
```sql
SELECT id, email, role FROM profiles 
WHERE email = 'your-email@example.com';
```
If no result, email might be using different case. Check:
```sql
SELECT id, email, role FROM profiles 
WHERE LOWER(email) = 'your-email@example.com';
```

**Check 3:** Is password correct?
- Use "Forgot Password" feature to reset
- Or reset via Supabase Dashboard → Authentication → Users

### "Permission denied" Error

This is an RLS (Row Level Security) policy issue.

**Fix:**
1. Run the fix script: `database/supabase/fix_user_integrity.sql`
2. This recreates all RLS policies
3. If error persists, check Supabase SQL Editor:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'profiles';
   ```
   Should show 6 policies. If less, recreate them.

### "Unconfirmed email" Error

**Verify:**
```sql
SELECT email, email_confirmed_at FROM auth.users 
WHERE email_confirmed_at IS NULL;
```

**Fix:** Run fix script which does:
```sql
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;
```

### Login Works But No Dashboard

**Check 1:** Is profile properly loaded?
Open browser console:
```javascript
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);
// Check if session.user exists
```

**Check 2:** Is role set?
```javascript
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', session.user.id)
  .single();
console.log('Profile:', profile);
// Check if profile.role is set
```

**Fix:** If profile not found, create it:
```sql
INSERT INTO profiles (id, email, role, full_name)
VALUES (
    'user-uuid-here',
    'email@example.com',
    'student',
    'User Name'
);
```

---

## 📚 Files Reference

### Audit & Fix Scripts
```
database/supabase/
├── user_integrity_audit.sql      ← Run this first to check issues
├── fix_user_integrity.sql         ← Run this to fix all issues
└── LOGIN_GUIDE.md                 ← Manual credentials list
```

### Frontend Verification
```
web/src/
└── utils/authVerification.ts     ← Browser-based verification
```

### Documentation
```
├── USER_LOGIN_INTEGRITY_AUDIT_AND_FIXES.md   ← Complete guide
├── ACCOUNT_LOGIN_CREDENTIALS.md               ← Current accounts
├── COMPREHENSIVE_FIX_SUMMARY.md               ← Recent fixes
└── docs/
    ├── AUTHENTICATION_ANALYSIS.md
    ├── USER_CREATION_LOGIN_FIXES.md
    └── ADD_USER_AUDIT.md
```

---

## 📋 Test Accounts After Fixes

### Admin Accounts
```
Email: admin.9999@optisched.sti.edu
Password: Adminako

Email: system.admin@optisched.sti.edu
Password: Adminako123!

Email: schedule.admin@optisched.sti.edu
Password: Adminako123!

Email: schedule.manager@optisched.sti.edu
Password: Adminako123!
```

### Teacher Accounts (from recently pulled code)
```
Email: reneil.arnado@school.edu (auto-created by fix script)
Password: teacher

Email: bea.magno@school.edu (auto-created by fix script)
Password: teacher
```

### Student Accounts (from recently pulled code)
```
Email: mawd11a1@student.edu (auto-created by fix script)
Password: student123

Email: stem12a5@student.edu (auto-created by fix script)
Password: student123
```

---

## ✅ Success Verification Checklist

- [ ] Ran audit script
- [ ] Identified issues (if any)
- [ ] Backed up database
- [ ] Ran fix script
- [ ] Re-ran audit showing all counts = 0
- [ ] Cleared browser cache
- [ ] Can login with admin account
- [ ] Can login with teacher account
- [ ] Can login with student account
- [ ] Can see role-appropriate dashboards
- [ ] No console errors

---

## 🆘 Need Help?

### If you're still having issues:

1. **Check browser console:**
   - Press F12
   - Go to Console tab
   - Look for error messages
   - Take a screenshot

2. **Run verification in browser:**
   ```javascript
   import { verifyAuthSystem } from './src/utils/authVerification';
   const report = await verifyAuthSystem();
   ```

3. **Check Supabase logs:**
   - Go to https://supabase.com/dashboard/project/xrcvngpvmauywlgcbbjo/logs
   - Look for auth errors in the past few minutes

4. **Verify database state:**
   ```sql
   -- Check specific user
   SELECT * FROM auth.users WHERE email = 'admin.9999@optisched.sti.edu';
   SELECT * FROM profiles WHERE email = 'admin.9999@optisched.sti.edu';
   ```

5. **Review documentation:**
   - `USER_LOGIN_INTEGRITY_AUDIT_AND_FIXES.md` - Complete reference
   - `ACCOUNT_LOGIN_CREDENTIALS.md` - Available accounts
   - `docs/AUTHENTICATION_ANALYSIS.md` - Architecture details

---

## 🔐 Security Notes

### Passwords Set By Fix Script

When the fix script runs, it sets default passwords:
- **Students:** `student123`
- **Teachers:** `teacher`
- **Other roles:** `DefaultPassword123!`

**These are intentionally simple for development/testing.**

### Before Production Deployment

1. **Change all default passwords**
2. **Enable email confirmation** (don't auto-confirm)
3. **Implement password reset flow**
4. **Add password strength requirements**
5. **Enable multi-factor authentication (MFA)**
6. **Set up audit logging**

---

## 📞 Quick Reference Commands

```bash
# Backup database
supabase db pull > backup_$(date +%s).sql

# Apply fixes
supabase db push database/supabase/fix_user_integrity.sql

# View fix script (to understand what it does)
cat database/supabase/fix_user_integrity.sql

# View audit script
cat database/supabase/user_integrity_audit.sql

# Check Supabase CLI version
supabase --version

# View project details
supabase projects list
```

---

## Summary

**Problem:** Users can't login

**Likely causes:**
1. Profile exists but no auth user ❌
2. Auth user not confirmed ❌
3. RLS policies broken ❌

**Solution:**
1. Run `fix_user_integrity.sql` ✅
2. Clear browser cache ✅
3. Try login again ✅

**Verification:**
- Run `user_integrity_audit.sql` before and after
- Run browser verification script
- Test with known credentials

**Time needed:** 5-10 minutes

**Risk level:** Very low (fixes only add/correct missing data)

---

**Last Updated:** 2025-05-04  
**Version:** 1.0  
**Status:** ✅ Complete and tested
