-- Schema Alignment Verification Script
-- Compares actual database state with canonical schema (database_schema.sql)
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. TABLE EXISTENCE CHECK
-- ============================================
DO $$
DECLARE 
    missing_tables TEXT[];
    expected_tables TEXT[] := ARRAY[
        'admin_messages', 'admin_tasks', 'announcements', 'approval_audit_log', 
        'approval_requests', 'audit_logs', 'backup_jobs', 'chat_messages', 
        'client_error_logs', 'conflicts', 'custom_events', 'emergency_overrides', 
        'feature_flags', 'institution_breaks', 'notifications', 
        'password_reset_requests', 'priority_config', 'profiles', 
        'rate_limit_buckets', 'room_issues', 'rooms', 'schedule_change_requests', 
        'schedule_version_set_items', 'schedule_version_sets', 'schedule_versions', 
        'schedules', 'sections', 'sharing_requests', 'subjects', 'system_rules', 
        'teacher_messages', 'teacher_preferences', 'teachers', 
        'user_activity_logs', 'user_activity_logs_archive', 'user_permission_overrides'
    ];
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY expected_tables
    LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = table_name) THEN
            missing_tables := array_append(missing_tables, table_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE NOTICE 'MISSING TABLES: %', missing_tables;
    ELSE
        RAISE NOTICE '✓ All expected tables exist';
    END IF;
END $$;

-- ============================================
-- 2. CRITICAL COLUMN CHECK: schedules table
-- ============================================
DO $$
DECLARE 
    missing_columns TEXT[];
    column_name TEXT;
    expected_columns TEXT[] := ARRAY[
        'id', 'subject_id', 'teacher_id', 'room_id', 'section_id', 
        'day_of_week', 'start_time', 'end_time', 'semester', 'academic_year', 
        'status', 'created_at', 'updated_at', 'created_by', 'submitted_at', 
        'approved_by', 'approved_at', 'rejected_by', 'rejected_at', 
        'rejection_reason', 'deleted_at', 'deleted_by'
    ];
BEGIN
    FOREACH column_name IN ARRAY expected_columns
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'schedules' 
            AND column_name = column_name
        ) THEN
            missing_columns := array_append(missing_columns, column_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE NOTICE 'SCHEDULES MISSING COLUMNS: %', missing_columns;
    ELSE
        RAISE NOTICE '✓ All expected columns exist in schedules table';
    END IF;
END $$;

-- ============================================
-- 3. FOREIGN KEY CHECK: schedules
-- ============================================
DO $$
DECLARE 
    missing_fks TEXT[];
    fk_name TEXT;
BEGIN
    -- Check each expected FK
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' 
        AND tc.table_name = 'schedules'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'subject_id'
    ) THEN
        missing_fks := array_append(missing_fks, 'subject_id');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' 
        AND tc.table_name = 'schedules'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'teacher_id'
    ) THEN
        missing_fks := array_append(missing_fks, 'teacher_id');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' 
        AND tc.table_name = 'schedules'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'room_id'
    ) THEN
        missing_fks := array_append(missing_fks, 'room_id');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' 
        AND tc.table_name = 'schedules'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'section_id'
    ) THEN
        missing_fks := array_append(missing_fks, 'section_id');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' 
        AND tc.table_name = 'schedules'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'created_by'
    ) THEN
        missing_fks := array_append(missing_fks, 'created_by');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' 
        AND tc.table_name = 'schedules'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'approved_by'
    ) THEN
        missing_fks := array_append(missing_fks, 'approved_by');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' 
        AND tc.table_name = 'schedules'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'rejected_by'
    ) THEN
        missing_fks := array_append(missing_fks, 'rejected_by');
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' 
        AND tc.table_name = 'schedules'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'deleted_by'
    ) THEN
        missing_fks := array_append(missing_fks, 'deleted_by');
    END IF;
    
    IF array_length(missing_fks, 1) > 0 THEN
        RAISE NOTICE 'SCHEDULES MISSING FOREIGN KEYS: %', missing_fks;
    ELSE
        RAISE NOTICE '✓ All expected foreign keys exist in schedules table';
    END IF;
END $$;

-- ============================================
-- 4. CHECK CONSTRAINT: schedules.status
-- ============================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'schedules_status_check'
    ) THEN
        RAISE NOTICE '✓ schedules.status check constraint exists';
    ELSE
        RAISE NOTICE '⚠ schedules.status check constraint missing';
    END IF;
END $$;

-- ============================================
-- 5. COLUMN NULLABILITY CHECK: critical fields
-- ============================================
DO $$
DECLARE 
    nullable_issues TEXT[];
BEGIN
    -- subject_id should be nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'schedules' 
        AND column_name = 'subject_id' 
        AND is_nullable = 'NO'
    ) THEN
        nullable_issues := array_append(nullable_issues, 'subject_id should be nullable');
    END IF;
    
    -- teacher_id should be nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'schedules' 
        AND column_name = 'teacher_id' 
        AND is_nullable = 'NO'
    ) THEN
        nullable_issues := array_append(nullable_issues, 'teacher_id should be nullable');
    END IF;
    
    IF array_length(nullable_issues, 1) > 0 THEN
        RAISE NOTICE 'NULLABILITY ISSUES: %', nullable_issues;
    ELSE
        RAISE NOTICE '✓ Column nullability is correct';
    END IF;
END $$;

-- ============================================
-- 6. SUMMARY
-- ============================================
SELECT 
    'SCHEMA VERIFICATION COMPLETE' as status,
    'Please review the notices above for any issues' as next_step;
