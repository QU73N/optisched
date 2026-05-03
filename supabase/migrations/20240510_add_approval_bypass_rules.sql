-- Migration: Add Approval Bypass Rules
-- Purpose: Add system rules for schedule manager approval bypass per PRD §3.2
-- These rules allow schedule managers to create/edit schedules without requiring approval
-- Also adds default session length configuration per PRD §9.2

-- Insert approval bypass rules if they don't exist
INSERT INTO public.system_rules (rule_key, rule_value, description, category, role_overrides)
VALUES 
    ('schedule_managers_can_create_without_approval', 'false'::jsonb, 'Allow schedule managers to create schedules without requiring approval', 'approval', '{}'::jsonb),
    ('schedule_managers_can_edit_without_approval', 'false'::jsonb, 'Allow schedule managers to edit schedules without requiring approval', 'approval', '{}'::jsonb),
    ('default_session_length_minutes', '60'::jsonb, 'Default length of a scheduling block in minutes', 'scheduling', '{}'::jsonb)
ON CONFLICT (rule_key) DO NOTHING;

-- Add comment to document these rules
COMMENT ON COLUMN public.system_rules.rule_value IS 'JSONB value for the rule. For boolean rules, use true/false as JSONB values. For numeric rules, use numbers as JSONB values.';

-- Verification query
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.system_rules WHERE rule_key IN ('schedule_managers_can_create_without_approval', 'schedule_managers_can_edit_without_approval', 'default_session_length_minutes');
    
    IF v_count = 3 THEN
        RAISE NOTICE 'System rules added successfully';
        RAISE NOTICE 'Rules added: schedule_managers_can_create_without_approval, schedule_managers_can_edit_without_approval, default_session_length_minutes';
        RAISE NOTICE 'Default values: approval bypass = false (approval required), session length = 60 minutes';
        RAISE NOTICE 'To enable approval bypass, update rule_value to true in system_rules table';
        RAISE NOTICE 'To change session length, update rule_value to desired minutes in system_rules table';
    ELSE
        RAISE NOTICE 'Expected 3 rules, found %', v_count;
    END IF;
END $$;
