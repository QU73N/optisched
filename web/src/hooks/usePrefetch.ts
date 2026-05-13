/**
 * Prefetch hook for components.
 * Triggers data prefetching on hover/focus of elements.
 */
import { useCallback, useRef } from 'react';
import { cacheManager } from '../lib/cache/CacheManager';
import { networkMonitor } from '../lib/performance/NetworkMonitor';

interface UsePrefetchOptions {
  /** Cache key */
  key: string;
  /** Fetcher function */
  fetcher: () => Promise<unknown>;
  /** TTL in ms */
  ttl: number;
  /** Delay before prefetching on hover (ms) */
  hoverDelay?: number;
}

export function usePrefetch({ key, fetcher, ttl, hoverDelay = 150 }: UsePrefetchOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedRef = useRef(false);

  const onMouseEnter = useCallback(() => {
    if (prefetchedRef.current || !networkMonitor.canPrefetch()) return;

    timerRef.current = setTimeout(() => {
      cacheManager.preload(key, fetcher, ttl);
      prefetchedRef.current = true;
    }, hoverDelay);
  }, [key, fetcher, ttl, hoverDelay]);

  const onMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onFocus = useCallback(() => {
    if (prefetchedRef.current || !networkMonitor.canPrefetch()) return;
    cacheManager.preload(key, fetcher, ttl);
    prefetchedRef.current = true;
  }, [key, fetcher, ttl]);

  return {
    onMouseEnter,
    onMouseLeave,
    onFocus,
    /** Manually trigger prefetch */
    prefetch: () => {
      if (!prefetchedRef.current) {
        cacheManager.preload(key, fetcher, ttl);
        prefetchedRef.current = true;
      }
    },
  };
}
