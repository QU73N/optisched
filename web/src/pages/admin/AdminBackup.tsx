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

const statusBadge = (s: BackupStatus) => {
    const map: Record<BackupStatus, { color: string; bg: string; icon: React.ReactNode }> = {
        queued: { color: 'var(--text-muted)', bg: 'var(--bg-hover)', icon: <Clock size={11} /> },
        running: { color: 'var(--accent-info)', bg: 'var(--accent-primary-subtle)', icon: <Loader2 size={11} className="spin" /> },
        succeeded: { color: 'var(--accent-success)', bg: 'var(--accent-success-subtle)', icon: <CheckCircle size={11} /> },
        failed: { color: 'var(--accent-error)', bg: 'var(--accent-error-subtle)', icon: <XCircle size={11} /> },
        cancelled: { color: 'var(--text-muted)', bg: 'var(--bg-hover)', icon: <XCircle size={11} /> },
    };
    const cfg = map[s];
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px',
            borderRadius: 'var(--radius-full)', fontSize: 11, fontWeight: 600,
            color: cfg.color, background: cfg.bg, textTransform: 'uppercase', letterSpacing: 0.4,
        }}>
            {cfg.icon} {s}
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

    useEffect(() => { if (isPower) load(); }, [isPower, load]); // eslint-disable-line react-hooks/exhaustive-deps

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
            <div className="page-header">
                <h1><Save size={24} /> Backup &amp; Restore</h1>
                <p>Trigger and review database backup jobs. Actual execution is handled by the Supabase backup runner.</p>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <PlayCircle size={16} /> Queue a new backup
                </h2>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '0 0 220px' }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Kind</label>
                        <select className="input" value={kind} onChange={e => setKind(e.target.value as BackupKind)} style={{ marginTop: 6 }}>
                            <option value="full">Full (schema + data)</option>
                            <option value="schema">Schema only</option>
                            <option value="data">Data only</option>
                            <option value="manual">Manual snapshot</option>
                        </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Note (optional)</label>
                        <input className="input" placeholder="e.g. before semester rollover" value={note} onChange={e => setNote(e.target.value)} style={{ marginTop: 6 }} />
                    </div>
                    <button className="btn btn-primary" onClick={createJob} disabled={creating}>
                        {creating ? <><Loader2 size={14} className="spin" /> Queueing</> : <><Save size={14} /> Queue Backup</>}
                    </button>
                </div>
                {error && <div className="login-error" role="alert" aria-live="polite" style={{ marginTop: 10 }}>{error}</div>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Database size={16} /> Recent jobs
                </h2>
                <button className="btn btn-secondary" onClick={load} aria-label="Refresh backup jobs"><RefreshCw size={14} /></button>
            </div>

            {loading ? (
                <div className="dash-loading-center"><Loader2 className="spin" size={28} /></div>
            ) : jobs.length === 0 ? (
                <div className="dash-empty"><Database size={28} /><div>No backup jobs yet.</div></div>
            ) : (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Created</th>
                                <th>Kind</th>
                                <th>Status</th>
                                <th>Size</th>
                                <th>Note</th>
                                <th>File</th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.map(j => (
                                <tr key={j.id}>
                                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(j.created_at).toLocaleString()}</td>
                                    <td>{j.kind}</td>
                                    <td>{statusBadge(j.status)}</td>
                                    <td>{fmtSize(j.size_bytes)}</td>
                                    <td style={{ color: 'var(--text-secondary)' }}>{j.note || 'None'}</td>
                                    <td>
                                        {j.file_path ? (
                                            <a href={j.file_path} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <Download size={12} /> Download
                                            </a>
                                        ) : 'N/A'}
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

export default AdminBackup;
