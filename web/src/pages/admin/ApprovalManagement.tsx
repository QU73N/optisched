import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ADMIN_ROLES } from '../../types/database';
import { Check, X, Clock, FileText, User, Calendar } from 'lucide-react';
import '../admin/Dashboard.css';
import {
    getApprovalRequests,
    getMyApprovalRequests,
    approveRequest,
    rejectRequest,
    cancelRequest,
    getApprovalAuditLog
} from '../../services/approvalService';
import type { ApprovalRequest, ApprovalAuditLog } from '../../types/database';

const ApprovalManagement: React.FC = () => {
    const { role, roles } = useAuth();
    const allRoles = roles.length > 0 ? roles : (role ? [role] : []);
    const canApprove = allRoles.some((r: string) => ADMIN_ROLES.includes(r as 'admin' | 'power_admin' | 'system_admin' | 'schedule_admin' | 'schedule_manager'));

    const [requests, setRequests] = useState<ApprovalRequest[]>([]);
    const [myRequests, setMyRequests] = useState<ApprovalRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pending' | 'my'>('pending');
    const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
    const [auditLog, setAuditLog] = useState<ApprovalAuditLog[]>([]);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [reason, setReason] = useState('');
    const [processing, setProcessing] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'pending' && canApprove) {
                const data = await getApprovalRequests('pending');
                setRequests(data);
            } else {
                const data = await getMyApprovalRequests();
                setMyRequests(data);
            }
        } catch (error: unknown) {
            console.error('Error loading requests:', error);
            setMessage({ type: 'error', text: 'Failed to load approval requests' });
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const handleViewAudit = async (request: ApprovalRequest) => {
        setSelectedRequest(request);
        try {
            const log = await getApprovalAuditLog(request.id);
            setAuditLog(log);
        } catch (error: unknown) {
            console.error('Error loading audit log:', error);
        }
    };

    const handleApprove = async () => {
        if (!selectedRequest) return;
        setProcessing(true);
        try {
            await approveRequest(selectedRequest.id, reason);
            setMessage({ type: 'success', text: 'Request approved successfully' });
            setReason('');
            setSelectedRequest(null);
            await loadData();
        } catch (error: unknown) {
            console.error('Error approving request:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to approve request';
            setMessage({ type: 'error', text: errorMessage });
        }
        setProcessing(false);
    };

    const handleReject = async () => {
        if (!selectedRequest) return;
        if (!reason.trim()) {
            setMessage({ type: 'error', text: 'Please provide a rejection reason' });
            return;
        }
        setProcessing(true);
        try {
            await rejectRequest(selectedRequest.id, reason);
            setMessage({ type: 'success', text: 'Request rejected successfully' });
            setReason('');
            setSelectedRequest(null);
            await loadData();
        } catch (error: unknown) {
            console.error('Error rejecting request:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to reject request';
            setMessage({ type: 'error', text: errorMessage });
        }
        setProcessing(false);
    };

    const handleCancel = async (requestId: string) => {
        if (!confirm('Cancel this request? This cannot be undone.')) return;
        try {
            await cancelRequest(requestId);
            setMessage({ type: 'success', text: 'Request cancelled successfully' });
            await loadData();
        } catch (error: unknown) {
            console.error('Error cancelling request:', error);
            setMessage({ type: 'error', text: 'Failed to cancel request' });
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
            pending: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', icon: <Clock size={14} /> },
            approved: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', icon: <Check size={14} /> },
            rejected: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', icon: <X size={14} /> },
            cancelled: { bg: 'rgba(107,114,128,0.15)', color: '#6b7280', icon: <X size={14} /> }
        };
        const style = styles[status] || styles.pending;
        return (
            <span className="badge" style={{ background: style.bg, color: style.color }}>
                {style.icon} {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="dashboard fade-in">
                <div className="dashboard-header">
                    <div>
                        <h1 className="dashboard-title">Approval Workflow</h1>
                        <p className="dashboard-subtitle">Manage approval requests for schedule changes</p>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                    <div className="spinner" />
                </div>
            </div>
        );
    }

    const displayRequests = activeTab === 'pending' && canApprove ? requests : myRequests;

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Approval Workflow</h1>
                    <p className="dashboard-subtitle">Manage approval requests for schedule changes</p>
                </div>
            </div>

            {message && (
                <div style={{
                    padding: 12,
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 24,
                    background: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
                    color: message.type === 'success' ? '#10b981' : '#ef4444',
                    fontSize: 14
                }}>
                    {message.text}
                </div>
            )}

            <div className="dash-card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                    {canApprove && (
                        <button
                            className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => setActiveTab('pending')}
                        >
                            Pending Requests
                        </button>
                    )}
                    <button
                        className={`btn ${activeTab === 'my' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setActiveTab('my')}
                    >
                        My Requests
                    </button>
                </div>

                {displayRequests.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        {activeTab === 'pending' ? 'No pending approval requests' : 'No approval requests found'}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {displayRequests.map(request => (
                            <div
                                key={request.id}
                                style={{
                                    padding: 16,
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-surface)',
                                    cursor: 'pointer'
                                }}
                                onClick={() => handleViewAudit(request)}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <h3 style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>{request.title}</h3>
                                        {getStatusBadge(request.status)}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {request.status === 'pending' && canApprove && activeTab === 'pending' && (
                                            <button
                                                className="btn btn-primary"
                                                style={{ padding: '4px 12px', fontSize: 12 }}
                                                onClick={(e) => { e.stopPropagation(); setSelectedRequest(request); }}
                                            >
                                                Review
                                            </button>
                                        )}
                                        {request.status === 'pending' && activeTab === 'my' && (
                                            <button
                                                className="btn btn-ghost"
                                                style={{ padding: '4px 12px', fontSize: 12, color: '#ef4444' }}
                                                onClick={(e) => { e.stopPropagation(); handleCancel(request.id); }}
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <User size={12} />
                                        {request.requested_by_user?.full_name || 'Unknown'}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <FileText size={12} />
                                        {request.request_type}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Calendar size={12} />
                                        {new Date(request.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                                {request.description && (
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8, margin: '8px 0 0 0' }}>
                                        {request.description}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Review Modal */}
            {selectedRequest && (
                <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
                    <div className="modal-content slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Review Approval Request</h2>
                            <button className="btn btn-ghost" onClick={() => setSelectedRequest(null)}><X size={20} /></button>
                        </div>
                        <div style={{ padding: 24 }}>
                            <div style={{ marginBottom: 16 }}>
                                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{selectedRequest.title}</h3>
                                {getStatusBadge(selectedRequest.status)}
                            </div>
                            <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                                <div><strong>Requested by:</strong> {selectedRequest.requested_by_user?.full_name}</div>
                                <div><strong>Type:</strong> {selectedRequest.request_type}</div>
                                <div><strong>Resource:</strong> {selectedRequest.resource_type}</div>
                                <div><strong>Created:</strong> {new Date(selectedRequest.created_at).toLocaleString()}</div>
                            </div>
                            {selectedRequest.description && (
                                <div style={{ marginBottom: 16 }}>
                                    <strong>Description:</strong>
                                    <p style={{ fontSize: 13, marginTop: 4 }}>{selectedRequest.description}</p>
                                </div>
                            )}
                            {selectedRequest.change_data && Object.keys(selectedRequest.change_data).length > 0 && (
                                <div style={{ marginBottom: 16 }}>
                                    <strong>Changes:</strong>
                                    <pre style={{ fontSize: 12, padding: 12, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', marginTop: 4, overflow: 'auto' }}>
                                        {JSON.stringify(selectedRequest.change_data, null, 2)}
                                    </pre>
                                </div>
                            )}
                            <div style={{ marginBottom: 16 }}>
                                <strong>Notes:</strong>
                                <textarea
                                    className="input"
                                    rows={3}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Optional notes for approval/rejection..."
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleApprove}
                                    disabled={processing}
                                >
                                    <Check size={16} style={{ marginRight: 8 }} />
                                    {processing ? 'Processing...' : 'Approve'}
                                </button>
                                <button
                                    className="btn btn-ghost"
                                    style={{ color: '#ef4444', border: '1px solid #ef4444' }}
                                    onClick={handleReject}
                                    disabled={processing}
                                >
                                    <X size={16} style={{ marginRight: 8 }} />
                                    {processing ? 'Processing...' : 'Reject'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Audit Log Modal */}
            {selectedRequest && auditLog.length > 0 && (
                <div className="modal-overlay" onClick={() => { setSelectedRequest(null); setAuditLog([]); }}>
                    <div className="modal-content slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Audit Log</h2>
                            <button className="btn btn-ghost" onClick={() => { setSelectedRequest(null); setAuditLog([]); }}><X size={20} /></button>
                        </div>
                        <div style={{ padding: 24 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {auditLog.map(log => (
                                    <div key={log.id} style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-subtle)', fontSize: 13 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <strong>{log.action.charAt(0).toUpperCase() + log.action.slice(1)}</strong>
                                            <span style={{ color: 'var(--text-secondary)' }}>{new Date(log.created_at).toLocaleString()}</span>
                                        </div>
                                        <div style={{ color: 'var(--text-secondary)' }}>
                                            by {log.performed_by_user?.full_name || 'System'}
                                        </div>
                                        {log.notes && (
                                            <div style={{ marginTop: 4, fontStyle: 'italic' }}>{log.notes}</div>
                                        )}
                                        {log.previous_status && log.new_status && (
                                            <div style={{ marginTop: 4, fontSize: 12 }}>
                                                Status: {log.previous_status} → {log.new_status}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApprovalManagement;
