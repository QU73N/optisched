import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
    Activity, CheckCircle, AlertTriangle, XCircle, RefreshCw,
    Clock, Shield, Database, HardDrive, Server, Zap, TrendingUp,
    TrendingDown, Users, Calendar, BarChart3, ChevronRight
} from 'lucide-react';
import './Dashboard.css';
import './AuditLogPage.css';

interface HealthCheck {
    name: string;
    category: 'infrastructure' | 'database' | 'storage' | 'application' | 'security';
    status: 'healthy' | 'degraded' | 'unhealthy';
    message: string;
    details?: string;
    lastChecked: Date;
    responseTime?: number;
    trend?: 'up' | 'down' | 'stable';
    history?: { status: string; timestamp: Date }[];
}

interface SystemMetrics {
    totalUsers: number;
    activeUsers: number;
    totalSchedules: number;
    recentActivity: number;
    dbSize?: string;
    storageUsed?: string;
}

interface HistoricalData {
    timestamp: Date;
    dbResponseTime: number;
    errorCount: number;
    activeSessions: number;
}

const HealthPage: React.FC = () => {
    const { profile } = useAuth();
    const [checks, setChecks] = useState<HealthCheck[]>([]);
    const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [selectedCheck, setSelectedCheck] = useState<HealthCheck | null>(null);
    const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
    const [timeRange, setTimeRange] = useState<number>(60); // minutes

    const isPower = profile?.role === 'power_admin' || profile?.role === 'system_admin' || profile?.role === 'admin';

    const runHealthChecks = useCallback(async () => {
        setRefreshing(true);
        const results: HealthCheck[] = [];
        const now = new Date();

        // Database connectivity and performance
        try {
            const start = Date.now();
            await supabase.from('profiles').select('id', { count: 'exact', head: true });
            const responseTime = Date.now() - start;
            const dbStatus = responseTime < 200 ? 'healthy' : responseTime < 500 ? 'degraded' : 'unhealthy';
            results.push({
                name: 'Database Connectivity',
                category: 'database',
                status: dbStatus,
                message: `Response time: ${responseTime}ms`,
                details: `Query executed successfully in ${responseTime}ms. Thresholds: <200ms (healthy), <500ms (degraded)`,
                lastChecked: now,
                responseTime,
                trend: responseTime < 100 ? 'up' : responseTime > 400 ? 'down' : 'stable',
            });
        } catch {
            results.push({
                name: 'Database Connectivity',
                category: 'database',
                status: 'unhealthy',
                message: 'Connection failed',
                details: 'Unable to establish connection to the database. Check network and database status.',
                lastChecked: now,
                trend: 'down',
            });
        }

        // Database size and growth
        try {
            const { count: profileCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
            const { count: scheduleCount } = await supabase.from('schedules').select('*', { count: 'exact', head: true });
            results.push({
                name: 'Database Records',
                category: 'database',
                status: 'healthy',
                message: `${profileCount} profiles, ${scheduleCount} schedules`,
                details: `Total records in database: ${profileCount + scheduleCount}`,
                lastChecked: now,
                trend: 'stable',
            });
        } catch {
            results.push({
                name: 'Database Records',
                category: 'database',
                status: 'degraded',
                message: 'Unable to count records',
                details: 'Database query failed. Possible performance issues.',
                lastChecked: now,
                trend: 'down',
            });
        }

        // Storage buckets
        try {
            const { data, error } = await supabase.storage.listBuckets();
            if (error) {
                results.push({
                    name: 'Storage Service',
                    category: 'storage',
                    status: 'degraded',
                    message: 'Unable to list buckets',
                    details: error.message,
                    lastChecked: now,
                    trend: 'down',
                });
            } else {
                results.push({
                    name: 'Storage Service',
                    category: 'storage',
                    status: 'healthy',
                    message: `${data.length} bucket${data.length !== 1 ? 's' : ''} accessible`,
                    details: `Storage buckets: ${data.map(b => b.name).join(', ')}`,
                    lastChecked: now,
                    trend: 'stable',
                });
            }
        } catch {
            results.push({
                name: 'Storage Service',
                category: 'storage',
                status: 'unhealthy',
                message: 'Storage check failed',
                details: 'Storage service is not responding.',
                lastChecked: now,
                trend: 'down',
            });
        }

        // Error rate (last hour)
        try {
            const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
            const { count } = await supabase
                .from('client_error_logs')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', oneHourAgo);
            const errorCount = count || 0;
            const errorStatus = errorCount > 50 ? 'degraded' : errorCount > 100 ? 'unhealthy' : 'healthy';
            results.push({
                name: 'Error Rate',
                category: 'application',
                status: errorStatus,
                message: `${errorCount} error${errorCount !== 1 ? 's' : ''} in the last hour`,
                details: `Error threshold: <50/hour (healthy), 50-100/hour (degraded), >100/hour (unhealthy)`,
                lastChecked: now,
                trend: errorCount > 25 ? 'down' : 'stable',
            });
        } catch {
            results.push({
                name: 'Error Rate',
                category: 'application',
                status: 'degraded',
                message: 'Unable to query error logs',
                details: 'Error logs table may not exist or be inaccessible.',
                lastChecked: now,
                trend: 'down',
            });
        }

        // Active sessions
        try {
            const since = new Date(Date.now() - timeRange * 60 * 1000).toISOString();
            const { count } = await supabase
                .from('user_activity_logs')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', since);
            const sessionCount = count || 0;
            results.push({
                name: 'Active Sessions',
                category: 'application',
                status: 'healthy',
                message: `${sessionCount} session${sessionCount !== 1 ? 's' : ''} in last ${timeRange}min`,
                details: `Users with activity in the last ${timeRange} minutes`,
                lastChecked: now,
                trend: 'stable',
            });
        } catch {
            results.push({
                name: 'Active Sessions',
                category: 'application',
                status: 'degraded',
                message: 'Unable to check sessions',
                details: 'Activity logs may not be accessible.',
                lastChecked: now,
                trend: 'down',
            });
        }

        // Backup status
        try {
            const { data, error } = await supabase
                .from('backup_jobs')
                .select('created_at')
                .eq('status', 'succeeded')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            
            if (error || !data) {
                results.push({
                    name: 'Backup Status',
                    category: 'infrastructure',
                    status: 'degraded',
                    message: 'No successful backup found',
                    details: 'No successful backup jobs found in the database.',
                    lastChecked: now,
                    trend: 'down',
                });
            } else {
                const hoursAgo = (Date.now() - new Date(data.created_at).getTime()) / 3600000;
                const backupStatus = hoursAgo > 48 ? 'degraded' : hoursAgo > 72 ? 'unhealthy' : 'healthy';
                const message = hoursAgo < 1 
                    ? 'Less than 1 hour ago' 
                    : hoursAgo < 24 
                        ? `${Math.round(hoursAgo)} hour${Math.round(hoursAgo) !== 1 ? 's' : ''} ago` 
                        : `${Math.round(hoursAgo / 24)} day${Math.round(hoursAgo / 24) !== 1 ? 's' : ''} ago`;
                results.push({
                    name: 'Backup Status',
                    category: 'infrastructure',
                    status: backupStatus,
                    message,
                    details: `Last successful backup was ${message}. Recommended: Daily backups.`,
                    lastChecked: now,
                    trend: hoursAgo < 24 ? 'up' : hoursAgo > 48 ? 'down' : 'stable',
                });
            }
        } catch {
            results.push({
                name: 'Backup Status',
                category: 'infrastructure',
                status: 'degraded',
                message: 'Unable to check backup status',
                details: 'Backup jobs table may not exist or be inaccessible.',
                lastChecked: now,
                trend: 'down',
            });
        }

        // Authentication service
        try {
            const { data: { session } } = await supabase.auth.getSession();
            results.push({
                name: 'Authentication',
                category: 'security',
                status: session ? 'healthy' : 'degraded',
                message: session ? 'Auth service operational' : 'No active session',
                details: session ? 'Authentication service is responding correctly.' : 'Unable to verify authentication status.',
                lastChecked: now,
                trend: 'stable',
            });
        } catch {
            results.push({
                name: 'Authentication',
                category: 'security',
                status: 'unhealthy',
                message: 'Auth service check failed',
                details: 'Authentication service may be down or misconfigured.',
                lastChecked: now,
                trend: 'down',
            });
        }

        // RPC functions
        try {
            await supabase.rpc('get_teachers_with_profiles');
            results.push({
                name: 'RPC Functions',
                category: 'infrastructure',
                status: 'healthy',
                message: 'RPC endpoints responding',
                details: 'Database RPC functions are accessible and functional.',
                lastChecked: now,
                trend: 'stable',
            });
        } catch {
            results.push({
                name: 'RPC Functions',
                category: 'infrastructure',
                status: 'degraded',
                message: 'RPC check failed',
                details: 'Some RPC functions may not be available.',
                lastChecked: now,
                trend: 'down',
            });
        }

        setChecks(results);
        setLoading(false);
        setRefreshing(false);

        // Update historical data
        setHistoricalData(prev => {
            const dbCheck = results.find(r => r.name === 'Database Connectivity');
            const errorCheck = results.find(r => r.name === 'Error Rate');
            const sessionCheck = results.find(r => r.name === 'Active Sessions');
            
            const newDataPoint: HistoricalData = {
                timestamp: now,
                dbResponseTime: dbCheck?.responseTime || 0,
                errorCount: parseInt(errorCheck?.message.match(/\d+/)?.[0] || '0'),
                activeSessions: parseInt(sessionCheck?.message.match(/\d+/)?.[0] || '0'),
            };

            const updated = [...prev, newDataPoint].slice(-20); // Keep last 20 data points
            return updated;
        });
    }, [timeRange]);

    const loadMetrics = useCallback(async () => {
        try {
            const [{ count: totalUsers }, { count: totalSchedules }, { count: recentActivity }] = await Promise.all([
                supabase.from('profiles').select('*', { count: 'exact', head: true }),
                supabase.from('schedules').select('*', { count: 'exact', head: true }),
                supabase.from('user_activity_logs').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 3600000).toISOString()),
            ]);

            const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
            const { data: activityData } = await supabase.from('user_activity_logs').select('user_id').gte('created_at', oneHourAgo);
            const activeUsers = new Set(activityData?.map(d => d.user_id) || []).size;

            setMetrics({
                totalUsers: totalUsers || 0,
                activeUsers,
                totalSchedules: totalSchedules || 0,
                recentActivity: recentActivity || 0,
            });
        } catch (err) {
            console.error('[Health] Failed to load metrics', err);
        }
    }, []);

    useEffect(() => {
        if (isPower) {
            setTimeout(() => {
                runHealthChecks().catch(console.error);
                loadMetrics().catch(console.error);
            }, 0);
            const interval = setInterval(() => {
                if (autoRefresh) {
                    runHealthChecks().catch(console.error);
                    loadMetrics().catch(console.error);
                }
            }, 30000);
            return () => clearInterval(interval);
        }
    }, [isPower, runHealthChecks, loadMetrics, autoRefresh]);

    const overallHealth = useMemo(() => {
        if (checks.length === 0) return null;
        const unhealthy = checks.filter(c => c.status === 'unhealthy').length;
        const degraded = checks.filter(c => c.status === 'degraded').length;
        if (unhealthy > 0) return { status: 'unhealthy' as const, score: 0, message: `${unhealthy} critical issue${unhealthy !== 1 ? 's' : ''}` };
        if (degraded > 2) return { status: 'degraded' as const, score: 50, message: `${degraded} warning${degraded !== 1 ? 's' : ''}` };
        if (degraded > 0) return { status: 'degraded' as const, score: 75, message: `${degraded} warning${degraded !== 1 ? 's' : ''}` };
        return { status: 'healthy' as const, score: 100, message: 'All systems operational' };
    }, [checks]);

    const categoryGroups = useMemo(() => {
        const groups: Record<string, HealthCheck[]> = {};
        checks.forEach(check => {
            if (!groups[check.category]) groups[check.category] = [];
            groups[check.category].push(check);
        });
        return groups;
    }, [checks]);

    if (!isPower) {
        return (
            <div className="dashboard">
                <div className="dash-empty"><Shield size={28} /><div>System health is restricted to Power Admin / System Admin.</div></div>
            </div>
        );
    }

    const statusIcon = (status: HealthCheck['status']) => {
        switch (status) {
            case 'healthy': return <CheckCircle size={20} />;
            case 'degraded': return <AlertTriangle size={20} />;
            case 'unhealthy': return <XCircle size={20} />;
        }
    };

    const categoryIcon = (category: HealthCheck['category']) => {
        switch (category) {
            case 'infrastructure': return <Server size={16} />;
            case 'database': return <Database size={16} />;
            case 'storage': return <HardDrive size={16} />;
            case 'application': return <Activity size={16} />;
            case 'security': return <Shield size={16} />;
        }
    };

    const trendIcon = (trend?: 'up' | 'down' | 'stable') => {
        switch (trend) {
            case 'up': return <TrendingUp size={14} style={{ color: 'var(--accent-success)' }} />;
            case 'down': return <TrendingDown size={14} style={{ color: 'var(--accent-error)' }} />;
            case 'stable': return <Activity size={14} style={{ color: 'var(--text-muted)' }} />;
        }
    };

    const statusColor = (status: HealthCheck['status']) => {
        switch (status) {
            case 'healthy': return 'var(--accent-success)';
            case 'degraded': return 'var(--accent-warning)';
            case 'unhealthy': return 'var(--accent-error)';
        }
    };

    const statusBg = (status: HealthCheck['status']) => {
        switch (status) {
            case 'healthy': return 'var(--accent-success-subtle)';
            case 'degraded': return 'var(--accent-warning-subtle)';
            case 'unhealthy': return 'var(--accent-error-subtle)';
        }
    };

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1 className="dashboard-title"><Activity size={20} /> System Health</h1>
                <p className="dashboard-subtitle">
                    Real-time system monitoring and diagnostics. Auto-refreshes every 30 seconds.
                </p>
            </div>

            {/* Overall Health Score */}
            {overallHealth && (
                <div className="card" style={{ marginBottom: 16, padding: '20px', display: 'flex', alignItems: 'center', gap: 20, background: statusBg(overallHealth.status), border: `1px solid ${statusColor(overallHealth.status)}` }}>
                    <div style={{ 
                        width: 80, height: 80, borderRadius: '50%', 
                        background: statusColor(overallHealth.status),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: 28, fontWeight: 700
                    }}>
                        {overallHealth.score}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 500 }}>Overall Health Score</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: statusColor(overallHealth.status), marginTop: 4 }}>
                            {overallHealth.status.charAt(0).toUpperCase() + overallHealth.status.slice(1)}
                        </div>
                        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>{overallHealth.message}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Last checked</div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{new Date().toLocaleTimeString()}</div>
                    </div>
                </div>
            )}

            {/* System Metrics */}
            {metrics && (
                <div className="stats-grid" style={{ marginBottom: 16 }}>
                    <div className="stat-card">
                        <div className="stat-icon"><Users size={20} /></div>
                        <div className="stat-number">{metrics.totalUsers}</div>
                        <div className="stat-label">Total Users</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon"><Activity size={20} /></div>
                        <div className="stat-number">{metrics.activeUsers}</div>
                        <div className="stat-label">Active (1h)</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon"><Calendar size={20} /></div>
                        <div className="stat-number">{metrics.totalSchedules}</div>
                        <div className="stat-label">Total Schedules</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon"><Zap size={20} /></div>
                        <div className="stat-number">{metrics.recentActivity}</div>
                        <div className="stat-label">Recent Events (1h)</div>
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="audit-toolbar">
                <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(Number(e.target.value))}
                        style={{
                            padding: '8px 12px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-primary)',
                            fontSize: '13px',
                            cursor: 'pointer'
                        }}
                    >
                        <option value={15}>Last 15 min</option>
                        <option value={30}>Last 30 min</option>
                        <option value={60}>Last 1 hour</option>
                        <option value={120}>Last 2 hours</option>
                    </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                        className={`btn ${autoRefresh ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        title="Auto-refresh every 30 seconds"
                    >
                        <RefreshCw size={14} className={autoRefresh ? 'spin' : ''} />
                        Auto
                    </button>
                    <button className="btn btn-secondary" onClick={runHealthChecks} disabled={refreshing}>
                        <RefreshCw size={14} className={refreshing ? 'spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="dash-loading-center"><RefreshCw className="spin" size={28} /></div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Health Checks by Category */}
                    {Object.entries(categoryGroups).map(([category, categoryChecks]) => (
                        <div key={category} className="card" style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                {categoryIcon(category as HealthCheck['category'])}
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                                    {category}
                                </span>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    ({categoryChecks.filter(c => c.status === 'healthy').length}/{categoryChecks.length} healthy)
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                                {categoryChecks.map(check => (
                                    <div
                                        key={check.name}
                                        onClick={() => setSelectedSession(check)}
                                        style={{
                                            padding: '16px',
                                            background: statusBg(check.status),
                                            border: `1px solid ${statusColor(check.status)}`,
                                            borderRadius: 'var(--radius-sm)',
                                            cursor: 'pointer',
                                            transition: 'all var(--transition-fast)'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ color: statusColor(check.status) }}>
                                                    {statusIcon(check.status)}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{check.name}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                                        {check.responseTime && `Response: ${check.responseTime}ms`}
                                                    </div>
                                                </div>
                                            </div>
                                            {trendIcon(check.trend)}
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{check.message}</div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Clock size={11} /> {check.lastChecked.toLocaleTimeString()}
                                            </div>
                                            <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Historical Trends */}
                    {historicalData.length > 0 && (
                        <div className="card" style={{ padding: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                <BarChart3 size={16} style={{ color: 'var(--accent-primary)' }} />
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                    Historical Trends (Last 20 checks)
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                                <div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Database Response Time</div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
                                        {historicalData.map((d, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    flex: 1,
                                                    background: d.dbResponseTime < 200 ? 'var(--accent-success)' : d.dbResponseTime < 500 ? 'var(--accent-warning)' : 'var(--accent-error)',
                                                    borderRadius: '2px',
                                                    height: `${Math.min(100, (d.dbResponseTime / 1000) * 100)}%`,
                                                    opacity: 0.8
                                                }}
                                                title={`${d.dbResponseTime}ms at ${d.timestamp.toLocaleTimeString()}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Error Count</div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
                                        {historicalData.map((d, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    flex: 1,
                                                    background: d.errorCount < 20 ? 'var(--accent-success)' : d.errorCount < 50 ? 'var(--accent-warning)' : 'var(--accent-error)',
                                                    borderRadius: '2px',
                                                    height: `${Math.min(100, (d.errorCount / 100) * 100)}%`,
                                                    opacity: 0.8
                                                }}
                                                title={`${d.errorCount} errors at ${d.timestamp.toLocaleTimeString()}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Active Sessions</div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
                                        {historicalData.map((d, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    flex: 1,
                                                    background: 'var(--accent-primary)',
                                                    borderRadius: '2px',
                                                    height: `${Math.min(100, (d.activeSessions / 50) * 100)}%`,
                                                    opacity: 0.8
                                                }}
                                                title={`${d.activeSessions} sessions at ${d.timestamp.toLocaleTimeString()}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Detail Modal */}
            {selectedCheck && (
                <div className="modal-overlay" onClick={() => setSelectedCheck(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Health Check Details</h3>
                            <button 
                                onClick={() => setSelectedCheck(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                            >
                                <XCircle size={18} />
                            </button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: statusBg(selectedCheck.status), borderRadius: 'var(--radius-sm)', border: `1px solid ${statusColor(selectedCheck.status)}` }}>
                                <div style={{ color: statusColor(selectedCheck.status) }}>
                                    {statusIcon(selectedCheck.status)}
                                </div>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedCheck.name}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{selectedCheck.category}</div>
                                </div>
                            </div>

                            <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Status</div>
                                <div style={{ fontSize: 16, fontWeight: 600, color: statusColor(selectedCheck.status) }}>
                                    {selectedCheck.status.charAt(0).toUpperCase() + selectedCheck.status.slice(1)}
                                </div>
                            </div>

                            <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Message</div>
                                <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{selectedCheck.message}</div>
                            </div>

                            {selectedCheck.details && (
                                <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Details</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{selectedCheck.details}</div>
                                </div>
                            )}

                            {selectedCheck.responseTime && (
                                <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Response Time</div>
                                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedCheck.responseTime}ms</div>
                                </div>
                            )}

                            <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Last Checked</div>
                                <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{selectedCheck.lastChecked.toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HealthPage;
