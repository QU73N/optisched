-- Fix scan_results RLS policies
-- Drop existing policies and recreate with correct settings

DROP POLICY IF EXISTS "Scan results are viewable by everyone" ON public.scan_results;
DROP POLICY IF EXISTS "Admins can insert scan results" ON public.scan_results;
DROP POLICY IF EXISTS "Authenticated users can insert scan results" ON public.scan_results;

-- Create correct RLS policies
-- Anyone can view scan results (read-only for transparency)
CREATE POLICY "Scan results are viewable by everyone"
    ON public.scan_results FOR SELECT
    USING (true);

-- Authenticated users can insert scan results
CREATE POLICY "Authenticated users can insert scan results"
    ON public.scan_results FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Verify policies
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
WHERE tablename = 'scan_results';
