-- Migration: Add user_preferences table for per-user UI settings
-- This migration creates a table to store user-specific settings like theme, time format, and animation preferences
-- Settings are stored per user (linked to profiles.id) instead of in localStorage

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    theme text DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
    time_format text DEFAULT '24h' CHECK (time_format IN ('12h', '24h')),
    landing_animations boolean DEFAULT true,
    dashboard_animations boolean DEFAULT false,
    email_notifications boolean DEFAULT true,
    schedule_notifications boolean DEFAULT true,
    announcement_notifications boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (for safety in case of re-run)
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;

-- Create RLS policies
CREATE POLICY "Users can view own preferences" ON public.user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON public.user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON public.user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE public.user_preferences IS 'Stores user-specific UI settings like theme, time format, and animation preferences';
