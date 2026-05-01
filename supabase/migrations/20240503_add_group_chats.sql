-- Migration: Add group chat functionality
-- This migration adds tables and functions for group chats (departments, sections, schedule managers)

-- Group chats table
CREATE TABLE IF NOT EXISTS public.group_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('department', 'section', 'schedule_managers')),
    institution_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    department_name TEXT, -- Store department name directly since departments table doesn't exist
    section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_group_chats_type ON public.group_chats(type);
CREATE INDEX IF NOT EXISTS idx_group_chats_department_name ON public.group_chats(department_name);
CREATE INDEX IF NOT EXISTS idx_group_chats_section ON public.group_chats(section_id);
CREATE INDEX IF NOT EXISTS idx_group_chats_institution ON public.group_chats(institution_id);

-- Group chat members table
CREATE TABLE IF NOT EXISTS public.group_chat_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_chat_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_chat_id, user_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_group_chat_members_chat ON public.group_chat_members(group_chat_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_members_user ON public.group_chat_members(user_id);

-- Group chat messages table
CREATE TABLE IF NOT EXISTS public.group_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_chat_id UUID NOT NULL REFERENCES public.group_chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_read BOOLEAN DEFAULT FALSE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_group_chat_messages_chat ON public.group_chat_messages(group_chat_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_messages_sender ON public.group_chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_messages_created ON public.group_chat_messages(created_at DESC);

-- Add institution_name to system_rules if not exists
INSERT INTO public.system_rules (rule_key, rule_value, description, category)
VALUES ('institution_name', '"OptiSched Institution"'::jsonb, 'Name of the institution/organization', 'general')
ON CONFLICT (rule_key) DO UPDATE SET
    rule_value = EXCLUDED.rule_value,
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- Function to get institution name
CREATE OR REPLACE FUNCTION get_institution_name()
RETURNS TEXT AS $$
    SELECT rule_value::TEXT 
    FROM public.system_rules 
    WHERE rule_key = 'institution_name'
    LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Function to update group chat names when institution name changes
CREATE OR REPLACE FUNCTION update_group_chat_names_on_institution_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Update department group chats
    UPDATE public.group_chats
    SET name = department_name || ' - ' || NEW.rule_value::TEXT,
        updated_at = NOW()
    WHERE public.group_chats.type = 'department';
    
    -- Update section group chats
    UPDATE public.group_chats
    SET name = s.name || ' - ' || NEW.rule_value::TEXT,
        updated_at = NOW()
    FROM public.sections s
    WHERE public.group_chats.type = 'section'
    AND public.group_chats.section_id = s.id;
    
    -- Update schedule managers group chat
    UPDATE public.group_chats
    SET name = 'Schedule Managers - ' || NEW.rule_value::TEXT,
        updated_at = NOW()
    WHERE public.group_chats.type = 'schedule_managers';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update group chat names when institution name changes
DROP TRIGGER IF EXISTS institution_name_update_trigger ON public.system_rules;
CREATE TRIGGER institution_name_update_trigger
AFTER UPDATE OF rule_value ON public.system_rules
FOR EACH ROW
WHEN (OLD.rule_key = 'institution_name' AND NEW.rule_key = 'institution_name' AND OLD.rule_value::TEXT != NEW.rule_value::TEXT)
EXECUTE FUNCTION update_group_chat_names_on_institution_change();

-- Function to create department group chats for all unique departments
CREATE OR REPLACE FUNCTION create_department_group_chats()
RETURNS VOID AS $$
DECLARE
    institution_name TEXT;
    dept_record RECORD;
    chat_name TEXT;
BEGIN
    -- Get institution name
    SELECT rule_value::TEXT INTO institution_name
    FROM public.system_rules
    WHERE rule_key = 'institution_name'
    LIMIT 1;
    
    IF institution_name IS NULL THEN
        institution_name := 'Institution';
    END IF;
    
    -- Create group chats for each unique department
    FOR dept_record IN 
        SELECT DISTINCT department 
        FROM public.profiles 
        WHERE department IS NOT NULL 
        AND department != ''
    LOOP
        chat_name := dept_record.department || ' - ' || institution_name;
        
        INSERT INTO public.group_chats (name, type, department_name, institution_id)
        VALUES (chat_name, 'department', dept_record.department, NULL)
        ON CONFLICT DO NOTHING;
        
        -- Add all users in this department to the group chat
        INSERT INTO public.group_chat_members (group_chat_id, user_id)
        SELECT 
            gc.id,
            p.id
        FROM public.group_chats gc
        CROSS JOIN public.profiles p
        WHERE gc.type = 'department'
        AND gc.department_name = dept_record.department
        AND p.department = dept_record.department
        ON CONFLICT (group_chat_id, user_id) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to create section group chat
CREATE OR REPLACE FUNCTION create_section_group_chat()
RETURNS TRIGGER AS $$
DECLARE
    institution_name TEXT;
    chat_name TEXT;
BEGIN
    -- Get institution name
    SELECT rule_value::TEXT INTO institution_name
    FROM public.system_rules
    WHERE rule_key = 'institution_name'
    LIMIT 1;
    
    IF institution_name IS NULL THEN
        institution_name := 'Institution';
    END IF;
    
    -- Create group chat
    chat_name := NEW.name || ' - ' || institution_name;
    
    INSERT INTO public.group_chats (name, type, section_id, institution_id)
    VALUES (chat_name, 'section', NEW.id, NULL)
    ON CONFLICT DO NOTHING;
    
    -- Add all students in this section to the group chat
    INSERT INTO public.group_chat_members (group_chat_id, user_id)
    SELECT 
        gc.id,
        p.id
    FROM public.group_chats gc
    CROSS JOIN public.profiles p
    WHERE gc.type = 'section'
    AND gc.section_id = NEW.id
    AND p.role = 'student'
    ON CONFLICT (group_chat_id, user_id) DO NOTHING;
    
    -- Add teacher of this section if assigned
    -- This would need to be based on your section-teacher relationship
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create section group chat when section is created
DROP TRIGGER IF EXISTS create_section_group_chat_trigger ON public.sections;
CREATE TRIGGER create_section_group_chat_trigger
AFTER INSERT ON public.sections
FOR EACH ROW
EXECUTE FUNCTION create_section_group_chat();

-- Function to create schedule managers group chat (one-time setup)
CREATE OR REPLACE FUNCTION ensure_schedule_managers_group_chat()
RETURNS VOID AS $$
DECLARE
    institution_name TEXT;
    chat_name TEXT;
    chat_id UUID;
BEGIN
    -- Get institution name
    SELECT rule_value::TEXT INTO institution_name
    FROM public.system_rules
    WHERE rule_key = 'institution_name'
    LIMIT 1;
    
    IF institution_name IS NULL THEN
        institution_name := 'Institution';
    END IF;
    
    chat_name := 'Schedule Managers - ' || institution_name;
    
    -- Create group chat if it doesn't exist
    INSERT INTO public.group_chats (name, type, institution_id)
    VALUES (chat_name, 'schedule_managers', NULL)
    ON CONFLICT DO NOTHING
    RETURNING id INTO chat_id;
    
    -- If chat was created or exists, add all schedule managers
    IF chat_id IS NOT NULL OR EXISTS (SELECT 1 FROM public.group_chats WHERE type = 'schedule_managers') THEN
        -- Get the chat ID
        SELECT id INTO chat_id FROM public.group_chats WHERE type = 'schedule_managers' LIMIT 1;
        
        -- Add all schedule managers
        INSERT INTO public.group_chat_members (group_chat_id, user_id)
        SELECT chat_id, p.id
        FROM public.profiles p
        WHERE p.role = 'schedule_manager'
        ON CONFLICT (group_chat_id, user_id) DO NOTHING;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for group_chats
CREATE POLICY "Group chats are viewable by everyone" ON public.group_chats
FOR SELECT USING (true);

CREATE POLICY "Admins can insert group chats" ON public.group_chats
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'power_admin', 'system_admin')
    )
);

CREATE POLICY "Admins can update group chats" ON public.group_chats
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'power_admin', 'system_admin')
    )
);

-- RLS policies for group_chat_members
CREATE POLICY "Group chat members are viewable by members" ON public.group_chat_members
FOR SELECT USING (
    group_chat_id IN (
        SELECT gcm.group_chat_id 
        FROM public.group_chat_members gcm 
        WHERE gcm.user_id = auth.uid()
    )
);

CREATE POLICY "Admins can insert group chat members" ON public.group_chat_members
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'power_admin', 'system_admin')
    )
);

CREATE POLICY "Admins can delete group chat members" ON public.group_chat_members
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'power_admin', 'system_admin')
    )
);

-- RLS policies for group_chat_messages
CREATE POLICY "Group chat messages are viewable by members" ON public.group_chat_messages
FOR SELECT USING (
    group_chat_id IN (
        SELECT gcm.group_chat_id 
        FROM public.group_chat_members gcm 
        WHERE gcm.user_id = auth.uid()
    )
);

CREATE POLICY "Group chat members can insert messages" ON public.group_chat_messages
FOR INSERT WITH CHECK (
    group_chat_id IN (
        SELECT gcm.group_chat_id 
        FROM public.group_chat_members gcm 
        WHERE gcm.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update their own messages" ON public.group_chat_messages
FOR UPDATE USING (
    sender_id = auth.uid()
);

CREATE POLICY "Admins can delete any messages" ON public.group_chat_messages
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'power_admin', 'system_admin')
    )
);

-- Create the schedule managers group chat on migration
SELECT ensure_schedule_managers_group_chat();

-- Create department group chats for existing departments
SELECT create_department_group_chats();

-- Update existing group chat names for existing sections
UPDATE public.group_chats
SET name = s.name || ' - ' || COALESCE((SELECT rule_value::TEXT FROM public.system_rules WHERE rule_key = 'institution_name' LIMIT 1), 'Institution')
FROM public.sections s
WHERE public.group_chats.type = 'section'
AND public.group_chats.section_id = s.id;
