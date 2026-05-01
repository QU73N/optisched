-- Add performance indexes for frequently queried columns
-- This improves query performance as data grows

-- Schedules table indexes
CREATE INDEX IF NOT EXISTS idx_schedules_status ON public.schedules(status);
CREATE INDEX IF NOT EXISTS idx_schedules_teacher_id ON public.schedules(teacher_id);
CREATE INDEX IF NOT EXISTS idx_schedules_section_id ON public.schedules(section_id);
CREATE INDEX IF NOT EXISTS idx_schedules_room_id ON public.schedules(room_id);
CREATE INDEX IF NOT EXISTS idx_schedules_subject_id ON public.schedules(subject_id);
CREATE INDEX IF NOT EXISTS idx_schedules_day_of_week ON public.schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_schedules_semester ON public.schedules(semester);
CREATE INDEX IF NOT EXISTS idx_schedules_academic_year ON public.schedules(academic_year);
CREATE INDEX IF NOT EXISTS idx_schedules_created_by ON public.schedules(created_by);
CREATE INDEX IF NOT EXISTS idx_schedules_status_created_at ON public.schedules(status, created_at DESC);

-- Subjects table indexes
CREATE INDEX IF NOT EXISTS idx_subjects_program ON public.subjects(program);
CREATE INDEX IF NOT EXISTS idx_subjects_year_level ON public.subjects(year_level);
CREATE INDEX IF NOT EXISTS idx_subjects_type ON public.subjects(type);
CREATE INDEX IF NOT EXISTS idx_subjects_teacher_id ON public.subjects(teacher_id);
CREATE INDEX IF NOT EXISTS idx_subjects_program_year_level ON public.subjects(program, year_level);

-- Teachers table indexes
CREATE INDEX IF NOT EXISTS idx_teachers_profile_id ON public.teachers(profile_id);
CREATE INDEX IF NOT EXISTS idx_teachers_department ON public.teachers(department);
CREATE INDEX IF NOT EXISTS idx_teachers_employment_type ON public.teachers(employment_type);
CREATE INDEX IF NOT EXISTS idx_teachers_is_public ON public.teachers(is_public);
CREATE INDEX IF NOT EXISTS idx_teachers_owner_id ON public.teachers(owner_id);

-- Students table indexes
CREATE INDEX IF NOT EXISTS idx_students_profile_id ON public.students(profile_id);
CREATE INDEX IF NOT EXISTS idx_students_section_id ON public.students(section_id);
CREATE INDEX IF NOT EXISTS idx_students_is_active ON public.students(is_active);
CREATE INDEX IF NOT EXISTS idx_students_profile_section ON public.students(profile_id, section_id);

-- Rooms table indexes
CREATE INDEX IF NOT EXISTS idx_rooms_type ON public.rooms(type);
CREATE INDEX IF NOT EXISTS idx_rooms_building ON public.rooms(building);
CREATE INDEX IF NOT EXISTS idx_rooms_floor ON public.rooms(floor);
CREATE INDEX IF NOT EXISTS idx_rooms_is_public ON public.rooms(is_public);
CREATE INDEX IF NOT EXISTS idx_rooms_owner_id ON public.rooms(owner_id);

-- Sections table indexes
CREATE INDEX IF NOT EXISTS idx_sections_program ON public.sections(program);
CREATE INDEX IF NOT EXISTS idx_sections_year_level ON public.sections(year_level);
CREATE INDEX IF NOT EXISTS idx_sections_parent_id ON public.sections(parent_id);
CREATE INDEX IF NOT EXISTS idx_sections_is_public ON public.sections(is_public);
CREATE INDEX IF NOT EXISTS idx_sections_owner_id ON public.sections(owner_id);
CREATE INDEX IF NOT EXISTS idx_sections_program_year_level ON public.sections(program, year_level);

-- Teacher preferences table indexes
CREATE INDEX IF NOT EXISTS idx_teacher_preferences_teacher_id ON public.teacher_preferences(teacher_id);

-- Conflicts table indexes
CREATE INDEX IF NOT EXISTS idx_conflicts_schedule_a_id ON public.conflicts(schedule_a_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_schedule_b_id ON public.conflicts(schedule_b_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_type ON public.conflicts(type);
CREATE INDEX IF NOT EXISTS idx_conflicts_is_resolved ON public.conflicts(is_resolved);
CREATE INDEX IF NOT EXISTS idx_conflicts_severity ON public.conflicts(severity);

-- Notifications table indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Sharing requests table indexes
CREATE INDEX IF NOT EXISTS idx_sharing_requests_from_user_id ON public.sharing_requests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_sharing_requests_to_user_id ON public.sharing_requests(to_user_id);
CREATE INDEX IF NOT EXISTS idx_sharing_requests_resource_type ON public.sharing_requests(resource_type);
CREATE INDEX IF NOT EXISTS idx_sharing_requests_status ON public.sharing_requests(status);
CREATE INDEX IF NOT EXISTS idx_sharing_requests_resource ON public.sharing_requests(resource_type, resource_id);

-- User activity logs indexes
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_action_type ON public.user_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON public.user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_created ON public.user_activity_logs(user_id, created_at DESC);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Approval requests indexes
CREATE INDEX IF NOT EXISTS idx_approval_requests_requested_by ON public.approval_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON public.approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_created_at ON public.approval_requests(created_at DESC);

-- System rules indexes
CREATE INDEX IF NOT EXISTS idx_system_rules_rule_key ON public.system_rules(rule_key);
CREATE INDEX IF NOT EXISTS idx_system_rules_category ON public.system_rules(category);

-- Verification
SELECT 'Performance indexes added successfully' as status;
