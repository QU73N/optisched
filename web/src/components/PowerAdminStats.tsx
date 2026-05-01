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

    return (
        <div className="siderail-section">
            <h4>Power Admin Stats</h4>
            <div className="siderail-card">
                <div className="siderail-info-list">
                    <div className="siderail-info-item">
                        <Activity size={14} />
                        <span className="siderail-info-label">Active Sessions</span>
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
            </div>
        </div>
    );
};

export default PowerAdminStats;
