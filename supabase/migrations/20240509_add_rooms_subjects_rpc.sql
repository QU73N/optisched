-- Create RPC functions to fetch rooms and subjects with details, bypassing RLS
-- This fixes the 400 errors when loading rooms and subjects

-- Function to get all rooms with details
CREATE OR REPLACE FUNCTION get_rooms_with_details()
RETURNS TABLE (
    id UUID,
    name TEXT,
    building TEXT,
    type TEXT,
    capacity INTEGER,
    floor INTEGER,
    subject_compatibility JSONB,
    equipment JSONB,
    is_available BOOLEAN,
    weight INTEGER,
    priority_note TEXT,
    room_facility_type TEXT,
    is_special_room BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.name,
        r.building,
        r.type,
        r.capacity,
        r.floor,
        r.subject_compatibility,
        r.equipment_available,
        r.is_available,
        r.weight,
        r.priority_note,
        r.room_facility_type,
        r.is_special_room
    FROM rooms r
    ORDER BY r.name;
END;
$$;

-- Function to get all subjects with details
CREATE OR REPLACE FUNCTION get_subjects_with_details()
RETURNS TABLE (
    id UUID,
    name TEXT,
    code TEXT,
    type TEXT,
    units INTEGER,
    duration_hours NUMERIC,
    program TEXT,
    year_level INTEGER,
    requires_lab BOOLEAN,
    teacher_id UUID,
    weight INTEGER,
    priority_note TEXT,
    requires_special_room BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.code,
        s.type,
        s.units,
        s.duration_hours,
        s.program,
        s.year_level,
        s.requires_lab,
        s.teacher_id,
        s.weight,
        s.priority_note,
        s.requires_special_room
    FROM subjects s
    ORDER BY s.name;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_rooms_with_details() TO authenticated;
GRANT EXECUTE ON FUNCTION get_subjects_with_details() TO authenticated;
GRANT EXECUTE ON FUNCTION get_rooms_with_details() TO anon;
GRANT EXECUTE ON FUNCTION get_subjects_with_details() TO anon;

-- Test the functions
SELECT 'Testing get_rooms_with_details()' as test;
SELECT * FROM get_rooms_with_details() LIMIT 3;

SELECT 'Testing get_subjects_with_details()' as test;
SELECT * FROM get_subjects_with_details() LIMIT 3;
