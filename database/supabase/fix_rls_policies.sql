-- ============================================================================
-- RLS POLICY DIAGNOSIS AND FIX
-- Run this in Supabase SQL Editor to fix RLS issues blocking frontend queries
-- ============================================================================

-- ============================================================================
-- PART 1: SHOW CURRENT RLS POLICIES
-- ============================================================================

SELECT 
    'CURRENT RLS POLICIES' as section,
    tablename,
    policyname,
    permissive,
    cmd,
    qual
FROM pg_policies 
WHERE schemaname = 'public'
    AND tablename IN ('teachers', 'schedules', 'subjects', 'rooms', 'sections')
ORDER BY tablename, policyname;

-- ============================================================================
-- PART 2: ENABLE RLS ON TABLES (if not enabled)
-- ============================================================================

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 3: DROP EXISTING POLICIES (to replace with correct ones)
-- ============================================================================

DROP POLICY IF EXISTS "Teachers can view own records" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can update own records" ON public.teachers;
DROP POLICY IF EXISTS "Public teachers are viewable" ON public.teachers;
DROP POLICY IF EXISTS "Teachers are viewable by authenticated users" ON public.teachers;
DROP POLICY IF EXISTS "Teachers are insertable by admins" ON public.teachers;
DROP POLICY IF EXISTS "Teachers are updatable by admins" ON public.teachers;
DROP POLICY IF EXISTS "Teachers are deletable by admins" ON public.teachers;
DROP POLICY IF EXISTS "Public teachers are viewable by everyone" ON public.teachers;
DROP POLICY IF EXISTS "Teachers owned by user are viewable" ON public.teachers;
DROP POLICY IF EXISTS "Teachers shared with user are viewable" ON public.teachers;

DROP POLICY IF EXISTS "Schedules can view own" ON public.schedules;
DROP POLICY IF EXISTS "Schedules can insert own" ON public.schedules;
DROP POLICY IF EXISTS "Schedules can update own" ON public.schedules;
DROP POLICY IF EXISTS "Schedules can delete own" ON public.schedules;
DROP POLICY IF EXISTS "Schedules are viewable by authenticated users" ON public.schedules;
DROP POLICY IF EXISTS "Published schedules are viewable by everyone" ON public.schedules;
DROP POLICY IF EXISTS "Schedules owned by user are viewable" ON public.schedules;
DROP POLICY IF EXISTS "Schedules are insertable by admins" ON public.schedules;
DROP POLICY IF EXISTS "Schedules are updatable by admins" ON public.schedules;

DROP POLICY IF EXISTS "Subjects are viewable by authenticated users" ON public.subjects;
DROP POLICY IF EXISTS "Subjects are insertable by admins" ON public.subjects;
DROP POLICY IF EXISTS "Subjects are updatable by admins" ON public.subjects;
DROP POLICY IF EXISTS "Subjects are deletable by admins" ON public.subjects;
DROP POLICY IF EXISTS "Public subjects are viewable by everyone" ON public.subjects;
DROP POLICY IF EXISTS "Subjects owned by user are viewable" ON public.subjects;
DROP POLICY IF EXISTS "Subjects shared with user are viewable" ON public.subjects;

DROP POLICY IF EXISTS "Rooms are viewable by authenticated users" ON public.rooms;
DROP POLICY IF EXISTS "Rooms are insertable by admins" ON public.rooms;
DROP POLICY IF EXISTS "Rooms are updatable by admins" ON public.rooms;
DROP POLICY IF EXISTS "Rooms are deletable by admins" ON public.rooms;
DROP POLICY IF EXISTS "Public rooms are viewable by everyone" ON public.rooms;
DROP POLICY IF EXISTS "Rooms owned by user are viewable" ON public.rooms;
DROP POLICY IF EXISTS "Rooms shared with user are viewable" ON public.rooms;

DROP POLICY IF EXISTS "Sections are viewable by authenticated users" ON public.sections;
DROP POLICY IF EXISTS "Sections are insertable by admins" ON public.sections;
DROP POLICY IF EXISTS "Sections are updatable by admins" ON public.sections;
DROP POLICY IF EXISTS "Sections are deletable by admins" ON public.sections;
DROP POLICY IF EXISTS "Public sections are viewable by everyone" ON public.sections;
DROP POLICY IF EXISTS "Sections owned by user are viewable" ON public.sections;
DROP POLICY IF EXISTS "Sections shared with user are viewable" ON public.sections;

-- ============================================================================
-- PART 4: CREATE CORRECT RLS POLICIES
-- ============================================================================

-- TEACHERS POLICIES
CREATE POLICY "Public teachers are viewable by everyone" 
ON public.teachers FOR SELECT 
USING (is_public = true);

CREATE POLICY "Teachers owned by user are viewable" 
ON public.teachers FOR SELECT 
USING (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "Teachers shared with user are viewable" 
ON public.teachers FOR SELECT 
USING (auth.uid() IS NOT NULL AND shared_with @> ARRAY[auth.uid()]::uuid[]);

CREATE POLICY "Teachers are insertable by admins" 
ON public.teachers FOR INSERT 
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
    )
);

CREATE POLICY "Teachers are updatable by admins" 
ON public.teachers FOR UPDATE 
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
    )
);

-- SCHEDULES POLICIES
CREATE POLICY "Published schedules are viewable by everyone" 
ON public.schedules FOR SELECT 
USING (status = 'published');

CREATE POLICY "Schedules owned by user are viewable" 
ON public.schedules FOR SELECT 
USING (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Schedules are insertable by admins" 
ON public.schedules FOR INSERT 
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
    )
);

CREATE POLICY "Schedules are updatable by admins" 
ON public.schedules FOR UPDATE 
USING (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
    )
);

-- SUBJECTS POLICIES
CREATE POLICY "Public subjects are viewable by everyone" 
ON public.subjects FOR SELECT 
USING (is_public = true);

CREATE POLICY "Subjects owned by user are viewable" 
ON public.subjects FOR SELECT 
USING (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "Subjects shared with user are viewable" 
ON public.subjects FOR SELECT 
USING (auth.uid() IS NOT NULL AND shared_with @> ARRAY[auth.uid()]::uuid[]);

CREATE POLICY "Subjects are insertable by admins" 
ON public.subjects FOR INSERT 
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
    )
);

-- ROOMS POLICIES
CREATE POLICY "Public rooms are viewable by everyone" 
ON public.rooms FOR SELECT 
USING (is_public = true);

CREATE POLICY "Rooms owned by user are viewable" 
ON public.rooms FOR SELECT 
USING (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "Rooms shared with user are viewable" 
ON public.rooms FOR SELECT 
USING (auth.uid() IS NOT NULL AND shared_with @> ARRAY[auth.uid()]::uuid[]);

CREATE POLICY "Rooms are insertable by admins" 
ON public.rooms FOR INSERT 
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
    )
);

-- SECTIONS POLICIES
CREATE POLICY "Public sections are viewable by everyone" 
ON public.sections FOR SELECT 
USING (is_public = true);

CREATE POLICY "Sections owned by user are viewable" 
ON public.sections FOR SELECT 
USING (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "Sections shared with user are viewable" 
ON public.sections FOR SELECT 
USING (auth.uid() IS NOT NULL AND shared_with @> ARRAY[auth.uid()]::uuid[]);

CREATE POLICY "Sections are insertable by admins" 
ON public.sections FOR INSERT 
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
    )
);

-- ============================================================================
-- PART 5: VERIFY POLICIES ARE CORRECT
-- ============================================================================

SELECT 
    'VERIFIED RLS POLICIES' as section,
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies 
WHERE schemaname = 'public'
    AND tablename IN ('teachers', 'schedules', 'subjects', 'rooms', 'sections')
ORDER BY tablename, policyname;

-- ============================================================================
-- PART 6: TEST DATA ACCESS
-- ============================================================================

-- Test teachers query (simulating frontend)
SELECT 
    'TEST: Teachers Query' as test_name,
    COUNT(*) as result_count
FROM public.teachers
WHERE is_public = true;

-- Test schedules query (simulating frontend)
SELECT 
    'TEST: Published Schedules Query' as test_name,
    COUNT(*) as result_count
FROM public.schedules
WHERE status = 'published';
