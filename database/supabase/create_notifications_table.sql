-- Create notifications table
-- This table stores user notifications for various system events

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (
        type IN ('schedule_change', 'sharing_request', 'approval', 'system', 'reminder', 'conflict_alert', 'announcement')
    ),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
    ON public.notifications FOR DELETE
    USING (auth.uid() = user_id);

-- Service role can insert notifications (for system-generated notifications)
CREATE POLICY "Service role can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- Service role can update notifications (for marking as read via RPC)
CREATE POLICY "Service role can update notifications"
    ON public.notifications FOR UPDATE
    USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;

-- Verification
SELECT 'Notifications table created successfully' as status;
