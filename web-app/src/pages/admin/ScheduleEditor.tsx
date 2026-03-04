import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, AlertCircle, Save, X, Clock, MapPin, Users as UsersIcon, BookOpen } from 'lucide-react';
import '../admin/Dashboard.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = [
    '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00',
];

interface ScheduleEntry {
    id: string;
    subject_id: string;
    teacher_id: string;
    room_id: string;
    section_id: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    subject?: { name: string; code: string };
    teacher?: { profile?: { full_name: string } };
    room?: { name: string };
    section?: { name: string };
}

const ScheduleEditor: React.FC = () => {
    const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [rooms, setRooms] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [conflicts, setConflicts] = useState<string[]>([]);

    // Add-form state
    const [showForm, setShowForm] = useState(false);
    const [formDay, setFormDay] = useState('Monday');
    const [formStart, setFormStart] = useState('08:00');
    const [formEnd, setFormEnd] = useState('09:30');
    const [formSubjectId, setFormSubjectId] = useState('');
    const [formTeacherId, setFormTeacherId] = useState('');
    const [formRoomId, setFormRoomId] = useState('');
    const [formSectionId, setFormSectionId] = useState('');
    const [saving, setSaving] = useState(false);

    // Filter
    const [filterDay, setFilterDay] = useState<string>('all');

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        const [s, sub, t, r, sec] = await Promise.all([
            supabase.from('schedules').select('*, subject:subjects(name, code), teacher:teachers(profile:profiles(full_name)), room:rooms(name), section:sections(name)').order('day_of_week').order('start_time'),
            supabase.from('subjects').select('id, name, code'),
            supabase.from('teachers').select('id, profile:profiles(full_name)'),
            supabase.from('rooms').select('id, name'),
            supabase.from('sections').select('id, name'),
        ]);
        setSchedules((s.data as ScheduleEntry[]) || []);
        setSubjects(sub.data || []);
        setTeachers((t.data as any[]) || []);
        setRooms(r.data || []);
        setSections(sec.data || []);
        setLoading(false);
        detectConflicts((s.data as ScheduleEntry[]) || []);
    };

    const detectConflicts = (scheds: ScheduleEntry[]) => {
        const issues: string[] = [];
        for (let i = 0; i < scheds.length; i++) {
            for (let j = i + 1; j < scheds.length; j++) {
                const a = scheds[i], b = scheds[j];
                if (a.day_of_week !== b.day_of_week) continue;
                const overlap = a.start_time < b.end_time && b.start_time < a.end_time;
                if (!overlap) continue;

                // Teacher conflict
                if (a.teacher_id && a.teacher_id === b.teacher_id) {
                    issues.push(`Teacher conflict: ${a.teacher?.profile?.full_name || 'Teacher'} has overlapping classes on ${a.day_of_week} at ${a.start_time?.slice(0, 5)}`);
                }
                // Room conflict
                if (a.room_id && a.room_id === b.room_id) {
                    issues.push(`Room conflict: ${a.room?.name || 'Room'} is double-booked on ${a.day_of_week} at ${a.start_time?.slice(0, 5)}`);
                }
                // Section conflict
                if (a.section_id && a.section_id === b.section_id) {
                    issues.push(`Section conflict: ${a.section?.name || 'Section'} has overlapping subjects on ${a.day_of_week} at ${a.start_time?.slice(0, 5)}`);
                }
            }
        }
        setConflicts([...new Set(issues)]);
    };

    const handleAdd = async () => {
        if (!formSubjectId || !formTeacherId || !formRoomId || !formSectionId) return;
        setSaving(true);
        try {
            const { error } = await supabase.from('schedules').insert({
                subject_id: formSubjectId,
                teacher_id: formTeacherId,
                room_id: formRoomId,
                section_id: formSectionId,
                day_of_week: formDay,
                start_time: formStart,
                end_time: formEnd,
                status: 'published',
            });
            if (error) throw error;
            setShowForm(false);
            fetchAll();
        } catch (err: any) {
            alert('Error: ' + (err.message || 'Failed to add schedule'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this schedule entry?')) return;
        await supabase.from('schedules').delete().eq('id', id);
        fetchAll();
    };

    const displayed = filterDay === 'all'
        ? schedules
        : schedules.filter(s => s.day_of_week === filterDay);

    const getTimeSlotIndex = (time: string) => TIME_SLOTS.indexOf(time);

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Schedule Editor</h1>
                    <p className="dashboard-subtitle">{schedules.length} entries · {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                    <Plus size={16} /> Add Entry
                </button>
            </div>

            {/* Conflict Warnings */}
            {conflicts.length > 0 && (
                <div className="card" style={{ marginBottom: 16, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
                    <h3 className="card-title" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AlertCircle size={18} /> {conflicts.length} Conflict{conflicts.length !== 1 ? 's' : ''} Detected
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                        {conflicts.slice(0, 8).map((c, i) => (
                            <li key={i}>{c}</li>
                        ))}
                        {conflicts.length > 8 && <li style={{ color: 'var(--text-muted)' }}>...and {conflicts.length - 8} more</li>}
                    </ul>
                </div>
            )}

            {/* Day Filter */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
                <button className={`btn ${filterDay === 'all' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilterDay('all')} style={{ fontSize: 12 }}>All Days</button>
                {DAYS.map(d => (
                    <button key={d} className={`btn ${filterDay === d ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilterDay(d)} style={{ fontSize: 12 }}>
                        {d.slice(0, 3)}
                    </button>
                ))}
            </div>

            {/* Visual Grid */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : (
                <div className="card" style={{ overflow: 'auto' }}>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: 100 }}>Day</th>
                                    <th style={{ width: 120 }}><Clock size={14} /> Time</th>
                                    <th><BookOpen size={14} /> Subject</th>
                                    <th><UsersIcon size={14} /> Teacher</th>
                                    <th><MapPin size={14} /> Room</th>
                                    <th>Section</th>
                                    <th style={{ width: 60 }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayed.length === 0 ? (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No schedule entries{filterDay !== 'all' ? ` for ${filterDay}` : ''}</td></tr>
                                ) : displayed.map(s => {
                                    const hasConflict = conflicts.some(c =>
                                        c.includes(s.day_of_week) &&
                                        (c.includes(s.teacher?.profile?.full_name || '___') ||
                                            c.includes(s.room?.name || '___') ||
                                            c.includes(s.section?.name || '___'))
                                    );
                                    return (
                                        <tr key={s.id} style={{ background: hasConflict ? 'rgba(239,68,68,0.06)' : undefined }}>
                                            <td style={{ fontWeight: 600 }}>{s.day_of_week}</td>
                                            <td>{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</td>
                                            <td><strong>{s.subject?.code}</strong> {s.subject?.name}</td>
                                            <td>{s.teacher?.profile?.full_name || 'TBA'}</td>
                                            <td>{s.room?.name || 'TBA'}</td>
                                            <td>{s.section?.name || '-'}</td>
                                            <td>
                                                <button className="btn btn-ghost" style={{ padding: 4, color: '#ef4444' }} onClick={() => handleDelete(s.id)} title="Delete">
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Add Schedule Modal */}
            {showForm && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="card" style={{ width: 480, maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 className="card-title" style={{ margin: 0 }}>Add Schedule Entry</h3>
                            <button className="btn btn-ghost" onClick={() => setShowForm(false)}><X size={18} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label className="input-label">Day</label>
                                <select className="input" value={formDay} onChange={e => setFormDay(e.target.value)}>
                                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <label className="input-label">Start Time</label>
                                    <select className="input" value={formStart} onChange={e => setFormStart(e.target.value)}>
                                        {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="input-label">End Time</label>
                                    <select className="input" value={formEnd} onChange={e => setFormEnd(e.target.value)}>
                                        {TIME_SLOTS.filter(t => t > formStart).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="input-label">Subject</label>
                                <select className="input" value={formSubjectId} onChange={e => setFormSubjectId(e.target.value)}>
                                    <option value="">Select subject...</option>
                                    {subjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="input-label">Teacher</label>
                                <select className="input" value={formTeacherId} onChange={e => setFormTeacherId(e.target.value)}>
                                    <option value="">Select teacher...</option>
                                    {teachers.map(t => <option key={t.id} value={t.id}>{(t as any).profile?.full_name || 'Teacher'}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="input-label">Room</label>
                                <select className="input" value={formRoomId} onChange={e => setFormRoomId(e.target.value)}>
                                    <option value="">Select room...</option>
                                    {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="input-label">Section</label>
                                <select className="input" value={formSectionId} onChange={e => setFormSectionId(e.target.value)}>
                                    <option value="">Select section...</option>
                                    {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <button className="btn btn-primary" onClick={handleAdd} disabled={saving || !formSubjectId || !formTeacherId || !formRoomId || !formSectionId}
                            style={{ width: '100%', marginTop: 20, padding: '12px 0' }}>
                            <Save size={16} /> {saving ? 'Saving...' : 'Save Entry'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScheduleEditor;
