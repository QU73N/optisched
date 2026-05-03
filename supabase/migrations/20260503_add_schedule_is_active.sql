-- Migration: Add is_active column to schedules table for version control
-- Purpose: Enable soft deletion of schedules to preserve history and allow rollback
-- This change allows multiple published schedules to exist, with only one marked as active

-- Add is_active column to schedules table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schedules' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE public.schedules ADD COLUMN is_active boolean NOT NULL DEFAULT true;
    END IF;
END $$;

-- Create index for faster lookups of active schedules
CREATE INDEX IF NOT EXISTS idx_schedules_is_active ON public.schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_schedules_status_active ON public.schedules(status, is_active);

-- Update existing published schedules to be active
-- All other statuses (draft, submitted, approved) are considered active by default
-- This ensures backward compatibility
UPDATE public.schedules 
SET is_active = true 
WHERE status = 'published' AND is_active IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN public.schedules.is_active IS 'Indicates if this schedule entry is currently active. When publishing a new schedule, old published entries are set to false instead of deleted, preserving history for rollback.';
