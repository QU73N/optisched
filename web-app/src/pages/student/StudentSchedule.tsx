import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { CalendarDays, Clock, MapPin } from 'lucide-react';
import '../admin/Dashboard.css';

interface ScheduleItem {
    id: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    subject: { name: string; code: string } | null;
    room: { name: string; building: string } | null;
    teacher: { profile: { full_name: string } | null } | null;
}

const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const StudentSchedule: React.FC = () => {
    const { profile } = useAuth();
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile?.section) fetchSchedules();
        else setLoading(false);
    }, [profile]);

    const fetchSchedules = async () => {
        try {
            const { data: sec } = await supabase.from('sections').select('id').eq('name', profile!.section!).single();
            if (sec) {
                const { data } = await supabase
                    .from('schedules')
                    .select('id, day_of_week, start_time, end_time, subject:subjects(name, code), room:rooms(name, building), teacher:teachers(profile:profiles(full_name))')
                    .eq('section_id', sec.id).eq('status', 'published');
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

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">My Schedule</h1>
                    <p className="dashboard-subtitle">
                        {profile?.program && profile?.section ? `${profile.program} — Section ${profile.section}` : 'Class schedule'}
                    </p>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : schedules.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 60 }}>
                    <CalendarDays size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                    <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>No Schedule Yet</h3>
                    <p style={{ color: 'var(--text-muted)' }}>
                        {profile?.section ? 'Schedule not published for your section yet.' : 'Your section is not assigned. Contact the admin.'}
                    </p>
                </div>
            ) : (
                <>
                    {/* Weekly Grid View */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                        {dayOrder.filter(d => groupedByDay[d]?.length > 0).map(day => (
                            <div key={day} className="card" style={{ padding: 16 }}>
                                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-default)' }}>{day}</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {groupedByDay[day].map(s => (
                                        <div key={s.id} style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: 10, borderLeft: '3px solid var(--accent-success)' }}>
                                            <div style={{ fontWeight: 600, fontSize: 13 }}>{(s.subject as any)?.code}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                                <Clock size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                                {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                <MapPin size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                                {(s.room as any)?.name}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                                                {(s.teacher as any)?.profile?.full_name || 'TBA'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Full Table View */}
                    <div className="card">
                        <h3 className="card-title">Full Schedule</h3>
                        <div className="table-container">
                            <table>
                                <thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th></tr></thead>
                                <tbody>
                                    {sorted.map(s => (
                                        <tr key={s.id}>
                                            <td style={{ fontWeight: 600 }}>{s.day_of_week}</td>
                                            <td><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={14} style={{ color: 'var(--text-muted)' }} />{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</span></td>
                                            <td><span style={{ fontWeight: 600 }}>{(s.subject as any)?.code}</span><br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(s.subject as any)?.name}</span></td>
                                            <td>{(s.teacher as any)?.profile?.full_name || 'TBA'}</td>
                                            <td><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={14} style={{ color: 'var(--text-muted)' }} />{(s.room as any)?.name}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default StudentSchedule;
