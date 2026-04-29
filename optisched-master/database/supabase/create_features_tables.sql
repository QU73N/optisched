-- Combined: Announcements + Schedule Change Requests (safe to re-run)

-- ============ ANNOUNCEMENTS ============
CREATE TABLE IF NOT EXISTS announcements (
    id uuid DEFAULT gen_random_uuid () PRIMARY KEY,
    title text NOT NULL,
    content text NOT NULL,
    author_id uuid REFERENCES auth.users (id),
    author_name text NOT NULL DEFAULT '',
    priority text NOT NULL DEFAULT 'normal' CHECK (
        priority IN (
            'normal',
            'important',
            'urgent'
        )
    ),
    created_at timestamptz DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read announcements" ON announcements;

DROP POLICY IF EXISTS "Admins can create announcements" ON announcements;

CREATE POLICY "Anyone can read announcements" ON announcements FOR
SELECT USING (true);

CREATE POLICY "Admins can create announcements" ON announcements FOR
INSERT
WITH
    CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE
                id = auth.uid ()
                AND role = 'admin'
        )
    );

-- ============ SCHEDULE CHANGE REQUESTS ============
CREATE TABLE IF NOT EXISTS schedule_change_requests (
    id uuid DEFAULT gen_random_uuid () PRIMARY KEY,
    teacher_id uuid REFERENCES auth.users (id),
    teacher_name text NOT NULL DEFAULT '',
    schedule_id uuid,
    request_type text NOT NULL DEFAULT 'reschedule' CHECK (
        request_type IN (
            'reschedule',
            'cancel',
            'swap'
        )
    ),
    reason text NOT NULL DEFAULT '',
    proposed_day text,
    proposed_time text,
    status text NOT NULL DEFAULT 'pending' CHECK (
        status IN (
            'pending',
            'approved',
            'rejected'
        )
    ),
    admin_notes text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE schedule_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers see own requests" ON schedule_change_requests;

DROP POLICY IF EXISTS "Teachers can create requests" ON schedule_change_requests;

DROP POLICY IF EXISTS "Admins can update requests" ON schedule_change_requests;

CREATE POLICY "Teachers see own requests" ON schedule_change_requests FOR
SELECT USING (
        teacher_id = auth.uid ()
        OR EXISTS (
            SELECT 1
            FROM profiles
            WHERE
                id = auth.uid ()
                AND role = 'admin'
        )
    );

CREATE POLICY "Teachers can create requests" ON schedule_change_requests FOR
INSERT
WITH
    CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE
                id = auth.uid ()
                AND role IN ('teacher', 'admin')
        )
    );

CREATE POLICY "Admins can update requests" ON schedule_change_requests FOR
UPDATE USING (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE
            id = auth.uid ()
            AND role = 'admin'
    )
);