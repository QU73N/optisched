-- Drop old schedule_change_requests policies that may conflict
DROP POLICY IF EXISTS scr_select ON public.schedule_change_requests;
DROP POLICY IF EXISTS scr_insert ON public.schedule_change_requests;
DROP POLICY IF EXISTS scr_update ON public.schedule_change_requests;
DROP POLICY IF EXISTS scr_delete ON public.schedule_change_requests;

-- Verify remaining policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'schedule_change_requests'
ORDER BY policyname;
