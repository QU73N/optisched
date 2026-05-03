-- Fix conflicts table RLS policies to allow authenticated users to insert
-- This is needed for the conflict scanner to persist conflicts

-- Drop existing insert policy if exists
DROP POLICY IF EXISTS "Conflicts insert policy" ON public.conflicts;

-- Create new insert policy for authenticated users
CREATE POLICY "Authenticated users can insert conflicts"
    ON public.conflicts FOR INSERT
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
WHERE tablename = 'conflicts';
