-- Fix Announcement Targeting System
-- Distinguish between "All Users" (everyone) and "All Sections" (all students only)
-- This migration adds a target_audience column to properly distinguish target audiences

-- ============================================
-- STEP 1: Add target_audience column
-- ============================================

-- Add new column with check constraint for valid values
ALTER TABLE public.announcements 
ADD COLUMN target_audience text;

-- Add check constraint for valid audience values
ALTER TABLE public.announcements 
ADD CONSTRAINT announcements_target_audience_check 
CHECK (target_audience IS NULL OR target_audience = ANY (ARRAY[
    'all_users'::text,      -- Everyone: teachers + students + admins
    'all_students'::text,   -- All students (all sections)
    'specific_section'::text,  -- Specific section
    'specific_role'::text   -- Specific role (teachers, students, etc.)
]));

-- ============================================
-- STEP 2: Migrate existing data
-- ============================================

-- Migrate existing announcements based on target_section
-- If target_section is null, set to 'all_users' (everyone sees it by default)
-- If target_section is 'all sections' (case-insensitive), set to 'all_students'
-- If target_section is 'all users' (case-insensitive), set to 'all_users'
-- If target_section is 'Teachers' (case-insensitive), set to 'specific_role'
-- If target_section is a specific section name, set to 'specific_section'
UPDATE public.announcements
SET target_audience = CASE
    WHEN target_section IS NULL THEN 'all_users'
    WHEN LOWER(TRIM(target_section)) = 'all sections' THEN 'all_students'
    WHEN LOWER(TRIM(target_section)) = 'all users' THEN 'all_users'
    WHEN LOWER(TRIM(target_section)) = 'teachers' THEN 'specific_role'
    ELSE 'specific_section'
END;

-- ============================================
-- STEP 3: Update RLS policies if needed
-- ============================================

-- The existing RLS policies should still work, but let's verify
-- Policies are in fix_rls_policies_security.sql

-- ============================================
-- STEP 4: Verification
-- ============================================

-- Check the migration results
SELECT 
    'MIGRATION VERIFICATION' as check_type,
    COUNT(*) as total_announcements,
    COUNT(CASE WHEN target_audience = 'all_users' THEN 1 END) as all_users_count,
    COUNT(CASE WHEN target_audience = 'all_students' THEN 1 END) as all_students_count,
    COUNT(CASE WHEN target_audience = 'specific_section' THEN 1 END) as specific_section_count,
    COUNT(CASE WHEN target_audience = 'specific_role' THEN 1 END) as specific_role_count
FROM public.announcements;

-- Show sample of migrated data
SELECT 
    id,
    title,
    target_section,
    target_audience,
    created_at
FROM public.announcements
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- STEP 5: Documentation
-- ============================================

/*
NEW TARGETING SYSTEM:

target_audience values:
- 'all_users': Announcement visible to everyone (teachers + students + admins)
- 'all_students': Announcement visible to all students only (all sections)
- 'specific_section': Announcement visible to a specific section (stored in target_section)
- 'specific_role': Announcement visible to a specific role (stored in target_section as role name)

target_column usage:
- When target_audience = 'specific_section', target_section contains the section name
- When target_audience = 'specific_role', target_section contains the role name
- For 'all_users' and 'all_students', target_section is NULL

BACKWARD COMPATIBILITY:
- The target_section column is kept for backward compatibility
- New code should use target_audience for filtering
- Old code that only checks target_section will still work (treats null as all)
*/
