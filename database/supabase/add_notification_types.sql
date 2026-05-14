-- Add new notification types to the database constraint
-- This adds password_reset and event notification types

-- Drop existing constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add updated constraint with new types
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (
    type IN (
        'schedule_change', 
        'sharing_request', 
        'approval', 
        'system', 
        'reminder', 
        'conflict_alert', 
        'announcement',
        'password_reset',
        'event'
    )
);

-- Verification
SELECT 'Notification types updated successfully' as status;
