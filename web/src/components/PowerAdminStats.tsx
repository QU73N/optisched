import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { hasAnyRole } from '../types/database';
import { POWER_ADMIN_ROLES } from '../types/database';
import { Activity, XCircle, FileSearch, Inbox, AlertTriangle, Loader2 } from 'lucide-react';

const PowerAdminStats: React.FC = () => {
    const { roles } = useAuth();
    const isPowerAdmin = hasAnyRole(roles, POWER_ADMIN_ROLES);

    const [loading, setLoading] = useState(true);
    const [activeSessions, setActiveSessions] = useState(0);
    const [failedLogins24h, setFailedLogins24h] = useState(0);
    const [auditEvents24h, setAuditEvents24h] = useState(0);
    const [pendingApprovalsSystem, setPendingApprovalsSystem] = useState(0);
    const [criticalConflicts, setCriticalConflicts] = useState(0);

    useEffect(() => {
        if (!isPowerAdmin) {
            setLoading(false);
            return;
        }

        const fetchStats = async () => {
            try {
                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                const [activeSessionsData, failedLoginsData, auditEventsData, pendingApprovalsData, criticalConflictsData] = await Promise.all([
                    supabase.from('user_activity_logs').select('session_id', { count: 'exact', head: true }).gte('created_at', twentyFourHoursAgo),
                    supabase.from('user_activity_logs').select('id', { count: 'exact' }).eq('success', false).gte('created_at', twentyFourHoursAgo),
                    supabase.from('audit_logs').select('id', { count: 'exact' }).gte('created_at', twentyFourHoursAgo),
                    supabase.from('schedules').select('id', { count: 'exact' }).eq('status', 'submitted'),
                    supabase.from('conflicts').select('id', { count: 'exact' }).eq('is_resolved', false).eq('severity', 'critical'),
                ]);
                setActiveSessions(activeSessionsData.count || 0);
                setFailedLogins24h(failedLoginsData.count || 0);
                setAuditEvents24h(auditEventsData.count || 0);
                setPendingApprovalsSystem(pendingApprovalsData.count || 0);
                setCriticalConflicts(criticalConflictsData.count || 0);
            } catch (error) {
                console.error('[PowerAdminStats] fetch error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, [isPowerAdmin]);

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

    const stats = [
        { label: 'Active Sessions', value: activeSessions, icon: Activity, color: '#8b5cf6' },
        { label: 'Failed Logins (24h)', value: failedLogins24h, icon: XCircle, color: '#ef4444', warning: failedLogins24h > 0 },
        { label: 'Audit Events (24h)', value: auditEvents24h, icon: FileSearch, color: '#f97316' },
        { label: 'Pending Approvals', value: pendingApprovalsSystem, icon: Inbox, color: '#f59e0b', warning: pendingApprovalsSystem > 0 },
        { label: 'Critical Conflicts', value: criticalConflicts, icon: AlertTriangle, color: '#ef4444', warning: criticalConflicts > 0 },
    ];

    return (
        <div className="siderail-section">
            <h4>Power Admin Stats</h4>
            <div className="siderail-stats-grid">
                {stats.map((stat, index) => (
                    <div
                        key={index}
                        className={`siderail-stat ${stat.warning ? 'siderail-stat-warning' : ''}`}
                        style={{ borderColor: stat.warning ? stat.color : 'var(--border-default)' }}
                    >
                        <div className="siderail-stat-icon" style={{ color: stat.color }}>
                            <stat.icon size={16} />
                        </div>
                        <div className="siderail-stat-value">{stat.value}</div>
                        <div className="siderail-stat-label">{stat.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PowerAdminStats;
