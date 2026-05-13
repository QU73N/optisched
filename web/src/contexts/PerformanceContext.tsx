/**
 * Performance Context Provider.
 * Integrates all performance systems: caching, prefetching, predictive behavior, etc.
 */
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { prefetchManager } from '../lib/performance/PrefetchManager';
import { predictiveService } from '../lib/performance/PredictiveService';
import { backgroundSync } from '../lib/performance/BackgroundSync';
import { useAuth } from './AuthContext';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface PerformanceContextType {
  prefetch: (key: string, fetcher: () => Promise<unknown>, ttl: number) => Promise<void>;
  recordNavigation: (from: string, to: string) => void;
}

const PerformanceContext = createContext<PerformanceContextType | undefined>(undefined);

export const PerformanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { role } = useAuth();
  const location = useLocation();
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    // Record navigation for predictive service
    if (previousPath.current && role) {
      predictiveService.record(previousPath.current, location.pathname, role);
    }

    // Trigger prefetching based on current route
    if (role) {
      prefetchManager.trigger(location.pathname, role);
    }

    previousPath.current = location.pathname;
  }, [location.pathname, role]);

  useEffect(() => {
    // Register background sync tasks for critical data
    // These will refresh periodically in the background
    if (role) {
      // System rules - refresh every 15 minutes
      backgroundSync.register(
        'system-rules',
        async () => {
          const { data } = await supabase.from('system_rules').select('*');
          return data;
        },
        15 * 60 * 1000, // 15 min TTL
        15 * 60 * 1000, // 15 min interval
      );
    }

    return () => {
      // Cleanup on unmount
      if (role) {
        backgroundSync.unregister('system-rules');
      }
    };
  }, [role]);

  const prefetch = async (key: string, fetcher: () => Promise<unknown>, ttl: number): Promise<void> => {
    await prefetchManager.prefetchData(key, fetcher, ttl);
  };

  const recordNavigation = (from: string, to: string): void => {
    if (role) {
      predictiveService.record(from, to, role);
    }
  };

  return (
    <PerformanceContext.Provider value={{ prefetch, recordNavigation }}>
      {children}
    </PerformanceContext.Provider>
  );
};

export const usePerformance = () => {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformance must be used within PerformanceProvider');
  }
  return context;
};
