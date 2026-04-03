import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSchedules, useAnnouncements, useScheduleChangeRequests, useSections } from '../../hooks/useSupabase';
import { useCustomEvents } from '../../hooks/useCustomEvents';
import {
    Calendar, Clock, CheckCircle, BookOpen, Users, MessageSquare,
    AlertTriangle, Plus, Send, X, Megaphone, MapPin
} from 'lucide-react';

const TeacherDashboard: React.FC = () => {
    const { profile } = useAuth();

    // Today's schedule
    const dayIndex = new Date().getDay();
    const isOffDay = dayIndex === 0;
    const scheduleDayName = isOffDay ? 'Monday' : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex];
    const { schedules: allSchedules, loading } = useSchedules({ dayOfWeek: scheduleDayName, status: 'published' });
    const { announcements: allAnnouncements } = useAnnouncements();
    const { requests, submitRequest } = useScheduleChangeRequests();
    const { sections } = useSections();
    const { events: upcomingEvents, createEvent, deleteEvent } = useCustomEvents(undefined, true);

    // Filter schedules for this teacher
    const schedules = useMemo(() => {
        if (!profile?.full_name) return allSchedules;
        return allSchedules.filter((s: any) => {
            const teacherName = s.teacher?.profile?.full_name || s.teacher?.full_name || '';
            return teacherName.toLowerCase() === profile.full_name!.toLowerCase();
        });
    }, [allSchedules, profile?.full_name]);

    // Filter announcements
    const announcements = useMemo(() => {
        if (!allAnnouncements) return [];
        const teacherSectionNames = new Set<string>();
        allSchedules.forEach((s: any) => {
            const tName = s.teacher?.profile?.full_name || s.teacher?.full_name || '';
            if (tName.toLowerCase() === (profile?.full_name || '').toLowerCase()) {
                const secName = s.section?.name;
                if (secName) teacherSectionNames.add(secName.toLowerCase().trim());
            }
        });
        return allAnnouncements.filter((a: any) => {
            if (a.target_section) {
                const target = a.target_section.toLowerCase().trim();
                if (target === 'all sections') return true;
                return teacherSectionNames.has(target);
            }
            return true;
        });
    }, [allAnnouncements, allSchedules, profile?.full_name]);

    // Schedule status
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
                section: s.section?.name || '',
                room: s.room?.name || '',
                time: `${formatTime(startH, startM)} – ${formatTime(endH, endM)}`,
                status, progress, color: colors[i % colors.length]
            };
        });
    }, [schedules, currentTime, isOffDay]);

    // Modals
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [showReportRoom, setShowReportRoom] = useState(false);
    const [showMessageAdmin, setShowMessageAdmin] = useState(false);
    const [showAnnounceModal, setShowAnnounceModal] = useState(false);
    const [showEventModal, setShowEventModal] = useState(false);

    // Request form
    const [requestReason, setRequestReason] = useState('');
    const [requestType, setRequestType] = useState<'reschedule' | 'cancel' | 'swap'>('reschedule');
    const [submitting, setSubmitting] = useState(false);

    // Report room
    const [reportRoom, setReportRoom] = useState('');
    const [reportIssue, setReportIssue] = useState('');
    const [sendingReport, setSendingReport] = useState(false);

    // Admin message
    const [adminMessage, setAdminMessage] = useState('');
    const [sendingMessage, setSendingMessage] = useState(false);

    // Announce
    const [annTitle, setAnnTitle] = useState('');
    const [annContent, setAnnContent] = useState('');
    const [annSection, setAnnSection] = useState('');
    const [sendingAnn, setSendingAnn] = useState(false);

    // Event
    const todayStr = new Date().toISOString().split('T')[0];
    const [eventTitle, setEventTitle] = useState('');
    const [eventDesc, setEventDesc] = useState('');
    const [eventDate, setEventDate] = useState(todayStr);
    const [creatingEvent, setCreatingEvent] = useState(false);

    const handleSubmitRequest = async () => {
        if (!requestReason.trim() || !profile?.id) return;
        setSubmitting(true);
        try {
            await submitRequest({
                teacher_id: profile.id,
                teacher_name: profile.full_name || 'Teacher',
                request_type: requestType,
                reason: requestReason.trim()
            });
            setShowRequestModal(false);
            setRequestReason('');
        } catch (err: any) {
            window.alert('Failed to submit: ' + err.message);
        } finally { setSubmitting(false); }
    };

    const handleReportRoom = async () => {
        if (!reportRoom.trim() || !reportIssue.trim()) return;
        setSendingReport(true);
        try {
            await supabase.from('room_issues').insert({
                room_name: reportRoom.trim(), issue_description: reportIssue.trim(),
                reported_by: profile?.id, reporter_name: profile?.full_name || 'Teacher', status: 'open'
            });
            await supabase.from('admin_messages').insert({
                sender_id: profile?.id, sender_name: profile?.full_name || 'Teacher',
                message: `Room Issue Report\n\nRoom: ${reportRoom.trim()}\nIssue: ${reportIssue.trim()}`,
                direction: 'teacher_to_admin'
            });
            setShowReportRoom(false); setReportRoom(''); setReportIssue('');
        } catch (err: any) {
            window.alert('Error: ' + err.message);
        } finally { setSendingReport(false); }
    };

    const handleSendAdminMessage = async () => {
        if (!adminMessage.trim()) return;
        setSendingMessage(true);
        try {
            await supabase.from('admin_messages').insert({
                message: adminMessage.trim(), sender_id: profile?.id,
                sender_name: profile?.full_name || 'Teacher', direction: 'teacher_to_admin'
            });
            setShowMessageAdmin(false); setAdminMessage('');
        } catch (err: any) {
            window.alert('Error: ' + err.message);
        } finally { setSendingMessage(false); }
    };

    const handleAnnounce = async () => {
        if (!annTitle.trim() || !annContent.trim() || !annSection) return;
        setSendingAnn(true);
        try {
            await supabase.from('announcements').insert({
                title: annTitle.trim(), content: annContent.trim(),
                author_id: profile?.id, author_name: profile?.full_name || 'Teacher',
                priority: 'normal', target_section: annSection
            });
            setShowAnnounceModal(false); setAnnTitle(''); setAnnContent(''); setAnnSection('');
        } catch (err: any) {
            window.alert('Error: ' + err.message);
        } finally { setSendingAnn(false); }
    };

    const handleCreateEvent = async () => {
        if (!eventTitle.trim() || !profile?.id) return;
        setCreatingEvent(true);
        try {
            await createEvent({
                title: eventTitle.trim(), description: eventDesc.trim() || undefined,
                event_date: eventDate, created_by: profile.id,
                creator_name: profile.full_name || 'Teacher', creator_role: 'teacher'
            });
            setShowEventModal(false); setEventTitle(''); setEventDesc('');
        } catch (err: any) {
            window.alert('Error: ' + err.message);
        } finally { setCreatingEvent(false); }
    };

    const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
        finished: { bg: 'rgba(148,163,184,0.1)', text: '#94a3b8', label: 'Finished' },
        ongoing: { bg: 'rgba(16,185,129,0.15)', text: '#10b981', label: 'Ongoing' },
        upcoming: { bg: 'rgba(59,130,246,0.1)', text: '#60a5fa', label: 'Upcoming' }
    };

    const myRequests = requests.filter((r: any) => r.teacher_id === profile?.id);

    return (
        <div className="teacher-dash">
            {/* Stats Row */}
            <div className="stats-row">
                <div className="stat-card glass-panel"><BookOpen size={20} color="#60a5fa" /><span className="stat-num">{loading ? '...' : todaySchedule.length}</span><span className="stat-label">Classes Today</span></div>
                <div className="stat-card glass-panel"><CheckCircle size={20} color="#10b981" /><span className="stat-num">{todaySchedule.filter(s => s.status === 'finished').length}</span><span className="stat-label">Completed</span></div>
                <div className="stat-card glass-panel"><Users size={20} color="#a78bfa" /><span className="stat-num">{schedules.length}</span><span className="stat-label">Total Entries</span></div>
                <div className="stat-card glass-panel"><Megaphone size={20} color="#f59e0b" /><span className="stat-num">{announcements.length}</span><span className="stat-label">Announcements</span></div>
            </div>

            <div className="dash-grid">
                {/* Today's Schedule */}
                <div className="dash-section">
                    <div className="section-header">
                        <h3>Today's Classes</h3>
                        <span className="badge-info">{isOffDay ? 'Monday (Tomorrow)' : scheduleDayName}</span>
                    </div>
                    <div className="schedule-list glass-panel">
                        {loading ? (
                            <div className="empty-state"><div className="spinner" /></div>
                        ) : todaySchedule.length === 0 ? (
                            <div className="empty-state"><Calendar size={40} className="empty-icon" /><p>No classes today</p></div>
                        ) : todaySchedule.map(item => {
                            const sty = statusStyles[item.status];
                            return (
                                <div key={item.id} className="class-card" onClick={() => { setShowRequestModal(true); }}>
                                    <div className="class-stripe" style={{ background: item.color }} />
                                    <div className="class-body">
                                        <div className="class-top">
                                            <h4>{item.subject}</h4>
                                            <span className="status-badge" style={{ background: sty.bg, color: sty.text }}>{sty.label}</span>
                                        </div>
                                        <div className="class-details">
                                            <span><MapPin size={14} /> {item.room}</span>
                                            <span><Clock size={14} /> {item.time}</span>
                                            <span><Users size={14} /> {item.section}</span>
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

                {/* Right Column */}
                <div className="dash-right">
                    {/* Quick Actions */}
                    <div className="section-header"><h3>Quick Actions</h3></div>
                    <div className="quick-actions">
                        <button className="action-btn glass-panel" onClick={() => setShowMessageAdmin(true)}>
                            <div className="action-icon" style={{ background: 'rgba(99,102,241,0.12)' }}><MessageSquare size={18} color="#818cf8" /></div>
                            <span>Message Admin</span>
                        </button>
                        <button className="action-btn glass-panel" onClick={() => setShowReportRoom(true)}>
                            <div className="action-icon" style={{ background: 'rgba(245,158,11,0.12)' }}><AlertTriangle size={18} color="#f59e0b" /></div>
                            <span>Report Issue</span>
                        </button>
                        <button className="action-btn glass-panel" onClick={() => setShowAnnounceModal(true)}>
                            <div className="action-icon" style={{ background: 'rgba(59,130,246,0.12)' }}><Megaphone size={18} color="#60a5fa" /></div>
                            <span>Announce</span>
                        </button>
                        <button className="action-btn glass-panel" onClick={() => setShowEventModal(true)}>
                            <div className="action-icon" style={{ background: 'rgba(16,185,129,0.12)' }}><Plus size={18} color="#34d399" /></div>
                            <span>Create Event</span>
                        </button>
                    </div>

                    {/* Upcoming Events */}
                    {upcomingEvents.length > 0 && (
                        <>
                            <div className="section-header" style={{ marginTop: '1.5rem' }}><h3>Upcoming Events</h3></div>
                            <div className="events-list glass-panel">
                                {upcomingEvents.slice(0, 3).map((evt: any) => (
                                    <div key={evt.id} className="event-item">
                                        <div className="event-info">
                                            <strong>{evt.title}</strong>
                                            <span className="text-sm text-muted">{new Date(evt.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                        </div>
                                        {evt.created_by === profile?.id && (
                                            <button className="btn-icon-sm" onClick={() => deleteEvent(evt.id)}><X size={14} /></button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Recent Announcements */}
                    <div className="section-header" style={{ marginTop: '1.5rem' }}><h3>Recent Announcements</h3></div>
                    <div className="announcements-list glass-panel">
                        {announcements.length === 0 ? (
                            <div className="empty-state sm"><Megaphone size={24} className="empty-icon" /><p>No announcements</p></div>
                        ) : announcements.slice(0, 3).map((ann: any) => {
                            const dotColor = ann.priority === 'urgent' ? '#ef4444' : ann.priority === 'important' ? '#f59e0b' : '#22c55e';
                            return (
                                <div key={ann.id} className="ann-item">
                                    <div className="ann-dot" style={{ background: dotColor }} />
                                    <div className="ann-content">
                                        <strong>{ann.title}</strong>
                                        <p>{ann.content}</p>
                                        <span className="text-xs text-muted">{ann.created_at ? new Date(ann.created_at).toLocaleDateString() : ''}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* My Requests */}
                    {myRequests.length > 0 && (
                        <>
                            <div className="section-header" style={{ marginTop: '1.5rem' }}><h3>My Requests</h3></div>
                            <div className="requests-list glass-panel">
                                {myRequests.slice(0, 3).map((req: any) => {
                                    const sc: Record<string, { bg: string; text: string; label: string }> = {
                                        pending: { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', label: 'PENDING' },
                                        approved: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e', label: 'APPROVED' },
                                        rejected: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', label: 'REJECTED' },
                                    };
                                    const s = sc[req.status] || sc.pending;
                                    return (
                                        <div key={req.id} className="req-item">
                                            <div className="req-top">
                                                <span className="req-type">{req.request_type}</span>
                                                <span className="req-badge" style={{ background: s.bg, color: s.text }}>{s.label}</span>
                                            </div>
                                            <p className="req-reason">{req.reason}</p>
                                            {req.admin_notes && <p className="req-notes">Admin: {req.admin_notes}</p>}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ---- MODALS ---- */}
            {/* Schedule Change Request */}
            {showRequestModal && (
                <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
                    <div className="modal-box glass-panel" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>Request Schedule Change</h3><button onClick={() => setShowRequestModal(false)}><X size={20} /></button></div>
                        <div className="modal-body">
                            <label>Request Type</label>
                            <div className="btn-group">
                                {(['reschedule', 'cancel', 'swap'] as const).map(t => (
                                    <button key={t} className={`btn-tab ${requestType === t ? 'active' : ''}`} onClick={() => setRequestType(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
                                ))}
                            </div>
                            <label>Reason</label>
                            <textarea value={requestReason} onChange={e => setRequestReason(e.target.value)} placeholder="Explain why you need this change..." rows={3} />
                            <button className="btn-primary full" onClick={handleSubmitRequest} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit to Admin'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Report Room Issue */}
            {showReportRoom && (
                <div className="modal-overlay" onClick={() => setShowReportRoom(false)}>
                    <div className="modal-box glass-panel" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>Report Room Issue</h3><button onClick={() => setShowReportRoom(false)}><X size={20} /></button></div>
                        <div className="modal-body">
                            <label>Room Name</label>
                            <input value={reportRoom} onChange={e => setReportRoom(e.target.value)} placeholder="e.g. Lab 204, Room 305" />
                            <label>Issue Description</label>
                            <textarea value={reportIssue} onChange={e => setReportIssue(e.target.value)} placeholder="Describe the issue..." rows={3} />
                            <button className="btn-warning full" onClick={handleReportRoom} disabled={sendingReport}>{sendingReport ? 'Submitting...' : 'Submit Report'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Message Admin */}
            {showMessageAdmin && (
                <div className="modal-overlay" onClick={() => setShowMessageAdmin(false)}>
                    <div className="modal-box glass-panel" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>Message Admin</h3><button onClick={() => setShowMessageAdmin(false)}><X size={20} /></button></div>
                        <div className="modal-body">
                            <label>Your Message</label>
                            <textarea value={adminMessage} onChange={e => setAdminMessage(e.target.value)} placeholder="Type your message..." rows={4} />
                            <button className="btn-success full" onClick={handleSendAdminMessage} disabled={sendingMessage}><Send size={16} /> {sendingMessage ? 'Sending...' : 'Send Message'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Announce to Section */}
            {showAnnounceModal && (
                <div className="modal-overlay" onClick={() => setShowAnnounceModal(false)}>
                    <div className="modal-box glass-panel" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>Announce to Section</h3><button onClick={() => setShowAnnounceModal(false)}><X size={20} /></button></div>
                        <div className="modal-body">
                            <label>Select Section</label>
                            <div className="chip-group">
                                {sections.map((sec: any) => (
                                    <button key={sec.id} className={`chip ${annSection === sec.name ? 'active' : ''}`} onClick={() => setAnnSection(sec.name)}>{sec.name}</button>
                                ))}
                            </div>
                            <label>Title</label>
                            <input value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="e.g. Class Cancelled" />
                            <label>Message</label>
                            <textarea value={annContent} onChange={e => setAnnContent(e.target.value)} placeholder="Write your announcement..." rows={3} />
                            <button className="btn-primary full" onClick={handleAnnounce} disabled={sendingAnn}>{sendingAnn ? 'Posting...' : 'Post Announcement'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Event */}
            {showEventModal && (
                <div className="modal-overlay" onClick={() => setShowEventModal(false)}>
                    <div className="modal-box glass-panel" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>Create Event</h3><button onClick={() => setShowEventModal(false)}><X size={20} /></button></div>
                        <div className="modal-body">
                            <label>Event Title</label>
                            <input value={eventTitle} onChange={e => setEventTitle(e.target.value)} placeholder="e.g. Review Session" />
                            <label>Date</label>
                            <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
                            <label>Description (Optional)</label>
                            <textarea value={eventDesc} onChange={e => setEventDesc(e.target.value)} placeholder="Add details..." rows={2} />
                            <button className="btn-success full" onClick={handleCreateEvent} disabled={creatingEvent}>{creatingEvent ? 'Creating...' : 'Create Event'}</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .teacher-dash { display: flex; flex-direction: column; gap: 1.5rem; }

                .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
                .stat-card { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 1.25rem; text-align: center; }
                .stat-num { font-size: 1.75rem; font-weight: 700; color: white; }
                .stat-label { font-size: 0.8rem; color: var(--text-muted); }

                .dash-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 1.5rem; }
                .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
                .section-header h3 { font-size: 1.1rem; font-weight: 600; }
                .badge-info { background: rgba(59,130,246,0.15); color: #60a5fa; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 500; }

                .schedule-list { padding: 0; overflow: hidden; }
                .class-card { display: flex; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; transition: background 0.2s; }
                .class-card:hover { background: rgba(255,255,255,0.02); }
                .class-card:last-child { border-bottom: none; }
                .class-stripe { width: 4px; flex-shrink: 0; }
                .class-body { flex: 1; padding: 1rem 1.25rem; }
                .class-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
                .class-top h4 { font-size: 1rem; font-weight: 600; }
                .status-badge { padding: 3px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 600; }
                .class-details { display: flex; gap: 1rem; font-size: 0.85rem; color: var(--text-secondary); }
                .class-details span { display: flex; align-items: center; gap: 4px; }
                .progress-bar { height: 3px; background: rgba(255,255,255,0.06); border-radius: 3px; margin-top: 0.75rem; overflow: hidden; }
                .progress-fill { height: 100%; border-radius: 3px; transition: width 0.5s; }

                .quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
                .action-btn { display: flex; align-items: center; gap: 0.75rem; padding: 1rem; border: none; background: transparent; cursor: pointer; transition: all 0.2s; text-align: left; width: 100%; color: var(--text-primary); font-size: 0.85rem; font-weight: 500; }
                .action-btn:hover { transform: translateY(-1px); }
                .action-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

                .events-list, .announcements-list, .requests-list { padding: 0; overflow: hidden; }
                .event-item { display: flex; justify-content: space-between; align-items: center; padding: 0.875rem 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.04); }
                .event-item:last-child { border-bottom: none; }
                .event-info { display: flex; flex-direction: column; gap: 2px; }
                .event-info strong { font-size: 0.9rem; }

                .ann-item { display: flex; gap: 0.75rem; padding: 0.875rem 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.04); }
                .ann-item:last-child { border-bottom: none; }
                .ann-dot { width: 4px; border-radius: 2px; flex-shrink: 0; }
                .ann-content { flex: 1; }
                .ann-content strong { font-size: 0.9rem; display: block; margin-bottom: 2px; }
                .ann-content p { font-size: 0.8rem; color: var(--text-secondary); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

                .req-item { padding: 0.875rem 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.04); }
                .req-item:last-child { border-bottom: none; }
                .req-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem; }
                .req-type { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); letter-spacing: 1px; }
                .req-badge { padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; }
                .req-reason { font-size: 0.85rem; color: var(--text-secondary); margin: 4px 0 0; }
                .req-notes { font-size: 0.8rem; color: #60a5fa; font-style: italic; margin: 4px 0 0; }

                .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; color: var(--text-muted); gap: 0.5rem; }
                .empty-state.sm { padding: 1.5rem; }
                .empty-icon { opacity: 0.3; }

                .text-sm { font-size: 0.8rem; }
                .text-xs { font-size: 0.7rem; }
                .text-muted { color: var(--text-muted); }

                .btn-icon-sm { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 4px; }
                .btn-icon-sm:hover { color: #ef4444; background: rgba(239,68,68,0.1); }

                /* Modals */
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
                .modal-box { width: 100%; max-width: 480px; padding: 0; overflow: hidden; background: #0f172a; border: 1px solid var(--border-light); border-radius: 16px; }
                .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-light); }
                .modal-header h3 { font-size: 1.1rem; font-weight: 600; }
                .modal-header button { background: none; border: none; color: var(--text-muted); cursor: pointer; }
                .modal-body { padding: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
                .modal-body label { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase; }
                .modal-body input, .modal-body textarea { width: 100%; padding: 0.75rem 1rem; background: rgba(15,23,42,0.8); border: 1px solid var(--border-light); border-radius: 10px; color: white; font-size: 0.9rem; resize: vertical; }
                .modal-body input:focus, .modal-body textarea:focus { outline: none; border-color: var(--brand-primary); }

                .btn-group { display: flex; gap: 0.5rem; }
                .btn-tab { flex: 1; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border-light); background: transparent; color: var(--text-secondary); font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
                .btn-tab.active { background: rgba(59,130,246,0.1); border-color: var(--brand-primary); color: var(--brand-primary); }

                .chip-group { display: flex; flex-wrap: wrap; gap: 0.5rem; }
                .chip { padding: 0.4rem 1rem; border-radius: 20px; border: 1px solid var(--border-light); background: transparent; color: var(--text-secondary); font-size: 0.8rem; cursor: pointer; transition: all 0.2s; }
                .chip.active { background: #6366f1; border-color: #6366f1; color: white; }

                .btn-primary { background: var(--brand-primary); color: white; padding: 0.75rem 1.5rem; border-radius: 10px; font-weight: 500; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s; }
                .btn-primary:hover { opacity: 0.9; }
                .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
                .btn-warning { background: #f59e0b; color: white; padding: 0.75rem 1.5rem; border-radius: 10px; font-weight: 500; border: none; cursor: pointer; transition: all 0.2s; }
                .btn-success { background: #10b981; color: white; padding: 0.75rem 1.5rem; border-radius: 10px; font-weight: 500; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: all 0.2s; }
                .full { width: 100%; margin-top: 0.5rem; }

                @media (max-width: 1024px) {
                    .stats-row { grid-template-columns: repeat(2, 1fr); }
                    .dash-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default TeacherDashboard;
