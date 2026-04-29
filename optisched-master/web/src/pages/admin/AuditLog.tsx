import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { History, Search, Filter, ChevronDown, ChevronUp, Clock, User, FileText } from 'lucide-react';
import '../admin/Dashboard.css';

interface AuditEntry {
    id: string;
    action: string;
    entity_type: string;
    entity_name: string;
    performed_by: string;
    details: string;
    created_at: string;
}

const AuditLog: React.FC = () => {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [scheduleHistory, setScheduleHistory] = useState<any[]>([]);

    useEffect(() => { fetchAuditData(); }, []);

    const fetchAuditData = async () => {
        setLoading(true);

        // Build audit entries from schedule changes and other tracked actions
        const [schedRes, userRes] = await Promise.all([
            supabase.from('schedules').select('id, created_at, updated_at, day_of_week, start_time, end_time, subject:subjects(name, code), teacher:teachers(profile:profiles(full_name)), room:rooms(name), section:sections(name)').order('updated_at', { ascending: false }).limit(100),
            supabase.from('profiles').select('id, full_name, role, created_at').order('created_at', { ascending: false }).limit(50),
        ]);

        const auditEntries: AuditEntry[] = [];

        // Schedule entries
        (schedRes.data || []).forEach((s: any) => {
            auditEntries.push({
                id: `sched-${s.id}`,
                action: s.created_at === s.updated_at ? 'Created' : 'Updated',
                entity_type: 'schedule',
                entity_name: `${s.subject?.code || ''} - ${s.subject?.name || 'Schedule'} (${s.day_of_week})`,
                performed_by: s.teacher?.profile?.full_name || 'System',
                details: `${s.day_of_week} ${s.start_time?.slice(0, 5)} - ${s.end_time?.slice(0, 5)} | Room: ${s.room?.name || 'TBA'} | Section: ${s.section?.name || '-'} | Teacher: ${s.teacher?.profile?.full_name || 'TBA'}`,
                created_at: s.updated_at || s.created_at,
            });
        });

        // User creation entries
        (userRes.data || []).forEach((u: any) => {
            auditEntries.push({
                id: `user-${u.id}`,
                action: 'Created',
                entity_type: 'user',
                entity_name: u.full_name || 'Unknown',
                performed_by: 'Admin',
                details: `Role: ${u.role} | Account created`,
                created_at: u.created_at,
            });
        });

        // Sort by date descending
        auditEntries.sort((a, b) => b.created_at.localeCompare(a.created_at));

        setEntries(auditEntries);
        setScheduleHistory(schedRes.data || []);
        setLoading(false);
    };

    const filtered = entries.filter(e => {
        const matchSearch = search === '' ||
            e.entity_name.toLowerCase().includes(search.toLowerCase()) ||
            e.performed_by.toLowerCase().includes(search.toLowerCase()) ||
            e.details.toLowerCase().includes(search.toLowerCase());
        const matchType = filterType === 'all' || e.entity_type === filterType;
        return matchSearch && matchType;
    });

    const getActionColor = (action: string) => {
        switch (action) {
            case 'Created': return { bg: 'rgba(34, 197, 94, 0.12)', text: '#34d399' };
            case 'Updated': return { bg: 'rgba(59, 130, 246, 0.12)', text: '#60a5fa' };
            case 'Deleted': return { bg: 'rgba(239, 68, 68, 0.12)', text: '#ef4444' };
            default: return { bg: 'rgba(148, 163, 184, 0.12)', text: '#94a3b8' };
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'schedule': return <Clock size={16} />;
            case 'user': return <User size={16} />;
            default: return <FileText size={16} />;
        }
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    };

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Audit & History</h1>
                    <p className="dashboard-subtitle">{entries.length} tracked changes</p>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-icon"><History size={20} /></div>
                    <div className="stat-number">{entries.length}</div>
                    <div className="stat-label">Total Events</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><Clock size={20} /></div>
                    <div className="stat-number">{entries.filter(e => e.entity_type === 'schedule').length}</div>
                    <div className="stat-label">Schedule Changes</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><User size={20} /></div>
                    <div className="stat-number">{entries.filter(e => e.entity_type === 'user').length}</div>
                    <div className="stat-label">User Events</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><FileText size={20} /></div>
                    <div className="stat-number">{scheduleHistory.length}</div>
                    <div className="stat-label">Schedule Versions</div>
                </div>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input className="input" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, user, or details..."
                        style={{ paddingLeft: 36, width: '100%' }} />
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                    {['all', 'schedule', 'user'].map(t => (
                        <button key={t}
                            className={`btn ${filterType === t ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ fontSize: 12, padding: '6px 12px' }}
                            onClick={() => setFilterType(t)}>
                            <Filter size={12} /> {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1) + 's'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Timeline */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : filtered.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 60 }}>
                    <History size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-muted)' }}>No audit entries found</p>
                </div>
            ) : (
                <div style={{ position: 'relative' }}>
                    {/* Timeline line */}
                    <div style={{ position: 'absolute', left: 19, top: 0, bottom: 0, width: 2, background: 'var(--border-default)' }} />

                    {filtered.map((entry) => {
                        const actionColor = getActionColor(entry.action);
                        const isExpanded = expandedId === entry.id;
                        return (
                            <div key={entry.id} style={{ display: 'flex', gap: 16, marginBottom: 4, position: 'relative' }}>
                                {/* Timeline dot */}
                                <div style={{
                                    width: 40, display: 'flex', justifyContent: 'center', flexShrink: 0, paddingTop: 16, zIndex: 1,
                                }}>
                                    <div style={{
                                        width: 10, height: 10, borderRadius: '50%',
                                        background: actionColor.text, border: '2px solid var(--bg-primary)',
                                    }} />
                                </div>

                                {/* Entry card */}
                                <div className="card" style={{
                                    flex: 1, cursor: 'pointer', transition: 'all 150ms ease',
                                    borderLeft: `3px solid ${actionColor.text}`,
                                }}
                                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                            <span style={{ color: actionColor.text }}>{getTypeIcon(entry.entity_type)}</span>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{
                                                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                                        padding: '2px 8px', borderRadius: 4,
                                                        background: actionColor.bg, color: actionColor.text,
                                                    }}>{entry.action}</span>
                                                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{entry.entity_name}</span>
                                                </div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                                    by {entry.performed_by} · {formatDate(entry.created_at)}
                                                </div>
                                            </div>
                                        </div>
                                        {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                                    </div>
                                    {isExpanded && (
                                        <div style={{
                                            marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                                            background: 'var(--bg-secondary)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
                                        }}>
                                            {entry.details}
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
                                                Full timestamp: {new Date(entry.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AuditLog;
