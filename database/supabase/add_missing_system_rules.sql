-- Add missing system rules per PRD requirements
-- These rules are required for the Permission Rules Engine

-- Insert missing rules if they don't exist
INSERT INTO public.system_rules (rule_key, rule_value, description, category, updated_by, updated_at)
VALUES 
    ('schedule_managers_can_create_without_approval', to_jsonb(false), 'If true, schedule managers can create and publish schedules without approval', 'permissions', (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1), now())
ON CONFLICT (rule_key) DO NOTHING;

INSERT INTO public.system_rules (rule_key, rule_value, description, category, updated_by, updated_at)
VALUES 
    ('schedule_managers_can_edit_without_approval', to_jsonb(false), 'If true, schedule managers can edit published schedules without re-approval', 'permissions', (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1), now())
ON CONFLICT (rule_key) DO NOTHING;

INSERT INTO public.system_rules (rule_key, rule_value, description, category, updated_by, updated_at)
VALUES 
    ('schedule_managers_access_all_data', to_jsonb(true), 'If true, schedule managers access all data; if false, only their assigned department data', 'permissions', (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1), now())
ON CONFLICT (rule_key) DO NOTHING;

-- Verification
SELECT rule_key, rule_value FROM public.system_rules 
WHERE rule_key IN ('schedule_managers_can_create_without_approval', 'schedule_managers_can_edit_without_approval', 'schedule_managers_access_all_data')
ORDER BY rule_key;
