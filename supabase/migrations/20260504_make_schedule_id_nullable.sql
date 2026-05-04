-- Migration: Make schedule_id nullable in schedule_versions table
-- Purpose: Allow batch-level versioning where schedule_id is NULL
-- Date: 2025-05-04

-- Make schedule_id nullable to support batch-level versioning
ALTER TABLE public.schedule_versions 
ALTER COLUMN schedule_id DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN public.schedule_versions.schedule_id IS 'For batch-level versioning, this is NULL. For legacy single-schedule versioning, this references the schedules table.';
