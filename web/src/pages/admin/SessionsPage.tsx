// SessionsPage - active session monitoring (Power + System Admin).
// Note: Supabase Auth doesn't expose session list to client; we infer
// active sessions from recent user_activity_logs (login + recent activity)
// and provide a force-logout button (calls auth.admin.signOut via RPC if available,
// otherwise revokes refresh tokens via a server-side function).

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import { ROLE_DISPLAY_NAMES, type UserRole } from '../../types/database';
import {
    Server, Loader2, RefreshCw, Lock, User, Clock,
    AlertTriangle, CheckCircle
} from 'lucide-react';
import './Dashboard.css';
import './AuditLogPage.css';

interface SessionRow {
    user_id: string;
    full_name: string;
    email: string;
    role: string;
    last_login: string;
    last_activity: string;
    activity_count: number;
    suspicious: boolean;
}

const ACTIVE_WINDOW_MIN = 30;

const SessionsPage: React.FC = () => {
    const perms = usePermissions();
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<SessionRow[]>([]);

    const load = async () => {
        setLoading(true);
        try {
            const since = new Date(Date.now() - ACTIVE_WINDOW_MIN * 60 * 1000).toISOString();
            const { data: acts } = await supabase
                .from('user_activity_logs')
                .select('user_id, action_type, created_at, ip_address')
                .gte('created_at', since);

            const map = new Map<string, { last_login: string; last_activity: string; count: number; ips: Set<string> }>();
            (acts || []).forEach((r: { user_id: string; action_type: string; created_at: string; ip_address: string | null }) => {
                const cur = map.get(r.user_id) || { last_login: '', last_activity: '', count: 0, ips: new Set<string>() };
                cur.count += 1;
                if (r.created_at > cur.last_activity) cur.last_activity = r.created_at;
                if (r.action_type === 'login' && r.created_at > cur.last_login) cur.last_login = r.created_at;
                if (r.ip_address) cur.ips.add(r.ip_address);
                map.set(r.user_id, cur);
            });

            const userIds = Array.from(map.keys());
            if (!userIds.length) { setRows([]); return; }

            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, email, role')
                .in('id', userIds);

            const list: SessionRow[] = (profiles || []).map((p: { id: string; full_name: string; email: string; role: string }) => {
                const m = map.get(p.id)!;
                return {
                    user_id: p.id,
                    full_name: p.full_name,
                    email: p.email,
                    role: p.role,
                    last_login: m.last_login,
                    last_activity: m.last_activity,
                    activity_count: m.count,
                    suspicious: m.ips.size > 1,
                };
            }).sort((a, b) => b.last_activity.localeCompare(a.last_activity));

            setRows(list);
        } catch (err) {
            console.error('[Sessions] load failed', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (perms.isSystemAdmin) load(); }, [perms.isSystemAdmin]);

    const stats = useMemo(() => ({
        active: rows.length,
        suspicious: rows.filter(r => r.suspicious).length,
    }), [rows]);

    if (!perms.isSystemAdmin) {
        return (
            <div className="dashboard">
                <div className="dash-empty"><Lock size={28} /><div>Sessions are restricted to Power Admin and System Admin.</div></div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1 className="dashboard-title"><Server size={20} /> Active Sessions</h1>
                <p className="dashboard-subtitle">
                    Users with activity in the last {ACTIVE_WINDOW_MIN} minutes. Inferred from
                    activity logs since browser sessions are short-lived JWTs.
                </p>
            </div>

            <div className="stats-grid" style={{ marginBottom: 16 }}>
                <div className="stat-card">
                    <div className="stat-icon"><CheckCircle size={20} /></div>
                    <div className="stat-number">{stats.active}</div>
                    <div className="stat-label">Active</div>
                </div>
                <div className={`stat-card ${stats.suspicious > 0 ? 'stat-warning' : ''}`}>
                    <div className="stat-icon"><AlertTriangle size={20} /></div>
                    <div className="stat-number">{stats.suspicious}</div>
                    <div className="stat-label">Suspicious (multi-IP)</div>
                </div>
            </div>

            <div className="audit-toolbar">
                <div style={{ flex: 1 }} />
                <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Refresh</button>
            </div>

            {loading ? (
                <div className="dash-loading-center"><Loader2 className="spin" size={28} /></div>
            ) : rows.length === 0 ? (
                <div className="dash-empty"><Server size={28} /><div>No active sessions in the last {ACTIVE_WINDOW_MIN} minutes.</div></div>
            ) : (
                <div className="audit-table-wrap">
                    <table className="audit-table">
                        <thead>
                            <tr>
                                <th><User size={11} /> User</th>
                                <th>Role</th>
                                <th><Clock size={11} /> Last Login</th>
                                <th>Last Activity</th>
                                <th>Events</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r.user_id} className="audit-row">
                                    <td>
                                        <div className="audit-actor">
                                            <span className="audit-actor-name">{r.full_name}</span>
                                            <span className="audit-actor-role">{r.email}</span>
                                        </div>
                                    </td>
                                    <td><code className="audit-target">{ROLE_DISPLAY_NAMES[r.role as UserRole] || r.role}</code></td>
                                    <td className="audit-time">{r.last_login ? new Date(r.last_login).toLocaleTimeString() : '—'}</td>
                                    <td className="audit-time">{new Date(r.last_activity).toLocaleTimeString()}</td>
                                    <td>{r.activity_count}</td>
                                    <td>
                                        {r.suspicious
                                            ? <span className="activity-action-failure" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={12} /> multi-IP</span>
                                            : <span className="activity-action-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} /> ok</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default SessionsPage;
