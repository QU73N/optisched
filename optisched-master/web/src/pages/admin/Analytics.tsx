import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart3, Users, MapPin, Clock, TrendingUp, CalendarDays } from 'lucide-react';
import '../admin/Dashboard.css';

interface TeacherStat {
    name: string;
    classes: number;
    maxHours: number;
    load: number;
}

interface RoomStat {
    name: string;
    building: string;
    capacity: number;
    classes: number;
    utilization: number;
}

const Analytics: React.FC = () => {
    const [teacherStats, setTeacherStats] = useState<TeacherStat[]>([]);
    const [roomStats, setRoomStats] = useState<RoomStat[]>([]);
    const [scheduleCount, setScheduleCount] = useState(0);
    const [conflictCount, setConflictCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchAnalytics(); }, []);

    const fetchAnalytics = async () => {
        setLoading(true);
        const [schedRes, teacherRes, roomRes, conflictRes] = await Promise.all([
            supabase.from('schedules').select('id, teacher_id, room_id, day_of_week, start_time, end_time'),
            supabase.from('teachers').select('id, max_hours, profile:profiles(full_name)'),
            supabase.from('rooms').select('id, name, building, capacity'),
            supabase.from('conflicts').select('id').eq('is_resolved', false),
        ]);

        const schedules = schedRes.data || [];
        const teachers = teacherRes.data || [];
        const rooms = roomRes.data || [];

        setScheduleCount(schedules.length);
        setConflictCount(conflictRes.data?.length || 0);

        // Teacher stats
        const tStats: TeacherStat[] = teachers.map((t: any) => {
            const classes = schedules.filter(s => s.teacher_id === t.id).length;
            const maxHours = t.max_hours || 40;
            return {
                name: t.profile?.full_name || 'Unknown',
                classes,
                maxHours,
                load: Math.round((classes / (maxHours / 3)) * 100), // rough estimate
            };
        }).sort((a: TeacherStat, b: TeacherStat) => b.load - a.load);

        // Room stats
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const maxSlotsPerDay = 10;
        const rStats: RoomStat[] = rooms.map((r: any) => {
            const classes = schedules.filter(s => s.room_id === r.id).length;
            const totalSlots = days.length * maxSlotsPerDay;
            return {
                name: r.name,
                building: r.building,
                capacity: r.capacity,
                classes,
                utilization: Math.round((classes / totalSlots) * 100),
            };
        }).sort((a: RoomStat, b: RoomStat) => b.utilization - a.utilization);

        setTeacherStats(tStats);
        setRoomStats(rStats);
        setLoading(false);
    };

    const avgTeacherLoad = teacherStats.length > 0
        ? Math.round(teacherStats.reduce((s, t) => s + t.load, 0) / teacherStats.length)
        : 0;
    const avgRoomUtil = roomStats.length > 0
        ? Math.round(roomStats.reduce((s, r) => s + r.utilization, 0) / roomStats.length)
        : 0;

    const getLoadColor = (load: number) => {
        if (load > 100) return '#ef4444';
        if (load > 75) return '#fbbf24';
        if (load > 40) return '#34d399';
        return '#60a5fa';
    };

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Analytics & Insights</h1>
                    <p className="dashboard-subtitle">Schedule performance and resource utilization</p>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="stats-grid" style={{ marginBottom: 24 }}>
                        <div className="stat-card">
                            <div className="stat-icon"><CalendarDays size={20} /></div>
                            <div className="stat-number">{scheduleCount}</div>
                            <div className="stat-label">Total Schedules</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon"><Users size={20} /></div>
                            <div className="stat-number">{teacherStats.length}</div>
                            <div className="stat-label">Teachers</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon"><TrendingUp size={20} /></div>
                            <div className="stat-number">{avgTeacherLoad}%</div>
                            <div className="stat-label">Avg Teacher Load</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon"><MapPin size={20} /></div>
                            <div className="stat-number">{avgRoomUtil}%</div>
                            <div className="stat-label">Avg Room Usage</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 20 }}>
                        {/* Teacher Load Chart */}
                        <div className="card">
                            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <BarChart3 size={18} style={{ color: 'var(--accent-primary)' }} />
                                Teacher Workload Distribution
                            </h3>
                            {teacherStats.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No teacher data available</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {teacherStats.map((t, i) => (
                                        <div key={i}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{t.name}</span>
                                                <span style={{ fontSize: 12, color: getLoadColor(t.load), fontWeight: 600 }}>{t.load}% ({t.classes} classes)</span>
                                            </div>
                                            <div style={{ width: '100%', height: 8, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${Math.min(t.load, 100)}%`,
                                                    height: '100%',
                                                    background: getLoadColor(t.load),
                                                    borderRadius: 4,
                                                    transition: 'width 600ms ease',
                                                }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Room Utilization Chart */}
                        <div className="card">
                            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <MapPin size={18} style={{ color: 'var(--accent-warning)' }} />
                                Room Utilization
                            </h3>
                            {roomStats.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No room data available</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {roomStats.map((r, i) => (
                                        <div key={i}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                                                    {r.name} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({r.building}, cap: {r.capacity})</span>
                                                </span>
                                                <span style={{ fontSize: 12, color: getLoadColor(r.utilization), fontWeight: 600 }}>{r.utilization}%</span>
                                            </div>
                                            <div style={{ width: '100%', height: 8, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${Math.min(r.utilization, 100)}%`,
                                                    height: '100%',
                                                    background: getLoadColor(r.utilization),
                                                    borderRadius: 4,
                                                    transition: 'width 600ms ease',
                                                }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Schedule Metrics */}
                    <div className="card" style={{ marginTop: 20 }}>
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Clock size={18} style={{ color: 'var(--accent-success)' }} />
                            Schedule Health
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 16, textAlign: 'center' }}>
                                <div style={{ fontSize: 28, fontWeight: 700, color: conflictCount === 0 ? '#34d399' : '#ef4444' }}>{conflictCount}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Active Conflicts</div>
                            </div>
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 16, textAlign: 'center' }}>
                                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{teacherStats.filter(t => t.load > 100).length}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Overloaded Teachers</div>
                            </div>
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 16, textAlign: 'center' }}>
                                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{teacherStats.filter(t => t.classes === 0).length}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Unassigned Teachers</div>
                            </div>
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 16, textAlign: 'center' }}>
                                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{roomStats.filter(r => r.classes === 0).length}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Unused Rooms</div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default Analytics;
