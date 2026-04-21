import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Save, Clock, Calendar, BookOpen, CheckCircle, Loader2, MapPin } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = [
    '7:00', '7:30', '8:00', '8:30', '9:00', '9:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'
];

const TeacherPreferences: React.FC = () => {
    const { profile } = useAuth();

    const [availability, setAvailability] = useState<Record<string, boolean>>({});
    const [preferredDays, setPreferredDays] = useState<string[]>([]);
    const [preferredTimeStart, setPreferredTimeStart] = useState('8:00');
    const [preferredTimeEnd, setPreferredTimeEnd] = useState('17:00');
    const [maxClassesPerDay, setMaxClassesPerDay] = useState(5);
    const [maxConsecutiveClasses, setMaxConsecutiveClasses] = useState(3);
    const [preferredSubjects, setPreferredSubjects] = useState<string[]>([]);
    const [preferredRooms, setPreferredRooms] = useState<string[]>([]);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    const [allSubjects, setAllSubjects] = useState<any[]>([]);
    const [allRooms, setAllRooms] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            const [subRes, roomRes] = await Promise.all([
                supabase.from('subjects').select('name'),
                supabase.from('rooms').select('name')
            ]);
            if (subRes.data) setAllSubjects(subRes.data);
            if (roomRes.data) setAllRooms(roomRes.data);
        };
        fetchData();
    }, []);

    // Load existing preferences
    useEffect(() => {
        const fetchPreferences = async () => {
            if (!profile?.id) return;
            setLoading(true);
            try {
                const { data } = await supabase
                    .from('teacher_preferences')
                    .select('*')
                    .eq('teacher_id', profile.id)
                    .single();

                if (data) {
                    setAvailability(data.availability || {});
                    setPreferredDays(data.preferred_days || []);
                    setPreferredTimeStart(data.preferred_time_start || '8:00');
                    setPreferredTimeEnd(data.preferred_time_end || '17:00');
                    setMaxClassesPerDay(data.max_classes_per_day || 5);
                    setMaxConsecutiveClasses(data.max_consecutive_classes || 3);
                    setPreferredSubjects(data.preferred_subjects || []);
                    setPreferredRooms(data.preferred_rooms || []);
                    setNotes(data.notes || '');
                }
            } catch (err) {
                // No preferences yet
            }
            setLoading(false);
        };
        fetchPreferences();
    }, [profile]);

    const toggleAvailability = (day: string, time: string) => {
        const key = `${day}-${time}`;
        setAvailability(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleDay = (day: string) => {
        setPreferredDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    };

    const toggleSubject = (subName: string) => {
        setPreferredSubjects(prev => prev.includes(subName) ? prev.filter(s => s !== subName) : [...prev, subName]);
    };

    const toggleRoom = (roomName: string) => {
        setPreferredRooms(prev => prev.includes(roomName) ? prev.filter(r => r !== roomName) : [...prev, roomName]);
    };

    const handleSave = async () => {
        if (!profile?.id) return;
        setSaving(true);
        try {
            await supabase.from('teacher_preferences').upsert({
                teacher_id: profile.id,
                availability,
                preferred_days: preferredDays,
                preferred_time_start: preferredTimeStart,
                preferred_time_end: preferredTimeEnd,
                max_classes_per_day: maxClassesPerDay,
                max_consecutive_classes: maxConsecutiveClasses,
                preferred_subjects: preferredSubjects,
                preferred_rooms: preferredRooms,
                notes,
                last_updated: new Date().toISOString()
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            window.alert('Error saving: ' + err.message);
        } finally { setSaving(false); }
    };

    if (loading) {
        return <div className="loading-center"><div className="spinner" /></div>;
    }

    return (
        <div className="prefs-page">
            <div className="page-header">
                <div>
                    <h1>Teaching Preferences</h1>
                    <p className="subtitle">Set your schedule availability and preferences</p>
                </div>
                <button className={`save-btn ${saved ? 'saved' : ''}`} onClick={handleSave} disabled={saving}>
                    {saving ? <><Loader2 size={16} className="spin" /> Saving...</> : saved ? <><CheckCircle size={16} /> Saved!</> : <><Save size={16} /> Save Preferences</>}
                </button>
            </div>

            <div className="prefs-grid">
                {/* Section 1: Preferred Days */}
                <div className="pref-section glass-panel">
                    <h3><Calendar size={18} color="#60a5fa" /> Preferred Days</h3>
                    <p className="helper-text">Select the days you prefer to teach</p>
                    <div className="days-grid">
                        {DAYS.map(day => (
                            <button key={day} className={`day-btn ${preferredDays.includes(day) ? 'active' : ''}`} onClick={() => toggleDay(day)}>
                                {day}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Section 2: Time Range */}
                <div className="pref-section glass-panel">
                    <h3><Clock size={18} color="#10b981" /> Time Preferences</h3>
                    <div className="time-range-row">
                        <div className="time-item">
                            <label>Earliest Start</label>
                            <select value={preferredTimeStart} onChange={e => setPreferredTimeStart(e.target.value)}>
                                {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="time-item">
                            <label>Latest End</label>
                            <select value={preferredTimeEnd} onChange={e => setPreferredTimeEnd(e.target.value)}>
                                {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Section 3: Workload */}
                <div className="pref-section glass-panel">
                    <h3><BookOpen size={18} color="#a78bfa" /> Workload Constraints</h3>
                    <div className="workload-controls">
                        <div className="workload-item">
                            <label>Max Classes/Day</label>
                            <div className="stepper">
                                <button onClick={() => setMaxClassesPerDay(prev => Math.max(1, prev - 1))}>−</button>
                                <span>{maxClassesPerDay}</span>
                                <button onClick={() => setMaxClassesPerDay(prev => Math.min(10, prev + 1))}>+</button>
                            </div>
                        </div>
                        <div className="workload-item">
                            <label>Max Consecutive</label>
                            <div className="stepper">
                                <button onClick={() => setMaxConsecutiveClasses(prev => Math.max(1, prev - 1))}>−</button>
                                <span>{maxConsecutiveClasses}</span>
                                <button onClick={() => setMaxConsecutiveClasses(prev => Math.min(8, prev + 1))}>+</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 4: Preferred Subjects */}
                <div className="pref-section glass-panel">
                    <h3><BookOpen size={18} color="#f59e0b" /> Preferred Subjects</h3>
                    <p className="helper-text">Select subjects you'd prefer to teach</p>
                    <div className="chip-grid">
                        {allSubjects.map((s: any) => (
                            <button key={s.name} className={`pref-chip ${preferredSubjects.includes(s.name) ? 'active' : ''}`} onClick={() => toggleSubject(s.name)}>
                                {s.name}
                            </button>
                        ))}
                        {allSubjects.length === 0 && <span className="text-muted">No subjects available</span>}
                    </div>
                </div>

                {/* Section 5: Preferred Rooms */}
                <div className="pref-section glass-panel">
                    <h3><MapPin size={18} color="#ec4899" /> Preferred Rooms</h3>
                    <p className="helper-text">Select rooms you'd prefer to use</p>
                    <div className="chip-grid">
                        {allRooms.map((r: any) => (
                            <button key={r.name} className={`pref-chip ${preferredRooms.includes(r.name) ? 'active' : ''}`} onClick={() => toggleRoom(r.name)}>
                                {r.name}
                            </button>
                        ))}
                        {allRooms.length === 0 && <span className="text-muted">No rooms available</span>}
                    </div>
                </div>

                {/* Section 6: Availability Grid */}
                <div className="pref-section full-width glass-panel">
                    <h3><Calendar size={18} color="#06b6d4" /> Availability Grid</h3>
                    <p className="helper-text">Click cells to mark when you're available (green = available)</p>
                    <div className="avail-grid-wrapper">
                        <table className="avail-grid">
                            <thead>
                                <tr>
                                    <th></th>
                                    {DAYS.map(day => <th key={day}>{day.slice(0, 3)}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {TIME_SLOTS.filter((_, i) => i % 2 === 0).map(time => (
                                    <tr key={time}>
                                        <td className="time-label">{time}</td>
                                        {DAYS.map(day => {
                                            const key = `${day}-${time}`;
                                            const isAvail = availability[key];
                                            return (
                                                <td key={day} className={`avail-cell ${isAvail ? 'available' : ''}`} onClick={() => toggleAvailability(day, time)} />
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Notes */}
                <div className="pref-section full-width glass-panel">
                    <h3>Additional Notes</h3>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional scheduling preferences or constraints..." rows={3} />
                </div>
            </div>

            <style>{`
                .prefs-page { display: flex; flex-direction: column; gap: 1.5rem; }
                .page-header { display: flex; justify-content: space-between; align-items: flex-end; }
                .subtitle { color: var(--text-secondary); margin-top: 0.25rem; }

                .save-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem; border-radius: 10px; background: var(--brand-primary); color: white; border: none; cursor: pointer; font-weight: 500; transition: all 0.2s; }
                .save-btn:hover { opacity: 0.9; }
                .save-btn:disabled { opacity: 0.5; }
                .save-btn.saved { background: #10b981; }

                .prefs-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
                .pref-section { padding: 1.5rem; }
                .pref-section h3 { display: flex; align-items: center; gap: 0.5rem; font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; }
                .pref-section.full-width { grid-column: 1 / -1; }
                .helper-text { color: var(--text-muted); font-size: 0.8rem; margin-bottom: 1rem; }

                .days-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; }
                .day-btn { padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid var(--border-light); background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 0.85rem; transition: all 0.2s; }
                .day-btn.active { background: rgba(59,130,246,0.15); border-color: var(--brand-primary); color: var(--brand-primary); }

                .time-range-row { display: flex; gap: 1rem; }
                .time-item { flex: 1; }
                .time-item label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem; display: block; }
                .time-item select { width: 100%; padding: 0.6rem 0.75rem; background: rgba(15,23,42,0.8); border: 1px solid var(--border-light); border-radius: 8px; color: white; }

                .workload-controls { display: flex; flex-direction: column; gap: 1rem; }
                .workload-item { display: flex; justify-content: space-between; align-items: center; }
                .workload-item label { font-size: 0.85rem; color: var(--text-secondary); }
                .stepper { display: flex; align-items: center; gap: 0; border: 1px solid var(--border-light); border-radius: 8px; overflow: hidden; }
                .stepper button { width: 36px; height: 36px; background: rgba(255,255,255,0.05); border: none; color: white; cursor: pointer; font-size: 1.2rem; }
                .stepper button:hover { background: rgba(255,255,255,0.1); }
                .stepper span { width: 40px; text-align: center; font-weight: 600; }

                .chip-grid { display: flex; flex-wrap: wrap; gap: 0.4rem; }
                .pref-chip { padding: 0.4rem 0.875rem; border-radius: 20px; border: 1px solid var(--border-light); background: transparent; color: var(--text-secondary); font-size: 0.8rem; cursor: pointer; transition: all 0.2s; }
                .pref-chip.active { background: rgba(139,92,246,0.15); border-color: #8b5cf6; color: #a78bfa; }

                .avail-grid-wrapper { overflow-x: auto; }
                .avail-grid { width: 100%; border-collapse: separate; border-spacing: 2px; }
                .avail-grid th { font-size: 0.75rem; color: var(--text-muted); font-weight: 500; padding: 6px 4px; text-align: center; }
                .time-label { font-size: 0.7rem; color: var(--text-muted); padding: 4px 8px; white-space: nowrap; }
                .avail-cell { width: 60px; height: 28px; background: rgba(255,255,255,0.03); border-radius: 4px; cursor: pointer; transition: background 0.15s; }
                .avail-cell:hover { background: rgba(255,255,255,0.08); }
                .avail-cell.available { background: rgba(16,185,129,0.3); }

                .pref-section textarea { width: 100%; padding: 0.75rem 1rem; background: rgba(15,23,42,0.8); border: 1px solid var(--border-light); border-radius: 10px; color: white; font-size: 0.9rem; resize: vertical; outline: none; }
                .pref-section textarea:focus { border-color: var(--brand-primary); }

                .loading-center { display: flex; align-items: center; justify-content: center; height: 50vh; }
                .text-muted { color: var(--text-muted); font-size: 0.85rem; }

                @keyframes spin { to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }

                @media (max-width: 1024px) {
                    .prefs-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default TeacherPreferences;
