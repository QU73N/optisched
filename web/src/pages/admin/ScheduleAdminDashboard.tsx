// ScheduleAdminDashboard - approval and review focus.
// Shows approval queue, change requests, conflicts in submitted/published
// schedules, room load. No user management or system rules.

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
    CheckCircle, XCircle, Clock, AlertTriangle, CalendarDays,
    Inbox, ArrowRightLeft, Loader2, TrendingUp, BarChart3
} from 'lucide-react';
import {
    XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell
} from 'recharts';
import ChartTooltip from '../../components/ChartTooltip';
import { DASHBOARD_CONFIG } from '../../config/dashboard';
import './Dashboard.css';

interface PendingScheduleRow {
    id: string;
    submitted_at: string | null;
    section_id: string | null;
    section?: { name: string } | null;
}
interface ChangeRequestRow {
    id: string;
    teacher_name: string;
    request_type: string;
    reason: string;
    created_at: string;
    status: string;
}
interface ConflictBucket { date: string; count: number; }
interface RoomLoad { name: string; count: number; }

const ScheduleAdminDashboard: React.FC = () => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);

    const [pendingApprovals, setPendingApprovals] = useState<PendingScheduleRow[]>([]);
    const [publishedCount, setPublishedCount] = useState(0);
    const [openConflicts, setOpenConflicts] = useState(0);
    const [pendingChangeRequests, setPendingChangeRequests] = useState<ChangeRequestRow[]>([]);
    const [funnel, setFunnel] = useState({ submitted: 0, approved: 0, rejected: 0 });
    const [conflictsTrend, setConflictsTrend] = useState<ConflictBucket[]>([]);
    const [roomLoad, setRoomLoad] = useState<RoomLoad[]>([]);

    useEffect(() => {
        const run = async () => {
            try {
                // 1. pending approvals (submitted, not yet approved/rejected)
                const { data: pending } = await supabase
                    .from('schedules')
                    .select('id, submitted_at, section_id, section:sections(name)')
                    .eq('status', 'submitted')
                    .order('submitted_at', { ascending: true })
                    .limit(20);
                setPendingApprovals((pending as unknown as PendingScheduleRow[]) || []);

                // 2. published count (this term)
                const { count: pubCount } = await supabase
                    .from('schedules')
                    .select('id', { count: 'exact', head: true })
                    .eq('status', 'published');
                setPublishedCount(pubCount || 0);

                // 3. open conflicts on submitted/published schedules
                const { data: conflicts } = await supabase
                    .from('conflicts')
                    .select('id, created_at, schedule_a:schedules!conflicts_schedule_a_id_fkey(status)')
                    .eq('is_resolved', false);
                type ConflictRow = { id: string; created_at: string; schedule_a?: { status?: string } | { status?: string }[] | null };
                const conflictsList = ((conflicts as unknown) as ConflictRow[]) || [];
                const getStatus = (sa: ConflictRow['schedule_a']): string | undefined => {
                    if (!sa) return undefined;
                    if (Array.isArray(sa)) return sa[0]?.status;
                    return sa.status;
                };
                const relevant = conflictsList.filter(c => {
                    const st = getStatus(c.schedule_a);
                    return st === 'submitted' || st === 'published';
                });
                setOpenConflicts(relevant.length);

                // 4. teacher schedule change requests
                const { data: scr } = await supabase
                    .from('schedule_change_requests')
                    .select('id, teacher_name, request_type, reason, created_at, status')
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(DASHBOARD_CONFIG.QUERY_LIMITS.REQUESTS);
                setPendingChangeRequests(scr || []);

                // 5. approval funnel (last 30 days)
                const since = new Date(Date.now() - DASHBOARD_CONFIG.TIME.DAYS_30_MS).toISOString();
                const { data: recent } = await supabase
                    .from('schedules')
                    .select('status, submitted_at, approved_at, updated_at')
                    .gte('updated_at', since);
                const f = { submitted: 0, approved: 0, rejected: 0 };
                (recent || []).forEach(s => {
                    if (s.status === 'submitted') f.submitted++;
                    else if (s.status === 'approved') f.approved++;
                    else if (s.status === 'rejected') f.rejected++;
                });
                setFunnel(f);

                // 6. conflicts trend (14d)
                const days = DASHBOARD_CONFIG.CHART.CONFLICTS_TREND_DAYS;
                const buckets: ConflictBucket[] = [];
                for (let i = days - 1; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const key = d.toISOString().slice(0, 10);
                    buckets.push({
                        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                        count: conflictsList.filter(
                            c => (c.created_at as string).slice(0, 10) === key
                        ).length,
                    });
                }
                setConflictsTrend(buckets);

                // 7. room load (top 8)
                const [schedulesFull, roomsFull] = await Promise.all([
                    supabase.from('schedules').select('room_id').eq('status', 'published'),
                    supabase.from('rooms').select('id, name'),
                ]);
                const roomMap: Record<string, number> = {};
                (schedulesFull.data || []).forEach((s: { room_id: string }) => {
                    if (s.room_id) roomMap[s.room_id] = (roomMap[s.room_id] || 0) + 1;
                });
                const roomNameById: Record<string, string> = {};
                (roomsFull.data || []).forEach((r: { id: string; name: string }) => { roomNameById[r.id] = r.name; });
                const loadList = Object.entries(roomMap)
                    .map(([id, count]) => ({ name: roomNameById[id] || 'Room', count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 8);
                setRoomLoad(loadList);
            } catch (err) {
                console.error('[ScheduleAdminDashboard] fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        run();
    }, []);

    const funnelTotal = funnel.submitted + funnel.approved + funnel.rejected;

    const handleApprove = async (id: string) => {
        try {
            await supabase
                .from('schedules')
                .update({
                    status: 'published',
                    approved_by: profile?.id,
                    approved_at: new Date().toISOString()
                })
                .eq('id', id);
            setPendingApprovals(prev => prev.filter(p => p.id !== id));
            setPublishedCount(c => c + 1);
        } catch (err) { console.error('approve failed:', err); }
    };

    const handleReject = async (id: string) => {
        try {
            await supabase
                .from('schedules')
                .update({ status: 'rejected', rejection_reason: 'Rejected from dashboard' })
                .eq('id', id);
            setPendingApprovals(prev => prev.filter(p => p.id !== id));
        } catch (err) { console.error('reject failed:', err); }
    };

    if (loading) {
        return (
            <div className="dashboard">
                <div className="dash-loading-center"><Loader2 className="spin" size={28} /></div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1 className="dashboard-title"><CheckCircle size={20} /> Schedule Admin</h1>
                <p className="dashboard-subtitle">
                    Welcome, {profile?.full_name?.split(' ')[0] || 'Admin'}. Review and approve schedule submissions.
                </p>
            </div>

            {/* KPI strip */}
            <div className="stats-grid">
                <div className={`stat-card ${pendingApprovals.length > 0 ? 'stat-warning' : ''}`}>
                    <div className="stat-icon"><Inbox size={20} /></div>
                    <div className="stat-number">{pendingApprovals.length}</div>
                    <div className="stat-label">Pending Approvals</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><CalendarDays size={20} /></div>
                    <div className="stat-number">{publishedCount}</div>
                    <div className="stat-label">Published</div>
                </div>
                <div className={`stat-card ${openConflicts > 0 ? 'stat-warning' : ''}`}>
                    <div className="stat-icon"><AlertTriangle size={20} /></div>
                    <div className="stat-number">{openConflicts}</div>
                    <div className="stat-label">Open Conflicts</div>
                </div>
                <div className={`stat-card ${pendingChangeRequests.length > 0 ? 'stat-warning' : ''}`}>
                    <div className="stat-icon"><ArrowRightLeft size={20} /></div>
                    <div className="stat-number">{pendingChangeRequests.length}</div>
                    <div className="stat-label">Change Requests</div>
                </div>
            </div>

            <div className="admin-dash-grid">
                <div className="admin-dash-left">
                    {/* Approval queue */}
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div className="dash-card-title"><Inbox size={16} /> Approval Queue</div>
                            {pendingApprovals.length > 0 && (
                                <span className="dash-card-badge dash-badge-warning">{pendingApprovals.length}</span>
                            )}
                        </div>
                        {pendingApprovals.length === 0 ? (
                            <div className="dash-empty"><CheckCircle size={28} /><div>Nothing pending — all caught up</div></div>
                        ) : (
                            <div className="dash-list">
                                {pendingApprovals.slice(0, DASHBOARD_CONFIG.DISPLAY_LIMITS.RECENT_ITEMS).map(s => (
                                    <div key={s.id} className="dash-list-item">
                                        <div className="dash-list-item-accent dash-accent-warning" />
                                        <div className="dash-list-item-body dash-list-item-body--compact">
                                            <div className="dash-list-item-title">{s.section?.name || 'Schedule'}</div>
                                            <div className="dash-list-item-meta">
                                                Submitted {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '—'}
                                            </div>
                                        </div>
                                        <div className="dash-icon-group" style={{ gap: 6 }}>
                                            <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => handleApprove(s.id)}>
                                                <CheckCircle size={12} /> Approve
                                            </button>
                                            <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => handleReject(s.id)}>
                                                <XCircle size={12} /> Reject
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <a href="/admin/schedules" className="btn btn-secondary dash-view-all-link">View All</a>
                            </div>
                        )}
                    </div>

                    {/* Change requests */}
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div className="dash-card-title"><ArrowRightLeft size={16} /> Change Requests</div>
                            {pendingChangeRequests.length > 0 && (
                                <span className="dash-card-badge dash-badge-warning">{pendingChangeRequests.length}</span>
                            )}
                        </div>
                        {pendingChangeRequests.length === 0 ? (
                            <div className="dash-empty"><ArrowRightLeft size={28} /><div>No pending requests</div></div>
                        ) : (
                            <div className="dash-list">
                                {pendingChangeRequests.slice(0, DASHBOARD_CONFIG.DISPLAY_LIMITS.RECENT_ITEMS).map(r => (
                                    <div key={r.id} className="dash-list-item">
                                        <div className="dash-list-item-accent dash-accent-warning" />
                                        <div className="dash-list-item-body dash-list-item-body--compact">
                                            <div className="dash-list-item-title">{r.teacher_name} — {r.request_type}</div>
                                            <div className="dash-list-item-desc">
                                                {r.reason?.slice(0, DASHBOARD_CONFIG.DISPLAY_LIMITS.MESSAGE_TRUNCATION) || '—'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="admin-dash-right">
                    {/* Approval funnel */}
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div className="dash-card-title"><TrendingUp size={16} /> Approval Funnel (30d)</div>
                            <span className="dash-card-badge dash-badge-info">{funnelTotal}</span>
                        </div>
                        {funnelTotal === 0 ? (
                            <div className="dash-empty"><Inbox size={28} /><div>No activity in 30 days</div></div>
                        ) : (
                            <>
                                <div className="dash-funnel-bar" role="img" aria-label={`${funnel.approved} approved, ${funnel.rejected} rejected, ${funnel.submitted} submitted`}>
                                    <div style={{ width: `${(funnel.approved / funnelTotal) * 100}%`, background: '#22c55e' }} title={`Approved: ${funnel.approved}`} />
                                    <div style={{ width: `${(funnel.rejected / funnelTotal) * 100}%`, background: '#ef4444' }} title={`Rejected: ${funnel.rejected}`} />
                                    <div style={{ width: `${(funnel.submitted / funnelTotal) * 100}%`, background: '#f59e0b' }} title={`Submitted: ${funnel.submitted}`} />
                                </div>
                                <div className="dash-funnel-legend">
                                    <div><CheckCircle size={12} color="#22c55e" /> Approved <strong>{funnel.approved}</strong></div>
                                    <div><XCircle size={12} color="#ef4444" /> Rejected <strong>{funnel.rejected}</strong></div>
                                    <div><Clock size={12} color="#f59e0b" /> Submitted <strong>{funnel.submitted}</strong></div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Conflicts trend */}
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div className="dash-card-title"><BarChart3 size={16} /> Conflicts (14d)</div>
                            <span className="dash-card-badge dash-badge-info">
                                {conflictsTrend.reduce((s, d) => s + d.count, 0)}
                            </span>
                        </div>
                        <div className="dash-chart-wrap" role="img" aria-label="Conflicts created per day, last 14 days">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={conflictsTrend} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={1} />
                                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Line type="monotone" dataKey="count" name="Conflicts" stroke="#ef4444" strokeWidth={2} dot={{ r: 2.5, fill: '#ef4444' }} activeDot={{ r: 4 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Room load (top 8) */}
                    {roomLoad.length > 0 && (
                        <div className="dash-card dash-stagger">
                            <div className="dash-card-header">
                                <div className="dash-card-title"><BarChart3 size={16} /> Top Rooms by Load</div>
                                <span className="dash-card-badge dash-badge-info">{roomLoad.length}</span>
                            </div>
                            <div className="dash-chart-wrap" role="img" aria-label="Top rooms by published schedule count">
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
        </div>
    );
};

export default ScheduleAdminDashboard;
