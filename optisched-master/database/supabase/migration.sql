-- ============================================
-- OptiSched Database Migration
-- Full schema + RLS + Seed Data
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  department TEXT,
  program TEXT,
  year_level INTEGER,
  section TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. TEACHERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  employment_type TEXT NOT NULL CHECK (employment_type IN ('full-time', 'part-time')),
  max_hours INTEGER NOT NULL DEFAULT 40,
  current_load_percentage NUMERIC(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id)
);

-- ============================================
-- 3. ROOMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  capacity INTEGER NOT NULL DEFAULT 40,
  type TEXT NOT NULL CHECK (type IN ('lecture', 'laboratory', 'gymnasium', 'computer_lab')),
  building TEXT NOT NULL DEFAULT 'Main',
  floor INTEGER NOT NULL DEFAULT 1,
  equipment TEXT[] DEFAULT '{}',
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. SUBJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 3,
  type TEXT NOT NULL CHECK (type IN ('lecture', 'laboratory')),
  duration_hours NUMERIC(3,1) NOT NULL DEFAULT 1.5,
  program TEXT NOT NULL,
  year_level INTEGER NOT NULL DEFAULT 1,
  requires_lab BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. SECTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  program TEXT NOT NULL,
  year_level INTEGER NOT NULL,
  student_count INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. SCHEDULES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  semester TEXT NOT NULL DEFAULT '1st Semester',
  academic_year TEXT NOT NULL DEFAULT '2025-2026',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. TEACHER PREFERENCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.teacher_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  preferred_days TEXT[] DEFAULT '{"Monday","Tuesday","Wednesday","Thursday","Friday"}',
  morning_available BOOLEAN DEFAULT true,
  afternoon_available BOOLEAN DEFAULT true,
  evening_available BOOLEAN DEFAULT false,
  preferred_subjects UUID[] DEFAULT '{}',
  preferred_rooms UUID[] DEFAULT '{}',
  max_consecutive_hours INTEGER DEFAULT 4,
  notes TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id)
);

-- ============================================
-- 8. CONFLICTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.conflicts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('room_conflict', 'teacher_overlap', 'capacity_exceeded', 'unassigned')),
  severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  schedule_a_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE,
  schedule_b_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. ADMIN TASKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_to UUID[] DEFAULT '{}',
  department TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. CHAT MESSAGES TABLE (OptiBot)
-- ============================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_bot BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_schedules_day ON public.schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_schedules_teacher ON public.schedules(teacher_id);
CREATE INDEX IF NOT EXISTS idx_schedules_room ON public.schedules(room_id);
CREATE INDEX IF NOT EXISTS idx_schedules_section ON public.schedules(section_id);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON public.schedules(status);
CREATE INDEX IF NOT EXISTS idx_conflicts_resolved ON public.conflicts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_chat_user ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ============================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
  CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_admin_tasks_updated_at BEFORE UPDATE ON public.admin_tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- PROFILES: Users can read all profiles, update only their own
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- TEACHERS: Everyone can read, only admins can modify
CREATE POLICY "teachers_select" ON public.teachers FOR SELECT USING (true);
CREATE POLICY "teachers_admin_all" ON public.teachers FOR ALL USING (public.get_user_role() = 'admin');

-- ROOMS: Everyone can read, only admins can modify
CREATE POLICY "rooms_select" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "rooms_admin_all" ON public.rooms FOR ALL USING (public.get_user_role() = 'admin');

-- SUBJECTS: Everyone can read, only admins can modify
CREATE POLICY "subjects_select" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "subjects_admin_all" ON public.subjects FOR ALL USING (public.get_user_role() = 'admin');

-- SECTIONS: Everyone can read, only admins can modify
CREATE POLICY "sections_select" ON public.sections FOR SELECT USING (true);
CREATE POLICY "sections_admin_all" ON public.sections FOR ALL USING (public.get_user_role() = 'admin');

-- SCHEDULES: Everyone can read published, admins can modify all
CREATE POLICY "schedules_select" ON public.schedules FOR SELECT USING (true);
CREATE POLICY "schedules_admin_all" ON public.schedules FOR ALL USING (public.get_user_role() = 'admin');

-- TEACHER_PREFERENCES: Teachers own their prefs, admins can read all
CREATE POLICY "prefs_select" ON public.teacher_preferences FOR SELECT USING (true);
CREATE POLICY "prefs_teacher_own" ON public.teacher_preferences FOR UPDATE USING (
  teacher_id IN (SELECT id FROM public.teachers WHERE profile_id = auth.uid())
);
CREATE POLICY "prefs_teacher_insert" ON public.teacher_preferences FOR INSERT WITH CHECK (
  teacher_id IN (SELECT id FROM public.teachers WHERE profile_id = auth.uid())
);
CREATE POLICY "prefs_admin_all" ON public.teacher_preferences FOR ALL USING (public.get_user_role() = 'admin');

-- CONFLICTS: Everyone can read, only admins can modify
CREATE POLICY "conflicts_select" ON public.conflicts FOR SELECT USING (true);
CREATE POLICY "conflicts_admin_all" ON public.conflicts FOR ALL USING (public.get_user_role() = 'admin');

-- ADMIN_TASKS: Everyone can read, only admins can modify
CREATE POLICY "tasks_select" ON public.admin_tasks FOR SELECT USING (true);
CREATE POLICY "tasks_admin_all" ON public.admin_tasks FOR ALL USING (public.get_user_role() = 'admin');

-- CHAT_MESSAGES: Users see their own, admins see all
CREATE POLICY "chat_select_own" ON public.chat_messages FOR SELECT USING (
  user_id = auth.uid() OR public.get_user_role() = 'admin'
);
CREATE POLICY "chat_insert_own" ON public.chat_messages FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- ENABLE REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conflicts;

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- SEED DATA: Rooms
-- ============================================
INSERT INTO public.rooms (name, capacity, type, building, floor, equipment) VALUES
  ('Room 201', 40, 'lecture', 'Main', 2, '{"whiteboard","projector"}'),
  ('Room 202', 40, 'lecture', 'Main', 2, '{"whiteboard","projector"}'),
  ('Room 302', 50, 'lecture', 'Main', 3, '{"whiteboard","projector","sound_system"}'),
  ('Room 305', 45, 'lecture', 'Main', 3, '{"whiteboard","projector"}'),
  ('Lab 1', 35, 'computer_lab', 'IT Building', 1, '{"computers","projector","whiteboard"}'),
  ('Lab 3', 35, 'computer_lab', 'IT Building', 1, '{"computers","projector","whiteboard"}'),
  ('Lab 204', 30, 'laboratory', 'Science Building', 2, '{"lab_equipment","projector"}'),
  ('Gymnasium', 100, 'gymnasium', 'Gym Building', 1, '{"sports_equipment"}')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- SEED DATA: Subjects
-- ============================================
INSERT INTO public.subjects (code, name, units, type, duration_hours, program, year_level, requires_lab) VALUES
  ('MATH101', 'Mathematics 101', 3, 'lecture', 1.5, 'BSIT', 1, false),
  ('CS201', 'Data Structures', 3, 'lecture', 2.0, 'BSIT', 2, false),
  ('IT301', 'Web Development', 3, 'laboratory', 2.0, 'BSIT', 3, true),
  ('IT302', 'Database Systems', 3, 'lecture', 2.0, 'BSIT', 3, false),
  ('IT401', 'IT Elective 2', 3, 'laboratory', 2.0, 'BSIT', 4, true),
  ('CS401', 'Artificial Intelligence', 3, 'lecture', 1.5, 'BSCS', 4, false),
  ('ENG2', 'English 2', 3, 'lecture', 1.5, 'BSIT', 1, false),
  ('PE2', 'Physical Education 2', 2, 'lecture', 1.0, 'BSIT', 1, false),
  ('ACCTG202', 'Accounting 202', 3, 'lecture', 1.5, 'BSA', 2, false),
  ('MMA101', 'Multimedia Arts 101', 3, 'laboratory', 2.0, 'BSMMA', 1, true)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- SEED DATA: Sections
-- ============================================
INSERT INTO public.sections (name, program, year_level, student_count) VALUES
  ('BSIT 301-A', 'BSIT', 3, 40),
  ('BSIT 302-A', 'BSIT', 3, 38),
  ('BSCS 201-B', 'BSCS', 2, 35),
  ('BSIT 401-A', 'BSIT', 4, 42),
  ('BSA 201-A', 'BSA', 2, 55),
  ('BSMMA 101-A', 'BSMMA', 1, 30)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- SEED DATA: Admin Tasks
-- ============================================
INSERT INTO public.admin_tasks (title, description, priority, progress, status) VALUES
  ('Finalize Room Assignments', 'BSIT & BSCS Departments - Verify all room capacities match section sizes', 'high', 75, 'in_progress'),
  ('Verify Faculty Load', 'Department Heads Review - Ensure no faculty exceeds max teaching hours', 'medium', 40, 'in_progress'),
  ('Publish 1st Sem Schedule', 'Final Release to Students - Need conflict resolution first', 'low', 15, 'pending'),
  ('Conflict Resolution', 'Resolve 12 scheduling conflicts before publication', 'high', 0, 'pending');

-- Done!
-- Now create auth users via Supabase Dashboard or the commands below.
