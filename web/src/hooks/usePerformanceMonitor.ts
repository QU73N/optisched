/**
 * Performance monitoring hook.
 * Tracks key metrics: page load time, interaction latency, cache hit rate.
 */
import { useEffect, useRef, useState } from 'react';
import { cacheManager } from '../lib/cache/CacheManager';
import { networkMonitor } from '../lib/performance/NetworkMonitor';

interface PerformanceMetrics {
  /** Time to first meaningful paint estimate (ms) */
  ttfp: number;
  /** Cache hit rate (0-1) */
  cacheHitRate: number;
  /** Network quality */
  connectionQuality: string;
  /** FPS (if available) */
  fps: number;
  /** Memory usage estimate (MB, if available) */
  memoryMB: number | null;
}

export function usePerformanceMonitor(): PerformanceMetrics {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    ttfp: 0,
    cacheHitRate: 0,
    connectionQuality: networkMonitor.getQuality(),
    fps: 60,
    memoryMB: null,
  });

  const frameCount = useRef(0);
  const lastFpsUpdate = useRef(0);
  const rafId = useRef<number>(0);

  useEffect(() => {
    // FPS calculation loop
    const loop = () => {
      const cacheStats = cacheManager.getStats();

      frameCount.current++;
      const now = performance.now();
      if (lastFpsUpdate.current === 0) {
        lastFpsUpdate.current = now;
      }
      if (now - lastFpsUpdate.current >= 1000) {
        const fps = Math.round(frameCount.current / ((now - lastFpsUpdate.current) / 1000));
        frameCount.current = 0;
        lastFpsUpdate.current = now;

        setMetrics((prev) => ({
          ...prev,
          fps,
          cacheHitRate: cacheStats.hitRate,
          connectionQuality: networkMonitor.getQuality(),
          memoryMB: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
            ? Math.round(((performance as Performance & { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1048576) * 10) / 10
            : null,
        }));
      }

      rafId.current = requestAnimationFrame(loop);
    };

    // Measure time to first paint
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const fpEntry = entries.find((e) => e.name === 'first-paint');
      if (fpEntry) {
        setMetrics((prev) => ({ ...prev, ttfp: Math.round(fpEntry.startTime) }));
      }
    });

    try {
      observer.observe({ type: 'paint', buffered: true });
    } catch {
      // Paint timing not available
    }

    rafId.current = requestAnimationFrame(loop);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId.current);
    };
  }, []);

  return metrics;
}
