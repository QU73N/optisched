import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Database, BookOpen, MapPin, Users, Plus, Trash2, X, Loader2, Layers } from 'lucide-react';
import '../admin/Dashboard.css';

type Tab = 'rooms' | 'subjects' | 'sections';

const DataManagement: React.FC = () => {
    const [tab, setTab] = useState<Tab>('rooms');
    const [rooms, setRooms] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Add modals
    const [showAddRoom, setShowAddRoom] = useState(false);
    const [showAddSubject, setShowAddSubject] = useState(false);
    const [showAddSection, setShowAddSection] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form state
    const [newRoom, setNewRoom] = useState({ name: '', capacity: 40, type: 'lecture', building: '', floor: 1 });
    const [newSubject, setNewSubject] = useState({ code: '', name: '', units: 3, type: 'lecture', duration_hours: 1, program: '', year_level: 1, requires_lab: false });
    const [newSection, setNewSection] = useState({ name: '', program: '', year_level: 1, student_count: 30 });

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        const [r, s, sec] = await Promise.all([
            supabase.from('rooms').select('*').order('name'),
            supabase.from('subjects').select('*').order('code'),
            supabase.from('sections').select('*').order('program').order('year_level').order('name'),
        ]);
        setRooms(r.data || []);
        setSubjects(s.data || []);
        setSections(sec.data || []);
        setLoading(false);
    };

    const handleAddRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await supabase.from('rooms').insert({ ...newRoom, is_available: true, equipment: [] });
        setShowAddRoom(false);
        setNewRoom({ name: '', capacity: 40, type: 'lecture', building: '', floor: 1 });
        setSaving(false);
        fetchAll();
    };

    const handleAddSubject = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await supabase.from('subjects').insert(newSubject);
        setShowAddSubject(false);
        setNewSubject({ code: '', name: '', units: 3, type: 'lecture', duration_hours: 1, program: '', year_level: 1, requires_lab: false });
        setSaving(false);
        fetchAll();
    };

    const handleAddSection = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await supabase.from('sections').insert(newSection);
        setShowAddSection(false);
        setNewSection({ name: '', program: '', year_level: 1, student_count: 30 });
        setSaving(false);
        fetchAll();
    };

    const handleDelete = async (table: string, id: string, label: string) => {
        if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
        await supabase.from(table).delete().eq('id', id);
        fetchAll();
    };

    const tabs: { key: Tab; label: string; icon: React.ElementType; count: number }[] = [
        { key: 'rooms', label: 'Rooms', icon: MapPin, count: rooms.length },
        { key: 'subjects', label: 'Subjects', icon: BookOpen, count: subjects.length },
        { key: 'sections', label: 'Sections', icon: Layers, count: sections.length },
    ];

    const getAddAction = () => {
        if (tab === 'rooms') return () => setShowAddRoom(true);
        if (tab === 'subjects') return () => setShowAddSubject(true);
        return () => setShowAddSection(true);
    };

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Data Management</h1>
                    <p className="dashboard-subtitle">Manage rooms, subjects, and sections</p>
                </div>
                <button className="btn btn-primary" onClick={getAddAction()}>
                    <Plus size={16} />
                    Add {tab === 'rooms' ? 'Room' : tab === 'subjects' ? 'Subject' : 'Section'}
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 4, border: '1px solid var(--border-default)' }}>
                {tabs.map(t => (
                    <button key={t.key}
                        className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ flex: 1, borderRadius: 'var(--radius-sm)' }}
                        onClick={() => setTab(t.key)}
                    >
                        <t.icon size={16} />
                        {t.label} ({t.count})
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : (
                <>
                    {/* Rooms Table */}
                    {tab === 'rooms' && (
                        <div className="table-container">
                            <table>
                                <thead><tr><th>Name</th><th>Building</th><th>Floor</th><th>Type</th><th>Capacity</th><th>Status</th><th style={{ width: 60 }}></th></tr></thead>
                                <tbody>
                                    {rooms.map(r => (
                                        <tr key={r.id}>
                                            <td style={{ fontWeight: 600 }}>{r.name}</td>
                                            <td>{r.building}</td>
                                            <td>{r.floor}</td>
                                            <td><span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>{r.type?.toUpperCase()}</span></td>
                                            <td>{r.capacity}</td>
                                            <td><span className="badge" style={{ background: r.is_available ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: r.is_available ? '#34d399' : '#ef4444' }}>{r.is_available ? 'AVAILABLE' : 'UNAVAILABLE'}</span></td>
                                            <td><button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => handleDelete('rooms', r.id, r.name)}><Trash2 size={15} style={{ color: 'var(--accent-error)' }} /></button></td>
                                        </tr>
                                    ))}
                                    {rooms.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No rooms added yet.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Subjects Table */}
                    {tab === 'subjects' && (
                        <div className="table-container">
                            <table>
                                <thead><tr><th>Code</th><th>Name</th><th>Units</th><th>Type</th><th>Program</th><th>Year</th><th>Hours</th><th style={{ width: 60 }}></th></tr></thead>
                                <tbody>
                                    {subjects.map(s => (
                                        <tr key={s.id}>
                                            <td style={{ fontWeight: 600 }}>{s.code}</td>
                                            <td>{s.name}</td>
                                            <td>{s.units}</td>
                                            <td><span className="badge" style={{ background: s.type === 'laboratory' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)', color: s.type === 'laboratory' ? '#fbbf24' : '#60a5fa' }}>{s.type?.toUpperCase()}</span></td>
                                            <td>{s.program}</td>
                                            <td>{s.year_level}</td>
                                            <td>{s.duration_hours}h</td>
                                            <td><button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => handleDelete('subjects', s.id, s.code)}><Trash2 size={15} style={{ color: 'var(--accent-error)' }} /></button></td>
                                        </tr>
                                    ))}
                                    {subjects.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No subjects added yet.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Sections Table */}
                    {tab === 'sections' && (
                        <div className="table-container">
                            <table>
                                <thead><tr><th>Name</th><th>Program</th><th>Year Level</th><th>Students</th><th style={{ width: 60 }}></th></tr></thead>
                                <tbody>
                                    {sections.map(s => (
                                        <tr key={s.id}>
                                            <td style={{ fontWeight: 600 }}>{s.name}</td>
                                            <td>{s.program}</td>
                                            <td>{s.year_level >= 11 ? `Grade ${s.year_level}` : `Year ${s.year_level}`}</td>
                                            <td>{s.student_count}</td>
                                            <td><button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => handleDelete('sections', s.id, s.name)}><Trash2 size={15} style={{ color: 'var(--accent-error)' }} /></button></td>
                                        </tr>
                                    ))}
                                    {sections.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No sections added yet.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* Add Room Modal */}
            {showAddRoom && (
                <div className="modal-overlay" onClick={() => setShowAddRoom(false)}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Add Room</h2><button className="btn btn-ghost" onClick={() => setShowAddRoom(false)}><X size={20} /></button></div>
                        <form onSubmit={handleAddRoom} className="modal-form">
                            <div className="field"><label className="field-label">ROOM NAME</label><input className="input" required placeholder="e.g. Lab 201" value={newRoom.name} onChange={e => setNewRoom(p => ({ ...p, name: e.target.value }))} /></div>
                            <div className="field"><label className="field-label">BUILDING</label><input className="input" required placeholder="e.g. Main Building" value={newRoom.building} onChange={e => setNewRoom(p => ({ ...p, building: e.target.value }))} /></div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div className="field" style={{ flex: 1 }}><label className="field-label">FLOOR</label><input className="input" type="number" min={1} value={newRoom.floor} onChange={e => setNewRoom(p => ({ ...p, floor: parseInt(e.target.value) }))} /></div>
                                <div className="field" style={{ flex: 1 }}><label className="field-label">CAPACITY</label><input className="input" type="number" min={1} value={newRoom.capacity} onChange={e => setNewRoom(p => ({ ...p, capacity: parseInt(e.target.value) }))} /></div>
                            </div>
                            <div className="field"><label className="field-label">TYPE</label>
                                <select className="input" value={newRoom.type} onChange={e => setNewRoom(p => ({ ...p, type: e.target.value }))}>
                                    <option value="lecture">Lecture</option><option value="laboratory">Laboratory</option><option value="computer_lab">Computer Lab</option><option value="gymnasium">Gymnasium</option>
                                </select>
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Add Room'}</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Subject Modal */}
            {showAddSubject && (
                <div className="modal-overlay" onClick={() => setShowAddSubject(false)}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Add Subject</h2><button className="btn btn-ghost" onClick={() => setShowAddSubject(false)}><X size={20} /></button></div>
                        <form onSubmit={handleAddSubject} className="modal-form">
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div className="field" style={{ flex: 1 }}><label className="field-label">CODE</label><input className="input" required placeholder="e.g. CS101" value={newSubject.code} onChange={e => setNewSubject(p => ({ ...p, code: e.target.value }))} /></div>
                                <div className="field" style={{ flex: 2 }}><label className="field-label">NAME</label><input className="input" required placeholder="Introduction to Computing" value={newSubject.name} onChange={e => setNewSubject(p => ({ ...p, name: e.target.value }))} /></div>
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div className="field" style={{ flex: 1 }}><label className="field-label">UNITS</label><input className="input" type="number" min={1} max={6} value={newSubject.units} onChange={e => setNewSubject(p => ({ ...p, units: parseInt(e.target.value) }))} /></div>
                                <div className="field" style={{ flex: 1 }}><label className="field-label">HOURS</label><input className="input" type="number" min={1} max={6} value={newSubject.duration_hours} onChange={e => setNewSubject(p => ({ ...p, duration_hours: parseInt(e.target.value) }))} /></div>
                                <div className="field" style={{ flex: 1 }}><label className="field-label">TYPE</label><select className="input" value={newSubject.type} onChange={e => setNewSubject(p => ({ ...p, type: e.target.value }))}><option value="lecture">Lecture</option><option value="laboratory">Laboratory</option></select></div>
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div className="field" style={{ flex: 2 }}><label className="field-label">PROGRAM</label><input className="input" required placeholder="e.g. BSIT" value={newSubject.program} onChange={e => setNewSubject(p => ({ ...p, program: e.target.value }))} /></div>
                                <div className="field" style={{ flex: 1 }}><label className="field-label">YEAR LEVEL</label><input className="input" type="number" min={1} max={12} value={newSubject.year_level} onChange={e => setNewSubject(p => ({ ...p, year_level: parseInt(e.target.value) }))} /></div>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}>
                                <input type="checkbox" checked={newSubject.requires_lab} onChange={e => setNewSubject(p => ({ ...p, requires_lab: e.target.checked }))} />
                                Requires Lab Room
                            </label>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Add Subject'}</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Section Modal */}
            {showAddSection && (
                <div className="modal-overlay" onClick={() => setShowAddSection(false)}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Add Section</h2><button className="btn btn-ghost" onClick={() => setShowAddSection(false)}><X size={20} /></button></div>
                        <form onSubmit={handleAddSection} className="modal-form">
                            <div className="field"><label className="field-label">SECTION NAME</label><input className="input" required placeholder="e.g. BSIT-1A" value={newSection.name} onChange={e => setNewSection(p => ({ ...p, name: e.target.value }))} /></div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div className="field" style={{ flex: 2 }}><label className="field-label">PROGRAM</label><input className="input" required placeholder="e.g. BSIT" value={newSection.program} onChange={e => setNewSection(p => ({ ...p, program: e.target.value }))} /></div>
                                <div className="field" style={{ flex: 1 }}><label className="field-label">YEAR LEVEL</label><input className="input" type="number" min={1} max={12} value={newSection.year_level} onChange={e => setNewSection(p => ({ ...p, year_level: parseInt(e.target.value) }))} /></div>
                            </div>
                            <div className="field"><label className="field-label">STUDENT COUNT</label><input className="input" type="number" min={1} value={newSection.student_count} onChange={e => setNewSection(p => ({ ...p, student_count: parseInt(e.target.value) }))} /></div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Add Section'}</button>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 24px; }
                .modal-content { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-xl); padding: 28px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
                .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                .modal-header h2 { font-size: 20px; font-weight: 700; color: var(--text-primary); }
                .modal-form { display: flex; flex-direction: column; gap: 16px; }
                .field { display: flex; flex-direction: column; gap: 6px; }
                .field-label { font-size: 10px; font-weight: 600; color: var(--text-muted); letter-spacing: 1.5px; padding-left: 2px; }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};

export default DataManagement;
