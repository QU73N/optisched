-- ============================================
-- Historical Analytics Tracking
-- Tracks system metrics over time for accurate chart data
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ANALYTICS HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.analytics_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_type TEXT NOT NULL CHECK (period_type IN ('hourly', 'daily', 'weekly', 'monthly', 'yearly')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Core metrics
  schedules_count INTEGER NOT NULL DEFAULT 0,
  requests_total INTEGER NOT NULL DEFAULT 0,
  requests_approved INTEGER NOT NULL DEFAULT 0,
  requests_rejected INTEGER NOT NULL DEFAULT 0,
  requests_pending INTEGER NOT NULL DEFAULT 0,
  conflicts_count INTEGER NOT NULL DEFAULT 0,
  
  -- User metrics
  users_count INTEGER NOT NULL DEFAULT 0,
  teachers_count INTEGER NOT NULL DEFAULT 0,
  students_count INTEGER NOT NULL DEFAULT 0,
  
  -- Resource metrics
  rooms_count INTEGER NOT NULL DEFAULT 0,
  sections_count INTEGER NOT NULL DEFAULT 0,
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure no duplicate entries for the same period
  UNIQUE(period_type, period_start, period_end)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Index for querying by period type and date range
CREATE INDEX IF NOT EXISTS idx_analytics_history_period 
  ON public.analytics_history(period_type, period_start, period_end);

-- Index for querying by recorded date
CREATE INDEX IF NOT EXISTS idx_analytics_history_recorded_at 
  ON public.analytics_history(recorded_at DESC);

-- Index for querying specific date ranges
CREATE INDEX IF NOT EXISTS idx_analytics_history_date_range 
  ON public.analytics_history(period_start, period_end);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE public.analytics_history ENABLE ROW LEVEL SECURITY;

-- Admins can read all analytics
CREATE POLICY "Admins can read all analytics"
  ON public.analytics_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Only service role or admins can insert analytics
CREATE POLICY "Service role and admins can insert analytics"
  ON public.analytics_history FOR INSERT
  WITH CHECK (
    auth.uid() IS NULL OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- HELPER FUNCTIONS FOR RECORDING ANALYTICS
-- ============================================

-- Function to record hourly analytics
CREATE OR REPLACE FUNCTION record_hourly_analytics(
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_schedules_count INTEGER DEFAULT 0,
  p_requests_total INTEGER DEFAULT 0,
  p_requests_approved INTEGER DEFAULT 0,
  p_requests_rejected INTEGER DEFAULT 0,
  p_requests_pending INTEGER DEFAULT 0,
  p_conflicts_count INTEGER DEFAULT 0,
  p_users_count INTEGER DEFAULT 0,
  p_teachers_count INTEGER DEFAULT 0,
  p_students_count INTEGER DEFAULT 0,
  p_rooms_count INTEGER DEFAULT 0,
  p_sections_count INTEGER DEFAULT 0,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.analytics_history (
    period_type,
    period_start,
    period_end,
    schedules_count,
    requests_total,
    requests_approved,
    requests_rejected,
    requests_pending,
    conflicts_count,
    users_count,
    teachers_count,
    students_count,
    rooms_count,
    sections_count,
    metadata
  ) VALUES (
    'hourly',
    p_period_start,
    p_period_end,
    p_schedules_count,
    p_requests_total,
    p_requests_approved,
    p_requests_rejected,
    p_requests_pending,
    p_conflicts_count,
    p_users_count,
    p_teachers_count,
    p_students_count,
    p_rooms_count,
    p_sections_count,
    p_metadata
  )
  ON CONFLICT (period_type, period_start, period_end)
  DO UPDATE SET
    schedules_count = EXCLUDED.schedules_count,
    requests_total = EXCLUDED.requests_total,
    requests_approved = EXCLUDED.requests_approved,
    requests_rejected = EXCLUDED.requests_rejected,
    requests_pending = EXCLUDED.requests_pending,
    conflicts_count = EXCLUDED.conflicts_count,
    users_count = EXCLUDED.users_count,
    teachers_count = EXCLUDED.teachers_count,
    students_count = EXCLUDED.students_count,
    rooms_count = EXCLUDED.rooms_count,
    sections_count = EXCLUDED.sections_count,
    metadata = EXCLUDED.metadata,
    recorded_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to record daily analytics
CREATE OR REPLACE FUNCTION record_daily_analytics(
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_schedules_count INTEGER DEFAULT 0,
  p_requests_total INTEGER DEFAULT 0,
  p_requests_approved INTEGER DEFAULT 0,
  p_requests_rejected INTEGER DEFAULT 0,
  p_requests_pending INTEGER DEFAULT 0,
  p_conflicts_count INTEGER DEFAULT 0,
  p_users_count INTEGER DEFAULT 0,
  p_teachers_count INTEGER DEFAULT 0,
  p_students_count INTEGER DEFAULT 0,
  p_rooms_count INTEGER DEFAULT 0,
  p_sections_count INTEGER DEFAULT 0,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.analytics_history (
    period_type,
    period_start,
    period_end,
    schedules_count,
    requests_total,
    requests_approved,
    requests_rejected,
    requests_pending,
    conflicts_count,
    users_count,
    teachers_count,
    students_count,
    rooms_count,
    sections_count,
    metadata
  ) VALUES (
    'daily',
    p_period_start,
    p_period_end,
    p_schedules_count,
    p_requests_total,
    p_requests_approved,
    p_requests_rejected,
    p_requests_pending,
    p_conflicts_count,
    p_users_count,
    p_teachers_count,
    p_students_count,
    p_rooms_count,
    p_sections_count,
    p_metadata
  )
  ON CONFLICT (period_type, period_start, period_end)
  DO UPDATE SET
    schedules_count = EXCLUDED.schedules_count,
    requests_total = EXCLUDED.requests_total,
    requests_approved = EXCLUDED.requests_approved,
    requests_rejected = EXCLUDED.requests_rejected,
    requests_pending = EXCLUDED.requests_pending,
    conflicts_count = EXCLUDED.conflicts_count,
    users_count = EXCLUDED.users_count,
    teachers_count = EXCLUDED.teachers_count,
    students_count = EXCLUDED.students_count,
    rooms_count = EXCLUDED.rooms_count,
    sections_count = EXCLUDED.sections_count,
    metadata = EXCLUDED.metadata,
    recorded_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View for daily analytics summary
CREATE OR REPLACE VIEW daily_analytics_summary AS
SELECT
  period_start::date as date,
  SUM(schedules_count) as total_schedules,
  SUM(requests_total) as total_requests,
  SUM(requests_approved) as total_approved,
  SUM(requests_rejected) as total_rejected,
  SUM(requests_pending) as total_pending,
  SUM(conflicts_count) as total_conflicts,
  AVG(users_count) as avg_users,
  AVG(teachers_count) as avg_teachers,
  AVG(students_count) as avg_students
FROM public.analytics_history
WHERE period_type = 'daily'
GROUP BY period_start::date
ORDER BY date DESC;

-- View for monthly analytics summary
CREATE OR REPLACE VIEW monthly_analytics_summary AS
SELECT
  DATE_TRUNC('month', period_start) as month,
  SUM(schedules_count) as total_schedules,
  SUM(requests_total) as total_requests,
  SUM(requests_approved) as total_approved,
  SUM(requests_rejected) as total_rejected,
  SUM(requests_pending) as total_pending,
  SUM(conflicts_count) as total_conflicts,
  AVG(users_count) as avg_users,
  AVG(teachers_count) as avg_teachers,
  AVG(students_count) as avg_students
FROM public.analytics_history
WHERE period_type = 'monthly'
GROUP BY DATE_TRUNC('month', period_start)
ORDER BY month DESC;
