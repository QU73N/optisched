-- Add AI Chat Limit tracking columns to the profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_chat_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_chat_reset_date date DEFAULT CURRENT_DATE;

-- Add comment for context
COMMENT ON COLUMN public.profiles.ai_chat_count IS 'Tracks how many AI messages the user has sent today';
COMMENT ON COLUMN public.profiles.ai_chat_reset_date IS 'The date the chat count was last reset';
