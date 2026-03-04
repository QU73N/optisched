import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, RotateCcw, Layers, Clock, CheckCircle, Trash2, Plus, Eye } from 'lucide-react';
import '../admin/Dashboard.css';

interface VersionSnapshot {
    id: string;
    name: string;
    description: string;
    entryCount: number;
    createdAt: string;
    data: any[];
}

const STORAGE_KEY = 'optisched_versions';

const VersionManager: React.FC = () => {
    const [versions, setVersions] = useState<VersionSnapshot[]>([]);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saveName, setSaveName] = useState('');
    const [saveDesc, setSaveDesc] = useState('');
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [previewVersion, setPreviewVersion] = useState<VersionSnapshot | null>(null);
    const [restoring, setRestoring] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setVersions(JSON.parse(stored));
        fetchSchedules();
    }, []);

    const fetchSchedules = async () => {
        setLoading(true);
        const { data } = await supabase.from('schedules')
            .select('*, subject:subjects(name, code), teacher:teachers(profile:profiles(full_name)), room:rooms(name), section:sections(name)')
            .order('day_of_week');
        setSchedules(data || []);
        setLoading(false);
    };

    const saveVersion = () => {
        if (!saveName.trim()) return;
        const newVersion: VersionSnapshot = {
            id: Date.now().toString(),
            name: saveName.trim(),
            description: saveDesc.trim(),
            entryCount: schedules.length,
            createdAt: new Date().toISOString(),
            data: schedules,
        };
        const updated = [newVersion, ...versions];
        setVersions(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setShowSaveModal(false);
        setSaveName('');
        setSaveDesc('');
    };

    const deleteVersion = (id: string) => {
        if (!confirm('Delete this version snapshot?')) return;
        const filtered = versions.filter(v => v.id !== id);
        setVersions(filtered);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    };

    const restoreVersion = async (version: VersionSnapshot) => {
        if (!confirm(`Restore "${version.name}"? This will replace ALL current schedules with this snapshot (${version.entryCount} entries).`)) return;
        setRestoring(true);
        try {
            // Delete current
            await supabase.from('schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            // Insert snapshot data
            const inserts = version.data.map((s: any) => ({
                subject_id: s.subject_id,
                teacher_id: s.teacher_id,
                room_id: s.room_id,
                section_id: s.section_id,
                day_of_week: s.day_of_week,
                start_time: s.start_time,
                end_time: s.end_time,
                status: s.status || 'published',
            }));
            if (inserts.length > 0) {
                const { error } = await supabase.from('schedules').insert(inserts);
                if (error) throw error;
            }
            await fetchSchedules();
            alert('Schedule restored successfully.');
        } catch (err: any) {
            alert('Error: ' + (err.message || 'Failed to restore'));
        } finally {
            setRestoring(false);
        }
    };

    const formatDate = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Version Manager</h1>
                    <p className="dashboard-subtitle">{versions.length} saved snapshots · {schedules.length} current entries</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowSaveModal(true)} disabled={loading}>
                    <Save size={16} /> Save Current
                </button>
            </div>

            {/* Current State */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-icon"><Layers size={20} /></div>
                    <div className="stat-number">{versions.length}</div>
                    <div className="stat-label">Saved Versions</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><Clock size={20} /></div>
                    <div className="stat-number">{schedules.length}</div>
                    <div className="stat-label">Current Entries</div>
                </div>
            </div>

            {/* Versions List */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : versions.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 60 }}>
                    <Layers size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No saved versions yet</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Save the current schedule state to create a rollback point</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {versions.map((v, i) => (
                        <div key={v.id} className="card" style={{ borderLeft: `3px solid ${i === 0 ? '#34d399' : 'var(--border-default)'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{v.name}</span>
                                        {i === 0 && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(34,197,94,0.12)', color: '#34d399', fontWeight: 700 }}>LATEST</span>}
                                    </div>
                                    {v.description && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 6px' }}>{v.description}</p>}
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 16 }}>
                                        <span>{v.entryCount} entries</span>
                                        <span>{formatDate(v.createdAt)}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => setPreviewVersion(previewVersion?.id === v.id ? null : v)}>
                                        <Eye size={14} /> Preview
                                    </button>
                                    <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: 12 }} onClick={() => restoreVersion(v)} disabled={restoring}>
                                        <RotateCcw size={14} /> Restore
                                    </button>
                                    <button className="btn btn-ghost" style={{ padding: '6px 10px', color: '#ef4444' }} onClick={() => deleteVersion(v.id)}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Preview */}
                            {previewVersion?.id === v.id && (
                                <div className="table-container" style={{ marginTop: 12, maxHeight: 280, overflow: 'auto' }}>
                                    <table>
                                        <thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th><th>Section</th></tr></thead>
                                        <tbody>
                                            {v.data.slice(0, 20).map((s: any, idx: number) => (
                                                <tr key={idx}>
                                                    <td>{s.day_of_week}</td>
                                                    <td>{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</td>
                                                    <td>{s.subject?.code || ''} {s.subject?.name || '-'}</td>
                                                    <td>{s.teacher?.profile?.full_name || '-'}</td>
                                                    <td>{s.room?.name || '-'}</td>
                                                    <td>{s.section?.name || '-'}</td>
                                                </tr>
                                            ))}
                                            {v.data.length > 20 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>...and {v.data.length - 20} more</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Save Modal */}
            {showSaveModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="card" style={{ width: 420 }}>
                        <h3 className="card-title">Save Version Snapshot</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>This saves a copy of the current schedule ({schedules.length} entries) that can be restored later.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <label className="input-label">Version Name</label>
                                <input className="input" value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="e.g. Week 1 Draft" />
                            </div>
                            <div>
                                <label className="input-label">Description (optional)</label>
                                <input className="input" value={saveDesc} onChange={e => setSaveDesc(e.target.value)} placeholder="Notes about this version..." />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                            <button className="btn btn-primary" onClick={saveVersion} disabled={!saveName.trim()} style={{ flex: 1 }}>
                                <CheckCircle size={16} /> Save Snapshot
                            </button>
                            <button className="btn btn-ghost" onClick={() => setShowSaveModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VersionManager;
