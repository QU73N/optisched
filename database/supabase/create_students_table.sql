-- Create students table with proper foreign key relationships
-- This replaces the denormalized profile.section field approach

-- Step 1: Create the students table
CREATE TABLE IF NOT EXISTS public.students (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  student_number text,
  enrollment_date timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT students_pkey PRIMARY KEY (id),
  CONSTRAINT students_profile_id_section_id_key UNIQUE (profile_id, section_id)
);

-- Step 2: Migrate existing student data from profiles.section
INSERT INTO public.students (profile_id, section_id, student_number)
SELECT 
    p.id as profile_id,
    s.id as section_id,
    p.email as student_number
FROM public.profiles p
LEFT JOIN public.sections s ON p.section = s.name
WHERE p.role = 'student' AND p.section IS NOT NULL AND s.id IS NOT NULL
ON CONFLICT (profile_id, section_id) DO NOTHING;

-- Step 3: Enable RLS on students table
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies for students table
-- Students can view their own record
CREATE POLICY "Students can view own record" ON public.students
    FOR SELECT
    USING (auth.uid() = profile_id);

-- Admins can view all students
CREATE POLICY "Admins can view all students" ON public.students
    FOR SELECT
    USING (is_admin_tier());

-- Admins can insert students
CREATE POLICY "Admins can insert students" ON public.students
    FOR INSERT
    WITH CHECK (is_admin_tier());

-- Admins can update students
CREATE POLICY "Admins can update students" ON public.students
    FOR UPDATE
    USING (is_admin_tier());

-- Admins can delete students
CREATE POLICY "Admins can delete students" ON public.students
    FOR DELETE
    USING (is_admin_tier());

-- Step 5: Update schedules RLS policy to use students table
-- Drop existing schedules_select policy
DROP POLICY IF EXISTS "schedules_select" ON public.schedules;

-- Create new schedules_select policy with students table
CREATE POLICY "schedules_select" ON public.schedules
    FOR SELECT
    USING (
        is_power_admin() OR 
        (current_user_role() = ANY (ARRAY['system_admin'::text, 'schedule_admin'::text])) OR 
        ((current_user_role() = 'schedule_manager'::text) AND ((status = ANY (ARRAY['published'::text, 'submitted'::text])) OR (created_by = auth.uid()))) OR 
        ((current_user_role() = 'teacher'::text) AND (status = 'published'::text) AND (teacher_id IN ( 
            SELECT teachers.id FROM teachers WHERE teachers.profile_id = auth.uid()
        ))) OR 
        ((current_user_role() = 'student'::text) AND (status = 'published'::text) AND (section_id IN ( 
            SELECT section_id FROM students WHERE profile_id = auth.uid()
        )))
    );

-- Step 6: Update notification trigger to notify students
CREATE OR REPLACE FUNCTION notify_schedule_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_teacher_id uuid;
    v_section_id uuid;
    v_teacher_profile_id uuid;
    v_notification_id uuid;
    v_student_profile_id uuid;
BEGIN
    -- Only trigger when status changes to 'published'
    IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
        -- Get the teacher and section for this schedule
        SELECT teacher_id, section_id INTO v_teacher_id, v_section_id
        FROM public.schedules
        WHERE id = NEW.id;
        
        -- Notify the teacher if assigned
        IF v_teacher_id IS NOT NULL THEN
            -- Get the teacher's profile_id
            SELECT profile_id INTO v_teacher_profile_id
            FROM public.teachers
            WHERE id = v_teacher_id;
            
            IF v_teacher_profile_id IS NOT NULL THEN
                -- Create notification for teacher
                v_notification_id := create_notification(
                    p_user_id => v_teacher_profile_id,
                    p_type => 'schedule_change',
                    p_title => 'New Schedule Published',
                    p_message => 'A new schedule has been published. Please check your schedule for updates.',
                    p_data => jsonb_build_object(
                        'schedule_id', NEW.id,
                        'day_of_week', NEW.day_of_week,
                        'start_time', NEW.start_time
                    ),
                    p_action_url => '/schedule',
                    p_expires_hours => 168 -- 7 days
                );
            END IF;
        END IF;
        
        -- Notify all students in the section using students table
        IF v_section_id IS NOT NULL THEN
            FOR v_student_profile_id IN
                SELECT profile_id FROM public.students WHERE section_id = v_section_id AND is_active = true
            LOOP
                v_notification_id := create_notification(
                    p_user_id => v_student_profile_id,
                    p_type => 'schedule_change',
                    p_title => 'Schedule Published',
                    p_message => 'A new schedule has been published for your section.',
                    p_data => jsonb_build_object(
                        'schedule_id', NEW.id,
                        'day_of_week', NEW.day_of_week,
                        'start_time', NEW.start_time
                    ),
                    p_action_url => '/student/schedule',
                    p_expires_hours => 168 -- 7 days
                );
            END LOOP;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Step 7: Recreate trigger
DROP TRIGGER IF EXISTS trg_notify_schedule_publish ON public.schedules;
CREATE TRIGGER trg_notify_schedule_publish
    AFTER UPDATE OF status ON public.schedules
    FOR EACH ROW
    EXECUTE FUNCTION notify_schedule_publish();

-- Verification
SELECT 'Students table created' as status;
SELECT COUNT(*) as student_count FROM public.students;
