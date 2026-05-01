import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../hooks/useActivityLogger';
import {
    ToggleRight, Loader2, RefreshCw, AlertTriangle, Save, Plus, X,
} from 'lucide-react';

type Audience = 'all' | 'admin' | 'teacher' | 'student' | 'beta';

interface FeatureFlag {
    key: string;
    label: string;
    description: string | null;
    enabled: boolean;
    rollout_pct: number;
    audience: Audience;
    updated_by: string | null;
    updated_at: string;
    created_at: string;
}

const AUDIENCES: Audience[] = ['all', 'admin', 'teacher', 'student', 'beta'];

const AdminFeatureFlags: React.FC = () => {
    const { profile } = useAuth();
    const [flags, setFlags] = useState<FeatureFlag[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [newFlag, setNewFlag] = useState({ key: '', label: '', description: '', audience: 'all' as Audience });
    const [creating, setCreating] = useState(false);

    const isPower = profile?.role === 'power_admin' || profile?.role === 'system_admin';

    const load = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('feature_flags')
            .select('*')
            .order('label', { ascending: true });
        if (error) setError(error.message);
        else setFlags(data as FeatureFlag[] || []);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const updateFlag = async (key: string, patch: Partial<FeatureFlag>) => {
        setBusyKey(key);
        const { error } = await supabase.from('feature_flags').update(patch).eq('key', key);
        if (error) setError(error.message);
        else {
            setFlags(prev => prev.map(f => f.key === key ? { ...f, ...patch, updated_at: new Date().toISOString() } : f));
            await logAudit('feature_flag_updated', 'feature_flags', key, patch as Record<string, unknown>);
        }
        setBusyKey(null);
    };

    const createFlag = async () => {
        if (!newFlag.key.match(/^[a-z][a-z0-9_]{2,}$/)) {
            setError('Key must be snake_case, starting with a letter (min 3 chars).');
            return;
        }
        if (!newFlag.label.trim()) {
            setError('Label is required.');
            return;
        }
        setCreating(true);
        setError(null);
        const { data, error } = await supabase
            .from('feature_flags')
            .insert({
                key: newFlag.key.trim(),
                label: newFlag.label.trim(),
                description: newFlag.description.trim() || null,
                audience: newFlag.audience,
                enabled: false,
                rollout_pct: 0,
            })
            .select('*')
            .single();
        if (error) setError(error.message);
        else {
            setFlags(prev => [...prev, data as FeatureFlag].sort((a, b) => a.label.localeCompare(b.label)));
            setNewFlag({ key: '', label: '', description: '', audience: 'all' });
            setShowCreate(false);
            await logAudit('feature_flag_created', 'feature_flags', (data as FeatureFlag).key, { audience: newFlag.audience });
        }
        setCreating(false);
    };

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                    <h1><ToggleRight size={24} /> Feature Flags</h1>
                    <p>Roll features out by audience and percentage. Read access is granted to any signed-in user; only Power/System Admins can edit.</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={load} aria-label="Refresh feature flags"><RefreshCw size={14} /></button>
                    {isPower && (
                        <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus size={14} /> New flag</button>
                    )}
                </div>
            </div>

            {!isPower && (
                <div className="card" style={{ marginBottom: 16, borderColor: 'var(--accent-warning)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertTriangle size={16} color="var(--accent-warning)" />
                    <span style={{ fontSize: 13 }}>Read-only view. You can see flags but cannot modify them.</span>
                </div>
            )}
            {error && <div className="login-error" role="alert" aria-live="polite" style={{ marginBottom: 10 }}>{error}</div>}

            {loading ? (
                <div className="dash-loading-center"><Loader2 className="spin" size={28} /></div>
            ) : flags.length === 0 ? (
                <div className="dash-empty"><ToggleRight size={28} /><div>No feature flags defined yet.</div></div>
            ) : (
                <div className="dash-list" style={{ gap: 10 }}>
                    {flags.map(f => (
                        <div key={f.key} className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 140px 130px 130px', gap: 16, alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {f.label}
                                    <code style={{ fontSize: 11, padding: '1px 6px', background: 'var(--bg-inset)', borderRadius: 4, color: 'var(--text-muted)' }}>{f.key}</code>
                                </div>
                                {f.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{f.description}</div>}
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Updated {new Date(f.updated_at).toLocaleString()}</div>
                            </div>
                            <div>
                                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Audience</label>
                                <select
                                    className="input"
                                    value={f.audience}
                                    disabled={!isPower || busyKey === f.key}
                                    onChange={e => updateFlag(f.key, { audience: e.target.value as Audience })}
                                    style={{ marginTop: 4, padding: '6px 10px', fontSize: 12 }}
                                >
                                    {AUDIENCES.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rollout %</label>
                                <input
                                    className="input"
                                    type="number" min={0} max={100} step={5}
                                    value={f.rollout_pct}
                                    disabled={!isPower || busyKey === f.key}
                                    onChange={e => updateFlag(f.key, { rollout_pct: Math.max(0, Math.min(100, parseInt(e.target.value || '0', 10))) })}
                                    style={{ marginTop: 4, padding: '6px 10px', fontSize: 12 }}
                                />
                            </div>
                            <button
                                className={`btn ${f.enabled ? 'btn-success' : 'btn-secondary'}`}
                                disabled={!isPower || busyKey === f.key}
                                onClick={() => updateFlag(f.key, { enabled: !f.enabled })}
                                aria-label={`${f.enabled ? 'Disable' : 'Enable'} ${f.label}`}
                            >
                                {busyKey === f.key ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                                {f.enabled ? 'Enabled' : 'Disabled'}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {showCreate && isPower && (
                <div className="modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h2>New feature flag</h2>
                            <button className="btn btn-ghost" onClick={() => setShowCreate(false)} aria-label="Close modal"><X size={20} /></button>
                        </div>
                        <div className="modal-form">
                            <div className="field">
                                <label className="field-label">KEY</label>
                                <input className="input" placeholder="snake_case_key" value={newFlag.key} onChange={e => setNewFlag(p => ({ ...p, key: e.target.value }))} />
                            </div>
                            <div className="field">
                                <label className="field-label">LABEL</label>
                                <input className="input" placeholder="Human-readable name" value={newFlag.label} onChange={e => setNewFlag(p => ({ ...p, label: e.target.value }))} />
                            </div>
                            <div className="field">
                                <label className="field-label">DESCRIPTION</label>
                                <input className="input" placeholder="What this flag controls" value={newFlag.description} onChange={e => setNewFlag(p => ({ ...p, description: e.target.value }))} />
                            </div>
                            <div className="field">
                                <label className="field-label">AUDIENCE</label>
                                <select className="input" value={newFlag.audience} onChange={e => setNewFlag(p => ({ ...p, audience: e.target.value as Audience }))}>
                                    {AUDIENCES.map(a => <option key={a} value={a}>{a}</option>)}
                                </select>
                            </div>
                            {error && <div className="login-error" role="alert" aria-live="polite">{error}</div>}
                            <button className="btn btn-primary" disabled={creating} onClick={createFlag} style={{ width: '100%', marginTop: 8 }}>
                                {creating ? <><Loader2 size={14} className="spin" /> Creating</> : <><Plus size={14} /> Create flag</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminFeatureFlags;
