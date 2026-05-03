-- Migration: Add fields for full user integration and system consistency
-- This migration adds fields to the profiles table to support the Add User function
-- and ensure data consistency across all system modules

-- Add id_number field for student/employee ID
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS id_number text;

-- Add student_type field for SHS vs College distinction
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS student_type text CHECK (student_type IN ('shs', 'college'));

-- Add access_permissions field for schedule manager permissions
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS access_permissions jsonb DEFAULT '{}'::jsonb;

-- Add comments
COMMENT ON COLUMN public.profiles.id_number IS 'Student or employee ID number';
COMMENT ON COLUMN public.profiles.student_type IS 'Student type: shs (Senior High School) or college';
COMMENT ON COLUMN public.profiles.access_permissions IS 'Access permissions for schedule managers and other roles';

-- Create index on id_number for duplicate checking
CREATE INDEX IF NOT EXISTS profiles_id_number_idx ON public.profiles(id_number);

-- Create index on student_type for filtering
CREATE INDEX IF NOT EXISTS profiles_student_type_idx ON public.profiles(student_type);

-- Create index on role for filtering
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles(role);
