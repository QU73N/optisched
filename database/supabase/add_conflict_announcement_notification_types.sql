-- Add conflict_alert and announcement notification types
-- This extends the notification system to support conflict alerts and system announcements

-- Step 1: Drop the existing check constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Step 2: Add new check constraint with expanded types
ALTER TABLE public.notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type = ANY (ARRAY[
    'schedule_change'::text, 
    'sharing_request'::text, 
    'approval'::text, 
    'system'::text, 
    'reminder'::text,
    'conflict_alert'::text,
    'announcement'::text
]));

-- Verification
SELECT 'Added conflict_alert and announcement notification types' as status;
SELECT unnest(ARRAY[
    'schedule_change', 
    'sharing_request', 
    'approval', 
    'system', 
    'reminder',
    'conflict_alert',
    'announcement'
]) as allowed_types;
