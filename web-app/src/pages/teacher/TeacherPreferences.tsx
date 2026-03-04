import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Clock, Save, Loader2 } from 'lucide-react';
import '../admin/Dashboard.css';

const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const timeSlots = ['Morning (7:00 - 12:00)', 'Afternoon (12:00 - 17:00)', 'Evening (17:00 - 21:00)'];

const TeacherPreferences: React.FC = () => {
    const { profile } = useAuth();
    const [preferences, setPreferences] = useState<Record<string, string[]>>({});
    const [maxHours, setMaxHours] = useState(40);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (profile?.id) loadPreferences();
    }, [profile]);

    const loadPreferences = async () => {
        try {
            const { data: teacher } = await supabase
                .from('teachers').select('id, max_hours').eq('profile_id', profile!.id).single();
            if (teacher) {
                setMaxHours(teacher.max_hours || 40);
                const { data: prefs } = await supabase
                    .from('teacher_preferences').select('*').eq('teacher_id', teacher.id);
                if (prefs && prefs.length > 0) {
                    const parsed = prefs[0];
                    setPreferences(parsed.preferred_slots || {});
                    setNotes(parsed.notes || '');
                }
            }
        } catch (err) { console.error(err); }
    };

    const toggleSlot = (day: string, slot: string) => {
        setPreferences(prev => {
            const curr = prev[day] || [];
            return { ...prev, [day]: curr.includes(slot) ? curr.filter(s => s !== slot) : [...curr, slot] };
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data: teacher } = await supabase
                .from('teachers').select('id').eq('profile_id', profile!.id).single();
            if (teacher) {
                await supabase.from('teacher_preferences').upsert({
                    teacher_id: teacher.id,
                    preferred_slots: preferences,
                    notes,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'teacher_id' });
                await supabase.from('teachers').update({ max_hours: maxHours }).eq('id', teacher.id);
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch (err) { console.error(err); }
        finally { setSaving(false); }
    };

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Preferences</h1>
                    <p className="dashboard-subtitle">Set your teaching time preferences</p>
                </div>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                    {saved ? 'Saved!' : 'Save Preferences'}
                </button>
            </div>

            {/* Max Hours */}
            <div className="card" style={{ marginBottom: 20 }}>
                <h3 className="card-title">Maximum Weekly Hours</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <input className="input" type="number" min={4} max={60} value={maxHours} onChange={e => setMaxHours(parseInt(e.target.value))} style={{ width: 100 }} />
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>hours per week</span>
                </div>
            </div>

            {/* Availability Grid */}
            <div className="card" style={{ marginBottom: 20 }}>
                <h3 className="card-title">
                    <Clock size={18} style={{ verticalAlign: 'middle', marginRight: 8, color: 'var(--accent-primary)' }} />
                    Preferred Time Slots
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
                    Select the time slots when you prefer to teach. Green = preferred.
                </p>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'separate', borderSpacing: 4 }}>
                        <thead>
                            <tr>
                                <th style={{ padding: '8px 12px', minWidth: 100 }}>Day</th>
                                {timeSlots.map(s => <th key={s} style={{ padding: '8px 12px', minWidth: 160, textAlign: 'center' }}>{s}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {dayOrder.map(day => (
                                <tr key={day}>
                                    <td style={{ fontWeight: 600, padding: '8px 12px' }}>{day}</td>
                                    {timeSlots.map(slot => {
                                        const selected = (preferences[day] || []).includes(slot);
                                        return (
                                            <td key={slot} style={{ padding: 4 }}>
                                                <button
                                                    onClick={() => toggleSlot(day, slot)}
                                                    style={{
                                                        width: '100%', padding: '12px 8px', borderRadius: 'var(--radius-sm)',
                                                        cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'var(--font-family)',
                                                        transition: 'all 150ms ease',
                                                        background: selected ? 'rgba(16,185,129,0.2)' : 'var(--bg-secondary)',
                                                        color: selected ? '#34d399' : 'var(--text-muted)',
                                                        border: selected ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border-default)',
                                                    }}
                                                >
                                                    {selected ? 'Preferred' : 'Available'}
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Notes */}
            <div className="card">
                <h3 className="card-title">Additional Notes</h3>
                <textarea
                    className="input"
                    rows={4}
                    placeholder="Any special requests or notes for the scheduler..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    style={{ resize: 'vertical' }}
                />
            </div>

            <style>{`
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};

export default TeacherPreferences;
