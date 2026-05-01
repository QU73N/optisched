-- Update get_teachers_with_profiles to return all fields needed by FacultyHub
DROP FUNCTION IF EXISTS get_teachers_with_profiles();

CREATE OR REPLACE FUNCTION get_teachers_with_profiles()
RETURNS TABLE (
    id uuid,
    profile_id uuid,
    department text,
    employment_type text,
    max_hours integer,
    current_load_percentage numeric,
    is_active boolean,
    weight integer,
    priority_note text,
    is_public boolean,
    full_name text,
    email text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT 
        t.id,
        t.profile_id,
        t.department,
        t.employment_type,
        t.max_hours,
        t.current_load_percentage,
        t.is_active,
        t.weight,
        t.priority_note,
        t.is_public,
        p.full_name,
        p.email
    FROM public.teachers t
    LEFT JOIN public.profiles p ON p.id = t.profile_id
    WHERE t.is_public = true;
$$;

-- Verify the function works
SELECT * FROM get_teachers_with_profiles();
