/**
 * Schedule Versions - Version Grid
 * 
 * Shows a grid of published schedule versions (v1a, v1b, etc.)
 * Each version represents a published schedule snapshot.
 * Clicking a version navigates to view that version's schedule data.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, CheckCircle, AlertTriangle, ArrowRight, ArrowLeft, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import '../admin/Dashboard.css';

interface ScheduleVersion {
    id: string;
    schedule_id: string;
    version_number: number;
    snapshot: any;
    change_type: string;
    change_summary: string;
    changed_by: string;
    changed_at: string;
    is_active: boolean;
}

const ScheduleVersions: React.FC = () => {
    const navigate = useNavigate();

    const [versions, setVersions] = useState<ScheduleVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'published' | 'submitted' | 'draft'>('all');

    const loadVersions = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            // Load all schedule versions
            const { data: versionData, error: versionsError } = await supabase
                .from('schedule_versions')
                .select('*')
                .order('changed_at', { ascending: false });
            
            if (versionsError) throw versionsError;
            
            // Filter versions based on change_type
            let filteredVersions = versionData || [];
            
            if (filter !== 'all') {
                // Map filter to change_type values
                const changeTypeMap: Record<string, string[]> = {
                    'published': ['publish', 'overwrite', 'restore'],
                    'submitted': ['submitted'],
                    'draft': ['draft'], // Only show explicit draft versions, not auto-generated ones
                };
                
                const targetTypes = changeTypeMap[filter] || [];
                filteredVersions = filteredVersions.filter(v => targetTypes.includes(v.change_type));
            } else {
                // For 'all', show all meaningful version types
                filteredVersions = filteredVersions.filter(v => 
                    ['publish', 'overwrite', 'restore', 'submitted', 'draft'].includes(v.change_type)
                );
            }
            
            // Only create virtual version for 'all' or 'published' when no actual versions exist
            // For 'submitted' and 'draft', just show empty if no versions
            if ((filter === 'all' || filter === 'published') && filteredVersions.length === 0) {
                // Check if there are any current schedules
                const { data: currentSchedules, error: schedulesError } = await supabase
                    .from('schedules')
                    .select('id, status, academic_year, semester')
                    .limit(1);
                
                if (!schedulesError && currentSchedules && currentSchedules.length > 0) {
                    // Create a virtual version representing current schedules
                    const virtualVersion: ScheduleVersion = {
                        id: 'current',
                        schedule_id: 'current',
                        version_number: 1,
                        snapshot: null, // Will load current schedules when viewed
                        change_type: 'current',
                        change_summary: 'Current schedules',
                        changed_by: 'system',
                        changed_at: new Date().toISOString(),
                        is_active: true,
                    };
                    setVersions([virtualVersion]);
                } else {
                    setVersions([]);
                }
            } else {
                setVersions(filteredVersions);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load versions');
        } finally {
            setLoading(false);
        }
    }, [filter]);

    useEffect(() => {
        loadVersions();
    }, [loadVersions]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getVersionLabel = (index: number) => {
        // Generate labels like v1a, v1b, v1c, etc.
        const letter = String.fromCharCode(97 + (index % 26)); // a, b, c, ...
        const number = Math.floor(index / 26) + 1;
        return `v${number}${letter}`;
    };

    const handleViewVersion = (version: ScheduleVersion) => {
        // Navigate to schedules view with version ID (or 'current' for current schedules)
        if (version.id === 'current') {
            navigate('/admin/schedules');
        } else {
            navigate(`/admin/schedules?version=${version.id}`);
        }
    };

    return (
        <div className="dashboard fade-in">
            {/* Header */}
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title"><History size={20} /> Schedule Versions</h1>
                    <p className="dashboard-subtitle">View published schedule snapshots</p>
                </div>
                <button 
                    onClick={() => navigate(-1)}
                    className="btn btn-secondary"
                    style={{
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                    }}
                >
                    <ArrowLeft size={16} />
                    Back
                </button>
            </div>

            {/* Version Filters */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }} role="radiogroup" aria-label="Version filter">
                {[
                    { key: 'all', label: 'All' },
                    { key: 'published', label: 'Published' },
                    { key: 'submitted', label: 'Submitted' },
                    { key: 'draft', label: 'Drafts' },
                ].map(f => (
                    <button
                        key={f.key}
                        type="button"
                        role="radio"
                        aria-checked={filter === f.key}
                        className={`sg-chip ${filter === f.key ? 'sg-chip-active' : ''}`}
                        onClick={() => setFilter(f.key as any)}
                        style={{
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-light)',
                            backgroundColor: filter === f.key ? 'var(--accent-primary)' : 'var(--surface-soft)',
                            color: filter === f.key ? 'white' : 'var(--text-primary)',
                            cursor: 'pointer',
                            fontSize: 13,
                        }}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Error Message */}
            {error && (
                <div className="card" style={{ 
                    marginBottom: 24, 
                    padding: '16px',
                    backgroundColor: 'var(--accent-error-10, rgba(200, 75, 75, 0.1))',
                    border: '1px solid var(--accent-error)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                }}>
                    <AlertTriangle size={20} style={{ color: 'var(--accent-error)', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>{error}</span>
                </div>
            )}

            {/* Version Sets Grid */}
            {loading ? (
                <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
                    <div className="spin" style={{ fontSize: 32, color: 'var(--accent-info)' }}>⟳</div>
                    <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>Loading version sets...</p>
                </div>
            ) : versions.length === 0 ? (
                <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
                    <History size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                    <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>No Versions Yet</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Publish a schedule to create the first version.</p>
                    <button 
                        className="btn btn-primary"
                        onClick={() => navigate('/admin/generate')}
                    >
                        Go to Generate Tab
                    </button>
                </div>
            ) : (
                <div style={{ 
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 16
                }}>
                    {versions.map((version, index) => {
                        const versionLabel = getVersionLabel(index);
                        const snapshot = version.snapshot as any;
                        
                        return (
                            <div 
                                key={version.id}
                                className="card"
                                style={{
                                    padding: '20px',
                                    cursor: 'pointer',
                                    transition: 'transform 150ms ease, box-shadow 150ms ease',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 12
                                }}
                                onClick={() => handleViewVersion(version)}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(15, 40, 84, 0.12)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                {/* Version Label */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 4
                                }}>
                                    <div style={{
                                        padding: '6px 12px',
                                        backgroundColor: version.is_active ? 'var(--accent-success-10, rgba(47, 143, 91, 0.1))' : 'var(--surface-soft)',
                                        border: version.is_active ? '2px solid var(--accent-success)' : '1px solid var(--border-light)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: version.is_active ? 'var(--accent-success)' : 'var(--text-primary)'
                                    }}>
                                        {versionLabel}
                                    </div>
                                    {version.is_active && (
                                        <CheckCircle size={16} style={{ color: 'var(--accent-success)' }} />
                                    )}
                                </div>

                                {/* Name */}
                                <div>
                                    <h3 style={{ 
                                        fontSize: 16, 
                                        fontWeight: 600, 
                                        margin: 0,
                                        color: 'var(--text-primary)'
                                    }}>
                                        {version.id === 'current' ? 'Schedule (Current)' : `Schedule ${version.change_type === 'publish' ? '(Published)' : '(Saved)'}`}
                                    </h3>
                                    {version.change_summary && (
                                        <p style={{ 
                                            fontSize: 13, 
                                            color: 'var(--text-secondary)', 
                                            margin: '4px 0 0',
                                            lineHeight: 1.4
                                        }}>
                                            {version.change_summary}
                                        </p>
                                    )}
                                </div>

                                {/* Metadata */}
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 6,
                                    fontSize: 12,
                                    color: 'var(--text-muted)'
                                }}>
                                    {version.id !== 'current' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <FileText size={14} />
                                            <span>{snapshot?.academic_year || 'N/A'} · {snapshot?.semester || 'N/A'}</span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <History size={14} />
                                        <span>{version.id === 'current' ? 'Current schedules' : formatDate(version.changed_at)}</span>
                                    </div>
                                </div>

                                {/* View Button */}
                                <button 
                                    className="btn btn-secondary"
                                    style={{ marginTop: 'auto', width: '100%' }}
                                >
                                    View Schedule
                                    <ArrowRight size={14} style={{ marginLeft: 8 }} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ScheduleVersions;
