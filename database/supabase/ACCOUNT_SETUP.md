# Account Setup for OptiSched

## Current State (as of database query)

### Existing Users by Role

**Admin (1):**
- Email: admin.9999@optisched.sti.edu
- Name: Admin
- Role: admin

**Teachers (8):**
- bea.magno@optisched.sti.edu - Bea Angely Magno
- edgar.habana@optisched.sti.edu - Edgar Habana
- ello.egnacio@optisched.sti.edu - Ello Jr., Egnacio Y.
- john.calizon@optisched.sti.edu - John Michael Calizon
- mark.doblon@optisched.sti.edu - Mark Gerald Doblon
- mary.balando@optisched.sti.edu - Mary Jane Balando
- psalmmiracle.mariano@optisched.sti.edu - Psalmmiracle Pineda Mariano
- reneil.arnado@optisched.sti.edu - Reneil P. Arnado

**Students (8) - Section Assignments:**
- ABM-11a: abmstudent11.123456@optisched.sti.edu (ABMSTUDENT11)
- STEM-11a: stem12test.123456@optisched.sti.edu (STEM12TEST)
- MAWD-12a: 5 students
  - morgado.399541@optisched.sti.edu (Ace Morgado)
  - cama.496878@optisched.sti.edu (Jay Mark Cama)
  - paterno.395180@optisched.sti.edu (Johanese Gian Paterno)
  - pineda.400593@optisched.sti.edu (Sophia Anne Pineda)
  - perez.398308@optisched.sti.edu (Wayne Perez)

**Sections (6):**
- ABM-11a (Year 11) - 1 student
- MAWD-11a (Year 11) - 0 students ❌
- STEM-11a (Year 11) - 1 student
- ABM-12a (Year 12) - 0 students ❌
- MAWD-12a (Year 12) - 5 students
- STEM-12a (Year 12) - 0 students ❌

### Missing Roles (Need to Create)
- power_admin (0 needed: 1)
- system_admin (0 needed: 1)
- schedule_admin (0 needed: 1)
- schedule_manager (0 needed: 1)

### Missing Students (Need to Create)
- MAWD-11a (0 needed: 1)
- ABM-12a (0 needed: 1)
- STEM-12a (0 needed: 1)

## Instructions to Create Missing Accounts

### Step 1: Create Auth Users via Supabase Dashboard
1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user" and create the following users with password `OptiSched2024!`:

**Admin Roles:**
- power.admin@optisched.sti.edu (Power Admin)
- system.admin@optisched.sti.edu (System Admin)
- schedule.admin@optisched.sti.edu (Schedule Admin)
- schedule.manager@optisched.sti.edu (Schedule Manager)

**Students:**
- mawd11.student@optisched.sti.edu (MAWD11 Student)
- abm12.student@optisched.sti.edu (ABM12 Student)
- stem12.student@optisched.sti.edu (STEM12 Student)

### Step 2: Get User IDs
After creating the auth users, note down their UUIDs from the Supabase Dashboard.

### Step 3: Update and Run SQL Script
1. Open `create_profile_records.sql`
2. Replace the placeholder UUIDs with the actual auth user IDs from Step 2
3. Run the script in Supabase SQL Editor

### Step 4: Verify Accounts
Run the verification query in Supabase SQL Editor:
```sql
SELECT id, email, full_name, role FROM profiles 
WHERE role IN ('power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
ORDER BY role;

SELECT s.id, p.email, p.full_name, sec.name as section_name, sec.year_level 
FROM students s 
JOIN profiles p ON s.profile_id = p.id 
JOIN sections sec ON s.section_id = sec.id 
WHERE sec.name IN ('MAWD-11a', 'ABM-12a', 'STEM-12a')
ORDER BY sec.year_level, sec.name, p.full_name;
```

## Complete Account List (After Setup)

### Admin Role Accounts
| Role | Email | Password | Name |
|------|-------|----------|------|
| admin | admin.9999@optisched.sti.edu | (existing) | Admin |
| power_admin | power.admin@optisched.sti.edu | OptiSched2024! | Power Admin |
| system_admin | system.admin@optisched.sti.edu | OptiSched2024! | System Admin |
| schedule_admin | schedule.admin@optisched.sti.edu | OptiSched2024! | Schedule Admin |
| schedule_manager | schedule.manager@optisched.sti.edu | OptiSched2024! | Schedule Manager |

### Teacher Accounts
| Email | Password | Name | Section |
|-------|----------|------|---------|
| bea.magno@optisched.sti.edu | (existing) | Bea Angely Magno | - |
| edgar.habana@optisched.sti.edu | (existing) | Edgar Habana | - |
| ello.egnacio@optisched.sti.edu | (existing) | Ello Jr., Egnacio Y. | - |
| john.calizon@optisched.sti.edu | (existing) | John Michael Calizon | - |
| mark.doblon@optisched.sti.edu | (existing) | Mark Gerald Doblon | - |
| mary.balando@optisched.sti.edu | (existing) | Mary Jane Balando | - |
| psalmmiracle.mariano@optisched.sti.edu | (existing) | Psalmmiracle Pineda Mariano | - |
| reneil.arnado@optisched.sti.edu | (existing) | Reneil P. Arnado | - |

### Student Accounts by Section
| Section | Email | Password | Name | Student Number |
|---------|-------|----------|------|----------------|
| ABM-11a | abmstudent11.123456@optisched.sti.edu | (existing) | ABMSTUDENT11 | - |
| MAWD-11a | mawd11.student@optisched.sti.edu | OptiSched2024! | MAWD11 Student | MAWD11-001 |
| STEM-11a | stem12test.123456@optisched.sti.edu | (existing) | STEM12TEST | - |
| ABM-12a | abm12.student@optisched.sti.edu | OptiSched2024! | ABM12 Student | ABM12-001 |
| MAWD-12a | morgado.399541@optisched.sti.edu | (existing) | Ace Morgado | - |
| MAWD-12a | cama.496878@optisched.sti.edu | (existing) | Jay Mark Cama | - |
| MAWD-12a | paterno.395180@optisched.sti.edu | (existing) | Johanese Gian Paterno | - |
| MAWD-12a | pineda.400593@optisched.sti.edu | (existing) | Sophia Anne Pineda | - |
| MAWD-12a | perez.398308@optisched.sti.edu | (existing) | Wayne Perez | - |
| STEM-12a | stem12.student@optisched.sti.edu | OptiSched2024! | STEM12 Student | STEM12-001 |

## Notes
- All new accounts use default password: `OptiSched2024!`
- Users should change their password on first login
- Teacher accounts already exist with their existing passwords
- Student accounts for MAWD-11a, ABM-12a, and STEM-12a need to be created
