-- ============================================================================
-- Section Hierarchy Implementation
-- PRD §7.2, §11.2
--
-- Purpose: Enable folder-style hierarchical grouping of sections with weights
-- for scheduling priority and institutional structure (College → SHS → Grade → Programs)
--
-- This migration adds hierarchical structure to the sections table while
-- maintaining backward compatibility with existing data.
-- ============================================================================

-- Add hierarchy columns to sections table
ALTER TABLE public.sections
    ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.sections(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS weight integer NOT NULL DEFAULT 50 CHECK (weight >= 0 AND weight <= 100),
    ADD COLUMN IF NOT EXISTS path text NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS node_type text NOT NULL DEFAULT 'section' CHECK (node_type IN ('group', 'section')),
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Create indexes for efficient hierarchy queries
CREATE INDEX IF NOT EXISTS ix_sections_parent_id
    ON public.sections(parent_id)
    WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_sections_path
    ON public.sections(path text_pattern_ops);

CREATE INDEX IF NOT EXISTS ix_sections_node_type
    ON public.sections(node_type, is_active)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS ix_sections_weight
    ON public.sections(weight DESC, sort_order ASC)
    WHERE is_active = true;

-- Create trigger to automatically maintain path field
CREATE OR REPLACE FUNCTION public.update_section_path()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_parent_path text;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- For new records, build path from parent
        IF NEW.parent_id IS NULL THEN
            NEW.path := NEW.id::text;
        ELSE
            SELECT path INTO v_parent_path
            FROM public.sections
            WHERE id = NEW.parent_id;
            
            IF v_parent_path IS NOT NULL THEN
                NEW.path := v_parent_path || '/' || NEW.id::text;
            ELSE
                NEW.path := NEW.id::text;
            END IF;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- For updates, rebuild path if parent changed
        IF OLD.parent_id IS DISTINCT FROM NEW.parent_id THEN
            IF NEW.parent_id IS NULL THEN
                NEW.path := NEW.id::text;
            ELSE
                SELECT path INTO v_parent_path
                FROM public.sections
                WHERE id = NEW.parent_id;
                
                IF v_parent_path IS NOT NULL THEN
                    NEW.path := v_parent_path || '/' || NEW.id::text;
                ELSE
                    NEW.path := NEW.id::text;
                END IF;
            END IF;
            
            -- Recursively update all descendants
            PERFORM public.rebuild_section_paths(NEW.id);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Function to recursively rebuild paths for all descendants
CREATE OR REPLACE FUNCTION public.rebuild_section_paths(p_parent_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_child record;
    v_parent_path text;
BEGIN
    -- Get parent's new path
    SELECT path INTO v_parent_path
    FROM public.sections
    WHERE id = p_parent_id;
    
    -- Update all direct children
    FOR v_child IN
        SELECT id, parent_id
        FROM public.sections
        WHERE parent_id = p_parent_id
    LOOP
        UPDATE public.sections
        SET path = COALESCE(v_parent_path, '') || '/' || id::text
        WHERE id = v_child.id;
        
        -- Recurse for grandchildren
        PERFORM public.rebuild_section_paths(v_child.id);
    END LOOP;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_sections_path_update ON public.sections;
CREATE TRIGGER trg_sections_path_update
    BEFORE INSERT OR UPDATE OF parent_id ON public.sections
    FOR EACH ROW
    EXECUTE FUNCTION public.update_section_path();

-- Helper function to get section hierarchy level (depth)
CREATE OR REPLACE FUNCTION public.get_section_level(p_section_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_path text;
BEGIN
    SELECT path INTO v_path
    FROM public.sections
    WHERE id = p_section_id;
    
    IF v_path IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Count slashes in path to determine depth
    RETURN (length(v_path) - length(replace(v_path, '/', '')));
END;
$$;

-- Helper function to get all descendants of a section
CREATE OR REPLACE FUNCTION public.get_section_descendants(p_section_id uuid)
RETURNS TABLE (id uuid, name text, path text, weight integer, level integer)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.path,
        s.weight,
        public.get_section_level(s.id) as level
    FROM public.sections s
    WHERE s.path LIKE (
        SELECT path || '%' FROM public.sections WHERE id = p_section_id
    )
    AND s.id != p_section_id
    AND s.is_active = true
    ORDER BY s.path;
END;
$$;

-- Helper function to get all ancestors of a section
CREATE OR REPLACE FUNCTION public.get_section_ancestors(p_section_id uuid)
RETURNS TABLE (id uuid, name text, path text, weight integer, level integer)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_path text;
BEGIN
    SELECT path INTO v_path
    FROM public.sections
    WHERE id = p_section_id;
    
    IF v_path IS NULL THEN
        RETURN;
    END IF;
    
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.path,
        s.weight,
        public.get_section_level(s.id) as level
    FROM public.sections s
    WHERE s.id IN (
        SELECT regexp_split_to_table(v_path, '/')::uuid
    )
    AND s.id != p_section_id
    ORDER BY s.path;
END;
$$;

-- Initialize path for existing sections (migration data fix)
DO $$
DECLARE
    v_section record;
BEGIN
    -- For root sections (no parent), set path to id
    UPDATE public.sections
    SET path = id::text
    WHERE parent_id IS NULL AND (path IS NULL OR path = '');
    
    -- For sections with parent, rebuild paths
    FOR v_section IN
        SELECT id FROM public.sections WHERE parent_id IS NOT NULL
    LOOP
        PERFORM public.rebuild_section_paths(v_section.id);
    END LOOP;
END $$;

-- Enable RLS
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

-- Policy: Schedule Managers can manage sections
DROP POLICY IF EXISTS sections_manage ON public.sections;
CREATE POLICY sections_manage ON public.sections
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('schedule_manager', 'schedule_admin', 'system_admin', 'power_admin')
        )
    );

-- Policy: Teachers and Students can read active sections
DROP POLICY IF EXISTS sections_read ON public.sections;
CREATE POLICY sections_read ON public.sections
    FOR SELECT
    USING (
        is_active = true
        AND (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid()
                AND role IN ('teacher', 'student')
            )
            OR EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid()
                AND role IN ('schedule_manager', 'schedule_admin', 'system_admin', 'power_admin')
            )
        )
    );

COMMENT ON TABLE public.sections IS 'Sections with hierarchical structure for institutional organization and scheduling priority';
COMMENT ON COLUMN public.sections.parent_id IS 'Parent section ID for hierarchy (null for root nodes)';
COMMENT ON COLUMN public.sections.weight IS 'Scheduling priority weight (0-100, higher = scheduled first)';
COMMENT ON COLUMN public.sections.path IS 'Materialized path for efficient hierarchy queries (e.g., "uuid1/uuid2/uuid3")';
COMMENT ON COLUMN public.sections.node_type IS 'Node type: "group" for folders, "section" for actual student sections';
COMMENT ON COLUMN public.sections.is_active IS 'Soft delete flag (inactive sections excluded from scheduling)';
COMMENT ON COLUMN public.sections.sort_order IS 'Display order within parent (for UI sorting)';
COMMENT ON COLUMN public.sections.metadata IS 'Extensible JSONB for custom attributes';
