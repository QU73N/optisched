/**
 * Background sync system.
 * Handles offline recovery, silent revalidation, and periodic refresh.
 */
import { cacheManager } from '../cache/CacheManager';
import { networkMonitor } from './NetworkMonitor';

type SyncTask = {
  key: string;
  fetcher: () => Promise<unknown>;
  ttl: number;
  interval: number; // ms between syncs
  lastSync: number;
};

class BackgroundSync {
  private tasks = new Map<string, SyncTask>();
  private intervals = new Map<string, ReturnType<typeof setInterval>>();
  private unsubscribeNetwork: (() => void) | null = null;

  constructor() {
    this.setupNetworkRecovery();
  }

  /**
   * Register a periodic background sync task.
   */
  register(key: string, fetcher: () => Promise<unknown>, ttl: number, interval: number): void {
    if (this.tasks.has(key)) return;

    this.tasks.set(key, {
      key,
      fetcher,
      ttl,
      interval,
      lastSync: 0,
    });

    this.startInterval(key);
  }

  /**
   * Unregister a sync task.
   */
  unregister(key: string): void {
    const interval = this.intervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(key);
    }
    this.tasks.delete(key);
  }

  /**
   * Force sync all registered tasks now.
   */
  async syncAll(): Promise<void> {
    const promises = [...this.tasks.values()].map((task) => this.syncOne(task));
    await Promise.allSettled(promises);
  }

  private async syncOne(task: SyncTask): Promise<void> {
    try {
      const data = await task.fetcher();
      await cacheManager.set(task.key, data, task.ttl);
      task.lastSync = Date.now();
    } catch {
      // Silent background failure
    }
  }

  private startInterval(key: string): void {
    const task = this.tasks.get(key);
    if (!task) return;

    const id = setInterval(() => {
      if (networkMonitor.canPrefetch()) {
        this.syncOne(task);
      }
    }, task.interval);

    this.intervals.set(key, id);
  }

  private setupNetworkRecovery(): void {
    this.unsubscribeNetwork = networkMonitor.subscribe((quality) => {
      if (quality === 'fast' || quality === 'medium') {
        // Network recovered - sync all
        this.syncAll();
      }
    });
  }

  destroy(): void {
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();
    this.tasks.clear();
    if (this.unsubscribeNetwork) {
      this.unsubscribeNetwork();
    }
  }
}

export const backgroundSync = new BackgroundSync();
