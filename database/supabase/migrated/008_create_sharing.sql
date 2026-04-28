-- ============================================================================
-- Migration 008: Sharing and Collaboration System
-- Enables schedule managers to share teachers, rooms, subjects, and sections
-- with public/private visibility and sharing requests
-- ============================================================================

-- Add sharing columns to teachers table
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS shared_with uuid[] DEFAULT '{}';

-- Add sharing columns to rooms table
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS shared_with uuid[] DEFAULT '{}';

-- Add sharing columns to subjects table
ALTER TABLE subjects 
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS shared_with uuid[] DEFAULT '{}';

-- Add sharing columns to sections table
ALTER TABLE sections 
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS shared_with uuid[] DEFAULT '{}';

-- Create sharing requests table
CREATE TABLE IF NOT EXISTS sharing_requests (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource_type text NOT NULL CHECK (resource_type IN ('teacher', 'room', 'subject', 'section')),
    resource_id uuid NOT NULL,
    from_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    to_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    message text,
    created_at timestamptz DEFAULT now(),
    responded_at timestamptz
);

-- Indexes for sharing requests
CREATE INDEX IF NOT EXISTS ix_sharing_requests_resource ON sharing_requests(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS ix_sharing_requests_user ON sharing_requests(from_user_id, to_user_id);
CREATE INDEX IF NOT EXISTS ix_sharing_requests_status ON sharing_requests(status, created_at);

-- Indexes for shared_with arrays
CREATE INDEX IF NOT EXISTS ix_teachers_shared_with ON teachers USING GIN(shared_with);
CREATE INDEX IF NOT EXISTS ix_rooms_shared_with ON rooms USING GIN(shared_with);
CREATE INDEX IF NOT EXISTS ix_subjects_shared_with ON subjects USING GIN(shared_with);
CREATE INDEX IF NOT EXISTS ix_sections_shared_with ON sections USING GIN(shared_with);

-- Function to share a resource with a user
CREATE OR REPLACE FUNCTION share_resource(
    p_resource_type text,
    p_resource_id uuid,
    p_from_user_id uuid,
    p_to_user_id uuid,
    p_message text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request_id uuid;
BEGIN
    -- Check if user already has access
    IF p_resource_type = 'teacher' THEN
        IF EXISTS (
            SELECT 1 FROM teachers 
            WHERE id = p_resource_id 
            AND (is_public = true OR p_to_user_id = ANY(shared_with) OR owner_id = p_to_user_id)
        ) THEN
            RAISE EXCEPTION 'User already has access to this resource';
        END IF;
    ELSIF p_resource_type = 'room' THEN
        IF EXISTS (
            SELECT 1 FROM rooms 
            WHERE id = p_resource_id 
            AND (is_public = true OR p_to_user_id = ANY(shared_with) OR owner_id = p_to_user_id)
        ) THEN
            RAISE EXCEPTION 'User already has access to this resource';
        END IF;
    ELSIF p_resource_type = 'subject' THEN
        IF EXISTS (
            SELECT 1 FROM subjects 
            WHERE id = p_resource_id 
            AND (is_public = true OR p_to_user_id = ANY(shared_with) OR owner_id = p_to_user_id)
        ) THEN
            RAISE EXCEPTION 'User already has access to this resource';
        END IF;
    ELSIF p_resource_type = 'section' THEN
        IF EXISTS (
            SELECT 1 FROM sections 
            WHERE id = p_resource_id 
            AND (is_public = true OR p_to_user_id = ANY(shared_with) OR owner_id = p_to_user_id)
        ) THEN
            RAISE EXCEPTION 'User already has access to this resource';
        END IF;
    END IF;

    -- Create sharing request
    INSERT INTO sharing_requests (
        resource_type,
        resource_id,
        from_user_id,
        to_user_id,
        message
    ) VALUES (
        p_resource_type,
        p_resource_id,
        p_from_user_id,
        p_to_user_id,
        p_message
    ) RETURNING id INTO v_request_id;

    RETURN v_request_id;
END;
$$;

-- Function to respond to a sharing request
CREATE OR REPLACE FUNCTION respond_sharing_request(
    p_request_id uuid,
    p_status text, -- 'approved' or 'rejected'
    p_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request record;
    v_table_name text;
BEGIN
    -- Get request details
    SELECT * INTO v_request
    FROM sharing_requests
    WHERE id = p_request_id AND to_user_id = p_user_id;

    IF v_request IS NULL THEN
        RAISE EXCEPTION 'Request not found or unauthorized';
    END IF;

    IF v_request.status != 'pending' THEN
        RAISE EXCEPTION 'Request already processed';
    END IF;

    -- Determine table name
    IF v_request.resource_type = 'teacher' THEN v_table_name := 'teachers';
    ELSIF v_request.resource_type = 'room' THEN v_table_name := 'rooms';
    ELSIF v_request.resource_type = 'subject' THEN v_table_name := 'subjects';
    ELSIF v_request.resource_type = 'section' THEN v_table_name := 'sections';
    ELSE
        RAISE EXCEPTION 'Invalid resource type';
    END IF;

    -- If approved, add user to shared_with
    IF p_status = 'approved' THEN
        EXECUTE format('UPDATE %I SET shared_with = array_append(shared_with, $1) WHERE id = $2', v_table_name)
        USING v_request.from_user_id, v_request.resource_id;
    END IF;

    -- Update request status
    UPDATE sharing_requests
    SET status = p_status,
        responded_at = now()
    WHERE id = p_request_id;

    RETURN true;
END;
$$;

-- Function to grant direct access (bypass request)
CREATE OR REPLACE FUNCTION grant_resource_access(
    p_resource_type text,
    p_resource_id uuid,
    p_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_table_name text;
BEGIN
    -- Determine table name
    IF p_resource_type = 'teacher' THEN v_table_name := 'teachers';
    ELSIF p_resource_type = 'room' THEN v_table_name := 'rooms';
    ELSIF p_resource_type = 'subject' THEN v_table_name := 'subjects';
    ELSIF p_resource_type = 'section' THEN v_table_name := 'sections';
    ELSE
        RAISE EXCEPTION 'Invalid resource type';
    END IF;

    -- Add user to shared_with
    EXECUTE format('UPDATE %I SET shared_with = array_append(shared_with, $1) WHERE id = $2', v_table_name)
    USING p_user_id, p_resource_id;

    RETURN true;
END;
$$;

-- Function to revoke resource access
CREATE OR REPLACE FUNCTION revoke_resource_access(
    p_resource_type text,
    p_resource_id uuid,
    p_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_table_name text;
BEGIN
    -- Determine table name
    IF p_resource_type = 'teacher' THEN v_table_name := 'teachers';
    ELSIF p_resource_type = 'room' THEN v_table_name := 'rooms';
    ELSIF p_resource_type = 'subject' THEN v_table_name := 'subjects';
    ELSIF p_resource_type = 'section' THEN v_table_name := 'sections';
    ELSE
        RAISE EXCEPTION 'Invalid resource type';
    END IF;

    -- Remove user from shared_with
    EXECUTE format('UPDATE %I SET shared_with = array_remove(shared_with, $1) WHERE id = $2', v_table_name)
    USING p_user_id, p_resource_id;

    RETURN true;
END;
$$;

-- RLS Policies for sharing_requests
ALTER TABLE sharing_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY sharing_requests_read_own ON sharing_requests
    FOR SELECT USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY sharing_requests_insert_own ON sharing_requests
    FOR INSERT WITH CHECK (from_user_id = auth.uid());

CREATE POLICY sharing_requests_update_to_user ON sharing_requests
    FOR UPDATE USING (to_user_id = auth.uid() AND status = 'pending');

-- RLS Policies for teachers (sharing-aware)
CREATE POLICY teachers_read_shared ON teachers
    FOR SELECT USING (
        owner_id = auth.uid() 
        OR is_public = true 
        OR auth.uid() = ANY(shared_with)
    );

CREATE POLICY teachers_update_own ON teachers
    FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY teachers_insert_own ON teachers
    FOR INSERT WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);

-- RLS Policies for rooms (sharing-aware)
CREATE POLICY rooms_read_shared ON rooms
    FOR SELECT USING (
        owner_id = auth.uid() 
        OR is_public = true 
        OR auth.uid() = ANY(shared_with)
    );

CREATE POLICY rooms_update_own ON rooms
    FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY rooms_insert_own ON rooms
    FOR INSERT WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);

-- RLS Policies for subjects (sharing-aware)
CREATE POLICY subjects_read_shared ON subjects
    FOR SELECT USING (
        owner_id = auth.uid() 
        OR is_public = true 
        OR auth.uid() = ANY(shared_with)
    );

CREATE POLICY subjects_update_own ON subjects
    FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY subjects_insert_own ON subjects
    FOR INSERT WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);

-- RLS Policies for sections (sharing-aware)
CREATE POLICY sections_read_shared ON sections
    FOR SELECT USING (
        owner_id = auth.uid() 
        OR is_public = true 
        OR auth.uid() = ANY(shared_with)
    );

CREATE POLICY sections_update_own ON sections
    FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY sections_insert_own ON sections
    FOR INSERT WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION share_resource(text, uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION respond_sharing_request(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION grant_resource_access(text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_resource_access(text, uuid, uuid) TO authenticated;
