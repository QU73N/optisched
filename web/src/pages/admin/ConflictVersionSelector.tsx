import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Search, Clock, Layers, AlertTriangle, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import '../admin/Dashboard.css';

interface ScheduleVersion {
    id: string;
    version_number: number;
    is_active: boolean;
    change_type: string;
    change_summary: string;
    created_at: string;
    created_by: string;
    schedule_count?: number;
}

const ConflictVersionSelector: React.FC = () => {
    const navigate = useNavigate();
    const [versions, setVersions] = useState<ScheduleVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchVersions();
    }, [filter]);

    const fetchVersions = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('schedule_versions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (filter !== 'all') {
                // Filter by checking if the associated schedules have the desired status
                // This is a simplified approach - in production, you'd want a more efficient query
                const { data: schedules } = await supabase
                    .from('schedules')
                    .select('id, status')
                    .eq('status', filter);
                
                if (schedules && schedules.length > 0) {
                    const scheduleIds = schedules.map(s => s.id);
                    query = query.in('id', scheduleIds);
                } else {
                    setVersions([]);
                    setLoading(false);
                    return;
                }
            }

            const { data, error } = await query;
            if (error) throw error;
            
            // Add schedule count for each version
            const versionsWithCounts = await Promise.all(
                (data || []).map(async (v: ScheduleVersion) => {
                    const { count } = await supabase
                        .from('schedule_version_snapshots')
                        .select('*', { count: 'exact', head: true })
                        .eq('version_id', v.id);
                    return { ...v, schedule_count: count || 0 };
                })
            );

            setVersions(versionsWithCounts);
        } catch (err) {
            console.error('Failed to fetch versions:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredVersions = versions.filter(v => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                v.change_summary?.toLowerCase().includes(query) ||
                v.change_type?.toLowerCase().includes(query) ||
                v.version_number.toString().includes(query) ||
                v.created_by.toLowerCase().includes(query)
            );
        }
        return true;
    });

    const formatDate = (d: string) => new Date(d).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });

    const handleSelectVersion = (versionId: string) => {
        navigate(`/admin/conflicts/version/${versionId}`);
    };

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title"><History size={20} /> Conflict Scanner</h1>
                    <p className="dashboard-subtitle">Select a schedule version to scan for conflicts</p>
                </div>
            </div>

            {/* Stats */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-icon"><Layers size={20} /></div>
                    <div className="stat-number">{versions.length}</div>
                    <div className="stat-label">Total Versions</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><AlertTriangle size={20} /></div>
                    <div className="stat-number">{versions.filter(v => v.is_active).length}</div>
                    <div className="stat-label">Active Versions</div>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
                <div style={{ flex: 1, maxWidth: 300 }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            className="input"
                            style={{ paddingLeft: 36 }}
                            placeholder="Search versions..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button
                        className={`sg-chip ${filter === 'all' ? 'sg-chip-active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        All
                    </button>
                    <button
                        className={`sg-chip ${filter === 'published' ? 'sg-chip-active' : ''}`}
                        onClick={() => setFilter('published')}
                    >
                        Published
                    </button>
                    <button
                        className={`sg-chip ${filter === 'draft' ? 'sg-chip-active' : ''}`}
                        onClick={() => setFilter('draft')}
                    >
                        Draft
                    </button>
                </div>
            </div>

            {/* Versions List */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                    <div className="spinner" />
                </div>
            ) : filteredVersions.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 60 }}>
                    <History size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No schedule versions found</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Create schedules and save versions to enable conflict scanning</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filteredVersions.map((v) => (
                        <div
                            key={v.id}
                            className="card"
                            style={{
                                borderLeft: `3px solid ${v.is_active ? '#34d399' : 'var(--border-default)'}`,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onClick={() => handleSelectVersion(v.id)}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(4px)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                                            Version {v.version_number}
                                        </span>
                                        {v.is_active && (
                                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(34,197,94,0.12)', color: '#34d399', fontWeight: 700 }}>
                                                ACTIVE
                                            </span>
                                        )}
                                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.12)', color: '#60a5fa', fontWeight: 600, textTransform: 'capitalize' }}>
                                            {v.change_type}
                                        </span>
                                    </div>
                                    {v.change_summary && (
                                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 6px' }}>
                                            {v.change_summary}
                                        </p>
                                    )}
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 16, alignItems: 'center' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Layers size={12} /> {v.schedule_count || 0} schedules
                                        </span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Clock size={12} /> {formatDate(v.created_at)}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    className="btn btn-secondary"
                                    style={{ padding: '8px 12px', fontSize: 13 }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectVersion(v.id);
                                    }}
                                >
                                    <ArrowRight size={14} /> Scan
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ConflictVersionSelector;
