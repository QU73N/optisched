/**
 * Login page optimistic preloading service.
 * Preloads dashboard shell, routes, and data while user types credentials.
 */
import { cacheManager, cacheKeys } from '../lib/cache/CacheManager';
import { CACHE_DURATIONS } from '../lib/cache/cacheConfig';
import { networkMonitor } from '../lib/performance/NetworkMonitor';
import { prefetchManager } from '../lib/performance/PrefetchManager';
import { supabase } from '../lib/supabase';

type LoginPreloadState = {
  hasStarted: boolean;
  emailValid: boolean;
  passwordValid: boolean;
  hasHovered: boolean;
  preloadedChunks: Set<string>;
};

class LoginPreloadService {
  private state: LoginPreloadState = {
    hasStarted: false,
    emailValid: false,
    passwordValid: false,
    hasHovered: false,
    preloadedChunks: new Set(),
  };

  /**
   * Call when email input changes.
   */
  onEmailChange(email: string): void {
    const isValid = this.validateEmail(email);
    if (isValid !== this.state.emailValid) {
      this.state.emailValid = isValid;
      this.checkAndStart();
    }
  }

  /**
   * Call when password input changes.
   */
  onPasswordChange(password: string): void {
    const isValid = password.length >= 6;
    if (isValid !== this.state.passwordValid) {
      this.state.passwordValid = isValid;
      this.checkAndStart();
    }
  }

  /**
   * Call when user hovers over login button.
   */
  onLoginButtonHover(): void {
    if (!this.state.hasHovered) {
      this.state.hasHovered = true;
      this.aggressivePreload();
    }
  }

  /**
   * Call after successful authentication to complete preloading.
   */
  async onLoginSuccess(userId: string, role: string): Promise<void> {
    // Prefetch user-specific data
    const profileKey = cacheKeys.userProfile(userId);
    await cacheManager.preload(profileKey, async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      return data;
    }, CACHE_DURATIONS.USER_PROFILE);

    // Trigger route-based prefetching for the role
    prefetchManager.trigger(`/${role}`, role);
  }

  /**
   * Reset state (call on logout or page unload).
   */
  reset(): void {
    this.state = {
      hasStarted: false,
      emailValid: false,
      passwordValid: false,
      hasHovered: false,
      preloadedChunks: new Set(),
    };
  }

  private validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private checkAndStart(): void {
    if (this.state.emailValid && this.state.passwordValid && !this.state.hasStarted) {
      this.state.hasStarted = true;
      this.lightweightPreload();
    }
  }

  /**
   * Lightweight preloading when both fields appear valid.
   */
  private lightweightPreload(): void {
    if (!networkMonitor.canPrefetch()) return;

    // Preload dashboard shell chunks
    this.preloadChunk('/admin');
    this.preloadChunk('/teacher');
    this.preloadChunk('/student');

    // Preload critical fonts/icons if not already loaded
    this.preloadAssets();
  }

  /**
   * Aggressive preloading on button hover.
   */
  private aggressivePreload(): void {
    if (!networkMonitor.canPrefetch()) return;

    // Preload all dashboard routes
    const routes = [
      '/admin/schedules/versions',
      '/admin/conflicts',
      '/admin/approvals',
      '/teacher/schedule',
      '/teacher/workload',
      '/student/schedule',
      '/student/upcoming',
    ];

    for (const route of routes) {
      this.preloadChunk(route);
    }

    // Warm API connection with a lightweight request
    this.warmConnection();
  }

  private preloadChunk(route: string): void {
    if (this.state.preloadedChunks.has(route)) return;
    this.state.preloadedChunks.add(route);

    if (typeof document !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.as = 'document';
      link.href = route;
      document.head.appendChild(link);
    }
  }

  private preloadAssets(): void {
    // Preload common icons and fonts
    if (typeof document !== 'undefined') {
      const assets = [
        // Lucide icons are tree-shaken, but we can preload critical fonts
        { rel: 'preload', as: 'font', type: 'font/woff2', href: '/fonts/inter.woff2' },
      ];

      for (const asset of assets) {
        const link = document.createElement('link');
        link.rel = asset.rel;
        if (asset.as) link.as = asset.as;
        if (asset.type) link.type = asset.type;
        link.href = asset.href;
        document.head.appendChild(link);
      }
    }
  }

  private async warmConnection(): Promise<void> {
    // Lightweight request to warm the connection
    try {
      await supabase.from('system_rules').select('key').limit(1);
    } catch {
      // Silent failure - just warming connection
    }
  }
}

export const loginPreloadService = new LoginPreloadService();
