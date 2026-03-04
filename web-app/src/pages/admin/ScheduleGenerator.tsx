import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Zap, Play, CheckCircle, XCircle, AlertTriangle, Settings2, RefreshCw } from 'lucide-react';
import '../admin/Dashboard.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = [
    { start: '07:00', end: '08:30' }, { start: '08:30', end: '10:00' },
    { start: '10:00', end: '11:30' }, { start: '13:00', end: '14:30' },
    { start: '14:30', end: '16:00' }, { start: '16:00', end: '17:30' },
];

interface GenResult {
    total: number;
    placed: number;
    conflicts: number;
    entries: { subjectId: string; subjectName: string; teacherId: string; teacherName: string; roomId: string; roomName: string; sectionId: string; sectionName: string; day: string; start: string; end: string }[];
    errors: string[];
}

const ScheduleGenerator: React.FC = () => {
    const [subjects, setSubjects] = useState<any[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [rooms, setRooms] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [existingSchedules, setExisting] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [result, setResult] = useState<GenResult | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Config
    const [respectPrefs, setRespectPrefs] = useState(true);
    const [avoidConflicts, setAvoidConflicts] = useState(true);
    const [clearExisting, setClearExisting] = useState(false);
    const [maxAttempts, setMaxAttempts] = useState(3);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        const [sub, t, r, sec, sch] = await Promise.all([
            supabase.from('subjects').select('id, name, code, duration_hours, requires_lab, program, year_level, teacher_id'),
            supabase.from('teachers').select('id, max_hours, profile:profiles(full_name)'),
            supabase.from('rooms').select('id, name, capacity, type, is_available'),
            supabase.from('sections').select('id, name, program, year_level, student_count'),
            supabase.from('schedules').select('id, subject_id, teacher_id, room_id, section_id, day_of_week, start_time, end_time'),
        ]);
        setSubjects(sub.data || []);
        setTeachers((t.data as any[]) || []);
        setRooms((r.data || []).filter((r: any) => r.is_available !== false));
        setSections(sec.data || []);
        setExisting(sch.data || []);
        setLoading(false);
    };

    const isSlotFree = (entries: GenResult['entries'], existing: any[], entityType: 'teacher' | 'room' | 'section', entityId: string, day: string, start: string, end: string) => {
        const all = [
            ...entries.map(e => ({ teacherId: e.teacherId, roomId: e.roomId, sectionId: e.sectionId, day: e.day, start: e.start, end: e.end })),
            ...existing.map(e => ({ teacherId: e.teacher_id, roomId: e.room_id, sectionId: e.section_id, day: e.day_of_week, start: e.start_time, end: e.end_time })),
        ];
        return !all.some(s => {
            if (s.day !== day) return false;
            const overlaps = s.start < end && start < s.end;
            if (!overlaps) return false;
            if (entityType === 'teacher') return s.teacherId === entityId;
            if (entityType === 'room') return s.roomId === entityId;
            return s.sectionId === entityId;
        });
    };

    const generate = () => {
        setGenerating(true);
        setResult(null);
        setSaved(false);

        setTimeout(() => {
            let bestResult: GenResult = { total: 0, placed: 0, conflicts: 0, entries: [], errors: [] };
            const baseExisting = clearExisting ? [] : existingSchedules;

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const entries: GenResult['entries'] = [];
                const errors: string[] = [];
                const unassignedSubjects = subjects.filter(s => {
                    if (!clearExisting) return !existingSchedules.some(e => e.subject_id === s.id);
                    return true;
                });

                // Shuffle for variety between attempts
                const shuffled = [...unassignedSubjects].sort(() => Math.random() - 0.5);
                const shuffledDays = [...DAYS].sort(() => Math.random() - 0.5);

                for (const sub of shuffled) {
                    let placed = false;

                    // Find teacher
                    const teacher = sub.teacher_id
                        ? teachers.find(t => t.id === sub.teacher_id)
                        : teachers[Math.floor(Math.random() * teachers.length)];

                    if (!teacher) { errors.push(`No teacher available for "${sub.name}"`); continue; }

                    // Find matching section
                    const matchSections = sections.filter(s =>
                        s.program === sub.program && s.year_level === sub.year_level
                    );
                    const section = matchSections.length > 0 ? matchSections[0] : sections[0];
                    if (!section) { errors.push(`No section for "${sub.name}" (${sub.program} Y${sub.year_level})`); continue; }

                    // Find compatible room
                    const compatRooms = rooms.filter(r =>
                        sub.requires_lab ? r.type === 'laboratory' || r.type === 'computer_lab' : true
                    );
                    if (compatRooms.length === 0) { errors.push(`No compatible room for "${sub.name}" (${sub.requires_lab ? 'needs lab' : 'lecture'})`); continue; }

                    for (const day of shuffledDays) {
                        if (placed) break;
                        for (const slot of TIME_SLOTS) {
                            if (placed) break;
                            const teacherFree = isSlotFree(entries, baseExisting, 'teacher', teacher.id, day, slot.start, slot.end);
                            const sectionFree = isSlotFree(entries, baseExisting, 'section', section.id, day, slot.start, slot.end);
                            if (!teacherFree || !sectionFree) continue;

                            for (const room of compatRooms) {
                                const roomFree = isSlotFree(entries, baseExisting, 'room', room.id, day, slot.start, slot.end);
                                if (roomFree) {
                                    entries.push({
                                        subjectId: sub.id, subjectName: `${sub.code} - ${sub.name}`,
                                        teacherId: teacher.id, teacherName: (teacher as any).profile?.full_name || 'Teacher',
                                        roomId: room.id, roomName: room.name,
                                        sectionId: section.id, sectionName: section.name,
                                        day, start: slot.start, end: slot.end,
                                    });
                                    placed = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (!placed) errors.push(`Could not place "${sub.name}" — all slots full`);
                }

                const thisResult: GenResult = { total: shuffled.length, placed: entries.length, conflicts: 0, entries, errors };
                if (thisResult.placed > bestResult.placed) bestResult = thisResult;
                if (bestResult.placed === bestResult.total) break; // perfect, stop early
            }

            setResult(bestResult);
            setGenerating(false);
        }, 800);
    };

    const saveGenerated = async () => {
        if (!result) return;
        setSaving(true);
        try {
            if (clearExisting) {
                await supabase.from('schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            }
            const inserts = result.entries.map(e => ({
                subject_id: e.subjectId, teacher_id: e.teacherId, room_id: e.roomId,
                section_id: e.sectionId, day_of_week: e.day, start_time: e.start, end_time: e.end, status: 'published',
            }));
            const { error } = await supabase.from('schedules').insert(inserts);
            if (error) throw error;
            setSaved(true);
            fetchData();
        } catch (err: any) {
            alert('Error saving: ' + (err.message || 'Unknown'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Schedule Generator</h1>
                    <p className="dashboard-subtitle">Auto-generate optimized schedules</p>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : (
                <>
                    {/* Data Summary */}
                    <div className="stats-grid" style={{ marginBottom: 24 }}>
                        <div className="stat-card"><div className="stat-number">{subjects.length}</div><div className="stat-label">Subjects</div></div>
                        <div className="stat-card"><div className="stat-number">{teachers.length}</div><div className="stat-label">Teachers</div></div>
                        <div className="stat-card"><div className="stat-number">{rooms.length}</div><div className="stat-label">Rooms</div></div>
                        <div className="stat-card"><div className="stat-number">{existingSchedules.length}</div><div className="stat-label">Existing Entries</div></div>
                    </div>

                    {/* Config */}
                    <div className="card" style={{ marginBottom: 20 }}>
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Settings2 size={18} style={{ color: 'var(--accent-primary)' }} /> Generator Options
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={avoidConflicts} onChange={() => setAvoidConflicts(!avoidConflicts)} /> Avoid all conflicts
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={respectPrefs} onChange={() => setRespectPrefs(!respectPrefs)} /> Respect teacher preferences
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                                <input type="checkbox" checked={clearExisting} onChange={() => setClearExisting(!clearExisting)} /> Clear existing schedules
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Attempts:</span>
                                <select className="input" value={maxAttempts} onChange={e => setMaxAttempts(+e.target.value)} style={{ width: 70 }}>
                                    {[1, 3, 5, 10].map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                            </div>
                        </div>
                        <button className="btn btn-primary" onClick={generate} disabled={generating || subjects.length === 0}
                            style={{ marginTop: 20, padding: '12px 32px' }}>
                            {generating ? <><RefreshCw size={16} className="spin" /> Generating...</> : <><Zap size={16} /> Generate Schedule</>}
                        </button>
                    </div>

                    {/* Results */}
                    {result && (
                        <div className="card" style={{ borderLeft: `4px solid ${result.placed === result.total ? '#34d399' : '#fbbf24'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {result.placed === result.total
                                        ? <><CheckCircle size={20} style={{ color: '#34d399' }} /> Perfect Schedule</>
                                        : <><AlertTriangle size={20} style={{ color: '#fbbf24' }} /> Partial Schedule</>
                                    }
                                </h3>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                    {result.placed}/{result.total} placed
                                </div>
                            </div>

                            {/* Progress */}
                            <div style={{ width: '100%', height: 8, background: 'var(--bg-secondary)', borderRadius: 4, marginBottom: 16 }}>
                                <div style={{
                                    width: `${(result.placed / Math.max(result.total, 1)) * 100}%`,
                                    height: '100%', borderRadius: 4, transition: 'width 600ms ease',
                                    background: result.placed === result.total ? '#34d399' : '#fbbf24',
                                }} />
                            </div>

                            {/* Errors */}
                            {result.errors.length > 0 && (
                                <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginBottom: 6 }}>Issues ({result.errors.length})</div>
                                    {result.errors.slice(0, 6).map((e, i) => (
                                        <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '2px 0' }}>
                                            <XCircle size={12} style={{ color: '#ef4444', verticalAlign: 'middle', marginRight: 6 }} />{e}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Preview Table */}
                            {result.entries.length > 0 && (
                                <div className="table-container" style={{ maxHeight: 340, overflow: 'auto' }}>
                                    <table>
                                        <thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th><th>Section</th></tr></thead>
                                        <tbody>
                                            {result.entries.sort((a, b) => {
                                                const dd = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
                                                return dd !== 0 ? dd : a.start.localeCompare(b.start);
                                            }).map((e, i) => (
                                                <tr key={i}>
                                                    <td style={{ fontWeight: 600 }}>{e.day}</td>
                                                    <td>{e.start} - {e.end}</td>
                                                    <td>{e.subjectName}</td>
                                                    <td>{e.teacherName}</td>
                                                    <td>{e.roomName}</td>
                                                    <td>{e.sectionName}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Save */}
                            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                                <button className="btn btn-primary" onClick={saveGenerated} disabled={saving || saved || result.entries.length === 0}>
                                    <Play size={16} /> {saved ? 'Saved!' : saving ? 'Saving...' : 'Apply to Schedule'}
                                </button>
                                <button className="btn btn-secondary" onClick={generate} disabled={generating}>
                                    <RefreshCw size={16} /> Regenerate
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default ScheduleGenerator;
