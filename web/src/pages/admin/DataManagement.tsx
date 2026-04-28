import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { hasAnyRole } from '../../types/database';
import { BookOpen, MapPin, Plus, Trash2, X, Loader2, Layers, Lock, Edit, Folder } from 'lucide-react';
import '../admin/Dashboard.css';

type Tab = 'rooms' | 'subjects' | 'sections';

interface Room {
    id: string;
    name: string;
    building: string;
    floor: number;
    type: string;
    capacity: number;
    is_available: boolean;
    weight: number;
    priority_note: string | null;
    owner_id: string | null;
    is_public: boolean;
    shared_with: string[];
}

interface Subject {
    id: string;
    code: string;
    name: string;
    units: number;
    type: string;
    program: string;
    year_level: number;
    duration_hours: number;
    requires_lab: boolean;
    weight: number;
    priority_note: string | null;
    owner_id: string | null;
    is_public: boolean;
    shared_with: string[];
}

interface Section {
    id: string;
    name: string;
    program: string;
    year_level: number;
    student_count: number;
    parent_id: string | null;
    weight: number;
    path: string;
    node_type: 'group' | 'section';
    is_active: boolean;
    description: string | null;
    metadata: Record<string, unknown>;
    sort_order: number;
    owner_id: string | null;
    is_public: boolean;
    shared_with: string[];
}

const DataManagement: React.FC = () => {
    const { role, roles } = useAuth();
    const allRoles = roles.length > 0 ? roles : (role ? [role] : []);
    const canEdit = hasAnyRole(allRoles, ['admin', 'schedule_manager', 'schedule_admin', 'power_admin', 'system_admin']);
    const [tab, setTab] = useState<Tab>('rooms');
    const [rooms, setRooms] = useState<Room[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [loading, setLoading] = useState(true);

    // Add modals
    const [showAddRoom, setShowAddRoom] = useState(false);
    const [showAddSubject, setShowAddSubject] = useState(false);
    const [showAddSection, setShowAddSection] = useState(false);
    const [saving, setSaving] = useState(false);

    // Edit modals
    const [showEditRoom, setShowEditRoom] = useState(false);
    const [showEditSubject, setShowEditSubject] = useState(false);
    const [showEditSection, setShowEditSection] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form state
    const [newRoom, setNewRoom] = useState({ name: '', capacity: 40, type: 'lecture', building: '', floor: 1, weight: 50, priority_note: '', owner_id: null as string | null, is_public: false, shared_with: [] as string[] });
    const [newSubject, setNewSubject] = useState({ code: '', name: '', units: 3, type: 'lecture', duration_hours: 1, program: '', year_level: 1, requires_lab: false, weight: 50, priority_note: '', owner_id: null as string | null, is_public: false, shared_with: [] as string[] });
    const [newSection, setNewSection] = useState({ name: '', program: '', year_level: 1, student_count: 30, parent_id: null as string | null, weight: 50, node_type: 'section' as 'group' | 'section', description: '', sort_order: 0, owner_id: null as string | null, is_public: false, shared_with: [] as string[] });
    const [editRoom, setEditRoom] = useState({ name: '', capacity: 40, type: 'lecture', building: '', floor: 1, weight: 50, priority_note: '', owner_id: null as string | null, is_public: false, shared_with: [] as string[] });
    const [editSubject, setEditSubject] = useState({ code: '', name: '', units: 3, type: 'lecture', duration_hours: 1, program: '', year_level: 1, requires_lab: false, weight: 50, priority_note: '', owner_id: null as string | null, is_public: false, shared_with: [] as string[] });
    const [editSection, setEditSection] = useState({ name: '', program: '', year_level: 1, student_count: 30, parent_id: null as string | null, weight: 50, node_type: 'section' as 'group' | 'section', description: '', sort_order: 0, owner_id: null as string | null, is_public: false, shared_with: [] as string[] });

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

    useEffect(() => { fetchAll(); }, []);

    const handleAddRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await supabase.from('rooms').insert({ ...newRoom, is_available: true, equipment: [] });
        setShowAddRoom(false);
        setNewRoom({ name: '', capacity: 40, type: 'lecture', building: '', floor: 1, weight: 50, priority_note: '', owner_id: null, is_public: false, shared_with: [] });
        setSaving(false);
        fetchAll();
    };

    const handleAddSubject = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await supabase.from('subjects').insert(newSubject);
        setShowAddSubject(false);
        setNewSubject({ code: '', name: '', units: 3, type: 'lecture', duration_hours: 1, program: '', year_level: 1, requires_lab: false, weight: 50, priority_note: '', owner_id: null, is_public: false, shared_with: [] });
        setSaving(false);
        fetchAll();
    };

    const handleAddSection = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await supabase.from('sections').insert(newSection);
        setShowAddSection(false);
        setNewSection({ name: '', program: '', year_level: 1, student_count: 30, parent_id: null, weight: 50, node_type: 'section', description: '', sort_order: 0, owner_id: null, is_public: false, shared_with: [] });
        setSaving(false);
        fetchAll();
    };

    const handleDelete = async (table: string, id: string, label: string) => {
        if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
        await supabase.from(table).delete().eq('id', id);
        fetchAll();
    };

    const openEditRoom = (room: Room) => {
        setEditRoom({ name: room.name, capacity: room.capacity, type: room.type, building: room.building, floor: room.floor, weight: room.weight, priority_note: room.priority_note || '', owner_id: room.owner_id, is_public: room.is_public, shared_with: room.shared_with });
        setEditingId(room.id);
        setShowEditRoom(true);
    };

    const openEditSubject = (subject: Subject) => {
        setEditSubject({
            code: subject.code,
            name: subject.name,
            units: subject.units,
            type: subject.type,
            duration_hours: subject.duration_hours,
            program: subject.program,
            year_level: subject.year_level,
            requires_lab: subject.requires_lab || false,
            weight: subject.weight,
            priority_note: subject.priority_note || '',
            owner_id: subject.owner_id,
            is_public: subject.is_public,
            shared_with: subject.shared_with,
        });
        setEditingId(subject.id);
        setShowEditSubject(true);
    };

    const openEditSection = (section: Section) => {
        setEditSection({ name: section.name, program: section.program, year_level: section.year_level, student_count: section.student_count, parent_id: section.parent_id, weight: section.weight, node_type: section.node_type, description: section.description || '', sort_order: section.sort_order, owner_id: section.owner_id, is_public: section.is_public, shared_with: section.shared_with });
        setEditingId(section.id);
        setShowEditSection(true);
    };

    const handleEditRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await supabase.from('rooms').update({ ...editRoom }).eq('id', editingId);
        setShowEditRoom(false);
        setEditRoom({ name: '', capacity: 40, type: 'lecture', building: '', floor: 1, weight: 50, priority_note: '', owner_id: null, is_public: false, shared_with: [] });
        setEditingId(null);
        setSaving(false);
        fetchAll();
    };

    const handleEditSubject = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await supabase.from('subjects').update(editSubject).eq('id', editingId);
        setShowEditSubject(false);
        setEditSubject({ code: '', name: '', units: 3, type: 'lecture', duration_hours: 1, program: '', year_level: 1, requires_lab: false, weight: 50, priority_note: '', owner_id: null, is_public: false, shared_with: [] });
        setEditingId(null);
        setSaving(false);
        fetchAll();
    };

    const handleEditSection = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await supabase.from('sections').update(editSection).eq('id', editingId);
        setShowEditSection(false);
        setEditSection({ name: '', program: '', year_level: 1, student_count: 30, parent_id: null, weight: 50, node_type: 'section', description: '', sort_order: 0, owner_id: null, is_public: false, shared_with: [] });
        setEditingId(null);
        setSaving(false);
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
                    <p className="dashboard-subtitle">
                        {canEdit ? 'Manage rooms, subjects, and sections' : 'View rooms, subjects, and sections'}
                    </p>
                </div>
                {canEdit && (
                    <button className="btn btn-primary" onClick={getAddAction()}>
                        <Plus size={16} />
                        Add {tab === 'rooms' ? 'Room' : tab === 'subjects' ? 'Subject' : 'Section'}
                    </button>
                )}
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
                                            <td>
                                                {canEdit ? (
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => openEditRoom(r)}><Edit size={15} style={{ color: 'var(--text-secondary)' }} /></button>
                                                        <button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => handleDelete('rooms', r.id, r.name)}><Trash2 size={15} style={{ color: 'var(--accent-error)' }} /></button>
                                                    </div>
                                                ) : (
                                                    <Lock size={15} style={{ color: 'var(--text-muted)' }} />
                                                )}
                                            </td>
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
                                            <td>
                                                {canEdit ? (
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => openEditSubject(s)}><Edit size={15} style={{ color: 'var(--text-secondary)' }} /></button>
                                                        <button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => handleDelete('subjects', s.id, s.code)}><Trash2 size={15} style={{ color: 'var(--accent-error)' }} /></button>
                                                    </div>
                                                ) : (
                                                    <Lock size={15} style={{ color: 'var(--text-muted)' }} />
                                                )}
                                            </td>
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
                                <thead><tr><th>Name</th><th>Type</th><th>Parent</th><th>Program</th><th>Year Level</th><th>Students</th><th>Weight</th><th style={{ width: 60 }}></th></tr></thead>
                                <tbody>
                                    {sections.map(s => {
                                        const parent = sections.find(p => p.id === s.parent_id);
                                        return (
                                            <tr key={s.id}>
                                                <td style={{ fontWeight: 600 }}>
                                                    {s.node_type === 'group' && <Folder size={14} style={{ marginRight: 6, color: '#818cf8' }} />}
                                                    {s.name}
                                                </td>
                                                <td><span className="badge" style={{ background: s.node_type === 'group' ? 'rgba(139,92,246,0.15)' : 'rgba(16,185,129,0.15)', color: s.node_type === 'group' ? '#a78bfa' : '#34d399' }}>{s.node_type?.toUpperCase()}</span></td>
                                                <td>{parent ? parent.name : '-'}</td>
                                                <td>{s.program || '-'}</td>
                                                <td>{s.year_level >= 11 ? `Grade ${s.year_level}` : `Year ${s.year_level}`}</td>
                                                <td>{s.student_count || '-'}</td>
                                                <td>{s.weight}</td>
                                                <td>
                                                    {canEdit ? (
                                                        <div style={{ display: 'flex', gap: 4 }}>
                                                            <button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => openEditSection(s)}><Edit size={15} style={{ color: 'var(--text-secondary)' }} /></button>
                                                            <button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => handleDelete('sections', s.id, s.name)}><Trash2 size={15} style={{ color: 'var(--accent-error)' }} /></button>
                                                        </div>
                                                    ) : (
                                                        <Lock size={15} style={{ color: 'var(--text-muted)' }} />
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {sections.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No sections added yet.</td></tr>}
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
                            <div className="field"><label className="field-label">WEIGHT (0-100, higher = scheduled first)</label><input className="input" type="number" min={0} max={100} value={newRoom.weight} onChange={e => setNewRoom(p => ({ ...p, weight: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">PRIORITY NOTE</label><textarea className="input" rows={2} value={newRoom.priority_note} onChange={e => setNewRoom(p => ({ ...p, priority_note: e.target.value }))} placeholder="Optional priority reason..." /></div>
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
                            <div className="field"><label className="field-label">WEIGHT (0-100, higher = scheduled first)</label><input className="input" type="number" min={0} max={100} value={newSubject.weight} onChange={e => setNewSubject(p => ({ ...p, weight: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">PRIORITY NOTE</label><textarea className="input" rows={2} value={newSubject.priority_note} onChange={e => setNewSubject(p => ({ ...p, priority_note: e.target.value }))} placeholder="Optional priority reason..." /></div>
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
                            <div className="field"><label className="field-label">NODE TYPE</label>
                                <select className="input" value={newSection.node_type} onChange={e => setNewSection(p => ({ ...p, node_type: e.target.value as 'group' | 'section' }))}>
                                    <option value="section">Section (actual student group)</option>
                                    <option value="group">Group (folder for organization)</option>
                                </select>
                            </div>
                            <div className="field"><label className="field-label">PARENT SECTION</label>
                                <select className="input" value={newSection.parent_id || ''} onChange={e => setNewSection(p => ({ ...p, parent_id: e.target.value || null }))}>
                                    <option value="">None (root level)</option>
                                    {sections.filter(s => s.node_type === 'group' || s.node_type === 'section').map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.node_type})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="field"><label className="field-label">WEIGHT (0-100, higher = scheduled first)</label><input className="input" type="number" min={0} max={100} value={newSection.weight} onChange={e => setNewSection(p => ({ ...p, weight: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">SORT ORDER</label><input className="input" type="number" min={0} value={newSection.sort_order} onChange={e => setNewSection(p => ({ ...p, sort_order: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">DESCRIPTION</label><textarea className="input" rows={2} value={newSection.description} onChange={e => setNewSection(p => ({ ...p, description: e.target.value }))} placeholder="Optional description..." /></div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Add Section'}</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Room Modal */}
            {showEditRoom && (
                <div className="modal-overlay" onClick={() => setShowEditRoom(false)}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Edit Room</h2><button className="btn btn-ghost" onClick={() => setShowEditRoom(false)}><X size={20} /></button></div>
                        <form onSubmit={handleEditRoom} className="modal-form">
                            <div className="field"><label className="field-label">ROOM NAME</label><input className="input" required placeholder="e.g. Lab 201" value={editRoom.name} onChange={e => setEditRoom(p => ({ ...p, name: e.target.value }))} /></div>
                            <div className="field"><label className="field-label">BUILDING</label><input className="input" required placeholder="e.g. Main Building" value={editRoom.building} onChange={e => setEditRoom(p => ({ ...p, building: e.target.value }))} /></div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div className="field" style={{ flex: 1 }}><label className="field-label">FLOOR</label><input className="input" type="number" min={1} value={editRoom.floor} onChange={e => setEditRoom(p => ({ ...p, floor: parseInt(e.target.value) }))} /></div>
                                <div className="field" style={{ flex: 1 }}><label className="field-label">CAPACITY</label><input className="input" type="number" min={1} value={editRoom.capacity} onChange={e => setEditRoom(p => ({ ...p, capacity: parseInt(e.target.value) }))} /></div>
                            </div>
                            <div className="field"><label className="field-label">TYPE</label>
                                <select className="input" value={editRoom.type} onChange={e => setEditRoom(p => ({ ...p, type: e.target.value }))}>
                                    <option value="lecture">Lecture</option><option value="laboratory">Laboratory</option><option value="computer_lab">Computer Lab</option><option value="gymnasium">Gymnasium</option>
                                </select>
                            </div>
                            <div className="field"><label className="field-label">WEIGHT (0-100, higher = scheduled first)</label><input className="input" type="number" min={0} max={100} value={editRoom.weight} onChange={e => setEditRoom(p => ({ ...p, weight: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">PRIORITY NOTE</label><textarea className="input" rows={2} value={editRoom.priority_note} onChange={e => setEditRoom(p => ({ ...p, priority_note: e.target.value }))} placeholder="Optional priority reason..." /></div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Save Changes'}</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Subject Modal */}
            {showEditSubject && (
                <div className="modal-overlay" onClick={() => setShowEditSubject(false)}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Edit Subject</h2><button className="btn btn-ghost" onClick={() => setShowEditSubject(false)}><X size={20} /></button></div>
                        <form onSubmit={handleEditSubject} className="modal-form">
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div className="field" style={{ flex: 1 }}><label className="field-label">CODE</label><input className="input" required placeholder="e.g. CS101" value={editSubject.code} onChange={e => setEditSubject(p => ({ ...p, code: e.target.value }))} /></div>
                                <div className="field" style={{ flex: 2 }}><label className="field-label">NAME</label><input className="input" required placeholder="Introduction to Computing" value={editSubject.name} onChange={e => setEditSubject(p => ({ ...p, name: e.target.value }))} /></div>
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div className="field" style={{ flex: 1 }}><label className="field-label">UNITS</label><input className="input" type="number" min={1} max={6} value={editSubject.units} onChange={e => setEditSubject(p => ({ ...p, units: parseInt(e.target.value) }))} /></div>
                                <div className="field" style={{ flex: 1 }}><label className="field-label">HOURS</label><input className="input" type="number" min={1} max={6} value={editSubject.duration_hours} onChange={e => setEditSubject(p => ({ ...p, duration_hours: parseInt(e.target.value) }))} /></div>
                                <div className="field" style={{ flex: 1 }}><label className="field-label">TYPE</label><select className="input" value={editSubject.type} onChange={e => setEditSubject(p => ({ ...p, type: e.target.value }))}><option value="lecture">Lecture</option><option value="laboratory">Laboratory</option></select></div>
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div className="field" style={{ flex: 2 }}><label className="field-label">PROGRAM</label><input className="input" required placeholder="e.g. BSIT" value={editSubject.program} onChange={e => setEditSubject(p => ({ ...p, program: e.target.value }))} /></div>
                                <div className="field" style={{ flex: 1 }}><label className="field-label">YEAR LEVEL</label><input className="input" type="number" min={1} max={12} value={editSubject.year_level} onChange={e => setEditSubject(p => ({ ...p, year_level: parseInt(e.target.value) }))} /></div>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}>
                                <input type="checkbox" checked={editSubject.requires_lab} onChange={e => setEditSubject(p => ({ ...p, requires_lab: e.target.checked }))} />
                                Requires Lab Room
                            </label>
                            <div className="field"><label className="field-label">WEIGHT (0-100, higher = scheduled first)</label><input className="input" type="number" min={0} max={100} value={editSubject.weight} onChange={e => setEditSubject(p => ({ ...p, weight: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">PRIORITY NOTE</label><textarea className="input" rows={2} value={editSubject.priority_note} onChange={e => setEditSubject(p => ({ ...p, priority_note: e.target.value }))} placeholder="Optional priority reason..." /></div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Save Changes'}</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Section Modal */}
            {showEditSection && (
                <div className="modal-overlay" onClick={() => setShowEditSection(false)}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Edit Section</h2><button className="btn btn-ghost" onClick={() => setShowEditSection(false)}><X size={20} /></button></div>
                        <form onSubmit={handleEditSection} className="modal-form">
                            <div className="field"><label className="field-label">SECTION NAME</label><input className="input" required placeholder="e.g. BSIT-1A" value={editSection.name} onChange={e => setEditSection(p => ({ ...p, name: e.target.value }))} /></div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div className="field" style={{ flex: 2 }}><label className="field-label">PROGRAM</label><input className="input" required placeholder="e.g. BSIT" value={editSection.program} onChange={e => setEditSection(p => ({ ...p, program: e.target.value }))} /></div>
                                <div className="field" style={{ flex: 1 }}><label className="field-label">YEAR LEVEL</label><input className="input" type="number" min={1} max={12} value={editSection.year_level} onChange={e => setEditSection(p => ({ ...p, year_level: parseInt(e.target.value) }))} /></div>
                            </div>
                            <div className="field"><label className="field-label">STUDENT COUNT</label><input className="input" type="number" min={1} value={editSection.student_count} onChange={e => setEditSection(p => ({ ...p, student_count: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">NODE TYPE</label>
                                <select className="input" value={editSection.node_type} onChange={e => setEditSection(p => ({ ...p, node_type: e.target.value as 'group' | 'section' }))}>
                                    <option value="section">Section (actual student group)</option>
                                    <option value="group">Group (folder for organization)</option>
                                </select>
                            </div>
                            <div className="field"><label className="field-label">PARENT SECTION</label>
                                <select className="input" value={editSection.parent_id || ''} onChange={e => setEditSection(p => ({ ...p, parent_id: e.target.value || null }))}>
                                    <option value="">None (root level)</option>
                                    {sections.filter(s => s.id !== editingId && (s.node_type === 'group' || s.node_type === 'section')).map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.node_type})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="field"><label className="field-label">WEIGHT (0-100, higher = scheduled first)</label><input className="input" type="number" min={0} max={100} value={editSection.weight} onChange={e => setEditSection(p => ({ ...p, weight: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">SORT ORDER</label><input className="input" type="number" min={0} value={editSection.sort_order} onChange={e => setEditSection(p => ({ ...p, sort_order: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">DESCRIPTION</label><textarea className="input" rows={2} value={editSection.description} onChange={e => setEditSection(p => ({ ...p, description: e.target.value }))} placeholder="Optional description..." /></div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Save Changes'}</button>
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
