import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { CalendarDays, Clock, MapPin, Download, Printer, ChevronLeft, ChevronRight, List, LayoutGrid, Timer } from 'lucide-react';
import '../admin/Dashboard.css';

interface ScheduleItem {
    id: string; day_of_week: string; start_time: string; end_time: string;
    subject: { name: string; code: string } | null;
    room: { name: string; building: string } | null;
    section: { name: string; program: string } | null;
}

const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOUR_HEIGHT = 64;
const START_HOUR = 7;
const END_HOUR = 21;
const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#6366f1', '#f97316'];

const TeacherSchedule: React.FC = () => {
    const { profile } = useAuth();
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'table' | 'grid' | 'timeline'>('timeline');
    const [selectedDay, setSelectedDay] = useState(() => {
        const d = new Date().getDay();
        return d === 0 ? 'Monday' : dayOrder[d - 1] || 'Monday';
    });

    useEffect(() => { if (profile?.id) fetchSchedules(); }, [profile]);

    const fetchSchedules = async () => {
        try {
            const { data: teacher } = await supabase.from('teachers').select('id').eq('profile_id', profile!.id).single();
            if (teacher) {
                const { data } = await supabase.from('schedules')
                    .select('id, day_of_week, start_time, end_time, subject:subjects(name, code), room:rooms(name, building), section:sections(name, program)')
                    .eq('teacher_id', teacher.id);
                setSchedules((data as any[]) || []);
            }
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const sorted = useMemo(() => [...schedules].sort((a, b) => {
        const dd = dayOrder.indexOf(a.day_of_week) - dayOrder.indexOf(b.day_of_week);
        return dd !== 0 ? dd : a.start_time.localeCompare(b.start_time);
    }), [schedules]);

    const groupedByDay = useMemo(() => dayOrder.reduce((acc: Record<string, ScheduleItem[]>, day) => {
        acc[day] = sorted.filter(s => s.day_of_week === day);
        return acc;
    }, {} as Record<string, ScheduleItem[]>), [sorted]);

    const daySchedules = useMemo(() => groupedByDay[selectedDay] || [], [groupedByDay, selectedDay]);

    const amCount = daySchedules.filter(s => { const h = parseInt(s.start_time); return h < 12; }).length;
    const pmCount = daySchedules.filter(s => { const h = parseInt(s.start_time); return h >= 12; }).length;

    const navigateDay = (dir: number) => {
        const idx = dayOrder.indexOf(selectedDay);
        const next = (idx + dir + dayOrder.length) % dayOrder.length;
        setSelectedDay(dayOrder[next]);
    };

    const formatTime12 = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        const ap = h >= 12 ? 'PM' : 'AM';
        return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, '0')} ${ap}`;
    };

    const exportCSV = () => {
        const header = 'Day,Start Time,End Time,Subject Code,Subject Name,Room,Section\n';
        const rows = sorted.map(s =>
            `${s.day_of_week},${s.start_time?.slice(0, 5)},${s.end_time?.slice(0, 5)},"${(s.subject as any)?.code || ''}","${(s.subject as any)?.name || ''}","${(s.room as any)?.name || ''}","${(s.section as any)?.name || ''}"`
        ).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `schedule_${profile?.full_name?.replace(/\s+/g, '_') || 'teacher'}.csv`;
        a.click(); URL.revokeObjectURL(url);
    };

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">My Schedule</h1>
                    <p className="dashboard-subtitle">{schedules.length} classes this semester</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="btn btn-secondary" onClick={exportCSV} style={{ padding: '6px 14px', fontSize: 13 }} disabled={schedules.length === 0}>
                        <Download size={14} /> Export
                    </button>
                    <button className="btn btn-secondary" onClick={() => window.print()} style={{ padding: '6px 14px', fontSize: 13 }}><Printer size={14} /> Print</button>
                    <div style={{ display: 'flex', gap: 2, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: 3, border: '1px solid var(--border-default)' }}>
                        {[{ key: 'timeline', icon: <Timer size={14} /> }, { key: 'table', icon: <List size={14} /> }, { key: 'grid', icon: <LayoutGrid size={14} /> }].map(v => (
                            <button key={v.key} className={`btn ${viewMode === v.key ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setViewMode(v.key as any)}>{v.icon}</button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : schedules.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 60 }}>
                    <CalendarDays size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-muted)' }}>No schedule assigned yet.</p>
                </div>
            ) : viewMode === 'timeline' ? (
                <>
                    {/* Day Navigator */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <button className="btn btn-ghost" onClick={() => navigateDay(-1)} style={{ padding: 6 }}><ChevronLeft size={20} /></button>
                        <div style={{ display: 'flex', gap: 6, flex: 1, justifyContent: 'center' }}>
                            {dayOrder.map(day => {
                                const count = groupedByDay[day]?.length || 0;
                                const isActive = day === selectedDay;
                                return (
                                    <button key={day} onClick={() => setSelectedDay(day)} style={{
                                        padding: '8px 16px', borderRadius: 10, border: isActive ? '1px solid var(--brand-primary)' : '1px solid var(--border-default)',
                                        background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent', color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                                        cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 600 : 400, position: 'relative', transition: 'all 0.2s'
                                    }}>
                                        {day.slice(0, 3)}
                                        {count > 0 && <span style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)' }}>{count}</span>}
                                    </button>
                                );
                            })}
                        </div>
                        <button className="btn btn-ghost" onClick={() => navigateDay(1)} style={{ padding: 6 }}><ChevronRight size={20} /></button>
                    </div>

                    {/* AM/PM chips */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <span className="badge" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>{amCount} AM</span>
                        <span className="badge" style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>{pmCount} PM</span>
                        <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>{daySchedules.length} total</span>
                    </div>

                    {/* Timeline */}
                    {daySchedules.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No classes on {selectedDay}</div>
                    ) : (
                        <div className="card" style={{ padding: '0 0 0 60px', position: 'relative', overflow: 'hidden' }}>
                            {/* Hour lines */}
                            {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => (
                                <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * HOUR_HEIGHT, height: HOUR_HEIGHT, borderTop: '1px solid rgba(255,255,255,0.04)', zIndex: 0 }}>
                                    <span style={{ position: 'absolute', left: 8, top: -8, fontSize: 10, color: 'var(--text-muted)', width: 44, textAlign: 'right' }}>
                                        {formatTime12(`${START_HOUR + i}:00`).replace(':00 ', ' ')}
                                    </span>
                                </div>
                            ))}

                            {/* Schedule blocks */}
                            <div style={{ position: 'relative', height: (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT, marginLeft: 4 }}>
                                {daySchedules.map((s, i) => {
                                    const [sh, sm] = s.start_time.split(':').map(Number);
                                    const [eh, em] = s.end_time.split(':').map(Number);
                                    const topPx = ((sh - START_HOUR) + sm / 60) * HOUR_HEIGHT;
                                    const heightPx = ((eh - START_HOUR) + em / 60) * HOUR_HEIGHT - topPx;
                                    const color = colors[i % colors.length];
                                    return (
                                        <div key={s.id} style={{
                                            position: 'absolute', left: 8, right: 16, top: topPx, height: Math.max(heightPx, 32),
                                            background: `${color}18`, border: `1px solid ${color}50`, borderLeft: `4px solid ${color}`,
                                            borderRadius: 10, padding: '8px 12px', zIndex: 1, overflow: 'hidden', transition: 'all 0.2s',
                                        }}>
                                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{(s.subject as any)?.code} — {(s.subject as any)?.name}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', gap: 12 }}>
                                                <span><Clock size={10} /> {formatTime12(s.start_time)} – {formatTime12(s.end_time)}</span>
                                                <span><MapPin size={10} /> {(s.room as any)?.name}</span>
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{(s.section as any)?.name}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            ) : viewMode === 'table' ? (
                <div className="table-container">
                    <table>
                        <thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Room</th><th>Section</th></tr></thead>
                        <tbody>
                            {sorted.map(s => (
                                <tr key={s.id}>
                                    <td style={{ fontWeight: 600 }}>{s.day_of_week}</td>
                                    <td><Clock size={14} style={{ color: 'var(--text-muted)', marginRight: 4 }} />{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</td>
                                    <td><strong>{(s.subject as any)?.code}</strong><br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(s.subject as any)?.name}</span></td>
                                    <td><MapPin size={14} style={{ color: 'var(--text-muted)', marginRight: 4 }} />{(s.room as any)?.name}</td>
                                    <td><span className="badge badge-student">{(s.section as any)?.name}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                    {dayOrder.filter(d => groupedByDay[d]?.length > 0).map(day => (
                        <div key={day} className="card" style={{ padding: 16 }}>
                            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-default)' }}>{day}</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {groupedByDay[day].map(s => (
                                    <div key={s.id} style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: 10, borderLeft: '3px solid var(--accent-primary)' }}>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{(s.subject as any)?.code}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{(s.room as any)?.name} | {(s.section as any)?.name}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TeacherSchedule;
