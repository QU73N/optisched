// SessionsPage - active session monitoring (Power + System Admin).
// Note: Supabase Auth doesn't expose session list to client; we infer
// active sessions from recent user_activity_logs (login + recent activity)
// and provide a force-logout button (calls auth.admin.signOut via RPC if available,
// otherwise revokes refresh tokens via a server-side function).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import { ROLE_DISPLAY_NAMES, type UserRole } from '../../types/database';
import {
    Server, Loader2, RefreshCw, Lock, User, Clock,
    AlertTriangle, CheckCircle, Activity, Globe, Shield,
    Search, X, Calendar, Zap, Eye
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
    ip_addresses: string[];
    session_duration: number;
    activity_intensity: 'low' | 'medium' | 'high';
}

const SessionsPage: React.FC = () => {
    const perms = usePermissions();
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<SessionRow[]>([]);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);
    const [timeRange, setTimeRange] = useState<number>(30); // minutes

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const since = new Date(Date.now() - timeRange * 60 * 1000).toISOString();
            const { data: acts } = await supabase
                .from('user_activity_logs')
                .select('user_id, action_type, created_at, ip_address')
                .gte('created_at', since);

            const map = new Map<string, { 
                last_login: string; 
                last_activity: string; 
                count: number; 
                ips: Set<string>;
            }>();
            
            (acts || []).forEach((r: { user_id: string; action_type: string; created_at: string; ip_address: string | null }) => {
                const cur = map.get(r.user_id) || { 
                    last_login: '', 
                    last_activity: '', 
                    count: 0, 
                    ips: new Set<string>()
                };
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

            const now = new Date();
            const list: SessionRow[] = (profiles || []).map((p: { id: string; full_name: string; email: string; role: string }) => {
                const m = map.get(p.id)!;
                const lastLogin = m.last_login ? new Date(m.last_login) : null;
                const duration = lastLogin ? Math.floor((now.getTime() - lastLogin.getTime()) / 1000 / 60) : 0;
                
                // Calculate activity intensity based on event count and duration
                const eventsPerMinute = duration > 0 ? m.count / duration : m.count;
                let intensity: 'low' | 'medium' | 'high' = 'low';
                if (eventsPerMinute > 2) intensity = 'high';
                else if (eventsPerMinute > 0.5) intensity = 'medium';

                return {
                    user_id: p.id,
                    full_name: p.full_name,
                    email: p.email,
                    role: p.role,
                    last_login: m.last_login,
                    last_activity: m.last_activity,
                    activity_count: m.count,
                    suspicious: m.ips.size > 1,
                    ip_addresses: Array.from(m.ips),
                    session_duration: duration,
                    activity_intensity: intensity,
                };
            }).sort((a, b) => b.last_activity.localeCompare(a.last_activity));

            setRows(list);
        } catch (err) {
            console.error('[Sessions] load failed', err);
        } finally {
            setLoading(false);
        }
    }, [timeRange]);

    useEffect(() => { if (perms.isSystemAdmin) load(); }, [perms.isSystemAdmin, load]);

    // Auto-refresh
    useEffect(() => {
        if (!autoRefresh || !perms.isSystemAdmin) return;
        const interval = setInterval(load, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, [autoRefresh, perms.isSystemAdmin, load]);

    const stats = useMemo(() => ({
        active: rows.length,
        suspicious: rows.filter(r => r.suspicious).length,
        highActivity: rows.filter(r => r.activity_intensity === 'high').length,
        avgDuration: rows.length > 0 ? Math.round(rows.reduce((sum, r) => sum + r.session_duration, 0) / rows.length) : 0,
        roleDistribution: rows.reduce((acc, r) => {
            acc[r.role] = (acc[r.role] || 0) + 1;
            return acc;
        }, {} as Record<string, number>),
    }), [rows]);

    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            const matchesSearch = searchQuery === '' || 
                r.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                r.email.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesRole = roleFilter === 'all' || r.role === roleFilter;
            const matchesStatus = statusFilter === 'all' || 
                (statusFilter === 'suspicious' && r.suspicious) ||
                (statusFilter === 'normal' && !r.suspicious);
            return matchesSearch && matchesRole && matchesStatus;
        });
    }, [rows, searchQuery, roleFilter, statusFilter]);

    const uniqueRoles = useMemo(() => {
        return Array.from(new Set(rows.map(r => r.role)));
    }, [rows]);

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
                    Real-time session monitoring. Users with activity in the last {timeRange} minutes.
                </p>
            </div>

            {/* Enhanced Stats Grid */}
            <div className="stats-grid" style={{ marginBottom: 16 }}>
                <div className="stat-card">
                    <div className="stat-icon"><Activity size={20} /></div>
                    <div className="stat-number">{stats.active}</div>
                    <div className="stat-label">Active Sessions</div>
                </div>
                <div className={`stat-card ${stats.suspicious > 0 ? 'stat-warning' : ''}`}>
                    <div className="stat-icon"><Shield size={20} /></div>
                    <div className="stat-number">{stats.suspicious}</div>
                    <div className="stat-label">Suspicious (multi-IP)</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><Zap size={20} /></div>
                    <div className="stat-number">{stats.highActivity}</div>
                    <div className="stat-label">High Activity</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><Clock size={20} /></div>
                    <div className="stat-number">{stats.avgDuration}m</div>
                    <div className="stat-label">Avg Duration</div>
                </div>
            </div>

            {/* Role Distribution */}
            {Object.keys(stats.roleDistribution).length > 0 && (
                <div className="card" style={{ marginBottom: 16, padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <User size={16} style={{ color: 'var(--accent-primary)' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Role Distribution
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {Object.entries(stats.roleDistribution).map(([role, count]) => (
                            <div 
                                key={role}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '6px 12px',
                                    background: 'var(--bg-surface)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '12px'
                                }}
                            >
                                <code style={{ fontSize: '11px' }}>{ROLE_DISPLAY_NAMES[role as UserRole] || role}</code>
                                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="audit-toolbar">
                <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px 8px 32px',
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-default)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-primary)',
                                fontSize: '13px'
                            }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                style={{
                                    position: 'absolute',
                                    right: 8,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: 2
                                }}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
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
                        <option value="all">All Roles</option>
                        {uniqueRoles.map(role => (
                            <option key={role} value={role}>{ROLE_DISPLAY_NAMES[role as UserRole] || role}</option>
                        ))}
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
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
                        <option value="all">All Status</option>
                        <option value="normal">Normal</option>
                        <option value="suspicious">Suspicious</option>
                    </select>

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
                        <option value="15">Last 15 min</option>
                        <option value="30">Last 30 min</option>
                        <option value="60">Last 1 hour</option>
                        <option value="120">Last 2 hours</option>
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
                    <button className="btn btn-secondary" onClick={load}><RefreshCw size={14} /> Refresh</button>
                </div>
            </div>

            {loading ? (
                <div className="dash-loading-center"><Loader2 className="spin" size={28} /></div>
            ) : filteredRows.length === 0 ? (
                <div className="dash-empty">
                    <Server size={28} />
                    <div>
                        {searchQuery || roleFilter !== 'all' || statusFilter !== 'all' 
                            ? 'No sessions match your filters.' 
                            : `No active sessions in the last ${timeRange} minutes.`}
                    </div>
                </div>
            ) : (
                <div className="audit-table-wrap">
                    <table className="audit-table">
                        <thead>
                            <tr>
                                <th><User size={11} /> User</th>
                                <th>Role</th>
                                <th><Clock size={11} /> Session Duration</th>
                                <th>Last Activity</th>
                                <th>Events</th>
                                <th>Intensity</th>
                                <th>IPs</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.map(r => (
                                <tr key={r.user_id} className="audit-row">
                                    <td>
                                        <div className="audit-actor">
                                            <span className="audit-actor-name">{r.full_name}</span>
                                            <span className="audit-actor-role">{r.email}</span>
                                        </div>
                                    </td>
                                    <td><code className="audit-target">{ROLE_DISPLAY_NAMES[r.role as UserRole] || r.role}</code></td>
                                    <td className="audit-time">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                                            {r.session_duration > 60 
                                                ? `${Math.floor(r.session_duration / 60)}h ${r.session_duration % 60}m`
                                                : `${r.session_duration}m`}
                                        </div>
                                    </td>
                                    <td className="audit-time">{new Date(r.last_activity).toLocaleString()}</td>
                                    <td>{r.activity_count}</td>
                                    <td>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            padding: '2px 8px',
                                            borderRadius: 'var(--radius-sm)',
                                            fontSize: '11px',
                                            fontWeight: 500,
                                            background: r.activity_intensity === 'high' 
                                                ? 'var(--accent-error-subtle)' 
                                                : r.activity_intensity === 'medium'
                                                ? 'var(--accent-warning-subtle)'
                                                : 'var(--accent-success-subtle)',
                                            color: r.activity_intensity === 'high'
                                                ? 'var(--accent-error)'
                                                : r.activity_intensity === 'medium'
                                                ? 'var(--accent-warning)'
                                                : 'var(--accent-success)'
                                        }}>
                                            {r.activity_intensity === 'high' && <Zap size={10} />}
                                            {r.activity_intensity}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Globe size={12} style={{ color: 'var(--text-muted)' }} />
                                            <span style={{ fontSize: '12px' }}>{r.ip_addresses.length}</span>
                                        </div>
                                    </td>
                                    <td>
                                        {r.suspicious
                                            ? <span className="activity-action-failure" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={12} /> multi-IP</span>
                                            : <span className="activity-action-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} /> ok</span>}
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => setSelectedSession(r)}
                                            className="btn btn-ghost btn-xs"
                                            title="View details"
                                        >
                                            <Eye size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Session Detail Modal */}
            {selectedSession && (
                <div className="modal-overlay" onClick={() => setSelectedSession(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Session Details</h3>
                            <button 
                                onClick={() => setSelectedSession(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600, color: 'white' }}>
                                    {selectedSession.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                </div>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedSession.full_name}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selectedSession.email}</div>
                                    <code style={{ fontSize: 11, background: 'var(--bg-inset)', padding: '2px 6px', borderRadius: 'var(--radius-xs)' }}>{ROLE_DISPLAY_NAMES[selectedSession.role as UserRole] || selectedSession.role}</code>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Session Duration</div>
                                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {selectedSession.session_duration > 60 
                                            ? `${Math.floor(selectedSession.session_duration / 60)}h ${selectedSession.session_duration % 60}m`
                                            : `${selectedSession.session_duration}m`}
                                    </div>
                                </div>
                                <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Activity Count</div>
                                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedSession.activity_count}</div>
                                </div>
                                <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Activity Intensity</div>
                                    <div style={{ fontSize: 16, fontWeight: 600, color: selectedSession.activity_intensity === 'high' ? 'var(--accent-error)' : selectedSession.activity_intensity === 'medium' ? 'var(--accent-warning)' : 'var(--accent-success)' }}>
                                        {selectedSession.activity_intensity}
                                    </div>
                                </div>
                                <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>IP Addresses</div>
                                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedSession.ip_addresses.length}</div>
                                </div>
                            </div>

                            <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>IP Address History</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {selectedSession.ip_addresses.map((ip, idx) => (
                                        <div 
                                            key={idx}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                padding: '4px 8px',
                                                background: selectedSession.ip_addresses.length > 1 ? 'var(--accent-error-subtle)' : 'var(--accent-success-subtle)',
                                                border: `1px solid ${selectedSession.ip_addresses.length > 1 ? 'var(--accent-error)' : 'var(--accent-success)'}`,
                                                borderRadius: 'var(--radius-sm)',
                                                fontSize: '12px',
                                                color: selectedSession.ip_addresses.length > 1 ? 'var(--accent-error)' : 'var(--accent-success)'
                                            }}
                                        >
                                            <Globe size={12} />
                                            {ip}
                                        </div>
                                    ))}
                                </div>
                                {selectedSession.ip_addresses.length > 1 && (
                                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--accent-error)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <AlertTriangle size={12} />
                                        Multiple IP addresses detected - possible session hijacking or VPN usage
                                    </div>
                                )}
                            </div>

                            <div style={{ padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Timeline</div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <Calendar size={12} />
                                        <span>Last Login: {selectedSession.last_login ? new Date(selectedSession.last_login).toLocaleString() : 'N/A'}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Clock size={12} />
                                        <span>Last Activity: {new Date(selectedSession.last_activity).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SessionsPage;
