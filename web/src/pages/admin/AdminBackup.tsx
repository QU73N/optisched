import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { logAudit } from '../../hooks/useActivityLogger';
import {
    Save, Database, Loader2, RefreshCw, CheckCircle, XCircle, Clock,
    AlertTriangle, Download, PlayCircle, Upload, Trash2,
} from 'lucide-react';
import {
    createBackup,
    restoreBackup,
    downloadBackup,
    readBackupFile,
    validateBackupData,
} from '../../services/backupService';

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
    const [downloading, setDownloading] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [kind, setKind] = useState<BackupKind>('full');
    const [note, setNote] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [restoreResult, setRestoreResult] = useState<{ success: boolean; message: string } | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

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

    const handleDownloadBackup = async () => {
        setDownloading(true);
        setError(null);
        try {
            const backupData = await createBackup(kind, note.trim() || null);
            downloadBackup(backupData);
            await logAudit('backup_downloaded', 'backup_jobs', null, { kind });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create backup');
        }
        setDownloading(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setRestoring(true);
        setError(null);
        setRestoreResult(null);

        try {
            const backupData = await readBackupFile(file);
            
            if (!validateBackupData(backupData)) {
                throw new Error('Invalid backup file format');
            }

            if (!confirm(`Restore backup from ${backupData.metadata.timestamp}?\n\nThis will DELETE all current data and replace it with the backup. This action cannot be undone.\n\nContinue?`)) {
                setRestoring(false);
                return;
            }

            const result = await restoreBackup(backupData);
            setRestoreResult({ success: result.success, message: result.message });
            
            if (result.success) {
                await logAudit('backup_restored', 'backup_jobs', null, { 
                    backup_id: backupData.metadata.backup_id,
                    timestamp: backupData.metadata.timestamp
                });
            }

            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to restore backup');
        }
        setRestoring(false);
    };

    const handleDeleteJob = async (jobId: string) => {
        if (!confirm('Are you sure you want to delete this backup job? This cannot be undone.')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('backup_jobs')
                .delete()
                .eq('id', jobId);

            if (error) throw error;

            setJobs(prev => prev.filter(j => j.id !== jobId));
            await logAudit('backup_job_deleted', 'backup_jobs', jobId, {});
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete backup job');
        }
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

            <div style={{ maxHeight: 'calc(100vh - 180px)', overflowY: 'auto', overflowX: 'hidden' }}>
            <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--accent-primary)' }}>
                <div style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-primary)' }}>
                        <PlayCircle size={16} /> Create Backup
                    </h2>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Create and download a full database backup</div>
                </div>
                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '200px 1fr auto auto', alignItems: 'end', paddingBottom: 16, borderBottom: '1px solid var(--border-light)' }}>
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
                    <button className="btn btn-primary" onClick={handleDownloadBackup} disabled={downloading}>
                        {downloading ? <><Loader2 size={14} className="spin" /> Creating...</> : <><Download size={14} /> Download Backup</>}
                    </button>
                    <button className="btn btn-secondary" onClick={createJob} disabled={creating}>
                        {creating ? <><Loader2 size={14} className="spin" /> Queueing</> : <><Save size={14} /> Queue Job</>}
                    </button>
                </div>
                {error && <div className="login-error" role="alert" aria-live="polite" style={{ marginTop: 12 }}>{error}</div>}
                {restoreResult && (
                    <div style={{ 
                        marginTop: 12, 
                        padding: 12, 
                        borderRadius: 'var(--radius-sm)', 
                        backgroundColor: restoreResult.success ? 'var(--accent-success-subtle)' : 'var(--accent-error-subtle)',
                        border: `1px solid ${restoreResult.success ? 'var(--accent-success)' : 'var(--accent-error)'}`,
                        color: restoreResult.success ? 'var(--accent-success)' : 'var(--accent-error)',
                        fontSize: 13
                    }}>
                        {restoreResult.success ? <CheckCircle size={14} style={{ display: 'inline', marginRight: 8 }} /> : <XCircle size={14} style={{ display: 'inline', marginRight: 8 }} />}
                        {restoreResult.message}
                    </div>
                )}
            </div>

            <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--accent-info)' }}>
                <div style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-info)' }}>
                        <Upload size={16} /> Restore Backup
                    </h2>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Restore database from a backup JSON file</div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        disabled={restoring}
                        style={{ fontSize: 13 }}
                    />
                    {restoring && <Loader2 size={16} className="spin" />}
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                    Warning: Restore will replace existing data. Make sure to backup before restoring.
                </div>
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
                                    <th style={{ width: 80 }}>Actions</th>
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
                                        <td>
                                            <button
                                                onClick={() => handleDeleteJob(j.id)}
                                                style={{ 
                                                    padding: 4, 
                                                    borderRadius: 4, 
                                                    border: 'none', 
                                                    backgroundColor: 'var(--accent-error-10, rgba(200, 75, 75, 0.1))', 
                                                    color: 'var(--accent-error)', 
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                title="Delete backup job"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            </div>
        </div>
    );
};

export default AdminBackup;
