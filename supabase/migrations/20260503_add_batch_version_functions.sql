-- Migration: Add batch-level version creation functions
-- Purpose: Replace individual entry versioning with batch-level versioning

-- Function: Create a schedule batch
DROP FUNCTION IF EXISTS public.create_schedule_batch CASCADE;

CREATE OR REPLACE FUNCTION public.create_schedule_batch(
    p_name text,
    p_description text,
    p_academic_year text,
    p_semester text,
    p_created_by uuid
)
RETURNS uuid AS $$
DECLARE
    v_batch_id uuid;
BEGIN
    INSERT INTO public.schedule_batches (
        name,
        description,
        academic_year,
        semester,
        created_by,
        is_active
    )
    VALUES (
        p_name,
        p_description,
        p_academic_year,
        p_semester,
        p_created_by,
        false
    )
    RETURNING id INTO v_batch_id;
    
    RETURN v_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Create a batch-level version
DROP FUNCTION IF EXISTS public.create_batch_version CASCADE;

CREATE OR REPLACE FUNCTION public.create_batch_version(
    p_batch_id uuid,
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
    v_batch_snapshot jsonb;
BEGIN
    -- Get next version number for this batch
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version_number
    FROM public.schedule_versions
    WHERE batch_id = p_batch_id;
    
    -- Get snapshot of all schedules in this batch
    SELECT jsonb_agg(s) INTO v_batch_snapshot
    FROM public.schedules s
    WHERE s.batch_id = p_batch_id;
    
    -- Insert the version entry
    INSERT INTO public.schedule_versions (
        batch_id,
        schedule_id,  -- NULL for batch versions
        version_number,
        snapshot,
        change_type,
        change_summary,
        change_reason,
        state_hash,
        soft_score,
        conflict_count,
        changed_by,
        previous_version_id,
        is_active
    )
    VALUES (
        p_batch_id,
        NULL,
        v_version_number,
        v_batch_snapshot,
        p_change_type,
        p_change_summary,
        p_change_reason,
        p_state_hash,
        p_soft_score,
        p_conflict_count,
        p_changed_by,
        p_previous_version_id,
        false
    )
    RETURNING id INTO v_version_id;
    
    RETURN v_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Deactivate all versions for a batch
DROP FUNCTION IF EXISTS public.deactivate_batch_versions CASCADE;

CREATE OR REPLACE FUNCTION public.deactivate_batch_versions(p_batch_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE public.schedule_versions
    SET is_active = false
    WHERE batch_id = p_batch_id AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Activate a specific batch version
DROP FUNCTION IF EXISTS public.activate_batch_version CASCADE;

CREATE OR REPLACE FUNCTION public.activate_batch_version(p_version_id uuid)
RETURNS void AS $$
DECLARE
    v_batch_id uuid;
BEGIN
    SELECT batch_id INTO v_batch_id
    FROM public.schedule_versions
    WHERE id = p_version_id;
    
    -- Deactivate all versions for this batch
    PERFORM public.deactivate_batch_versions(v_batch_id);
    
    -- Activate the selected version
    UPDATE public.schedule_versions
    SET is_active = true
    WHERE id = p_version_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get active batch version
DROP FUNCTION IF EXISTS public.get_active_batch_version CASCADE;

CREATE OR REPLACE FUNCTION public.get_active_batch_version(p_batch_id uuid)
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
    changed_at timestamptz,
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
    WHERE sv.batch_id = p_batch_id AND sv.is_active = true
    ORDER BY sv.version_number DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.create_schedule_batch TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_batch_version TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_batch_versions TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_batch_version TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_batch_version TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.create_schedule_batch IS 'Creates a new schedule batch to group schedule entries for version control.';
COMMENT ON FUNCTION public.create_batch_version IS 'Creates a version entry for an entire batch of schedules, storing all batch entries as a JSON snapshot.';
COMMENT ON FUNCTION public.deactivate_batch_versions IS 'Deactivates all versions for a batch, used before creating a new active version.';
COMMENT ON FUNCTION public.activate_batch_version IS 'Activates a specific batch version and deactivates all others for that batch.';
COMMENT ON FUNCTION public.get_active_batch_version IS 'Returns the currently active version for a batch.';
