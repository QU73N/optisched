import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSchedules, useAnnouncements, useScheduleChangeRequests, useSections } from '../../hooks/useSupabase';
import { useCustomEvents } from '../../hooks/useCustomEvents';
import {
    Calendar, Clock, CheckCircle, BookOpen, Users, MessageSquare,
    AlertTriangle, Plus, Send, X, Megaphone, MapPin, ArrowRightLeft, FileText
} from 'lucide-react';
import '../admin/Dashboard.css';

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

    // Admins for messaging
    const [allAdmins, setAllAdmins] = useState<any[]>([]);
    useEffect(() => {
        const fetchAdmins = async () => {
            const { data } = await supabase.from('profiles').select('id, full_name, role').in('role', ['admin', 'power_admin', 'schedule_manager', 'schedule_admin']);
            if (data && data.length > 0) {
                setAllAdmins(data);
                setSelectedAdminId(data[0].id); // Default to specific admin
            }
        };
        fetchAdmins();
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

    const [adminMessage, setAdminMessage] = useState('');
    const [selectedAdminId, setSelectedAdminId] = useState('');
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
        if (!requestReason.trim() || !profile?.id || !selectedAdminId) return;
        setSubmitting(true);
        try {
            await submitRequest({
                teacher_id: profile.id,
                teacher_name: profile.full_name || 'Teacher',
                request_type: requestType,
                reason: requestReason.trim()
            });

            // Auto-send a message to the specifically selected admin so they can converse about it
            await supabase.from('admin_messages').insert({
                message: `Schedule Change Request Submitted: ${requestType.toUpperCase()}\n\nReason: ${requestReason.trim()}`,
                sender_id: profile.id,
                sender_name: profile.full_name || 'Teacher',
                direction: 'teacher_to_admin',
                recipient_id: selectedAdminId
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
        if (!adminMessage.trim() || !selectedAdminId) return;
        setSendingMessage(true);
        try {
            await supabase.from('admin_messages').insert({
                message: adminMessage.trim(), sender_id: profile?.id,
                sender_name: profile?.full_name || 'Teacher', direction: 'teacher_to_admin',
                recipient_id: selectedAdminId
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

    const ongoingClass = todaySchedule.find(s => s.status === 'ongoing');
    const nextClass = todaySchedule.find(s => s.status === 'upcoming');

    return (
        <div className="dashboard fade-in">
            {/* Greeting */}
            <div className="dash-greeting">
                <div>
                    <h2>{ongoingClass ? <><span className="dash-live-dot" />Teaching Now</> : `Welcome back, ${profile?.full_name?.split(',')[0] || profile?.full_name?.split(' ')[0] || 'Teacher'}`}</h2>
                    <p>{ongoingClass ? `${ongoingClass.subject} — ${ongoingClass.section} in ${ongoingClass.room}` : nextClass ? `Next: ${nextClass.subject} at ${nextClass.time.split('–')[0].trim()}` : isOffDay ? 'Enjoy your day off' : 'No more classes today'}</p>
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
                        <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.1)' }}><CheckCircle size={16} color="#10b981" /></div>
                    </div>
                    <div className="stat-number">{todaySchedule.filter(s => s.status === 'finished').length}</div>
                    <div className="stat-label">Completed</div>
                </div>
                <div className="stat-card dash-stagger">
                    <div className="stat-card-header">
                        <div className="stat-icon" style={{ background: 'rgba(167,139,250,0.1)' }}><Users size={16} color="#a78bfa" /></div>
                    </div>
                    <div className="stat-number">{schedules.length}</div>
                    <div className="stat-label">Total Entries</div>
                </div>
                <div className="stat-card dash-stagger">
                    <div className="stat-card-header">
                        <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.1)' }}><Megaphone size={16} color="#f59e0b" /></div>
                    </div>
                    <div className="stat-number">{announcements.length}</div>
                    <div className="stat-label">Announcements</div>
                </div>
            </div>

            {/* Main two-column layout */}
            <div className="dash-two-col">
                {/* Left — Today's Schedule */}
                <div className="dash-col">
                    <div>
                        <div className="dash-section-header">
                            <h3><Calendar size={15} /> Today's Classes</h3>
                            {todaySchedule.length > 0 && <span className="dash-section-count">{todaySchedule.length}</span>}
                        </div>
                        <div className="dash-schedule-panel">
                            {loading ? (
                                <div className="dash-panel-empty"><div className="spinner" /></div>
                            ) : todaySchedule.length === 0 ? (
                                <div className="dash-panel-empty"><Calendar size={36} /><p>No classes scheduled</p></div>
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
                                                <span><MapPin size={13} /> {item.room}</span>
                                                <span><Clock size={13} /> {item.time}</span>
                                                <span><Users size={13} /> {item.section}</span>
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

                    {/* My Requests */}
                    <div>
                        <div className="dash-section-header">
                            <h3><FileText size={15} /> My Requests</h3>
                            {myRequests.length > 0 && <span className="dash-section-count">{myRequests.length}</span>}
                        </div>
                        <div className="dash-schedule-panel">
                            {myRequests.length === 0 ? (
                                <div className="dash-panel-empty compact"><FileText size={24} /><p>No requests yet</p></div>
                            ) : myRequests.slice(0, 5).map((req: any) => {
                                const sc: Record<string, { bg: string; text: string; label: string }> = {
                                    pending: { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', label: 'PENDING' },
                                    approved: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e', label: 'APPROVED' },
                                    rejected: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', label: 'REJECTED' },
                                };
                                const s = sc[req.status] || sc.pending;
                                return (
                                    <div key={req.id} className="dash-req-item">
                                        <div className="dash-req-top">
                                            <span className="dash-req-type">{req.request_type}</span>
                                            <span className="dash-req-badge" style={{ background: s.bg, color: s.text }}>{s.label}</span>
                                        </div>
                                        <p className="dash-req-reason">{req.reason}</p>
                                        {req.admin_notes && <p className="dash-req-notes">Admin: {req.admin_notes}</p>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right — Actions, Events, Announcements */}
                <div className="dash-col">
                    {/* Quick Actions */}
                    <div>
                        <div className="dash-section-header"><h3>Quick Actions</h3></div>
                        <div className="dash-quick-actions">
                            <button className="dash-action-btn" onClick={() => setShowRequestModal(true)}>
                                <div className="dash-action-icon" style={{ background: 'rgba(59,130,246,0.1)' }}><ArrowRightLeft size={16} color="#60a5fa" /></div>
                                Request Change
                            </button>
                            <button className="dash-action-btn" onClick={() => setShowMessageAdmin(true)}>
                                <div className="dash-action-icon" style={{ background: 'rgba(99,102,241,0.1)' }}><MessageSquare size={16} color="#818cf8" /></div>
                                Message Admin
                            </button>
                            <button className="dash-action-btn" onClick={() => setShowReportRoom(true)}>
                                <div className="dash-action-icon" style={{ background: 'rgba(245,158,11,0.1)' }}><AlertTriangle size={16} color="#f59e0b" /></div>
                                Report Issue
                            </button>
                            <button className="dash-action-btn" onClick={() => setShowAnnounceModal(true)}>
                                <div className="dash-action-icon" style={{ background: 'rgba(59,130,246,0.1)' }}><Megaphone size={16} color="#60a5fa" /></div>
                                Announce
                            </button>
                            <button className="dash-action-btn" onClick={() => setShowEventModal(true)}>
                                <div className="dash-action-icon" style={{ background: 'rgba(16,185,129,0.1)' }}><Plus size={16} color="#34d399" /></div>
                                Create Event
                            </button>
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
                                {upcomingEvents.slice(0, 4).map((evt: any) => (
                                    <div key={evt.id} className="dash-event-item">
                                        <div className="dash-event-info">
                                            <span className="dash-event-title">{evt.title}</span>
                                            <span className="dash-event-meta">{new Date(evt.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                        </div>
                                        {evt.created_by === profile?.id && (
                                            <button className="dash-icon-btn dash-icon-btn-danger" onClick={() => deleteEvent(evt.id)}><X size={14} /></button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Announcements */}
                    <div>
                        <div className="dash-section-header">
                            <h3><Megaphone size={15} /> Recent Announcements</h3>
                        </div>
                        <div className="dash-schedule-panel">
                            {announcements.length === 0 ? (
                                <div className="dash-panel-empty compact"><Megaphone size={24} /><p>No announcements</p></div>
                            ) : announcements.slice(0, 4).map((ann: any) => {
                                const dotColor = ann.priority === 'urgent' ? '#ef4444' : ann.priority === 'important' ? '#f59e0b' : '#22c55e';
                                return (
                                    <div key={ann.id} className="dash-ann-item">
                                        <div className="dash-ann-dot" style={{ background: dotColor }} />
                                        <div className="dash-ann-body">
                                            <div className="dash-ann-title">{ann.title}</div>
                                            <p className="dash-ann-text">{ann.content}</p>
                                            <span className="dash-ann-meta">{ann.created_at ? new Date(ann.created_at).toLocaleDateString() : ''}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* ---- MODALS ---- */}
            {showRequestModal && (
                <div className="modal-overlay" onClick={() => setShowRequestModal(false)}>
                    <div className="dash-modal-box" onClick={e => e.stopPropagation()}>
                        <div className="dash-modal-header">
                            <h3>Request Schedule Change</h3>
                            <button className="dash-modal-close" onClick={() => setShowRequestModal(false)}><X size={18} /></button>
                        </div>
                        <div className="dash-modal-body">
                            <label>Send Request To</label>
                            <select value={selectedAdminId} onChange={e => setSelectedAdminId(e.target.value)}>
                                {allAdmins.map(adm => (
                                    <option key={adm.id} value={adm.id}>{adm.full_name || 'Admin'} – {adm.role.replace('_', ' ').toUpperCase()}</option>
                                ))}
                            </select>
                            <label>Request Type</label>
                            <div className="dash-btn-group">
                                {(['reschedule', 'cancel', 'swap'] as const).map(t => (
                                    <button key={t} className={`dash-btn-tab ${requestType === t ? 'active' : ''}`} onClick={() => setRequestType(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
                                ))}
                            </div>
                            <label>Reason</label>
                            <textarea value={requestReason} onChange={e => setRequestReason(e.target.value)} placeholder="Explain why you need this change..." rows={3} />
                            <button className="dash-modal-btn dash-modal-btn-primary" onClick={handleSubmitRequest} disabled={submitting || !selectedAdminId}>{submitting ? 'Submitting...' : 'Submit to Admin'}</button>
                        </div>
                    </div>
                </div>
            )}

            {showReportRoom && (
                <div className="modal-overlay" onClick={() => setShowReportRoom(false)}>
                    <div className="dash-modal-box" onClick={e => e.stopPropagation()}>
                        <div className="dash-modal-header">
                            <h3>Report Room Issue</h3>
                            <button className="dash-modal-close" onClick={() => setShowReportRoom(false)}><X size={18} /></button>
                        </div>
                        <div className="dash-modal-body">
                            <label>Room Name</label>
                            <input value={reportRoom} onChange={e => setReportRoom(e.target.value)} placeholder="e.g. Lab 204, Room 305" />
                            <label>Issue Description</label>
                            <textarea value={reportIssue} onChange={e => setReportIssue(e.target.value)} placeholder="Describe the issue..." rows={3} />
                            <button className="dash-modal-btn dash-modal-btn-warning" onClick={handleReportRoom} disabled={sendingReport}>{sendingReport ? 'Submitting...' : 'Submit Report'}</button>
                        </div>
                    </div>
                </div>
            )}

            {showMessageAdmin && (
                <div className="modal-overlay" onClick={() => setShowMessageAdmin(false)}>
                    <div className="dash-modal-box" onClick={e => e.stopPropagation()}>
                        <div className="dash-modal-header">
                            <h3>Message Admin</h3>
                            <button className="dash-modal-close" onClick={() => setShowMessageAdmin(false)}><X size={18} /></button>
                        </div>
                        <div className="dash-modal-body">
                            <label>Select Admin</label>
                            <select value={selectedAdminId} onChange={e => setSelectedAdminId(e.target.value)}>
                                {allAdmins.map(adm => (
                                    <option key={adm.id} value={adm.id}>{adm.full_name || 'Admin'} – {adm.role.replace('_', ' ').toUpperCase()}</option>
                                ))}
                            </select>
                            <label>Your Message</label>
                            <textarea value={adminMessage} onChange={e => setAdminMessage(e.target.value)} placeholder="Type your message..." rows={4} />
                            <button className="dash-modal-btn dash-modal-btn-success" onClick={handleSendAdminMessage} disabled={sendingMessage}><Send size={15} /> {sendingMessage ? 'Sending...' : 'Send Message'}</button>
                        </div>
                    </div>
                </div>
            )}

            {showAnnounceModal && (
                <div className="modal-overlay" onClick={() => setShowAnnounceModal(false)}>
                    <div className="dash-modal-box" onClick={e => e.stopPropagation()}>
                        <div className="dash-modal-header">
                            <h3>Announce to Section</h3>
                            <button className="dash-modal-close" onClick={() => setShowAnnounceModal(false)}><X size={18} /></button>
                        </div>
                        <div className="dash-modal-body">
                            <label>Select Section</label>
                            <div className="dash-chip-group">
                                {sections.map((sec: any) => (
                                    <button key={sec.id} className={`dash-chip ${annSection === sec.name ? 'active' : ''}`} onClick={() => setAnnSection(sec.name)}>{sec.name}</button>
                                ))}
                            </div>
                            <label>Title</label>
                            <input value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="e.g. Class Cancelled" />
                            <label>Message</label>
                            <textarea value={annContent} onChange={e => setAnnContent(e.target.value)} placeholder="Write your announcement..." rows={3} />
                            <button className="dash-modal-btn dash-modal-btn-primary" onClick={handleAnnounce} disabled={sendingAnn}>{sendingAnn ? 'Posting...' : 'Post Announcement'}</button>
                        </div>
                    </div>
                </div>
            )}

            {showEventModal && (
                <div className="modal-overlay" onClick={() => setShowEventModal(false)}>
                    <div className="dash-modal-box" onClick={e => e.stopPropagation()}>
                        <div className="dash-modal-header">
                            <h3>Create Event</h3>
                            <button className="dash-modal-close" onClick={() => setShowEventModal(false)}><X size={18} /></button>
                        </div>
                        <div className="dash-modal-body">
                            <label>Event Title</label>
                            <input value={eventTitle} onChange={e => setEventTitle(e.target.value)} placeholder="e.g. Review Session" />
                            <label>Date</label>
                            <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
                            <label>Description (Optional)</label>
                            <textarea value={eventDesc} onChange={e => setEventDesc(e.target.value)} placeholder="Add details..." rows={2} />
                            <button className="dash-modal-btn dash-modal-btn-success" onClick={handleCreateEvent} disabled={creatingEvent}>{creatingEvent ? 'Creating...' : 'Create Event'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeacherDashboard;
