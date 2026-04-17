# Historical Analytics Tracking System

## Overview

This implementation adds a comprehensive historical analytics tracking system to OptiSched, enabling accurate "All Time" and "This Year" statistics for dashboard charts.

## Components

### 1. Database Schema (`supabase/create_analytics_history.sql`)

**Table: `analytics_history`**
- Tracks system metrics over time with different granularities (hourly, daily, weekly, monthly, yearly)
- Stores counts for schedules, requests, conflicts, users, teachers, students, rooms, and sections
- Includes metadata for additional context
- Row Level Security (RLS) policies for admin-only access

**Helper Functions:**
- `record_hourly_analytics()` - Records hourly metrics
- `record_daily_analytics()` - Records daily metrics

**Views:**
- `daily_analytics_summary` - Aggregated daily statistics
- `monthly_analytics_summary` - Aggregated monthly statistics

### 2. Analytics Service (`src/services/analyticsService.ts`)

**Class: `AnalyticsService`**
- `recordHourly()` - Record hourly analytics data
- `recordDaily()` - Record daily analytics data
- `fetchAnalytics()` - Fetch analytics for a time range
- `getCurrentMetrics()` - Get current system metrics from database
- `recordCurrentHour()` - Record analytics for current hour
- `recordCurrentDay()` - Record analytics for current day
- `initializeDailyRecording()` - Initialize daily recording on startup

**Scheduled Functions:**
- `startHourlyRecording()` - Called by cron job for hourly recording
- `startDailyRecording()` - Called by cron job for daily recording

## Installation Steps

### 1. Run Database Migration

Execute the SQL file in your Supabase SQL editor:

```sql
-- Run the entire contents of supabase/create_analytics_history.sql
```

### 2. Initialize Analytics Recording

Add this to your application startup (e.g., in `App.tsx` or `main.tsx`):

```typescript
import { analyticsService } from './services/analyticsService';

// Initialize daily analytics on app startup
analyticsService.initializeDailyRecording();
```

### 3. Set Up Scheduled Recording

For production, set up cron jobs to record analytics periodically:

**Hourly Recording (every hour):**
```bash
# Example: Using node-cron in a separate worker process
cron.schedule('0 * * * *', async () => {
  await startHourlyRecording();
});
```

**Daily Recording (every day at midnight):**
```bash
# Example: Using node-cron
cron.schedule('0 0 * * *', async () => {
  await startDailyRecording();
});
```

### 4. Update Dashboard (Optional)

The AdminDashboard already has the analytics service imported. To use real historical data instead of mock data, update the chart filtering logic to call `analyticsService.fetchAnalytics()`.

## Usage Examples

### Recording Analytics Manually

```typescript
import { analyticsService } from './services/analyticsService';

// Record current day's analytics
await analyticsService.recordCurrentDay();

// Record current hour's analytics
await analyticsService.recordCurrentHour();
```

### Fetching Historical Data

```typescript
import { analyticsService } from './services/analyticsService';

// Fetch daily analytics for the last 30 days
const startDate = new Date();
startDate.setDate(startDate.getDate() - 30);
const endDate = new Date();

const dailyData = await analyticsService.fetchAnalytics(
  'daily',
  startDate,
  endDate
);

console.log(dailyData);
// Output: Array of AnalyticsRecord objects
```

### Getting Current Metrics

```typescript
import { analyticsService } from './services/analyticsService';

const metrics = await analyticsService.getCurrentMetrics();

console.log(metrics);
// Output: {
//   schedules_count: 150,
//   requests_total: 45,
//   requests_approved: 30,
//   requests_rejected: 10,
//   requests_pending: 5,
//   conflicts_count: 8,
//   users_count: 200,
//   teachers_count: 25,
//   students_count: 175,
//   rooms_count: 15,
//   sections_count: 40
// }
```

## Data Migration (Optional)

If you have existing data and want to backfill historical analytics, you can create a migration script:

```sql
-- Example: Backfill daily analytics for the last 30 days
-- This would need to be customized based on your actual data

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
)
SELECT
  'daily',
  date_trunc('day', generated_date)::timestamptz,
  date_trunc('day', generated_date + interval '1 day')::timestamptz,
  -- Add your actual aggregation queries here
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  '{}'::jsonb
FROM generate_series(
  NOW() - interval '30 days',
  NOW() - interval '1 day',
  interval '1 day'
) AS generated_date
ON CONFLICT (period_type, period_start, period_end) DO NOTHING;
```

## Benefits

1. **Accurate Historical Data**: Charts now show real historical statistics instead of mock data
2. **Flexible Time Ranges**: Support for hourly, daily, weekly, monthly, and yearly analytics
3. **Performance Optimized**: Indexed queries for fast data retrieval
4. **Secure**: Row Level Security ensures only admins can access analytics data
5. **Extensible**: Metadata field allows storing additional context

## Notes

- The analytics service uses Supabase RPC functions for recording data, which ensures atomic operations
- Historical data is only as accurate as the recording schedule - set up cron jobs for production
- The system gracefully handles errors and returns default values if queries fail
- Consider implementing data retention policies to prevent unbounded table growth
