-- Add scan_results table to track conflict scan history
-- This allows the dashboard to show scan results over time
-- and provides a persistent record of when scans were run

CREATE TABLE IF NOT EXISTS public.scan_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scanned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    total_conflicts INTEGER NOT NULL DEFAULT 0,
    hard_violations_count INTEGER NOT NULL DEFAULT 0,
    soft_violations_count INTEGER NOT NULL DEFAULT 0,
    soft_score INTEGER NOT NULL DEFAULT 0,
    scan_duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT scan_results_total_conflicts_check CHECK (total_conflicts >= 0),
    CONSTRAINT scan_results_hard_violations_check CHECK (hard_violations_count >= 0),
    CONSTRAINT scan_results_soft_violations_check CHECK (soft_violations_count >= 0),
    CONSTRAINT scan_results_soft_score_check CHECK (soft_score >= 0)
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_scan_results_scanned_at ON public.scan_results(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_results_scanned_by ON public.scan_results(scanned_by);

-- Enable RLS
ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can view scan results (read-only for transparency)
CREATE POLICY "Scan results are viewable by everyone"
    ON public.scan_results FOR SELECT
    USING (true);

-- Authenticated users can insert scan results
CREATE POLICY "Authenticated users can insert scan results"
    ON public.scan_results FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Add comment
COMMENT ON TABLE public.scan_results IS 'Tracks conflict scan history for dashboard analytics';
COMMENT ON COLUMN public.scan_results.scanned_at IS 'When the scan was performed';
COMMENT ON COLUMN public.scan_results.scanned_by IS 'User who initiated the scan';
COMMENT ON COLUMN public.scan_results.total_conflicts IS 'Total conflicts detected';
COMMENT ON COLUMN public.scan_results.hard_violations_count IS 'Number of hard constraint violations';
COMMENT ON COLUMN public.scan_results.soft_violations_count IS 'Number of soft constraint violations';
COMMENT ON COLUMN public.scan_results.soft_score IS 'Overall soft constraint score (lower is better)';
COMMENT ON COLUMN public.scan_results.scan_duration_ms IS 'How long the scan took in milliseconds';
