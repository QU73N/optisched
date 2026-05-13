import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase, supabaseAdmin } from '../../lib/supabase';
import { POWER_ADMIN_ROLES, hasAnyRole } from '../../types/database';
import type {
    ChangeRequest, Announcement, CustomEvent, ResetRequest,
    ConflictsTrend, DashboardStats, DashboardDeltas, DashboardRoom
} from '../../types/dashboard';
import { DASHBOARD_CONFIG } from '../../config/dashboard';
import {
    Activity, CalendarDays, CalendarPlus, CheckCircle, Clock, Inbox, Megaphone, TrendingUp, XCircle, AlertTriangle, Edit3, Trash2, X, Loader2, Users, BookOpen, LayoutDashboard, Shield, KeyRound
} from 'lucide-react';
import {
    LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { ChartTooltip } from '../../components/ChartTooltip';
import { ConfirmDialog } from '../../components/states/ConfirmDialog';
import './Dashboard.css';

const AdminDashboard: React.FC = () => {
    const { profile, roles } = useAuth();
    const { showToast } = useToast();
    
    // Confirmation dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', onConfirm: () => {} });
    const [stats, setStats] = useState<DashboardStats>({ totalUsers: 0, teachers: 0, students: 0, schedules: 0, conflicts: 0, rooms: 0 });
    // Deltas: change vs ~7 days ago (positive = growth/increase)
    const [deltas, setDeltas] = useState<DashboardDeltas>({ schedules: 0, conflicts: 0, requests: 0 });
    // Chart datasets, all derived from real data
    const [conflictsTrend, setConflictsTrend] = useState<ConflictsTrend[]>([]);
    
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
    const [annPriority, setAnnPriority] = useState<'normal' | 'important'>('normal');
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
    const [evEnd, setEvEnd] = useState('10:00'); // Changed from '09:00' to '10:00'
    const [evRoom, setEvRoom] = useState('');
    const [rooms, setRooms] = useState<DashboardRoom[]>([]);
    const [postingEvent, setPostingEvent] = useState(false);
    const [editingEvent, setEditingEvent] = useState<CustomEvent | null>(null);

    // Password resets
    const [resetRequests, setResetRequests] = useState<ResetRequest[]>([]);

    const fetchAll = () => {
        fetchStats(); fetchRequests(); fetchAnnouncements();
        fetchEvents(); fetchSections(); fetchRooms();
        fetchResetRequests();
    };

    const fetchStats = async () => {
        try {
            const sevenDaysAgo = new Date(Date.now() - DASHBOARD_CONFIG.TIME.DAYS_7_MS).toISOString();
            const fourteenDaysAgo = new Date(Date.now() - DASHBOARD_CONFIG.TIME.DAYS_14_MS).toISOString();
            
            console.log('[AdminDashboard] Fetching stats...');
            
            // Fetch all data needed for stats
            const [profiles, schedules, conflicts, roomsR, schedulesRecent, conflictsRecent, requestsRecent, scanResults14Days] = await Promise.all([
                supabase.from('profiles').select('role'),
                supabase.from('schedules').select('id', { count: 'exact' }),
                // Count conflicts only for published schedules
                supabase.from('conflicts').select('id, schedule_a_id, schedule_b_id').eq('is_resolved', false),
                supabase.from('rooms').select('id', { count: 'exact' }),
                supabase.from('schedules').select('id', { count: 'exact' }).gte('created_at', sevenDaysAgo),
                supabase.from('conflicts').select('id', { count: 'exact' }).gte('created_at', sevenDaysAgo),
                supabase.from('schedule_change_requests').select('id', { count: 'exact' }).gte('created_at', sevenDaysAgo),
                // 14-day scan results from scan_results table (from ConflictsAlerts scans)
                supabase.from('scan_results').select('*').gte('scanned_at', fourteenDaysAgo).order('scanned_at', { ascending: true }),
            ]);
            
            console.log('[AdminDashboard] Unresolved conflicts fetched:', conflicts.data?.length || 0);
            console.log('[AdminDashboard] Conflict sample:', conflicts.data?.slice(0, 3));
            
            // Filter conflicts to only those associated with published schedules
            let publishedConflictCount = 0;
            if (conflicts.data && conflicts.data.length > 0) {
                const conflictScheduleIds = new Set<string>();
                conflicts.data.forEach((c: { schedule_a_id?: string; schedule_b_id?: string }) => {
                    if (c.schedule_a_id) conflictScheduleIds.add(c.schedule_a_id);
                    if (c.schedule_b_id) conflictScheduleIds.add(c.schedule_b_id);
                });
                
                console.log('[AdminDashboard] Unique schedule IDs in conflicts:', conflictScheduleIds.size);
                console.log('[AdminDashboard] Schedule IDs:', Array.from(conflictScheduleIds).slice(0, 10));
                
                if (conflictScheduleIds.size > 0) {
                    const { data: publishedSchedules, error: pubError } = await supabase
                        .from('schedules')
                        .select('id, status')
                        .in('id', Array.from(conflictScheduleIds));
                    
                    if (pubError) {
                        console.error('[AdminDashboard] Error fetching published schedules:', pubError);
                    }
                    
                    console.log('[AdminDashboard] All schedules found:', publishedSchedules?.length || 0);
                    console.log('[AdminDashboard] Schedule statuses:', publishedSchedules?.map((s: { id: string; status: string }) => ({ id: s.id.slice(0, 8), status: s.status })));
                    
                    // Count by status
                    const statusCounts: Record<string, number> = {};
                    publishedSchedules?.forEach((s: { status: string }) => {
                        statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
                    });
                    console.log('[AdminDashboard] Status breakdown:', statusCounts);
                    
                    // Also check for current published version set
                    const { data: activeVersionSet, error: versionError } = await supabase
                        .from('schedule_version_sets')
                        .select('id, is_active')
                        .eq('is_active', true)
                        .maybeSingle();
                    
                    if (versionError) {
                        console.error('[AdminDashboard] Error fetching active version set:', versionError);
                    }
                    console.log('[AdminDashboard] Active version set:', activeVersionSet);
                    
                    if (activeVersionSet) {
                        const { data: versionSetItems } = await supabase
                            .from('schedule_version_set_items')
                            .select('schedule_id')
                            .eq('version_set_id', activeVersionSet.id);
                        
                        const activeScheduleIds = new Set(versionSetItems?.map((i: { schedule_id: string }) => i.schedule_id) || []);
                        console.log('[AdminDashboard] Schedules in active version set:', activeScheduleIds.size);
                        
                        publishedConflictCount = conflicts.data.filter((c: { schedule_a_id?: string; schedule_b_id?: string }) => 
                            // Count conflicts where BOTH schedules are in the current active version set
                            c.schedule_a_id && c.schedule_b_id && 
                            activeScheduleIds.has(c.schedule_a_id) && 
                            activeScheduleIds.has(c.schedule_b_id)
                        ).length;
                        
                        console.log('[AdminDashboard] Conflicts in active version set:', publishedConflictCount);
                    } else {
                        // Fallback to status-based filtering if no active version set
                        const publishedIds = new Set(publishedSchedules?.filter((s: { status: string }) => s.status === 'published').map((s: { id: string }) => s.id) || []);
                        const draftIds = new Set(publishedSchedules?.filter((s: { status: string }) => s.status === 'draft').map((s: { id: string }) => s.id) || []);
                        
                        // Try: conflicts where at least one schedule is published
                        const atLeastOnePublished = conflicts.data.filter((c: { schedule_a_id?: string; schedule_b_id?: string }) => 
                            (c.schedule_a_id && publishedIds.has(c.schedule_a_id)) || 
                            (c.schedule_b_id && publishedIds.has(c.schedule_b_id))
                        ).length;
                        
                        // Try: conflicts where both are published
                        const bothPublished = conflicts.data.filter((c: { schedule_a_id?: string; schedule_b_id?: string }) => 
                            c.schedule_a_id && c.schedule_b_id && 
                            publishedIds.has(c.schedule_a_id) && 
                            publishedIds.has(c.schedule_b_id)
                        ).length;
                        
                        // Try: conflicts where one is published and one is draft
                        const publishedWithDraft = conflicts.data.filter((c: { schedule_a_id?: string; schedule_b_id?: string }) => {
                            const aPublished = c.schedule_a_id && publishedIds.has(c.schedule_a_id);
                            const bPublished = c.schedule_b_id && publishedIds.has(c.schedule_b_id);
                            const aDraft = c.schedule_a_id && draftIds.has(c.schedule_a_id);
                            const bDraft = c.schedule_b_id && draftIds.has(c.schedule_b_id);
                            return (aPublished && bDraft) || (aDraft && bPublished);
                        }).length;
                        
                        console.log('[AdminDashboard] At least one published:', atLeastOnePublished);
                        console.log('[AdminDashboard] Both published:', bothPublished);
                        console.log('[AdminDashboard] Published with draft:', publishedWithDraft);
                        
                        // Try using scan_results table for current conflict count
                        // The latest scan result should reflect the current published version's conflicts
                        const { data: latestScan } = await supabase
                            .from('scan_results')
                            .select('hard_violations_count, scanned_at')
                            .order('scanned_at', { ascending: false })
                            .limit(1)
                            .maybeSingle();
                        
                        console.log('[AdminDashboard] Latest scan result:', latestScan);
                        
                        if (latestScan && latestScan.hard_violations_count !== undefined) {
                            publishedConflictCount = latestScan.hard_violations_count;
                            console.log('[AdminDashboard] Using latest scan count:', publishedConflictCount);
                        } else {
                            // Fallback to at least one published if no scan results
                            publishedConflictCount = atLeastOnePublished;
                            console.log('[AdminDashboard] No scan results, using at least one published:', publishedConflictCount);
                        }
                    }
                }
            }
            
            const all = profiles.data || [];
            const totalUsers = all.length;
            
            setStats({
                totalUsers,
                teachers: all.filter((p: { role: string }) => p.role === 'teacher').length,
                students: all.filter((p: { role: string }) => p.role === 'student').length,
                schedules: schedules.count || 0,
                conflicts: publishedConflictCount,
                rooms: roomsR.count || 0,
            });
            
            setDeltas({
                schedules: schedulesRecent.count || 0,
                conflicts: conflictsRecent.count || 0,
                requests: requestsRecent.count || 0,
            });
            
            console.log('[AdminDashboard] Stats updated:', { conflicts: publishedConflictCount });
            
            // Build 14-day conflicts trend from scan_results table (actual scan results from ConflictsAlerts)
            const trendMap: Record<string, number> = {};
            for (let i = DASHBOARD_CONFIG.CHART.CONFLICTS_TREND_DAYS - 1; i >= 0; i--) {
                const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
                const key = `${d.getMonth() + 1}/${d.getDate()}`;
                trendMap[key] = 0;
            }
            
            // Use scan results - each scan gives us the conflict count for that day
            (scanResults14Days.data || []).forEach((scan: { scanned_at?: string; hard_violations_count?: number }) => {
                if (!scan.scanned_at) return;
                const d = new Date(scan.scanned_at);
                const key = `${d.getMonth() + 1}/${d.getDate()}`;
                if (key in trendMap) {
                    // Use the conflict count from the scan
                    trendMap[key] = Math.max(trendMap[key], scan.hard_violations_count || 0);
                }
            });
            
            setConflictsTrend(Object.entries(trendMap).map(([date, count]) => ({ date, count })));
        } catch (error) {
            console.error('Error fetching stats:', error instanceof Error ? error.message : String(error));
        }
    };

    const fetchRequests = async () => {
        try {
            const recentList = await supabase.from('schedule_change_requests').select('*').order('created_at', { ascending: false }).limit(DASHBOARD_CONFIG.QUERY_LIMITS.REQUESTS);
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
            .on('postgres_changes', { event: '*', schema: 'public', table: 'password_reset_requests' }, () => fetchResetRequests())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conflicts' }, () => fetchStats())
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'schedules' }, () => fetchStats())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRequestAction = async (id: string, status: 'approved' | 'rejected', notes: string) => {
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
        const { error } = await supabase.from('schedule_change_requests').update({ status, admin_notes: notes }).eq('id', id);
        if (error) { setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'pending' } : r)); showToast({ title: 'Error', message: error.message, type: 'error' }); }
        setResolvingRequest(null);
        setResolveNotes('');
    };

    const handlePostAnnouncement = async () => {
        if (!annTitle.trim() || !annContent.trim()) return;
        setPostingAnn(true);
        try {
            if (editingAnn) {
                await supabase.from('announcements').update({
                    title: annPriority === 'important' ? `[${annPriority.toUpperCase()}] ${annTitle}` : annTitle,
                    content: annContent,
                    priority: annPriority,
                    target_section: annSection === 'All Sections' ? null : annSection
                }).eq('id', editingAnn.id);
            } else {
                await supabase.from('announcements').insert({
                    title: annPriority === 'important' ? `[${annPriority.toUpperCase()}] ${annTitle}` : annTitle,
                    content: annContent,
                    priority: annPriority,
                    target_section: annSection === 'All Sections' ? null : annSection
                });
            }
            setShowAnnModal(false); setAnnTitle(''); setAnnContent(''); setAnnPriority('normal'); setAnnSection('All Sections'); setEditingAnn(null);
            fetchAnnouncements();
            showToast({ title: 'Announcement saved', type: 'success' });
        } catch (e: unknown) { showToast({ title: 'Error', message: e instanceof Error ? e.message : String(e), type: 'error' }); }
        setPostingAnn(false);
    };

    const handleDeleteAnn = async (id: string) => {
        setConfirmDialog({
            open: true,
            title: 'Delete Announcement',
            message: 'Are you sure you want to delete this announcement?',
            onConfirm: async () => {
                try {
                    const { error } = await supabase.from('announcements').delete().eq('id', id);
                    if (error) throw error;
                    fetchAnnouncements();
                    showToast({ title: 'Announcement deleted', type: 'success' });
                } catch (e: unknown) {
                    showToast({ title: 'Failed to delete', message: e instanceof Error ? e.message : String(e), type: 'error' });
                }
            }
        });
    };

    const openEditAnn = (ann: Announcement) => {
        setEditingAnn(ann);
        const title = ann.title.replace(/^\[.*?\]\s*/, '');
        setAnnTitle(title);
        setAnnContent(ann.content);
        setAnnPriority(ann.priority);
        setAnnSection(ann.target_section || 'All Sections');
        setShowAnnModal(true);
    };

    const handleCreateEvent = async () => {
        if (!evTitle.trim()) return;
        setPostingEvent(true);
        try {
            if (editingEvent) {
                await supabase.from('custom_events').update({
                    title: evTitle, description: evDesc, event_date: evDate,
                    start_time: evStart, end_time: evEnd, room_name: evRoom
                }).eq('id', editingEvent.id);
            } else {
                await supabase.from('custom_events').insert({
                    title: evTitle, description: evDesc, event_date: evDate,
                    start_time: evStart, end_time: evEnd, room_name: evRoom
                });
            }
            setShowEventModal(false); setEvTitle(''); setEvDesc(''); setEvDate(new Date().toISOString().split('T')[0]); setEvStart('08:00'); setEvEnd('10:00'); setEvRoom(''); setEditingEvent(null);
            fetchEvents();
            showToast({ title: 'Event saved', type: 'success' });
        } catch (e: unknown) { showToast({ title: 'Error', message: e instanceof Error ? e.message : String(e), type: 'error' }); }
        setPostingEvent(false);
    };

    // Password reset handlers
    const [processingResetId, setProcessingResetId] = useState<string | null>(null);
    const [resetModal, setResetModal] = useState<{ open: boolean; req: ResetRequest | null; password: string }>({ open: false, req: null, password: '' });

    const handleResetApprove = async (req: ResetRequest) => {
        // Open the modal so admin can type the new password
        setResetModal({ open: true, req, password: '' });
    };

    const handleResetConfirm = async () => {
        const req = resetModal.req;
        if (!req || !resetModal.password.trim()) return;
        setProcessingResetId(req.id);
        try {
            if (!supabaseAdmin) {
                showToast({ title: 'Config error', message: 'Service role key not configured. Add VITE_SUPABASE_SERVICE_ROLE_KEY to your .env file.', type: 'error' });
                setProcessingResetId(null);
                return;
            }
            // Use admin client to set the password directly
            const { error } = await supabaseAdmin.auth.admin.updateUserById(req.user_id || '', { password: resetModal.password.trim() });
            if (error) throw error;

            await supabase.from('password_reset_requests').update({
                status: 'approved', resolved_at: new Date().toISOString(), resolved_by: profile?.id
            }).eq('id', req.id);

            fetchResetRequests();
            setResetModal({ open: false, req: null, password: '' });
            showToast({ title: 'Password updated', message: `Password has been set for ${req.email}`, type: 'success' });
        } catch {
            showToast({ title: 'Error', message: 'Failed to reset password. Check your service role key.', type: 'error' });
        }
        setProcessingResetId(null);
    };

    const handleResetDeny = async (req: ResetRequest) => {
        setProcessingResetId(req.id);
        await supabase.from('password_reset_requests').update({
            status: 'denied', resolved_at: new Date().toISOString(), resolved_by: profile?.id
        }).eq('id', req.id);
        fetchResetRequests();
        setProcessingResetId(null);
    };

    const handleDeleteEvent = async (id: string) => {
        setConfirmDialog({
            open: true,
            title: 'Delete Event',
            message: 'Are you sure you want to delete this event?',
            onConfirm: async () => {
                try {
                    const { error } = await supabase.from('custom_events').delete().eq('id', id);
                    if (error) throw error;
                    fetchEvents();
                    showToast({ title: 'Event deleted', type: 'success' });
                } catch (e: unknown) {
                    showToast({ title: 'Failed to delete', message: e instanceof Error ? e.message : String(e), type: 'error' });
                }
            }
        });
    };

    const openEditEvent = (ev: CustomEvent) => {
        setEditingEvent(ev);
        setEvTitle(ev.title);
        setEvDesc(ev.description || '');
        setEvDate(ev.event_date);
        setEvStart(ev.start_time || '08:00');
        setEvEnd(ev.end_time || '10:00');
        setEvRoom(ev.room_name || '');
        setShowEventModal(true);
    };

    const pendingRequests = requests.filter(r => r.status === 'pending');
    const prioStyles: Record<string, { bg: string; color: string }> = {
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
    const DashboardIcon = isPowerAdmin ? LayoutDashboard
        : isSystemAdmin ? Shield
            : isScheduleAdmin ? CheckCircle
                : isScheduleManager ? CalendarDays
                    : LayoutDashboard;

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

    return (
        <div className="dashboard fade-in">
            {/* ===== HEADER ===== */}
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title"><DashboardIcon size={20} /> {dashboardTitle}</h1>
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
                        <button className="btn btn-secondary" onClick={() => { setEditingEvent(null); setEvTitle(''); setEvDesc(''); setEvDate(new Date().toISOString().split('T')[0]); setEvStart('08:00'); setEvEnd('10:00'); setEvRoom(''); setShowEventModal(true); }}>
                            <CalendarPlus size={14} /> Add Event
                        </button>
                    )}
                </div>
            </div>

            {/* ===== TOP SECTION: 2-row × 4-column grid ===== */}
            <div className="dash-top-section">
                {/* KPI Cards Grid (columns 1-3, rows 1-2) */}
                <div className="dash-kpi-grid">
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

                {/* Right Panel (column 4, spans both rows) - Conflicts Last 14 Days */}
                <div className="dash-right-panel">
                    {canSeeScheduleStats && (
                        <div className="dash-card dash-stagger" style={{ height: '100%' }}>
                            <div className="dash-card-header">
                                <div className="dash-card-title"><Activity size={16} /> Conflicts Last 14 Days</div>
                                <span className="dash-card-badge" style={{ background: stats.conflicts > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)', color: stats.conflicts > 0 ? '#ef4444' : '#22c55e' }}>
                                    {stats.conflicts > 0 ? `${stats.conflicts} Open` : 'All clear'}
                                </span>
                            </div>
                            <div className="dash-chart-wrap" role="img" aria-label={`Conflicts trend, last 14 days, ${conflictsTrend.reduce((s, d) => s + d.count, 0)} total discovered`} style={{ flex: 1 }}>
                                <ResponsiveContainer width="100%" height={200}>
                                    <LineChart data={conflictsTrend} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={1} />
                                        <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Line type="monotone" dataKey="count" name="Conflicts discovered" stroke="#ef4444" strokeWidth={2} dot={{ r: 2.5, fill: '#ef4444' }} activeDot={{ r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="dash-meta-text" style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                                <span>New (7d): <strong className="dash-text-primary" style={{ color: deltas.conflicts > 0 ? '#ef4444' : undefined }}>{deltas.conflicts}</strong></span>
                                <span>Total (14d): <strong className="dash-text-primary">{conflictsTrend.reduce((s, d) => s + d.count, 0)}</strong></span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ===== BOTTOM SECTION: 2-row × 3-column grid ===== */}
            <div className="dash-bottom-section">
                {/* Row 1: Teacher Requests, Announcements, Events */}
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
                                                    {ann.priority !== 'normal' && (
                                                        <span className="dash-status-badge" style={{ background: prio.bg, color: prio.color, fontSize: 10 }}>{ann.priority.toUpperCase()}</span>
                                                    )}
                                                    <button className="dash-icon-btn" onClick={() => openEditAnn(ann)}><Edit3 size={13} /></button>
                                                    <button className="dash-icon-btn dash-icon-btn-danger" onClick={() => handleDeleteAnn(ann.id)}><Trash2 size={13} /></button>
                                                </div>
                                            </div>
                                            <div className="dash-list-item-desc">{ann.content}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Events */}
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
                                        <div className="dash-list-item-body dash-list-item-body--compact">
                                            <div className="dash-header-row">
                                                <div className="dash-list-item-title">{ev.title}</div>
                                                <div className="dash-icon-group">
                                                    <button className="dash-icon-btn" onClick={() => openEditEvent(ev)}><Edit3 size={13} /></button>
                                                    <button className="dash-icon-btn dash-icon-btn-danger" onClick={() => handleDeleteEvent(ev.id)}><Trash2 size={13} /></button>
                                                </div>
                                            </div>
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

                {/* Password Reset Requests */}
                {canSeeResets && (
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div className="dash-card-title"><KeyRound size={16} /> Password Resets</div>
                            {resetRequests.length > 0 && <span className="dash-card-badge dash-badge-warning">{resetRequests.length}</span>}
                        </div>
                        {resetRequests.length === 0 ? (
                            <div className="dash-empty"><KeyRound size={28} /><div>No pending resets</div></div>
                        ) : (
                            <div className="dash-list">
                                {resetRequests.slice(0, 5).map(req => (
                                    <div key={req.id} className="dash-list-item">
                                        <div className="dash-list-item-accent" style={{ background: '#f59e0b' }} />
                                        <div className="dash-list-item-body dash-list-item-body--compact">
                                            <div className="dash-header-row">
                                                <div className="dash-list-item-title">{req.email}</div>
                                                <span className="dash-status-badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>PENDING</span>
                                            </div>
                                            <div className="dash-list-item-meta">
                                                {req.requested_at ? new Date(req.requested_at).toLocaleString() : 'Just now'}
                                            </div>
                                            <div className="dash-list-item-actions">
                                                <button className="btn btn-primary" onClick={() => handleResetApprove(req)} disabled={processingResetId === req.id}>
                                                    {processingResetId === req.id ? <Loader2 size={12} className="spin" /> : <CheckCircle size={12} />} Reset
                                                </button>
                                                <button className="btn btn-secondary dash-btn-danger" onClick={() => handleResetDeny(req)} disabled={processingResetId === req.id}>
                                                    <XCircle size={12} /> Deny
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

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
                            <textarea className="input" value={annContent} onChange={e => setAnnContent(e.target.value)} placeholder="Announcement content..." rows={3} style={{ height: '120px', overflowY: 'auto', resize: 'none' }} />
                            <label>Priority</label>
                            <div className="dash-btn-group">
                                {(['Normal', 'Important'] as const).map(p => (
                                    <button key={p} className={`dash-btn-tab ${annPriority === p.toLowerCase() ? 'active' : ''}`}
                                        onClick={() => setAnnPriority(p.toLowerCase() as 'normal' | 'important')}>{p}</button>
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
                <div className="modal-overlay" onClick={() => { setShowEventModal(false); setEditingEvent(null); }}>
                    <div className="dash-modal-box" onClick={e => e.stopPropagation()}>
                        <div className="dash-modal-header">
                            <h3>{editingEvent ? 'Edit Event' : 'Create Event'}</h3>
                            <button className="dash-modal-close" onClick={() => { setShowEventModal(false); setEditingEvent(null); }}><X size={16} /></button>
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
                                {postingEvent ? <><Loader2 size={14} className="spin" /> Saving...</> : editingEvent ? 'Save Changes' : 'Create Event'}
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

            {/* Password Reset Modal */}
            {resetModal.open && resetModal.req && (
                <div className="modal-overlay" onClick={() => setResetModal({ open: false, req: null, password: '' })}>
                    <div className="dash-modal-box" onClick={e => e.stopPropagation()}>
                        <div className="dash-modal-header">
                            <h3>Set New Password</h3>
                            <button className="dash-modal-close" onClick={() => setResetModal({ open: false, req: null, password: '' })}><X size={16} /></button>
                        </div>
                        <div className="dash-modal-body">
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                                Set a new password for <strong>{resetModal.req.email}</strong>
                            </p>
                            <label>New Password</label>
                            <input
                                className="input"
                                type="text"
                                value={resetModal.password}
                                onChange={e => setResetModal(prev => ({ ...prev, password: e.target.value }))}
                                placeholder="Enter new password for user"
                                autoFocus
                            />
                            <div className="dash-header-row" style={{ gap: 10, marginTop: 16 }}>
                                <button className="dash-modal-btn" onClick={() => setResetModal({ open: false, req: null, password: '' })}>Cancel</button>
                                <button
                                    className="dash-modal-btn dash-modal-btn-primary"
                                    disabled={!resetModal.password.trim() || resetModal.password.trim().length < 6 || processingResetId === resetModal.req.id}
                                    onClick={handleResetConfirm}
                                >
                                    {processingResetId === resetModal.req.id ? <><Loader2 size={14} className="spin" /> Setting...</> : 'Set Password'}
                                </button>
                            </div>
                            {resetModal.password.trim().length > 0 && resetModal.password.trim().length < 6 && (
                                <p style={{ fontSize: 11, color: 'var(--accent-error, #ef4444)', marginTop: 8 }}>Password must be at least 6 characters</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog({ ...confirmDialog, open: false })}
                confirmVariant="danger"
            />

            {/* Modal + spin styles are now defined globally in index.css */}
        </div>
    );
};

export default AdminDashboard;
