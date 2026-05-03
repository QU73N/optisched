-- Remove old versioning trigger from schedules table
-- This trigger was calling the old create_schedule_version function
-- which is now obsolete due to batch-level versioning redesign

-- Drop any triggers on schedules that might call create_schedule_version
DROP TRIGGER IF EXISTS schedule_version_trigger ON public.schedules;
DROP TRIGGER IF EXISTS create_schedule_version_trigger ON public.schedules;
DROP TRIGGER IF EXISTS schedules_insert_version_trigger ON public.schedules;
DROP TRIGGER IF EXISTS schedules_update_version_trigger ON public.schedules;
DROP TRIGGER IF EXISTS schedules_after_insert_or_update_trigger ON public.schedules;

-- Also drop the old create_schedule_version function if it exists
-- The new batch-level versioning uses different functions
DROP FUNCTION IF EXISTS public.create_schedule_version CASCADE;
