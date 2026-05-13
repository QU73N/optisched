/**
 * Route-based intelligent prefetch manager.
 * Preloads likely-needed data and route chunks based on current context.
 */
import { networkMonitor } from './NetworkMonitor';
import { cacheManager } from '../cache/CacheManager';
import { CACHE_DURATIONS } from '../cache/cacheConfig';

type PrefetchRule = {
  /** Current route pattern to match */
  from: string;
  /** User roles this applies to */
  roles?: string[];
  /** Routes/chunks to prefetch */
  prefetchRoutes: string[];
  /** Data keys to prefetch */
  prefetchData: Array<{ key: string; fetcher: () => Promise<unknown>; ttl: number }>;
};

class PrefetchManager {
  private rules: PrefetchRule[] = [];
  private prefetchedRoutes = new Set<string>();
  private idleCallback: number | null = null;
  private idleQueue: Array<() => void> = [];

  constructor() {
    this.registerDefaultRules();
    this.scheduleIdleProcessing();
  }

  private registerDefaultRules(): void {
    this.rules = [
      {
        from: '/admin',
        roles: ['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'],
        prefetchRoutes: ['/admin/schedules/versions', '/admin/conflicts', '/admin/approvals'],
        prefetchData: [],
      },
      {
        from: '/admin/schedules',
        roles: ['admin', 'power_admin', 'schedule_admin', 'schedule_manager'],
        prefetchRoutes: ['/admin/conflicts', '/admin/generate'],
        prefetchData: [],
      },
      {
        from: '/teacher',
        roles: ['teacher'],
        prefetchRoutes: ['/teacher/schedule', '/teacher/workload'],
        prefetchData: [],
      },
      {
        from: '/teacher/schedule',
        roles: ['teacher'],
        prefetchRoutes: ['/teacher/preferences', '/teacher/sections'],
        prefetchData: [],
      },
      {
        from: '/student',
        roles: ['student'],
        prefetchRoutes: ['/student/schedule', '/student/upcoming'],
        prefetchData: [],
      },
      {
        from: '/student/schedule',
        roles: ['student'],
        prefetchRoutes: ['/student/upcoming', '/student/section'],
        prefetchData: [],
      },
    ];
  }

  /**
   * Register a custom prefetch rule.
   */
  registerRule(rule: PrefetchRule): void {
    this.rules.push(rule);
  }

  /**
   * Trigger prefetching based on current route and user role.
   */
  trigger(route: string, role: string | null): void {
    if (!networkMonitor.canPrefetch()) return;

    const matchingRules = this.rules.filter((rule) => {
      const routeMatch = route.startsWith(rule.from) || route === rule.from;
      const roleMatch = !rule.roles || (role && rule.roles.includes(role));
      return routeMatch && roleMatch;
    });

    for (const rule of matchingRules) {
      // Prefetch route chunks
      for (const prefetchRoute of rule.prefetchRoutes) {
        if (!this.prefetchedRoutes.has(prefetchRoute)) {
          this.prefetchedRoutes.add(prefetchRoute);
          this.queueIdle(() => this.prefetchRouteChunk(prefetchRoute));
        }
      }

      // Prefetch data
      for (const { key, fetcher, ttl } of rule.prefetchData) {
        this.queueIdle(() => cacheManager.preload(key, fetcher, ttl));
      }
    }
  }

  /**
   * Prefetch a specific route's component chunk.
   */
  private prefetchRouteChunk(route: string): void {
    // Use link prefetch for route chunks
    if (typeof document !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'script';
      // Vite code-split chunks are loaded via the router
      // This hints the browser to download them early
      link.href = route;
      document.head.appendChild(link);
    }
  }

  /**
   * Prefetch a specific data key manually.
   */
  async prefetchData(key: string, fetcher: () => Promise<unknown>, ttl: number = CACHE_DURATIONS.SCHEDULE): Promise<void> {
    if (!networkMonitor.canPrefetch()) return;
    await cacheManager.preload(key, fetcher, ttl);
  }

  /**
   * Queue work for idle time.
   */
  private queueIdle(fn: () => void): void {
    this.idleQueue.push(fn);
  }

  private scheduleIdleProcessing(): void {
    const process = () => {
      if (this.idleQueue.length === 0) {
        this.idleCallback = requestIdleCallback(process, { timeout: 2000 });
        return;
      }

      const batch = this.idleQueue.splice(0, 3);
      for (const fn of batch) {
        try { fn(); } catch { /* silent */ }
      }

      this.idleCallback = requestIdleCallback(process, { timeout: 2000 });
    };

    this.idleCallback = requestIdleCallback(process, { timeout: 2000 });
  }

  destroy(): void {
    if (this.idleCallback !== null) {
      cancelIdleCallback(this.idleCallback);
    }
    this.idleQueue = [];
  }
}

export const prefetchManager = new PrefetchManager();
