import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSchedules, useAnnouncements } from '../../hooks/useSupabase';
import { useCustomEvents } from '../../hooks/useCustomEvents';
import { Calendar, Clock, BookOpen, Megaphone, MapPin, Users, PieChart as PieIcon } from 'lucide-react';
import {
    Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie
} from 'recharts';
import { ChartTooltip } from '../../components/ChartTooltip';
import { supabase } from '../../lib/supabase';
import '../admin/Dashboard.css';

interface ScheduleItem {
    id: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    status: string;
    subject?: { name: string; code: string };
    section?: { name: string; program: string };
    teacher?: { profile?: { full_name: string }; full_name?: string };
    room?: { name: string; building: string };
    section_id?: string;
}

interface AnnouncementItem {
    id: string;
    target_section?: string;
    title?: string;
    content?: string;
    author_name?: string;
    created_at?: string;
    priority?: string;
}

interface EventItem {
    id: string;
    title?: string;
    event_date?: string;
    creator_name?: string | null;
    creator_role?: string | null;
}

const StudentDashboard: React.FC = () => {
    const { profile } = useAuth();

    const dayIndex = new Date().getDay();
    const isOffDay = dayIndex === 0;
    const scheduleDayName = isOffDay ? 'Monday' : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex];
    const { schedules: allSchedules, loading } = useSchedules({ dayOfWeek: scheduleDayName, status: 'published', isActive: true });
    const { announcements: allAnnouncements } = useAnnouncements();
    const { events: upcomingEvents } = useCustomEvents(undefined, true);

    // DEBUG: Log schedules to understand the data
    console.log('[StudentDashboard DEBUG]', {
        dayIndex,
        isOffDay,
        scheduleDayName,
        allSchedulesCount: allSchedules.length,
        allSchedules: allSchedules.map(s => ({
            id: s.id,
            day_of_week: s.day_of_week,
            subject: s.subject?.name,
            section: s.section?.name,
            section_id: s.section_id,
            is_active: s.is_active,
            status: s.status
        }))
    });

    const [studentSectionId, setStudentSectionId] = useState<string | null>(null);
    const [studentSectionName, setStudentSectionName] = useState<string | null>(null);

    const fetchStudentSection = useCallback(async () => {
        try {
            // Fix: Use a simpler query without !inner join to avoid 406 error
            const { data: studentData, error: studentError } = await supabase
                .from('students')
                .select('section_id')
                .eq('profile_id', profile?.id)
                .eq('is_active', true)
                .single();

            console.log('[StudentDashboard] Student data query:', { studentData, studentError });

            if (studentError) {
                console.error('[StudentDashboard] Failed to fetch student section:', studentError);
                return;
            }

            if (studentData) {
                setStudentSectionId(studentData.section_id);
                // Fetch section name separately
                const { data: sectionData } = await supabase
                    .from('sections')
                    .select('name')
                    .eq('id', studentData.section_id)
                    .single();
                setStudentSectionName(sectionData?.name || null);
                console.log('[StudentDashboard] Student section set:', {
                    sectionId: studentData.section_id,
                    sectionName: sectionData?.name
                });
            } else {
                console.warn('[StudentDashboard] No student record found for profile');
            }
        } catch (err) {
            console.error('[StudentDashboard] Error fetching student section:', err);
        }
    }, [profile?.id]);

    useEffect(() => {
        if (profile) {
            fetchStudentSection();
        }
    }, [profile, fetchStudentSection]);

    // Fetch all weekly schedules for the student's section (real data for charts)
    const [weekSectionSchedules, setWeekSectionSchedules] = useState<ScheduleItem[]>([]);
    useEffect(() => {
        if (!studentSectionId) return;
        (async () => {
            const { data: rpcData } = await supabase.rpc('get_schedules_with_details');
            if (rpcData) {
                const mappedData = rpcData.map((s: any) => ({
                    id: s.id,
                    day_of_week: s.day_of_week,
                    start_time: s.start_time,
                    end_time: s.end_time,
                    status: s.status,
                    subject: { name: s.subject_name, code: s.subject_code },
                    section: { name: s.section_name, program: s.section_program },
                    teacher: { profile: { full_name: s.teacher_name } },
                    room: { name: s.room_name, building: s.room_building },
                    section_id: s.section_id,
                }));
                const mine = mappedData.filter((s: any) => s.section_id === studentSectionId);
                setWeekSectionSchedules(mine);
            }
        })();
    }, [studentSectionId]);

    // Filter schedules for student's section
    const schedules = useMemo(() => {
        if (!studentSectionId) return allSchedules;
        const filtered = allSchedules.filter((s: any) => {
            return s.section_id === studentSectionId;
        });
        console.log('[StudentDashboard DEBUG] After section filter:', {
            studentSectionId,
            beforeFilter: allSchedules.length,
            afterFilter: filtered.length,
            filtered: filtered.map(s => ({
                id: s.id,
                day_of_week: s.day_of_week,
                subject: s.subject?.name,
                section: s.section?.name,
                section_id: s.section_id,
                is_active: s.is_active
            }))
        });
        return filtered;
    }, [allSchedules, studentSectionId]);

    // Filter announcements for student's section
    const announcements = useMemo(() => {
        if (!allAnnouncements) return [];
        return allAnnouncements.filter((a: AnnouncementItem) => {
            if (a.target_section) {
                const target = a.target_section.toLowerCase().trim();
                if (target === 'all sections') return true;
                return target === (studentSectionName || '').toLowerCase().trim();
            }
            return true;
        });
    }, [allAnnouncements, studentSectionName]);

    // Current time for live progress
    const [currentTime, setCurrentTime] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    const todaySchedule = useMemo(() => {
        const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
        const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

        return schedules.map((s: ScheduleItem, i: number) => {
            const [startH, startM] = (s.start_time || '00:00').split(':').map(Number);
            const [endH, endM] = (s.end_time || '00:00').split(':').map(Number);
            const startMin = startH * 60 + startM;
            const endMin = endH * 60 + endM;

            let status: 'finished' | 'ongoing' | 'upcoming' = 'upcoming';
            let progress = 0;
            if (!isOffDay) {
                if (currentMinutes >= endMin) { status = 'finished'; progress = 100; }
                else if (currentMinutes >= startMin && currentMinutes < endMin) {
                    status = 'ongoing';
                    progress = Math.round(((currentMinutes - startMin) / (endMin - startMin)) * 100);
                }
            }

            const formatTime = (h: number, m: number) => {
                const ampm = h >= 12 ? 'PM' : 'AM';
                const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
                return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
            };

            return {
                id: s.id,
                subject: s.subject?.name || 'Unknown',
                teacher: s.teacher?.profile?.full_name || s.teacher?.full_name || 'TBA',
                room: s.room?.name || 'TBA',
                time: `${formatTime(startH, startM)} – ${formatTime(endH, endM)}`,
                status, progress, color: colors[i % colors.length]
            };
        });
    }, [schedules, currentTime, isOffDay]);

    const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
        finished: { bg: 'rgba(148,163,184,0.1)', text: '#94a3b8', label: 'Done' },
        ongoing: { bg: 'rgba(16,185,129,0.15)', text: '#10b981', label: 'Now' },
        upcoming: { bg: 'rgba(59,130,246,0.1)', text: '#60a5fa', label: 'Next' }
    };

    const ongoingClass = todaySchedule.find(s => s.status === 'ongoing');
    const nextClass = todaySchedule.find(s => s.status === 'upcoming');

    // S3: Subject distribution by total weekly hours (top 5)
    const subjectDistribution = useMemo(() => {
        const hours: Record<string, number> = {};
        weekSectionSchedules.forEach((s: any) => {
            const name = s.subject?.name || 'Other';
            const [sh, sm] = (s.start_time || '0:0').split(':').map(Number);
            const [eh, em] = (s.end_time || '0:0').split(':').map(Number);
            const dur = Math.max(0, ((eh * 60 + em) - (sh * 60 + sm)) / 60);
            hours[name] = (hours[name] || 0) + dur;
        });
        const palette = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];
        const top5 = Object.entries(hours)
            .map(([name, h]) => ({ name, value: Math.round(h * 10) / 10 }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5)
            .map((d, i) => ({ ...d, color: palette[i % palette.length] }));
        return top5;
    }, [weekSectionSchedules]);
    const subjectTotal = subjectDistribution.reduce((s, d) => s + d.value, 0);

    return (
        <div className="dashboard fade-in">
            {/* Greeting */}
            <div className="dash-greeting">
                <div>
                    <h2>{ongoingClass ? <><span className="dash-live-dot" />In Class Now</> : `Welcome back, ${profile?.full_name?.split(',')[0] || profile?.full_name?.split(' ')[0] || 'Student'}`}</h2>
                    <p>{ongoingClass ? `${ongoingClass.subject} with ${ongoingClass.teacher} in ${ongoingClass.room}` : nextClass ? `Next class: ${nextClass.subject} at ${nextClass.time.split('–')[0].trim()}` : studentSectionName ? `Section ${studentSectionName}` : 'Your daily schedule overview'}</p>
                </div>
                <span className="dash-day-badge">{isOffDay ? 'Tomorrow: Monday' : scheduleDayName}</span>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                <div className="stat-card dash-stagger">
                    <div className="stat-card-header">
                        <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.1)' }}><BookOpen size={16} color="#60a5fa" /></div>
                    </div>
                    <div className="stat-number">{loading ? '...' : todaySchedule.length}</div>
                    <div className="stat-label">Classes Today</div>
                </div>
                <div className="stat-card dash-stagger">
                    <div className="stat-card-header">
                        <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.1)' }}><Clock size={16} color="#10b981" /></div>
                    </div>
                    <div className="stat-number">{todaySchedule.filter(s => s.status === 'ongoing').length}</div>
                    <div className="stat-label">In Progress</div>
                </div>
                <div className="stat-card dash-stagger">
                    <div className="stat-card-header">
                        <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.1)' }}><Megaphone size={16} color="#f59e0b" /></div>
                    </div>
                    <div className="stat-number">{announcements.length}</div>
                    <div className="stat-label">Announcements</div>
                </div>
                <div className="stat-card dash-stagger">
                    <div className="stat-card-header">
                        <div className="stat-icon" style={{ background: 'rgba(167,139,250,0.1)' }}><Calendar size={16} color="#a78bfa" /></div>
                    </div>
                    <div className="stat-number">{upcomingEvents.length}</div>
                    <div className="stat-label">Events</div>
                </div>
            </div>

            {/* Main two-column layout */}
            <div className="dash-two-col">
                {/* Left column. Today's schedule */}
                <div className="dash-col">
                    <div>
                        <div className="dash-section-header">
                            <h3><Calendar size={15} /> Today's Schedule</h3>
                            {todaySchedule.length > 0 && <span className="dash-section-count">{todaySchedule.length}</span>}
                        </div>
                        <div className="dash-schedule-panel">
                            {loading ? (
                                <div className="dash-panel-empty"><div className="spinner" /></div>
                            ) : todaySchedule.length === 0 ? (
                                <div className="dash-panel-empty"><Calendar size={36} /><p>No classes scheduled today</p></div>
                            ) : todaySchedule.map(item => {
                                const sty = statusStyles[item.status];
                                return (
                                    <div key={item.id} className={`dash-class-card${item.status === 'ongoing' ? ' is-ongoing' : ''}`}>
                                        <div className="dash-class-stripe" style={{ background: item.color }} />
                                        <div className="dash-class-body">
                                            <div className="dash-class-top">
                                                <span className="dash-class-subject">{item.status === 'ongoing' && <span className="dash-live-dot" />}{item.subject}</span>
                                                <span className="dash-class-status" style={{ background: sty.bg, color: sty.text }}>{sty.label}</span>
                                            </div>
                                            <div className="dash-class-details">
                                                <span><Users size={13} /> {item.teacher}</span>
                                                <span><MapPin size={13} /> {item.room}</span>
                                                <span><Clock size={13} /> {item.time}</span>
                                            </div>
                                            {item.status === 'ongoing' && (
                                                <div className="dash-progress"><div className="dash-progress-fill" style={{ width: `${item.progress}%`, background: item.color }} /></div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right column. Charts, announcements, events */}
                <div className="dash-col">
                    {/* S2: Weekly load moved to siderail */}

                    {/* S3: Subject Distribution (top 5 by hours) */}
                    {subjectTotal > 0 && (
                        <div>
                            <div className="dash-section-header">
                                <h3><PieIcon size={15} /> Time per Subject</h3>
                                <span className="dash-section-count">{subjectTotal}h/wk</span>
                            </div>
                            <div className="dash-chart-card" role="img" aria-label={`Weekly hours per subject, ${subjectTotal} total hours`}>
                                <ResponsiveContainer width="100%" height={150}>
                                    <PieChart>
                                        <Pie data={subjectDistribution} cx="50%" cy="50%" innerRadius={36} outerRadius={62} paddingAngle={3} dataKey="value" stroke="none">
                                            {subjectDistribution.map((entry, i) => (
                                                <Cell key={i} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<ChartTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="dash-subject-legend">
                                    {subjectDistribution.map(s => (
                                        <div key={s.name}>
                                            <span className="dash-subject-dot" style={{ background: s.color }} />
                                            <span className="dash-subject-name">{s.name}</span>
                                            <strong>{s.value}h</strong>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Announcements */}
                    <div>
                        <div className="dash-section-header">
                            <h3><Megaphone size={15} /> Announcements</h3>
                            {announcements.length > 0 && <span className="dash-section-count">{announcements.length}</span>}
                        </div>
                        <div className="dash-schedule-panel">
                            {announcements.length === 0 ? (
                                <div className="dash-panel-empty compact"><Megaphone size={24} /><p>No announcements</p></div>
                            ) : announcements.slice(0, 5).map((ann: AnnouncementItem) => {
                                const dotColor = ann.priority === 'urgent' ? '#ef4444' : ann.priority === 'important' ? '#f59e0b' : '#22c55e';
                                return (
                                    <div key={ann.id} className="dash-ann-item">
                                        <div className="dash-ann-dot" style={{ background: dotColor }} />
                                        <div className="dash-ann-body">
                                            <div className="dash-ann-title">{ann.title}</div>
                                            <p className="dash-ann-text">{ann.content}</p>
                                            <span className="dash-ann-meta">{ann.author_name} · {ann.created_at ? new Date(ann.created_at).toLocaleDateString() : ''}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Upcoming Events */}
                    {upcomingEvents.length > 0 && (
                        <div>
                            <div className="dash-section-header">
                                <h3><Calendar size={15} /> Upcoming Events</h3>
                                <span className="dash-section-count">{upcomingEvents.length}</span>
                            </div>
                            <div className="dash-schedule-panel">
                                {upcomingEvents.slice(0, 5).map((evt: EventItem) => (
                                    <div key={evt.id} className="dash-event-item">
                                        <div className="dash-event-info">
                                            <span className="dash-event-title">{evt.title}</span>
                                            <span className="dash-event-meta">{new Date(evt.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {evt.creator_name}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StudentDashboard;
