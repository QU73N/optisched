-- Seed system_rules table with PRD-defined rules
-- Section 3.2: Permission Rules Engine
-- Section 13.1: Hard Constraints (max teaching hours)

-- Insert permission rules per PRD Section 3.2
INSERT INTO public.system_rules (rule_key, rule_value, description, category, updated_at)
VALUES 
    ('teachers_can_see_student_schedules', 'false'::jsonb, 'If true, teachers can view student schedules', 'permissions', now()),
    ('schedule_managers_can_create_without_approval', 'false'::jsonb, 'If true, schedule managers can create and publish schedules without approval', 'permissions', now()),
    ('schedule_managers_can_edit_without_approval', 'false'::jsonb, 'If true, schedule managers can edit published schedules without re-approval', 'permissions', now()),
    ('schedule_managers_access_all_data', 'true'::jsonb, 'If true, schedule managers access all data; if false, only their assigned department data', 'permissions', now()),
    ('students_can_see_teacher_names', 'true'::jsonb, 'If true, students can see teacher names in their schedules', 'permissions', now()),
    ('teachers_can_message_admins', 'true'::jsonb, 'If true, teachers can send messages to administrators', 'permissions', now())
ON CONFLICT (rule_key) DO NOTHING;

-- Insert constraint rules per PRD Section 13.1
INSERT INTO public.system_rules (rule_key, rule_value, description, category, updated_at)
VALUES 
    ('max_consecutive_hours_per_day', '3'::jsonb, 'Maximum consecutive teaching hours per day (hard constraint)', 'constraints', now()),
    ('default_max_hours_per_day', '8'::jsonb, 'Default maximum teaching hours per day for teachers', 'constraints', now()),
    ('default_max_hours_per_week', '40'::jsonb, 'Default maximum teaching hours per week for teachers', 'constraints', now())
ON CONFLICT (rule_key) DO NOTHING;

-- Insert general system rules
INSERT INTO public.system_rules (rule_key, rule_value, description, category, updated_at)
VALUES 
    ('institution_name', '"STI College"'::jsonb, 'Institution name used in group chat names', 'general', now())
ON CONFLICT (rule_key) DO NOTHING;
