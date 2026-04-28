// TeacherWorkload - hours, utilization, projection vs role limits.

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
    BookOpen, Clock, Loader2, TrendingUp, AlertTriangle, CheckCircle
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import ChartTooltip from '../../components/ChartTooltip';
import { DASHBOARD_CONFIG } from '../../config/dashboard';
import '../admin/Dashboard.css';

interface ScheduleRow {
    id: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    subject?: { name: string; code: string } | { name: string; code: string }[] | null;
    section?: { name: string } | { name: string }[] | null;
}
interface TeacherRow { id: string; max_hours: number; employment_type: string; }

const TeacherWorkload: React.FC = () => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
    const [teacher, setTeacher] = useState<TeacherRow | null>(null);

    useEffect(() => {
        if (!profile?.id) return;
        (async () => {
            try {
                const { data: t } = await supabase
                    .from('teachers')
                    .select('id, max_hours, employment_type')
                    .eq('profile_id', profile.id)
                    .maybeSingle();
                setTeacher(t as TeacherRow | null);
                if (t) {
                    const { data: s } = await supabase
                        .from('schedules')
                        .select('id, day_of_week, start_time, end_time, subject:subjects(name, code), section:sections(name)')
                        .eq('teacher_id', t.id)
                        .eq('status', 'published');
                    setSchedules(((s || []) as unknown) as ScheduleRow[]);
                }
            } catch (err) {
                console.error('[Workload] load failed', err);
            } finally {
                setLoading(false);
            }
        })();
    }, [profile?.id]);

    const minutesOf = (s: ScheduleRow): number => {
        const [sh, sm] = (s.start_time || '0:0').split(':').map(Number);
        const [eh, em] = (s.end_time || '0:0').split(':').map(Number);
        return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
    };
    const subjectName = (s: ScheduleRow['subject']): string => {
        if (!s) return '—';
        if (Array.isArray(s)) return s[0]?.name || '—';
        return s.name;
    };

    const totalMinutes = useMemo(
        () => schedules.reduce((sum, s) => sum + minutesOf(s), 0),
        [schedules]
    );
    const totalHours = totalMinutes / 60;
    const maxHours = teacher?.max_hours || 40;
    const utilization = maxHours > 0 ? Math.min(100, Math.round((totalHours / maxHours) * 100)) : 0;
    const status: 'under' | 'within' | 'over' =
        utilization < 70 ? 'under' : utilization > 100 ? 'over' : 'within';

    const byDay = useMemo(() => {
        const map = new Map<string, number>();
        DASHBOARD_CONFIG.CHART.SCHEDULE_DAYS.forEach(d => map.set(d, 0));
        schedules.forEach(s => {
            map.set(s.day_of_week, (map.get(s.day_of_week) || 0) + minutesOf(s) / 60);
        });
        return Array.from(map.entries()).map(([day, hours]) => ({
            day: day.slice(0, 3),
            hours: Math.round(hours * 10) / 10,
        }));
    }, [schedules]);

    const bySubject = useMemo(() => {
        const map = new Map<string, number>();
        schedules.forEach(s => {
            const name = subjectName(s.subject);
            map.set(name, (map.get(name) || 0) + minutesOf(s) / 60);
        });
        return Array.from(map.entries())
            .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
            .sort((a, b) => b.hours - a.hours);
    }, [schedules]);

    if (loading) {
        return <div className="dashboard"><div className="dash-loading-center"><Loader2 className="spin" size={28} /></div></div>;
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1 className="dashboard-title"><BookOpen size={20} /> My Workload</h1>
                <p className="dashboard-subtitle">
                    Weekly teaching hours from your published schedule, compared against your role limit.
                </p>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon"><Clock size={20} /></div>
                    <div className="stat-number">{Math.round(totalHours * 10) / 10}h</div>
                    <div className="stat-label">Weekly hours</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><TrendingUp size={20} /></div>
                    <div className="stat-number">{maxHours}h</div>
                    <div className="stat-label">Role limit</div>
                </div>
                <div className={`stat-card ${status === 'over' ? 'stat-warning' : ''}`}>
                    <div className="stat-icon">
                        {status === 'over' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                    </div>
                    <div className="stat-number">{utilization}%</div>
                    <div className="stat-label">Utilization · {status}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><BookOpen size={20} /></div>
                    <div className="stat-number">{bySubject.length}</div>
                    <div className="stat-label">Distinct subjects</div>
                </div>
            </div>

            <div className="admin-dash-grid">
                <div className="admin-dash-left">
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div className="dash-card-title">Hours by day</div>
                            <span className="dash-card-badge dash-badge-info">
                                {Math.round(totalHours * 10) / 10}h total
                            </span>
                        </div>
                        <div className="dash-chart-wrap">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={byDay} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-elevated)', opacity: 0.4 }} />
                                    <Bar dataKey="hours" name="Hours" radius={[4, 4, 0, 0]}>
                                        {byDay.map((d, i) => (
                                            <Cell key={i} fill={d.hours > maxHours / 5 ? '#f59e0b' : '#6366f1'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="admin-dash-right">
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div className="dash-card-title">By subject</div>
                            <span className="dash-card-badge dash-badge-info">{bySubject.length}</span>
                        </div>
                        {bySubject.length === 0 ? (
                            <div className="dash-empty"><BookOpen size={28} /><div>No published schedule yet.</div></div>
                        ) : (
                            <div className="dash-list">
                                {bySubject.slice(0, 8).map(s => (
                                    <div key={s.name} className="dash-list-item">
                                        <div className="dash-list-item-accent dash-accent-info" />
                                        <div className="dash-list-item-body dash-list-item-body--compact">
                                            <div className="dash-list-item-title">{s.name}</div>
                                            <div className="dash-list-item-meta">{s.hours}h / week</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeacherWorkload;
