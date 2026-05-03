-- Verification Script for Schedule Version Control System
-- This script verifies that all version control infrastructure is properly set up

-- ---------------------------------------------------------------------------
-- 1. Verify Tables Exist
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('schedule_versions', 'schedule_version_sets', 'schedule_version_set_items');
    
    IF table_count = 3 THEN
        RAISE NOTICE '✅ All version control tables exist';
    ELSE
        RAISE NOTICE '❌ Missing version control tables (found %, expected 3)', table_count;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Verify schedule_versions Table Columns
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    missing_columns TEXT[];
BEGIN
    -- Check required columns
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schedule_versions' AND column_name = 'is_active'
    ) THEN
        missing_columns := array_append(missing_columns, 'is_active');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schedule_versions' AND column_name = 'state_hash'
    ) THEN
        missing_columns := array_append(missing_columns, 'state_hash');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schedule_versions' AND column_name = 'soft_score'
    ) THEN
        missing_columns := array_append(missing_columns, 'soft_score');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schedule_versions' AND column_name = 'conflict_count'
    ) THEN
        missing_columns := array_append(missing_columns, 'conflict_count');
    END IF;
    
    IF array_length(missing_columns, 1) IS NULL THEN
        RAISE NOTICE '✅ All required schedule_versions columns exist';
    ELSE
        RAISE NOTICE '❌ Missing schedule_versions columns: %', array_to_string(missing_columns, ', ');
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Verify RPC Functions Exist
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    function_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname IN (
        'create_schedule_version',
        'create_schedule_version_set',
        'add_version_to_set',
        'activate_schedule_version',
        'rollback_schedule_version',
        'compare_schedule_versions',
        'get_active_schedule_version'
    );
    
    IF function_count = 7 THEN
        RAISE NOTICE '✅ All version control RPC functions exist';
    ELSE
        RAISE NOTICE '❌ Missing RPC functions (found %, expected 7)', function_count;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Verify RLS Policies
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename IN ('schedule_versions', 'schedule_version_sets', 'schedule_version_set_items');
    
    IF policy_count > 0 THEN
        RAISE NOTICE '✅ RLS policies configured on version tables (% policies)', policy_count;
    ELSE
        RAISE NOTICE '⚠️  No RLS policies found on version tables';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Verify Single Active Version Constraint (if exists)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    -- Check if there's a constraint ensuring single active version
    -- This is typically enforced at application level, but we verify data integrity
    IF EXISTS (
        SELECT 1 FROM schedule_versions 
        WHERE is_active = true
        GROUP BY schedule_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE NOTICE '❌ CRITICAL: Multiple active versions detected for some schedules';
    ELSE
        RAISE NOTICE '✅ No multiple active versions detected';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Count Version Data
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    version_count INTEGER;
    version_set_count INTEGER;
    version_set_item_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO version_count FROM schedule_versions;
    SELECT COUNT(*) INTO version_set_count FROM schedule_version_sets;
    SELECT COUNT(*) INTO version_set_item_count FROM schedule_version_set_items;
    
    RAISE NOTICE '📊 Version Data Counts:';
    RAISE NOTICE '   - schedule_versions: %', version_count;
    RAISE NOTICE '   - schedule_version_sets: %', version_set_count;
    RAISE NOTICE '   - schedule_version_set_items: %', version_set_item_count;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Summary
-- ---------------------------------------------------------------------------

RAISE NOTICE '';
RAISE NOTICE '═══════════════════════════════════════════════════════════';
RAISE NOTICE 'Version Control System Verification Complete';
RAISE NOTICE '═══════════════════════════════════════════════════════════';
RAISE NOTICE '';
