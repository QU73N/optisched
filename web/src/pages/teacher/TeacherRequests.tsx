// TeacherRequests - submit & track schedule change requests.

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { logActivity } from '../../hooks/useActivityLogger';
import {
    Inbox, Plus, Loader2, CheckCircle, XCircle, Clock,
    ArrowRightLeft, Lock, Send
} from 'lucide-react';
import '../admin/Dashboard.css';

interface RequestRow {
    id: string;
    request_type: string;
    reason: string;
    proposed_day: string | null;
    proposed_time: string | null;
    status: string;
    admin_notes: string | null;
    created_at: string;
}

const TeacherRequests: React.FC = () => {
    const { profile } = useAuth();
    const perms = usePermissions();
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<RequestRow[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [reqType, setReqType] = useState<'reschedule' | 'cancel' | 'swap'>('reschedule');
    const [reason, setReason] = useState('');
    const [proposedDay, setProposedDay] = useState('');
    const [proposedTime, setProposedTime] = useState('');

    const load = async () => {
        if (!profile?.id) return;
        setLoading(true);
        try {
            const { data } = await supabase
                .from('schedule_change_requests')
                .select('*')
                .eq('teacher_id', profile.id)
                .order('created_at', { ascending: false });
            setItems((data || []) as RequestRow[]);
        } catch (err) {
            console.error('[TeacherRequests] load failed', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const submit = async () => {
        if (!reason.trim()) { alert('Please describe the reason.'); return; }
        if (!profile?.id) return;
        setSubmitting(true);
        try {
            const { error } = await supabase.from('schedule_change_requests').insert({
                teacher_id: profile.id,
                teacher_name: profile.full_name,
                request_type: reqType,
                reason: reason.trim(),
                proposed_day: proposedDay || null,
                proposed_time: proposedTime || null,
            });
            if (error) throw error;
            await logActivity({
                actionType: 'mutation',
                resource: 'schedule_change_requests:INSERT',
                details: { request_type: reqType }
            });
            setShowForm(false);
            setReason(''); setProposedDay(''); setProposedTime('');
            load();
        } catch (err) {
            console.error('[TeacherRequests] submit failed', err);
            alert('Failed to submit. Check console.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!perms.isTeacher) {
        return (
            <div className="dashboard">
                <div className="dash-empty"><Lock size={28} /><div>Schedule change requests are for teachers.</div></div>
            </div>
        );
    }

    if (!perms.canSubmitChangeRequest && !showForm) {
        // Hide the form button if disabled by rules engine, but still show history.
    }

    const statusBadge = (s: string) => {
        if (s === 'approved') return <span className="dash-card-badge dash-badge-success"><CheckCircle size={11} style={{ marginRight: 4 }} />approved</span>;
        if (s === 'rejected') return <span className="dash-card-badge dash-badge-warning"><XCircle size={11} style={{ marginRight: 4 }} />rejected</span>;
        return <span className="dash-card-badge dash-badge-info"><Clock size={11} style={{ marginRight: 4 }} />pending</span>;
    };

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1 className="dashboard-title"><Inbox size={20} /> My Requests</h1>
                <p className="dashboard-subtitle">
                    Submit schedule change requests and track their status.
                </p>
            </div>

            <div className="audit-toolbar">
                <div style={{ flex: 1 }} />
                {perms.canSubmitChangeRequest && !showForm && (
                    <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                        <Plus size={14} /> New Request
                    </button>
                )}
                {!perms.canSubmitChangeRequest && (
                    <span className="dash-meta-text">
                        <Lock size={12} style={{ verticalAlign: 'middle' }} /> Submitting requests is currently disabled by an administrator.
                    </span>
                )}
            </div>

            {showForm && (
                <div className="dash-card dash-stagger" style={{ marginBottom: 16 }}>
                    <div className="dash-card-header">
                        <div className="dash-card-title"><ArrowRightLeft size={16} /> New change request</div>
                    </div>
                    <div className="dash-flex-col dash-gap-10">
                        <label>Type</label>
                        <select className="input" value={reqType} onChange={e => setReqType(e.target.value as 'reschedule' | 'cancel' | 'swap')}>
                            <option value="reschedule">Reschedule</option>
                            <option value="cancel">Cancel</option>
                            <option value="swap">Swap</option>
                        </select>
                        <label>Reason</label>
                        <textarea
                            className="input"
                            rows={3}
                            placeholder="Explain why this change is needed…"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                        />
                        <div className="dash-header-row" style={{ gap: 10 }}>
                            <div style={{ flex: 1 }}>
                                <label>Proposed day (optional)</label>
                                <select className="input" value={proposedDay} onChange={e => setProposedDay(e.target.value)}>
                                    <option value="">None</option>
                                    {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d =>
                                        <option key={d} value={d}>{d}</option>
                                    )}
                                </select>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label>Proposed time (optional)</label>
                                <input className="input" type="time" value={proposedTime} onChange={e => setProposedTime(e.target.value)} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={submit} disabled={submitting || !reason.trim()}>
                                {submitting ? <Loader2 className="spin" size={14} /> : <Send size={14} />} Submit
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="dash-loading-center"><Loader2 className="spin" size={28} /></div>
            ) : items.length === 0 ? (
                <div className="dash-empty"><Inbox size={28} /><div>No requests yet.</div></div>
            ) : (
                <div className="dash-list" style={{ gap: 8 }}>
                    {items.map(r => (
                        <div key={r.id} className="dash-card dash-stagger" style={{ padding: 14 }}>
                            <div className="dash-card-header" style={{ marginBottom: 6 }}>
                                <div className="dash-card-title">
                                    <ArrowRightLeft size={16} /> {r.request_type}
                                </div>
                                {statusBadge(r.status)}
                            </div>
                            <div className="dash-meta-text" style={{ marginBottom: 6 }}>
                                Submitted {new Date(r.created_at).toLocaleString()}
                                {r.proposed_day && <> · proposes {r.proposed_day} {r.proposed_time || ''}</>}
                            </div>
                            <div className="text-base" style={{ color: 'var(--text-secondary)' }}>{r.reason}</div>
                            {r.admin_notes && (
                                <div className="text-sm" style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg-inset)', borderLeft: '3px solid var(--accent-primary)', borderRadius: 4, color: 'var(--text-secondary)' }}>
                                    <strong>Admin response:</strong> {r.admin_notes}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TeacherRequests;
