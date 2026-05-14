/**
 * Schedule Versions - Version Grid
 * 
 * Shows a grid of published schedule versions (v1a, v1b, etc.)
 * Each version represents a published schedule snapshot.
 * Clicking a version navigates to view that version's schedule data.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, CheckCircle, AlertTriangle, ArrowRight, FileText, Trash2, Archive, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmDialog } from '../../components/states/ConfirmDialog';
// Temporarily disabled audit logging - log_audit RPC function doesn't exist
// import { logAudit } from '../../services/auditService';
import '../admin/Dashboard.css';

interface ScheduleVersion {
    id: string;
    schedule_id: string;
    version_number: number;
    snapshot: unknown;
    change_type: string;
    change_summary: string;
    changed_by: string;
    changed_at: string;
    is_active: boolean;
}

type LabeledVersion = ScheduleVersion & { label?: string };

const ScheduleVersions: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { role, roles } = useAuth();
    const allRoles = roles.length > 0 ? roles : (role ? [role] : []);
    const isPowerAdmin = allRoles.some(r => r === 'admin' || r === 'power_admin');
    
    // Confirmation dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', onConfirm: () => {} });

    const [versions, setVersions] = useState<LabeledVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'published' | 'previous' | 'submitted' | 'draft' | 'archived'>('all');
    const [isDeletingAll, setIsDeletingAll] = useState(false);
    
    // Advanced date filters
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const loadVersions = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            // Build query with date filters
            let query = supabase
                .from('schedule_versions')
                .select('*')
                .order('changed_at', { ascending: true });
            
            if (dateFrom) {
                query = query.gte('changed_at', dateFrom);
            }
            if (dateTo) {
                query = query.lte('changed_at', dateTo);
            }
            
            const { data: rawVersionData, error: versionsError } = await query;
            
            if (versionsError) throw versionsError;
            
            const allVersions: LabeledVersion[] = rawVersionData || [];
            
            // Check if there is an active published version
            const hasActivePublished = allVersions.some(v => v.is_active && ['publish', 'overwrite', 'restore'].includes(v.change_type));
            
            // Only add virtual current version if:
            // 1. No active published version exists in history
            // 2. There are current published schedules in the database
            // 3. The filter is 'all' or 'published' (not draft/previous/submitted)
            const shouldAddVirtualVersion = !hasActivePublished && (filter === 'all' || filter === 'published');
            
            if (shouldAddVirtualVersion) {
                const { data: currentSchedules, error: schedulesError } = await supabase
                    .from('schedules')
                    .select('id, status, academic_year, semester, created_at')
                    .eq('status', 'published')
                    .eq('is_active', true)
                    .order('created_at', { ascending: true })
                    .limit(1);
                
                if (!schedulesError && currentSchedules && currentSchedules.length > 0) {
                    const createdAt = currentSchedules[0].created_at || new Date(0).toISOString();
                    const withinDateFrom = dateFrom ? new Date(createdAt) >= new Date(dateFrom) : true;
                    const withinDateTo = dateTo ? new Date(createdAt) <= new Date(dateTo) : true;

                    if (withinDateFrom && withinDateTo) {
                        const virtualVersion: ScheduleVersion = {
                            id: 'current',
                            schedule_id: 'current',
                            version_number: 1,
                            snapshot: null, // Will load current schedules when viewed
                            change_type: 'publish', // acts as a publish
                            change_summary: 'Current active schedules',
                            changed_by: 'system',
                            changed_at: createdAt, // Use oldest date
                            is_active: true,
                        };
                        allVersions.push(virtualVersion);
                    }
                }
            }

            // Assign absolute labels based on chronological order
            // Only assign labels to things that count as "major" versions?
            // Actually, draft, submitted, publish all get chronological labels
            allVersions.forEach((v, index) => {
                const letter = String.fromCharCode(97 + (index % 26)); // a, b, c
                const number = Math.floor(index / 26) + 1;
                v.label = `v${number}${letter}`;
            });

            // Now sort descending for newest-first display
            allVersions.sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());

            // Filter versions based on category rules
            let filteredVersions = allVersions;

            if (filter !== 'all') {
                if (filter === 'published') {
                    // Active published versions only (including restored versions)
                    filteredVersions = filteredVersions.filter(v =>
                        v.is_active && (
                            ['publish', 'overwrite', 'restore'].includes(v.change_type) ||
                            (v.change_type === 'status_change' && v.change_summary === 'Version restored from archive')
                        )
                    );
                } else if (filter === 'previous') {
                    // Inactive published versions (including restored versions)
                    filteredVersions = filteredVersions.filter(v =>
                        !v.is_active && (
                            ['publish', 'overwrite', 'restore'].includes(v.change_type) ||
                            (v.change_type === 'status_change' && v.change_summary === 'Version restored from archive')
                        )
                    );
                } else if (filter === 'submitted') {
                    filteredVersions = filteredVersions.filter(v =>
                        ['status_change'].includes(v.change_type) &&
                        !(v.change_summary === 'Version archived' || v.change_summary === 'Version restored from archive')
                    );
                } else if (filter === 'draft') {
                    filteredVersions = filteredVersions.filter(v => ['created'].includes(v.change_type));
                } else if (filter === 'archived') {
                    filteredVersions = filteredVersions.filter(v => v.change_type === 'status_change' && v.change_summary === 'Version archived');
                }
            } else {
                // For 'all', show all meaningful version types except archived
                filteredVersions = filteredVersions.filter(v =>
                    ['publish', 'overwrite', 'restore', 'status_change', 'created'].includes(v.change_type) &&
                    !(v.change_type === 'status_change' && v.change_summary === 'Version archived')
                );
            }
            
            setVersions(filteredVersions);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load versions');
        } finally {
            setLoading(false);
        }
    }, [filter, dateFrom, dateTo]);

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

    const clearDateFilters = () => {
        setDateFrom('');
        setDateTo('');
    };



    const handleViewVersion = (version: ScheduleVersion) => {
        // Navigate to schedules view with version ID (or 'current' for current schedules)
        if (version.id === 'current') {
            navigate('/admin/schedules/current');
        } else {
            navigate(`/admin/schedules/current?version=${version.id}`);
        }
    };

    const handleDeleteAllSchedules = async () => {
        if (!isPowerAdmin) {
            showToast({ title: 'Permission denied', message: 'Only Power Admin can delete all schedules', type: 'error' });
            return;
        }

        setConfirmDialog({
            open: true,
            title: '⚠️ DANGER: Delete All Schedules',
            message: 'This will permanently delete ALL schedules and ALL versions including all historical data. This action cannot be undone. Are you absolutely sure?',
            onConfirm: async () => {
                setIsDeletingAll(true);

                try {
                    // Log audit before deletion
                    // await logAudit('delete_all', 'schedules', null, {
                    //     deleted_by: user?.id,
                    //     reason: 'Power Admin deleted all schedules'
                    // });

                    // Delete all schedule versions first (due to foreign key constraints)
                    const { error: versionsError } = await supabase
                        .from('schedule_versions')
                        .delete()
                        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

                    if (versionsError) {
                        console.error('Error deleting schedule versions:', versionsError);
                        throw versionsError;
                    }

                    // Delete all schedules
                    const { error: schedulesError } = await supabase
                        .from('schedules')
                        .delete()
                        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

                    if (schedulesError) {
                        console.error('Error deleting schedules:', schedulesError);
                        throw schedulesError;
                    }

                    showToast({ title: 'All schedules deleted', type: 'success' });

                    // Refresh the versions
                    loadVersions();
                } catch (err: unknown) {
                    console.error('Failed to delete all schedules:', err);
                    showToast({ title: 'Failed to delete', message: err instanceof Error ? err.message : String(err), type: 'error' });
                } finally {
                    setIsDeletingAll(false);
                }
            }
        });
    };

    const handleArchiveVersion = (version: LabeledVersion) => {
        if (!isPowerAdmin) {
            showToast({ title: 'Permission denied', message: 'Only Power Admin can archive versions', type: 'error' });
            return;
        }

        if (version.id === 'current') {
            showToast({ title: 'Cannot archive', message: 'Cannot archive current schedules', type: 'error' });
            return;
        }

        if (version.is_active) {
            showToast({ title: 'Cannot archive', message: 'Cannot archive active version. Please deactivate it first.', type: 'error' });
            return;
        }

        if (version.change_type === 'status_change' && version.change_summary === 'Version archived') {
            showToast({ title: 'Already archived', message: 'This version is already archived', type: 'error' });
            return;
        }

        setConfirmDialog({
            open: true,
            title: 'Archive Schedule Version',
            message: `This will archive version ${version.label || 'N/A'} and mark all associated schedules as archived. Archived schedules are not visible in main views but can be restored. Are you sure?`,
            onConfirm: async () => {
                try {
                    console.log('[SCHEDULE VERSIONS] Archiving version:', version.id, version.label);

                    // Update the version change_type to 'status_change'
                    const { error: updateVersionError } = await supabase
                        .from('schedule_versions')
                        .update({
                            change_type: 'status_change',
                            change_summary: 'Version archived',
                        })
                        .eq('id', version.id);

                    if (updateVersionError) {
                        console.error('[SCHEDULE VERSIONS] Failed to update version to archive:', updateVersionError);
                        throw updateVersionError;
                    }

                    console.log('[SCHEDULE VERSIONS] Version updated to archive, getting batch_id');

                    // Get the batch_id from the version
                    const { data: versionData } = await supabase
                        .from('schedule_versions')
                        .select('batch_id')
                        .eq('id', version.id)
                        .single();

                    if (versionData?.batch_id) {
                        console.log('[SCHEDULE VERSIONS] Updating schedules in batch:', versionData.batch_id);
                        // Update the schedules in this batch to 'archived' status
                        const { error: updateSchedulesError } = await supabase
                            .from('schedules')
                            .update({ status: 'archived' })
                            .eq('batch_id', versionData.batch_id);

                        if (updateSchedulesError) {
                            console.error('[SCHEDULE VERSIONS] Failed to update schedules to archived:', updateSchedulesError);
                            throw updateSchedulesError;
                        }
                        console.log('[SCHEDULE VERSIONS] Schedules updated to archived');
                    } else {
                        console.warn('[SCHEDULE VERSIONS] No batch_id found for version');
                    }

                    showToast({ title: 'Version archived', type: 'success' });

                    // Refresh the versions
                    loadVersions();
                } catch (err: unknown) {
                    console.error('[SCHEDULE VERSIONS] Failed to archive version:', err);
                    showToast({ title: 'Failed to archive', message: err instanceof Error ? err.message : String(err), type: 'error' });
                }
            }
        });
    };

    const handleUnarchiveVersion = (version: LabeledVersion) => {
        if (!isPowerAdmin) {
            showToast({ title: 'Permission denied', message: 'Only Power Admin can unarchive versions', type: 'error' });
            return;
        }

        if (version.id === 'current') {
            showToast({ title: 'Cannot unarchive', message: 'Cannot unarchive current schedules', type: 'error' });
            return;
        }

        if (!(version.change_type === 'status_change' && version.change_summary === 'Version archived')) {
            showToast({ title: 'Not archived', message: 'This version is not archived', type: 'error' });
            return;
        }

        setConfirmDialog({
            open: true,
            title: 'Unarchive Schedule Version',
            message: `This will unarchive version ${version.label || 'N/A'} and restore all associated schedules. Are you sure?`,
            onConfirm: async () => {
                try {
                    console.log('[SCHEDULE VERSIONS] Unarchiving version:', version.id, version.label);

                    // Get the batch_id from the version
                    const { data: versionData } = await supabase
                        .from('schedule_versions')
                        .select('batch_id')
                        .eq('id', version.id)
                        .single();

                    if (versionData?.batch_id) {
                        console.log('[SCHEDULE VERSIONS] Restoring schedules in batch:', versionData.batch_id);
                        // Update the schedules in this batch to 'published' status
                        const { error: updateSchedulesError } = await supabase
                            .from('schedules')
                            .update({ status: 'published' })
                            .eq('batch_id', versionData.batch_id);

                        if (updateSchedulesError) {
                            console.error('[SCHEDULE VERSIONS] Failed to restore schedules:', updateSchedulesError);
                            throw updateSchedulesError;
                        }
                        console.log('[SCHEDULE VERSIONS] Schedules restored to published');
                    } else {
                        console.warn('[SCHEDULE VERSIONS] No batch_id found for version');
                    }

                    // Update the version change_summary to indicate it was restored
                    const { error: updateVersionError } = await supabase
                        .from('schedule_versions')
                        .update({
                            change_summary: 'Version restored from archive',
                        })
                        .eq('id', version.id);

                    if (updateVersionError) {
                        console.error('[SCHEDULE VERSIONS] Failed to update version:', updateVersionError);
                        throw updateVersionError;
                    }

                    showToast({ title: 'Version unarchived', type: 'success' });

                    // Refresh the versions
                    loadVersions();
                } catch (err: unknown) {
                    console.error('[SCHEDULE VERSIONS] Failed to unarchive version:', err);
                    showToast({ title: 'Failed to unarchive', message: err instanceof Error ? err.message : String(err), type: 'error' });
                }
            }
        });
    };

    return (
        <div className="dashboard fade-in">
            {/* Header */}
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title"><History size={20} /> Schedule Versions</h1>
                    <p className="dashboard-subtitle">View published schedule snapshots</p>
                </div>
                {isPowerAdmin && (
                    <button
                        onClick={handleDeleteAllSchedules}
                        disabled={isDeletingAll}
                        className="btn"
                        style={{
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            backgroundColor: 'var(--accent-error-10, rgba(200, 75, 75, 0.1))',
                            border: '1px solid var(--accent-error)',
                            color: 'var(--accent-error)',
                        }}
                    >
                        {isDeletingAll ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Trash2 size={16} />}
                        {isDeletingAll ? 'Deleting...' : 'Delete All Schedules'}
                    </button>
                )}
            </div>

            {/* Version Filters */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }} role="radiogroup" aria-label="Version filter">
                {(
                    [
                        { key: 'all', label: 'All' },
                        { key: 'published', label: 'Published' },
                        { key: 'previous', label: 'Previous' },
                        { key: 'submitted', label: 'Submitted' },
                        { key: 'draft', label: 'Drafts' },
                        { key: 'archived', label: 'Archived' },
                    ] as const
                ).map(f => (
                    <button
                        key={f.key}
                        type="button"
                        role="radio"
                        aria-checked={filter === f.key}
                        className={`sg-chip ${filter === f.key ? 'sg-chip-active' : ''}`}
                        onClick={() => setFilter(f.key)}
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

            {/* Date Range Filters */}
            <div style={{ 
                display: 'flex', 
                gap: 12, 
                alignItems: 'center', 
                marginBottom: 16,
                padding: '12px 16px',
                backgroundColor: 'var(--surface-soft)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)'
            }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    Date Range:
                </span>
                <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-light)',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                    }}
                />
                <span style={{ color: 'var(--text-muted)' }}>to</span>
                <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-light)',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                    }}
                />
                {(dateFrom || dateTo) && (
                    <button
                        onClick={clearDateFilters}
                        style={{
                            padding: '6px 12px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--accent-error)',
                            backgroundColor: 'var(--accent-error-10, rgba(200, 75, 75, 0.1))',
                            color: 'var(--accent-error)',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                        }}
                    >
                        Clear
                    </button>
                )}
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
                    gap: 16,
                    maxHeight: 'calc(100vh - 300px)',
                    overflowY: 'auto'
                }}>
                    {versions.map((version) => {
                        const versionLabel = version.label || 'v1a';
                        const snapshot = version.snapshot;
                        
                        let academicYear = 'N/A';
                        let semester = 'N/A';
                        let scheduleCount = 0;
                        
                        if (Array.isArray(snapshot)) {
                            scheduleCount = snapshot.length;
                            if (snapshot.length > 0) {
                                const first = snapshot[0] as { academic_year?: string; semester?: string };
                                academicYear = first.academic_year || 'N/A';
                                semester = first.semester || 'N/A';
                            }
                        } else if (snapshot && typeof snapshot === 'object') {
                            const snapObj = snapshot as { academic_year?: string; semester?: string };
                            academicYear = snapObj.academic_year || 'N/A';
                            semester = snapObj.semester || 'N/A';
                            scheduleCount = 1; // It's a single schedule data object
                        }
                        const isGloballyActive = version.is_active && ['publish', 'overwrite', 'restore'].includes(version.change_type);
                        
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
                                    gap: 12,
                                    position: 'relative'
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
                                {isGloballyActive && (
                                    <CheckCircle 
                                        size={16} 
                                        style={{ 
                                            color: 'var(--accent-success)',
                                            position: 'absolute',
                                            top: '20px',
                                            right: '20px'
                                        }} 
                                    />
                                )}
                                {/* Version Label */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    marginBottom: 4
                                }}>
                                    <div style={{
                                        padding: '6px 12px',
                                        backgroundColor: isGloballyActive ? 'var(--accent-success-10, rgba(47, 143, 91, 0.1))' : 'var(--surface-soft)',
                                        border: isGloballyActive ? '2px solid var(--accent-success)' : '1px solid var(--border-light)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: isGloballyActive ? 'var(--accent-success)' : 'var(--text-primary)'
                                    }}>
                                        {versionLabel}
                                    </div>
                                </div>

                                {/* Name */}
                                <div>
                                    <h3 style={{
                                        fontSize: 16,
                                        fontWeight: 600,
                                        margin: 0,
                                        color: 'var(--text-primary)'
                                    }}>
                                        {isGloballyActive ? 'Schedule (Current)' :
                                         version.change_type === 'created' ? 'Schedule (Draft)' :
                                         version.change_type === 'status_change' && version.change_summary === 'Version archived' ? 'Schedule (Archived)' :
                                         version.change_type === 'status_change' && version.change_summary === 'Version restored from archive' ? 'Schedule (Published)' :
                                         version.change_type === 'status_change' ? 'Schedule (Submitted)' :
                                         ['publish', 'overwrite', 'restore'].includes(version.change_type) ? 'Schedule (Previous)' :
                                         'Schedule (Saved)'}
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
                                            <span>{academicYear} · {semester} ({scheduleCount} session{scheduleCount !== 1 ? 's' : ''})</span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <History size={14} />
                                        <span>{version.id === 'current' ? 'Current schedules' : formatDate(version.changed_at)}</span>
                                    </div>
                                </div>

                                {/* Archive/Unarchive Button (Power Admin only) */}
                                {isPowerAdmin && version.id !== 'current' && !version.is_active && (
                                    version.change_type === 'status_change' && version.change_summary === 'Version archived' ? (
                                        <button
                                            className="btn"
                                            style={{
                                                marginTop: 8,
                                                width: '100%',
                                                backgroundColor: 'var(--accent-success-10, rgba(34, 197, 94, 0.1))',
                                                border: '1px solid var(--accent-success)',
                                                color: 'var(--accent-success)',
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleUnarchiveVersion(version);
                                            }}
                                        >
                                            <RefreshCw size={14} style={{ marginRight: 6 }} />
                                            Unarchive
                                        </button>
                                    ) : (
                                        <button
                                            className="btn"
                                            style={{
                                                marginTop: 8,
                                                width: '100%',
                                                backgroundColor: 'var(--accent-warning-10, rgba(245, 158, 11, 0.1))',
                                                border: '1px solid var(--accent-warning)',
                                                color: 'var(--accent-warning)',
                                            }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleArchiveVersion(version);
                                            }}
                                        >
                                            <Archive size={14} style={{ marginRight: 6 }} />
                                            Archive
                                        </button>
                                    )
                                )}

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
            
            <ConfirmDialog
                open={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog({ ...confirmDialog, open: false })}
                confirmVariant="danger"
            />
        </div>
    );
};

export default ScheduleVersions;
