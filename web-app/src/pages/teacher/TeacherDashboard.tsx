import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Clock, MapPin } from 'lucide-react';
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

const TeacherDashboard: React.FC = () => {
    const { profile } = useAuth();
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile?.id) fetchSchedules();
    }, [profile]);

    const fetchSchedules = async () => {
        try {
            // Get teacher record
            const { data: teacher } = await supabase
                .from('teachers')
                .select('id')
                .eq('profile_id', profile!.id)
                .single();

            if (teacher) {
                const { data } = await supabase
                    .from('schedules')
                    .select('id, day_of_week, start_time, end_time, subject:subjects(name, code), room:rooms(name, building), section:sections(name, program)')
                    .eq('teacher_id', teacher.id)
                    .eq('status', 'published');
                setSchedules((data as any[]) || []);
            }
        } catch (err) {
            console.error('Error fetching schedules:', err);
        } finally {
            setLoading(false);
        }
    };

    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const sorted = [...schedules].sort((a, b) => {
        const dayDiff = dayOrder.indexOf(a.day_of_week) - dayOrder.indexOf(b.day_of_week);
        if (dayDiff !== 0) return dayDiff;
        return a.start_time.localeCompare(b.start_time);
    });

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Welcome, {profile?.full_name?.split(' ')[0] || 'Teacher'}</h1>
                    <p className="dashboard-subtitle">Your teaching schedule and information</p>
                </div>
            </div>

            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                <div className="stat-card">
                    <div className="stat-number">{schedules.length}</div>
                    <div className="stat-label">Total Classes</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{new Set(schedules.map(s => s.day_of_week)).size}</div>
                    <div className="stat-label">Teaching Days</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{new Set(schedules.map(s => s.subject?.code)).size}</div>
                    <div className="stat-label">Subjects</div>
                </div>
            </div>

            <div className="card">
                <h3 className="card-title">My Schedule</h3>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }} >
                        <div className="spinner" />
                    </div>
                ) : sorted.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
                        No schedules assigned yet. Check back later.
                    </p>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Day</th>
                                    <th>Time</th>
                                    <th>Subject</th>
                                    <th>Room</th>
                                    <th>Section</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sorted.map(s => (
                                    <tr key={s.id}>
                                        <td style={{ fontWeight: 600 }}>{s.day_of_week}</td>
                                        <td>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                                                {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: 600 }}>{s.subject?.code}</span>
                                            <br />
                                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.subject?.name}</span>
                                        </td>
                                        <td>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
                                                {s.room?.name}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="badge badge-student">{s.section?.name}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeacherDashboard;
