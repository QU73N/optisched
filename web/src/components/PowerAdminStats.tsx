import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { hasAnyRole } from '../types/database';
import { POWER_ADMIN_ROLES } from '../types/database';
import { Activity, XCircle, FileSearch, Inbox, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

const PowerAdminStats: React.FC = () => {
    const { roles } = useAuth();
    const isPowerAdmin = hasAnyRole(roles, POWER_ADMIN_ROLES);

    const [loading, setLoading] = useState(true);
    const [activeSessions, setActiveSessions] = useState(0);
    const [failedLogins24h, setFailedLogins24h] = useState(0);
    const [auditEvents24h, setAuditEvents24h] = useState(0);
    const [pendingApprovalsSystem, setPendingApprovalsSystem] = useState(0);
    const [criticalConflicts, setCriticalConflicts] = useState(0);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        if (!isPowerAdmin) return;

        try {
            setError(null);
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

            const [activeSessionsData, failedLoginsData, auditEventsData, pendingApprovalsData, criticalConflictsData] = await Promise.all([
                supabase.from('user_activity_logs').select('*', { count: 'exact', head: true }).gte('created_at', twentyFourHoursAgo),
                supabase.from('user_activity_logs').select('*', { count: 'exact', head: true }).eq('success', false).gte('created_at', twentyFourHoursAgo),
                supabase.from('audit_logs').select('*', { count: 'exact', head: true }).gte('created_at', twentyFourHoursAgo),
                supabase.from('schedules').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
                supabase.from('conflicts').select('*', { count: 'exact', head: true }).eq('is_resolved', false).eq('severity', 'critical'),
            ]);

            setActiveSessions(activeSessionsData.count || 0);
            setFailedLogins24h(failedLoginsData.count || 0);
            setAuditEvents24h(auditEventsData.count || 0);
            setPendingApprovalsSystem(pendingApprovalsData.count || 0);
            setCriticalConflicts(criticalConflictsData.count || 0);
            setLastUpdated(new Date().toLocaleTimeString());
        } catch (error) {
            console.error('[PowerAdminStats] fetch error:', error);
            setError('Failed to load stats');
        } finally {
            setLoading(false);
        }
    }, [isPowerAdmin]);

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            if (!isPowerAdmin) {
                setLoading(false);
                return;
            }
            await fetchStats();
        };
        fetchData();

        // Refresh every 5 minutes
        const interval = setInterval(() => {
            if (isMounted && isPowerAdmin) {
                fetchStats();
            }
        }, 5 * 60 * 1000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [isPowerAdmin, fetchStats]);

    if (!isPowerAdmin) return null;

    if (loading) {
        return (
            <div className="siderail-section">
                <h4>Power Admin Stats</h4>
                <div className="siderail-chart-placeholder">
                    <Loader2 className="spin" size={20} />
                </div>
            </div>
        );
    }

    return (
        <div className="siderail-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4>Power Admin Stats</h4>
                <button
                    onClick={fetchStats}
                    disabled={loading}
                    style={{ background: 'none', border: 'none', padding: 4, cursor: loading ? 'not-allowed' : 'pointer', color: 'var(--text-muted)' }}
                    title="Refresh stats"
                >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} />
                </button>
            </div>
            {error && (
                <div style={{ fontSize: 11, color: 'var(--accent-error)', marginBottom: 8, padding: 4, background: 'var(--accent-error-subtle)', borderRadius: 4 }}>
                    {error}
                </div>
            )}
            <div className="siderail-card">
                <div className="siderail-info-list">
                    <div className="siderail-info-item">
                        <Activity size={14} />
                        <span className="siderail-info-label">Active Sessions (24h)</span>
                        <span className="siderail-info-value">{activeSessions}</span>
                    </div>
                    <div className="siderail-info-item">
                        <XCircle size={14} />
                        <span className="siderail-info-label">Failed Logins (24h)</span>
                        <span className={`siderail-info-value ${failedLogins24h > 0 ? 'siderail-info-warning' : ''}`}>{failedLogins24h}</span>
                    </div>
                    <div className="siderail-info-item">
                        <FileSearch size={14} />
                        <span className="siderail-info-label">Audit Events (24h)</span>
                        <span className="siderail-info-value">{auditEvents24h}</span>
                    </div>
                    <div className="siderail-info-item">
                        <Inbox size={14} />
                        <span className="siderail-info-label">Pending Approvals</span>
                        <span className={`siderail-info-value ${pendingApprovalsSystem > 0 ? 'siderail-info-warning' : ''}`}>{pendingApprovalsSystem}</span>
                    </div>
                    <div className="siderail-info-item">
                        <AlertTriangle size={14} />
                        <span className="siderail-info-label">Critical Conflicts</span>
                        <span className={`siderail-info-value ${criticalConflicts > 0 ? 'siderail-info-warning' : ''}`}>{criticalConflicts}</span>
                    </div>
                </div>
                {lastUpdated && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                        Updated {lastUpdated}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PowerAdminStats;
