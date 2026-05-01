# Complete Account Report - OptiSched

## Executive Summary
**Total Accounts Needed:** 18 (5 admin roles + 8 teachers + 11 students)
**Currently Existing:** 17 (1 admin + 8 teachers + 8 students)
**Missing:** 7 (4 admin roles + 3 students)

---

## Current Database State

### Existing Admin Accounts (1)
| Email | Role | Name | Status |
|-------|------|------|--------|
| admin.9999@optisched.sti.edu | admin | Admin | ✅ Active |

### Existing Teacher Accounts (8)
| Email | Name | Status |
|-------|------|--------|
| bea.magno@optisched.sti.edu | Bea Angely Magno | ✅ Active |
| edgar.habana@optisched.sti.edu | Edgar Habana | ✅ Active |
| ello.egnacio@optisched.sti.edu | Ello Jr., Egnacio Y. | ✅ Active |
| john.calizon@optisched.sti.edu | John Michael Calizon | ✅ Active |
| mark.doblon@optisched.sti.edu | Mark Gerald Doblon | ✅ Active |
| mary.balando@optisched.sti.edu | Mary Jane Balando | ✅ Active |
| psalmmiracle.mariano@optisched.sti.edu | Psalmmiracle Pineda Mariano | ✅ Active |
| reneil.arnado@optisched.sti.edu | Reneil P. Arnado | ✅ Active |

**Note:** Teachers have their existing passwords (unknown to system). If password reset is needed, use Supabase Dashboard.

### Existing Student Accounts (8) - By Section

**Year 11 Sections:**
- ABM-11a: 1 student
  - abmstudent11.123456@optisched.sti.edu (ABMSTUDENT11) ✅
- MAWD-11a: 0 students ❌ (NEED 1)
- STEM-11a: 1 student
  - stem12test.123456@optisched.sti.edu (STEM12TEST) ✅

**Year 12 Sections:**
- ABM-12a: 0 students ❌ (NEED 1)
- MAWD-12a: 5 students
  - morgado.399541@optisched.sti.edu (Ace Morgado) ✅
  - cama.496878@optisched.sti.edu (Jay Mark Cama) ✅
  - paterno.395180@optisched.sti.edu (Johanese Gian Paterno) ✅
  - pineda.400593@optisched.sti.edu (Sophia Anne Pineda) ✅
  - perez.398308@optisched.sti.edu (Wayne Perez) ✅
- STEM-12a: 0 students ❌ (NEED 1)

---

## Missing Accounts (7)

### Missing Admin Role Accounts (4)
| Role | Email | Password | Name |
|------|-------|----------|------|
| power_admin | power.admin@optisched.sti.edu | OptiSched2024! | Power Admin |
| system_admin | system.admin@optisched.sti.edu | OptiSched2024! | System Admin |
| schedule_admin | schedule.admin@optisched.sti.edu | OptiSched2024! | Schedule Admin |
| schedule_manager | schedule.manager@optisched.sti.edu | OptiSched2024! | Schedule Manager |

### Missing Student Accounts (3)
| Section | Email | Password | Name | Student Number |
|---------|-------|----------|------|----------------|
| MAWD-11a | mawd11.student@optisched.sti.edu | OptiSched2024! | MAWD11 Student | MAWD11-001 |
| ABM-12a | abm12.student@optisched.sti.edu | OptiSched2024! | ABM12 Student | ABM12-001 |
| STEM-12a | stem12.student@optisched.sti.edu | OptiSched2024! | STEM12 Student | STEM12-001 |

---

## Instructions to Create Missing Accounts

### Method 1: Supabase Dashboard (Recommended)

1. **Create Auth Users:**
   - Go to: https://supabase.com/dashboard → Your Project → Authentication → Users
   - Click "Add user" for each missing account
   - Use the email and password from the tables above
   - Check "Auto confirm user" for each

2. **Create Profile Records:**
   - Go to: SQL Editor
   - Run the following query (replace UUIDs with actual auth user IDs from step 1):
   ```sql
   -- Power Admin
   INSERT INTO profiles (id, email, full_name, role) 
   VALUES ('UUID_FROM_STEP1', 'power.admin@optisched.sti.edu', 'Power Admin', 'power_admin');
   
   -- System Admin
   INSERT INTO profiles (id, email, full_name, role) 
   VALUES ('UUID_FROM_STEP1', 'system.admin@optisched.sti.edu', 'System Admin', 'system_admin');
   
   -- Schedule Admin
   INSERT INTO profiles (id, email, full_name, role) 
   VALUES ('UUID_FROM_STEP1', 'schedule.admin@optisched.sti.edu', 'Schedule Admin', 'schedule_admin');
   
   -- Schedule Manager
   INSERT INTO profiles (id, email, full_name, role) 
   VALUES ('UUID_FROM_STEP1', 'schedule.manager@optisched.sti.edu', 'Schedule Manager', 'schedule_manager');
   
   -- Students
   INSERT INTO profiles (id, email, full_name, role) 
   VALUES ('UUID_FROM_STEP1', 'mawd11.student@optisched.sti.edu', 'MAWD11 Student', 'student');
   
   INSERT INTO profiles (id, email, full_name, role) 
   VALUES ('UUID_FROM_STEP1', 'abm12.student@optisched.sti.edu', 'ABM12 Student', 'student');
   
   INSERT INTO profiles (id, email, full_name, role) 
   VALUES ('UUID_FROM_STEP1', 'stem12.student@optisched.sti.edu', 'STEM12 Student', 'student');
   ```

3. **Create Student Records:**
   ```sql
   -- Get student profile IDs and section IDs
   DO $$
   DECLARE
     mawd_11a_id uuid := (SELECT id FROM sections WHERE name = 'MAWD-11a' LIMIT 1);
     abm_12a_id uuid := (SELECT id FROM sections WHERE name = 'ABM-12a' LIMIT 1);
     stem_12a_id uuid := (SELECT id FROM sections WHERE name = 'STEM-12a' LIMIT 1);
     mawd11_id uuid := (SELECT id FROM profiles WHERE email = 'mawd11.student@optisched.sti.edu' LIMIT 1);
     abm12_id uuid := (SELECT id FROM profiles WHERE email = 'abm12.student@optisched.sti.edu' LIMIT 1);
     stem12_id uuid := (SELECT id FROM profiles WHERE email = 'stem12.student@optisched.sti.edu' LIMIT 1);
   BEGIN
     INSERT INTO students (profile_id, section_id, student_number, is_active)
     VALUES (mawd11_id, mawd_11a_id, 'MAWD11-001', true);
     
     INSERT INTO students (profile_id, section_id, student_number, is_active)
     VALUES (abm12_id, abm_12a_id, 'ABM12-001', true);
     
     INSERT INTO students (profile_id, section_id, student_number, is_active)
     VALUES (stem12_id, stem_12a_id, 'STEM12-001', true);
   END $$;
   ```

4. **Verify Accounts:**
   ```sql
   -- Check admin roles
   SELECT id, email, full_name, role FROM profiles 
   WHERE role IN ('power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
   ORDER BY role;
   
   -- Check students by section
   SELECT s.id, p.email, p.full_name, sec.name as section_name, sec.year_level 
   FROM students s 
   JOIN profiles p ON s.profile_id = p.id 
   JOIN sections sec ON s.section_id = sec.id 
   ORDER BY sec.year_level, sec.name, p.full_name;
   ```

### Method 2: Using Provided Script

1. Set environment variables:
   ```bash
   export SUPABASE_URL="your-project-url"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

2. Run the script:
   ```bash
   cd database/supabase
   npx tsx create_accounts.ts
   ```

---

## Final Account List (After Setup)

### Complete Admin Roster (5)
| Role | Email | Password | Name | Status |
|------|-------|----------|------|--------|
| admin | admin.9999@optisched.sti.edu | (existing) | Admin | ✅ Active |
| power_admin | power.admin@optisched.sti.edu | OptiSched2024! | Power Admin | ⏳ To Create |
| system_admin | system.admin@optisched.sti.edu | OptiSched2024! | System Admin | ⏳ To Create |
| schedule_admin | schedule.admin@optisched.sti.edu | OptiSched2024! | Schedule Admin | ⏳ To Create |
| schedule_manager | schedule.manager@optisched.sti.edu | OptiSched2024! | Schedule Manager | ⏳ To Create |

### Complete Teacher Roster (8)
| Email | Password | Name | Status |
|-------|----------|------|--------|
| bea.magno@optisched.sti.edu | (existing) | Bea Angely Magno | ✅ Active |
| edgar.habana@optisched.sti.edu | (existing) | Edgar Habana | ✅ Active |
| ello.egnacio@optisched.sti.edu | (existing) | Ello Jr., Egnacio Y. | ✅ Active |
| john.calizon@optisched.sti.edu | (existing) | John Michael Calizon | ✅ Active |
| mark.doblon@optisched.sti.edu | (existing) | Mark Gerald Doblon | ✅ Active |
| mary.balando@optisched.sti.edu | (existing) | Mary Jane Balando | ✅ Active |
| psalmmiracle.mariano@optisched.sti.edu | (existing) | Psalmmiracle Pineda Mariano | ✅ Active |
| reneil.arnado@optisched.sti.edu | (existing) | Reneil P. Arnado | ✅ Active |

### Complete Student Roster by Section (11)

**ABM-11a (Year 11):**
- abmstudent11.123456@optisched.sti.edu (ABMSTUDENT11) ✅

**MAWD-11a (Year 11):**
- mawd11.student@optisched.sti.edu (MAWD11 Student) ⏳ To Create

**STEM-11a (Year 11):**
- stem12test.123456@optisched.sti.edu (STEM12TEST) ✅

**ABM-12a (Year 12):**
- abm12.student@optisched.sti.edu (ABM12 Student) ⏳ To Create

**MAWD-12a (Year 12):**
- morgado.399541@optisched.sti.edu (Ace Morgado) ✅
- cama.496878@optisched.sti.edu (Jay Mark Cama) ✅
- paterno.395180@optisched.sti.edu (Johanese Gian Paterno) ✅
- pineda.400593@optisched.sti.edu (Sophia Anne Pineda) ✅
- perez.398308@optisched.sti.edu (Wayne Perez) ✅

**STEM-12a (Year 12):**
- stem12.student@optisched.sti.edu (STEM12 Student) ⏳ To Create

---

## Important Notes

1. **Default Password:** All new accounts use `OptiSched2024!` - users should change this on first login
2. **Teacher Passwords:** Existing teacher accounts have their original passwords (not known to system). Reset via Supabase Dashboard if needed
3. **Section Coverage:** After setup, all 6 sections will have at least 1 student
4. **Role Hierarchy:**
   - power_admin: Full system access
   - system_admin: User management and system settings
   - schedule_admin: Schedule approval and conflict resolution
   - schedule_manager: Schedule creation and data management
5. **Verification:** Run the verification queries after setup to confirm all accounts are working

---

## Verification Queries

Run these in Supabase SQL Editor to verify setup:

```sql
-- Check all profiles by role
SELECT role, COUNT(*) as count 
FROM profiles 
GROUP BY role 
ORDER BY role;

-- Check student distribution by section
SELECT sec.name as section, sec.year_level, COUNT(s.id) as student_count
FROM sections sec
LEFT JOIN students s ON sec.id = s.section_id
GROUP BY sec.name, sec.year_level
ORDER BY sec.year_level, sec.name;

-- Verify admin roles exist
SELECT id, email, full_name, role FROM profiles 
WHERE role IN ('power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
ORDER BY role;
```
