-- Announcements table (safe to re-run)
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

-- Drop existing policies first so this script is re-runnable
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