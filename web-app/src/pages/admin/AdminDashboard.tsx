import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
    Users, CalendarDays, AlertTriangle, BookOpen, TrendingUp, Clock,
    Inbox, CheckCircle, XCircle, Megaphone, Trash2, Edit3,
    X, Loader2, KeyRound, MessageSquare, CalendarPlus
} from 'lucide-react';
import './Dashboard.css';

interface ChangeRequest {
    id: string; request_type: string; reason: string; status: string;
    admin_notes: string | null; created_at: string; teacher_id: string; teacher_name?: string;
}
interface Announcement {
    id: string; title: string; content: string; priority: string;
    target_section: string; created_at: string;
}
interface CustomEvent {
    id: string; title: string; description: string; event_date: string;
    start_time: string; end_time: string; room_name: string; created_at: string;
}
interface ResetRequest {
    id: string; email: string; status: string; requested_at: string;
}

const AdminDashboard: React.FC = () => {
    const { profile } = useAuth();
    const [stats, setStats] = useState({ totalUsers: 0, teachers: 0, students: 0, schedules: 0, conflicts: 0, rooms: 0 });
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState<ChangeRequest[]>([]);
    const [requestsLoading, setRequestsLoading] = useState(true);

    // Announcements
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [showAnnModal, setShowAnnModal] = useState(false);
    const [annTitle, setAnnTitle] = useState('');
    const [annContent, setAnnContent] = useState('');
    const [annPriority, setAnnPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
    const [annSection, setAnnSection] = useState('All Sections');
    const [sections, setSections] = useState<string[]>([]);
    const [postingAnn, setPostingAnn] = useState(false);
    const [editingAnn, setEditingAnn] = useState<Announcement | null>(null);

    // Events
    const [events, setEvents] = useState<CustomEvent[]>([]);
    const [showEventModal, setShowEventModal] = useState(false);
    const [evTitle, setEvTitle] = useState('');
    const [evDesc, setEvDesc] = useState('');
    const [evDate, setEvDate] = useState(new Date().toISOString().split('T')[0]);
    const [evStart, setEvStart] = useState('08:00');
    const [evEnd, setEvEnd] = useState('09:00');
    const [evRoom, setEvRoom] = useState('');
    const [rooms, setRooms] = useState<{id: string; name: string}[]>([]);
    const [postingEvent, setPostingEvent] = useState(false);

    // Messages
    const [recentMessages, setRecentMessages] = useState<any[]>([]);

    // Password resets
    const [resetRequests, setResetRequests] = useState<ResetRequest[]>([]);

    useEffect(() => {
        fetchAll();
        const ch = supabase.channel('admin-dash-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_change_requests' }, () => fetchRequests())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => fetchAnnouncements())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_events' }, () => fetchEvents())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_messages' }, () => fetchMessages())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'password_reset_requests' }, () => fetchResetRequests())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, []);

    const fetchAll = () => {
        fetchStats(); fetchRequests(); fetchAnnouncements();
        fetchEvents(); fetchSections(); fetchRooms();
        fetchMessages(); fetchResetRequests();
    };

    const fetchStats = async () => {
        try {
            const [profiles, schedules, conflicts, roomsR] = await Promise.all([
                supabase.from('profiles').select('role', { count: 'exact' }),
                supabase.from('schedules').select('id', { count: 'exact' }),
                supabase.from('conflicts').select('id', { count: 'exact' }).eq('is_resolved', false),
                supabase.from('rooms').select('id', { count: 'exact' }),
            ]);
            const all = profiles.data || [];
            setStats({
                totalUsers: profiles.count || 0,
                teachers: all.filter(p => p.role === 'teacher').length,
                students: all.filter(p => p.role === 'student').length,
                schedules: schedules.count || 0,
                conflicts: conflicts.count || 0,
                rooms: roomsR.count || 0,
            });
        } catch { /* ignore */ }
        setLoading(false);
    };

    const fetchRequests = async () => {
        try {
            const { data } = await supabase.from('schedule_change_requests').select('*').order('created_at', { ascending: false }).limit(20);
            if (data) {
                const ids = [...new Set(data.map(r => r.teacher_id).filter(Boolean))];
                let map: Record<string, string> = {};
                if (ids.length > 0) {
                    const { data: p } = await supabase.from('profiles').select('id, full_name').in('id', ids);
                    p?.forEach(pr => { map[pr.id] = pr.full_name || 'Unknown'; });
                }
                setRequests(data.map(r => ({ ...r, teacher_name: map[r.teacher_id] || 'Teacher' })));
            }
        } catch { /* ignore */ }
        setRequestsLoading(false);
    };

    const fetchAnnouncements = async () => {
        const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(10);
        setAnnouncements((data || []) as Announcement[]);
    };

    const fetchEvents = async () => {
        const { data } = await supabase.from('custom_events').select('*').gte('event_date', new Date().toISOString().split('T')[0]).order('event_date', { ascending: true }).limit(10);
        setEvents((data || []) as CustomEvent[]);
    };

    const fetchSections = async () => {
        const { data } = await supabase.from('sections').select('name').order('name');
        setSections((data || []).map(s => s.name));
    };

    const fetchRooms = async () => {
        const { data } = await supabase.from('rooms').select('id, name').order('name');
        setRooms((data || []) as any[]);
    };

    const fetchMessages = async () => {
        const { data } = await supabase.from('admin_messages').select('*').eq('direction', 'teacher_to_admin').order('created_at', { ascending: false }).limit(5);
        setRecentMessages(data || []);
    };

    const fetchResetRequests = async () => {
        const { data } = await supabase.from('password_reset_requests').select('*').eq('status', 'pending').order('requested_at', { ascending: false });
        setResetRequests((data || []) as ResetRequest[]);
    };

    const handleRequestAction = async (id: string, status: 'approved' | 'rejected') => {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
        const { error } = await supabase.from('schedule_change_requests').update({ status }).eq('id', id);
        if (error) { setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'pending' } : r)); alert('Error: ' + error.message); }
    };

    const handleDismissRequest = async (id: string) => {
        setRequests(prev => prev.filter(r => r.id !== id));
    };

    const handlePostAnnouncement = async () => {
        if (!annTitle.trim()) return;
        setPostingAnn(true);
        try {
            const prefix = annSection === 'All Sections' ? '[All Sections]' : `[${annSection}]`;
            if (editingAnn) {
                await supabase.from('announcements').update({ title: `${prefix} ${annTitle}`, content: annContent, priority: annPriority, target_section: annSection }).eq('id', editingAnn.id);
            } else {
                await supabase.from('announcements').insert({ title: `${prefix} ${annTitle}`, content: annContent, priority: annPriority, target_section: annSection, created_by: profile?.id });
            }
            setShowAnnModal(false); setAnnTitle(''); setAnnContent(''); setAnnPriority('normal'); setAnnSection('All Sections'); setEditingAnn(null);
            fetchAnnouncements();
        } catch (e: any) { alert('Error: ' + e.message); }
        setPostingAnn(false);
    };

    const handleDeleteAnn = async (id: string) => {
        if (!window.confirm('Delete announcement?')) return;
        await supabase.from('announcements').delete().eq('id', id);
        fetchAnnouncements();
    };

    const openEditAnn = (ann: Announcement) => {
        setEditingAnn(ann);
        const title = ann.title.replace(/^\[.*?\]\s*/, '');
        setAnnTitle(title);
        setAnnContent(ann.content);
        setAnnPriority(ann.priority as any);
        setAnnSection(ann.target_section || 'All Sections');
        setShowAnnModal(true);
    };

    const handleCreateEvent = async () => {
        if (!evTitle.trim()) return;
        setPostingEvent(true);
        try {
            await supabase.from('custom_events').insert({
                title: evTitle, description: evDesc, event_date: evDate,
                start_time: evStart, end_time: evEnd,
                room_name: evRoom || null, created_by: profile?.id,
            });
            setShowEventModal(false); setEvTitle(''); setEvDesc('');
            fetchEvents();
        } catch (e: any) { alert('Error: ' + e.message); }
        setPostingEvent(false);
    };

    const handleDeleteEvent = async (id: string) => {
        if (!window.confirm('Delete event?')) return;
        await supabase.from('custom_events').delete().eq('id', id);
        fetchEvents();
    };

    const handleApproveReset = async (req: ResetRequest) => {
        const emailLocal = req.email.split('@')[0] || '';
        const parts = emailLocal.split('.');
        const surname = parts[0]?.toLowerCase() || 'user';
        const idPart = parts[1] || 'reset';
        const newPw = `${surname}.${idPart}`;
        if (!window.confirm(`Reset password for ${req.email}?\nNew password: ${newPw}`)) return;
        try {
            const { data: u } = await supabase.from('profiles').select('id').eq('email', req.email).single();
            if (u) await supabase.auth.admin.updateUserById(u.id, { password: newPw });
            await supabase.from('password_reset_requests').update({ status: 'approved', resolved_at: new Date().toISOString(), resolved_by: profile?.id }).eq('id', req.id);
            fetchResetRequests();
            alert(`Password reset to: ${newPw}`);
        } catch (e: any) { alert('Error: ' + e.message); }
    };

    const handleDenyReset = async (req: ResetRequest) => {
        await supabase.from('password_reset_requests').update({ status: 'denied', resolved_at: new Date().toISOString(), resolved_by: profile?.id }).eq('id', req.id);
        fetchResetRequests();
    };

    const pendingRequests = requests.filter(r => r.status === 'pending');
    const prioStyles: Record<string, {bg: string; color: string}> = {
        urgent: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
        important: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
        normal: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
    };

    const statCards = [
        { label: 'Total Users', value: stats.totalUsers, icon: Users, color: '#6366f1' },
        { label: 'Teachers', value: stats.teachers, icon: BookOpen, color: '#3b82f6' },
        { label: 'Students', value: stats.students, icon: TrendingUp, color: '#10b981' },
        { label: 'Schedules', value: stats.schedules, icon: CalendarDays, color: '#8b5cf6' },
        { label: 'Conflicts', value: stats.conflicts, icon: AlertTriangle, color: '#f59e0b' },
        { label: 'Rooms', value: stats.rooms, icon: Clock, color: '#06b6d4' },
    ];

    const getStatusBadge = (status: string) => {
        const m: Record<string, {bg: string; color: string; label: string}> = {
            pending: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: 'PENDING' },
            approved: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'APPROVED' },
            rejected: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'REJECTED' },
        };
        return m[status] || m.pending;
    };

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Admin Dashboard</h1>
                    <p className="dashboard-subtitle">
                        System overview
                        {pendingRequests.length > 0 && <span style={{ color: '#fbbf24', marginLeft: 8 }}>• {pendingRequests.length} pending</span>}
                        {resetRequests.length > 0 && <span style={{ color: '#f59e0b', marginLeft: 8 }}>• {resetRequests.length} password reset{resetRequests.length > 1 ? 's' : ''}</span>}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => { setEditingAnn(null); setAnnTitle(''); setAnnContent(''); setShowAnnModal(true); }}>
                        <Megaphone size={14} /> Post Announcement
                    </button>
                    <button className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => setShowEventModal(true)}>
                        <CalendarPlus size={14} /> Add Event
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="stats-grid">
                {statCards.map(card => (
                    <div key={card.label} className="stat-card slide-up">
                        <div className="stat-card-header">
                            <div className="stat-icon" style={{ background: `${card.color}20`, color: card.color }}><card.icon size={20} /></div>
                        </div>
                        <div className="stat-number">{loading ? <div className="spinner" style={{ width: 20, height: 20 }} /> : card.value}</div>
                        <div className="stat-label">{card.label}</div>
                    </div>
                ))}
            </div>

            <div className="dashboard-grid">
                {/* Password Reset Requests */}
                {resetRequests.length > 0 && (
                    <div className="card" style={{ borderLeft: '3px solid #f59e0b' }}>
                        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <KeyRound size={18} color="#f59e0b" /> Password Reset Requests
                            <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: 11 }}>{resetRequests.length}</span>
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {resetRequests.map(r => (
                                <div key={r.id} style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: 13 }}>{r.email}</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.requested_at ? new Date(r.requested_at).toLocaleString() : 'Just now'}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: 12, flex: 1 }} onClick={() => handleApproveReset(r)}><CheckCircle size={13} /> Approve</button>
                                        <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: 12, flex: 1, color: '#ef4444' }} onClick={() => handleDenyReset(r)}><XCircle size={13} /> Deny</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Teacher Requests */}
                <div className="card">
                    <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Inbox size={18} /> Teacher Requests
                        {pendingRequests.length > 0 && <span className="badge" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', fontSize: 11 }}>{pendingRequests.length} pending</span>}
                    </h3>
                    {requestsLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="spinner" /></div>
                    ) : requests.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No requests yet</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                            {requests.slice(0, 8).map(req => {
                                const badge = getStatusBadge(req.status);
                                return (
                                    <div key={req.id} style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '10px 14px', borderLeft: `3px solid ${badge.color}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                            <span style={{ fontSize: 13, fontWeight: 600 }}>{req.teacher_name}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span className="badge" style={{ background: badge.bg, color: badge.color, fontSize: 10, fontWeight: 700 }}>{badge.label}</span>
                                            {req.status !== 'pending' && (
                                                <button onClick={() => handleDismissRequest(req.id)} title="Dismiss" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, borderRadius: 4, display: 'flex', alignItems: 'center' }}>
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{req.request_type}</div>
                                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0' }}>{req.reason}</p>
                                        {req.status === 'pending' && (
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 11 }} onClick={() => handleRequestAction(req.id, 'approved')}><CheckCircle size={12} /> Approve</button>
                                                <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 11, color: '#ef4444' }} onClick={() => handleRequestAction(req.id, 'rejected')}><XCircle size={12} /> Reject</button>
                                            </div>
                                        )}
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(req.created_at).toLocaleString()}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Announcements */}
                <div className="card">
                    <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Megaphone size={18} /> Announcements
                        <span className="badge" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', fontSize: 11 }}>{announcements.length}</span>
                    </h3>
                    {announcements.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No announcements yet</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                            {announcements.map(ann => {
                                const prio = prioStyles[ann.priority] || prioStyles.normal;
                                return (
                                    <div key={ann.id} style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '10px 14px', borderLeft: `3px solid ${prio.color}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 13, fontWeight: 600 }}>{ann.title}</span>
                                            <div style={{ display: 'flex', gap: 4 }}>
                                                <button onClick={() => openEditAnn(ann)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}><Edit3 size={12} /></button>
                                                <button onClick={() => handleDeleteAnn(ann.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}><Trash2 size={12} /></button>
                                            </div>
                                        </div>
                                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0' }}>{ann.content}</p>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="badge" style={{ background: prio.bg, color: prio.color, fontSize: 9, fontWeight: 700 }}>{ann.priority.toUpperCase()}</span>
                                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(ann.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Upcoming Events */}
                <div className="card">
                    <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CalendarPlus size={18} /> Upcoming Events
                        <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: 11 }}>{events.length}</span>
                    </h3>
                    {events.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No upcoming events</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                            {events.map(ev => (
                                <div key={ev.id} style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '10px 14px', borderLeft: '3px solid #10b981' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>{ev.title}</span>
                                        <button onClick={() => handleDeleteEvent(ev.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}><Trash2 size={12} /></button>
                                    </div>
                                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0' }}>{ev.description}</p>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        {new Date(ev.event_date).toLocaleDateString()} • {ev.start_time?.slice(0,5)} - {ev.end_time?.slice(0,5)} {ev.room_name && `• ${ev.room_name}`}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Messages */}
                <div className="card">
                    <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MessageSquare size={18} /> Recent Messages
                        {recentMessages.length > 0 && <span className="badge" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', fontSize: 11 }}>{recentMessages.length}</span>}
                    </h3>
                    {recentMessages.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No messages</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {recentMessages.map(m => (
                                <div key={m.id} style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: '10px 14px', borderLeft: '3px solid #6366f1' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>{m.sender_name}</span>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(m.created_at).toLocaleString()}</span>
                                    </div>
                                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>{m.message?.slice(0, 120)}{m.message?.length > 120 ? '...' : ''}</p>
                                </div>
                            ))}
                            <a href="/admin/messages" className="btn btn-secondary" style={{ fontSize: 12, padding: '6px', textAlign: 'center', marginTop: 4 }}>View All Messages</a>
                        </div>
                    )}
                </div>

                {/* System Status */}
                <div className="card">
                    <h3 className="card-title">System Status</h3>
                    <div className="status-list">
                        <div className="status-item"><div className="status-dot status-online" /><span>Database Connected</span></div>
                        <div className="status-item"><div className="status-dot status-online" /><span>Authentication Active</span></div>
                        <div className="status-item">
                            <div className={`status-dot ${stats.conflicts > 0 ? 'status-warning' : 'status-online'}`} />
                            <span>{stats.conflicts > 0 ? `${stats.conflicts} Unresolved Conflicts` : 'No Conflicts'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Announcement Modal */}
            {showAnnModal && (
                <div className="modal-overlay" onClick={() => setShowAnnModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3>{editingAnn ? 'Edit Announcement' : 'Post Announcement'}</h3>
                            <button onClick={() => setShowAnnModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <div className="modal-form">
                            <label>Title</label>
                            <input className="input" value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="Announcement title" />
                            <label>Content</label>
                            <textarea className="input" value={annContent} onChange={e => setAnnContent(e.target.value)} placeholder="Announcement content..." rows={3} style={{ resize: 'vertical' }} />
                            <label>Priority</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {(['normal', 'important', 'urgent'] as const).map(p => (
                                    <button key={p} className={`btn ${annPriority === p ? 'btn-primary' : 'btn-secondary'}`}
                                        style={{ flex: 1, padding: '6px', fontSize: 12, textTransform: 'capitalize' }}
                                        onClick={() => setAnnPriority(p)}>{p}</button>
                                ))}
                            </div>
                            <label>Target Section</label>
                            <select className="input" value={annSection} onChange={e => setAnnSection(e.target.value)}>
                                <option>All Sections</option>
                                {sections.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <button className="btn btn-primary" style={{ marginTop: 8, width: '100%' }} onClick={handlePostAnnouncement} disabled={postingAnn}>
                                {postingAnn ? <><Loader2 size={14} className="spin" /> Posting...</> : editingAnn ? 'Save Changes' : 'Post Announcement'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Event Modal */}
            {showEventModal && (
                <div className="modal-overlay" onClick={() => setShowEventModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3>Create Event</h3>
                            <button onClick={() => setShowEventModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <div className="modal-form">
                            <label>Title</label>
                            <input className="input" value={evTitle} onChange={e => setEvTitle(e.target.value)} placeholder="Event title" />
                            <label>Description</label>
                            <textarea className="input" value={evDesc} onChange={e => setEvDesc(e.target.value)} placeholder="Details..." rows={2} style={{ resize: 'vertical' }} />
                            <label>Date</label>
                            <input className="input" type="date" value={evDate} onChange={e => setEvDate(e.target.value)} />
                            <div style={{ display: 'flex', gap: 8 }}>
                                <div style={{ flex: 1 }}><label>Start</label><input className="input" type="time" value={evStart} onChange={e => setEvStart(e.target.value)} /></div>
                                <div style={{ flex: 1 }}><label>End</label><input className="input" type="time" value={evEnd} onChange={e => setEvEnd(e.target.value)} /></div>
                            </div>
                            <label>Room (optional)</label>
                            <select className="input" value={evRoom} onChange={e => setEvRoom(e.target.value)}>
                                <option value="">No specific room</option>
                                {rooms.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                            </select>
                            <button className="btn btn-primary" style={{ marginTop: 8, width: '100%' }} onClick={handleCreateEvent} disabled={postingEvent}>
                                {postingEvent ? <><Loader2 size={14} className="spin" /> Creating...</> : 'Create Event'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
                .modal-content { background: var(--bg-primary); border: 1px solid var(--border-default); border-radius: var(--radius-lg); padding: 24px; width: 90%; max-width: 480px; box-shadow: 0 20px 50px rgba(0,0,0,0.3); }
                .modal-form { display: flex; flex-direction: column; gap: 10px; }
                .modal-form label { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};

export default AdminDashboard;
