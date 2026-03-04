import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, CalendarDays, AlertTriangle, BookOpen, TrendingUp, Clock, Inbox, CheckCircle, XCircle } from 'lucide-react';
import './Dashboard.css';

interface ChangeRequest {
    id: string;
    request_type: string;
    reason: string;
    status: string;
    admin_notes: string | null;
    created_at: string;
    teacher_id: string;
    schedule_id: string;
    teacher_name?: string;
}

const AdminDashboard: React.FC = () => {
    const [stats, setStats] = useState({
        totalUsers: 0,
        teachers: 0,
        students: 0,
        schedules: 0,
        conflicts: 0,
        rooms: 0,
    });
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState<ChangeRequest[]>([]);
    const [requestsLoading, setRequestsLoading] = useState(true);

    useEffect(() => {
        fetchStats();
        fetchRequests();

        // Real-time subscription for new requests
        const channel = supabase
            .channel('admin-requests')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_change_requests' }, () => {
                fetchRequests();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchStats = async () => {
        try {
            const [profiles, schedules, conflicts, rooms] = await Promise.all([
                supabase.from('profiles').select('role', { count: 'exact' }),
                supabase.from('schedules').select('id', { count: 'exact' }),
                supabase.from('conflicts').select('id', { count: 'exact' }).eq('is_resolved', false),
                supabase.from('rooms').select('id', { count: 'exact' }),
            ]);

            const allProfiles = profiles.data || [];
            setStats({
                totalUsers: profiles.count || 0,
                teachers: allProfiles.filter(p => p.role === 'teacher').length,
                students: allProfiles.filter(p => p.role === 'student').length,
                schedules: schedules.count || 0,
                conflicts: conflicts.count || 0,
                rooms: rooms.count || 0,
            });
        } catch (err) {
            console.error('Error fetching stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchRequests = async () => {
        try {
            const { data } = await supabase
                .from('schedule_change_requests')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (data) {
                // Enrich with teacher names
                const teacherIds = [...new Set(data.map(r => r.teacher_id).filter(Boolean))];
                let teacherMap: Record<string, string> = {};
                if (teacherIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, full_name')
                        .in('id', teacherIds);
                    if (profiles) {
                        profiles.forEach(p => { teacherMap[p.id] = p.full_name || 'Unknown'; });
                    }
                }
                setRequests(data.map(r => ({ ...r, teacher_name: teacherMap[r.teacher_id] || 'Teacher' })));
            }
        } catch (err) {
            console.error('Error fetching requests:', err);
        } finally {
            setRequestsLoading(false);
        }
    };

    const handleRequestAction = async (id: string, status: 'approved' | 'rejected', notes?: string) => {
        // Optimistic update
        setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));

        try {
            const { error } = await supabase
                .from('schedule_change_requests')
                .update({ status, admin_notes: notes || null, updated_at: new Date().toISOString() })
                .eq('id', id);

            if (error) {
                console.error('Error updating request:', error);
                alert(`Failed to ${status} request: ${error.message}`);
                // Revert optimistic update
                setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'pending' } : r));
            }
        } catch (err) {
            console.error('Error updating request:', err);
            alert(`Failed to ${status} request. Check console for details.`);
            setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'pending' } : r));
        }
    };

    const pendingRequests = requests.filter(r => r.status === 'pending');

    const statCards = [
        { label: 'Total Users', value: stats.totalUsers, icon: Users, color: '#6366f1' },
        { label: 'Teachers', value: stats.teachers, icon: BookOpen, color: '#3b82f6' },
        { label: 'Students', value: stats.students, icon: TrendingUp, color: '#10b981' },
        { label: 'Schedules', value: stats.schedules, icon: CalendarDays, color: '#8b5cf6' },
        { label: 'Open Conflicts', value: stats.conflicts, icon: AlertTriangle, color: '#f59e0b' },
        { label: 'Rooms', value: stats.rooms, icon: Clock, color: '#06b6d4' },
    ];

    const getStatusBadge = (status: string) => {
        const map: Record<string, { bg: string; color: string; label: string }> = {
            pending: { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24', label: 'PENDING' },
            approved: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', label: 'APPROVED' },
            rejected: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'REJECTED' },
        };
        return map[status] || map.pending;
    };

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Admin Dashboard</h1>
                    <p className="dashboard-subtitle">
                        Overview of the scheduling system
                        {pendingRequests.length > 0 && (
                            <span style={{ color: '#fbbf24', marginLeft: 8 }}>
                                • {pendingRequests.length} pending request{pendingRequests.length > 1 ? 's' : ''}
                            </span>
                        )}
                    </p>
                </div>
            </div>

            <div className="stats-grid">
                {statCards.map(card => (
                    <div key={card.label} className="stat-card slide-up">
                        <div className="stat-card-header">
                            <div className="stat-icon" style={{ background: `${card.color}20`, color: card.color }}>
                                <card.icon size={20} />
                            </div>
                        </div>
                        <div className="stat-number">
                            {loading ? <div className="spinner" style={{ width: 20, height: 20 }} /> : card.value}
                        </div>
                        <div className="stat-label">{card.label}</div>
                    </div>
                ))}
            </div>

            <div className="dashboard-grid">
                {/* Teacher Requests */}
                <div className="card">
                    <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Inbox size={18} />
                        Teacher Requests
                        {pendingRequests.length > 0 && (
                            <span className="badge" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', fontSize: 11 }}>
                                {pendingRequests.length} pending
                            </span>
                        )}
                    </h3>
                    {requestsLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="spinner" /></div>
                    ) : requests.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No requests yet</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
                            {requests.slice(0, 10).map(req => {
                                const badge = getStatusBadge(req.status);
                                return (
                                    <div key={req.id} style={{
                                        background: 'var(--bg-surface)',
                                        borderRadius: 'var(--radius-md)',
                                        padding: '12px 14px',
                                        borderLeft: `3px solid ${badge.color}`,
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {req.teacher_name}
                                            </span>
                                            <span className="badge" style={{ background: badge.bg, color: badge.color, fontSize: 10, fontWeight: 700 }}>
                                                {badge.label}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>
                                            {req.request_type}
                                        </div>
                                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{req.reason}</p>
                                        {req.status === 'pending' && (
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 11 }}
                                                    onClick={() => handleRequestAction(req.id, 'approved')}>
                                                    <CheckCircle size={12} /> Approve
                                                </button>
                                                <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: 11, color: '#ef4444' }}
                                                    onClick={() => handleRequestAction(req.id, 'rejected')}>
                                                    <XCircle size={12} /> Reject
                                                </button>
                                            </div>
                                        )}
                                        {req.admin_notes && (
                                            <p style={{ fontSize: 11, color: '#60a5fa', fontStyle: 'italic', marginTop: 4 }}>
                                                Admin: {req.admin_notes}
                                            </p>
                                        )}
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                            {new Date(req.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="card">
                    <h3 className="card-title">Quick Actions</h3>
                    <div className="quick-actions">
                        <a href="/admin/users" className="btn btn-secondary">
                            <Users size={16} />
                            Manage Users
                        </a>
                        <a href="/admin/schedules" className="btn btn-secondary">
                            <CalendarDays size={16} />
                            View Schedules
                        </a>
                        <a href="/admin/conflicts" className="btn btn-secondary">
                            <AlertTriangle size={16} />
                            Resolve Conflicts
                        </a>
                    </div>
                </div>

                {/* System Status */}
                <div className="card">
                    <h3 className="card-title">System Status</h3>
                    <div className="status-list">
                        <div className="status-item">
                            <div className="status-dot status-online" />
                            <span>Database Connected</span>
                        </div>
                        <div className="status-item">
                            <div className="status-dot status-online" />
                            <span>Authentication Active</span>
                        </div>
                        <div className="status-item">
                            <div className={`status-dot ${stats.conflicts > 0 ? 'status-warning' : 'status-online'}`} />
                            <span>{stats.conflicts > 0 ? `${stats.conflicts} Unresolved Conflicts` : 'No Conflicts'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
