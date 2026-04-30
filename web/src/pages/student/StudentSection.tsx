// StudentSection - section-wide weekly schedule grid for the student's section.
// Visibility gated by `students_can_see_section_wide_schedule` rule.

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Calendar, MapPin, Loader2, Lock } from 'lucide-react';
import '../admin/Dashboard.css';

interface Row {
    id: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    subject?: { name: string; code: string } | { name: string; code: string }[] | null;
    room?: { name: string } | { name: string }[] | null;
    teacher?: { profile?: { full_name: string } | { full_name: string }[] | null } | { profile?: { full_name: string } | { full_name: string }[] | null }[] | null;
}

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const StudentSection: React.FC = () => {
    const { profile } = useAuth();
    const perms = usePermissions();
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<Row[]>([]);

    useEffect(() => {
        if (!profile?.section) { setLoading(false); return; }
        if (!perms.ruleEnabled('students_can_see_section_wide_schedule', true)) {
            setLoading(false);
            return;
        }
        (async () => {
            try {
                const { data } = await supabase
                    .from('schedules')
                    .select('id, day_of_week, start_time, end_time, subject:subjects(name, code), room:rooms(name), teacher:teachers(profile_id:profiles(full_name)), section:sections(name)')
                    .eq('status', 'published');
                const list = ((data || []) as unknown as Array<Row & { section?: { name: string } | { name: string }[] | null }>).filter(s => {
                    const sec = Array.isArray(s.section) ? s.section[0] : s.section;
                    return sec?.name?.toLowerCase() === profile.section?.toLowerCase();
                });
                setItems(list);
            } catch (err) {
                console.error('[StudentSection] load failed', err);
            } finally {
                setLoading(false);
            }
        })();
    }, [profile?.section, perms]);

    const subjectName = (s: Row['subject']) => Array.isArray(s) ? s[0]?.name : s?.name || '—';
    const roomName = (r: Row['room']) => Array.isArray(r) ? r[0]?.name : r?.name || 'TBA';
    const teacherName = (t: Row['teacher']): string => {
        const obj = Array.isArray(t) ? t[0] : t;
        const p = Array.isArray(obj?.profile) ? obj.profile[0] : obj?.profile;
        return p?.full_name || 'TBA';
    };
    const fmt = (hhmm: string) => {
        const [h, m] = hhmm.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
        return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
    };
    const minOf = (hhmm: string) => {
        const [h, m] = hhmm.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };

    const byDay = useMemo(() => {
        const map = new Map<string, Row[]>();
        DAYS.forEach(d => map.set(d, []));
        items.forEach(s => {
            const list = map.get(s.day_of_week);
            if (list) list.push(s);
        });
        map.forEach(list => list.sort((a, b) => minOf(a.start_time) - minOf(b.start_time)));
        return map;
    }, [items]);

    if (!perms.ruleEnabled('students_can_see_section_wide_schedule', true)) {
        return (
            <div className="dashboard">
                <div className="dash-empty"><Lock size={28} /><div>The section-wide schedule view has been disabled by your administrator.</div></div>
            </div>
        );
    }

    if (loading) {
        return <div className="dashboard"><div className="dash-loading-center"><Loader2 className="spin" size={28} /></div></div>;
    }

    if (!profile?.section) {
        return (
            <div className="dashboard">
                <div className="dash-empty"><Calendar size={28} /><div>No section assigned to your account.</div></div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1 className="dashboard-title"><Calendar size={20} /> Section Schedule</h1>
                <p className="dashboard-subtitle">
                    All classes for <strong>{profile.section}</strong> this week.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {DAYS.map(day => {
                    const list = byDay.get(day) || [];
                    return (
                        <div key={day} className="dash-card dash-stagger">
                            <div className="dash-card-header" style={{ marginBottom: 8 }}>
                                <div className="dash-card-title">{day}</div>
                                <span className="dash-card-badge dash-badge-info">{list.length}</span>
                            </div>
                            {list.length === 0 ? (
                                <div className="dash-empty" style={{ padding: '12px 0' }}><div>—</div></div>
                            ) : (
                                <div className="dash-list" style={{ gap: 4 }}>
                                    {list.map(s => (
                                        <div key={s.id} className="dash-list-item" style={{ padding: 8 }}>
                                            <div className="dash-list-item-accent dash-accent-info" />
                                            <div className="dash-list-item-body dash-list-item-body--compact">
                                                <div className="dash-list-item-title" style={{ fontSize: 12 }}>{subjectName(s.subject)}</div>
                                                <div className="dash-list-item-meta" style={{ fontSize: 10 }}>
                                                    {fmt(s.start_time)} – {fmt(s.end_time)}
                                                </div>
                                                <div className="dash-list-item-meta" style={{ fontSize: 10 }}>
                                                    <MapPin size={9} style={{ verticalAlign: 'middle' }} /> {roomName(s.room)}{perms.ruleEnabled('students_can_see_teacher_names', true) && <> · {teacherName(s.teacher)}</>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default StudentSection;
