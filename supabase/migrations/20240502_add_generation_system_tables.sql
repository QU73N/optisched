-- Migration: Add generation system tables and modifications
-- Date: 2024-05-02
-- This migration implements the database schema changes required for the
-- redesigned generation system per Generation_System.md

-- ============================================================================
-- 1. Create generation_runs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.generation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config jsonb NOT NULL,
  scope jsonb NOT NULL,
  seed integer NOT NULL,
  priority_settings jsonb NOT NULL,
  constraint_settings jsonb NOT NULL,
  attempt_scores jsonb,
  final_schedule jsonb,
  repair_actions jsonb,
  invalid_sessions jsonb,
  failure_reason text,
  failure_category text,
  actionable_options jsonb,
  total_sessions integer NOT NULL,
  placed_sessions integer NOT NULL,
  score numeric,
  mode text NOT NULL,
  partial_target jsonb,
  status text NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  created_by uuid,
  CONSTRAINT valid_mode CHECK (mode IN ('full', 'partial', 'draft', 'locked', 'what-if', 'emergency', 'multi-scenario')),
  CONSTRAINT valid_status CHECK (status IN ('running', 'completed', 'failed')),
  CONSTRAINT generation_runs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_generation_runs_created_by ON public.generation_runs(created_by);
CREATE INDEX IF NOT EXISTS idx_generation_runs_status ON public.generation_runs(status);
CREATE INDEX IF NOT EXISTS idx_generation_runs_mode ON public.generation_runs(mode);
CREATE INDEX IF NOT EXISTS idx_generation_runs_started_at ON public.generation_runs(started_at DESC);

-- ============================================================================
-- 2. Create institutional_policies table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.institutional_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  policy_name text NOT NULL,
  policy_value jsonb NOT NULL,
  policy_category text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  CONSTRAINT valid_category CHECK (policy_category IN ('scheduling', 'breaks', 'approvals', 'regeneration', 'overflow', 'priority_override')),
  CONSTRAINT institutional_policies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT unique_policy_per_institution UNIQUE (institution_id, policy_name, version)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_institutional_policies_institution ON public.institutional_policies(institution_id);
CREATE INDEX IF NOT EXISTS idx_institutional_policies_category ON public.institutional_policies(policy_category);
CREATE INDEX IF NOT EXISTS idx_institutional_policies_active ON public.institutional_policies(is_active) WHERE is_active = true;

-- ============================================================================
-- 3. Modify teachers table - add shared_assignment
-- ============================================================================

ALTER TABLE public.teachers
ADD COLUMN IF NOT EXISTS shared_assignment boolean DEFAULT false;

-- ============================================================================
-- 4. Modify rooms table - add compatibility and movement cost fields
-- ============================================================================

ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS subject_compatibility jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS equipment_available jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS movement_cost numeric DEFAULT 1.0;

-- ============================================================================
-- 5. Modify sections table - add load category and special rules
-- ============================================================================

ALTER TABLE public.sections
ADD COLUMN IF NOT EXISTS load_category text,
ADD COLUMN IF NOT EXISTS special_scheduling_rules jsonb DEFAULT '{}'::jsonb;

-- Add check constraint for load_category
ALTER TABLE public.sections
ADD CONSTRAINT valid_load_category CHECK (load_category IS NULL OR load_category IN ('light', 'normal', 'heavy'));

-- ============================================================================
-- 6. Modify subjects table - add monthly targets and eligibility pool
-- ============================================================================

ALTER TABLE public.subjects
ADD COLUMN IF NOT EXISTS monthly_hour_targets numeric,
ADD COLUMN IF NOT EXISTS teacher_eligibility_pool jsonb DEFAULT '{}'::jsonb;

-- ============================================================================
-- 7. Modify teacher_preferences table - add shared_assignment
-- ============================================================================

ALTER TABLE public.teacher_preferences
ADD COLUMN IF NOT EXISTS shared_assignment boolean DEFAULT false;

-- ============================================================================
-- 8. Modify schedules table - add protection fields
-- ============================================================================

ALTER TABLE public.schedules
ADD COLUMN IF NOT EXISTS is_protected boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS protection_level text,
ADD COLUMN IF NOT EXISTS protected_version_id uuid;

-- Add check constraint for protection_level
ALTER TABLE public.schedules
ADD CONSTRAINT valid_protection_level CHECK (protection_level IS NULL OR protection_level IN ('none', 'approved', 'published', 'admin_locked'));

-- Add foreign key for protected_version_id
ALTER TABLE public.schedules
ADD CONSTRAINT schedules_protected_version_id_fkey FOREIGN KEY (protected_version_id) REFERENCES public.schedule_versions(id) ON DELETE SET NULL;

-- ============================================================================
-- 9. Insert default institutional policies
-- ============================================================================

INSERT INTO public.institutional_policies (institution_id, policy_name, policy_value, policy_category, created_by) VALUES
('00000000-0000-0000-0000-000000000000'::uuid, 'split_session_support', '{"enabled": true, "max_parts": 3}', 'scheduling', NULL),
('00000000-0000-0000-0000-000000000000'::uuid, 'compressed_week_support', '{"enabled": false, "min_days": 4}', 'scheduling', NULL),
('00000000-0000-0000-0000-000000000000'::uuid, 'staggered_break_support', '{"enabled": false, "break_groups": []}', 'breaks', NULL),
('00000000-0000-0000-0000-000000000000'::uuid, 'shared_teacher_support', '{"enabled": true, "max_programs": 3}', 'scheduling', NULL),
('00000000-0000-0000-0000-000000000000'::uuid, 'deloaded_teacher_support', '{"enabled": true, "min_hours": 12}', 'scheduling', NULL),
('00000000-0000-0000-0000-000000000000'::uuid, 'special_room_fallback', '{"policy": "allow_regular", "priority": "special_first"}', 'overflow', NULL),
('00000000-0000-0000-0000-000000000000'::uuid, 'priority_override_policy', '{"policy": "preserve_high", "tie_break": "mrv"}', 'priority_override', NULL),
('00000000-0000-0000-0000-000000000000'::uuid, 'regeneration_scope_preservation', '{"preserve_published": true, "preserve_approved": true, "preserve_locked": true}', 'regeneration', NULL)
ON CONFLICT (institution_id, policy_name, version) DO NOTHING;

-- ============================================================================
-- 10. Add RLS policies for new tables
-- ============================================================================

-- Enable RLS on generation_runs
ALTER TABLE public.generation_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for generation_runs
CREATE POLICY "Users can view own generation runs" ON public.generation_runs
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "Admins can view all generation runs" ON public.generation_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('power_admin', 'super_admin', 'schedule_admin', 'admin')
    )
  );

CREATE POLICY "Users can insert own generation runs" ON public.generation_runs
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can insert generation runs" ON public.generation_runs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('power_admin', 'super_admin', 'schedule_admin', 'admin')
    )
  );

-- Enable RLS on institutional_policies
ALTER TABLE public.institutional_policies ENABLE ROW LEVEL SECURITY;

-- RLS policies for institutional_policies
CREATE POLICY "Authenticated can view active institutional policies" ON public.institutional_policies
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can view all institutional policies" ON public.institutional_policies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('power_admin', 'super_admin', 'schedule_admin', 'admin')
    )
  );

CREATE POLICY "Admins can insert institutional policies" ON public.institutional_policies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('power_admin', 'super_admin', 'schedule_admin', 'admin')
    )
  );

CREATE POLICY "Admins can update institutional policies" ON public.institutional_policies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('power_admin', 'super_admin', 'schedule_admin', 'admin')
    )
  );

CREATE POLICY "Admins can delete institutional policies" ON public.institutional_policies
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('power_admin', 'super_admin')
    )
  );

-- ============================================================================
-- 11. Create trigger for updated_at on institutional_policies
-- ============================================================================

CREATE OR REPLACE FUNCTION update_institutional_policies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER institutional_policies_updated_at
  BEFORE UPDATE ON public.institutional_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_institutional_policies_updated_at();

-- ============================================================================
-- Migration complete
-- ============================================================================
