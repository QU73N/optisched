-- ============================================================================
-- MIGRATION: Room-Subject Compatibility System
-- This script updates the database to support the new room-subject compatibility
-- system where rooms are common/special and subjects are common/special,
-- with a junction table managing the many-to-many relationship.
-- ============================================================================

-- ============================================================================
-- SECTION 1: Add missing columns to rooms and subjects tables
-- ============================================================================

-- Add room_facility_type to rooms (keeps the specific facility type for informational purposes)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rooms' AND column_name = 'room_facility_type'
    ) THEN
        ALTER TABLE public.rooms ADD COLUMN room_facility_type text;
    END IF;
END $$;

-- Add is_special_room flag (explicit flag for special rooms, redundant with type but useful for queries)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rooms' AND column_name = 'is_special_room'
    ) THEN
        ALTER TABLE public.rooms ADD COLUMN is_special_room boolean DEFAULT false;
    END IF;
END $$;

-- Add generation-specific columns to subjects
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subjects' AND column_name = 'required_weekly_hours'
    ) THEN
        ALTER TABLE public.subjects ADD COLUMN required_weekly_hours integer;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subjects' AND column_name = 'optional_monthly_hours'
    ) THEN
        ALTER TABLE public.subjects ADD COLUMN optional_monthly_hours numeric;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subjects' AND column_name = 'session_duration_preference'
    ) THEN
        ALTER TABLE public.subjects ADD COLUMN session_duration_preference integer DEFAULT 60;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subjects' AND column_name = 'priority_level'
    ) THEN
        ALTER TABLE public.subjects ADD COLUMN priority_level text DEFAULT 'normal' CHECK (priority_level IN ('high', 'normal', 'low'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subjects' AND column_name = 'requires_special_room'
    ) THEN
        ALTER TABLE public.subjects ADD COLUMN requires_special_room boolean DEFAULT false;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subjects' AND column_name = 'preferred_time_window'
    ) THEN
        ALTER TABLE public.subjects ADD COLUMN preferred_time_window text;
    END IF;
END $$;

-- Add generation-specific columns to sections
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sections' AND column_name = 'hierarchy_path'
    ) THEN
        ALTER TABLE public.sections ADD COLUMN hierarchy_path text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sections' AND column_name = 'hierarchy_weight'
    ) THEN
        ALTER TABLE public.sections ADD COLUMN hierarchy_weight numeric DEFAULT 50;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sections' AND column_name = 'priority_weight'
    ) THEN
        ALTER TABLE public.sections ADD COLUMN priority_weight numeric DEFAULT 50;
    END IF;
END $$;

-- ============================================================================
-- SECTION 2: Ensure subject_rooms junction table exists and is properly configured
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'subject_rooms'
    ) THEN
        CREATE TABLE public.subject_rooms (
            subject_id uuid NOT NULL,
            room_id uuid NOT NULL,
            created_at timestamp with time zone DEFAULT now(),
            priority integer DEFAULT 1,
            CONSTRAINT subject_rooms_pkey PRIMARY KEY (subject_id, room_id),
            CONSTRAINT subject_rooms_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE,
            CONSTRAINT subject_rooms_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE
        );
    END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_subject_rooms_room_id ON public.subject_rooms(room_id);
CREATE INDEX IF NOT EXISTS idx_subject_rooms_subject_id ON public.subject_rooms(subject_id);

-- ============================================================================
-- SECTION 3: Data Migration
-- ============================================================================

-- Convert priority_level from integer to text if it exists as integer
DO $$
BEGIN
    -- Check if priority_level column exists and is integer type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subjects' 
        AND column_name = 'priority_level'
        AND data_type = 'integer'
    ) THEN
        -- Add new column as text
        ALTER TABLE public.subjects ADD COLUMN priority_level_new text;
        
        -- Migrate data: map integers to text values
        UPDATE public.subjects 
        SET priority_level_new = CASE 
            WHEN priority_level >= 75 THEN 'high'
            WHEN priority_level >= 25 THEN 'normal'
            ELSE 'low'
        END
        WHERE priority_level IS NOT NULL;
        
        -- Set default for NULL values
        UPDATE public.subjects 
        SET priority_level_new = 'normal'
        WHERE priority_level_new IS NULL;
        
        -- Drop old column and rename new one
        ALTER TABLE public.subjects DROP COLUMN priority_level;
        ALTER TABLE public.subjects RENAME COLUMN priority_level_new TO priority_level;
        
        -- Add check constraint
        ALTER TABLE public.subjects ADD CONSTRAINT priority_level_check 
            CHECK (priority_level IN ('high', 'normal', 'low'));
    END IF;
END $$;

-- Migrate existing subject_compatibility JSONB data to subject_rooms junction table
DO $$
DECLARE
    room_record RECORD;
    subject_record RECORD;
    room_id uuid;
    subject_id uuid;
BEGIN
    -- For each room that has subject_compatibility data
    FOR room_record IN 
        SELECT id, subject_compatibility 
        FROM public.rooms 
        WHERE subject_compatibility IS NOT NULL 
        AND subject_compatibility != '{}'::jsonb
    LOOP
        room_id := room_record.id;
        
        -- Extract subject IDs from JSONB (assuming format: {"subject_ids": ["id1", "id2"]} or array format)
        -- Try multiple possible JSONB structures
        IF jsonb_typeof(room_record.subject_compatibility) = 'array' THEN
            -- Direct array format
            FOR subject_record IN 
                SELECT jsonb_array_elements_text(room_record.subject_compatibility)::uuid as subject_id
            LOOP
                subject_id := subject_record.subject_id;
                
                -- Insert into junction table if not exists
                IF NOT EXISTS (
                    SELECT 1 FROM public.subject_rooms 
                    WHERE subject_id = subject_id AND room_id = room_id
                ) THEN
                    INSERT INTO public.subject_rooms (subject_id, room_id, priority)
                    VALUES (subject_id, room_id, 1);
                END IF;
            END LOOP;
        ELSIF jsonb_typeof(room_record.subject_compatibility) = 'object' THEN
            -- Object format - try to find an array field
            IF room_record.subject_compatibility ? 'subject_ids' THEN
                FOR subject_record IN 
                    SELECT jsonb_array_elements_text(room_record.subject_compatibility->'subject_ids')::uuid as subject_id
                LOOP
                    subject_id := subject_record.subject_id;
                    
                    IF NOT EXISTS (
                        SELECT 1 FROM public.subject_rooms 
                        WHERE subject_id = subject_id AND room_id = room_id
                    ) THEN
                        INSERT INTO public.subject_rooms (subject_id, room_id, priority)
                        VALUES (subject_id, room_id, 1);
                    END IF;
                END LOOP;
            ELSIF room_record.subject_compatibility ? 'compatible_subjects' THEN
                FOR subject_record IN 
                    SELECT jsonb_array_elements_text(room_record.subject_compatibility->'compatible_subjects')::uuid as subject_id
                LOOP
                    subject_id := subject_record.subject_id;
                    
                    IF NOT EXISTS (
                        SELECT 1 FROM public.subject_rooms 
                        WHERE subject_id = subject_id AND room_id = room_id
                    ) THEN
                        INSERT INTO public.subject_rooms (subject_id, room_id, priority)
                        VALUES (subject_id, room_id, 1);
                    END IF;
                END LOOP;
            END IF;
        END IF;
    END LOOP;
END $$;

-- Migrate requires_lab boolean to type field
DO $$
BEGIN
    -- If requires_lab column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subjects' 
        AND column_name = 'requires_lab'
    ) THEN
        -- Update type field based on requires_lab
        UPDATE public.subjects
        SET type = CASE 
            WHEN requires_lab = true THEN 'special'
            WHEN type IS NULL OR type = '' THEN 'common'
            ELSE type
        END
        WHERE requires_lab IS NOT NULL;
    END IF;
END $$;

-- Update is_special_room flag based on type
UPDATE public.rooms
SET is_special_room = (type = 'special')
WHERE is_special_room IS NULL OR is_special_room != (type = 'special');

-- Set default room_facility_type based on existing data if possible
UPDATE public.rooms
SET room_facility_type = 'general_classroom'
WHERE room_facility_type IS NULL;

-- ============================================================================
-- SECTION 4: Verification
-- ============================================================================

SELECT 
    'MIGRATION COMPLETE' as status,
    'Room-Subject compatibility system updated' as message;

-- Show room counts by type
SELECT 
    'ROOM TYPES' as category,
    type,
    COUNT(*) as count
FROM public.rooms
GROUP BY type
ORDER BY type;

-- Show subject counts by type
SELECT 
    'SUBJECT TYPES' as category,
    type,
    COUNT(*) as count
FROM public.subjects
GROUP BY type
ORDER BY type;

-- Show subject_rooms junction table count
SELECT 
    'SUBJECT-ROOM RELATIONSHIPS' as category,
    COUNT(*) as total_relationships
FROM public.subject_rooms;

-- Show rooms with compatibility data
SELECT 
    'ROOMS WITH COMPATIBILITY' as category,
    COUNT(*) as count
FROM public.rooms
WHERE subject_compatibility != '{}'::jsonb;
