// ApprovalsPage - Schedule Admin / Power Admin approval queue.
// Lists schedule versions with change_type='submitted' and lets approvers approve, reject,
// or request changes. Inline preview of conflicts attached to each version.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
// Temporarily disabled audit logging - log_audit RPC function doesn't exist
// import { logAudit } from '../../hooks/useActivityLogger';
import { scheduleVersionService } from '../../services/scheduleVersionService';
import {
    CheckCircle, XCircle, Clock, AlertTriangle, Loader2, Lock,
    Inbox, MessageSquare, RefreshCw
} from 'lucide-react';
import './Dashboard.css';

interface SubmittedVersion {
    id: string;
    version_number?: number;
    change_type: string;
    changed_at?: string;
    changed_by: string | null;
    batch_id: string | null;
    semester?: string | null;
    academic_year?: string | null;
    conflict_count?: number;
    creator?: { full_name: string } | null;
}

const ApprovalsPage: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const perms = usePermissions();
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState<string | null>(null);
    const [items, setItems] = useState<SubmittedVersion[]>([]);
    const [filter, setFilter] = useState<'all' | 'with-conflicts' | 'no-conflicts'>('all');
    const [showRejectFor, setShowRejectFor] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    // Initialize scheduleVersionService
    useEffect(() => {
        if (user && supabase) {
            scheduleVersionService.initialize(supabase, user.id);
        }
    }, [user]);

    const load = async () => {
        setLoading(true);
        try {
            // Primary: fetch submitted versions directly from schedule_versions
            const { data, error } = await supabase
                .from('schedule_versions')
                .select('id, version_number, change_type, changed_at, changed_by, batch_id')
                .eq('change_type', 'status_change')
                .order('changed_at', { ascending: true });

            if (error) throw error;

            let list = ((data || []) as unknown) as SubmittedVersion[];
            console.log('[Approvals] status_change versions fetched:', list.length);

            // Fallback: if no status_change found, try batches with schedules.status=submitted
            if (list.length === 0) {
                const { data: submittedSchedules } = await supabase
                    .from('schedules')
                    .select('batch_id, submitted_at, created_at, created_by')
                    .eq('status', 'submitted')
                    .not('batch_id', 'is', null);

                console.log('[Approvals] schedules with status=submitted:', submittedSchedules?.length || 0);

                if (submittedSchedules && submittedSchedules.length > 0) {
                    list = submittedSchedules.map((s: { batch_id: string; submitted_at?: string; created_at?: string; created_by?: string | null }, idx) => ({
                        id: `submitted-fallback-${idx}`,
                        version_number: 1,
                        change_type: 'status_change',
                        changed_at: s.submitted_at || s.created_at || new Date().toISOString(),
                        changed_by: s.created_by || null,
                        batch_id: s.batch_id,
                        semester: null,
                        academic_year: null,
                        conflict_count: 0,
                        creator: null,
                    }));
                    console.log('[Approvals] fallback constructed from schedules:', list.length);
                }
            }

            const userIds = Array.from(new Set(list.map(i => i.changed_by).filter((id): id is string => Boolean(id))));
            if (userIds.length > 0) {
                const { data: profiles, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', userIds);

                if (!profilesError && profiles) {
                    const profileMap = new Map<string, string>(profiles.map((p: { id: string; full_name: string }) => [p.id, p.full_name]));
                    list = list.map(item => ({
                        ...item,
                        creator: item.changed_by ? { full_name: profileMap.get(item.changed_by) || 'Unknown' } : null,
                    }));
                }
            }

            console.log('[Approvals] final submitted list size:', list.length);
            setItems(list);
        } catch (err) {
            console.error('[Approvals] load failed', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (perms.canApproveSchedules) load(); }, [perms.canApproveSchedules]);

    const creatorName = (s: SubmittedVersion['creator']): string => {
        if (!s) return 'Unknown';
        return s.full_name;
    };

    const filtered = useMemo(() => {
        return items.filter(i => {
            const has = (i.conflict_count || 0) > 0;
            if (filter === 'with-conflicts') return has;
            if (filter === 'no-conflicts') return !has;
            return true;
        });
    }, [items, filter]);

    const approve = async (id: string) => {
        const batchId = items.find(i => i.id === id)?.batch_id;
        if (!batchId) return;
        setActing(id);
        try {
            const res = await (scheduleVersionService as { approveSchedule: (id: string, opts: { changeReason: string }) => Promise<{ success: boolean; message: string }> }).approveSchedule(batchId, { changeReason: 'Approved from approvals page' });
            if (!res.success) throw new Error(res.message);
            
            const pubRes = await (scheduleVersionService as { publishApprovedSchedule: (id: string, opts: { changeReason: string }) => Promise<{ success: boolean; message: string }> }).publishApprovedSchedule(batchId, { changeReason: 'Published from approvals page' });
            if (!pubRes.success) throw new Error(pubRes.message);

            // await logAudit('schedule.approve', 'schedule_versions', id); // Temporarily disabled
            setItems(prev => prev.filter(i => i.id !== id));
        } catch (err) {
            console.error('[Approvals] approve failed', err);
            showToast({ title: 'Failed to approve', message: 'Check console for details', type: 'error' });
        } finally {
            setActing(null);
        }
    };

    const reject = async (id: string) => {
        if (!rejectReason.trim()) {
            showToast({ title: 'Rejection reason required', message: 'Please provide a rejection reason.', type: 'warning' });
            return;
        }
        setActing(id);
        try {
            const batchId = items.find(i => i.id === id)?.batch_id;
            if (!batchId) throw new Error('Batch ID not found');
            
            // Update schedules to rejected status
            const { error: scheduleError } = await supabase
                .from('schedules')
                .update({ 
                    status: 'rejected',
                    rejection_reason: rejectReason.trim(),
                    rejected_at: new Date().toISOString(),
                    rejected_by: user?.id
                })
                .eq('batch_id', batchId)
                .eq('status', 'submitted');
            
            if (scheduleError) throw scheduleError;
            
            // Create a new version to record the rejection using RPC
            const { error: versionError } = await supabase
                .rpc('create_batch_version', {
                    p_batch_id: batchId,
                    p_change_type: 'status_change',
                    p_change_summary: 'Schedule rejected',
                    p_change_reason: rejectReason.trim(),
                    p_state_hash: '',
                    p_soft_score: 0,
                    p_conflict_count: 0,
                    p_changed_by: user?.id,
                    p_previous_version_id: id
                });

            if (versionError) throw versionError;

            // await logAudit('schedule.reject', 'schedule_versions', id); // Temporarily disabled
            setItems(prev => prev.filter(i => i.id !== id));
        } catch (err) {
            console.error('[Approvals] reject failed', err);
            showToast({ title: 'Failed to reject', message: 'Check console for details', type: 'error' });
        } finally {
            setActing(null);
            setShowRejectFor(null);
            setRejectReason('');
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
                    Review submitted schedule versions. Approving publishes them to teachers and students immediately.
                </p>
            </div>

            <div className="scrollable-container">
            <div className="audit-toolbar">
                <div style={{ flex: 1 }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>
                        {items.length} version{items.length !== 1 ? 's' : ''} pending approval
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div className="audit-time-range">
                        <button 
                            className={`audit-time-pill ${filter === 'all' ? 'audit-time-pill-active' : ''}`} 
                            onClick={() => setFilter('all')}
                            style={{ padding: '6px 12px', fontSize: 13 }}
                        >
                            All ({items.length})
                        </button>
                        <button 
                            className={`audit-time-pill ${filter === 'with-conflicts' ? 'audit-time-pill-active' : ''}`} 
                            onClick={() => setFilter('with-conflicts')}
                            style={{ padding: '6px 12px', fontSize: 13 }}
                        >
                            <AlertTriangle size={11} style={{ marginRight: 4 }} /> With conflicts
                        </button>
                        <button 
                            className={`audit-time-pill ${filter === 'no-conflicts' ? 'audit-time-pill-active' : ''}`} 
                            onClick={() => setFilter('no-conflicts')}
                            style={{ padding: '6px 12px', fontSize: 13 }}
                        >
                            <CheckCircle size={11} style={{ marginRight: 4 }} /> Clean
                        </button>
                    </div>
                    <button 
                        className="btn btn-secondary" 
                        onClick={load} 
                        aria-label="Refresh approvals list"
                        style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        <RefreshCw size={14} />
                        <span style={{ fontSize: 13 }}>Refresh</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="dash-loading-center"><Loader2 className="spin" size={28} /></div>
            ) : filtered.length === 0 ? (
                <div className="dash-empty"><Inbox size={28} /><div>Nothing to review. All caught up.</div></div>
            ) : (
                <div className="dash-list" style={{ gap: 10 }}>
                    {filtered.map(item => {
                        const isRejecting = showRejectFor === item.id;
                        const isActing = acting === item.id;
                        return (
                            <div key={item.id} className="dash-card dash-stagger" style={{ padding: 14 }}>
                                <div className="dash-card-header" style={{ marginBottom: 10 }}>
                                    <div className="dash-card-title">
                                        <Clock size={16} /> Version {item.version_number}
                                    </div>
                                    {(item.conflict_count || 0) > 0 ? (
                                        <span className="dash-card-badge dash-badge-warning">
                                            <AlertTriangle size={11} style={{ marginRight: 4 }} />
                                            {item.conflict_count} conflict{item.conflict_count !== 1 ? 's' : ''}
                                        </span>
                                    ) : (
                                        <span className="dash-card-badge dash-badge-success">
                                            <CheckCircle size={11} style={{ marginRight: 4 }} /> Clean
                                        </span>
                                    )}
                                </div>
                                <div className="dash-meta-text">
                                    Submitted by <strong>{creatorName(item.creator)}</strong>
                                    {item.changed_at && <> · {new Date(item.changed_at).toLocaleString()}</>}
                                    {' · '}{item.semester} {item.academic_year}
                                </div>

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
                                            {isActing ? <Loader2 className="spin" size={14} /> : <CheckCircle size={14} />} Approve
                                        </button>
                                        <button className="btn btn-secondary" onClick={() => setShowRejectFor(item.id)} disabled={isActing}>
                                            <XCircle size={14} /> Reject
                                        </button>
                                        <button className="btn btn-secondary" onClick={() => navigate(`/admin/schedules/current?version=${item.id}`)}>
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
        </div>
    );
};

export default ApprovalsPage;
