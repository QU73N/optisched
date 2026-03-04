import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { CalendarDays, Clock, MapPin, Download, Printer } from 'lucide-react';
import '../admin/Dashboard.css';

interface ScheduleItem {
    id: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    subject: { name: string; code: string } | null;
    room: { name: string; building: string } | null;
    section: { name: string; program: string } | null;
}

const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TeacherSchedule: React.FC = () => {
    const { profile } = useAuth();
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

    useEffect(() => {
        if (profile?.id) fetchSchedules();
    }, [profile]);

    const fetchSchedules = async () => {
        try {
            const { data: teacher } = await supabase
                .from('teachers').select('id').eq('profile_id', profile!.id).single();
            if (teacher) {
                const { data } = await supabase
                    .from('schedules')
                    .select('id, day_of_week, start_time, end_time, subject:subjects(name, code), room:rooms(name, building), section:sections(name, program)')
                    .eq('teacher_id', teacher.id);
                setSchedules((data as any[]) || []);
            }
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const sorted = [...schedules].sort((a, b) => {
        const dayDiff = dayOrder.indexOf(a.day_of_week) - dayOrder.indexOf(b.day_of_week);
        return dayDiff !== 0 ? dayDiff : a.start_time.localeCompare(b.start_time);
    });

    const groupedByDay = dayOrder.reduce((acc: Record<string, ScheduleItem[]>, day) => {
        acc[day] = sorted.filter(s => s.day_of_week === day);
        return acc;
    }, {} as Record<string, ScheduleItem[]>);

    const exportCSV = () => {
        const header = 'Day,Start Time,End Time,Subject Code,Subject Name,Room,Section\n';
        const rows = sorted.map(s =>
            `${s.day_of_week},${s.start_time?.slice(0, 5)},${s.end_time?.slice(0, 5)},"${(s.subject as any)?.code || ''}","${(s.subject as any)?.name || ''}","${(s.room as any)?.name || ''}","${(s.section as any)?.name || ''}"`
        ).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `schedule_${profile?.full_name?.replace(/\s+/g, '_') || 'teacher'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handlePrint = () => window.print();

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">My Schedule</h1>
                    <p className="dashboard-subtitle">{schedules.length} classes this semester</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="btn btn-secondary" onClick={exportCSV} style={{ padding: '6px 14px', fontSize: 13 }} disabled={schedules.length === 0}>
                        <Download size={14} /> Export CSV
                    </button>
                    <button className="btn btn-secondary" onClick={handlePrint} style={{ padding: '6px 14px', fontSize: 13 }}>
                        <Printer size={14} /> Print
                    </button>
                    <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: 3, border: '1px solid var(--border-default)' }}>
                        <button className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setViewMode('table')}>Table</button>
                        <button className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`} style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setViewMode('grid')}>Grid</button>
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
            ) : viewMode === 'table' ? (
                <div className="table-container">
                    <table>
                        <thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Room</th><th>Section</th></tr></thead>
                        <tbody>
                            {sorted.map(s => (
                                <tr key={s.id}>
                                    <td style={{ fontWeight: 600 }}>{s.day_of_week}</td>
                                    <td><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={14} style={{ color: 'var(--text-muted)' }} />{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</span></td>
                                    <td><span style={{ fontWeight: 600 }}>{(s.subject as any)?.code}</span><br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(s.subject as any)?.name}</span></td>
                                    <td><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={14} style={{ color: 'var(--text-muted)' }} />{(s.room as any)?.name}</span></td>
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
                            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-default)' }}>{day}</h4>
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
