-- Migration: 015_add_sessions_per_week.sql
-- Description: Add sessions_per_week column to subjects table for split sessions override

-- Add sessions_per_week column to subjects table
ALTER TABLE public.subjects
ADD COLUMN IF NOT EXISTS sessions_per_week integer;

-- Add comment to document the column
COMMENT ON COLUMN public.subjects.sessions_per_week IS 'Optional override for number of sessions per week. If not set, calculated from duration_hours / session_minutes.';
