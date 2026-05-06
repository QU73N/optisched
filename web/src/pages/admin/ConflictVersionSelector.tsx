import React, { useCallback, useEffect, useState } from 'react';
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
    changed_at: string;
    changed_by: string;
    snapshot?: unknown;
    schedule_count?: number;
}

const ConflictVersionSelector: React.FC = () => {
    const navigate = useNavigate();
    const [allVersions, setAllVersions] = useState<ScheduleVersion[]>([]);
    const [versions, setVersions] = useState<ScheduleVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'previous'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const fetchVersions = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('schedule_versions')
                .select('id, version_number, is_active, change_type, change_summary, changed_at, changed_by, snapshot')
                .order('changed_at', { ascending: false })
                .limit(50);

            // Filter based on change_type and is_active
            if (filter === 'published') {
                query = query.eq('change_type', 'published').eq('is_active', true);
            } else if (filter === 'draft') {
                query = query.eq('change_type', 'created');
            } else if (filter === 'previous') {
                query = query.eq('is_active', false).neq('change_type', 'created');
            }

            const { data, error } = await query;
            if (error) throw error;
            
            // Add schedule count for each version from the snapshot
            const versionsWithCounts = (data || []).map((v: ScheduleVersion) => {
                const snapshot = v.snapshot as unknown[] | undefined;
                const schedules = Array.isArray(snapshot) ? snapshot : [];
                const count = schedules.length;
                return { ...v, schedule_count: count };
            });

            setVersions(versionsWithCounts);
        } catch (err) {
            console.error('Failed to fetch versions:', err);
        } finally {
            setLoading(false);
        }
    }, [filter]);

    // Fetch all versions for stats (without filter)
    const fetchAllVersions = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('schedule_versions')
                .select('id, version_number, is_active, change_type, change_summary, changed_at, changed_by, snapshot')
                .order('changed_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            
            // Add schedule count for each version from the snapshot
            const versionsWithCounts = (data || []).map((v: ScheduleVersion) => {
                const snapshot = v.snapshot as unknown[] | undefined;
                const schedules = Array.isArray(snapshot) ? snapshot : [];
                const count = schedules.length;
                return { ...v, schedule_count: count };
            });

            setAllVersions(versionsWithCounts);
        } catch (err) {
            console.error('Failed to fetch all versions:', err);
        }
    }, []);

    useEffect(() => {
        fetchVersions();
        fetchAllVersions();
    }, [fetchVersions, fetchAllVersions]);

    const filteredVersions = versions.filter(v => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                v.change_summary?.toLowerCase().includes(query) ||
                v.change_type?.toLowerCase().includes(query) ||
                v.version_number.toString().includes(query) ||
                v.changed_by.toLowerCase().includes(query)
            );
        }
        return true;
    }).sort((a, b) => {
        // Published versions always come first
        if (a.change_type === 'publish' && b.change_type !== 'publish') return -1;
        if (a.change_type !== 'publish' && b.change_type === 'publish') return 1;
        // Then sort by date descending
        return new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime();
    });

    const formatDate = (d: string) => new Date(d).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });

    const getChangeTypeLabel = (changeType: string) => {
        switch (changeType) {
            case 'created': return 'Draft';
            case 'publish': return 'Published';
            case 'updated': return 'Updated';
            case 'deleted': return 'Deleted';
            case 'status_change': return 'Status Change';
            case 'checkpoint': return 'Checkpoint';
            case 'overwrite': return 'Overwrite';
            case 'restore': return 'Restore';
            default: return changeType;
        }
    };

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

            <div className="scrollable-container">

            {/* Stats */}
            <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-icon"><Layers size={20} /></div>
                    <div className="stat-number">{allVersions.length}</div>
                    <div className="stat-label">Total Versions</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><AlertTriangle size={20} /></div>
                    <div className="stat-number">{allVersions.filter(v => v.change_type === 'publish' && v.is_active).length}</div>
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
                    <button
                        className={`sg-chip ${filter === 'previous' ? 'sg-chip-active' : ''}`}
                        onClick={() => setFilter('previous')}
                    >
                        Previous
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
                                borderLeft: `3px solid ${v.change_type === 'publish' && v.is_active ? '#34d399' : 'var(--border-default)'}`,
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
                                        {v.change_type === 'publish' && v.is_active && (
                                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(34,197,94,0.12)', color: '#34d399', fontWeight: 700 }}>
                                                ACTIVE
                                            </span>
                                        )}
                                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.12)', color: '#60a5fa', fontWeight: 600, textTransform: 'capitalize' }}>
                                            {getChangeTypeLabel(v.change_type)}
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
                                            <Clock size={12} /> {formatDate(v.changed_at)}
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
        </div>
    );
};

export default ConflictVersionSelector;
