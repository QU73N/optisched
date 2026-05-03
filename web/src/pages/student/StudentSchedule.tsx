import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { CalendarDays, Clock, MapPin, ChevronLeft, ChevronRight, List, LayoutGrid, Timer, Download } from 'lucide-react';
import { toCsv, downloadCsv } from '../../utils/csv';
import '../admin/Dashboard.css';

interface ScheduleItem {
    id: string; day_of_week: string; start_time: string; end_time: string;
    subject: { name: string; code: string } | null;
    room: { name: string; building: string } | null;
    teacher: { profile: { full_name: string } | null } | null;
}

const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOUR_HEIGHT = 64;
const START_HOUR = 7;
const END_HOUR = 21;
const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#6366f1', '#f97316'];

const StudentSchedule: React.FC = () => {
    const { profile } = useAuth();
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'timeline' | 'grid' | 'table'>('timeline');
    const [selectedDay, setSelectedDay] = useState(() => {
        const d = new Date().getDay();
        return d === 0 ? 'Monday' : dayOrder[d - 1] || 'Monday';
    });

    useEffect(() => {
        if (profile?.section) fetchSchedules();
        else setLoading(false);
    }, [profile]);

    const fetchSchedules = async () => {
        try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_schedules_with_details');
            if (rpcError) { console.error('[StudentSchedule] RPC error:', rpcError); setLoading(false); return; }
            // Filter to this student's section + published
            const sectionName = (profile!.section || '').toLowerCase();
            const filtered = (rpcData || [])
                .filter((s: any) => s.status === 'published' && (s.section_name || '').toLowerCase() === sectionName)
                .map((s: any) => ({
                    id: s.id,
                    day_of_week: s.day_of_week,
                    start_time: s.start_time,
                    end_time: s.end_time,
                    subject: { name: s.subject_name, code: s.subject_code },
                    room: { name: s.room_name, building: s.room_building },
                    teacher: { profile: { full_name: s.teacher_name } },
                }));
            setSchedules(filtered);
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
    const amCount = daySchedules.filter(s => parseInt(s.start_time) < 12).length;
    const pmCount = daySchedules.filter(s => parseInt(s.start_time) >= 12).length;

    const navigateDay = (dir: number) => {
        const idx = dayOrder.indexOf(selectedDay);
        setSelectedDay(dayOrder[(idx + dir + dayOrder.length) % dayOrder.length]);
    };

    const formatTime12 = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
    };

    const exportCSV = () => {
        const csv = toCsv(
            ['Day', 'Start', 'End', 'Code', 'Subject', 'Room', 'Teacher'],
            sorted.map(s => [
                s.day_of_week,
                s.start_time?.slice(0, 5),
                s.end_time?.slice(0, 5),
                (s.subject as any)?.code || '',
                (s.subject as any)?.name || '',
                (s.room as any)?.name || '',
                (s.teacher as any)?.profile?.full_name || 'TBA',
            ]),
        );
        downloadCsv(`schedule_${profile?.section || 'student'}`, csv);
    };

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">My Schedule</h1>
                    <p className="dashboard-subtitle">{profile?.program && profile?.section ? `${profile.program} - Section ${profile.section}` : 'Class schedule'}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="btn btn-secondary btn-sm" onClick={exportCSV} disabled={schedules.length === 0}>
                        <Download size={14} /> Export
                    </button>
                    <div style={{ display: 'flex', gap: 2, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: 3, border: '1px solid var(--border-default)' }}>
                        {[{ key: 'timeline', icon: <Timer size={14} /> }, { key: 'grid', icon: <LayoutGrid size={14} /> }, { key: 'table', icon: <List size={14} /> }].map(v => (
                            <button key={v.key} className={`btn ${viewMode === v.key ? 'btn-primary' : 'btn-ghost'} btn-xs`} onClick={() => setViewMode(v.key as any)}>{v.icon}</button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : schedules.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 60 }}>
                    <CalendarDays size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                    <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>No Schedule Yet</h3>
                    <p style={{ color: 'var(--text-muted)' }}>{profile?.section ? 'Schedule not published for your section yet.' : 'Section not assigned. Contact admin.'}</p>
                </div>
            ) : viewMode === 'timeline' ? (
                <>
                    {/* Day Navigator */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => navigateDay(-1)}><ChevronLeft size={20} /></button>
                        <div style={{ display: 'flex', gap: 6, flex: 1, justifyContent: 'center' }}>
                            {dayOrder.map(day => {
                                const count = groupedByDay[day]?.length || 0;
                                const isActive = day === selectedDay;
                                return (
                                    <button key={day} onClick={() => setSelectedDay(day)} className={isActive ? 'font-semibold' : 'font-normal'} style={{
                                        padding: '8px 16px', borderRadius: 10, border: isActive ? '1px solid var(--brand-primary)' : '1px solid var(--border-default)',
                                        background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent', color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                                        cursor: 'pointer', transition: 'all 0.2s'
                                    }}>
                                        {day.slice(0, 3)}
                                        {count > 0 && <span className="text-xs" style={{ display: 'block', color: 'var(--text-muted)' }}>{count}</span>}
                                    </button>
                                );
                            })}
                        </div>
                        <button className="btn btn-ghost btn-icon" onClick={() => navigateDay(1)}><ChevronRight size={20} /></button>
                    </div>

                    {/* AM/PM chips */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <span className="badge" style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>{amCount} AM</span>
                        <span className="badge" style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa' }}>{pmCount} PM</span>
                        <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>{daySchedules.length} total</span>
                    </div>

                    {daySchedules.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No classes on {selectedDay}</div>
                    ) : (
                        <div className="card" style={{ padding: '0 0 0 60px', position: 'relative', overflow: 'hidden' }}>
                            {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => (
                                <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * HOUR_HEIGHT, height: HOUR_HEIGHT, borderTop: '1px solid rgba(255,255,255,0.04)', zIndex: 0 }}>
                                    <span className="text-xs" style={{ position: 'absolute', left: 8, top: -8, color: 'var(--text-muted)', width: 44, textAlign: 'right' }}>
                                        {formatTime12(`${START_HOUR + i}:00`).replace(':00 ', ' ')}
                                    </span>
                                </div>
                            ))}
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
                                            borderRadius: 10, padding: '8px 12px', zIndex: 1, overflow: 'hidden',
                                        }}>
                                            <div className="font-semibold text-base">{(s.subject as any)?.code} — {(s.subject as any)?.name}</div>
                                            <div className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: 2, display: 'flex', gap: 12 }}>
                                                <span><Clock size={10} /> {formatTime12(s.start_time)} – {formatTime12(s.end_time)}</span>
                                                <span><MapPin size={10} /> {(s.room as any)?.name}</span>
                                            </div>
                                            <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: 2 }}>{(s.teacher as any)?.profile?.full_name || 'TBA'}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            ) : viewMode === 'grid' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                    {dayOrder.filter(d => groupedByDay[d]?.length > 0).map(day => (
                        <div key={day} className="card" style={{ padding: 16 }}>
                            <h4 className="text-md font-bold" style={{ marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-default)' }}>{day}</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {groupedByDay[day].map(s => (
                                    <div key={s.id} style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: 10, borderLeft: '3px solid var(--accent-success)' }}>
                                        <div className="font-semibold text-base">{(s.subject as any)?.code}</div>
                                        <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: 2 }}><Clock size={10} style={{ marginRight: 4 }} />{s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)}</div>
                                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}><MapPin size={10} style={{ marginRight: 4 }} />{(s.room as any)?.name}</div>
                                        <div className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{(s.teacher as any)?.profile?.full_name || 'TBA'}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="card">
                    <div className="table-container">
                        <table>
                            <thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th></tr></thead>
                            <tbody>
                                {sorted.map(s => (
                                    <tr key={s.id}>
                                        <td className="font-semibold">{s.day_of_week}</td>
                                        <td><Clock size={14} style={{ color: 'var(--text-muted)', marginRight: 4 }} />{s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)}</td>
                                        <td><strong>{(s.subject as any)?.code}</strong><br /><span className="text-sm" style={{ color: 'var(--text-muted)' }}>{(s.subject as any)?.name}</span></td>
                                        <td>{(s.teacher as any)?.profile?.full_name || 'TBA'}</td>
                                        <td><MapPin size={14} style={{ color: 'var(--text-muted)', marginRight: 4 }} />{(s.room as any)?.name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentSchedule;
