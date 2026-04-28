// UserActivityPage - per-user troubleshooting trail.
// Visible to Power Admin and System Admin only (other roles can see their own via Settings).
// Restriction enforced by RLS on user_activity_logs.

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import { ROLE_DISPLAY_NAMES, type UserRole } from '../../types/database';
import {
    Activity, Loader2, Search, Lock, Download, RefreshCw,
    User, AlertCircle, Calendar, CheckCircle, XCircle, Filter
} from 'lucide-react';
import { toCsv, downloadCsv } from '../../utils/csv';
import './Dashboard.css';
import './AuditLogPage.css';

interface ProfileLite {
    id: string; full_name: string; email: string; role: string;
}
interface ActivityRow {
    id: number;
    user_id: string;
    action_type: string;
    resource: string | null;
    resource_id: string | null;
    details: Record<string, unknown>;
    success: boolean;
    error_message: string | null;
    duration_ms: number | null;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
}

const TIME_RANGES = [
    { label: '1h',  ms: 60 * 60 * 1000 },
    { label: '24h', ms: 24 * 60 * 60 * 1000 },
    { label: '7d',  ms: 7  * 24 * 60 * 60 * 1000 },
    { label: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
    { label: '90d', ms: 90 * 24 * 60 * 60 * 1000 },
];

const ACTION_COLORS: Record<string, string> = {
    login: 'activity-action-success',
    logout: 'activity-action-page',
    page_view: 'activity-action-page',
    mutation: 'activity-action-mutation',
    rls_denied: 'activity-action-failure',
    error: 'activity-action-failure',
    ai_prompt: 'activity-action-mutation',
};

const UserActivityPage: React.FC = () => {
    const perms = usePermissions();
    const [users, setUsers] = useState<ProfileLite[]>([]);
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [rows, setRows] = useState<ActivityRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    const [timeRange, setTimeRange] = useState(TIME_RANGES[1]); // 24h
    const [successFilter, setSuccessFilter] = useState<'all' | 'success' | 'failure'>('all');

    // Load eligible users (everyone System Admin can see)
    useEffect(() => {
        if (!perms.isSystemAdmin) return;
        (async () => {
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, email, role')
                .order('full_name');
            setUsers((data || []) as ProfileLite[]);
        })();
    }, [perms.isSystemAdmin]);

    const load = async () => {
        if (!selectedUser) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('user_activity_logs')
                .select('*')
                .eq('user_id', selectedUser)
                .gte('created_at', new Date(Date.now() - timeRange.ms).toISOString())
                .order('created_at', { ascending: false })
                .limit(1000);
            if (error) throw error;
            setRows((data || []) as ActivityRow[]);
        } catch (err) {
            console.error('[UserActivity] load failed', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (selectedUser) load(); }, [selectedUser, timeRange]); // eslint-disable-line react-hooks/exhaustive-deps

    const actions = useMemo(() => {
        const set = new Set<string>(['all']);
        rows.forEach(r => set.add(r.action_type));
        return Array.from(set);
    }, [rows]);

    const filtered = useMemo(() => {
        const q = filter.trim().toLowerCase();
        return rows.filter(r => {
            if (actionFilter !== 'all' && r.action_type !== actionFilter) return false;
            if (successFilter === 'success' && !r.success) return false;
            if (successFilter === 'failure' && r.success) return false;
            if (!q) return true;
            const blob = [r.action_type, r.resource || '', r.error_message || '', JSON.stringify(r.details || {})]
                .join(' ').toLowerCase();
            return blob.includes(q);
        });
    }, [rows, filter, actionFilter, successFilter]);

    const exportCSV = () => {
        const target = users.find(u => u.id === selectedUser);
        const slug = target?.email?.split('@')[0] || 'user';
        const csv = toCsv(
            ['created_at', 'action_type', 'resource', 'success', 'error', 'duration_ms', 'details'],
            filtered.map(r => [
                r.created_at,
                r.action_type,
                r.resource || '',
                String(r.success),
                r.error_message || '',
                r.duration_ms ?? '',
                JSON.stringify(r.details || {}),
            ]),
        );
        downloadCsv(`optisched-activity-${slug}-${new Date().toISOString().slice(0, 10)}`, csv);
    };

    const summary = useMemo(() => {
        const total = filtered.length;
        const successes = filtered.filter(r => r.success).length;
        const failures = total - successes;
        const lastActive = filtered[0]?.created_at;
        return { total, successes, failures, lastActive };
    }, [filtered]);

    if (!perms.isSystemAdmin) {
        return (
            <div className="dashboard">
                <div className="dash-empty"><Lock size={28} /><div>User Activity is restricted to Power Admin and System Admin.</div></div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1 className="dashboard-title"><Activity size={20} /> User Activity</h1>
                <p className="dashboard-subtitle">
                    Per-user troubleshooting trail. Retained {String(perms.ruleNumber('activity_log_retention_days', 90))} days.
                    Operational data only — no message content.
                </p>
            </div>

            {/* User picker */}
            <div className="activity-user-picker">
                <label htmlFor="activity-user-select"><User size={14} /> Show activity for</label>
                <select
                    id="activity-user-select"
                    className="input"
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    style={{ minWidth: 280 }}
                >
                    <option value="">Select a user…</option>
                    {users.map(u => (
                        <option key={u.id} value={u.id}>
                            {u.full_name} · {ROLE_DISPLAY_NAMES[u.role as UserRole] || u.role} · {u.email}
                        </option>
                    ))}
                </select>
                {selectedUser && (
                    <>
                        <div className="audit-time-range">
                            {TIME_RANGES.map(r => (
                                <button
                                    key={r.label}
                                    className={`audit-time-pill ${timeRange.label === r.label ? 'audit-time-pill-active' : ''}`}
                                    onClick={() => setTimeRange(r)}
                                >{r.label}</button>
                            ))}
                        </div>
                        <button className="btn btn-secondary" onClick={load} aria-label="Refresh activity log"><RefreshCw size={14} /></button>
                        <button className="btn btn-secondary" onClick={exportCSV}><Download size={14} /> Export</button>
                    </>
                )}
            </div>

            {!selectedUser ? (
                <div className="dash-empty"><Activity size={28} /><div>Select a user to view their activity.</div></div>
            ) : loading ? (
                <div className="dash-loading-center"><Loader2 className="spin" size={28} /></div>
            ) : (
                <>
                    {/* Summary */}
                    <div className="stats-grid" style={{ marginBottom: 16 }}>
                        <div className="stat-card">
                            <div className="stat-icon"><Activity size={20} /></div>
                            <div className="stat-number">{summary.total}</div>
                            <div className="stat-label">Events ({timeRange.label})</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon"><CheckCircle size={20} /></div>
                            <div className="stat-number">{summary.successes}</div>
                            <div className="stat-label">Success</div>
                        </div>
                        <div className={`stat-card ${summary.failures > 0 ? 'stat-warning' : ''}`}>
                            <div className="stat-icon"><XCircle size={20} /></div>
                            <div className="stat-number">{summary.failures}</div>
                            <div className="stat-label">Failures</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon"><Calendar size={20} /></div>
                            <div className="stat-number" style={{ fontSize: 14 }}>
                                {summary.lastActive ? new Date(summary.lastActive).toLocaleString() : '—'}
                            </div>
                            <div className="stat-label">Last Active</div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="audit-toolbar">
                        <div className="audit-search">
                            <Search size={14} />
                            <input type="text" placeholder="Search events…" value={filter} onChange={e => setFilter(e.target.value)} />
                        </div>
                        <select className="input" value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ width: 180 }}>
                            {actions.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <div className="audit-time-range">
                            <button className={`audit-time-pill ${successFilter === 'all' ? 'audit-time-pill-active' : ''}`} onClick={() => setSuccessFilter('all')}><Filter size={11} /> All</button>
                            <button className={`audit-time-pill ${successFilter === 'success' ? 'audit-time-pill-active' : ''}`} onClick={() => setSuccessFilter('success')}>OK</button>
                            <button className={`audit-time-pill ${successFilter === 'failure' ? 'audit-time-pill-active' : ''}`} onClick={() => setSuccessFilter('failure')}>Failed</button>
                        </div>
                    </div>

                    {/* Table */}
                    {filtered.length === 0 ? (
                        <div className="dash-empty"><AlertCircle size={28} /><div>No events match these filters.</div></div>
                    ) : (
                        <div className="audit-table-wrap">
                            <table className="audit-table">
                                <thead>
                                    <tr>
                                        <th>When</th>
                                        <th>Action</th>
                                        <th>Resource</th>
                                        <th>Result</th>
                                        <th>Duration</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(r => (
                                        <tr key={r.id} className="audit-row">
                                            <td className="audit-time">{new Date(r.created_at).toLocaleString()}</td>
                                            <td><code className={`audit-action ${ACTION_COLORS[r.action_type] || ''}`}>{r.action_type}</code></td>
                                            <td><code className="audit-target">{r.resource || '—'}</code></td>
                                            <td>
                                                {r.success
                                                    ? <span className="activity-action-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} /> ok</span>
                                                    : <span className="activity-action-failure" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><XCircle size={12} /> {r.error_message || 'failed'}</span>}
                                            </td>
                                            <td className="audit-time">{r.duration_ms != null ? `${r.duration_ms}ms` : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default UserActivityPage;
