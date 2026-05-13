/**
 * Network-aware optimization monitor.
 * Adapts prefetching strategy based on connection quality.
 */
type ConnectionQuality = 'fast' | 'medium' | 'slow' | 'offline';

type Listener = (quality: ConnectionQuality) => void;

class NetworkMonitor {
  private quality: ConnectionQuality = 'fast';
  private listeners = new Set<Listener>();
  private saveData = false;

  constructor() {
    this.detectQuality();
    this.setupListeners();
  }

  private detectQuality(): void {
    if (typeof navigator === 'undefined') return;

    const conn = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean; rtt?: number; downlink?: number } }).connection;
    if (!conn) return;

    this.saveData = conn.saveData ?? false;

    const type = conn.effectiveType || '4g';
    if (type === 'slow-2g' || type === '2g') {
      this.quality = 'slow';
    } else if (type === '3g') {
      this.quality = 'medium';
    } else {
      this.quality = 'fast';
    }
  }

  private setupListeners(): void {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') return;

    const conn = (navigator as Navigator & { connection?: { addEventListener?: (type: string, cb: () => void) => void } }).connection;
    if (!conn?.addEventListener) return;

    conn.addEventListener('change', () => {
      const prev = this.quality;
      this.detectQuality();
      if (this.quality !== prev) {
        this.notify();
      }
    });

    window.addEventListener('online', () => {
      this.detectQuality();
      this.notify();
    });

    window.addEventListener('offline', () => {
      this.quality = 'offline';
      this.notify();
    });
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try { listener(this.quality); } catch { /* silent */ }
    }
  }

  getQuality(): ConnectionQuality {
    return this.quality;
  }

  isSaveData(): boolean {
    return this.saveData;
  }

  /** Whether aggressive prefetching is appropriate */
  canPrefetchAggressively(): boolean {
    return this.quality === 'fast' && !this.saveData;
  }

  /** Whether any prefetching should happen */
  canPrefetch(): boolean {
    return this.quality !== 'offline' && this.quality !== 'slow';
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}

export const networkMonitor = new NetworkMonitor();
export type { ConnectionQuality };
