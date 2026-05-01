-- Add missing columns to schedules table to match database_schema.sql
-- These columns are defined in the schema but missing from the actual database

-- Add rejected_by column
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES public.profiles(id);

-- Add rejected_at column
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS rejected_at timestamp with time zone;

-- Add rejection_reason column
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Add deleted_at column
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Add deleted_by column (already has FK constraint in schema)
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id);

-- Add FK constraint for rejected_by
ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_rejected_by_fkey;
ALTER TABLE public.schedules ADD CONSTRAINT schedules_rejected_by_fkey 
    FOREIGN KEY (rejected_by) REFERENCES public.profiles(id);
