/**
 * Cache duration policies per data type.
 * All durations in milliseconds.
 */
export const CACHE_DURATIONS = {
  /** User profile - long-lived, rarely changes */
  USER_PROFILE: 30 * 60 * 1000, // 30 min
  /** User preferences */
  USER_PREFERENCES: 15 * 60 * 1000, // 15 min
  /** Schedule data - medium */
  SCHEDULE: 5 * 60 * 1000, // 5 min
  /** Schedule versions list */
  SCHEDULE_VERSIONS: 3 * 60 * 1000, // 3 min
  /** Notifications - short */
  NOTIFICATIONS: 60 * 1000, // 1 min
  /** Unread notification count */
  UNREAD_COUNT: 30 * 1000, // 30 sec
  /** Live attendance - very short */
  ATTENDANCE: 15 * 1000, // 15 sec
  /** Faculty/teacher list */
  FACULTY: 10 * 60 * 1000, // 10 min
  /** Rooms list */
  ROOMS: 10 * 60 * 1000, // 10 min
  /** Subjects list */
  SUBJECTS: 10 * 60 * 1000, // 10 min
  /** Sections list */
  SECTIONS: 10 * 60 * 1000, // 10 min
  /** System rules */
  SYSTEM_RULES: 15 * 60 * 1000, // 15 min
  /** Announcements */
  ANNOUNCEMENTS: 3 * 60 * 1000, // 3 min
  /** Audit logs */
  AUDIT_LOGS: 2 * 60 * 1000, // 2 min
  /** Analytics data */
  ANALYTICS: 5 * 60 * 1000, // 5 min
  /** Conflicts data */
  CONFLICTS: 2 * 60 * 1000, // 2 min
  /** Dashboard stats */
  DASHBOARD: 60 * 1000, // 1 min
  /** Static/reference data */
  STATIC: 60 * 60 * 1000, // 1 hour
} as const;

export type CacheKey = keyof typeof CACHE_DURATIONS;

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

export interface CacheStats {
  memorySize: number;
  indexedDBSize: number;
  hitRate: number;
  totalGets: number;
  totalHits: number;
}
