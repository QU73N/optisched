/**
 * Tab switching optimization with stale-while-revalidate.
 * Keeps recently visited tabs in memory cache with preserved scroll position.
 */
import { useRef, useEffect, useCallback } from 'react';

interface TabState {
  data: unknown;
  scrollPosition: number;
  timestamp: number;
}

interface TabCacheEntry {
  [tabId: string]: TabState;
}

const MAX_TAB_CACHE = 10;
const TAB_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

class TabCache {
  private cache: TabCacheEntry = {};

  set(tabId: string, data: unknown, scrollPosition: number = 0): void {
    this.cache[tabId] = {
      data,
      scrollPosition,
      timestamp: Date.now(),
    };

    // Prune old entries
    this.prune();
  }

  get(tabId: string): { data: unknown; scrollPosition: number } | null {
    const entry = this.cache[tabId];
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > TAB_CACHE_TTL) {
      delete this.cache[tabId];
      return null;
    }

    return {
      data: entry.data,
      scrollPosition: entry.scrollPosition,
    };
  }

  has(tabId: string): boolean {
    return this.cache[tabId] !== undefined;
  }

  invalidate(tabId: string): void {
    delete this.cache[tabId];
  }

  clear(): void {
    this.cache = {};
  }

  private prune(): void {
    const entries = Object.entries(this.cache);
    if (entries.length <= MAX_TAB_CACHE) return;

    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest entries
    const toRemove = entries.slice(0, entries.length - MAX_TAB_CACHE);
    for (const [tabId] of toRemove) {
      delete this.cache[tabId];
    }
  }
}

export const tabCache = new TabCache();

/**
 * Hook for tab switching optimization.
 * Preserves scroll position and data across tab switches.
 */
export function useTabSwitching<T>(
  tabId: string,
  data: T | null,
) {
  const scrollPositionRef = useRef(0);
  const lastTabIdRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Save state when leaving a tab
  useEffect(() => {
    if (lastTabIdRef.current && lastTabIdRef.current !== tabId) {
      // Save previous tab state
      if (containerRef.current) {
        scrollPositionRef.current = containerRef.current.scrollTop;
      }
      tabCache.set(lastTabIdRef.current, data, scrollPositionRef.current);
    }
  }, [tabId, data]);

  // Restore state when entering a tab
  useEffect(() => {
    if (tabId !== lastTabIdRef.current) {
      const cached = tabCache.get(tabId);
      if (cached && containerRef.current) {
        // Restore scroll position
        containerRef.current.scrollTop = cached.scrollPosition;
      }
      lastTabIdRef.current = tabId;
    }
  }, [tabId]);

  const invalidateTab = useCallback(() => {
    tabCache.invalidate(tabId);
  }, [tabId]);

  const clearCache = useCallback(() => {
    tabCache.clear();
  }, []);

  return {
    containerRef,
    invalidateTab,
    clearCache,
    hasCachedData: tabCache.has(tabId),
  };
}
