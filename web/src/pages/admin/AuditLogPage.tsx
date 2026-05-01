// AuditLogPage - Power Admin only.
// Append-only privileged-action trail. Filter by actor, action, table, time.

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import {
    FileSearch, Loader2, Search, Lock, Download, RefreshCw,
    User, Calendar, Database
} from 'lucide-react';
import { toCsv, downloadCsv } from '../../utils/csv';
import './Dashboard.css';
import './AuditLogPage.css';

interface AuditRow {
    id: string;
    actor_id: string | null;
    actor_role: string | null;
    action: string;
    target_table: string | null;
    target_id: string | null;
    details: Record<string, unknown>;
    ip_address: string | null;
    created_at: string;
    actor?: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
}

const TIME_RANGES = [
    { label: '24h', ms: 24 * 60 * 60 * 1000 },
    { label: '7d',  ms: 7  * 24 * 60 * 60 * 1000 },
    { label: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
    { label: '90d', ms: 90 * 24 * 60 * 60 * 1000 },
    { label: 'All', ms: 0 },
];

const AuditLogPage: React.FC = () => {
    const perms = usePermissions();
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<AuditRow[]>([]);
    const [filter, setFilter] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    const [timeRange, setTimeRange] = useState(TIME_RANGES[2]); // 30d
    const [expanded, setExpanded] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            let q = supabase
                .from('audit_logs')
                .select('id, actor_id, actor_role, action, target_table, target_id, details, ip_address, created_at, actor:profiles!audit_logs_actor_id_fkey(full_name, email)')
                .order('created_at', { ascending: false })
                .limit(500);
            if (timeRange.ms > 0) {
                q = q.gte('created_at', new Date(Date.now() - timeRange.ms).toISOString());
            }
            const { data, error } = await q;
            if (error) throw error;
            setRows(((data || []) as unknown) as AuditRow[]);
        } catch (err) {
            console.error('[AuditLog] load failed', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (perms.isPowerAdmin) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [perms.isPowerAdmin, timeRange]);

    const actions = useMemo(() => {
        const set = new Set<string>(['all']);
        rows.forEach(r => set.add(r.action));
        return Array.from(set).sort();
    }, [rows]);

    const actorName = (a: AuditRow['actor']): string => {
        if (!a) return 'system';
        if (Array.isArray(a)) return a[0]?.full_name || 'system';
        return a.full_name || 'system';
    };

    const filtered = useMemo(() => {
        const q = filter.trim().toLowerCase();
        return rows.filter(r => {
            if (actionFilter !== 'all' && r.action !== actionFilter) return false;
            if (!q) return true;
            const blob = [
                r.action,
                r.target_table || '',
                r.actor_role || '',
                actorName(r.actor),
                JSON.stringify(r.details || {}),
            ].join(' ').toLowerCase();
            return blob.includes(q);
        });
    }, [rows, filter, actionFilter]);

    const exportCSV = () => {
        const csv = toCsv(
            ['created_at', 'actor', 'actor_role', 'action', 'target_table', 'target_id', 'details'],
            filtered.map(r => [
                r.created_at,
                actorName(r.actor),
                r.actor_role || '',
                r.action,
                r.target_table || '',
                r.target_id || '',
                JSON.stringify(r.details || {}),
            ]),
        );
        downloadCsv(`optisched-audit-${new Date().toISOString().slice(0, 10)}`, csv);
    };

    if (!perms.isPowerAdmin) {
        return (
            <div className="dashboard">
                <div className="dash-empty">
                    <Lock size={28} /><div>Audit Log is restricted to Power Admin only.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1 className="dashboard-title"><FileSearch size={20} /> Audit Log</h1>
                <p className="dashboard-subtitle">
                    Append-only trail of every privileged action. Retained {String(perms.ruleNumber('audit_log_retention_days', 730))} days.
                </p>
            </div>

            <div className="audit-toolbar">
                <div className="audit-search">
                    <Search size={14} />
                    <input
                        type="text"
                        placeholder="Filter by actor, action, table, details…"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                    />
                </div>
                <select className="input" value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ width: 200 }}>
                    {actions.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <div className="audit-time-range">
                    {TIME_RANGES.map(r => (
                        <button
                            key={r.label}
                            className={`audit-time-pill ${timeRange.label === r.label ? 'audit-time-pill-active' : ''}`}
                            onClick={() => setTimeRange(r)}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
                <button className="btn btn-secondary" onClick={load} title="Refresh">
                    <RefreshCw size={14} />
                </button>
                <button className="btn btn-secondary" onClick={exportCSV} title="Export filtered as CSV">
                    <Download size={14} /> Export
                </button>
            </div>

            {loading ? (
                <div className="dash-loading-center"><Loader2 className="spin" size={28} /></div>
            ) : filtered.length === 0 ? (
                <div className="dash-empty"><FileSearch size={28} /><div>No audit events match.</div></div>
            ) : (
                <div className="audit-table-wrap">
                    <table className="audit-table">
                        <thead>
                            <tr>
                                <th><Calendar size={11} /> When</th>
                                <th><User size={11} /> Actor</th>
                                <th>Action</th>
                                <th><Database size={11} /> Target</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(r => {
                                const open = expanded === r.id;
                                return (
                                    <React.Fragment key={r.id}>
                                        <tr className="audit-row" onClick={() => setExpanded(open ? null : r.id)}>
                                            <td className="audit-time">
                                                <span title={new Date(r.created_at).toLocaleString()}>
                                                    {new Date(r.created_at).toLocaleString()}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="audit-actor">
                                                    <span className="audit-actor-name">{actorName(r.actor)}</span>
                                                    {r.actor_role && (
                                                        <span className="audit-actor-role">{r.actor_role}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td><code className="audit-action">{r.action}</code></td>
                                            <td>
                                                {r.target_table ? <code className="audit-target">{r.target_table}{r.target_id ? `:${r.target_id.slice(0,8)}` : ''}</code> : '—'}
                                            </td>
                                            <td className="audit-details-preview">
                                                {Object.keys(r.details || {}).length > 0
                                                    ? `${Object.keys(r.details).length} field(s) — click to view`
                                                    : '—'}
                                            </td>
                                        </tr>
                                        {open && (
                                            <tr className="audit-row-detail">
                                                <td colSpan={5}>
                                                    <pre className="audit-json">{JSON.stringify(r.details, null, 2)}</pre>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AuditLogPage;
