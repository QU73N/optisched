import { supabase, supabaseAdmin } from '../config/supabase';

// ============================================
// Analytics History Types
// ============================================

export interface AnalyticsRecord {
  id?: string;
  recorded_at: string;
  period_type: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  period_start: string;
  period_end: string;
  schedules_count: number;
  requests_total: number;
  requests_approved: number;
  requests_rejected: number;
  requests_pending: number;
  conflicts_count: number;
  users_count: number;
  teachers_count: number;
  students_count: number;
  rooms_count: number;
  sections_count: number;
  metadata?: Record<string, unknown>;
}

export interface AnalyticsMetrics {
  schedules_count: number;
  requests_total: number;
  requests_approved: number;
  requests_rejected: number;
  requests_pending: number;
  conflicts_count: number;
  users_count: number;
  teachers_count: number;
  students_count: number;
  rooms_count: number;
  sections_count: number;
}

// ============================================
// Analytics Recording Service
// ============================================

class AnalyticsService {
  /**
   * Record hourly analytics data
   */
  async recordHourly(
    periodStart: Date,
    periodEnd: Date,
    metrics: AnalyticsMetrics,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('record_hourly_analytics', {
        p_period_start: periodStart.toISOString(),
        p_period_end: periodEnd.toISOString(),
        p_schedules_count: metrics.schedules_count,
        p_requests_total: metrics.requests_total,
        p_requests_approved: metrics.requests_approved,
        p_requests_rejected: metrics.requests_rejected,
        p_requests_pending: metrics.requests_pending,
        p_conflicts_count: metrics.conflicts_count,
        p_users_count: metrics.users_count,
        p_teachers_count: metrics.teachers_count,
        p_students_count: metrics.students_count,
        p_rooms_count: metrics.rooms_count,
        p_sections_count: metrics.sections_count,
        p_metadata: metadata || {},
      });

      if (error) {
        console.error('Error recording hourly analytics:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in recordHourly:', error);
      throw error;
    }
  }

  /**
   * Record daily analytics data
   */
  async recordDaily(
    periodStart: Date,
    periodEnd: Date,
    metrics: AnalyticsMetrics,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('record_daily_analytics', {
        p_period_start: periodStart.toISOString(),
        p_period_end: periodEnd.toISOString(),
        p_schedules_count: metrics.schedules_count,
        p_requests_total: metrics.requests_total,
        p_requests_approved: metrics.requests_approved,
        p_requests_rejected: metrics.requests_rejected,
        p_requests_pending: metrics.requests_pending,
        p_conflicts_count: metrics.conflicts_count,
        p_users_count: metrics.users_count,
        p_teachers_count: metrics.teachers_count,
        p_students_count: metrics.students_count,
        p_rooms_count: metrics.rooms_count,
        p_sections_count: metrics.sections_count,
        p_metadata: metadata || {},
      });

      if (error) {
        console.error('Error recording daily analytics:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in recordDaily:', error);
      throw error;
    }
  }

  /**
   * Fetch analytics data for a specific time range
   */
  async fetchAnalytics(
    periodType: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly',
    startDate: Date,
    endDate: Date
  ): Promise<AnalyticsRecord[]> {
    try {
      const { data, error } = await supabase
        .from('analytics_history')
        .select('*')
        .eq('period_type', periodType)
        .gte('period_start', startDate.toISOString())
        .lte('period_end', endDate.toISOString())
        .order('period_start', { ascending: true });

      if (error) {
        console.error('Error fetching analytics:', error);
        throw error;
      }

      return (data || []) as AnalyticsRecord[];
    } catch (error) {
      console.error('Error in fetchAnalytics:', error);
      throw error;
    }
  }

  /**
   * Get current metrics from database
   */
  async getCurrentMetrics(): Promise<AnalyticsMetrics> {
    try {
      // Get schedules count
      const { count: schedulesCount } = await supabase
        .from('schedules')
        .select('*', { count: 'exact', head: true });

      // Get requests counts
      const { data: requests } = await supabase
        .from('schedule_change_requests')
        .select('status');

      const requestsTotal = requests?.length || 0;
      const requestsApproved = requests?.filter(r => r.status === 'approved').length || 0;
      const requestsRejected = requests?.filter(r => r.status === 'rejected').length || 0;
      const requestsPending = requests?.filter(r => r.status === 'pending').length || 0;

      // Get conflicts count
      const { count: conflictsCount } = await supabase
        .from('conflicts')
        .select('*', { count: 'exact', head: true });

      // Get users counts
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      const { count: teachersCount } = await supabase
        .from('teachers')
        .select('*', { count: 'exact', head: true });

      const { count: studentsCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student');

      // Get resources counts
      const { count: roomsCount } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true });

      const { count: sectionsCount } = await supabase
        .from('sections')
        .select('*', { count: 'exact', head: true });

      return {
        schedules_count: schedulesCount || 0,
        requests_total: requestsTotal,
        requests_approved: requestsApproved,
        requests_rejected: requestsRejected,
        requests_pending: requestsPending,
        conflicts_count: conflictsCount || 0,
        users_count: usersCount || 0,
        teachers_count: teachersCount || 0,
        students_count: studentsCount || 0,
        rooms_count: roomsCount || 0,
        sections_count: sectionsCount || 0,
      };
    } catch (error) {
      console.error('Error getting current metrics:', error);
      // Return default values on error
      return {
        schedules_count: 0,
        requests_total: 0,
        requests_approved: 0,
        requests_rejected: 0,
        requests_pending: 0,
        conflicts_count: 0,
        users_count: 0,
        teachers_count: 0,
        students_count: 0,
        rooms_count: 0,
        sections_count: 0,
      };
    }
  }

  /**
   * Record analytics for the current hour
   */
  async recordCurrentHour(): Promise<void> {
    const now = new Date();
    const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0);
    const hourEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0);

    const metrics = await this.getCurrentMetrics();
    await this.recordHourly(hourStart, hourEnd, metrics, { recorded_at: now.toISOString() });
  }

  /**
   * Record analytics for the current day
   */
  async recordCurrentDay(): Promise<void> {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);

    const metrics = await this.getCurrentMetrics();
    await this.recordDaily(dayStart, dayEnd, metrics, { recorded_at: now.toISOString() });
  }

  /**
   * Initialize analytics recording for the current day
   * This should be called when the system starts up
   */
  async initializeDailyRecording(): Promise<void> {
    try {
      // Check if today's analytics already exist
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);

      const { data, error } = await supabase
        .from('analytics_history')
        .select('id')
        .eq('period_type', 'daily')
        .eq('period_start', dayStart.toISOString())
        .eq('period_end', dayEnd.toISOString())
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking existing analytics:', error);
        return;
      }

      // If no record exists for today, create one
      if (!data) {
        await this.recordCurrentDay();
        console.log('Initialized daily analytics for', dayStart.toDateString());
      }
    } catch (error) {
      console.error('Error initializing daily recording:', error);
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();

// ============================================
// Scheduled Recording Functions
// ============================================

/**
 * Start hourly analytics recording
 * This should be called from a cron job or scheduled task
 */
export async function startHourlyRecording(): Promise<void> {
  try {
    await analyticsService.recordCurrentHour();
    console.log('Hourly analytics recorded at', new Date().toISOString());
  } catch (error) {
    console.error('Error in hourly recording:', error);
  }
}

/**
 * Start daily analytics recording
 * This should be called from a cron job or scheduled task
 */
export async function startDailyRecording(): Promise<void> {
  try {
    await analyticsService.recordCurrentDay();
    console.log('Daily analytics recorded at', new Date().toISOString());
  } catch (error) {
    console.error('Error in daily recording:', error);
  }
}
