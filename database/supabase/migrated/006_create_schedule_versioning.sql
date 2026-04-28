-- ============================================================================
-- Schedule Versioning Implementation
-- PRD §14.2, §15.3
--
-- Purpose: Enable version history, compare versions, and rollback for schedules
-- This provides audit trail and collaboration features for schedule management
--
-- Design:
-- - Full snapshot versioning (not diffs) for reliability
-- - Automatic version creation on schedule changes
-- - Manual checkpoint creation
-- - Version comparison and rollback functions
-- - Change history tracking with reasons
-- ============================================================================

-- Create schedule_versions table to store snapshots
CREATE TABLE IF NOT EXISTS public.schedule_versions (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    schedule_id uuid NOT NULL,
    version_number integer NOT NULL,
    snapshot jsonb NOT NULL,
    change_type text NOT NULL CHECK (change_type IN ('created', 'updated', 'deleted', 'status_change', 'checkpoint')),
    change_summary text,
    change_reason text,
    changed_by uuid NOT NULL,
    changed_at timestamp with time zone NOT NULL DEFAULT now(),
    previous_version_id uuid,
    CONSTRAINT schedule_versions_pkey PRIMARY KEY (id),
    CONSTRAINT schedule_versions_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedules(id) ON DELETE CASCADE,
    CONSTRAINT schedule_versions_previous_version_fkey FOREIGN KEY (previous_version_id) REFERENCES public.schedule_versions(id) ON DELETE SET NULL,
    CONSTRAINT schedule_versions_unique_version UNIQUE (schedule_id, version_number)
);

-- Create index for efficient version queries
CREATE INDEX IF NOT EXISTS ix_schedule_versions_schedule_id
    ON public.schedule_versions(schedule_id, version_number DESC);

CREATE INDEX IF NOT EXISTS ix_schedule_versions_changed_by
    ON public.schedule_versions(changed_by, changed_at DESC);

CREATE INDEX IF NOT EXISTS ix_schedule_versions_snapshot
    ON public.schedule_versions USING GIN (snapshot);

-- Create schedule_version_sets table to group versions by logical schedule sets
-- This represents a complete schedule state for a semester/academic_year
CREATE TABLE IF NOT EXISTS public.schedule_version_sets (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    description text,
    academic_year text NOT NULL,
    semester text NOT NULL,
    is_published boolean NOT NULL DEFAULT false,
    created_by uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT schedule_version_sets_pkey PRIMARY KEY (id),
    CONSTRAINT schedule_version_sets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

-- Index for version sets
CREATE INDEX IF NOT EXISTS ix_schedule_version_sets_academic_year
    ON public.schedule_version_sets(academic_year, semester, created_at DESC);

-- Link table: which versions belong to which version set
CREATE TABLE IF NOT EXISTS public.schedule_version_set_items (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    version_set_id uuid NOT NULL,
    schedule_version_id uuid NOT NULL,
    CONSTRAINT schedule_version_set_items_pkey PRIMARY KEY (id),
    CONSTRAINT schedule_version_set_items_version_set_fkey FOREIGN KEY (version_set_id) REFERENCES public.schedule_version_sets(id) ON DELETE CASCADE,
    CONSTRAINT schedule_version_set_items_schedule_version_fkey FOREIGN KEY (schedule_version_id) REFERENCES public.schedule_versions(id) ON DELETE CASCADE,
    CONSTRAINT schedule_version_set_items_unique UNIQUE (version_set_id, schedule_version_id)
);

-- Function to get next version number for a schedule
CREATE OR REPLACE FUNCTION public.get_next_schedule_version(p_schedule_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_next_version integer;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
    FROM public.schedule_versions
    WHERE schedule_id = p_schedule_id;
    
    RETURN COALESCE(v_next_version, 1);
END;
$$;

-- Function to create a version snapshot
CREATE OR REPLACE FUNCTION public.create_schedule_version(
    p_schedule_id uuid,
    p_change_type text,
    p_change_summary text DEFAULT NULL,
    p_change_reason text DEFAULT NULL,
    p_changed_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_version_id uuid;
    v_version_number integer;
    v_schedule_record record;
    v_previous_version_id uuid;
BEGIN
    -- Get current schedule data
    SELECT * INTO v_schedule_record
    FROM public.schedules
    WHERE id = p_schedule_id;
    
    IF v_schedule_record IS NULL THEN
        RAISE EXCEPTION 'Schedule with id % does not exist', p_schedule_id;
    END IF;
    
    -- Get previous version
    SELECT id INTO v_previous_version_id
    FROM public.schedule_versions
    WHERE schedule_id = p_schedule_id
    ORDER BY version_number DESC
    LIMIT 1;
    
    -- Get next version number
    v_version_number := public.get_next_schedule_version(p_schedule_id);
    
    -- If no changed_by provided, try to get from current user
    IF p_changed_by IS NULL THEN
        p_changed_by := auth.uid();
    END IF;
    
    -- Create version snapshot
    INSERT INTO public.schedule_versions (
        schedule_id,
        version_number,
        snapshot,
        change_type,
        change_summary,
        change_reason,
        changed_by,
        previous_version_id
    ) VALUES (
        p_schedule_id,
        v_version_number,
        row_to_json(v_schedule_record)::jsonb,
        p_change_type,
        p_change_summary,
        p_change_reason,
        p_changed_by,
        v_previous_version_id
    ) RETURNING id INTO v_version_id;
    
    RETURN v_version_id;
END;
$$;

-- Function to compare two versions and return differences
CREATE OR REPLACE FUNCTION public.compare_schedule_versions(
    p_version_id_1 uuid,
    p_version_id_2 uuid
)
RETURNS TABLE (
    field text,
    old_value text,
    new_value text,
    change_type text
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_snapshot_1 jsonb;
    v_snapshot_2 jsonb;
    v_key text;
BEGIN
    -- Get both snapshots
    SELECT snapshot INTO v_snapshot_1
    FROM public.schedule_versions
    WHERE id = p_version_id_1;
    
    SELECT snapshot INTO v_snapshot_2
    FROM public.schedule_versions
    WHERE id = p_version_id_2;
    
    IF v_snapshot_1 IS NULL OR v_snapshot_2 IS NULL THEN
        RAISE EXCEPTION 'One or both versions not found';
    END IF;
    
    -- Compare all fields
    FOR v_key IN SELECT jsonb_object_keys(v_snapshot_1 || v_snapshot_2)
    LOOP
        IF v_snapshot_1->>v_key IS DISTINCT FROM v_snapshot_2->>v_key THEN
            RETURN QUERY
            SELECT 
                v_key,
                v_snapshot_1->>v_key,
                v_snapshot_2->>v_key,
                CASE 
                    WHEN v_snapshot_1->>v_key IS NULL THEN 'added'
                    WHEN v_snapshot_2->>v_key IS NULL THEN 'removed'
                    ELSE 'modified'
                END;
        END IF;
    END LOOP;
    
    RETURN;
END;
$$;

-- Function to rollback to a specific version
CREATE OR REPLACE FUNCTION public.rollback_schedule_version(
    p_version_id uuid,
    p_rollback_reason text DEFAULT NULL,
    p_rolled_back_by uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_version record;
    v_schedule_id uuid;
BEGIN
    -- Get version data
    SELECT * INTO v_version
    FROM public.schedule_versions
    WHERE id = p_version_id;
    
    IF v_version IS NULL THEN
        RAISE EXCEPTION 'Version with id % does not exist', p_version_id;
    END IF;
    
    v_schedule_id := v_version.schedule_id;
    
    -- If no rolled_back_by provided, use current user
    IF p_rolled_back_by IS NULL THEN
        p_rolled_back_by := auth.uid();
    END IF;
    
    -- Create version of current state before rollback
    PERFORM public.create_schedule_version(
        v_schedule_id,
        'checkpoint',
        'Pre-rollback checkpoint',
        p_rollback_reason,
        p_rolled_back_by
    );
    
    -- Restore from snapshot
    UPDATE public.schedules
    SET 
        subject_id = (v_version.snapshot->>'subject_id')::uuid,
        teacher_id = (v_version.snapshot->>'teacher_id')::uuid,
        room_id = (v_version.snapshot->>'room_id')::uuid,
        section_id = (v_version.snapshot->>'section_id')::uuid,
        day_of_week = v_version.snapshot->>'day_of_week',
        start_time = (v_version.snapshot->>'start_time')::time,
        end_time = (v_version.snapshot->>'end_time')::time,
        semester = v_version.snapshot->>'semester',
        academic_year = v_version.snapshot->>'academic_year',
        status = v_version.snapshot->>'status',
        updated_at = now()
    WHERE id = v_schedule_id;
    
    -- Create version for the rollback
    PERFORM public.create_schedule_version(
        v_schedule_id,
        'updated',
        'Rolled back to version ' || v_version.version_number,
        p_rollback_reason,
        p_rolled_back_by
    );
    
    RETURN true;
END;
$$;

-- Function to create a version set (checkpoint for entire schedule)
CREATE OR REPLACE FUNCTION public.create_schedule_version_set(
    p_name text,
    p_academic_year text,
    p_semester text,
    p_description text DEFAULT NULL,
    p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_version_set_id uuid;
    v_schedule record;
    v_version_id uuid;
BEGIN
    -- If no created_by provided, use current user
    IF p_created_by IS NULL THEN
        p_created_by := auth.uid();
    END IF;
    
    -- Create version set
    INSERT INTO public.schedule_version_sets (
        name,
        description,
        academic_year,
        semester,
        created_by
    ) VALUES (
        p_name,
        p_description,
        p_academic_year,
        p_semester,
        p_created_by
    ) RETURNING id INTO v_version_set_id;
    
    -- Create versions for all schedules in this academic_year/semester
    FOR v_schedule IN
        SELECT id FROM public.schedules
        WHERE academic_year = p_academic_year
        AND semester = p_semester
    LOOP
        v_version_id := public.create_schedule_version(
            v_schedule.id,
            'checkpoint',
            'Version set: ' || p_name,
            p_description,
            p_created_by
        );
        
        -- Link to version set
        INSERT INTO public.schedule_version_set_items (
            version_set_id,
            schedule_version_id
        ) VALUES (
            v_version_set_id,
            v_version_id
        );
    END LOOP;
    
    RETURN v_version_set_id;
END;
$$;

-- Trigger to automatically create version on schedule INSERT
CREATE OR REPLACE FUNCTION public.trg_schedule_insert_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM public.create_schedule_version(
        NEW.id,
        'created',
        'Schedule created',
        NULL,
        NEW.created_by
    );
    RETURN NEW;
END;
$$;

-- Trigger to automatically create version on schedule UPDATE
CREATE OR REPLACE FUNCTION public.trg_schedule_update_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_change_summary text;
    v_change_type text;
BEGIN
    -- Determine change type
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        v_change_type := 'status_change';
        v_change_summary := 'Status changed from ' || OLD.status || ' to ' || NEW.status;
    ELSE
        v_change_type := 'updated';
        v_change_summary := 'Schedule updated';
    END IF;
    
    PERFORM public.create_schedule_version(
        NEW.id,
        v_change_type,
        v_change_summary,
        NULL,
        NEW.created_by
    );
    RETURN NEW;
END;
$$;

-- Trigger to automatically create version on schedule DELETE
CREATE OR REPLACE FUNCTION public.trg_schedule_delete_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM public.create_schedule_version(
        OLD.id,
        'deleted',
        'Schedule deleted',
        NULL,
        OLD.created_by
    );
    RETURN OLD;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trg_schedule_insert ON public.schedules;
CREATE TRIGGER trg_schedule_insert
    AFTER INSERT ON public.schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_schedule_insert_version();

DROP TRIGGER IF EXISTS trg_schedule_update ON public.schedules;
CREATE TRIGGER trg_schedule_update
    AFTER UPDATE ON public.schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_schedule_update_version();

DROP TRIGGER IF EXISTS trg_schedule_delete ON public.schedules;
CREATE TRIGGER trg_schedule_delete
    AFTER DELETE ON public.schedules
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_schedule_delete_version();

-- Enable RLS
ALTER TABLE public.schedule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_version_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_version_set_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for schedule_versions
-- Schedule Managers and admins can read all versions
CREATE POLICY schedule_versions_read_all ON public.schedule_versions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('schedule_manager', 'schedule_admin', 'system_admin', 'power_admin')
        )
    );

-- Only the creator and admins can delete versions
CREATE POLICY schedule_versions_delete ON public.schedule_versions
    FOR DELETE
    USING (
        changed_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('system_admin', 'power_admin')
        )
    );

-- RLS Policies for schedule_version_sets
-- Schedule Managers and admins can read all version sets
CREATE POLICY schedule_version_sets_read_all ON public.schedule_version_sets
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('schedule_manager', 'schedule_admin', 'system_admin', 'power_admin')
        )
    );

-- Only the creator and admins can manage version sets
CREATE POLICY schedule_version_sets_manage ON public.schedule_version_sets
    FOR ALL
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('system_admin', 'power_admin')
        )
    );

-- RLS Policies for schedule_version_set_items
-- Inherit from version sets
CREATE POLICY schedule_version_set_items_read_all ON public.schedule_version_set_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.schedule_version_sets
            WHERE id = schedule_version_set_items.version_set_id
            AND (
                created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE id = auth.uid()
                    AND role IN ('schedule_manager', 'schedule_admin', 'system_admin', 'power_admin')
                )
            )
        )
    );

COMMENT ON TABLE public.schedule_versions IS 'Version history for individual schedule records with full snapshots';
COMMENT ON TABLE public.schedule_version_sets IS 'Logical groupings of schedule versions representing complete schedule states';
COMMENT ON TABLE public.schedule_version_set_items IS 'Link table connecting version sets to individual schedule versions';
COMMENT ON FUNCTION public.create_schedule_version IS 'Create a version snapshot of a schedule record';
COMMENT ON FUNCTION public.compare_schedule_versions IS 'Compare two schedule versions and return differences';
COMMENT ON FUNCTION public.rollback_schedule_version IS 'Rollback a schedule to a previous version';
COMMENT ON FUNCTION public.create_schedule_version_set IS 'Create a version set (checkpoint) for all schedules in a semester';
