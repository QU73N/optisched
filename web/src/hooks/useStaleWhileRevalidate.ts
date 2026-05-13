/**
 * Stale-while-revalidate data fetching hook.
 * Returns cached data immediately, refreshes in background.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { cacheManager } from '../lib/cache/CacheManager';

interface SWROptions<T> {
  /** Cache key */
  key: string;
  /** Fetcher function */
  fetcher: () => Promise<T>;
  /** TTL in ms */
  ttl: number;
  /** Whether to fetch on mount */
  enabled?: boolean;
  /** Callback on successful fetch */
  onSuccess?: (data: T) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

interface SWRResult<T> {
  data: T | null;
  isLoading: boolean;
  isStale: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useStaleWhileRevalidate<T>({
  key,
  fetcher,
  ttl,
  enabled = true,
  onSuccess,
  onError,
}: SWROptions<T>): SWRResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const fetchIdRef = useRef(0);

  const doFetch = useCallback(async (): Promise<void> => {
    const fetchId = ++fetchIdRef.current;
    setIsLoading(true);

    try {
      const result = await cacheManager.getSWR<T>(key, fetcher, ttl);
      if (!mountedRef.current || fetchId !== fetchIdRef.current) return;

      setData(result.data);
      setIsStale(result.fromCache);
      setError(null);
      onSuccess?.(result.data);
    } catch (err) {
      if (!mountedRef.current || fetchId !== fetchIdRef.current) return;
      setError(err as Error);
      onError?.(err as Error);
    } finally {
      if (mountedRef.current && fetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [key, fetcher, ttl, onSuccess, onError]);

  const refresh = useCallback(async (): Promise<void> => {
    await cacheManager.invalidate(key);
    await doFetch();
  }, [key, doFetch]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) {
      doFetch();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [enabled, doFetch]);

  return { data, isLoading, isStale, error, refresh };
}
