// ApprovalsPage - Schedule Admin / Power Admin approval queue.
// Lists schedules with status='submitted' and lets approvers approve, reject,
// or request changes. Inline preview of conflicts attached to each schedule.

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { logAudit } from '../../hooks/useActivityLogger';
import {
    CheckCircle, XCircle, Clock, AlertTriangle, Loader2, Lock,
    Inbox, MessageSquare, RefreshCw, Filter
} from 'lucide-react';
import './Dashboard.css';

interface SubmittedSchedule {
    id: string;
    submitted_at: string | null;
    created_by: string | null;
    section_id: string | null;
    semester: string;
    academic_year: string;
    section?: { name: string } | { name: string }[] | null;
    creator?: { full_name: string } | { full_name: string }[] | null;
}
interface ConflictLite { id: string; type: string; severity: string; title: string; }

const ApprovalsPage: React.FC = () => {
    const { profile } = useAuth();
    const perms = usePermissions();
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState<string | null>(null);
    const [items, setItems] = useState<SubmittedSchedule[]>([]);
    const [conflictsBySched, setConflictsBySched] = useState<Record<string, ConflictLite[]>>({});
    const [filter, setFilter] = useState<'all' | 'with-conflicts' | 'no-conflicts'>('all');
    const [showRejectFor, setShowRejectFor] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('schedules')
                .select('id, submitted_at, created_by, section_id, semester, academic_year, section:sections(name), creator:profiles!schedules_created_by_fkey(full_name)')
                .eq('status', 'submitted')
                .order('submitted_at', { ascending: true });
            const list = ((data || []) as unknown) as SubmittedSchedule[];
            setItems(list);

            if (list.length) {
                const ids = list.map(s => s.id);
                const { data: confs } = await supabase
                    .from('conflicts')
                    .select('id, type, severity, title, schedule_a_id')
                    .eq('is_resolved', false)
                    .in('schedule_a_id', ids);
                const map: Record<string, ConflictLite[]> = {};
                (confs || []).forEach((c: { schedule_a_id: string; id: string; type: string; severity: string; title: string }) => {
                    const key = c.schedule_a_id;
                    if (!map[key]) map[key] = [];
                    map[key].push({ id: c.id, type: c.type, severity: c.severity, title: c.title });
                });
                setConflictsBySched(map);
            }
        } catch (err) {
            console.error('[Approvals] load failed', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (perms.canApproveSchedules) load(); }, [perms.canApproveSchedules]);

    const sectionName = (s: SubmittedSchedule['section']): string => {
        if (!s) return 'Schedule';
        if (Array.isArray(s)) return s[0]?.name || 'Schedule';
        return s.name;
    };
    const creatorName = (s: SubmittedSchedule['creator']): string => {
        if (!s) return 'Unknown';
        if (Array.isArray(s)) return s[0]?.full_name || 'Unknown';
        return s.full_name;
    };

    const filtered = useMemo(() => {
        return items.filter(i => {
            const has = (conflictsBySched[i.id] || []).length > 0;
            if (filter === 'with-conflicts') return has;
            if (filter === 'no-conflicts') return !has;
            return true;
        });
    }, [items, conflictsBySched, filter]);

    const approve = async (id: string) => {
        setActing(id);
        try {
            const { error } = await supabase
                .from('schedules')
                .update({
                    status: 'published',
                    approved_by: profile?.id,
                    approved_at: new Date().toISOString(),
                })
                .eq('id', id);
            if (error) throw error;
            await logAudit('schedule.approve', 'schedules', id);
            setItems(prev => prev.filter(i => i.id !== id));
        } catch (err) {
            console.error('[Approvals] approve failed', err);
            alert('Failed to approve. Check console.');
        } finally {
            setActing(null);
        }
    };

    const reject = async (id: string) => {
        if (!rejectReason.trim()) {
            alert('Please provide a rejection reason.');
            return;
        }
        setActing(id);
        try {
            const { error } = await supabase
                .from('schedules')
                .update({
                    status: 'rejected',
                    rejection_reason: rejectReason.trim(),
                })
                .eq('id', id);
            if (error) throw error;
            await logAudit('schedule.reject', 'schedules', id, { reason: rejectReason.trim() });
            setItems(prev => prev.filter(i => i.id !== id));
            setShowRejectFor(null);
            setRejectReason('');
        } catch (err) {
            console.error('[Approvals] reject failed', err);
            alert('Failed to reject. Check console.');
        } finally {
            setActing(null);
        }
    };

    if (!perms.canApproveSchedules) {
        return (
            <div className="dashboard">
                <div className="dash-empty"><Lock size={28} /><div>Approvals are restricted to Schedule Admin and Power Admin.</div></div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1 className="dashboard-title"><CheckCircle size={20} /> Approvals</h1>
                <p className="dashboard-subtitle">
                    Review submitted schedules. Approving publishes them to teachers and students immediately.
                </p>
            </div>

            <div className="audit-toolbar">
                <div style={{ flex: 1 }} />
                <div className="audit-time-range">
                    <button className={`audit-time-pill ${filter === 'all' ? 'audit-time-pill-active' : ''}`} onClick={() => setFilter('all')}><Filter size={11} /> All ({items.length})</button>
                    <button className={`audit-time-pill ${filter === 'with-conflicts' ? 'audit-time-pill-active' : ''}`} onClick={() => setFilter('with-conflicts')}>With conflicts</button>
                    <button className={`audit-time-pill ${filter === 'no-conflicts' ? 'audit-time-pill-active' : ''}`} onClick={() => setFilter('no-conflicts')}>Clean</button>
                </div>
                <button className="btn btn-secondary" onClick={load} aria-label="Refresh approvals list"><RefreshCw size={14} /></button>
            </div>

            {loading ? (
                <div className="dash-loading-center"><Loader2 className="spin" size={28} /></div>
            ) : filtered.length === 0 ? (
                <div className="dash-empty"><Inbox size={28} /><div>Nothing to review. All caught up.</div></div>
            ) : (
                <div className="dash-list" style={{ gap: 10 }}>
                    {filtered.map(item => {
                        const confs = conflictsBySched[item.id] || [];
                        const isRejecting = showRejectFor === item.id;
                        const isActing = acting === item.id;
                        return (
                            <div key={item.id} className="dash-card dash-stagger" style={{ padding: 14 }}>
                                <div className="dash-card-header" style={{ marginBottom: 10 }}>
                                    <div className="dash-card-title">
                                        <Clock size={16} /> {sectionName(item.section)}
                                    </div>
                                    {confs.length > 0 ? (
                                        <span className="dash-card-badge dash-badge-warning">
                                            <AlertTriangle size={11} style={{ marginRight: 4 }} />
                                            {confs.length} conflict{confs.length !== 1 ? 's' : ''}
                                        </span>
                                    ) : (
                                        <span className="dash-card-badge dash-badge-success">
                                            <CheckCircle size={11} style={{ marginRight: 4 }} /> Clean
                                        </span>
                                    )}
                                </div>
                                <div className="dash-meta-text">
                                    Submitted by <strong>{creatorName(item.creator)}</strong>
                                    {item.submitted_at && <> · {new Date(item.submitted_at).toLocaleString()}</>}
                                    {' · '}{item.semester} {item.academic_year}
                                </div>

                                {confs.length > 0 && (
                                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {confs.slice(0, 3).map(c => (
                                            <div key={c.id} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <AlertTriangle size={11} color={c.severity === 'high' ? '#ef4444' : '#f59e0b'} />
                                                <code style={{ fontSize: 11 }}>{c.type.replace(/_/g, ' ')}</code>
                                                <span>{c.title}</span>
                                            </div>
                                        ))}
                                        {confs.length > 3 && <div className="dash-meta-text">…and {confs.length - 3} more</div>}
                                    </div>
                                )}

                                {isRejecting ? (
                                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <textarea
                                            className="input"
                                            rows={2}
                                            placeholder="Reason for rejection (will be sent to the schedule manager)…"
                                            value={rejectReason}
                                            onChange={(e) => setRejectReason(e.target.value)}
                                        />
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button className="btn btn-secondary" onClick={() => { setShowRejectFor(null); setRejectReason(''); }}>Cancel</button>
                                            <button className="btn btn-primary" onClick={() => reject(item.id)} disabled={isActing || !rejectReason.trim()}>
                                                {isActing ? <Loader2 className="spin" size={14} /> : <XCircle size={14} />} Confirm Rejection
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                                        <button className="btn btn-primary" onClick={() => approve(item.id)} disabled={isActing}>
                                            {isActing ? <Loader2 className="spin" size={14} /> : <CheckCircle size={14} />} Approve & Publish
                                        </button>
                                        <button className="btn btn-secondary" onClick={() => setShowRejectFor(item.id)} disabled={isActing}>
                                            <XCircle size={14} /> Reject
                                        </button>
                                        <button className="btn btn-secondary" onClick={() => window.open(`/admin/schedules?id=${item.id}`, '_blank')}>
                                            <MessageSquare size={14} /> View Detail
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ApprovalsPage;
