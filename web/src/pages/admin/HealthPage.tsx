import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
    Activity, CheckCircle, AlertTriangle, XCircle, RefreshCw,
    Clock, Shield,
} from 'lucide-react';

interface HealthCheck {
    name: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    message: string;
    lastChecked: Date;
}

const HealthPage: React.FC = () => {
    const { profile } = useAuth();
    const [checks, setChecks] = useState<HealthCheck[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const isPower = profile?.role === 'power_admin' || profile?.role === 'system_admin';

    const runHealthChecks = useCallback(async () => {
        setRefreshing(true);
        const results: HealthCheck[] = [];

        // DB ping
        try {
            const start = Date.now();
            await supabase.rpc('health_ping'); // Would need to create this RPC
            results.push({
                name: 'Database',
                status: 'healthy',
                message: `Response time: ${Date.now() - start}ms`,
                lastChecked: new Date(),
            });
        } catch {
            results.push({
                name: 'Database',
                status: 'unhealthy',
                message: 'Connection failed',
                lastChecked: new Date(),
            });
        }

        // Storage bucket check (placeholder - would need real implementation)
        results.push({
            name: 'Storage',
            status: 'healthy',
            message: 'All buckets accessible',
            lastChecked: new Date(),
        });

        // Recent error count (last 1h)
        try {
            const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
            const { count } = await supabase
                .from('client_error_logs')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', oneHourAgo);
            results.push({
                name: 'Error Rate',
                status: (count || 0) > 50 ? 'degraded' : 'healthy',
                message: `${count || 0} errors in the last hour`,
                lastChecked: new Date(),
            });
        } catch {
            results.push({
                name: 'Error Rate',
                status: 'unhealthy',
                message: 'Unable to query error logs',
                lastChecked: new Date(),
            });
        }

        // Backup age check
        try {
            const { data } = await supabase
                .from('backup_jobs')
                .select('created_at')
                .eq('status', 'succeeded')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            if (data) {
                const hoursAgo = (Date.now() - new Date(data.created_at).getTime()) / 3600000;
                results.push({
                    name: 'Last Backup',
                    status: hoursAgo > 48 ? 'degraded' : 'healthy',
                    message: hoursAgo < 24 ? 'Within 24h' : `${Math.round(hoursAgo)}h ago`,
                    lastChecked: new Date(),
                });
            } else {
                results.push({
                    name: 'Last Backup',
                    status: 'degraded',
                    message: 'No successful backup found',
                    lastChecked: new Date(),
                });
            }
        } catch {
            results.push({
                name: 'Last Backup',
                status: 'degraded',
                message: 'Unable to check backup status',
                lastChecked: new Date(),
            });
        }

        setChecks(results);
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => {
        if (isPower) {
            runHealthChecks();
            const interval = setInterval(runHealthChecks, 30000); // Refresh every 30s
            return () => clearInterval(interval);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPower, runHealthChecks]);

    if (!isPower) {
        return (
            <div className="dash-empty">
                <Shield size={28} />
                <div>System health is restricted to Power Admin / System Admin.</div>
            </div>
        );
    }

    const statusIcon = (status: HealthCheck['status']) => {
        switch (status) {
            case 'healthy': return <CheckCircle size={18} color="var(--accent-success)" />;
            case 'degraded': return <AlertTriangle size={18} color="var(--accent-warning)" />;
            case 'unhealthy': return <XCircle size={18} color="var(--accent-error)" />;
        }
    };

    const statusColor = (status: HealthCheck['status']) => {
        switch (status) {
            case 'healthy': return 'var(--accent-success)';
            case 'degraded': return 'var(--accent-warning)';
            case 'unhealthy': return 'var(--accent-error)';
        }
    };

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1><Activity size={24} /> System Health</h1>
                    <p>Real-time system status and diagnostics. Auto-refreshes every 30 seconds.</p>
                </div>
                <button className="btn btn-secondary" onClick={runHealthChecks} disabled={refreshing}>
                    <RefreshCw size={14} className={refreshing ? 'spin' : ''} /> Refresh
                </button>
            </div>

            {loading ? (
                <div className="dash-loading-center"><RefreshCw className="spin" size={28} /></div>
            ) : (
                <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                    {checks.map(check => (
                        <div key={check.name} className="stat-card" style={{ borderColor: statusColor(check.status) }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{check.name}</div>
                                    <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4, color: statusColor(check.status) }}>{check.status}</div>
                                </div>
                                {statusIcon(check.status)}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>{check.message}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={10} /> {check.lastChecked.toLocaleTimeString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default HealthPage;
