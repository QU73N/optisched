-- Migration: 014_create_departments_and_governance_rules.sql
-- Description: Create departments table for teacher/schedule manager organization and add governance system rules

-- ---------------------------------------------------------------------------
-- 1. departments table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.departments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add RLS policies for departments
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read departments
CREATE POLICY departments_read_all ON public.departments
    FOR SELECT
    TO authenticated
    USING (true);

-- Only System Admin and Schedule Admin can create/update/delete departments
CREATE POLICY departments_manage ON public.departments
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('system_admin', 'schedule_admin')
        )
    );

-- ---------------------------------------------------------------------------
-- 2. Add department_id to profiles table
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

-- Create index on department_id for filtering
CREATE INDEX IF NOT EXISTS idx_profiles_department_id ON public.profiles(department_id);

-- ---------------------------------------------------------------------------
-- 3. Department-based RLS for teachers (for schedule managers)
-- ---------------------------------------------------------------------------
-- Enable RLS on teachers table (if not already enabled)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = 'teachers'
        AND schemaname = 'public'
        AND rowsecurity = true
    ) THEN
        ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Schedule managers can only see teachers in their department if rule is false
-- This is handled by application-level filtering, not RLS, for flexibility

-- ---------------------------------------------------------------------------
-- 4. Insert governance system rules
-- ---------------------------------------------------------------------------
INSERT INTO public.system_rules (rule_key, rule_value, description, category, is_active)
VALUES
    ('schedule_managers_can_create_without_approval', 'false'::jsonb, 'Allow schedule managers to create and publish schedules without approval', 'approval', true),
    ('schedule_managers_can_edit_without_approval', 'false'::jsonb, 'Allow schedule managers to edit published schedules without re-approval', 'approval', true),
    ('schedule_managers_access_all_data', 'false'::jsonb, 'Allow schedule managers to access all data (if false, only their assigned department)', 'data_access', true)
ON CONFLICT (rule_key) DO UPDATE SET
    rule_value = EXCLUDED.rule_value,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active;

-- ---------------------------------------------------------------------------
-- 5. Add session_length configuration to system rules (optional)
-- ---------------------------------------------------------------------------
INSERT INTO public.system_rules (rule_key, rule_value, description, category, is_active)
VALUES
    ('default_session_length_minutes', '60'::jsonb, 'Default session/block length in minutes for schedule generation', 'scheduling', true)
ON CONFLICT (rule_key) DO UPDATE SET
    rule_value = EXCLUDED.rule_value,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    is_active = EXCLUDED.is_active;

-- ---------------------------------------------------------------------------
-- 6. Add trigger to update updated_at on departments
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_departments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_departments_updated_at ON public.departments;
CREATE TRIGGER trigger_update_departments_updated_at
    BEFORE UPDATE ON public.departments
    FOR EACH ROW
    EXECUTE FUNCTION update_departments_updated_at();

