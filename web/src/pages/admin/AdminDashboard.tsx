import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { POWER_ADMIN_ROLES, hasAnyRole } from '../../types/database';
import type {
    ChangeRequest, Announcement, CustomEvent, ResetRequest,
    ConflictsTrend, DashboardStats, DashboardDeltas, AdminMessage, DashboardRoom
} from '../../types/dashboard';
import { DASHBOARD_CONFIG } from '../../config/dashboard';
import {
    Users, CalendarDays, AlertTriangle, BookOpen, TrendingUp, Clock,
    Inbox, CheckCircle, XCircle, Megaphone, Trash2, Edit3,
    X, Loader2, KeyRound, MessageSquare, CalendarPlus,
    Activity, BarChart3
} from 'lucide-react';
import {
    LineChart, Line, BarChart, Bar, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { ChartTooltip } from '../../components/ChartTooltip';
import './Dashboard.css';

const AdminDashboard: React.FC = () => {
    const { profile, roles } = useAuth();
    const [stats, setStats] = useState<DashboardStats>({ totalUsers: 0, teachers: 0, students: 0, schedules: 0, conflicts: 0, rooms: 0 });
    // Deltas: change vs ~7 days ago (positive = growth/increase)
    const [deltas, setDeltas] = useState<DashboardDeltas>({ schedules: 0, conflicts: 0, requests: 0 });
    // Chart datasets, all derived from real data
    const [conflictsTrend, setConflictsTrend] = useState<ConflictsTrend[]>([]);
    const [roomLoad, setRoomLoad] = useState<{ name: string; count: number }[]>([]);
    const [requestFunnel, setRequestFunnel] = useState({ approved: 0, rejected: 0, pending: 0 });
    
    // System activity and audit event trends (for all admins)

    // Role detection
    const isPowerAdmin = hasAnyRole(roles, POWER_ADMIN_ROLES);
    const isSystemAdmin = roles.includes('system_admin');
    const isScheduleAdmin = roles.includes('schedule_admin');
    const isScheduleManager = roles.includes('schedule_manager');

    // What this role can see
    const canSeeUserStats = isPowerAdmin || isSystemAdmin;
    const canSeeScheduleStats = isPowerAdmin || isScheduleAdmin || isScheduleManager;
    const canSeeRequests = isPowerAdmin || isScheduleAdmin;
    const canSeeResets = isPowerAdmin || isSystemAdmin;
    const canSeeEvents = isPowerAdmin || isScheduleAdmin || isScheduleManager;
    const canPostAnnouncements = isPowerAdmin || isSystemAdmin || isScheduleAdmin;
    const canCreateEvents = isPowerAdmin || isScheduleAdmin || isScheduleManager;
    const [requests, setRequests] = useState<ChangeRequest[]>([]);
    const [requestsLoading, setRequestsLoading] = useState(true);
    const [resolvingRequest, setResolvingRequest] = useState<ChangeRequest | null>(null);
    const [resolveAction, setResolveAction] = useState<'approved' | 'rejected'>('approved');
    const [resolveNotes, setResolveNotes] = useState('');

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
    const [rooms, setRooms] = useState<DashboardRoom[]>([]);
    const [postingEvent, setPostingEvent] = useState(false);

    // Messages
    const [recentMessages, setRecentMessages] = useState<AdminMessage[]>([]);

    // Password resets
    const [resetRequests, setResetRequests] = useState<ResetRequest[]>([]);

    const fetchAll = () => {
        fetchStats(); fetchRequests(); fetchAnnouncements();
        fetchEvents(); fetchSections(); fetchRooms();
        fetchMessages(); fetchResetRequests();
    };

    const fetchStats = async () => {
        try {
            const sevenDaysAgo = new Date(Date.now() - DASHBOARD_CONFIG.TIME.DAYS_7_MS).toISOString();
            const fourteenDaysAgo = new Date(Date.now() - DASHBOARD_CONFIG.TIME.DAYS_14_MS).toISOString();
            const [profiles, schedules, conflicts, roomsR, schedulesRecent, conflictsRecent, requestsRecent, conflictsAll, schedulesFull, roomsFull] = await Promise.all([
                supabase.from('profiles').select('role'),
                supabase.from('schedules').select('id', { count: 'exact' }),
                supabase.from('conflicts').select('id', { count: 'exact' }).eq('is_resolved', false),
                supabase.from('rooms').select('id', { count: 'exact' }),
                supabase.from('schedules').select('id', { count: 'exact' }).gte('created_at', sevenDaysAgo),
                supabase.from('conflicts').select('id', { count: 'exact' }).gte('created_at', sevenDaysAgo),
                supabase.from('schedule_change_requests').select('id', { count: 'exact' }).gte('created_at', sevenDaysAgo),
                // 14-day daily conflicts trend
                supabase.from('conflicts').select('created_at').gte('created_at', fourteenDaysAgo),
                // Schedules grouped by day_of_week + room_id
                supabase.from('schedules').select('day_of_week, room_id'),
                supabase.from('rooms').select('id, name'),
            ]);
            const all = profiles.data || [];
            const totalUsers = all.length;
            setStats({
                totalUsers,
                teachers: all.filter((p: { role: string }) => p.role === 'teacher').length,
                students: all.filter((p: { role: string }) => p.role === 'student').length,
                schedules: schedules.count || 0,
                conflicts: conflicts.count || 0,
                rooms: roomsR.count || 0,
            });
            setDeltas({
                schedules: schedulesRecent.count || 0,
                conflicts: conflictsRecent.count || 0,
                requests: requestsRecent.count || 0,
            });
            
            // Build 14-day conflicts trend
            const trendMap: Record<string, number> = {};
            for (let i = DASHBOARD_CONFIG.CHART.CONFLICTS_TREND_DAYS - 1; i >= 0; i--) {
                const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
                const key = `${d.getMonth() + 1}/${d.getDate()}`;
                trendMap[key] = 0;
            }
            (conflictsAll.data || []).forEach((c: { created_at: string }) => {
                if (!c.created_at) return;
                const d = new Date(c.created_at);
                const key = `${d.getMonth() + 1}/${d.getDate()}`;
                if (key in trendMap) trendMap[key]++;
            });
            setConflictsTrend(Object.entries(trendMap).map(([date, count]) => ({ date, count })));
            // Room load (top 8)
            const roomMap: Record<string, number> = {};
            (schedulesFull.data || []).forEach((s: { room_id: string }) => {
                if (s.room_id) roomMap[s.room_id] = (roomMap[s.room_id] || 0) + 1;
            });
            const roomNameById: Record<string, string> = {};
            (roomsFull.data || []).forEach((r: { id: string; name: string }) => { roomNameById[r.id] = r.name; });
            const loadList = Object.entries(roomMap)
                .map(([id, count]) => ({ name: roomNameById[id] || 'Room', count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, DASHBOARD_CONFIG.QUERY_LIMITS.ROOM_LOAD);
            setRoomLoad(loadList);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchRequests = async () => {
        try {
            const thirtyDaysAgo = new Date(Date.now() - DASHBOARD_CONFIG.TIME.DAYS_30_MS).toISOString();
            const [recentList, funnelAll] = await Promise.all([
                supabase.from('schedule_change_requests').select('*').order('created_at', { ascending: false }).limit(DASHBOARD_CONFIG.QUERY_LIMITS.REQUESTS),
                supabase.from('schedule_change_requests').select('status').gte('created_at', thirtyDaysAgo),
            ]);
            const data = recentList.data;
            if (data) {
                const ids = [...new Set(data.map(r => r.teacher_id).filter(Boolean))];
                const map: Record<string, string> = {};
                if (ids.length > 0) {
                    const { data: p } = await supabase.from('profiles').select('id, full_name').in('id', ids);
                    p?.forEach(pr => { map[pr.id] = pr.full_name || 'Unknown'; });
                }
                setRequests(data.map(r => ({ ...r, teacher_name: map[r.teacher_id] || 'Teacher' })));
            }
            // Funnel last 30 days
            const f = { approved: 0, rejected: 0, pending: 0 };
            (funnelAll.data || []).forEach((r: { status: string }) => {
                if (r.status === 'approved') f.approved++;
                else if (r.status === 'rejected') f.rejected++;
                else f.pending++;
            });
            setRequestFunnel(f);
        } catch (error) {
            console.error('Error fetching requests:', error);
        }
        setRequestsLoading(false);
    };

    const fetchAnnouncements = async () => {
        const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(DASHBOARD_CONFIG.QUERY_LIMITS.ANNOUNCEMENTS);
        setAnnouncements((data || []) as Announcement[]);
    };

    const fetchEvents = async () => {
        const { data } = await supabase.from('custom_events').select('*').gte('event_date', new Date().toISOString().split('T')[0]).order('event_date', { ascending: true }).limit(DASHBOARD_CONFIG.QUERY_LIMITS.EVENTS);
        setEvents((data || []) as CustomEvent[]);
    };

    const fetchSections = async () => {
        const { data } = await supabase.from('sections').select('name').order('name');
        setSections((data || []).map(s => s.name));
    };

    const fetchRooms = async () => {
        const { data } = await supabase.from('rooms').select('id, name').order('name');
        setRooms((data || []) as DashboardRoom[]);
    };

    const fetchMessages = async () => {
        const { data } = await supabase.from('admin_messages')
            .select('*')
            .eq('direction', 'teacher_to_admin')
            .or('recipient_id.is.null')
            .order('created_at', { ascending: false })
            .limit(DASHBOARD_CONFIG.QUERY_LIMITS.MESSAGES);
        // Filter messages for current admin on client side (safe since profile.id is from auth)
        const filtered = (data || []).filter(m => m.recipient_id === null || m.recipient_id === profile?.id);
        setRecentMessages(filtered);
    };

    const fetchResetRequests = async () => {
        const { data } = await supabase.from('password_reset_requests').select('*').eq('status', 'pending').order('requested_at', { ascending: false });
        setResetRequests((data || []) as ResetRequest[]);
    };

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRequestAction = async (id: string, status: 'approved' | 'rejected', notes: string) => {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
        const { error } = await supabase.from('schedule_change_requests').update({ status, admin_notes: notes }).eq('id', id);
        if (error) { setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'pending' } : r)); alert('Error: ' + error.message); }
        setResolvingRequest(null);
        setResolveNotes('');
    };

    const handlePostAnnouncement = async () => {
        if (!annTitle.trim()) return;
        setPostingAnn(true);
        try {
            const prefix = annSection === 'All Sections' ? '[All Sections]' : `[${annSection}]`;
            if (editingAnn) {
                await supabase.from('announcements').update({ title: `${prefix} ${annTitle}`, content: annContent, priority: annPriority, target_section: annSection }).eq('id', editingAnn.id);
            } else {
                const { error } = await supabase.from('announcements').insert({
                    title: `${prefix} ${annTitle}`, content: annContent, priority: annPriority,
                    target_section: annSection, author_id: profile?.id,
                    author_name: profile?.full_name || 'Admin',
                });
                if (error) { alert('Failed to post: ' + error.message); setPostingAnn(false); return; }
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
        setAnnPriority(ann.priority as 'normal' | 'important' | 'urgent');
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
    const prioStyles: Record<string, { bg: string; color: string }> = {
        urgent: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
        important: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
        normal: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
    };

    // Build stat cards based on role, with deltas (state plus recent change)
    type StatCard = { label: string; value: number; icon: typeof Users; color: string; show: boolean; warning?: boolean; delta?: number; deltaLabel?: string; deltaGood?: 'up' | 'down' };
    const allStatCards: StatCard[] = [
        { label: 'Total Users', value: stats.totalUsers, icon: Users, color: '#3b82f6', show: canSeeUserStats },
        { label: 'Teachers', value: stats.teachers, icon: BookOpen, color: '#0ea5e9', show: canSeeUserStats },
        { label: 'Students', value: stats.students, icon: TrendingUp, color: '#22c55e', show: canSeeUserStats },
        { label: 'Schedules', value: stats.schedules, icon: CalendarDays, color: '#6366f1', show: canSeeScheduleStats, delta: deltas.schedules, deltaLabel: 'new (7d)', deltaGood: 'up' },
        { label: 'Open Conflicts', value: stats.conflicts, icon: AlertTriangle, color: '#f59e0b', show: canSeeScheduleStats, warning: stats.conflicts > 0, delta: deltas.conflicts, deltaLabel: 'new (7d)', deltaGood: 'down' },
        { label: 'Rooms', value: stats.rooms, icon: Clock, color: '#06b6d4', show: canSeeScheduleStats || canSeeUserStats },
    ];
    const statCards = allStatCards.filter(c => c.show);

    const getStatusBadge = (status: string) => {
        const m: Record<string, { bg: string; color: string; label: string }> = {
            pending: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: 'PENDING' },
            approved: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'APPROVED' },
            rejected: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'REJECTED' },
        };
        return m[status] || m.pending;
    };

    // Dashboard title based on role
    const dashboardTitle = isPowerAdmin ? 'Admin Dashboard'
        : isSystemAdmin ? 'System Administration'
            : isScheduleAdmin ? 'Schedule Administration'
                : isScheduleManager ? 'Schedule Management'
                    : 'Dashboard';

    const dashboardSubtitle = isPowerAdmin ? 'Full system overview'
        : isSystemAdmin ? 'User management and system health'
            : isScheduleAdmin ? 'Schedule approval and conflict resolution'
                : isScheduleManager ? 'Schedule creation and data management'
                    : 'Overview';

    // Funnel total + percentages for compact stacked bar
    const funnelTotal = requestFunnel.approved + requestFunnel.rejected + requestFunnel.pending;


    return (
        <div className="dashboard fade-in">
            {/* ===== HEADER ===== */}
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">{dashboardTitle}</h1>
                    <p className="dashboard-subtitle">
                        {dashboardSubtitle}
                        {canSeeRequests && pendingRequests.length > 0 && <span className="dash-subtitle-warning">{pendingRequests.length} pending request{pendingRequests.length > 1 ? 's' : ''}</span>}
                        {canSeeResets && resetRequests.length > 0 && <span className="dash-subtitle-warning">{resetRequests.length} password reset{resetRequests.length > 1 ? 's' : ''}</span>}
                    </p>
                </div>
                <div className="dash-header-actions">
                    {canPostAnnouncements && (
                        <button className="btn btn-primary" onClick={() => { setEditingAnn(null); setAnnTitle(''); setAnnContent(''); setShowAnnModal(true); }}>
                            <Megaphone size={14} /> Post Announcement
                        </button>
                    )}
                    {canCreateEvents && (
                        <button className="btn btn-secondary" onClick={() => setShowEventModal(true)}>
                            <CalendarPlus size={14} /> Add Event
                        </button>
                    )}
                </div>
            </div>

            {/* ===== MAIN DASHBOARD LAYOUT ===== */}
            <div className="admin-dash-main">
                {/* LEFT COLUMN */}
                <div className="admin-dash-left">
                    {/* ROW 1: STATS STRIP */}
                    <div className="stats-grid">
                        {statCards.map((card, idx) => {
                            const showDelta = typeof card.delta === 'number' && card.delta > 0;
                            const deltaIsBad = card.deltaGood === 'down' && (card.delta || 0) > 0;
                            return (
                                <div key={idx} className={`stat-card ${card.warning ? 'stat-warning' : ''}`} role="group" aria-label={`${card.label}: ${card.value}`}>
                                    <div className="stat-card-header">
                                        <span className="stat-label">{card.label}</span>
                                        <div className="stat-icon" style={{ color: card.color }} aria-hidden="true">
                                            <card.icon size={18} />
                                        </div>
                                    </div>
                                    <div className="stat-number">{card.value.toLocaleString()}</div>
                                    {showDelta && (
                                        <div className="stat-delta" style={{ color: deltaIsBad ? 'var(--d-danger, #C84B4B)' : 'var(--d-success, #2F8F5B)' }} aria-label={`${card.delta} ${card.deltaLabel}`}>
                                            <TrendingUp size={11} aria-hidden="true" /> +{card.delta}
                                            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{card.deltaLabel}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* ROW 2: ACTION & COMMUNICATION */}
                    <div className="admin-dash-row-2">
                        {/* Password Reset Requests */}
                        {canSeeResets && resetRequests.length > 0 && (
                            <div className="dash-card dash-stagger">
                                <div className="dash-card-header">
                                    <div className="dash-card-title"><KeyRound size={16} /> Password Resets</div>
                                    <span className="dash-card-badge dash-badge-warning">{resetRequests.length}</span>
                                </div>
                                <div className="dash-list">
                                    {resetRequests.slice(0, DASHBOARD_CONFIG.DISPLAY_LIMITS.RESET_REQUESTS).map(r => (
                                        <div key={r.id} className="dash-list-item">
                                            <div className="dash-list-item-accent dash-accent-warning" />
                                            <div className="dash-list-item-body dash-list-item-body--compact">
                                                <div className="dash-list-item-title">{r.email}</div>
                                                <div className="dash-list-item-meta">{r.requested_at ? new Date(r.requested_at).toLocaleString() : 'Just now'}</div>
                                                <div className="dash-list-item-actions">
                                                    <button className="btn btn-primary" onClick={() => handleApproveReset(r)}><CheckCircle size={12} /></button>
                                                    <button className="btn btn-secondary dash-btn-danger" onClick={() => handleDenyReset(r)}><XCircle size={12} /></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Teacher Requests */}
                        {canSeeRequests && (
                            <div className="dash-card dash-stagger">
                                <div className="dash-card-header">
                                    <div className="dash-card-title"><Inbox size={16} /> Teacher Requests</div>
                                    {pendingRequests.length > 0 && <span className="dash-card-badge dash-badge-warning">{pendingRequests.length}</span>}
                                </div>
                                {requestsLoading ? (
                                    <div className="dash-loading-center"><div className="spinner" /></div>
                                ) : requests.length === 0 ? (
                                    <div className="dash-empty"><Inbox size={28} /><div>No requests</div></div>
                                ) : (
                                    <div className="dash-list">
                                        {requests.slice(0, DASHBOARD_CONFIG.DISPLAY_LIMITS.REQUEST_ITEMS).map(req => {
                                            const badge = getStatusBadge(req.status);
                                            return (
                                                <div key={req.id} className="dash-list-item">
                                                    <div className="dash-list-item-accent" style={{ background: badge.color }} />
                                                    <div className="dash-list-item-body dash-list-item-body--compact">
                                                        <div className="dash-header-row">
                                                            <div className="dash-list-item-title">{req.teacher_name}</div>
                                                            <span className="dash-status-badge" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                                                        </div>
                                                        <div className="dash-list-item-meta dash-meta-text--uppercase">{req.request_type}</div>
                                                        {req.status === 'pending' && (
                                                            <div className="dash-list-item-actions">
                                                                <button className="btn btn-primary" onClick={() => { setResolvingRequest(req); setResolveAction('approved'); }}><CheckCircle size={12} /></button>
                                                                <button className="btn btn-secondary dash-btn-danger" onClick={() => { setResolvingRequest(req); setResolveAction('rejected'); }}><XCircle size={12} /></button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Announcements */}
                        <div className="dash-card dash-stagger">
                            <div className="dash-card-header">
                                <div className="dash-card-title"><Megaphone size={16} /> Announcements</div>
                                <span className="dash-card-badge dash-badge-info">{announcements.length}</span>
                            </div>
                            {announcements.length === 0 ? (
                                <div className="dash-empty"><Megaphone size={28} /><div>No announcements</div></div>
                            ) : (
                                <div className="dash-list">
                                    {announcements.slice(0, DASHBOARD_CONFIG.DISPLAY_LIMITS.RECENT_ITEMS).map(ann => {
                                        const prio = prioStyles[ann.priority] || prioStyles.normal;
                                        return (
                                            <div key={ann.id} className="dash-list-item">
                                                <div className="dash-list-item-accent" style={{ background: prio.color }} />
                                                <div className="dash-list-item-body dash-list-item-body--compact">
                                                    <div className="dash-header-row">
                                                        <div className="dash-list-item-title">{ann.title}</div>
                                                        <div className="dash-icon-group">
                                                            <button className="dash-icon-btn" onClick={() => openEditAnn(ann)}><Edit3 size={13} /></button>
                                                            <button className="dash-icon-btn dash-icon-btn-danger" onClick={() => handleDeleteAnn(ann.id)}><Trash2 size={13} /></button>
                                                        </div>
                                                    </div>
                                                    <div className="dash-list-item-desc">{ann.content}</div>
                                                    <span className="dash-status-badge" style={{ background: prio.bg, color: prio.color, fontSize: 10 }}>{ann.priority.toUpperCase()}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Upcoming Events */}
                        {canSeeEvents && (
                            <div className="dash-card dash-stagger">
                                <div className="dash-card-header">
                                    <div className="dash-card-title"><CalendarPlus size={16} /> Events</div>
                                    <span className="dash-card-badge dash-badge-success">{events.length}</span>
                                </div>
                                {events.length === 0 ? (
                                    <div className="dash-empty"><CalendarPlus size={28} /><div>No events</div></div>
                                ) : (
                                    <div className="dash-list">
                                        {events.slice(0, DASHBOARD_CONFIG.DISPLAY_LIMITS.RECENT_ITEMS).map(ev => (
                                            <div key={ev.id} className="dash-list-item">
                                                <div className="dash-list-item-accent dash-accent-success" />
                                            <div className="dash-list-item-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                                                    <CalendarDays size={14} />
                                                </div>
                                                <div className="dash-list-item-body">
                                                    <div className="dash-list-item-title">{ev.title}</div>
                                                    <div className="dash-list-item-meta">
                                                        {new Date(ev.event_date).toLocaleDateString()} · {ev.start_time?.slice(0, 5)} to {ev.end_time?.slice(0, 5)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Messages */}
                        <div className="dash-card dash-stagger">
                            <div className="dash-card-header">
                                <div className="dash-card-title"><MessageSquare size={16} /> Messages</div>
                                {recentMessages.length > 0 && <span className="dash-card-badge dash-badge-info">{recentMessages.length}</span>}
                            </div>
                            {recentMessages.length === 0 ? (
                                <div className="dash-empty"><MessageSquare size={28} /><div>No messages</div></div>
                            ) : (
                                <div className="dash-list">
                                    {recentMessages.slice(0, DASHBOARD_CONFIG.DISPLAY_LIMITS.RECENT_ITEMS).map(m => (
                                        <div key={m.id} className="dash-list-item">
                                            <div className="dash-list-item-accent dash-accent-info" />
                                            <div className="dash-list-item-body dash-list-item-body--compact">
                                                <div className="dash-list-item-title">{m.sender_name}</div>
                                                <div className="dash-list-item-desc">{m.message?.slice(0, DASHBOARD_CONFIG.DISPLAY_LIMITS.MESSAGE_TRUNCATION)}{m.message?.length > DASHBOARD_CONFIG.DISPLAY_LIMITS.MESSAGE_TRUNCATION ? '…' : ''}</div>
                                            </div>
                                        </div>
                                    ))}
                                    <a href="/admin/messages" className="btn btn-secondary dash-view-all-link">View All</a>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ROW 3: OPERATIONAL SUPPORT */}
                    <div className="admin-dash-row-3">
                        {/* Charts moved to siderail */}
                    </div>
                </div>

                {/* RIGHT COLUMN: graphs and diagnostics (trend, then comparison) */}
                <div className="admin-dash-right">

                    {/* A2: Conflicts Trend (real, last 14 days) */}
                    {canSeeScheduleStats && (
                        <div className="dash-card dash-stagger">
                            <div className="dash-card-header">
                                <div className="dash-card-title"><Activity size={16} /> Conflicts Last 14 Days</div>
                                <span className="dash-card-badge" style={{ background: stats.conflicts > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', color: stats.conflicts > 0 ? '#ef4444' : '#22c55e' }}>
                                    {stats.conflicts > 0 ? `${stats.conflicts} open` : 'All clear'}
                                </span>
                            </div>
                            <div className="dash-chart-wrap" role="img" aria-label={`Conflicts trend, last 14 days, ${conflictsTrend.reduce((s, d) => s + d.count, 0)} total new`}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={conflictsTrend} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={1} />
                                        <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Line type="monotone" dataKey="count" name="New conflicts" stroke="#ef4444" strokeWidth={2} dot={{ r: 2.5, fill: '#ef4444' }} activeDot={{ r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="dash-meta-text" style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                                <span>New (7d): <strong className="dash-text-primary" style={{ color: deltas.conflicts > 0 ? '#ef4444' : undefined }}>{deltas.conflicts}</strong></span>
                                <span>Total (14d): <strong className="dash-text-primary">{conflictsTrend.reduce((s, d) => s + d.count, 0)}</strong></span>
                            </div>
                        </div>
                    )}

                    {/* A4: Request Funnel (real, last 30 days). Single horizontal stacked bar */}
                    {canSeeRequests && (
                        <div className="dash-card dash-stagger">
                            <div className="dash-card-header">
                                <div className="dash-card-title"><TrendingUp size={16} /> Requests Last 30 Days</div>
                                <span className="dash-card-badge" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>{funnelTotal}</span>
                            </div>
                            {funnelTotal === 0 ? (
                                <div className="dash-empty" style={{ padding: '20px 0' }}><Inbox size={26} /><div>No requests in 30 days</div></div>
                            ) : (
                                <>
                                    <div className="dash-funnel-bar" role="img" aria-label={`${requestFunnel.approved} approved, ${requestFunnel.rejected} rejected, ${requestFunnel.pending} pending`}>
                                        <div style={{ width: `${(requestFunnel.approved / funnelTotal) * 100}%`, background: '#22c55e' }} title={`Approved: ${requestFunnel.approved}`} />
                                        <div style={{ width: `${(requestFunnel.rejected / funnelTotal) * 100}%`, background: '#ef4444' }} title={`Rejected: ${requestFunnel.rejected}`} />
                                        <div style={{ width: `${(requestFunnel.pending / funnelTotal) * 100}%`, background: '#f59e0b' }} title={`Pending: ${requestFunnel.pending}`} />
                                    </div>
                                    <div className="dash-funnel-legend">
                                        <div><CheckCircle size={12} color="#22c55e" /> Approved <strong>{requestFunnel.approved}</strong> <span>({Math.round((requestFunnel.approved / funnelTotal) * 100)}%)</span></div>
                                        <div><XCircle size={12} color="#ef4444" /> Rejected <strong>{requestFunnel.rejected}</strong> <span>({Math.round((requestFunnel.rejected / funnelTotal) * 100)}%)</span></div>
                                        <div><Clock size={12} color="#f59e0b" /> Pending <strong>{requestFunnel.pending}</strong> <span>({Math.round((requestFunnel.pending / funnelTotal) * 100)}%)</span></div>
                                    </div>
                                    {requestFunnel.pending > 0 && (
                                        <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <AlertTriangle size={11} /> {requestFunnel.pending} awaiting decision
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* A3: Room Load (real, top 8) */}
                    {canSeeScheduleStats && roomLoad.length > 0 && (
                        <div className="dash-card dash-stagger">
                            <div className="dash-card-header">
                                <div className="dash-card-title"><BarChart3 size={16} /> Top Rooms by Load</div>
                                <span className="dash-card-subtitle" style={{ display: 'none' }} />
                                <span className="dash-card-badge" style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4' }}>{stats.rooms}</span>
                            </div>
                            <div className="dash-chart-wrap" role="img" aria-label="Top rooms by scheduled class count">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={roomLoad} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" horizontal={false} />
                                        <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} width={70} />
                                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-elevated)', opacity: 0.4 }} />
                                        <Bar dataKey="count" name="Classes" radius={[0, 4, 4, 0]}>
                                            {roomLoad.map((entry, i) => {
                                                const max = Math.max(...roomLoad.map(r => r.count), 1);
                                                const ratio = entry.count / max;
                                                const color = ratio > 0.85 ? '#ef4444' : ratio > 0.6 ? '#f59e0b' : '#06b6d4';
                                                return <Cell key={i} fill={color} />;
                                            })}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            </div>


            {/* ===== MODALS ===== */}
            {/* Announcement Modal */}
            {showAnnModal && (
                <div className="modal-overlay" onClick={() => setShowAnnModal(false)}>
                    <div className="dash-modal-box" onClick={e => e.stopPropagation()}>
                        <div className="dash-modal-header">
                            <h3>{editingAnn ? 'Edit Announcement' : 'Post Announcement'}</h3>
                            <button className="dash-modal-close" onClick={() => setShowAnnModal(false)}><X size={16} /></button>
                        </div>
                        <div className="dash-modal-body">
                            <label>Title</label>
                            <input className="input" value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="Announcement title" />
                            <label>Content</label>
                            <textarea className="input" value={annContent} onChange={e => setAnnContent(e.target.value)} placeholder="Announcement content..." rows={3} />
                            <label>Priority</label>
                            <div className="dash-btn-group">
                                {(['normal', 'important', 'urgent'] as const).map(p => (
                                    <button key={p} className={`dash-btn-tab ${annPriority === p ? 'dash-btn-tab-active' : ''}`}
                                        onClick={() => setAnnPriority(p)}>{p}</button>
                                ))}
                            </div>
                            <label>Target Section</label>
                            <select className="input" value={annSection} onChange={e => setAnnSection(e.target.value)}>
                                <option value="All Sections">All Sections</option>
                                {sections.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <button className="dash-modal-btn dash-modal-btn-primary" onClick={handlePostAnnouncement} disabled={postingAnn}>
                                {postingAnn ? <><Loader2 size={14} className="spin" /> Posting...</> : editingAnn ? 'Save Changes' : 'Post Announcement'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Event Modal */}
            {showEventModal && (
                <div className="modal-overlay" onClick={() => setShowEventModal(false)}>
                    <div className="dash-modal-box" onClick={e => e.stopPropagation()}>
                        <div className="dash-modal-header">
                            <h3>Create Event</h3>
                            <button className="dash-modal-close" onClick={() => setShowEventModal(false)}><X size={16} /></button>
                        </div>
                        <div className="dash-modal-body">
                            <label>Title</label>
                            <input className="input" value={evTitle} onChange={e => setEvTitle(e.target.value)} placeholder="Event title" />
                            <label>Description</label>
                            <textarea className="input" value={evDesc} onChange={e => setEvDesc(e.target.value)} placeholder="Details..." rows={2} />
                            <label>Date</label>
                            <input className="input" type="date" value={evDate} onChange={e => setEvDate(e.target.value)} />
                            <div className="dash-header-row" style={{ gap: 8 }}>
                                <div style={{ flex: 1 }}><label>Start</label><input className="input" type="time" value={evStart} onChange={e => setEvStart(e.target.value)} /></div>
                                <div style={{ flex: 1 }}><label>End</label><input className="input" type="time" value={evEnd} onChange={e => setEvEnd(e.target.value)} /></div>
                            </div>
                            <label>Room (optional)</label>
                            <select className="input" value={evRoom} onChange={e => setEvRoom(e.target.value)}>
                                <option value="">No specific room</option>
                                {rooms.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                            </select>
                            <button className="dash-modal-btn dash-modal-btn-primary" onClick={handleCreateEvent} disabled={postingEvent}>
                                {postingEvent ? <><Loader2 size={14} className="spin" /> Creating...</> : 'Create Event'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Resolve Request Modal */}
            {resolvingRequest && (
                <div className="modal-overlay" onClick={() => setResolvingRequest(null)}>
                    <div className="dash-modal-box" onClick={e => e.stopPropagation()}>
                        <div className="dash-modal-header">
                            <h3>{resolveAction === 'approved' ? 'Approve' : 'Reject'} Request</h3>
                            <button className="dash-modal-close" onClick={() => setResolvingRequest(null)}><X size={16} /></button>
                        </div>
                        <div className="dash-modal-body">
                            <label>Admin Note (Required to Reply)</label>
                            <textarea className="input" value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} placeholder="Type a message to the teacher regarding this decision..." rows={4} />
                            <div className="dash-header-row" style={{ gap: 10 }}>
                                <button className="dash-modal-btn" onClick={() => setResolvingRequest(null)}>Cancel</button>
                                <button className={`dash-modal-btn ${resolveAction === 'approved' ? 'dash-modal-btn-primary' : 'dash-modal-btn-warning'}`}
                                    disabled={!resolveNotes.trim()}
                                    onClick={() => handleRequestAction(resolvingRequest.id, resolveAction, resolveNotes.trim())}>
                                    Confirm {resolveAction === 'approved' ? 'Approval' : 'Rejection'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal + spin styles are now defined globally in index.css */}
        </div>
    );
};

export default AdminDashboard;
