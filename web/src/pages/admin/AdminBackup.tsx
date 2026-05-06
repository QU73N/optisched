import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../hooks/useActivityLogger';
import {
    Save, Database, Loader2, RefreshCw, CheckCircle, XCircle, Clock,
    AlertTriangle, Download, PlayCircle,
} from 'lucide-react';

type BackupKind = 'full' | 'schema' | 'data' | 'manual';
type BackupStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

interface BackupJob {
    id: string;
    kind: BackupKind;
    status: BackupStatus;
    note: string | null;
    file_path: string | null;
    size_bytes: number | null;
    created_by: string | null;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
    error_message: string | null;
}

const fmtSize = (b: number | null) => {
    if (!b) return 'N/A';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
    return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const KIND_LABELS: Record<BackupKind, string> = {
    full: 'Full',
    schema: 'Schema Only',
    data: 'Data Only',
    manual: 'Manual Snapshot',
};

const statusBadge = (s: BackupStatus) => {
    const map: Record<BackupStatus, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
        queued: { color: 'var(--text-muted)', bg: 'var(--bg-hover)', icon: <Clock size={11} />, label: 'Queued' },
        running: { color: 'var(--accent-info)', bg: 'var(--accent-primary-subtle)', icon: <Loader2 size={11} className="spin" />, label: 'Running' },
        succeeded: { color: 'var(--accent-success)', bg: 'var(--accent-success-subtle)', icon: <CheckCircle size={11} />, label: 'Succeeded' },
        failed: { color: 'var(--accent-error)', bg: 'var(--accent-error-subtle)', icon: <XCircle size={11} />, label: 'Failed' },
        cancelled: { color: 'var(--text-muted)', bg: 'var(--bg-hover)', icon: <XCircle size={11} />, label: 'Cancelled' },
    };
    const cfg = map[s];
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
            borderRadius: 'var(--radius-full)', fontSize: 11, fontWeight: 600,
            color: cfg.color, background: cfg.bg,
        }}>
            {cfg.icon} {cfg.label}
        </span>
    );
};

const AdminBackup: React.FC = () => {
    const { profile } = useAuth();
    const [jobs, setJobs] = useState<BackupJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [kind, setKind] = useState<BackupKind>('full');
    const [note, setNote] = useState('');
    const [error, setError] = useState<string | null>(null);

    const isPower = profile?.role === 'power_admin' || profile?.role === 'system_admin' || profile?.role === 'admin';

    const load = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('backup_jobs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) setError(error.message);
        else setJobs(data || []);
        setLoading(false);
    }, []);

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            if (!isPower) return;
            setLoading(true);
            const { data, error } = await supabase
                .from('backup_jobs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);
            if (isMounted) {
                if (error) setError(error.message);
                else setJobs(data || []);
                setLoading(false);
            }
        };
        fetchData();
        return () => { isMounted = false; };
    }, [isPower]);

    const createJob = async () => {
        if (!profile?.id) return;
        setCreating(true);
        setError(null);
        const { data, error } = await supabase
            .from('backup_jobs')
            .insert({ kind, note: note.trim() || null, created_by: profile.id, status: 'queued' })
            .select('*')
            .single();
        if (error) setError(error.message);
        else {
            setJobs(prev => [data as BackupJob, ...prev]);
            setNote('');
            await logAudit('backup_job_created', 'backup_jobs', (data as BackupJob).id, { kind });
        }
        setCreating(false);
    };

    if (!isPower) {
        return (
            <div className="dash-empty">
                <AlertTriangle size={28} />
                <div>Backup is restricted to Power Admin / System Admin.</div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                    <h1><Save size={24} /> Backup & Restore</h1>
                    <p>Trigger and review database backup jobs. Execution is handled by the Supabase backup runner.</p>
                </div>
                <button className="btn btn-secondary" onClick={load} aria-label="Refresh backup jobs"><RefreshCw size={14} /></button>
            </div>

            <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--accent-primary)' }}>
                <div style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-primary)' }}>
                        <PlayCircle size={16} /> Queue New Backup
                    </h2>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Create a new backup job</div>
                </div>
                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '200px 1fr auto', alignItems: 'end', paddingBottom: 16, borderBottom: '1px solid var(--border-light)' }}>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, display: 'block' }}>Backup Type</label>
                        <select className="input" value={kind} onChange={e => setKind(e.target.value as BackupKind)}>
                            {Object.entries(KIND_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, display: 'block' }}>Note (Optional)</label>
                        <input className="input" placeholder="e.g., Before semester rollover" value={note} onChange={e => setNote(e.target.value)} />
                    </div>
                    <button className="btn btn-primary" onClick={createJob} disabled={creating}>
                        {creating ? <><Loader2 size={14} className="spin" /> Queueing</> : <><Save size={14} /> Queue Backup</>}
                    </button>
                </div>
                {error && <div className="login-error" role="alert" aria-live="polite" style={{ marginTop: 12 }}>{error}</div>}
            </div>

            <div style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Database size={16} /> Backup Jobs
                </h2>
                {loading ? (
                    <div className="dash-loading-center"><Loader2 className="spin" size={28} /></div>
                ) : jobs.length === 0 ? (
                    <div className="card" style={{ padding: 32, textAlign: 'center', borderStyle: 'dashed' }}>
                        <Database size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>No backup jobs yet</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Queue your first backup job to get started.</div>
                    </div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: 180 }}>Created</th>
                                    <th style={{ width: 140 }}>Type</th>
                                    <th style={{ width: 120 }}>Status</th>
                                    <th style={{ width: 100 }}>Size</th>
                                    <th>Note</th>
                                    <th style={{ width: 120 }}>File</th>
                                </tr>
                            </thead>
                            <tbody>
                                {jobs.map(j => (
                                    <tr key={j.id}>
                                        <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(j.created_at).toLocaleString()}</td>
                                        <td><span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-inset)', fontWeight: 500 }}>{KIND_LABELS[j.kind]}</span></td>
                                        <td>{statusBadge(j.status)}</td>
                                        <td style={{ fontSize: 12 }}>{fmtSize(j.size_bytes)}</td>
                                        <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{j.note || '—'}</td>
                                        <td>
                                            {j.file_path ? (
                                                <a href={j.file_path} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--accent-primary)' }}>
                                                    <Download size={12} /> Download
                                                </a>
                                            ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
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

export default AdminBackup;
