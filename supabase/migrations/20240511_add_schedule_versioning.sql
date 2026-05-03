-- Migration: Add Schedule Versioning System
-- Purpose: Enable safe publishing, version history, comparison, and rollback
-- This migration creates the infrastructure for robust version control

-- Add missing columns to existing schedule_versions table if they don't exist
DO $$
BEGIN
    -- Add is_active column to schedule_versions if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schedule_versions' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.schedule_versions ADD COLUMN is_active boolean NOT NULL DEFAULT false;
    END IF;
    
    -- Add state_hash column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schedule_versions' AND column_name = 'state_hash'
    ) THEN
        ALTER TABLE public.schedule_versions ADD COLUMN state_hash text;
    END IF;
    
    -- Add soft_score column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schedule_versions' AND column_name = 'soft_score'
    ) THEN
        ALTER TABLE public.schedule_versions ADD COLUMN soft_score numeric;
    END IF;
    
    -- Add conflict_count column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schedule_versions' AND column_name = 'conflict_count'
    ) THEN
        ALTER TABLE public.schedule_versions ADD COLUMN conflict_count integer;
    END IF;
    
    -- Extend change_type check constraint if needed
    -- Drop existing constraint first
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'schedule_versions_change_type_check'
    ) THEN
        ALTER TABLE public.schedule_versions DROP CONSTRAINT schedule_versions_change_type_check;
    END IF;
    
    -- Add extended check constraint
    ALTER TABLE public.schedule_versions 
    ADD CONSTRAINT schedule_versions_change_type_check 
    CHECK (change_type = ANY (ARRAY['created'::text, 'updated'::text, 'deleted'::text, 'status_change'::text, 'checkpoint'::text, 'publish'::text, 'overwrite'::text, 'restore'::text]));
    
    -- Add is_active column to schedule_version_sets if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schedule_version_sets' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.schedule_version_sets ADD COLUMN is_active boolean NOT NULL DEFAULT false;
    END IF;
END $$;

-- Create index for faster lookups (IF NOT EXISTS to handle existing indexes)
CREATE INDEX IF NOT EXISTS idx_schedule_versions_schedule_id ON public.schedule_versions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_versions_is_active ON public.schedule_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_schedule_versions_changed_at ON public.schedule_versions(changed_at DESC);

-- Create index for active version sets
CREATE INDEX IF NOT EXISTS idx_schedule_version_sets_is_active ON public.schedule_version_sets(is_active);
CREATE INDEX IF NOT EXISTS idx_schedule_version_sets_created_at ON public.schedule_version_sets(created_at DESC);

-- Create schedule_version_set_items table to link versions to sets
CREATE TABLE IF NOT EXISTS public.schedule_version_set_items (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    version_set_id uuid NOT NULL,
    schedule_version_id uuid NOT NULL,
    CONSTRAINT schedule_version_set_items_pkey PRIMARY KEY (id),
    CONSTRAINT schedule_version_set_items_version_set_fkey FOREIGN KEY (version_set_id) REFERENCES public.schedule_version_sets(id) ON DELETE CASCADE,
    CONSTRAINT schedule_version_set_items_schedule_version_fkey FOREIGN KEY (schedule_version_id) REFERENCES public.schedule_versions(id) ON DELETE CASCADE
);

-- Create index for version set items
CREATE INDEX IF NOT EXISTS idx_schedule_version_set_items_version_set_id ON public.schedule_version_set_items(version_set_id);

-- Enable RLS
ALTER TABLE public.schedule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_version_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_version_set_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for schedule_versions
DROP POLICY IF EXISTS "schedule_versions_select_authenticated" ON public.schedule_versions;
CREATE POLICY "schedule_versions_select_authenticated" ON public.schedule_versions
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "schedule_versions_insert_authenticated" ON public.schedule_versions;
CREATE POLICY "schedule_versions_insert_authenticated" ON public.schedule_versions
    FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "schedule_versions_update_authenticated" ON public.schedule_versions;
CREATE POLICY "schedule_versions_update_authenticated" ON public.schedule_versions
    FOR UPDATE TO authenticated
    USING (true);

-- RLS Policies for schedule_version_sets
DROP POLICY IF EXISTS "schedule_version_sets_select_authenticated" ON public.schedule_version_sets;
CREATE POLICY "schedule_version_sets_select_authenticated" ON public.schedule_version_sets
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "schedule_version_sets_insert_authenticated" ON public.schedule_version_sets;
CREATE POLICY "schedule_version_sets_insert_authenticated" ON public.schedule_version_sets
    FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "schedule_version_sets_update_authenticated" ON public.schedule_version_sets;
CREATE POLICY "schedule_version_sets_update_authenticated" ON public.schedule_version_sets
    FOR UPDATE TO authenticated
    USING (true);

-- RLS Policies for schedule_version_set_items
DROP POLICY IF EXISTS "schedule_version_set_items_select_authenticated" ON public.schedule_version_set_items;
CREATE POLICY "schedule_version_set_items_select_authenticated" ON public.schedule_version_set_items
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "schedule_version_set_items_insert_authenticated" ON public.schedule_version_set_items;
CREATE POLICY "schedule_version_set_items_insert_authenticated" ON public.schedule_version_set_items
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Function: Get next version number for a schedule
DROP FUNCTION IF EXISTS public.get_next_schedule_version(uuid);

CREATE OR REPLACE FUNCTION public.get_next_schedule_version(p_schedule_id uuid)
RETURNS integer AS $$
BEGIN
    RETURN COALESCE(MAX(version_number), 0) + 1 
    FROM public.schedule_versions 
    WHERE schedule_id = p_schedule_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Create a schedule version
DROP FUNCTION IF EXISTS public.create_schedule_version CASCADE;

CREATE OR REPLACE FUNCTION public.create_schedule_version(
    p_schedule_id uuid,
    p_change_type text,
    p_change_summary text,
    p_change_reason text,
    p_state_hash text,
    p_soft_score numeric,
    p_conflict_count integer,
    p_changed_by uuid,
    p_previous_version_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    v_version_id uuid;
    v_version_number integer;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version_number
    FROM public.schedule_versions
    WHERE schedule_id = p_schedule_id;
    
    INSERT INTO public.schedule_versions (
        schedule_id,
        version_number,
        snapshot,
        change_type,
        change_summary,
        change_reason,
        state_hash,
        soft_score,
        conflict_count,
        changed_by,
        previous_version_id
    )
    VALUES (
        p_schedule_id,
        v_version_number,
        (SELECT row_to_json(s) FROM public.schedules s WHERE s.id = p_schedule_id),
        p_change_type,
        p_change_summary,
        p_change_reason,
        p_state_hash,
        p_soft_score,
        p_conflict_count,
        p_changed_by,
        p_previous_version_id
    )
    RETURNING id INTO v_version_id;
    
    RETURN v_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Deactivate all versions for a schedule
DROP FUNCTION IF EXISTS public.deactivate_schedule_versions(uuid);

CREATE OR REPLACE FUNCTION public.deactivate_schedule_versions(p_schedule_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.schedule_versions
    SET is_active = false
    WHERE schedule_id = p_schedule_id AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Activate a specific version
DROP FUNCTION IF EXISTS public.activate_schedule_version(uuid);

CREATE OR REPLACE FUNCTION public.activate_schedule_version(p_version_id uuid)
RETURNS void AS $$
DECLARE
    v_schedule_id uuid;
BEGIN
    SELECT schedule_id INTO v_schedule_id
    FROM public.schedule_versions
    WHERE id = p_version_id;
    
    PERFORM public.deactivate_schedule_versions(v_schedule_id);
    
    UPDATE public.schedule_versions
    SET is_active = true
    WHERE id = p_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Create a version set
DROP FUNCTION IF EXISTS public.create_schedule_version_set CASCADE;

CREATE OR REPLACE FUNCTION public.create_schedule_version_set(
    p_name text,
    p_description text,
    p_academic_year text,
    p_semester text,
    p_is_published boolean,
    p_created_by uuid
)
RETURNS uuid AS $$
DECLARE
    v_version_set_id uuid;
BEGIN
    INSERT INTO public.schedule_version_sets (
        name,
        description,
        academic_year,
        semester,
        is_published,
        is_active,
        created_by
    )
    VALUES (
        p_name,
        p_description,
        p_academic_year,
        p_semester,
        p_is_published,
        p_is_published,
        p_created_by
    )
    RETURNING id INTO v_version_set_id;
    
    RETURN v_version_set_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Add version to version set
DROP FUNCTION IF EXISTS public.add_version_to_set CASCADE;

CREATE OR REPLACE FUNCTION public.add_version_to_set(p_version_set_id uuid, p_schedule_version_id uuid)
RETURNS uuid AS $$
DECLARE
    v_item_id uuid;
BEGIN
    INSERT INTO public.schedule_version_set_items (
        version_set_id,
        schedule_version_id
    )
    VALUES (
        p_version_set_id,
        p_schedule_version_id
    )
    RETURNING id INTO v_item_id;
    
    RETURN v_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Compare two schedule versions
DROP FUNCTION IF EXISTS public.compare_schedule_versions CASCADE;

CREATE OR REPLACE FUNCTION public.compare_schedule_versions(p_version_id_1 uuid, p_version_id_2 uuid)
RETURNS TABLE(
    version_1_id uuid,
    version_1_number integer,
    version_1_data jsonb,
    version_2_id uuid,
    version_2_number integer,
    version_2_data jsonb,
    differences jsonb
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v1.id as version_1_id,
        v1.version_number as version_1_number,
        v1.snapshot as version_1_data,
        v2.id as version_2_id,
        v2.version_number as version_2_number,
        v2.snapshot as version_2_data,
        (SELECT jsonb_object_agg(key, jsonb_build_object('before', v1.snapshot->key, 'after', v2.snapshot->key, 'changed', true))
         FROM jsonb_object_keys(v1.snapshot) AS key
         WHERE v1.snapshot->key IS DISTINCT FROM v2.snapshot->key) as differences
    FROM public.schedule_versions v1
    CROSS JOIN public.schedule_versions v2
    WHERE v1.id = p_version_id_1 AND v2.id = p_version_id_2;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get active schedule version
DROP FUNCTION IF EXISTS public.get_active_schedule_version CASCADE;

CREATE OR REPLACE FUNCTION public.get_active_schedule_version(p_schedule_id uuid)
RETURNS TABLE(
    id uuid,
    version_number integer,
    snapshot jsonb,
    change_type text,
    change_summary text,
    change_reason text,
    state_hash text,
    soft_score numeric,
    conflict_count integer,
    changed_by uuid,
    changed_at timestamp with time zone,
    is_active boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sv.id,
        sv.version_number,
        sv.snapshot,
        sv.change_type,
        sv.change_summary,
        sv.change_reason,
        sv.state_hash,
        sv.soft_score,
        sv.conflict_count,
        sv.changed_by,
        sv.changed_at,
        sv.is_active
    FROM public.schedule_versions sv
    WHERE sv.schedule_id = p_schedule_id AND sv.is_active = true
    ORDER BY sv.version_number DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_next_schedule_version TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_schedule_version TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_schedule_versions TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_schedule_version TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_schedule_version_set TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_version_to_set TO authenticated;
GRANT EXECUTE ON FUNCTION public.compare_schedule_versions TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_schedule_version TO authenticated;

-- Add comments to document the versioning system
COMMENT ON TABLE public.schedule_versions IS 'Tracks individual schedule versions with snapshots for history, comparison, and rollback';
COMMENT ON TABLE public.schedule_version_sets IS 'Groups related schedule versions (e.g., a full schedule publish operation)';
COMMENT ON TABLE public.schedule_version_set_items IS 'Links schedule versions to version sets';
COMMENT ON FUNCTION public.create_schedule_version IS 'Creates a new version entry for a schedule with full snapshot and metadata';
COMMENT ON FUNCTION public.activate_schedule_version IS 'Activates a specific version as the current active version';
COMMENT ON FUNCTION public.compare_schedule_versions IS 'Compares two schedule versions and returns differences';
COMMENT ON FUNCTION public.get_active_schedule_version IS 'Returns the currently active version for a schedule';
