/**
 * Centralized Cache Manager with memory + IndexedDB layers.
 * Provides stale-while-revalidate, background refresh, and TTL-based expiration.
 */
import { type CacheEntry, type CacheStats } from './cacheConfig';

const DB_NAME = 'optisched-cache';
const DB_VERSION = 1;
const STORE_NAME = 'cache-entries';
const MAX_MEMORY_ENTRIES = 200;

class CacheManager {
  private memoryCache = new Map<string, CacheEntry>();
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private totalGets = 0;
  private totalHits = 0;
  private pendingRefreshes = new Set<string>();

  constructor() {
    if (typeof indexedDB !== 'undefined') {
      this.dbPromise = this.openDB();
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (!this.dbPromise) {
      this.dbPromise = this.openDB();
    }
    return this.dbPromise;
  }

  /**
   * Get data from cache. Checks memory first, then IndexedDB.
   * Returns null if not found or expired.
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    this.totalGets++;
    const now = Date.now();

    // Check memory cache first
    const memEntry = this.memoryCache.get(key);
    if (memEntry) {
      if (now - memEntry.timestamp < memEntry.ttl) {
        this.totalHits++;
        return memEntry.data as T;
      }
      // Expired - remove from memory
      this.memoryCache.delete(key);
    }

    // Check IndexedDB
    try {
      const db = await this.ensureDB();
      const dbEntry = await this.getFromDB(db, key);
      if (dbEntry) {
        if (now - dbEntry.timestamp < dbEntry.ttl) {
          this.totalHits++;
          // Promote to memory
          this.memoryCache.set(key, dbEntry);
          this.pruneMemory();
          return dbEntry.data as T;
        }
        // Expired - remove from DB
        this.deleteFromDB(db, key);
      }
    } catch {
      // IndexedDB unavailable, continue without
    }

    return null;
  }

  /**
   * Set data in both memory and IndexedDB caches.
   */
  async set<T = unknown>(key: string, data: T, ttl: number): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      key,
    };

    // Memory cache
    this.memoryCache.set(key, entry);
    this.pruneMemory();

    // IndexedDB
    try {
      const db = await this.ensureDB();
      await this.setInDB(db, entry);
    } catch {
      // IndexedDB unavailable
    }
  }

  /**
   * Get with stale-while-revalidate pattern.
   * Returns cached data immediately if available (even if stale),
   * and triggers background refresh via the provided fetcher.
   */
  async getSWR<T = unknown>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number,
  ): Promise<{ data: T; fromCache: boolean }> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      // Return cached immediately, revalidate in background
      const now = Date.now();
      const memEntry = this.memoryCache.get(key);
      const isStale = memEntry ? (now - memEntry.timestamp > ttl * 0.5) : true;

      if (isStale && !this.pendingRefreshes.has(key)) {
        this.pendingRefreshes.add(key);
        this.revalidateInBackground(key, fetcher, ttl);
      }

      return { data: cached, fromCache: true };
    }

    // No cache - fetch fresh
    const fresh = await fetcher();
    await this.set(key, fresh, ttl);
    return { data: fresh, fromCache: false };
  }

  private async revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number,
  ): Promise<void> {
    try {
      const fresh = await fetcher();
      await this.set(key, fresh, ttl);
    } catch {
      // Silent background failure - stale data is better than none
    } finally {
      this.pendingRefreshes.delete(key);
    }
  }

  /**
   * Preload data into cache (fire-and-forget).
   */
  async preload<T = unknown>(key: string, fetcher: () => Promise<T>, ttl: number): Promise<void> {
    try {
      const data = await fetcher();
      await this.set(key, data, ttl);
    } catch {
      // Silent preload failure
    }
  }

  /**
   * Invalidate a specific cache key.
   */
  async invalidate(key: string): Promise<void> {
    this.memoryCache.delete(key);
    try {
      const db = await this.ensureDB();
      this.deleteFromDB(db, key);
    } catch {
      // IndexedDB unavailable
    }
  }

  /**
   * Invalidate all keys matching a prefix.
   */
  async invalidatePrefix(prefix: string): Promise<void> {
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
      }
    }
    try {
      const db = await this.ensureDB();
      const allKeys = await this.getAllKeysFromDB(db);
      for (const key of allKeys) {
        if (key.startsWith(prefix)) {
          this.deleteFromDB(db, key);
        }
      }
    } catch {
      // IndexedDB unavailable
    }
  }

  /**
   * Clear all caches.
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    try {
      const db = await this.ensureDB();
      await this.clearDB(db);
    } catch {
      // IndexedDB unavailable
    }
  }

  getStats(): CacheStats {
    return {
      memorySize: this.memoryCache.size,
      indexedDBSize: -1, // Would need async, omitted for sync stats
      hitRate: this.totalGets > 0 ? this.totalHits / this.totalGets : 0,
      totalGets: this.totalGets,
      totalHits: this.totalHits,
    };
  }

  // --- IndexedDB helpers ---

  private getFromDB(db: IDBDatabase, key: string): Promise<CacheEntry | undefined> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private setInDB(db: IDBDatabase, entry: CacheEntry): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private deleteFromDB(db: IDBDatabase, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private getAllKeysFromDB(db: IDBDatabase): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(request.error);
    });
  }

  private clearDB(db: IDBDatabase): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private pruneMemory(): void {
    while (this.memoryCache.size > MAX_MEMORY_ENTRIES) {
      // Remove oldest entry
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }
  }
}

// Singleton instance
export const cacheManager = new CacheManager();

// Convenience key builders
export const cacheKeys = {
  userProfile: (userId: string) => `profile:${userId}`,
  userPreferences: (userId: string) => `preferences:${userId}`,
  schedule: (scheduleId: string) => `schedule:${scheduleId}`,
  scheduleVersions: (batchId: string) => `schedule-versions:${batchId}`,
  notifications: (userId: string) => `notifications:${userId}`,
  unreadCount: (userId: string) => `unread-count:${userId}`,
  faculty: () => 'faculty:list',
  rooms: () => 'rooms:list',
  subjects: () => 'subjects:list',
  sections: () => 'sections:list',
  systemRules: () => 'system-rules:list',
  announcements: () => 'announcements:list',
  dashboard: (userId: string, role: string) => `dashboard:${userId}:${role}`,
  analytics: (scope: string) => `analytics:${scope}`,
  conflicts: (versionId: string) => `conflicts:${versionId}`,
};
