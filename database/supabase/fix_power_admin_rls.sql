-- ============================================================================
-- FIX: Prevent RLS from allowing updates to Power Admin profiles
-- ============================================================================
-- This script fixes the RLS policy to prevent any role (including System Admin)
-- from updating Power Admin profiles, ensuring Power Admin lockout protection.

-- Drop the existing policy
DROP POLICY IF EXISTS profiles_update_hierarchical ON profiles;

-- Recreate the policy with Power Admin protection
CREATE POLICY profiles_update_hierarchical ON profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'power_admin', 'system_admin')
        )
        AND NOT (
            -- Prevent updating Power Admin profiles unless updater is also Power Admin
            EXISTS (
                SELECT 1 FROM profiles target
                WHERE target.id = profiles.id
                AND target.role = 'power_admin'
                AND NOT EXISTS (
                    SELECT 1 FROM profiles updater
                    WHERE updater.id = auth.uid()
                    AND updater.role = 'power_admin'
                )
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'power_admin', 'system_admin')
        )
        AND NOT (
            -- Prevent updating Power Admin profiles unless updater is also Power Admin
            EXISTS (
                SELECT 1 FROM profiles target
                WHERE target.id = profiles.id
                AND target.role = 'power_admin'
                AND NOT EXISTS (
                    SELECT 1 FROM profiles updater
                    WHERE updater.id = auth.uid()
                    AND updater.role = 'power_admin'
                )
            )
        )
    );

-- Verify the policy was created correctly
SELECT 
    'RLS Policy Updated' as status,
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'profiles_update_hierarchical';
