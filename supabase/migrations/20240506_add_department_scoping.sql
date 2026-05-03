-- Migration: Department-Based Data Scoping for Schedule Managers
-- Purpose: Implement PRD requirement §3.2 - schedule_managers_access_all_data rule
-- When false, Schedule Managers should only see data from their assigned department

-- Add department assignment to profiles table (for Schedule Managers)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS assigned_department TEXT;

-- Create a departments table for better department management
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    head_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on departments
CREATE INDEX IF NOT EXISTS idx_departments_name ON public.departments(name);
CREATE INDEX IF NOT EXISTS idx_departments_head_id ON public.departments(head_id);
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON public.departments(is_active);

-- Add department foreign key to teachers table
ALTER TABLE public.teachers 
ADD CONSTRAINT teachers_department_fkey 
FOREIGN KEY (department) REFERENCES public.departments(name) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Update profiles assigned_department to reference departments table
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_assigned_department_fkey 
FOREIGN KEY (assigned_department) REFERENCES public.departments(name) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.departments_id_seq TO authenticated;

-- RLS for departments table
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Department RLS policies
CREATE POLICY "Departments are viewable by everyone"
ON public.departments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "System admins can manage departments"
ON public.departments FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('system_admin', 'power_admin', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('system_admin', 'power_admin', 'admin')
    )
);

-- Update teachers RLS to respect department scoping for Schedule Managers
-- This policy allows Schedule Managers to see teachers only if:
-- 1. schedule_managers_access_all_data rule is true, OR
-- 2. The teacher's department matches the Schedule Manager's assigned_department

CREATE OR REPLACE FUNCTION get_schedule_manager_department()
RETURNS TEXT AS $$
DECLARE
    v_department TEXT;
BEGIN
    SELECT assigned_department INTO v_department
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'schedule_manager';
    
    RETURN v_department;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing teacher view policies and recreate with department scoping
DROP POLICY IF EXISTS "Teachers are viewable by everyone" ON public.teachers;
DROP POLICY IF EXISTS "Admins can manage teachers" ON public.teachers;

-- New teacher RLS policies with department scoping
CREATE POLICY "Teachers viewable based on role and department"
ON public.teachers FOR SELECT
TO authenticated
USING (
    -- Power Admin, System Admin, Schedule Admin can see all teachers
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('power_admin', 'system_admin', 'schedule_admin', 'admin')
    )
    OR
    -- Schedule Managers can see teachers only if they have access to all data
    -- OR if the teacher is in their assigned department
    (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() 
            AND p.role = 'schedule_manager'
        )
        AND (
            -- Check if schedule_managers_access_all_data rule is true
            EXISTS (
                SELECT 1 FROM public.system_rules
                WHERE rule_key = 'schedule_managers_access_all_data'
                AND (
                    rule_value::boolean = true
                    OR (
                        rule_value::text = 'true'
                        OR rule_value::text = '1'
                    )
                )
            )
            OR
            -- Or if teacher is in the same department
            (
                get_schedule_manager_department() IS NOT NULL
                AND teachers.department = get_schedule_manager_department()
            )
        )
    )
    OR
    -- Teachers can see all teachers (for collaboration)
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role = 'teacher'
    )
    OR
    -- Public teachers are viewable by everyone
    teachers.is_public = true
    OR
    -- Shared with current user
    teachers.shared_with @> ARRAY[auth.uid()]
);

CREATE POLICY "Admins can manage teachers"
ON public.teachers FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('power_admin', 'system_admin', 'schedule_admin', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('power_admin', 'system_admin', 'schedule_admin', 'admin')
    )
);

-- Similar department scoping for rooms, subjects, and sections
DROP POLICY IF EXISTS "Rooms are viewable by everyone" ON public.rooms;
DROP POLICY IF EXISTS "Admins can manage rooms" ON public.rooms;

CREATE POLICY "Rooms viewable based on role and department"
ON public.rooms FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('power_admin', 'system_admin', 'schedule_admin', 'admin')
    )
    OR
    (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() 
            AND p.role = 'schedule_manager'
        )
        AND (
            EXISTS (
                SELECT 1 FROM public.system_rules
                WHERE rule_key = 'schedule_managers_access_all_data'
                AND (
                    rule_value::boolean = true
                    OR rule_value::text = 'true'
                    OR rule_value::text = '1'
                )
            )
            OR rooms.is_public = true
            OR rooms.shared_with @> ARRAY[auth.uid()]
        )
    )
    OR rooms.owner_id = auth.uid()
);

CREATE POLICY "Admins and Schedule Managers can manage rooms"
ON public.rooms FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('power_admin', 'system_admin', 'schedule_admin', 'admin')
    )
    OR
    (
        rooms.owner_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'schedule_manager'
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('power_admin', 'system_admin', 'schedule_admin', 'admin')
    )
    OR
    (
        rooms.owner_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'schedule_manager'
        )
    )
);

-- Similar policies for subjects
DROP POLICY IF EXISTS "Subjects are viewable by everyone" ON public.subjects;
DROP POLICY IF EXISTS "Admins can manage subjects" ON public.subjects;

CREATE POLICY "Subjects viewable based on role and department"
ON public.subjects FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('power_admin', 'system_admin', 'schedule_admin', 'admin')
    )
    OR
    (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() 
            AND p.role = 'schedule_manager'
        )
        AND (
            EXISTS (
                SELECT 1 FROM public.system_rules
                WHERE rule_key = 'schedule_managers_access_all_data'
                AND (
                    rule_value::boolean = true
                    OR rule_value::text = 'true'
                    OR rule_value::text = '1'
                )
            )
            OR subjects.is_public = true
            OR subjects.shared_with @> ARRAY[auth.uid()]
        )
    )
    OR subjects.owner_id = auth.uid()
);

CREATE POLICY "Admins and Schedule Managers can manage subjects"
ON public.subjects FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('power_admin', 'system_admin', 'schedule_admin', 'admin')
    )
    OR
    (
        subjects.owner_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'schedule_manager'
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('power_admin', 'system_admin', 'schedule_admin', 'admin')
    )
    OR
    (
        subjects.owner_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'schedule_manager'
        )
    )
);

-- Similar policies for sections
DROP POLICY IF EXISTS "Sections are viewable by everyone" ON public.sections;
DROP POLICY IF EXISTS "Admins can manage sections" ON public.sections;

CREATE POLICY "Sections viewable based on role and department"
ON public.sections FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('power_admin', 'system_admin', 'schedule_admin', 'admin')
    )
    OR
    (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() 
            AND p.role = 'schedule_manager'
        )
        AND (
            EXISTS (
                SELECT 1 FROM public.system_rules
                WHERE rule_key = 'schedule_managers_access_all_data'
                AND (
                    rule_value::boolean = true
                    OR rule_value::text = 'true'
                    OR rule_value::text = '1'
                )
            )
            OR sections.is_public = true
            OR sections.shared_with @> ARRAY[auth.uid()]
        )
    )
    OR sections.owner_id = auth.uid()
);

CREATE POLICY "Admins and Schedule Managers can manage sections"
ON public.sections FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('power_admin', 'system_admin', 'schedule_admin', 'admin')
    )
    OR
    (
        sections.owner_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'schedule_manager'
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('power_admin', 'system_admin', 'schedule_admin', 'admin')
    )
    OR
    (
        sections.owner_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND role = 'schedule_manager'
        )
    )
);

-- Add comments
COMMENT ON TABLE public.departments IS 'Departments for organizing teachers and scoping Schedule Manager access';
COMMENT ON COLUMN public.profiles.assigned_department IS 'Assigned department for Schedule Managers to scope their data access';
COMMENT ON FUNCTION get_schedule_manager_department() IS 'Returns the assigned department of the current Schedule Manager user';

-- Verification
DO $$
BEGIN
    RAISE NOTICE 'Department scoping migration completed successfully';
    RAISE NOTICE 'Departments table created';
    RAISE NOTICE 'Profiles table updated with assigned_department column';
    RAISE NOTICE 'RLS policies updated to respect schedule_managers_access_all_data rule';
    RAISE NOTICE 'Schedule Managers can now be scoped to their assigned department';
END $$;
