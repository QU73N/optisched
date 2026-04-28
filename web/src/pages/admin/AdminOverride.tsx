import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../hooks/useActivityLogger';
import {
    AlertOctagon, Loader2, RefreshCw, ShieldAlert, Power, AlertTriangle,
    CheckCircle, XCircle, Clock,
} from 'lucide-react';

type OverrideKind = 'disable_rate_limit' | 'disable_idle_timeout' | 'bypass_approval' | 'maintenance_mode' | 'custom';

interface OverrideRow {
    id: string;
    kind: OverrideKind;
    reason: string;
    payload: Record<string, unknown>;
    is_active: boolean;
    activated_by: string | null;
    activated_at: string;
    expires_at: string | null;
    deactivated_by: string | null;
    deactivated_at: string | null;
}

const KIND_META: Record<OverrideKind, { label: string; description: string }> = {
    disable_rate_limit: { label: 'Disable rate limiting', description: 'Skip login / RPC rate limit checks system-wide.' },
    disable_idle_timeout: { label: 'Disable idle timeout', description: 'Stop auto-signout for inactivity until lifted.' },
    bypass_approval: { label: 'Bypass schedule approval', description: 'Allow direct publish without admin approval.' },
    maintenance_mode: { label: 'Maintenance mode', description: 'Show maintenance banner and freeze writes for non-admins.' },
    custom: { label: 'Custom override', description: 'Free-form override carrying a payload.' },
};

const AdminOverride: React.FC = () => {
    const { profile } = useAuth();
    const [rows, setRows] = useState<OverrideRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [kind, setKind] = useState<OverrideKind>('maintenance_mode');
    const [reason, setReason] = useState('');
    const [expiresInHours, setExpiresInHours] = useState<string>('4');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isPower = profile?.role === 'power_admin' || profile?.role === 'system_admin';

    const load = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('emergency_overrides')
            .select('*')
            .order('activated_at', { ascending: false })
            .limit(50);
        if (error) setError(error.message);
        else setRows(data as OverrideRow[] || []);
        setLoading(false);
    }, []);

    useEffect(() => {
        if (isPower) load();
    }, [isPower, load]);

    const activate = async () => {
        if (!profile?.id) return;
        if (!reason.trim() || reason.trim().length < 8) {
            setError('Please provide a reason of at least 8 characters.');
            return;
        }
        setCreating(true);
        setError(null);
        const expires_at = expiresInHours
            ? new Date(Date.now() + parseFloat(expiresInHours) * 3600 * 1000).toISOString()
            : null;
        const { data, error } = await supabase
            .from('emergency_overrides')
            .insert({ kind, reason: reason.trim(), is_active: true, activated_by: profile.id, expires_at })
            .select('*')
            .single();
        if (error) setError(error.message);
        else {
            setRows(prev => [data as OverrideRow, ...prev]);
            setReason('');
            await logAudit('override_activated', 'emergency_overrides', (data as OverrideRow).id, { kind, expires_at });
        }
        setCreating(false);
    };

    const deactivate = async (row: OverrideRow) => {
        if (!profile?.id) return;
        setBusyId(row.id);
        const { error } = await supabase
            .from('emergency_overrides')
            .update({ is_active: false, deactivated_by: profile.id, deactivated_at: new Date().toISOString() })
            .eq('id', row.id);
        if (!error) {
            setRows(prev => prev.map(r => r.id === row.id ? { ...r, is_active: false, deactivated_by: profile.id, deactivated_at: new Date().toISOString() } : r));
            await logAudit('override_deactivated', 'emergency_overrides', row.id, { kind: row.kind });
        } else setError(error.message);
        setBusyId(null);
    };

    if (!isPower) {
        return (
            <div className="dash-empty">
                <AlertTriangle size={28} />
                <div>Emergency overrides are restricted to Power Admin / System Admin.</div>
            </div>
        );
    }

    const activeRows = rows.filter(r => r.is_active && (!r.expires_at || new Date(r.expires_at) > new Date()));
    const historicalRows = rows.filter(r => !activeRows.includes(r));

    return (
        <div>
            <div className="page-header">
                <h1><AlertOctagon size={24} /> Emergency Overrides</h1>
                <p>Activate temporary system-wide overrides. Every activation and deactivation is recorded in the audit log.</p>
            </div>

            <div className="card" style={{ marginBottom: 20, borderColor: 'var(--accent-warning)' }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-warning)' }}>
                    <ShieldAlert size={16} /> Activate override
                </h2>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '220px 1fr 140px auto', alignItems: 'end' }}>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Type</label>
                        <select className="input" value={kind} onChange={e => setKind(e.target.value as OverrideKind)} style={{ marginTop: 6 }}>
                            {(Object.keys(KIND_META) as OverrideKind[]).map(k => (
                                <option key={k} value={k}>{KIND_META[k].label}</option>
                            ))}
                        </select>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{KIND_META[kind].description}</div>
                    </div>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Reason (required)</label>
                        <input className="input" placeholder="Document why this override is needed" value={reason} onChange={e => setReason(e.target.value)} style={{ marginTop: 6 }} />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Expires (h)</label>
                        <input className="input" type="number" min="0" step="0.5" value={expiresInHours} onChange={e => setExpiresInHours(e.target.value)} style={{ marginTop: 6 }} />
                    </div>
                    <button className="btn btn-danger" onClick={activate} disabled={creating}>
                        {creating ? <><Loader2 size={14} className="spin" /> Activating</> : <><Power size={14} /> Activate</>}
                    </button>
                </div>
                {error && <div className="login-error" role="alert" aria-live="polite" style={{ marginTop: 10 }}>{error}</div>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600 }}>Active overrides ({activeRows.length})</h2>
                <button className="btn btn-secondary" onClick={load} aria-label="Refresh overrides"><RefreshCw size={14} /></button>
            </div>

            {loading ? (
                <div className="dash-loading-center"><Loader2 className="spin" size={28} /></div>
            ) : activeRows.length === 0 ? (
                <div className="dash-empty" style={{ marginBottom: 24 }}><CheckCircle size={28} /><div>No active overrides. System running normally.</div></div>
            ) : (
                <div className="dash-list" style={{ gap: 10, marginBottom: 24 }}>
                    {activeRows.map(r => (
                        <div key={r.id} className="card" style={{ borderColor: 'var(--accent-warning)', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <ShieldAlert size={14} color="var(--accent-warning)" /> {KIND_META[r.kind].label}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{r.reason}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 12 }}>
                                    <span><Clock size={10} style={{ verticalAlign: 'middle' }} /> Activated {new Date(r.activated_at).toLocaleString()}</span>
                                    {r.expires_at && <span>Expires {new Date(r.expires_at).toLocaleString()}</span>}
                                </div>
                            </div>
                            <button className="btn btn-secondary" onClick={() => deactivate(r)} disabled={busyId === r.id}>
                                {busyId === r.id ? <Loader2 size={14} className="spin" /> : <XCircle size={14} />} Deactivate
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>History</h2>
            {historicalRows.length === 0 ? (
                <div className="dash-empty"><Clock size={28} /><div>No past overrides.</div></div>
            ) : (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Activated</th>
                                <th>Kind</th>
                                <th>Reason</th>
                                <th>Deactivated</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historicalRows.map(r => (
                                <tr key={r.id}>
                                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.activated_at).toLocaleString()}</td>
                                    <td>{KIND_META[r.kind].label}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{r.reason}</td>
                                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                                        {r.deactivated_at ? new Date(r.deactivated_at).toLocaleString() : (r.expires_at ? `expired ${new Date(r.expires_at).toLocaleString()}` : '—')}
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

export default AdminOverride;
