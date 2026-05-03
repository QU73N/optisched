// SystemAdminDashboard - access governance & system health.
// Focuses on user management, signup trends, password resets, system rules,
// and broadcast announcements. Does NOT show schedules or conflicts.

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { ROLE_DISPLAY_NAMES, type UserRole } from '../../types/database';
import {
    Users, UserPlus, KeyRound, Megaphone, Activity, Shield,
    MessageSquare, Settings as SettingsIcon, Loader2
} from 'lucide-react';
import {
    BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, LineChart, Line
} from 'recharts';
import ChartTooltip from '../../components/ChartTooltip';
import { DASHBOARD_CONFIG } from '../../config/dashboard';
import './Dashboard.css';

interface RoleCount { role: string; count: number; label: string; }
interface SignupBucket { date: string; count: number; }
interface ResetRow { id: string; email: string; requested_at: string; status: string; }
interface RuleRow { rule_key: string; rule_value: unknown; description: string | null; updated_at: string; }

const SystemAdminDashboard: React.FC = () => {
    const { profile } = useAuth();
    const perms = usePermissions();

    const [loading, setLoading] = useState(true);
    const [totalUsers, setTotalUsers] = useState(0);
    const [roleCounts, setRoleCounts] = useState<RoleCount[]>([]);
    const [newSignups7d, setNewSignups7d] = useState(0);
    const [signupTrend, setSignupTrend] = useState<SignupBucket[]>([]);
    const [pendingResets, setPendingResets] = useState<ResetRow[]>([]);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [rulesPreview, setRulesPreview] = useState<RuleRow[]>([]);

    useEffect(() => {
        const run = async () => {
            try {
                // 1. profiles by role
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('role, created_at');
                const map = new Map<string, number>();
                (profiles || []).forEach(p => map.set(p.role, (map.get(p.role) || 0) + 1));
                setTotalUsers(profiles?.length || 0);
                setRoleCounts(
                    Array.from(map.entries()).map(([role, count]) => ({
                        role, count,
                        label: ROLE_DISPLAY_NAMES[role as UserRole] || role
                    })).sort((a, b) => b.count - a.count)
                );

                // 2. new signups last 7 days
                const since = new Date(Date.now() - DASHBOARD_CONFIG.TIME.DAYS_7_MS);
                const recent = (profiles || []).filter(
                    p => new Date(p.created_at) >= since
                );
                setNewSignups7d(recent.length);

                // 3. 30-day signup trend (per-day buckets)
                const days = 30;
                const buckets: SignupBucket[] = [];
                for (let i = days - 1; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const key = d.toISOString().slice(0, 10);
                    buckets.push({
                        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                        count: (profiles || []).filter(
                            p => p.created_at?.slice(0, 10) === key
                        ).length,
                    });
                }
                setSignupTrend(buckets);

                // 4. pending password resets
                const { data: resets } = await supabase
                    .from('password_reset_requests')
                    .select('id,email,requested_at,status')
                    .eq('status', 'pending')
                    .order('requested_at', { ascending: false })
                    .limit(10);
                setPendingResets(resets || []);

                // 5. unread messages targeting admins
                const { count } = await supabase
                    .from('admin_messages')
                    .select('id', { count: 'exact', head: true })
                    .eq('direction', 'teacher_to_admin');
                setUnreadMessages(count || 0);

                // 6. rules engine preview
                const { data: rules } = await supabase
                    .from('system_rules')
                    .select('rule_key, rule_value, description, updated_at')
                    .order('updated_at', { ascending: false })
                    .limit(6);
                setRulesPreview(rules || []);
            } catch (err) {
                console.error('[SystemAdminDashboard] fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        run();
    }, []);

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
                <h1 className="dashboard-title"><Shield size={20} /> System Admin</h1>
                <p className="dashboard-subtitle">
                    Welcome, {profile?.full_name?.split(' ')[0] || 'Admin'}. Manage access, users, and system rules.
                </p>
            </div>

            {/* KPI strip */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon"><Users size={20} /></div>
                    <div className="stat-number">{totalUsers}</div>
                    <div className="stat-label">Total Users</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><UserPlus size={20} /></div>
                    <div className="stat-number">{newSignups7d}</div>
                    <div className="stat-label">New (7d)</div>
                </div>
                <div className={`stat-card ${pendingResets.length > 0 ? 'stat-warning' : ''}`}>
                    <div className="stat-icon"><KeyRound size={20} /></div>
                    <div className="stat-number">{pendingResets.length}</div>
                    <div className="stat-label">Pending Resets</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><MessageSquare size={20} /></div>
                    <div className="stat-number">{unreadMessages}</div>
                    <div className="stat-label">Messages</div>
                </div>
            </div>

            <div className="admin-dash-grid">
                <div className="admin-dash-left">
                    {/* Role distribution */}
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div className="dash-card-title"><Shield size={16} /> Users by Role</div>
                            <span className="dash-card-badge dash-badge-info">{roleCounts.length}</span>
                        </div>
                        <div className="dash-chart-wrap-sm" role="img" aria-label="User counts grouped by role">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={roleCounts} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-elevated)', opacity: 0.4 }} />
                                    <Bar dataKey="count" name="Users" radius={[4, 4, 0, 0]}>
                                        {roleCounts.map((_, i) => (
                                            <Cell key={i} fill={['#6366f1', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#a855f7'][i % 6]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Pending resets */}
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div className="dash-card-title"><KeyRound size={16} /> Password Resets</div>
                            {pendingResets.length > 0 && (
                                <span className="dash-card-badge dash-badge-warning">{pendingResets.length}</span>
                            )}
                        </div>
                        {pendingResets.length === 0 ? (
                            <div className="dash-empty"><KeyRound size={28} /><div>No pending resets</div></div>
                        ) : (
                            <div className="dash-list">
                                {pendingResets.slice(0, DASHBOARD_CONFIG.DISPLAY_LIMITS.RECENT_ITEMS).map(r => (
                                    <div key={r.id} className="dash-list-item">
                                        <div className="dash-list-item-accent dash-accent-warning" />
                                        <div className="dash-list-item-body dash-list-item-body--compact">
                                            <div className="dash-list-item-title">{r.email}</div>
                                            <div className="dash-list-item-meta">
                                                Requested {new Date(r.requested_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <a href="/admin/users" className="btn btn-secondary dash-view-all-link">Manage Users</a>
                            </div>
                        )}
                    </div>

                    {/* Rules engine preview */}
                    {perms.canEditSystemRules && (
                        <div className="dash-card dash-stagger">
                            <div className="dash-card-header">
                                <div className="dash-card-title"><SettingsIcon size={16} /> Permission Rules</div>
                                <span className="dash-card-badge dash-badge-info">{rulesPreview.length}</span>
                            </div>
                            {rulesPreview.length === 0 ? (
                                <div className="dash-empty"><SettingsIcon size={28} /><div>No rules configured</div></div>
                            ) : (
                                <div className="dash-list">
                                    {rulesPreview.slice(0, 4).map(r => (
                                        <div key={r.rule_key} className="dash-list-item">
                                            <div className={`dash-list-item-accent ${String(r.rule_value) === 'true' ? 'dash-accent-success' : 'dash-accent-warning'}`} />
                                            <div className="dash-list-item-body dash-list-item-body--compact">
                                                <div className="dash-list-item-title">{r.rule_key}</div>
                                                <div className="dash-list-item-desc">
                                                    {r.description || '—'} · <strong>{String(r.rule_value)}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="admin-dash-right">
                    {/* Signup trend */}
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div className="dash-card-title"><Activity size={16} /> Signup Trend (30 days)</div>
                            <span className="dash-card-badge dash-badge-info">{newSignups7d} this week</span>
                        </div>
                        <div className="dash-chart-wrap" role="img" aria-label="New user signups over the last 30 days">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={signupTrend} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={3} />
                                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Line type="monotone" dataKey="count" name="New users" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Quick actions */}
                    <div className="dash-card dash-stagger">
                        <div className="dash-card-header">
                            <div className="dash-card-title"><Megaphone size={16} /> Quick Actions</div>
                        </div>
                        <div className="dash-flex-col dash-gap-10">
                            <a className="btn btn-primary" href="/admin/users">Create User</a>
                            <a className="btn btn-secondary" href="/admin/settings">Edit System Rules</a>
                            <a className="btn btn-secondary" href="/admin/messages">View Messages</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemAdminDashboard;
