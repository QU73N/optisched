-- ============================================================================
-- Priority System Implementation
-- PRD §13.3
--
-- Purpose: Enable configurable priority weighting for sections, subjects, teachers, and rooms
-- This allows the schedule generator to prioritize certain entities during conflict resolution
--
-- Design:
-- - Add weight/priority fields to teachers, subjects, and rooms (sections already have weight)
-- - Create global priority configuration table
-- - Create helper functions for priority calculations
-- - Enable flexible priority-based scheduling
-- ============================================================================

-- Add priority weight to teachers table
ALTER TABLE public.teachers
    ADD COLUMN IF NOT EXISTS weight integer NOT NULL DEFAULT 50 CHECK (weight >= 0 AND weight <= 100),
    ADD COLUMN IF NOT EXISTS priority_note text;

-- Add index for teacher priority queries
CREATE INDEX IF NOT EXISTS ix_teachers_weight
    ON public.teachers(weight DESC, is_active)
    WHERE is_active = true;

-- Add priority weight to subjects table
ALTER TABLE public.subjects
    ADD COLUMN IF NOT EXISTS weight integer NOT NULL DEFAULT 50 CHECK (weight >= 0 AND weight <= 100),
    ADD COLUMN IF NOT EXISTS priority_note text;

-- Add index for subject priority queries
CREATE INDEX IF NOT EXISTS ix_subjects_weight
    ON public.subjects(weight DESC);

-- Add priority weight to rooms table
ALTER TABLE public.rooms
    ADD COLUMN IF NOT EXISTS weight integer NOT NULL DEFAULT 50 CHECK (weight >= 0 AND weight <= 100),
    ADD COLUMN IF NOT EXISTS priority_note text;

-- Add index for room priority queries
CREATE INDEX IF NOT EXISTS ix_rooms_weight
    ON public.rooms(weight DESC, is_available)
    WHERE is_available = true;

-- Create global priority configuration table
CREATE TABLE IF NOT EXISTS public.priority_config (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    key text NOT NULL UNIQUE,
    value jsonb NOT NULL DEFAULT '{}'::jsonb,
    description text,
    category text NOT NULL DEFAULT 'general',
    is_active boolean NOT NULL DEFAULT true,
    updated_by uuid,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT priority_config_pkey PRIMARY KEY (id),
    CONSTRAINT priority_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id)
);

-- Add indexes for priority config
CREATE INDEX IF NOT EXISTS ix_priority_config_category
    ON public.priority_config(category, is_active)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS ix_priority_config_key
    ON public.priority_config(key)
    WHERE is_active = true;

-- Insert default priority configurations
INSERT INTO public.priority_config (key, value, description, category) VALUES
    ('section_weight_multiplier', '{"multiplier": 1.0}', 'Multiplier for section weights in priority calculation', 'general'),
    ('teacher_weight_multiplier', '{"multiplier": 1.0}', 'Multiplier for teacher weights in priority calculation', 'general'),
    ('subject_weight_multiplier', '{"multiplier": 1.0}', 'Multiplier for subject weights in priority calculation', 'general'),
    ('room_weight_multiplier', '{"multiplier": 1.0}', 'Multiplier for room weights in priority calculation', 'general'),
    ('conflict_resolution_strategy', '{"strategy": "highest_weight"}', 'Strategy for resolving conflicts: highest_weight, earliest_slot, balanced', 'general'),
    ('priority_threshold', '{"threshold": 60}', 'Minimum weight to be considered high priority', 'general')
ON CONFLICT (key) DO NOTHING;

-- Function to calculate combined priority score for a schedule assignment
CREATE OR REPLACE FUNCTION public.calculate_priority_score(
    p_section_id uuid,
    p_subject_id uuid,
    p_teacher_id uuid,
    p_room_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_section_weight numeric DEFAULT 50;
    v_subject_weight numeric DEFAULT 50;
    v_teacher_weight numeric DEFAULT 50;
    v_room_weight numeric DEFAULT 50;
    v_section_multiplier numeric DEFAULT 1.0;
    v_subject_multiplier numeric DEFAULT 1.0;
    v_teacher_multiplier numeric DEFAULT 1.0;
    v_room_multiplier numeric DEFAULT 1.0;
    v_combined_score numeric;
BEGIN
    -- Get section weight (sections table already has weight from hierarchy migration)
    SELECT weight INTO v_section_weight
    FROM public.sections
    WHERE id = p_section_id;
    
    -- Get subject weight
    SELECT weight INTO v_subject_weight
    FROM public.subjects
    WHERE id = p_subject_id;
    
    -- Get teacher weight
    SELECT weight INTO v_teacher_weight
    FROM public.teachers
    WHERE id = p_teacher_id;
    
    -- Get room weight
    SELECT weight INTO v_room_weight
    FROM public.rooms
    WHERE id = p_room_id;
    
    -- Get multipliers from config
    SELECT (value->>'multiplier')::numeric INTO v_section_multiplier
    FROM public.priority_config
    WHERE key = 'section_weight_multiplier' AND is_active = true;
    
    SELECT (value->>'multiplier')::numeric INTO v_subject_multiplier
    FROM public.priority_config
    WHERE key = 'subject_weight_multiplier' AND is_active = true;
    
    SELECT (value->>'multiplier')::numeric INTO v_teacher_multiplier
    FROM public.priority_config
    WHERE key = 'teacher_weight_multiplier' AND is_active = true;
    
    SELECT (value->>'multiplier')::numeric INTO v_room_multiplier
    FROM public.priority_config
    WHERE key = 'room_weight_multiplier' AND is_active = true;
    
    -- Calculate combined score (weighted average)
    v_combined_score := (
        COALESCE(v_section_weight, 50) * COALESCE(v_section_multiplier, 1.0) +
        COALESCE(v_subject_weight, 50) * COALESCE(v_subject_multiplier, 1.0) +
        COALESCE(v_teacher_weight, 50) * COALESCE(v_teacher_multiplier, 1.0) +
        COALESCE(v_room_weight, 50) * COALESCE(v_room_multiplier, 1.0)
    ) / 4;
    
    RETURN v_combined_score;
END;
$$;

-- Function to get priority tier for a score
CREATE OR REPLACE FUNCTION public.get_priority_tier(p_score numeric)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_threshold numeric DEFAULT 60;
BEGIN
    -- Get threshold from config
    SELECT (value->>'threshold')::numeric INTO v_threshold
    FROM public.priority_config
    WHERE key = 'priority_threshold' AND is_active = true;
    
    IF p_score >= v_threshold THEN
        RETURN 'high';
    ELSIF p_score >= 40 THEN
        RETURN 'medium';
    ELSE
        RETURN 'low';
    END IF;
END;
$$;

-- Function to update priority configuration
CREATE OR REPLACE FUNCTION public.update_priority_config(
    p_key text,
    p_value jsonb,
    p_updated_by uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- If no updated_by provided, use current user
    IF p_updated_by IS NULL THEN
        p_updated_by := auth.uid();
    END IF;
    
    UPDATE public.priority_config
    SET 
        value = p_value,
        updated_by = p_updated_by,
        updated_at = now()
    WHERE key = p_key;
    
    RETURN FOUND;
END;
$$;

-- Enable RLS
ALTER TABLE public.priority_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for priority config
-- Schedule Managers and admins can read all config
CREATE POLICY priority_config_read_all ON public.priority_config
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('schedule_manager', 'schedule_admin', 'system_admin', 'power_admin')
        )
    );

-- Only System Admin and Power Admin can update config
CREATE POLICY priority_config_update ON public.priority_config
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('system_admin', 'power_admin')
        )
    );

-- Only System Admin and Power Admin can insert config
CREATE POLICY priority_config_insert ON public.priority_config
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('system_admin', 'power_admin')
        )
    );

COMMENT ON TABLE public.priority_config IS 'Global priority configuration for scheduling';
COMMENT ON FUNCTION public.calculate_priority_score IS 'Calculate combined priority score for a schedule assignment';
COMMENT ON FUNCTION public.get_priority_tier IS 'Get priority tier (high/medium/low) for a score';
COMMENT ON FUNCTION public.update_priority_config IS 'Update a priority configuration value';
