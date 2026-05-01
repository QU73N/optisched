// ScheduleManagerDashboard - schedule construction focus.
// Shows my drafts, my submissions, conflicts in my drafts, generation tools,
// and entity counts (teachers/rooms/sections/subjects).

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
    Sparkles, CalendarDays, AlertTriangle, BookOpen, Users,
    MapPin, Loader2, Inbox, FileText, Clock
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell, LineChart, Line
} from 'recharts';
import ChartTooltip from '../../components/ChartTooltip';
import { DASHBOARD_CONFIG } from '../../config/dashboard';
import './Dashboard.css';

interface DraftRow {
    id: string;
    status: string;
    section_id: string | null;
    section?: { name: string } | { name: string }[] | null;
    updated_at: string;
}
interface ConflictTypeBucket { type: string; count: number; }
interface ConflictTrend { date: string; count: number; }
interface RoomLoad { name: string; count: number; }

const ScheduleManagerDashboard: React.FC = () => {
    const { profile } = useAuth();
    const perms = usePermissions();

    const [loading, setLoading] = useState(true);
    const [myDrafts, setMyDrafts] = useState<DraftRow[]>([]);
    const [mySubmitted, setMySubmitted] = useState<DraftRow[]>([]);
    const [myApproved7d, setMyApproved7d] = useState(0);
    const [conflictsInDrafts, setConflictsInDrafts] = useState(0);
    const [conflictsInSubmitted, setConflictsInSubmitted] = useState(0);
    const [counts, setCounts] = useState({ teachers: 0, rooms: 0, sections: 0, subjects: 0 });
    const [conflictsByType, setConflictsByType] = useState<ConflictTypeBucket[]>([]);
    const [conflictsTrend, setConflictsTrend] = useState<ConflictTrend[]>([]);
    const [roomLoad, setRoomLoad] = useState<RoomLoad[]>([]);

    useEffect(() => {
        if (!profile?.id) return;
        const run = async () => {
            try {
                // 1. my drafts
                const { data: drafts } = await supabase
                    .from('schedules')
                    .select('id, status, section_id, section:sections(name), updated_at')
                    .eq('created_by', profile.id)
                    .eq('status', 'draft')
                    .order('updated_at', { ascending: false })
                    .limit(20);
                setMyDrafts((drafts as unknown as DraftRow[]) || []);

                // 2. my submitted
                const { data: submitted } = await supabase
                    .from('schedules')
                    .select('id, status, section_id, section:sections(name), updated_at')
                    .eq('created_by', profile.id)
                    .eq('status', 'submitted')
                    .order('updated_at', { ascending: false })
                    .limit(10);
                setMySubmitted((submitted as unknown as DraftRow[]) || []);

                // 3. my approved last 7d
                const since = new Date(Date.now() - DASHBOARD_CONFIG.TIME.DAYS_7_MS).toISOString();
                const { count: approvedCount } = await supabase
                    .from('schedules')
                    .select('id', { count: 'exact', head: true })
                    .eq('created_by', profile.id)
                    .eq('status', 'published')
                    .gte('approved_at', since);
                setMyApproved7d(approvedCount || 0);

                // 4. conflicts touching my drafts
                const draftIds = (drafts || []).map(d => d.id);
                if (draftIds.length > 0) {
                    const { data: confs } = await supabase
                        .from('conflicts')
                        .select('id, type')
                        .eq('is_resolved', false)
                        .in('schedule_a_id', draftIds);
                    setConflictsInDrafts((confs || []).length);
                    const map = new Map<string, number>();
                    (confs || []).forEach(c => map.set(c.type, (map.get(c.type) || 0) + 1));
                    setConflictsByType(
                        Array.from(map.entries()).map(([type, count]) => ({
                            type: type.replace(/_/g, ' '), count
                        }))
                    );
                } else {
                    setConflictsInDrafts(0);
                    setConflictsByType([]);
                }

                // 5. entity counts
                const [teachers, rooms, sections, subjects] = await Promise.all([
                    supabase.from('teachers').select('id', { count: 'exact', head: true }),
                    supabase.from('rooms').select('id', { count: 'exact', head: true }),
                    supabase.from('sections').select('id', { count: 'exact', head: true }),
                    supabase.from('subjects').select('id', { count: 'exact', head: true }),
                ]);
                setCounts({
                    teachers: teachers.count || 0,
                    rooms: rooms.count || 0,
                    sections: sections.count || 0,
                    subjects: subjects.count || 0,
                });

                // 6. conflicts in my submitted schedules
                const submittedIds = (submitted || []).map(s => s.id);
                if (submittedIds.length > 0) {
                    const { data: submittedConfs } = await supabase
                        .from('conflicts')
                        .select('id')
                        .eq('is_resolved', false)
                        .in('schedule_a_id', submittedIds);
                    setConflictsInSubmitted((submittedConfs || []).length);
                } else {
                    setConflictsInSubmitted(0);
                }

                // 7. conflicts trend (14d)
                const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
                const { data: allConflicts } = await supabase
                    .from('conflicts')
                    .select('created_at')
                    .gte('created_at', fourteenDaysAgo);
                const trendMap: Record<string, number> = {};
                for (let i = 13; i >= 0; i--) {
                    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
                    const key = `${d.getMonth() + 1}/${d.getDate()}`;
                    trendMap[key] = 0;
                }
                (allConflicts || []).forEach((c: { created_at: string }) => {
                    if (!c.created_at) return;
                    const d = new Date(c.created_at);
                    const key = `${d.getMonth() + 1}/${d.getDate()}`;
                    if (key in trendMap) trendMap[key]++;
                });
                setConflictsTrend(Object.entries(trendMap).map(([date, count]) => ({ date, count })));

                // 8. room load (top 8)
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
                console.error('[ScheduleManagerDashboard] fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [profile?.id]);

    const sectionName = (s: DraftRow['section']): string => {
        if (!s) return 'Schedule';
        if (Array.isArray(s)) return s[0]?.name || 'Schedule';
        return s.name;
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
                <h1 className="dashboard-title">Schedule Manager</h1>
                <p className="dashboard-subtitle">
                    Welcome, {profile?.full_name?.split(' ')[0] || 'Manager'}. Build, generate, and submit schedules.
                </p>
            </div>

            {/* KPI strip */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon"><FileText size={20} /></div>
                    <div className="stat-number">{myDrafts.length}</div>
                    <div className="stat-label">My Drafts</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><Clock size={20} /></div>
                    <div className="stat-number">{mySubmitted.length}</div>
                    <div className="stat-label">Awaiting Approval</div>
                </div>
                <div className={`stat-card ${conflictsInDrafts > 0 ? 'stat-warning' : ''}`}>
                    <div className="stat-icon"><AlertTriangle size={20} /></div>
                    <div className="stat-number">{conflictsInDrafts}</div>
                    <div className="stat-label">Conflicts in Drafts</div>
                </div>
                <div className={`stat-card ${conflictsInSubmitted > 0 ? 'stat-warning' : ''}`}>
                    <div className="stat-icon"><AlertTriangle size={20} /></div>
                    <div className="stat-number">{conflictsInSubmitted}</div>
                    <div className="stat-label">Conflicts in Submitted</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><CalendarDays size={20} /></div>
                    <div className="stat-number">{myApproved7d}</div>
                    <div className="stat-label">Approved (7d)</div>
                </div>
            </div>

            {/* Entity counts - secondary strip */}
            <div className="stats-grid" style={{ marginTop: 12 }}>
                <div className="stat-card">
                    <div className="stat-icon"><Users size={20} /></div>
                    <div className="stat-number">{counts.teachers}</div>
                    <div className="stat-label">Teachers</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><MapPin size={20} /></div>
                    <div className="stat-number">{counts.rooms}</div>
                    <div className="stat-label">Rooms</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><BookOpen size={20} /></div>
                    <div className="stat-number">{counts.subjects}</div>
                    <div className="stat-label">Subjects</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><Inbox size={20} /></div>
                    <div className="stat-number">{counts.sections}</div>
                    <div className="stat-label">Sections</div>
                </div>
            </div>

            <div className="admin-dash-grid">
                <div className="admin-dash-left">
                    {/* My drafts */}
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div className="dash-card-title"><FileText size={16} /> My Drafts</div>
                            {myDrafts.length > 0 && <span className="dash-card-badge dash-badge-info">{myDrafts.length}</span>}
                        </div>
                        {myDrafts.length === 0 ? (
                            <div className="dash-empty"><FileText size={28} /><div>No drafts. Generate one to get started.</div></div>
                        ) : (
                            <div className="dash-list">
                                {myDrafts.slice(0, DASHBOARD_CONFIG.DISPLAY_LIMITS.RECENT_ITEMS).map(d => (
                                    <div key={d.id} className="dash-list-item">
                                        <div className="dash-list-item-accent dash-accent-info" />
                                        <div className="dash-list-item-body dash-list-item-body--compact">
                                            <div className="dash-list-item-title">{sectionName(d.section)}</div>
                                            <div className="dash-list-item-meta">
                                                Updated {new Date(d.updated_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <a href="/admin/schedules" className="btn btn-secondary dash-view-all-link">View All</a>
                            </div>
                        )}
                    </div>

                    {/* My submissions */}
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div className="dash-card-title"><Clock size={16} /> Awaiting Approval</div>
                            {mySubmitted.length > 0 && <span className="dash-card-badge dash-badge-warning">{mySubmitted.length}</span>}
                        </div>
                        {mySubmitted.length === 0 ? (
                            <div className="dash-empty"><Clock size={28} /><div>Nothing submitted</div></div>
                        ) : (
                            <div className="dash-list">
                                {mySubmitted.slice(0, DASHBOARD_CONFIG.DISPLAY_LIMITS.RECENT_ITEMS).map(d => (
                                    <div key={d.id} className="dash-list-item">
                                        <div className="dash-list-item-accent dash-accent-warning" />
                                        <div className="dash-list-item-body dash-list-item-body--compact">
                                            <div className="dash-list-item-title">{sectionName(d.section)}</div>
                                            <div className="dash-list-item-meta">
                                                Submitted {new Date(d.updated_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quick actions */}
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div className="dash-card-title"><Sparkles size={16} /> Quick Actions</div>
                        </div>
                        <div className="dash-flex-col dash-gap-10">
                            <a className="btn btn-primary" href="/admin/generate">
                                <Sparkles size={14} /> Generate Schedule
                            </a>
                            <a className="btn btn-secondary" href="/admin/data">Manage Data</a>
                            <a className="btn btn-secondary" href="/admin/conflicts">View Conflicts</a>
                            {!perms.canDirectPublishEdit && (
                                <p className="dash-meta-text" style={{ marginTop: 4 }}>
                                    Schedules require Schedule Admin approval before publication.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="admin-dash-right">
                    {/* Conflicts by type */}
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div className="dash-card-title"><AlertTriangle size={16} /> Conflicts by Type</div>
                            <span className={`dash-card-badge ${conflictsInDrafts > 0 ? 'dash-badge-warning' : 'dash-badge-success'}`}>
                                {conflictsInDrafts}
                            </span>
                        </div>
                        {conflictsByType.length === 0 ? (
                            <div className="dash-empty"><AlertTriangle size={28} /><div>No conflicts in your drafts</div></div>
                        ) : (
                            <div className="dash-chart-wrap-sm" role="img" aria-label="Conflicts grouped by type for my drafts">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={conflictsByType} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                                        <XAxis dataKey="type" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-elevated)', opacity: 0.4 }} />
                                        <Bar dataKey="count" name="Conflicts" radius={[4, 4, 0, 0]}>
                                            {conflictsByType.map((_, i) => (
                                                <Cell key={i} fill={['#ef4444', '#f59e0b', '#a855f7', '#06b6d4'][i % 4]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Conflicts trend (14d) */}
                    {conflictsTrend.length > 0 && (
                        <div className="dash-card dash-stagger">
                            <div className="dash-card-header">
                                <div className="dash-card-title"><AlertTriangle size={16} /> Conflicts (14d)</div>
                                <span className="dash-card-badge dash-badge-info">
                                    {conflictsTrend.reduce((s, d) => s + d.count, 0)}
                                </span>
                            </div>
                            <div className="dash-chart-wrap-sm" role="img" aria-label="Conflicts created per day, last 14 days">
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
                    )}

                    {/* Room load (top 8) */}
                    {roomLoad.length > 0 && (
                        <div className="dash-card dash-stagger">
                            <div className="dash-card-header">
                                <div className="dash-card-title"><MapPin size={16} /> Top Rooms by Load</div>
                                <span className="dash-card-badge dash-badge-info">{roomLoad.length}</span>
                            </div>
                            <div className="dash-chart-wrap-sm" role="img" aria-label="Top rooms by published schedule count">
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

                    {/* Load by day moved to siderail */}
                </div>
            </div>
        </div>
    );
};

export default ScheduleManagerDashboard;
