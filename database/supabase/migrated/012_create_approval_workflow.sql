-- ============================================================================
-- Migration 012: Approval Workflow
-- Enables approval workflow for schedule changes with states, logging, and notifications
-- ============================================================================

-- Create approval_requests table
CREATE TABLE IF NOT EXISTS approval_requests (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_type text NOT NULL CHECK (request_type IN ('schedule_change', 'new_schedule', 'delete_schedule', 'bulk_change')),
    resource_type text NOT NULL CHECK (resource_type IN ('schedule', 'section', 'teacher', 'room', 'subject')),
    resource_id uuid,
    requested_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    title text NOT NULL,
    description text,
    change_data jsonb DEFAULT '{}'::jsonb,
    approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    approved_at timestamptz,
    rejection_reason text,
    academic_year text,
    semester text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create approval_audit_log table
CREATE TABLE IF NOT EXISTS approval_audit_log (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    approval_request_id uuid NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    action text NOT NULL CHECK (action IN ('created', 'approved', 'rejected', 'cancelled', 'commented')),
    performed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    notes text,
    previous_status text,
    new_status text,
    created_at timestamptz DEFAULT now()
);

-- Indexes for approval_requests
CREATE INDEX IF NOT EXISTS ix_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS ix_approval_requests_requested_by ON approval_requests(requested_by);
CREATE INDEX IF NOT EXISTS ix_approval_requests_resource ON approval_requests(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS ix_approval_requests_year_semester ON approval_requests(academic_year, semester);

-- Indexes for approval_audit_log
CREATE INDEX IF NOT EXISTS ix_approval_audit_log_request ON approval_audit_log(approval_request_id);
CREATE INDEX IF NOT EXISTS ix_approval_audit_log_performed_by ON approval_audit_log(performed_by);

-- Function to create an approval request
CREATE OR REPLACE FUNCTION create_approval_request(
    p_request_type text,
    p_resource_type text,
    p_resource_id uuid,
    p_requested_by uuid,
    p_title text,
    p_description text DEFAULT NULL,
    p_change_data jsonb DEFAULT '{}'::jsonb,
    p_academic_year text DEFAULT NULL,
    p_semester text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_request_id uuid;
BEGIN
    INSERT INTO approval_requests (
        request_type,
        resource_type,
        resource_id,
        requested_by,
        title,
        description,
        change_data,
        academic_year,
        semester
    )
    VALUES (
        p_request_type,
        p_resource_type,
        p_resource_id,
        p_requested_by,
        p_title,
        p_description,
        p_change_data,
        p_academic_year,
        p_semester
    )
    RETURNING id INTO v_request_id;
    
    -- Log the creation
    INSERT INTO approval_audit_log (
        approval_request_id,
        action,
        performed_by,
        notes,
        previous_status,
        new_status
    )
    VALUES (
        v_request_id,
        'created',
        p_requested_by,
        p_description,
        NULL,
        'pending'
    );
    
    -- Send notification to approvers (admin users)
    INSERT INTO notifications (user_id, type, title, message, data, action_url)
    SELECT 
        p.id,
        'approval',
        'New Approval Request',
        p_title,
        jsonb_build_object(
            'approval_request_id', v_request_id,
            'request_type', p_request_type
        ),
        '/admin/approvals'
    FROM profiles p
    WHERE p.role IN ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager');
    
    RETURN v_request_id;
END;
$$;

-- Function to approve a request
CREATE OR REPLACE FUNCTION approve_request(
    p_request_id uuid,
    p_approved_by uuid,
    p_notes text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_status text;
BEGIN
    -- Get current status
    SELECT status INTO v_status
    FROM approval_requests
    WHERE id = p_request_id;
    
    IF v_status IS NULL THEN
        RETURN false;
    END IF;
    
    IF v_status != 'pending' THEN
        RETURN false;
    END IF;
    
    -- Update the request
    UPDATE approval_requests
    SET 
        status = 'approved',
        approved_by = p_approved_by,
        approved_at = now(),
        updated_at = now()
    WHERE id = p_request_id;
    
    -- Log the approval
    INSERT INTO approval_audit_log (
        approval_request_id,
        action,
        performed_by,
        notes,
        previous_status,
        new_status
    )
    VALUES (
        p_request_id,
        'approved',
        p_approved_by,
        p_notes,
        'pending',
        'approved'
    );
    
    -- Send notification to requester
    INSERT INTO notifications (user_id, type, title, message, data, action_url)
    SELECT 
        ar.requested_by,
        'approval',
        'Request Approved',
        'Your request "' || ar.title || '" has been approved',
        jsonb_build_object(
            'approval_request_id', p_request_id
        ),
        '/admin/approvals'
    FROM approval_requests ar
    WHERE ar.id = p_request_id;
    
    RETURN true;
END;
$$;

-- Function to reject a request
CREATE OR REPLACE FUNCTION reject_request(
    p_request_id uuid,
    p_rejected_by uuid,
    p_reason text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_status text;
BEGIN
    -- Get current status
    SELECT status INTO v_status
    FROM approval_requests
    WHERE id = p_request_id;
    
    IF v_status IS NULL THEN
        RETURN false;
    END IF;
    
    IF v_status != 'pending' THEN
        RETURN false;
    END IF;
    
    -- Update the request
    UPDATE approval_requests
    SET 
        status = 'rejected',
        approved_by = p_rejected_by,
        approved_at = now(),
        rejection_reason = p_reason,
        updated_at = now()
    WHERE id = p_request_id;
    
    -- Log the rejection
    INSERT INTO approval_audit_log (
        approval_request_id,
        action,
        performed_by,
        notes,
        previous_status,
        new_status
    )
    VALUES (
        p_request_id,
        'rejected',
        p_rejected_by,
        p_reason,
        'pending',
        'rejected'
    );
    
    -- Send notification to requester
    INSERT INTO notifications (user_id, type, title, message, data, action_url)
    SELECT 
        ar.requested_by,
        'approval',
        'Request Rejected',
        'Your request "' || ar.title || '" has been rejected' || 
        CASE WHEN p_reason IS NOT NULL THEN ': ' || p_reason ELSE '' END,
        jsonb_build_object(
            'approval_request_id', p_request_id
        ),
        '/admin/approvals'
    FROM approval_requests ar
    WHERE ar.id = p_request_id;
    
    RETURN true;
END;
$$;

-- Function to cancel a request
CREATE OR REPLACE FUNCTION cancel_request(
    p_request_id uuid,
    p_cancelled_by uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_status text;
BEGIN
    -- Get current status
    SELECT status INTO v_status
    FROM approval_requests
    WHERE id = p_request_id;
    
    IF v_status IS NULL THEN
        RETURN false;
    END IF;
    
    IF v_status != 'pending' THEN
        RETURN false;
    END IF;
    
    -- Update the request
    UPDATE approval_requests
    SET 
        status = 'cancelled',
        updated_at = now()
    WHERE id = p_request_id;
    
    -- Log the cancellation
    INSERT INTO approval_audit_log (
        approval_request_id,
        action,
        performed_by,
        notes,
        previous_status,
        new_status
    )
    VALUES (
        p_request_id,
        'cancelled',
        p_cancelled_by,
        NULL,
        'pending',
        'cancelled'
    );
    
    RETURN true;
END;
$$;

-- RLS policies for approval_requests
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY approval_requests_read_own ON approval_requests
    FOR SELECT USING (
        auth.uid() = requested_by OR
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
        )
    );

CREATE POLICY approval_requests_insert_own ON approval_requests
    FOR INSERT WITH CHECK (auth.uid() = requested_by);

CREATE POLICY approval_requests_update_admin ON approval_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
        )
    );

CREATE POLICY approval_requests_delete_own ON approval_requests
    FOR DELETE USING (
        auth.uid() = requested_by OR
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
        )
    );

-- RLS policies for approval_audit_log
ALTER TABLE approval_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY approval_audit_log_read_all ON approval_audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM approval_requests ar
            WHERE ar.id = approval_audit_log.approval_request_id
            AND (ar.requested_by = auth.uid() OR
                 EXISTS (
                     SELECT 1 FROM profiles p
                     WHERE p.id = auth.uid()
                     AND p.role IN ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
                 ))
        )
    );

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION create_approval_request(text, text, uuid, uuid, text, text, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_request(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_request(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_request(uuid, uuid) TO authenticated;
