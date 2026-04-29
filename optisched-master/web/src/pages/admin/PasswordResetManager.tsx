import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { KeyRound, Check, X, Loader2, ShieldCheck } from 'lucide-react';

interface ResetRequest {
    id: string;
    email: string;
    user_id?: string;
    status: string;
    requested_at: string;
}

const PasswordResetManager: React.FC = () => {
    const { profile } = useAuth();
    const [requests, setRequests] = useState<ResetRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    const fetchRequests = async () => {
        try {
            const { data } = await supabase
                .from('password_reset_requests')
                .select('*')
                .eq('status', 'pending')
                .order('requested_at', { ascending: false });
            setRequests((data || []) as ResetRequest[]);
        } catch { /* ignore */ }
        setLoading(false);
    };

    useEffect(() => {
        fetchRequests();
        const channel = supabase
            .channel('password-resets-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'password_reset_requests' }, () => fetchRequests())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const handleApprove = async (req: ResetRequest) => {
        if (!window.confirm(`Reset password for ${req.email}?\nNew password will be: surname + last digits of their ID.`)) return;
        setProcessingId(req.id);
        try {
            const { data: userData } = await supabase.from('profiles').select('id, full_name').eq('email', req.email).single();
            if (!userData) { window.alert('User not found'); setProcessingId(null); return; }

            const emailLocal = req.email.split('@')[0] || '';
            const parts = emailLocal.split('.');
            const surname = parts[0]?.toLowerCase() || (userData.full_name || '').split(' ').pop()?.toLowerCase() || 'user';
            const idFromEmail = parts[1] || userData.id.slice(-6);
            const newPassword = `${surname}.${idFromEmail}`;

            // Try admin reset
            const { error } = await supabase.auth.admin.updateUserById(userData.id, { password: newPassword });
            if (error) throw error;

            await supabase.from('password_reset_requests').update({
                status: 'approved', resolved_at: new Date().toISOString(), resolved_by: profile?.id
            }).eq('id', req.id);

            fetchRequests();
            window.alert(`Password reset to: ${newPassword}\nPlease inform the user.`);
        } catch (err: any) {
            window.alert('Error: ' + (err?.message || 'Failed to reset'));
        }
        setProcessingId(null);
    };

    const handleDeny = async (req: ResetRequest) => {
        setProcessingId(req.id);
        await supabase.from('password_reset_requests').update({
            status: 'denied', resolved_at: new Date().toISOString(), resolved_by: profile?.id
        }).eq('id', req.id);
        fetchRequests();
        setProcessingId(null);
    };

    if (loading) return <div className="pw-loading"><Loader2 size={24} className="spin" /> Loading requests...</div>;

    if (requests.length === 0) {
        return (
            <div className="pw-empty">
                <div className="pw-empty-icon"><ShieldCheck size={48} /></div>
                <h3>All Clear</h3>
                <p>No pending password reset requests.</p>
            </div>
        );
    }

    return (
        <div className="pw-reset-list">
            {requests.map(req => (
                <div key={req.id} className="pw-reset-card glass-panel">
                    <div className="pw-card-header">
                        <div className="pw-card-icon"><KeyRound size={20} color="#f59e0b" /></div>
                        <div className="pw-card-info">
                            <div className="pw-email">{req.email}</div>
                            <div className="pw-time">{req.requested_at ? new Date(req.requested_at).toLocaleString() : 'Just now'}</div>
                        </div>
                        <span className="pw-pending-badge">Pending</span>
                    </div>
                    <p className="pw-hint">
                        Password will reset to: <strong className="pw-new">surname.ID (from email)</strong>
                    </p>
                    <div className="pw-actions">
                        <button className="pw-approve" onClick={() => handleApprove(req)} disabled={processingId === req.id}>
                            {processingId === req.id ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Approve
                        </button>
                        <button className="pw-deny" onClick={() => handleDeny(req)} disabled={processingId === req.id}>
                            <X size={14} /> Deny
                        </button>
                    </div>
                </div>
            ))}

            <style>{`
                .pw-loading { display: flex; align-items: center; gap: 0.75rem; padding: 2rem; color: var(--text-muted); justify-content: center; }
                .pw-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; text-align: center; }
                .pw-empty-icon { width: 88px; height: 88px; border-radius: 50%; background: rgba(16,185,129,0.1); display: flex; align-items: center; justify-content: center; color: #34d399; margin-bottom: 1rem; }
                .pw-empty h3 { font-size: 1.2rem; margin-bottom: 0.25rem; }
                .pw-empty p { color: var(--text-muted); font-size: 0.9rem; }
                .pw-reset-list { display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem 0; }
                .pw-reset-card { padding: 1.25rem; }
                .pw-card-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }
                .pw-card-icon { width: 40px; height: 40px; border-radius: 10px; background: rgba(245,158,11,0.12); display: flex; align-items: center; justify-content: center; }
                .pw-card-info { flex: 1; }
                .pw-email { font-weight: 700; font-size: 0.95rem; }
                .pw-time { font-size: 0.75rem; color: var(--text-muted); }
                .pw-pending-badge { font-size: 0.7rem; font-weight: 600; color: #f59e0b; background: rgba(245,158,11,0.12); padding: 4px 10px; border-radius: 8px; }
                .pw-hint { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem; }
                .pw-new { color: #34d399; }
                .pw-actions { display: flex; gap: 0.5rem; }
                .pw-approve { flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.6rem; border-radius: 10px; background: #10b981; color: white; border: none; font-weight: 600; font-size: 0.8rem; cursor: pointer; }
                .pw-approve:disabled { opacity: 0.5; cursor: not-allowed; }
                .pw-deny { flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.6rem; border-radius: 10px; background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); font-weight: 600; font-size: 0.8rem; cursor: pointer; }
                .pw-deny:disabled { opacity: 0.5; cursor: not-allowed; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};

export default PasswordResetManager;
