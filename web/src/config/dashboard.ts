// Dashboard configuration constants

export const DASHBOARD_CONFIG = {
    // Query limits for database fetches
    QUERY_LIMITS: {
        REQUESTS: 20,
        ANNOUNCEMENTS: 10,
        EVENTS: 10,
        MESSAGES: 5,
        ROOM_LOAD: 8,
    },

    // Display limits for UI rendering
    DISPLAY_LIMITS: {
        RECENT_ITEMS: 4,
        RESET_REQUESTS: 3,
        MESSAGE_TRUNCATION: 80,
        REQUEST_ITEMS: 5,
    },

    // Time intervals in milliseconds
    TIME: {
        TIMER_INTERVAL_MS: 30000, // 30 seconds
        DAYS_7_MS: 7 * 24 * 60 * 60 * 1000,
        DAYS_14_MS: 14 * 24 * 60 * 60 * 1000,
        DAYS_30_MS: 30 * 24 * 60 * 60 * 1000,
    },

    // Chart configuration
    CHART: {
        CONFLICTS_TREND_DAYS: 14,
        SCHEDULE_DAYS: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        DAY_ABBREVIATION_LENGTH: 3,
    },
} as const;
