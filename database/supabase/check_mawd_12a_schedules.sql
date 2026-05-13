-- ============================================================================
-- CHECK MAWD-12a SCHEDULES
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Check all schedules for MAWD-12a
SELECT 'ALL MAWD-12a SCHEDULES' as info,
    day_of_week,
    status,
    is_active,
    COUNT(*) as count
FROM public.schedules
WHERE section_id = '9cc7c9ce-d40e-45fc-8594-7108ca322eb0'
GROUP BY day_of_week, status, is_active
ORDER BY day_of_week, status, is_active;

-- Check if MAWD-12a has ANY schedules
SELECT 'MAWD-12a TOTAL SCHEDULES' as info, COUNT(*) as count
FROM public.schedules
WHERE section_id = '9cc7c9ce-d40e-45fc-8594-7108ca322eb0';

-- Compare with MAWD-11a (to see if MAWD-12a was missed during generation)
SELECT 'MAWD-11a TOTAL SCHEDULES' as info, COUNT(*) as count
FROM public.schedules
WHERE section_id = '600875a9-8fc2-4c0c-a7c6-f2c76645a39a';
