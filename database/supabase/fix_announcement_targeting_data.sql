-- Fix Announcement Targeting Data Migration
-- This script fixes the data migration logic for existing announcements

-- ============================================
-- STEP 1: Update existing announcement data
-- ============================================

-- Update target_audience based on target_section
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
-- STEP 2: Verification
-- ============================================

-- Check the migration results
SELECT 
    'DATA MIGRATION VERIFICATION' as check_type,
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
