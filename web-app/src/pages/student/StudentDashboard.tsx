import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSchedules, useAnnouncements } from '../../hooks/useSupabase';
import { useCustomEvents } from '../../hooks/useCustomEvents';
import { Calendar, Clock, BookOpen, Megaphone, MapPin, Users } from 'lucide-react';

const StudentDashboard: React.FC = () => {
    const { profile } = useAuth();

    const dayIndex = new Date().getDay();
    const isOffDay = dayIndex === 0;
    const scheduleDayName = isOffDay ? 'Monday' : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex];
    const { schedules: allSchedules, loading } = useSchedules({ dayOfWeek: scheduleDayName, status: 'published' });
    const { announcements: allAnnouncements } = useAnnouncements();
    const { events: upcomingEvents } = useCustomEvents(undefined, true);

    // Filter schedules for student's section
    const schedules = useMemo(() => {
        if (!profile?.section) return allSchedules;
        return allSchedules.filter((s: any) => {
            const secName = s.section?.name || '';
            return secName.toLowerCase() === (profile.section ?? '').toLowerCase();
        });
    }, [allSchedules, profile?.section]);

    // Filter announcements for student's section
    const announcements = useMemo(() => {
        if (!allAnnouncements) return [];
        return allAnnouncements.filter((a: any) => {
            if (a.target_section) {
                const target = a.target_section.toLowerCase().trim();
                if (target === 'all sections') return true;
                return target === (profile?.section || '').toLowerCase().trim();
            }
            return true;
        });
    }, [allAnnouncements, profile?.section]);

    // Current time for live progress
    const [currentTime, setCurrentTime] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    const todaySchedule = useMemo(() => {
        const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
        const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

        return schedules.map((s: any, i: number) => {
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

    return (
        <div className="student-dash">
            {/* Greeting */}
            <div className="greeting-row">
                <div>
                    <h2>Welcome back, {profile?.full_name?.split(',')[0] || profile?.full_name?.split(' ')[0] || 'Student'}</h2>
                    <p className="text-muted">{profile?.section ? `Section ${profile.section}` : 'Your daily schedule overview'}</p>
                </div>
                <span className="day-badge">{isOffDay ? 'Tomorrow: Monday' : scheduleDayName}</span>
            </div>

            {/* Stats */}
            <div className="stats-row">
                <div className="stat-card glass-panel"><BookOpen size={20} color="#60a5fa" /><span className="stat-num">{loading ? '...' : todaySchedule.length}</span><span className="stat-label">Classes Today</span></div>
                <div className="stat-card glass-panel"><Clock size={20} color="#10b981" /><span className="stat-num">{todaySchedule.filter(s => s.status === 'ongoing').length}</span><span className="stat-label">In Progress</span></div>
                <div className="stat-card glass-panel"><Megaphone size={20} color="#f59e0b" /><span className="stat-num">{announcements.length}</span><span className="stat-label">Announcements</span></div>
                <div className="stat-card glass-panel"><Calendar size={20} color="#a78bfa" /><span className="stat-num">{upcomingEvents.length}</span><span className="stat-label">Events</span></div>
            </div>

            <div className="dash-grid">
                {/* Schedule */}
                <div className="dash-section">
                    <h3 className="section-title">Today's Schedule</h3>
                    <div className="schedule-list glass-panel">
                        {loading ? (
                            <div className="empty-state"><div className="spinner" /></div>
                        ) : todaySchedule.length === 0 ? (
                            <div className="empty-state"><Calendar size={40} className="empty-icon" /><p>No classes scheduled today</p></div>
                        ) : todaySchedule.map(item => {
                            const sty = statusStyles[item.status];
                            return (
                                <div key={item.id} className="class-card">
                                    <div className="class-stripe" style={{ background: item.color }} />
                                    <div className="class-body">
                                        <div className="class-top">
                                            <h4>{item.subject}</h4>
                                            <span className="status-badge" style={{ background: sty.bg, color: sty.text }}>{sty.label}</span>
                                        </div>
                                        <div className="class-details">
                                            <span><Users size={14} /> {item.teacher}</span>
                                            <span><MapPin size={14} /> {item.room}</span>
                                            <span><Clock size={14} /> {item.time}</span>
                                        </div>
                                        {item.status === 'ongoing' && (
                                            <div className="progress-bar"><div className="progress-fill" style={{ width: `${item.progress}%`, background: item.color }} /></div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right column */}
                <div className="dash-right">
                    {/* Announcements */}
                    <h3 className="section-title">Announcements</h3>
                    <div className="ann-list glass-panel">
                        {announcements.length === 0 ? (
                            <div className="empty-state sm"><Megaphone size={24} className="empty-icon" /><p>No announcements</p></div>
                        ) : announcements.slice(0, 5).map((ann: any) => {
                            const dotColor = ann.priority === 'urgent' ? '#ef4444' : ann.priority === 'important' ? '#f59e0b' : '#22c55e';
                            return (
                                <div key={ann.id} className="ann-item">
                                    <div className="ann-dot" style={{ background: dotColor }} />
                                    <div className="ann-content">
                                        <strong>{ann.title}</strong>
                                        <p>{ann.content}</p>
                                        <span className="text-xs text-muted">{ann.author_name} • {ann.created_at ? new Date(ann.created_at).toLocaleDateString() : ''}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Events */}
                    {upcomingEvents.length > 0 && (
                        <>
                            <h3 className="section-title" style={{ marginTop: '1.5rem' }}>Upcoming Events</h3>
                            <div className="events-list glass-panel">
                                {upcomingEvents.slice(0, 5).map((evt: any) => (
                                    <div key={evt.id} className="event-item">
                                        <div className="event-info">
                                            <strong>{evt.title}</strong>
                                            <span className="text-sm text-muted">{new Date(evt.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {evt.creator_name}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <style>{`
                .student-dash { display: flex; flex-direction: column; gap: 1.5rem; }
                .greeting-row { display: flex; justify-content: space-between; align-items: flex-end; }
                .greeting-row h2 { font-size: 1.5rem; }
                .day-badge { background: rgba(139,92,246,0.15); color: #a78bfa; padding: 6px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 500; }

                .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
                .stat-card { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 1.25rem; text-align: center; }
                .stat-num { font-size: 1.75rem; font-weight: 700; color: var(--text-primary); }
                .stat-label { font-size: 0.8rem; color: var(--text-muted); }

                .dash-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 1.5rem; }
                .section-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.75rem; }

                .schedule-list { padding: 0; overflow: hidden; }
                .class-card { display: flex; border-bottom: 1px solid var(--border-default); }
                .class-card:last-child { border-bottom: none; }
                .class-stripe { width: 4px; flex-shrink: 0; }
                .class-body { flex: 1; padding: 1rem 1.25rem; }
                .class-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
                .class-top h4 { font-size: 1rem; font-weight: 600; }
                .status-badge { padding: 3px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 600; }
                .class-details { display: flex; gap: 1rem; font-size: 0.85rem; color: var(--text-secondary); flex-wrap: wrap; }
                .class-details span { display: flex; align-items: center; gap: 4px; }
                .progress-bar { height: 3px; background: var(--bg-elevated); border-radius: 3px; margin-top: 0.75rem; overflow: hidden; }
                .progress-fill { height: 100%; border-radius: 3px; transition: width 0.5s; }

                .ann-list, .events-list { padding: 0; overflow: hidden; }
                .ann-item { display: flex; gap: 0.75rem; padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--border-default); }
                .ann-item:last-child { border-bottom: none; }
                .ann-dot { width: 4px; border-radius: 2px; flex-shrink: 0; }
                .ann-content { flex: 1; }
                .ann-content strong { font-size: 0.9rem; display: block; margin-bottom: 2px; }
                .ann-content p { font-size: 0.8rem; color: var(--text-secondary); margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

                .event-item { padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--border-default); }
                .event-item:last-child { border-bottom: none; }
                .event-info { display: flex; flex-direction: column; gap: 2px; }
                .event-info strong { font-size: 0.9rem; }

                .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; color: var(--text-muted); gap: 0.5rem; }
                .empty-state.sm { padding: 1.5rem; }
                .empty-icon { opacity: 0.3; }
                .text-sm { font-size: 0.8rem; }
                .text-xs { font-size: 0.7rem; }
                .text-muted { color: var(--text-muted); }

                @media (max-width: 1024px) {
                    .stats-row { grid-template-columns: repeat(2, 1fr); }
                    .dash-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default StudentDashboard;
