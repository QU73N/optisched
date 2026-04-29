-- ============================================================================
-- COMPREHENSIVE DATABASE VERIFICATION & AUTO-FIX SCRIPT
-- Run this in Supabase SQL Editor to verify and fix database issues
-- ============================================================================

-- ============================================================================
-- PART 1: AUTO-FIX DATA INTEGRITY ISSUES
-- ============================================================================

-- Fix 1: Create teacher records for profiles with role=teacher but no teacher record
DO $$
DECLARE 
    missing_count INTEGER;
BEGIN
    INSERT INTO public.teachers (
        profile_id, department, employment_type, max_hours, current_load_percentage,
        is_active, is_public, shared_with, owner_id, weight
    )
    SELECT 
        p.id, 
        COALESCE(p.department, 'General'), 
        'full-time', 
        40, 
        0.0,
        true, 
        true, 
        ARRAY[]::uuid[], 
        NULL,
        50
    FROM public.profiles p
    WHERE p.role = 'teacher'
        AND NOT EXISTS (SELECT 1 FROM public.teachers t WHERE t.profile_id = p.id)
    ON CONFLICT (profile_id) DO NOTHING;
    
    GET DIAGNOSTICS missing_count = ROW_COUNT;
    RAISE NOTICE '✓ Created % teacher records for profiles missing teacher entries', missing_count;
END $$;

-- Fix 2: Create teacher preferences for teachers without preferences
DO $$
DECLARE 
    missing_count INTEGER;
BEGIN
    INSERT INTO public.teacher_preferences (
        teacher_id, preferred_days, availability, preferred_time_start, preferred_time_end,
        max_classes_per_day, max_consecutive_classes, notes
    )
    SELECT 
        t.id, 
        ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']::text[],
        '{"Monday":{"morning":true,"afternoon":true,"evening":false},"Tuesday":{"morning":true,"afternoon":true,"evening":false},"Wednesday":{"morning":true,"afternoon":true,"evening":false},"Thursday":{"morning":true,"afternoon":true,"evening":false},"Friday":{"morning":true,"afternoon":true,"evening":false}}'::jsonb,
        '8:00', 
        '17:00', 
        5, 
        3, 
        'Default availability - auto-created'
    FROM public.teachers t
    WHERE NOT EXISTS (SELECT 1 FROM public.teacher_preferences tp WHERE tp.teacher_id = t.id)
    ON CONFLICT (teacher_id) DO NOTHING;
    
    GET DIAGNOSTICS missing_count = ROW_COUNT;
    RAISE NOTICE '✓ Created % teacher_preferences records for teachers missing preferences', missing_count;
END $$;

-- Fix 3: Set teachers to public if they're not
DO $$
DECLARE 
    updated_count INTEGER;
BEGIN
    UPDATE public.teachers
    SET is_public = true, shared_with = ARRAY[]::uuid[], owner_id = NULL
    WHERE is_public = false OR is_public IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✓ Updated % teachers to be public', updated_count;
END $$;

-- Fix 4: Set subjects to public if they're not
DO $$
DECLARE 
    updated_count INTEGER;
BEGIN
    UPDATE public.subjects
    SET is_public = true, shared_with = ARRAY[]::uuid[], owner_id = NULL
    WHERE is_public = false OR is_public IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✓ Updated % subjects to be public', updated_count;
END $$;

-- Fix 5: Set rooms to public if they're not
DO $$
DECLARE 
    updated_count INTEGER;
BEGIN
    UPDATE public.rooms
    SET is_public = true, shared_with = ARRAY[]::uuid[], owner_id = NULL
    WHERE is_public = false OR is_public IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✓ Updated % rooms to be public', updated_count;
END $$;

-- ============================================================================
-- PART 2: VERIFY SCHEDULES TABLE HAS ALL REQUIRED COLUMNS
-- ============================================================================

DO $$
DECLARE 
    missing_columns TEXT[];
    col_name TEXT;
    required_columns TEXT[] := ARRAY[
        'id', 'subject_id', 'teacher_id', 'room_id', 'section_id', 
        'day_of_week', 'start_time', 'end_time', 'semester', 'academic_year', 
        'status', 'created_at', 'updated_at', 'created_by', 'submitted_at', 
        'approved_by', 'approved_at', 'rejected_by', 'rejected_at', 
        'rejection_reason', 'deleted_at', 'deleted_by',
        'is_locked', 'locked_by', 'locked_at', 'lock_reason'
    ];
BEGIN
    FOREACH col_name IN ARRAY required_columns
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'schedules' 
            AND column_name = col_name
        ) THEN
            missing_columns := array_append(missing_columns, col_name);
        END IF;
    END LOOP;
    
    IF array_length(missing_columns, 1) > 0 THEN
        RAISE NOTICE '⚠ SCHEDULES TABLE MISSING COLUMNS: %', missing_columns;
    ELSE
        RAISE NOTICE '✓ All required columns exist in schedules table';
    END IF;
END $$;

-- ============================================================================
-- PART 3: VERIFY SUBJECTS TABLE HAS teacher_id COLUMN
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'subjects' 
        AND column_name = 'teacher_id'
    ) THEN
        RAISE NOTICE '⚠ SUBJECTS TABLE MISSING teacher_id COLUMN - needs migration';
    ELSE
        RAISE NOTICE '✓ teacher_id column exists in subjects table';
    END IF;
END $$;

-- ============================================================================
-- PART 4: VERIFY SCHEDULES TABLE HAS LOCKING FOREIGN KEY
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = 'public' 
        AND tc.table_name = 'schedules'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'locked_by'
    ) THEN
        RAISE NOTICE '⚠ SCHEDULES TABLE MISSING locked_by FOREIGN KEY - needs migration';
    ELSE
        RAISE NOTICE '✓ locked_by foreign key exists in schedules table';
    END IF;
END $$;

-- ============================================================================
-- PART 5: DATA COUNTS REPORT
-- ============================================================================

SELECT 
    'DATA COUNTS AFTER FIXES' as category,
    table_name,
    row_count
FROM (
    SELECT 'profiles' as table_name, COUNT(*) as row_count FROM public.profiles
    UNION ALL
    SELECT 'teachers', COUNT(*) FROM public.teachers
    UNION ALL
    SELECT 'teacher_preferences', COUNT(*) FROM public.teacher_preferences
    UNION ALL
    SELECT 'subjects', COUNT(*) FROM public.subjects
    UNION ALL
    SELECT 'rooms', COUNT(*) FROM public.rooms
    UNION ALL
    SELECT 'sections', COUNT(*) FROM public.sections
    UNION ALL
    SELECT 'schedules', COUNT(*) FROM public.schedules
) counts
ORDER BY table_name;

-- ============================================================================
-- PART 6: FINAL VERIFICATION SUMMARY
-- ============================================================================

DO $$
DECLARE 
    teacher_profiles_without_records INTEGER;
    teachers_not_public INTEGER;
    teachers_without_preferences INTEGER;
BEGIN
    -- Check teacher profiles without records
    SELECT COUNT(*) INTO teacher_profiles_without_records
    FROM public.profiles p
    WHERE p.role = 'teacher'
        AND NOT EXISTS (SELECT 1 FROM public.teachers t WHERE t.profile_id = p.id);
    
    -- Check teachers not public
    SELECT COUNT(*) INTO teachers_not_public
    FROM public.teachers
    WHERE is_public = false OR is_public IS NULL;
    
    -- Check teachers without preferences
    SELECT COUNT(*) INTO teachers_without_preferences
    FROM public.teachers t
    WHERE NOT EXISTS (SELECT 1 FROM public.teacher_preferences tp WHERE tp.teacher_id = t.id);
    
    RAISE NOTICE '=== FINAL VERIFICATION SUMMARY ===';
    RAISE NOTICE 'Teacher profiles without teacher records: %', teacher_profiles_without_records;
    RAISE NOTICE 'Teachers not public: %', teachers_not_public;
    RAISE NOTICE 'Teachers without preferences: %', teachers_without_preferences;
    
    IF teacher_profiles_without_records = 0 AND 
       teachers_not_public = 0 AND 
       teachers_without_preferences = 0 THEN
        RAISE NOTICE '✓ ALL DATA INTEGRITY ISSUES RESOLVED';
    ELSE
        RAISE NOTICE '⚠ SOME ISSUES REMAIN - review the counts above';
    END IF;
END $$;

-- ============================================================================
-- PART 7: TEST DATA FETCH (simulate frontend query)
-- ============================================================================

-- Test the exact query the frontend uses to fetch teachers
SELECT 
    'TEST: TEACHERS FETCH QUERY' as test_name,
    COUNT(*) as result_count
FROM public.teachers t
LEFT JOIN public.profiles p ON p.id = t.profile_id
WHERE t.is_public = true;

-- Test the exact query the frontend uses to fetch schedules
SELECT 
    'TEST: SCHEDULES FETCH QUERY' as test_name,
    COUNT(*) as result_count
FROM public.schedules s
LEFT JOIN public.subjects sub ON sub.id = s.subject_id
LEFT JOIN public.teachers t ON t.id = s.teacher_id
LEFT JOIN public.profiles tp ON tp.id = t.profile_id
LEFT JOIN public.rooms r ON r.id = s.room_id
LEFT JOIN public.sections sec ON sec.id = s.section_id
WHERE s.status = 'published';
