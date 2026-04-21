-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  sender_name text NOT NULL DEFAULT 'Unknown'::text,
  recipient_id uuid,
  message text NOT NULL,
  direction text NOT NULL DEFAULT 'teacher_to_admin'::text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_messages_pkey PRIMARY KEY (id)
);
CREATE TABLE public.admin_tasks (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text,
  priority text NOT NULL CHECK (priority = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])),
  progress integer DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])),
  assigned_to ARRAY DEFAULT '{}'::uuid[],
  department text,
  due_date date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_tasks_pkey PRIMARY KEY (id)
);
CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  author_id uuid,
  author_name text NOT NULL DEFAULT ''::text,
  priority text NOT NULL DEFAULT 'normal'::text CHECK (priority = ANY (ARRAY['normal'::text, 'important'::text, 'urgent'::text])),
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  target_section text,
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id)
);
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  content text NOT NULL,
  is_bot boolean DEFAULT false,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.conflicts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  type text NOT NULL CHECK (type = ANY (ARRAY['room_conflict'::text, 'teacher_overlap'::text, 'capacity_exceeded'::text, 'unassigned'::text])),
  severity text NOT NULL CHECK (severity = ANY (ARRAY['high'::text, 'medium'::text, 'low'::text])),
  title text NOT NULL,
  description text NOT NULL,
  schedule_a_id uuid,
  schedule_b_id uuid,
  is_resolved boolean DEFAULT false,
  resolved_at timestamp with time zone,
  resolved_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT conflicts_pkey PRIMARY KEY (id),
  CONSTRAINT conflicts_schedule_a_id_fkey FOREIGN KEY (schedule_a_id) REFERENCES public.schedules(id),
  CONSTRAINT conflicts_schedule_b_id_fkey FOREIGN KEY (schedule_b_id) REFERENCES public.schedules(id),
  CONSTRAINT conflicts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.custom_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  start_time time without time zone,
  end_time time without time zone,
  created_by uuid,
  creator_name text,
  creator_role text CHECK (creator_role = ANY (ARRAY['admin'::text, 'teacher'::text])),
  created_at timestamp with time zone DEFAULT now(),
  room text,
  CONSTRAINT custom_events_pkey PRIMARY KEY (id),
  CONSTRAINT custom_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.password_reset_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  user_id uuid,
  status text NOT NULL DEFAULT 'pending'::text,
  requested_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone,
  resolved_by uuid,
  CONSTRAINT password_reset_requests_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['admin'::text, 'teacher'::text, 'student'::text])),
  full_name text NOT NULL,
  avatar_url text,
  department text,
  program text,
  year_level integer,
  section text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.room_issues (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_name text NOT NULL,
  issue_description text NOT NULL,
  reported_by uuid,
  reporter_name text NOT NULL DEFAULT 'Teacher'::text,
  status text NOT NULL DEFAULT 'open'::text,
  admin_notes text,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT room_issues_pkey PRIMARY KEY (id),
  CONSTRAINT room_issues_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.rooms (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  capacity integer NOT NULL DEFAULT 40,
  type text NOT NULL CHECK (type = ANY (ARRAY['lecture'::text, 'laboratory'::text, 'gymnasium'::text, 'computer_lab'::text])),
  building text NOT NULL DEFAULT 'Main'::text,
  floor integer NOT NULL DEFAULT 1,
  equipment ARRAY DEFAULT '{}'::text[],
  is_available boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT rooms_pkey PRIMARY KEY (id)
);
CREATE TABLE public.schedule_change_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  teacher_id uuid,
  teacher_name text NOT NULL DEFAULT ''::text,
  schedule_id uuid,
  request_type text NOT NULL DEFAULT 'reschedule'::text CHECK (request_type = ANY (ARRAY['reschedule'::text, 'cancel'::text, 'swap'::text])),
  reason text NOT NULL DEFAULT ''::text,
  proposed_day text,
  proposed_time text,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  admin_notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT schedule_change_requests_pkey PRIMARY KEY (id),
  CONSTRAINT schedule_change_requests_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES auth.users(id)
);
CREATE TABLE public.schedules (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  subject_id uuid,
  teacher_id uuid,
  room_id uuid,
  section_id uuid,
  day_of_week text NOT NULL CHECK (day_of_week = ANY (ARRAY['Monday'::text, 'Tuesday'::text, 'Wednesday'::text, 'Thursday'::text, 'Friday'::text, 'Saturday'::text])),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  semester text NOT NULL DEFAULT '1st Semester'::text,
  academic_year text NOT NULL DEFAULT '2025-2026'::text,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT schedules_pkey PRIMARY KEY (id),
  CONSTRAINT schedules_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT schedules_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id),
  CONSTRAINT schedules_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id),
  CONSTRAINT schedules_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(id)
);
CREATE TABLE public.sections (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  program text NOT NULL,
  year_level integer NOT NULL,
  student_count integer NOT NULL DEFAULT 30,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sections_pkey PRIMARY KEY (id)
);
CREATE TABLE public.subjects (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  units integer NOT NULL DEFAULT 3,
  type text NOT NULL CHECK (type = ANY (ARRAY['lecture'::text, 'laboratory'::text])),
  duration_hours numeric NOT NULL DEFAULT 1.5,
  program text NOT NULL,
  year_level integer NOT NULL DEFAULT 1,
  requires_lab boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  teacher_id uuid,
  CONSTRAINT subjects_pkey PRIMARY KEY (id),
  CONSTRAINT subjects_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id)
);
CREATE TABLE public.teacher_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  sender_name text,
  receiver_name text,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT teacher_messages_pkey PRIMARY KEY (id)
);
CREATE TABLE public.teacher_preferences (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  teacher_id uuid NOT NULL UNIQUE,
  preferred_days ARRAY DEFAULT '{Monday,Tuesday,Wednesday,Thursday,Friday}'::text[],
  morning_available boolean DEFAULT true,
  afternoon_available boolean DEFAULT true,
  evening_available boolean DEFAULT false,
  preferred_subjects ARRAY DEFAULT '{}'::uuid[],
  preferred_rooms ARRAY DEFAULT '{}'::uuid[],
  max_consecutive_hours integer DEFAULT 4,
  notes text,
  last_updated timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT teacher_preferences_pkey PRIMARY KEY (id),
  CONSTRAINT teacher_preferences_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id)
);
CREATE TABLE public.teachers (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  profile_id uuid NOT NULL UNIQUE,
  department text NOT NULL,
  employment_type text NOT NULL CHECK (employment_type = ANY (ARRAY['full-time'::text, 'part-time'::text])),
  max_hours integer NOT NULL DEFAULT 40,
  current_load_percentage numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT teachers_pkey PRIMARY KEY (id),
  CONSTRAINT teachers_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
