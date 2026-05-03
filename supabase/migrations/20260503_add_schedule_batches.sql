-- Migration: Add batch-level versioning support
-- Purpose: Enable versioning of schedule batches (42+ entries) instead of individual entries
-- This redesigns the versioning system to work at the batch level

-- Create schedule_batches table to track batch metadata
CREATE TABLE IF NOT EXISTS public.schedule_batches (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    description text,
    academic_year text NOT NULL,
    semester text NOT NULL,
    created_by uuid NOT NULL REFERENCES auth.users(id),
    is_active boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT schedule_batches_pkey PRIMARY KEY (id)
);

-- Create indexes for schedule_batches
CREATE INDEX IF NOT EXISTS idx_schedule_batches_is_active ON public.schedule_batches(is_active);
CREATE INDEX IF NOT EXISTS idx_schedule_batches_created_by ON public.schedule_batches(created_by);
CREATE INDEX IF NOT EXISTS idx_schedule_batches_academic_year_semester ON public.schedule_batches(academic_year, semester);

-- Add batch_id column to schedules table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schedules' AND column_name = 'batch_id'
    ) THEN
        ALTER TABLE public.schedules ADD COLUMN batch_id uuid REFERENCES public.schedule_batches(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create index for batch_id in schedules
CREATE INDEX IF NOT EXISTS idx_schedules_batch_id ON public.schedules(batch_id);

-- Add batch_id column to schedule_versions table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schedule_versions' AND column_name = 'batch_id'
    ) THEN
        ALTER TABLE public.schedule_versions ADD COLUMN batch_id uuid REFERENCES public.schedule_batches(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create index for batch_id in schedule_versions
CREATE INDEX IF NOT EXISTS idx_schedule_versions_batch_id ON public.schedule_versions(batch_id);

-- Enable RLS on schedule_batches
ALTER TABLE public.schedule_batches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for schedule_batches
DROP POLICY IF EXISTS "schedule_batches_select_authenticated" ON public.schedule_batches;
CREATE POLICY "schedule_batches_select_authenticated" ON public.schedule_batches
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "schedule_batches_insert_authenticated" ON public.schedule_batches;
CREATE POLICY "schedule_batches_insert_authenticated" ON public.schedule_batches
    FOR INSERT TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "schedule_batches_update_authenticated" ON public.schedule_batches;
CREATE POLICY "schedule_batches_update_authenticated" ON public.schedule_batches
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

-- Add comment to document the new schema
COMMENT ON TABLE public.schedule_batches IS 'Tracks batches of schedule entries for version control. A batch represents a complete generated schedule (42+ entries) that can be versioned, compared, and rolled back as a unit.';
COMMENT ON COLUMN public.schedules.batch_id IS 'Links schedule entry to its parent batch. All entries in a generated schedule share the same batch_id.';
COMMENT ON COLUMN public.schedule_versions.batch_id IS 'Links version entry to its parent batch. Versions track changes at the batch level, not individual entry level.';
