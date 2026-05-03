-- Migration: Add subject_teachers junction table for many-to-many relationship
-- This allows multiple teachers to teach the same subject
-- Date: 2026-05-03

-- Create junction table for subject-teacher relationships
CREATE TABLE IF NOT EXISTS public.subject_teachers (
    subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    PRIMARY KEY (subject_id, teacher_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subject_teachers_subject_id ON public.subject_teachers(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_teachers_teacher_id ON public.subject_teachers(teacher_id);

-- Enable RLS
ALTER TABLE public.subject_teachers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Public can view subject-teacher relationships
CREATE POLICY "Public can view subject teachers"
    ON public.subject_teachers FOR SELECT
    USING (true);

-- Admins can insert subject-teacher relationships
CREATE POLICY "Admins can insert subject teachers"
    ON public.subject_teachers FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- Admins can delete subject-teacher relationships
CREATE POLICY "Admins can delete subject teachers"
    ON public.subject_teachers FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- Migrate existing teacher_id from subjects table to subject_teachers
INSERT INTO public.subject_teachers (subject_id, teacher_id, created_by)
SELECT id, teacher_id, teacher_id
FROM public.subjects
WHERE teacher_id IS NOT NULL
ON CONFLICT (subject_id, teacher_id) DO NOTHING;

-- Add comment
COMMENT ON TABLE public.subject_teachers IS 'Junction table for many-to-many relationship between subjects and teachers';
