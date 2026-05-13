# Optimistic Pre-Loading and Perceived Performance System

## Overview

This comprehensive performance system makes OptiSched feel instant and responsive by preloading likely-needed data and UI resources before the user explicitly requests them. The system prioritizes perceived speed, smoothness, and responsiveness without compromising data consistency.

## Architecture

### Core Components

1. **Cache Manager** (`lib/cache/CacheManager.ts`)
   - Memory + IndexedDB layered caching
   - Stale-while-revalidate pattern
   - TTL-based expiration
   - Background revalidation

2. **Network Monitor** (`lib/performance/NetworkMonitor.ts`)
   - Connection quality detection
   - Save-data mode awareness
   - Adaptive prefetching strategy

3. **Request Deduplicator** (`lib/performance/RequestDeduplicator.ts`)
   - Prevents duplicate in-flight requests
   - Cancels obsolete requests
   - Automatic cleanup

4. **Prefetch Manager** (`lib/performance/PrefetchManager.ts`)
   - Route-based intelligent prefetching
   - Idle-time processing
   - Role-aware rules

5. **Predictive Service** (`lib/performance/PredictiveService.ts`)
   - Tracks navigation patterns
   - Predicts likely next actions
   - Lightweight heuristics

6. **Background Sync** (`lib/performance/BackgroundSync.ts`)
   - Periodic data refresh
   - Offline recovery
   - Network reconnection handling

7. **Login Preload Service** (`services/loginPreloadService.ts`)
   - Preloads during credential entry
   - Aggressive prefetching on button hover
   - Dashboard shell preparation

### Hooks

1. **useStaleWhileRevalidate** (`hooks/useStaleWhileRevalidate.ts`)
   - Returns cached data immediately
   - Refreshes in background
   - SWR pattern

2. **useOptimisticMutation** (`hooks/useOptimisticMutation.ts`)
   - Updates UI before server confirmation
   - Rolls back on failure
   - Optimistic updates

3. **usePrefetch** (`hooks/usePrefetch.ts`)
   - Prefetch on hover/focus
   - Debounced execution
   - Network-aware

4. **usePerformanceMonitor** (`hooks/usePerformanceMonitor.ts`)
   - Tracks FPS, cache hit rate
   - Memory usage monitoring
   - Connection quality

5. **useTabSwitching** (`hooks/useTabSwitching.ts`)
   - Tab state preservation
   - Scroll position memory
   - Stale-while-revalidate

### Skeleton Components

Located in `components/skeletons/SkeletonSystem.tsx`:

- `Skeleton` - Base component
- `CardSkeleton` - Dashboard cards
- `TableSkeleton` - Data tables
- `DashboardSkeleton` - Full dashboard
- `ScheduleSkeleton` - Timetable grid
- `NotificationSkeleton` - Notification list
- `FormSkeleton` - Settings/forms

## Integration Guide

### Step 1: Add PerformanceProvider to App.tsx

Wrap your app with the PerformanceProvider:

```tsx
import { PerformanceProvider } from './contexts/PerformanceContext';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PerformanceProvider>
          <UserPreferencesProvider>
            <ToastProvider>
              <Routes>
                {/* your routes */}
              </Routes>
            </ToastProvider>
          </UserPreferencesProvider>
        </PerformanceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

### Step 2: Integrate Login Preloading

Add to your login page (LandingPage.tsx or LoginPage.tsx):

```tsx
import { loginPreloadService } from './services/loginPreloadService';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    loginPreloadService.onEmailChange(e.target.value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    loginPreloadService.onPasswordChange(e.target.value);
  };

  const handleLogin = async () => {
    const result = await signIn(email, password);
    if (result.error === null) {
      await loginPreloadService.onLoginSuccess(userId, role);
      navigate('/dashboard');
    }
  };

  return (
    <form>
      <input
        type="email"
        value={email}
        onChange={handleEmailChange}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={handlePasswordChange}
        placeholder="Password"
      />
      <button
        type="submit"
        onMouseEnter={() => loginPreloadService.onLoginButtonHover()}
      >
        Sign In
      </button>
    </form>
  );
};
```

### Step 3: Replace Spinners with Skeletons

Replace generic loading spinners with contextual skeletons:

```tsx
import { DashboardSkeleton, TableSkeleton } from './components/skeletons/SkeletonSystem';

// Before
{isLoading && <div className="spinner">Loading...</div>}

// After
{isLoading && <DashboardSkeleton />}
```

### Step 4: Use Stale-While-Revalidate for Data Fetching

Replace direct Supabase calls with SWR pattern:

```tsx
import { useStaleWhileRevalidate } from './hooks/useStaleWhileRevalidate';
import { cacheKeys, CACHE_DURATIONS } from './lib/cache/cacheConfig';

const Dashboard = () => {
  const { data, isLoading, refresh } = useStaleWhileRevalidate({
    key: cacheKeys.dashboard(userId, role),
    fetcher: () => fetchDashboardData(userId, role),
    ttl: CACHE_DURATIONS.DASHBOARD,
  });

  return <DashboardContent data={data} />;
};
```

### Step 5: Add Optimistic Mutations

For user actions that should feel instant:

```tsx
import { useOptimisticMutation } from './hooks/useOptimisticMutation';

const ScheduleEditor = () => {
  const [schedule, setSchedule] = useState(initialSchedule);

  const { mutate, isLoading, error } = useOptimisticMutation({
    mutationFn: (updates) => supabase.from('schedules').update(updates).eq('id', scheduleId),
    onMutate: (updates) => {
      setSchedule(prev => ({ ...prev, ...updates }));
    },
    rollback: () => {
      setSchedule(initialSchedule);
    },
    onSuccess: (data) => {
      toast.success('Schedule updated');
    },
    onError: (err, variables, rollback) => {
      toast.error('Failed to update schedule');
      rollback();
    },
  });

  const handleUpdate = (updates) => {
    mutate(updates);
  };
};
```

### Step 6: Add Tab Switching Optimization

For tab-based navigation:

```tsx
import { useTabSwitching } from './hooks/useTabSwitching';

const TabbedView = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState(null);
  const { containerRef, hasCachedData } = useTabSwitching(activeTab, data);

  return (
    <div ref={containerRef}>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tab value="overview">Overview</Tab>
        <Tab value="details">Details</Tab>
      </Tabs>
      <TabPanel value={activeTab}>
        {hasCachedData ? (
          <CachedContent data={data} />
        ) : (
          <Content />
        )}
      </TabPanel>
    </div>
  );
};
```

### Step 7: Add Prefetching on Hover

For navigation links:

```tsx
import { usePrefetch } from './hooks/usePrefetch';

const NavLink = ({ to, children }) => {
  const { onMouseEnter, onMouseLeave } = usePrefetch({
    key: `route:${to}`,
    fetcher: () => fetchRouteData(to),
    ttl: 5 * 60 * 1000,
  });

  return (
    <Link to={to} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {children}
    </Link>
  );
};
```

## Cache Duration Policies

Defined in `lib/cache/cacheConfig.ts`:

| Data Type | Duration | Rationale |
|-----------|----------|-----------|
| User Profile | 30 min | Rarely changes |
| User Preferences | 15 min | Moderate change frequency |
| Schedule | 5 min | Medium freshness |
| Notifications | 1 min | High freshness needed |
| Unread Count | 30 sec | Very high freshness |
| Attendance | 15 sec | Real-time data |
| Faculty/Rooms/Subjects | 10 min | Reference data |
| System Rules | 15 min | Admin-updated |
| Announcements | 3 min | Time-sensitive |
| Analytics | 5 min | Computed data |
| Conflicts | 2 min | Conflict data |

## Performance Monitoring

Use the performance monitor to track metrics:

```tsx
import { usePerformanceMonitor } from './hooks/usePerformanceMonitor';

const PerformanceDashboard = () => {
  const metrics = usePerformanceMonitor();

  return (
    <div>
      <div>FPS: {metrics.fps}</div>
      <div>Cache Hit Rate: {(metrics.cacheHitRate * 100).toFixed(1)}%</div>
      <div>Connection: {metrics.connectionQuality}</div>
      <div>Memory: {metrics.memoryMB} MB</div>
    </div>
  );
};
```

## Network-Aware Behavior

The system automatically adapts based on connection:

- **Fast connection**: Aggressive prefetching
- **Medium connection**: Moderate prefetching
- **Slow connection**: Minimal prefetching
- **Save-data mode**: Reduced background requests
- **Offline**: Cached data only, sync on reconnection

## Offline Recovery

The background sync system handles network reconnection:

- Automatically refreshes stale data when online
- Syncs pending mutations
- Preserves user experience during outages

## Best Practices

1. **Always use skeletons instead of spinners** - Maintains layout stability
2. **Prefer SWR over direct fetching** - Instant perceived performance
3. **Use optimistic mutations for user actions** - Feels instant
4. **Prefetch on hover/focus** - User intent prediction
5. **Respect cache durations** - Balance freshness vs performance
6. **Monitor performance metrics** - Identify bottlenecks
7. **Test on slow connections** - Ensure graceful degradation

## Troubleshooting

### Cache not working?
- Check IndexedDB is available
- Verify cache key uniqueness
- Check TTL settings

### Prefetching not triggering?
- Verify network quality
- Check if save-data mode is on
- Ensure prefetch rules are registered

### Skeletons not displaying?
- Import CSS: `import './components/skeletons/SkeletonSystem.css'`
- Check z-index conflicts
- Verify dark theme support

### Tab state not preserved?
- Ensure tabId is unique
- Check containerRef is attached
- Verify tabCache is not cleared

## Performance Targets

- **Time to Interactive**: < 2s
- **First Contentful Paint**: < 1s
- **Cache Hit Rate**: > 80%
- **Tab Switch Time**: < 100ms
- **Navigation Time**: < 500ms (with cache)

## Future Enhancements

- Service Worker for offline-first experience
- Resource hints (preload, preconnect, dns-prefetch)
- Virtual scrolling for large lists
- Image optimization and lazy loading
- Streaming SSR for initial payload
