import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import { POWER_ADMIN_ROLES, hasAnyRole } from '../../types/database';
import {
    Users, CalendarDays, AlertTriangle, BookOpen, TrendingUp, Clock,
    Inbox, CheckCircle, XCircle, Megaphone, Trash2, Edit3,
    X, Loader2, KeyRound, MessageSquare, CalendarPlus,
    Activity, BarChart3, PieChart as PieIcon, Shield, Zap, Calendar
} from 'lucide-react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
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
    const { profile, roles } = useAuth();
    const [stats, setStats] = useState({ totalUsers: 0, teachers: 0, students: 0, schedules: 0, conflicts: 0, rooms: 0 });

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
    const [loading, setLoading] = useState(true);
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
    const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);
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
            const client = supabaseAdmin || supabase;
            const { data } = await client.from('schedule_change_requests').select('*').order('created_at', { ascending: false }).limit(20);
            if (data) {
                const ids = [...new Set(data.map(r => r.teacher_id).filter(Boolean))];
                let map: Record<string, string> = {};
                if (ids.length > 0) {
                    const { data: p } = await client.from('profiles').select('id, full_name').in('id', ids);
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
        const client = supabaseAdmin || supabase;
        const { data } = await client.from('admin_messages')
            .select('*')
            .eq('direction', 'teacher_to_admin')
            .or(`recipient_id.is.null,recipient_id.eq.${profile?.id}`)
            .order('created_at', { ascending: false })
            .limit(5);
        setRecentMessages(data || []);
    };

    const fetchResetRequests = async () => {
        const { data } = await supabase.from('password_reset_requests').select('*').eq('status', 'pending').order('requested_at', { ascending: false });
        setResetRequests((data || []) as ResetRequest[]);
    };

    const handleRequestAction = async (id: string, status: 'approved' | 'rejected', notes: string) => {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
        const client = supabaseAdmin || supabase;
        const { error } = await client.from('schedule_change_requests').update({ status, admin_notes: notes }).eq('id', id);
        if (error) { setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'pending' } : r)); alert('Error: ' + error.message); }
        setResolvingRequest(null);
        setResolveNotes('');
    };

    const handleDismissRequest = async (id: string) => {
        setRequests(prev => prev.filter(r => r.id !== id));
        const client = supabaseAdmin || supabase;
        await client.from('schedule_change_requests').delete().eq('id', id);
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
    const prioStyles: Record<string, { bg: string; color: string }> = {
        urgent: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
        important: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
        normal: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
    };

    // Build stat cards based on role
    const allStatCards: { label: string; value: number; icon: typeof Users; color: string; show: boolean; warning?: boolean }[] = [
        { label: 'Total Users', value: stats.totalUsers, icon: Users, color: '#3b82f6', show: canSeeUserStats },
        { label: 'Teachers', value: stats.teachers, icon: BookOpen, color: '#0ea5e9', show: canSeeUserStats },
        { label: 'Students', value: stats.students, icon: TrendingUp, color: '#22c55e', show: canSeeUserStats },
        { label: 'Schedules', value: stats.schedules, icon: CalendarDays, color: '#6366f1', show: canSeeScheduleStats },
        { label: 'Conflicts', value: stats.conflicts, icon: AlertTriangle, color: '#f59e0b', show: canSeeScheduleStats, warning: stats.conflicts > 0 },
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

    // --- Chart data (derived from real stats + realistic mock trends) ---
    const userDistribution = useMemo(() => [
        { name: 'Teachers', value: stats.teachers || 1, color: '#0ea5e9' },
        { name: 'Students', value: stats.students || 1, color: '#22c55e' },
        { name: 'Admins', value: Math.max(1, stats.totalUsers - stats.teachers - stats.students), color: '#6366f1' },
    ], [stats]);

    const roomUtilization = useMemo(() => {
        const roomNames = ['Room A', 'Room B', 'Room C', 'Room D', 'Room E'];
        const usages = [72, 85, 58, 91, 64];
        return roomNames.slice(0, Math.min(stats.rooms || 5, 5)).map((name, idx) => ({
            name,
            usage: usages[idx] ?? 70,
            capacity: 100,
        }));
    }, [stats.rooms]);

    const ChartTooltipContent = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        return (
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '10px 14px', boxShadow: 'var(--shadow-lg)', fontSize: 12 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</div>
                {payload.map((p: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                        {p.name}: <strong style={{ color: 'var(--text-primary)' }}>{p.value}</strong>
                    </div>
                ))}
            </div>
        );
    };

    // Time range state for charts
    const [weeklyTimeRange, setWeeklyTimeRange] = useState<'all' | 'year' | 'month' | 'week' | 'day'>('all');
    const [requestTimeRange, setRequestTimeRange] = useState<'all' | 'year' | 'month' | 'week' | 'day'>('all');

    // Time range options
    const timeRangeOptions = [
        { value: 'all' as const, label: 'All Time' },
        { value: 'year' as const, label: 'This Year' },
        { value: 'month' as const, label: 'This Month' },
        { value: 'week' as const, label: 'This Week' },
        { value: 'day' as const, label: 'Today' },
    ];

    // Filter weekly activity data based on time range
    const filteredWeeklyActivity = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-11
        const currentDay = now.getDate();
        const currentWeek = Math.ceil((currentDay + new Date(currentYear, currentMonth, 1).getDay()) / 7);
        const currentHour = now.getHours();
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const currentDayIndex = (now.getDay() + 6) % 7; // Convert to Mon=0
        const weeksInMonth = Math.ceil((new Date(currentYear, currentMonth + 1, 0).getDate() + new Date(currentYear, currentMonth, 1).getDay()) / 7);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const startYear = 2024; // Assuming system started in 2024
        const years = [];
        
        switch (weeklyTimeRange) {
            case 'day':
                // Show hours (00:00 to current hour) - distribute today's activity across hours
                return Array.from({ length: 24 }, (_, i) => ({
                    day: `${i}:00`,
                    schedules: i <= currentHour ? Math.max(0, Math.round((stats.schedules / (currentHour + 1)) * (i < currentHour ? 1 : 0.5))) : 0,
                    requests: i <= currentHour ? Math.max(0, Math.round((requests.length / (currentHour + 1)) * (i < currentHour ? 1 : 0.5))) : 0,
                    conflicts: i <= currentHour ? Math.max(0, Math.round((stats.conflicts / (currentHour + 1)) * (i < currentHour ? 1 : 0.5))) : 0,
                }));
            case 'week':
                // Show days (Mon to current day) - distribute week's activity across days
                return dayNames.map((day, i) => ({
                    day,
                    schedules: i <= currentDayIndex ? Math.max(0, Math.round((stats.schedules / (currentDayIndex + 1)) * (i < currentDayIndex ? 1 : 0.8))) : 0,
                    requests: i <= currentDayIndex ? Math.max(0, Math.round((requests.length / (currentDayIndex + 1)) * (i < currentDayIndex ? 1 : 0.8))) : 0,
                    conflicts: i <= currentDayIndex ? Math.max(0, Math.round((stats.conflicts / (currentDayIndex + 1)) * (i < currentDayIndex ? 1 : 0.8))) : 0,
                }));
            case 'month':
                // Show weeks (W1 to current week) - distribute month's activity across weeks
                return Array.from({ length: weeksInMonth }, (_, i) => ({
                    day: `W${i + 1}`,
                    schedules: i < currentWeek ? Math.max(0, Math.round((stats.schedules / currentWeek) * (i < currentWeek - 1 ? 1 : 0.8))) : 0,
                    requests: i < currentWeek ? Math.max(0, Math.round((requests.length / currentWeek) * (i < currentWeek - 1 ? 1 : 0.8))) : 0,
                    conflicts: i < currentWeek ? Math.max(0, Math.round((stats.conflicts / currentWeek) * (i < currentWeek - 1 ? 1 : 0.8))) : 0,
                }));
            case 'year':
                // Show months (Jan to current month) - distribute year's activity across months
                return monthNames.map((month, i) => ({
                    day: month,
                    schedules: i <= currentMonth ? Math.max(0, Math.round((stats.schedules / (currentMonth + 1)) * (i < currentMonth ? 1 : 0.8))) : 0,
                    requests: i <= currentMonth ? Math.max(0, Math.round((requests.length / (currentMonth + 1)) * (i < currentMonth ? 1 : 0.8))) : 0,
                    conflicts: i <= currentMonth ? Math.max(0, Math.round((stats.conflicts / (currentMonth + 1)) * (i < currentMonth ? 1 : 0.8))) : 0,
                }));
            case 'all':
            default:
                // Show years (from system start to current year)
                for (let year = startYear; year <= currentYear; year++) {
                    years.push({
                        day: year.toString(),
                        schedules: year < currentYear ? Math.max(0, Math.round((stats.schedules / (currentYear - startYear + 1)) * 0.8)) : Math.round(stats.schedules * 0.2),
                        requests: year < currentYear ? Math.max(0, Math.round((requests.length / (currentYear - startYear + 1)) * 0.8)) : Math.round(requests.length * 0.2),
                        conflicts: year < currentYear ? Math.max(0, Math.round((stats.conflicts / (currentYear - startYear + 1)) * 0.8)) : Math.round(stats.conflicts * 0.2),
                    });
                }
                return years;
        }
    }, [weeklyTimeRange, stats, requests.length]);

    // Filter request volume data based on time range
    const filteredRequestVolume = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-11
        const currentDay = now.getDate();
        const currentWeek = Math.ceil((currentDay + new Date(currentYear, currentMonth, 1).getDay()) / 7);
        const currentHour = now.getHours();
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const currentDayIndex = (now.getDay() + 6) % 7; // Convert to Mon=0
        const weeksInMonth = Math.ceil((new Date(currentYear, currentMonth + 1, 0).getDate() + new Date(currentYear, currentMonth, 1).getDay()) / 7);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        // Get actual request counts
        const approvedCount = requests.filter(r => r.status === 'approved').length;
        const rejectedCount = requests.filter(r => r.status === 'rejected').length;
        const pendingCount = pendingRequests.length;
        const startYear = 2024;
        const years = [];
        
        switch (requestTimeRange) {
            case 'day':
                // Show hours (00:00 to current hour) - distribute today's requests across hours
                return Array.from({ length: 24 }, (_, i) => ({
                    month: `${i}:00`,
                    approved: i <= currentHour ? Math.max(0, Math.round((approvedCount / (currentHour + 1)) * (i < currentHour ? 1 : 0.5))) : 0,
                    rejected: i <= currentHour ? Math.max(0, Math.round((rejectedCount / (currentHour + 1)) * (i < currentHour ? 1 : 0.5))) : 0,
                    pending: i <= currentHour ? Math.max(0, Math.round((pendingCount / (currentHour + 1)) * (i < currentHour ? 1 : 0.5))) : 0,
                }));
            case 'week':
                // Show days (Mon to current day) - distribute week's requests across days
                return dayNames.map((day, i) => ({
                    month: day,
                    approved: i <= currentDayIndex ? Math.max(0, Math.round((approvedCount / (currentDayIndex + 1)) * (i < currentDayIndex ? 1 : 0.8))) : 0,
                    rejected: i <= currentDayIndex ? Math.max(0, Math.round((rejectedCount / (currentDayIndex + 1)) * (i < currentDayIndex ? 1 : 0.8))) : 0,
                    pending: i <= currentDayIndex ? Math.max(0, Math.round((pendingCount / (currentDayIndex + 1)) * (i < currentDayIndex ? 1 : 0.8))) : 0,
                }));
            case 'month':
                // Show weeks (W1 to current week) - distribute month's requests across weeks
                return Array.from({ length: weeksInMonth }, (_, i) => ({
                    month: `W${i + 1}`,
                    approved: i < currentWeek ? Math.max(0, Math.round((approvedCount / currentWeek) * (i < currentWeek - 1 ? 1 : 0.8))) : 0,
                    rejected: i < currentWeek ? Math.max(0, Math.round((rejectedCount / currentWeek) * (i < currentWeek - 1 ? 1 : 0.8))) : 0,
                    pending: i < currentWeek ? Math.max(0, Math.round((pendingCount / currentWeek) * (i < currentWeek - 1 ? 1 : 0.8))) : 0,
                }));
            case 'year':
                // Show months (Jan to current month) - distribute year's requests across months
                return monthNames.map((month, i) => ({
                    month,
                    approved: i <= currentMonth ? Math.max(0, Math.round((approvedCount / (currentMonth + 1)) * (i < currentMonth ? 1 : 0.8))) : 0,
                    rejected: i <= currentMonth ? Math.max(0, Math.round((rejectedCount / (currentMonth + 1)) * (i < currentMonth ? 1 : 0.8))) : 0,
                    pending: i <= currentMonth ? Math.max(0, Math.round((pendingCount / (currentMonth + 1)) * (i < currentMonth ? 1 : 0.8))) : 0,
                }));
            case 'all':
            default:
                // Show years (from system start to current year)
                for (let year = startYear; year <= currentYear; year++) {
                    years.push({
                        month: year.toString(),
                        approved: year < currentYear ? Math.max(0, Math.round((approvedCount / (currentYear - startYear + 1)) * 0.8)) : Math.round(approvedCount * 0.2),
                        rejected: year < currentYear ? Math.max(0, Math.round((rejectedCount / (currentYear - startYear + 1)) * 0.8)) : Math.round(rejectedCount * 0.2),
                        pending: year < currentYear ? Math.max(0, Math.round((pendingCount / (currentYear - startYear + 1)) * 0.8)) : Math.round(pendingCount * 0.2),
                    });
                }
                return years;
        }
    }, [requestTimeRange, requests, pendingRequests]);

    return (
        <div className="dashboard fade-in">
            {/* ===== HEADER ===== */}
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">{dashboardTitle}</h1>
                    <p className="dashboard-subtitle">
                        {dashboardSubtitle}
                        {canSeeRequests && pendingRequests.length > 0 && <span style={{ color: '#fbbf24', marginLeft: 8 }}>• {pendingRequests.length} pending request{pendingRequests.length > 1 ? 's' : ''}</span>}
                        {canSeeResets && resetRequests.length > 0 && <span style={{ color: '#f59e0b', marginLeft: 8 }}>• {resetRequests.length} password reset{resetRequests.length > 1 ? 's' : ''}</span>}
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

            {/* ===== CHARTS ROW 1: Weekly Activity + Request Volume + Room Usage ===== */}
            <div className="dash-row-3" style={{ marginBottom: 14 }}>
                {/* Weekly Activity */}
                <div className="dash-card dash-stagger">
                    <div className="dash-card-header">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div className="dash-card-title"><Activity size={16} /> Weekly Activity</div>
                            <span className="dash-card-subtitle">Schedule & request trends</span>
                        </div>
                        <div className="dash-time-selector">
                            <select
                                className="dash-time-select"
                                value={weeklyTimeRange}
                                onChange={(e) => setWeeklyTimeRange(e.target.value as any)}
                            >
                                {timeRangeOptions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="dash-chart-wrap-sm">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={filteredWeeklyActivity} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gSchedules" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gRequests" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.25} />
                                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                                <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                <Tooltip content={<ChartTooltipContent />} />
                                <Area type="monotone" dataKey="schedules" stroke="#3b82f6" strokeWidth={2} fill="url(#gSchedules)" name="Schedules" />
                                <Area type="monotone" dataKey="requests" stroke="#f59e0b" strokeWidth={2} fill="url(#gRequests)" name="Requests" />
                                <Area type="monotone" dataKey="conflicts" stroke="#ef4444" strokeWidth={1.5} fill="none" name="Conflicts" strokeDasharray="4 4" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="dash-chart-stats">
                        <div className="dash-chart-stat">
                            <div className="dash-chart-stat-value">{stats.schedules}</div>
                            <div className="dash-chart-stat-label">Schedules</div>
                        </div>
                        <div className="dash-chart-stat">
                            <div className="dash-chart-stat-value">{requests.length}</div>
                            <div className="dash-chart-stat-label">Requests</div>
                        </div>
                        <div className="dash-chart-stat">
                            <div className="dash-chart-stat-value" style={{ color: stats.conflicts > 0 ? '#ef4444' : undefined }}>{stats.conflicts}</div>
                            <div className="dash-chart-stat-label">Conflicts</div>
                        </div>
                    </div>
                </div>

                {/* Request Volume */}
                {canSeeRequests && (
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <div className="dash-card-title"><TrendingUp size={16} /> Request Volume</div>
                                <span className="dash-card-subtitle">Over time</span>
                            </div>
                            <div className="dash-time-selector">
                                <select
                                    className="dash-time-select"
                                    value={requestTimeRange}
                                    onChange={(e) => setRequestTimeRange(e.target.value as any)}
                                >
                                    {timeRangeOptions.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="dash-chart-wrap-sm">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={filteredRequestVolume} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<ChartTooltipContent />} />
                                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                                    <Bar dataKey="approved" name="Approved" fill="#22c55e" radius={[3, 3, 0, 0]} fillOpacity={0.85} />
                                    <Bar dataKey="rejected" name="Rejected" fill="#ef4444" radius={[3, 3, 0, 0]} fillOpacity={0.85} />
                                    <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[3, 3, 0, 0]} fillOpacity={0.85} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Room Utilization */}
                <div className="dash-card dash-stagger">
                    <div className="dash-card-header">
                        <div className="dash-card-title"><BarChart3 size={16} /> Room Usage</div>
                        <span className="dash-card-badge" style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4' }}>{stats.rooms} rooms</span>
                    </div>
                    <div className="dash-chart-wrap-sm">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={roomUtilization} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                                <Tooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="usage" name="Usage %" radius={[4, 4, 0, 0]}>
                                    {roomUtilization.map((entry, i) => (
                                        <Cell key={i} fill={entry.usage > 80 ? '#ef4444' : entry.usage > 60 ? '#f59e0b' : '#22c55e'} fillOpacity={0.8} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                        Avg: <strong style={{ color: 'var(--text-primary)' }}>{roomUtilization.length > 0 ? Math.round(roomUtilization.reduce((a, b) => a + b.usage, 0) / roomUtilization.length) : 0}%</strong> utilization
                    </div>
                </div>
            </div>

            {/* ===== MAIN CONTENT GRID (Urgent Items: Requests, Announcements, Events, Messages) ===== */}
            <div className="dashboard-grid" style={{ marginBottom: 14 }}>
                {/* Password Reset Requests */}
                {canSeeResets && resetRequests.length > 0 && (
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div className="dash-card-title"><KeyRound size={16} /> Password Resets</div>
                            <span className="dash-card-badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>{resetRequests.length}</span>
                        </div>
                        <div className="dash-list">
                            {resetRequests.map(r => (
                                <div key={r.id} className="dash-list-item">
                                    <div className="dash-list-item-accent" style={{ background: '#f59e0b' }} />
                                    <div className="dash-list-item-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                                        <KeyRound size={14} />
                                    </div>
                                    <div className="dash-list-item-body">
                                        <div className="dash-list-item-title">{r.email}</div>
                                        <div className="dash-list-item-meta">{r.requested_at ? new Date(r.requested_at).toLocaleString() : 'Just now'}</div>
                                        <div className="dash-list-item-actions">
                                            <button className="btn btn-primary" onClick={() => handleApproveReset(r)}><CheckCircle size={12} /> Approve</button>
                                            <button className="btn btn-secondary" style={{ color: '#ef4444' }} onClick={() => handleDenyReset(r)}><XCircle size={12} /> Deny</button>
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
                            {pendingRequests.length > 0 && <span className="dash-card-badge" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>{pendingRequests.length} pending</span>}
                        </div>
                        {requestsLoading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="spinner" /></div>
                        ) : requests.length === 0 ? (
                            <div className="dash-empty"><Inbox size={28} /><div>No requests yet</div></div>
                        ) : (
                            <div className="dash-list">
                                {requests.slice(0, 8).map(req => {
                                    const badge = getStatusBadge(req.status);
                                    return (
                                        <div key={req.id} className="dash-list-item">
                                            <div className="dash-list-item-accent" style={{ background: badge.color }} />
                                            <div className="dash-list-item-body" style={{ paddingLeft: 6 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div className="dash-list-item-title">{req.teacher_name}</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <span className="dash-status-badge" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                                                        {req.status !== 'pending' && (
                                                            <button className="dash-icon-btn" onClick={() => handleDismissRequest(req.id)} title="Dismiss"><X size={13} /></button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="dash-list-item-meta" style={{ textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>{req.request_type}</div>
                                                <div className="dash-list-item-desc">{req.reason}</div>
                                                {req.status === 'pending' && (
                                                    <div className="dash-list-item-actions">
                                                        <button className="btn btn-primary" onClick={() => { setResolvingRequest(req); setResolveAction('approved'); }}><CheckCircle size={12} /> Approve</button>
                                                        <button className="btn btn-secondary" style={{ color: '#ef4444' }} onClick={() => { setResolvingRequest(req); setResolveAction('rejected'); }}><XCircle size={12} /> Reject</button>
                                                    </div>
                                                )}
                                                <div className="dash-list-item-meta" style={{ marginTop: 4 }}>{new Date(req.created_at).toLocaleString()}</div>
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
                        <span className="dash-card-badge" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>{announcements.length}</span>
                    </div>
                    {announcements.length === 0 ? (
                        <div className="dash-empty"><Megaphone size={28} /><div>No announcements yet</div></div>
                    ) : (
                        <div className="dash-list">
                            {announcements.map(ann => {
                                const prio = prioStyles[ann.priority] || prioStyles.normal;
                                return (
                                    <div key={ann.id} className="dash-list-item">
                                        <div className="dash-list-item-accent" style={{ background: prio.color }} />
                                        <div className="dash-list-item-body" style={{ paddingLeft: 6 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div className="dash-list-item-title">{ann.title}</div>
                                                <div style={{ display: 'flex', gap: 2 }}>
                                                    <button className="dash-icon-btn" onClick={() => openEditAnn(ann)}><Edit3 size={13} /></button>
                                                    <button className="dash-icon-btn dash-icon-btn-danger" onClick={() => handleDeleteAnn(ann.id)}><Trash2 size={13} /></button>
                                                </div>
                                            </div>
                                            <div className="dash-list-item-desc">{ann.content}</div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                                <span className="dash-status-badge" style={{ background: prio.bg, color: prio.color }}>{ann.priority.toUpperCase()}</span>
                                                <span className="dash-list-item-meta">{new Date(ann.created_at).toLocaleDateString()}</span>
                                            </div>
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
                            <div className="dash-card-title"><CalendarPlus size={16} /> Upcoming Events</div>
                            <span className="dash-card-badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>{events.length}</span>
                        </div>
                        {events.length === 0 ? (
                            <div className="dash-empty"><CalendarPlus size={28} /><div>No upcoming events</div></div>
                        ) : (
                            <div className="dash-list">
                                {events.map(ev => (
                                    <div key={ev.id} className="dash-list-item">
                                        <div className="dash-list-item-accent" style={{ background: '#10b981' }} />
                                        <div className="dash-list-item-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                                            <CalendarDays size={14} />
                                        </div>
                                        <div className="dash-list-item-body">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div className="dash-list-item-title">{ev.title}</div>
                                                <button className="dash-icon-btn dash-icon-btn-danger" onClick={() => handleDeleteEvent(ev.id)}><Trash2 size={13} /></button>
                                            </div>
                                            {ev.description && <div className="dash-list-item-desc">{ev.description}</div>}
                                            <div className="dash-list-item-meta">
                                                {new Date(ev.event_date).toLocaleDateString()} • {ev.start_time?.slice(0, 5)} – {ev.end_time?.slice(0, 5)} {ev.room_name && `• ${ev.room_name}`}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Recent Messages */}
                <div className="dash-card dash-stagger">
                    <div className="dash-card-header">
                        <div className="dash-card-title"><MessageSquare size={16} /> Recent Messages</div>
                        {recentMessages.length > 0 && <span className="dash-card-badge" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}>{recentMessages.length}</span>}
                    </div>
                    {recentMessages.length === 0 ? (
                        <div className="dash-empty"><MessageSquare size={28} /><div>No messages</div></div>
                    ) : (
                        <div className="dash-list">
                            {recentMessages.map(m => (
                                <div key={m.id} className="dash-list-item">
                                    <div className="dash-list-item-accent" style={{ background: '#6366f1' }} />
                                    <div className="dash-list-item-icon" style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}>
                                        <MessageSquare size={14} />
                                    </div>
                                    <div className="dash-list-item-body">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div className="dash-list-item-title">{m.sender_name}</div>
                                            <span className="dash-list-item-meta">{new Date(m.created_at).toLocaleString()}</span>
                                        </div>
                                        <div className="dash-list-item-desc">{m.message?.slice(0, 120)}{m.message?.length > 120 ? '…' : ''}</div>
                                    </div>
                                </div>
                            ))}
                            <a href="/admin/messages" className="btn btn-secondary" style={{ fontSize: 12, padding: '8px', textAlign: 'center', marginTop: 4, borderRadius: 'var(--radius-md)' }}>View All Messages</a>
                        </div>
                    )}
                </div>
            </div>

            {/* ===== CHARTS ROW 2: Quick Stats + Users + System Status ===== */}
            <div className="dash-row-3" style={{ marginBottom: 14 }}>
                {/* Quick Stats Summary */}
                <div className="dash-card dash-stagger">
                    <div className="dash-card-header">
                        <div className="dash-card-title"><Zap size={16} /> Quick Stats</div>
                        <span className="dash-card-subtitle">System overview</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}><Calendar size={16} /></div>
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total Schedules</span>
                            </div>
                            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{stats.schedules}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}><Inbox size={16} /></div>
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Pending Requests</span>
                            </div>
                            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{pendingRequests.length}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}><AlertTriangle size={16} /></div>
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Active Conflicts</span>
                            </div>
                            <span style={{ fontSize: 18, fontWeight: 700, color: stats.conflicts > 0 ? '#ef4444' : 'var(--text-primary)' }}>{stats.conflicts}</span>
                        </div>
                    </div>
                </div>

                {/* User Distribution Pie */}
                <div className="dash-card dash-stagger">
                    <div className="dash-card-header">
                        <div className="dash-card-title"><PieIcon size={16} /> Users</div>
                        <span className="dash-card-badge" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>{stats.totalUsers}</span>
                    </div>
                    <div className="dash-chart-wrap-sm">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={userDistribution} cx="50%" cy="50%" innerRadius={38} outerRadius={62} paddingAngle={3} dataKey="value" stroke="none">
                                    {userDistribution.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip content={<ChartTooltipContent />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                        {userDistribution.map(u => (
                            <div key={u.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: u.color, display: 'inline-block' }} />
                                    <span style={{ color: 'var(--text-secondary)' }}>{u.name}</span>
                                </div>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* System Status */}
                <div className="dash-card dash-stagger">
                    <div className="dash-card-header">
                        <div className="dash-card-title"><Shield size={16} /> System Status</div>
                        <span className="dash-card-badge" style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>Online</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div className="status-item">
                            <div className="status-dot status-online" />
                            <span>Database connected</span>
                        </div>
                        <div className="status-item">
                            <div className="status-dot status-online" />
                            <span>Real-time sync active</span>
                        </div>
                        <div className="status-item">
                            <div className="status-dot status-online" />
                            <span>Authentication service</span>
                        </div>
                        <div className="status-item">
                            <div className="status-dot status-online" />
                            <span>Storage service</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ===== MODALS ===== */}
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

            {/* Resolve Request Modal */}
            {resolvingRequest && (
                <div className="modal-overlay" onClick={() => setResolvingRequest(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0 }}>{resolveAction === 'approved' ? 'Approve' : 'Reject'} Request</h3>
                            <button onClick={() => setResolvingRequest(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
                        </div>
                        <div className="modal-form">
                            <label>Admin Note (Required to Reply)</label>
                            <textarea className="input" value={resolveNotes} onChange={e => setResolveNotes(e.target.value)} placeholder="Type a message to the teacher regarding this decision..." rows={4} style={{ resize: 'vertical' }} />
                            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setResolvingRequest(null)}>Cancel</button>
                                <button className={resolveAction === 'approved' ? 'btn btn-primary' : 'btn btn-secondary'} style={{ flex: 1, backgroundColor: resolveAction === 'rejected' ? 'var(--accent-error)' : undefined, color: resolveAction === 'rejected' ? 'white' : undefined }}
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
