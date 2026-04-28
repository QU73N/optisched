-- ============================================================================
-- Migration 010: Break Times Configuration
-- Enables configuration of institution-wide break times (lunch, recess, etc.)
-- that the schedule generator must respect
-- ============================================================================

-- Create institution_breaks table
CREATE TABLE IF NOT EXISTS institution_breaks (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    break_type text NOT NULL CHECK (break_type IN ('lunch', 'recess', 'assembly', 'other')),
    day_of_week text NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'all')),
    start_time text NOT NULL,
    end_time text NOT NULL,
    is_active boolean DEFAULT true,
    academic_year text,
    semester text,
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

-- Indexes for institution_breaks
CREATE INDEX IF NOT EXISTS ix_institution_breaks_day ON institution_breaks(day_of_week);
CREATE INDEX IF NOT EXISTS ix_institution_breaks_active ON institution_breaks(is_active);
CREATE INDEX IF NOT EXISTS ix_institution_breaks_year_semester ON institution_breaks(academic_year, semester);

-- Function to get all active breaks for a specific day
CREATE OR REPLACE FUNCTION get_breaks_for_day(
    p_day text,
    p_academic_year text DEFAULT NULL,
    p_semester text DEFAULT NULL
) RETURNS TABLE (
    id uuid,
    name text,
    break_type text,
    start_time text,
    end_time text,
    description text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ib.id,
        ib.name,
        ib.break_type,
        ib.start_time,
        ib.end_time,
        ib.description
    FROM institution_breaks ib
    WHERE ib.is_active = true
    AND (ib.day_of_week = p_day OR ib.day_of_week = 'all')
    AND (p_academic_year IS NULL OR ib.academic_year IS NULL OR ib.academic_year = p_academic_year)
    AND (p_semester IS NULL OR ib.semester IS NULL OR ib.semester = p_semester)
    ORDER BY ib.start_time;
END;
$$;

-- Function to check if a time slot conflicts with a break
CREATE OR REPLACE FUNCTION is_break_time(
    p_day text,
    p_time text,
    p_academic_year text DEFAULT NULL,
    p_semester text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_break_count integer;
BEGIN
    SELECT COUNT(*) INTO v_break_count
    FROM institution_breaks ib
    WHERE ib.is_active = true
    AND (ib.day_of_week = p_day OR ib.day_of_week = 'all')
    AND (p_academic_year IS NULL OR ib.academic_year IS NULL OR ib.academic_year = p_academic_year)
    AND (p_semester IS NULL OR ib.semester IS NULL OR ib.semester = p_semester)
    AND p_time >= ib.start_time
    AND p_time < ib.end_time;
    
    RETURN v_break_count > 0;
END;
$$;

-- Function to check if a time range conflicts with any break
CREATE OR REPLACE FUNCTION check_break_conflict(
    p_day text,
    p_start_time text,
    p_end_time text,
    p_academic_year text DEFAULT NULL,
    p_semester text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_conflict_count integer;
BEGIN
    SELECT COUNT(*) INTO v_conflict_count
    FROM institution_breaks ib
    WHERE ib.is_active = true
    AND (ib.day_of_week = p_day OR ib.day_of_week = 'all')
    AND (p_academic_year IS NULL OR ib.academic_year IS NULL OR ib.academic_year = p_academic_year)
    AND (p_semester IS NULL OR ib.semester IS NULL OR ib.semester = p_semester)
    AND (
        (p_start_time >= ib.start_time AND p_start_time < ib.end_time)
        OR (p_end_time > ib.start_time AND p_end_time <= ib.end_time)
        OR (p_start_time <= ib.start_time AND p_end_time >= ib.end_time)
    );
    
    RETURN v_conflict_count > 0;
END;
$$;

-- RLS policies for institution_breaks
ALTER TABLE institution_breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY institution_breaks_read_all ON institution_breaks
    FOR SELECT USING (true);

CREATE POLICY institution_breaks_insert_admin ON institution_breaks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
        )
    );

CREATE POLICY institution_breaks_update_admin ON institution_breaks
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
        )
    );

CREATE POLICY institution_breaks_delete_admin ON institution_breaks
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
        )
    );

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_breaks_for_day(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION is_break_time(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_break_conflict(text, text, text, text, text) TO authenticated;

-- Insert default break times (lunch break)
INSERT INTO institution_breaks (name, break_type, day_of_week, start_time, end_time, description, created_by) 
SELECT 
    'Lunch Break',
    'lunch',
    'all',
    '12:00',
    '13:00',
    'Standard lunch break for all days',
    (SELECT id FROM profiles WHERE role IN ('admin', 'power_admin', 'system_admin') LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM institution_breaks WHERE break_type = 'lunch' AND day_of_week = 'all');
