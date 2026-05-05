-- Add room type system to replace name-based room matching
-- This migration creates a proper enum for room types and updates the rooms table

-- Create enum for room types
CREATE TYPE room_type_enum AS ENUM (
    'general_classroom',
    'computer_lab',
    'physics_lab',
    'chemistry_lab',
    'pe_hall',
    'science_lab',
    'art_room',
    'music_room',
    'library',
    'auditorium',
    'other'
);

-- Add room_type column to rooms table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'rooms' AND column_name = 'room_type'
    ) THEN
        ALTER TABLE rooms ADD COLUMN room_type room_type_enum;
    END IF;
END $$;

-- Migrate existing room names to room types based on naming patterns
UPDATE rooms SET room_type = 
    CASE 
        WHEN LOWER(name) LIKE '%physics%' THEN 'physics_lab'::room_type_enum
        WHEN LOWER(name) LIKE '%chemistry%' OR LOWER(name) LIKE '%chemical%' THEN 'chemistry_lab'::room_type_enum
        WHEN LOWER(name) LIKE '%computer%' OR LOWER(name) LIKE '%network%' OR LOWER(name) LIKE '%lab%' AND LOWER(name) NOT LIKE '%physics%' AND LOWER(name) NOT LIKE '%chemistry%' AND LOWER(name) NOT LIKE '%chemical%' THEN 'computer_lab'::room_type_enum
        WHEN LOWER(name) LIKE '%pe%' OR LOWER(name) LIKE '%physical education%' OR LOWER(name) LIKE '%p.e.%' OR LOWER(name) LIKE '%hall%' THEN 'pe_hall'::room_type_enum
        WHEN LOWER(name) LIKE '%science%' AND LOWER(name) NOT LIKE '%physics%' AND LOWER(name) NOT LIKE '%chemistry%' THEN 'science_lab'::room_type_enum
        WHEN LOWER(name) LIKE '%art%' THEN 'art_room'::room_type_enum
        WHEN LOWER(name) LIKE '%music%' THEN 'music_room'::room_type_enum
        WHEN LOWER(name) LIKE '%library%' THEN 'library'::room_type_enum
        WHEN LOWER(name) LIKE '%auditorium%' OR LOWER(name) LIKE '%auditor%' THEN 'auditorium'::room_type_enum
        ELSE 'general_classroom'::room_type_enum
    END
WHERE room_type IS NULL;

-- Add required_room_types column to subjects table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subjects' AND column_name = 'required_room_types'
    ) THEN
        ALTER TABLE subjects ADD COLUMN required_room_types room_type_enum[];
    END IF;
END $$;

-- Migrate existing subjects to required room types based on requires_lab flag and naming patterns
UPDATE subjects SET required_room_types = 
    CASE 
        WHEN requires_lab = true THEN
            CASE 
                WHEN LOWER(name) LIKE '%physics%' OR LOWER(code) LIKE '%phys%' THEN ARRAY['physics_lab'::room_type_enum]
                WHEN LOWER(name) LIKE '%chemistry%' OR LOWER(name) LIKE '%chemical%' OR LOWER(code) LIKE '%chem%' THEN ARRAY['chemistry_lab'::room_type_enum]
                WHEN LOWER(name) LIKE '%computer%' OR LOWER(name) LIKE '%programming%' OR LOWER(name) LIKE '%mobile%' OR LOWER(name) LIKE '%network%' OR LOWER(code) LIKE '%cp%' OR LOWER(code) LIKE '%cs%' OR LOWER(code) LIKE '%it%' OR LOWER(code) LIKE '%mp%' THEN ARRAY['computer_lab'::room_type_enum]
                WHEN LOWER(name) LIKE '%physical education%' OR LOWER(name) LIKE '%p.e.%' OR LOWER(code) LIKE '%pe%' THEN ARRAY['pe_hall'::room_type_enum]
                WHEN LOWER(name) LIKE '%science%' AND LOWER(name) NOT LIKE '%physics%' AND LOWER(name) NOT LIKE '%chemistry%' THEN ARRAY['science_lab'::room_type_enum]
                ELSE ARRAY['general_classroom'::room_type_enum]
            END
        ELSE ARRAY['general_classroom'::room_type_enum]
    END
WHERE required_room_types IS NULL;

-- Add comment to document the change
COMMENT ON COLUMN rooms.room_type IS 'Categorized room type for proper room-subject matching. Replaces fragile name-based matching.';
COMMENT ON COLUMN subjects.required_room_types IS 'Array of room types that this subject requires. Used for proper room-subject matching.';

-- Verify the migration
SELECT 
    'Room types distribution' as check_type,
    room_type,
    COUNT(*) as count
FROM rooms
GROUP BY room_type
ORDER BY room_type;

SELECT 
    'Subject required room types distribution' as check_type,
    required_room_types,
    COUNT(*) as count
FROM subjects
GROUP BY required_room_types
ORDER BY required_room_types;
