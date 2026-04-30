// StudentUpcoming - next class, next break, today's remaining classes.

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Clock, Calendar, MapPin, Loader2, Coffee, BookOpen } from 'lucide-react';
import { DASHBOARD_CONFIG } from '../../config/dashboard';
import '../admin/Dashboard.css';

interface ScheduleRow {
    id: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    subject?: { name: string; code: string } | { name: string; code: string }[] | null;
    room?: { name: string } | { name: string }[] | null;
    teacher?: { profile?: { full_name: string } | { full_name: string }[] | null } | { profile?: { full_name: string } | { full_name: string }[] | null }[] | null;
}

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const StudentUpcoming: React.FC = () => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [weekly, setWeekly] = useState<ScheduleRow[]>([]);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), DASHBOARD_CONFIG.TIME.TIMER_INTERVAL_MS);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        if (!profile?.section) { setLoading(false); return; }
        (async () => {
            try {
                const { data } = await supabase
                    .from('schedules')
                    .select('id, day_of_week, start_time, end_time, subject:subjects(name, code), room:rooms(name), teacher:teachers(profile_id:profiles(full_name)), section:sections(name)')
                    .eq('status', 'published');
                const list = ((data || []) as unknown as Array<ScheduleRow & { section?: { name: string } | { name: string }[] | null }>).filter(s => {
                    const sec = Array.isArray(s.section) ? s.section[0] : s.section;
                    return sec?.name?.toLowerCase() === profile.section?.toLowerCase();
                });
                setWeekly(list);
            } catch (err) {
                console.error('[StudentUpcoming] load failed', err);
            } finally {
                setLoading(false);
            }
        })();
    }, [profile?.section]);

    const minutesNow = now.getHours() * 60 + now.getMinutes();
    const todayName = DAYS[now.getDay()];

    const subjectName = (s: ScheduleRow['subject']): string => {
        if (!s) return '—';
        if (Array.isArray(s)) return s[0]?.name || '—';
        return s.name;
    };
    const roomName = (r: ScheduleRow['room']): string => {
        if (!r) return 'TBA';
        if (Array.isArray(r)) return r[0]?.name || 'TBA';
        return r.name;
    };
    const teacherName = (t: ScheduleRow['teacher']): string => {
        if (!t) return 'TBA';
        const obj = Array.isArray(t) ? t[0] : t;
        const p = Array.isArray(obj?.profile) ? obj.profile[0] : obj?.profile;
        return p?.full_name || 'TBA';
    };
    const minOf = (hhmm: string): number => {
        const [h, m] = (hhmm || '0:0').split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };

    const fmt = (hhmm: string): string => {
        const [h, m] = hhmm.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
        return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    const today = useMemo(() => weekly.filter(s => s.day_of_week === todayName).sort((a, b) => minOf(a.start_time) - minOf(b.start_time)), [weekly, todayName]);
    const remaining = useMemo(() => today.filter(s => minOf(s.end_time) > minutesNow), [today, minutesNow]);
    const next = remaining.find(s => minOf(s.start_time) > minutesNow) || null;
    const ongoing = today.find(s => minOf(s.start_time) <= minutesNow && minOf(s.end_time) > minutesNow) || null;

    // Find next break (gap between consecutive classes today)
    const nextBreak = useMemo(() => {
        for (let i = 0; i < remaining.length - 1; i++) {
            const endA = minOf(remaining[i].end_time);
            const startB = minOf(remaining[i + 1].start_time);
            if (startB > endA) {
                return {
                    after: subjectName(remaining[i].subject),
                    durationMin: startB - endA,
                    starts: fmt(remaining[i].end_time),
                    ends: fmt(remaining[i + 1].start_time),
                };
            }
        }
        return null;
    }, [remaining]);

    if (loading) {
        return <div className="dashboard"><div className="dash-loading-center"><Loader2 className="spin" size={28} /></div></div>;
    }

    if (!profile?.section) {
        return (
            <div className="dashboard">
                <div className="dash-empty"><Calendar size={28} /><div>No section assigned to your account yet.</div></div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1 className="dashboard-title"><Clock size={20} /> Upcoming</h1>
                <p className="dashboard-subtitle">
                    {todayName}, {now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} · live updates every 30s
                </p>
            </div>

            <div className="admin-dash-grid">
                <div className="admin-dash-left">
                    {/* Now / Next */}
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div className="dash-card-title"><BookOpen size={16} /> Right now</div>
                        </div>
                        {ongoing ? (
                            <div className="dash-list-item" style={{ padding: 12 }}>
                                <div className="dash-list-item-accent dash-accent-success" />
                                <div className="dash-list-item-body">
                                    <div className="dash-list-item-title">{subjectName(ongoing.subject)}</div>
                                    <div className="dash-list-item-meta">
                                        {fmt(ongoing.start_time)} – {fmt(ongoing.end_time)} · <MapPin size={11} style={{ verticalAlign: 'middle' }} /> {roomName(ongoing.room)} · {teacherName(ongoing.teacher)}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="dash-empty" style={{ padding: 16 }}><div>No class right now.</div></div>
                        )}
                    </div>

                    {next && (
                        <div className="dash-card dash-stagger">
                            <div className="dash-card-header">
                                <div className="dash-card-title"><Clock size={16} /> Next class</div>
                                <span className="dash-card-badge dash-badge-info">in {minOf(next.start_time) - minutesNow} min</span>
                            </div>
                            <div className="dash-list-item" style={{ padding: 12 }}>
                                <div className="dash-list-item-accent dash-accent-info" />
                                <div className="dash-list-item-body">
                                    <div className="dash-list-item-title">{subjectName(next.subject)}</div>
                                    <div className="dash-list-item-meta">
                                        {fmt(next.start_time)} – {fmt(next.end_time)} · <MapPin size={11} style={{ verticalAlign: 'middle' }} /> {roomName(next.room)} · {teacherName(next.teacher)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {nextBreak && (
                        <div className="dash-card dash-stagger">
                            <div className="dash-card-header">
                                <div className="dash-card-title"><Coffee size={16} /> Next break</div>
                                <span className="dash-card-badge dash-badge-success">{nextBreak.durationMin} min</span>
                            </div>
                            <div className="dash-meta-text" style={{ padding: '0 4px 4px' }}>
                                After <strong>{nextBreak.after}</strong> · {nextBreak.starts} – {nextBreak.ends}
                            </div>
                        </div>
                    )}
                </div>

                <div className="admin-dash-right">
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div className="dash-card-title"><Calendar size={16} /> Today's schedule</div>
                            <span className="dash-card-badge dash-badge-info">{today.length}</span>
                        </div>
                        {today.length === 0 ? (
                            <div className="dash-empty"><Calendar size={28} /><div>No classes today.</div></div>
                        ) : (
                            <div className="dash-list">
                                {today.map(s => {
                                    const finished = minOf(s.end_time) <= minutesNow;
                                    return (
                                        <div key={s.id} className="dash-list-item" style={finished ? { opacity: 0.5 } : undefined}>
                                            <div className={`dash-list-item-accent ${finished ? 'dash-accent-success' : 'dash-accent-info'}`} />
                                            <div className="dash-list-item-body dash-list-item-body--compact">
                                                <div className="dash-list-item-title">{subjectName(s.subject)}</div>
                                                <div className="dash-list-item-meta">
                                                    {fmt(s.start_time)} – {fmt(s.end_time)} · {roomName(s.room)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentUpcoming;
