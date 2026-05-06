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

    const isPower = profile?.role === 'power_admin' || profile?.role === 'system_admin' || profile?.role === 'admin';

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
        let isMounted = true;
        const fetchData = async () => {
            if (!isPower) return;
            setLoading(true);
            const { data, error } = await supabase
                .from('emergency_overrides')
                .select('*')
                .order('activated_at', { ascending: false })
                .limit(50);
            if (isMounted) {
                if (error) setError(error.message);
                else setRows(data as OverrideRow[] || []);
                setLoading(false);
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [isPower]);

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
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                    <h1><AlertOctagon size={24} /> Emergency Overrides</h1>
                    <p>Activate temporary system-wide overrides. All actions are logged for audit purposes.</p>
                </div>
                <button className="btn btn-secondary" onClick={load} aria-label="Refresh overrides"><RefreshCw size={14} /></button>
            </div>

            <div className="card" style={{ marginBottom: 24, borderColor: 'var(--accent-warning)', borderLeftWidth: 4 }}>
                <div style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-warning)' }}>
                        <ShieldAlert size={16} /> New Override
                    </h2>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Configure and activate a system override</div>
                </div>
                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '240px 1fr 120px auto', alignItems: 'end', paddingBottom: 16, borderBottom: '1px solid var(--border-light)' }}>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, display: 'block' }}>Override Type</label>
                        <select className="input" value={kind} onChange={e => setKind(e.target.value as OverrideKind)}>
                            {(Object.keys(KIND_META) as OverrideKind[]).map(k => (
                                <option key={k} value={k}>{KIND_META[k].label}</option>
                            ))}
                        </select>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>{KIND_META[kind].description}</div>
                    </div>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, display: 'block' }}>Reason <span style={{ color: 'var(--accent-error)' }}>*</span></label>
                        <input className="input" placeholder="Explain why this override is needed (min 8 chars)" value={reason} onChange={e => setReason(e.target.value)} />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, display: 'block' }}>Expires (hours)</label>
                        <input className="input" type="number" min="0" step="0.5" value={expiresInHours} onChange={e => setExpiresInHours(e.target.value)} placeholder="0 = never" />
                    </div>
                    <button className="btn btn-danger" onClick={activate} disabled={creating || !reason.trim()}>
                        {creating ? <><Loader2 size={14} className="spin" /> Activating</> : <><Power size={14} /> Activate</>}
                    </button>
                </div>
                {error && <div className="login-error" role="alert" aria-live="polite" style={{ marginTop: 12 }}>{error}</div>}
            </div>

            <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: 'var(--accent-error)', color: 'white', fontSize: 11 }}>{activeRows.length}</span>
                    Active Overrides
                </h2>
                {loading ? (
                    <div className="dash-loading-center"><Loader2 className="spin" size={28} /></div>
                ) : activeRows.length === 0 ? (
                    <div className="card" style={{ padding: 32, textAlign: 'center', borderStyle: 'dashed' }}>
                        <CheckCircle size={32} style={{ color: 'var(--accent-success)', marginBottom: 12 }} />
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>No active overrides</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>System is running normally with all standard safeguards in place.</div>
                    </div>
                ) : (
                    <div className="dash-list" style={{ gap: 8 }}>
                        {activeRows.map(r => (
                            <div key={r.id} className="card" style={{ borderLeft: '4px solid var(--accent-warning)', display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', padding: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <ShieldAlert size={14} color="var(--accent-warning)" /> {KIND_META[r.kind].label}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{r.reason}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 16, alignItems: 'center' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} /> {new Date(r.activated_at).toLocaleString()}</span>
                                        {r.expires_at && <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-warning)' }}><AlertTriangle size={10} /> Expires {new Date(r.expires_at).toLocaleString()}</span>}
                                    </div>
                                </div>
                                <button className="btn btn-secondary" onClick={() => deactivate(r)} disabled={busyId === r.id} style={{ padding: '6px 12px', fontSize: 12 }}>
                                    {busyId === r.id ? <Loader2 size={12} className="spin" /> : <><XCircle size={12} /> Deactivate</>}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>History</h2>
                {historicalRows.length === 0 ? (
                    <div className="card" style={{ padding: 32, textAlign: 'center', borderStyle: 'dashed' }}>
                        <Clock size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>No override history</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Past overrides will appear here once deactivated or expired.</div>
                    </div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: 180 }}>Activated</th>
                                    <th style={{ width: 200 }}>Type</th>
                                    <th>Reason</th>
                                    <th style={{ width: 180 }}>Deactivated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historicalRows.map(r => (
                                    <tr key={r.id}>
                                        <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(r.activated_at).toLocaleString()}</td>
                                        <td><span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-inset)', fontWeight: 500 }}>{KIND_META[r.kind].label}</span></td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{r.reason}</td>
                                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: 12 }}>
                                            {r.deactivated_at ? new Date(r.deactivated_at).toLocaleString() : (r.expires_at ? `Expired ${new Date(r.expires_at).toLocaleString()}` : 'N/A')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminOverride;
