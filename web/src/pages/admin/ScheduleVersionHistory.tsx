import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, History, GitCompare, RotateCcw, Clock, User, FileText, Trash2, CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';
import { scheduleVersionService, type ScheduleVersion } from '../../services/scheduleVersionService';
import { supabase } from '../../lib/supabase';
import '../admin/Dashboard.css';

interface VersionComparisonItem {
    field: string;
    old_value: string | null;
    new_value: string | null;
    change_type: string;
}

interface ScheduleVersionHistoryProps {
    scheduleId: string;
    scheduleName: string;
    onBack: () => void;
}

const ScheduleVersionHistory: React.FC<ScheduleVersionHistoryProps> = ({ scheduleId, scheduleName, onBack }) => {
    const { role, roles, user } = useAuth();
    const allRoles = roles.length > 0 ? roles : (role ? [role] : []);
    const canManage = allRoles.some(r => ['schedule_manager', 'schedule_admin', 'system_admin', 'power_admin'].includes(r));

    // Initialize scheduleVersionService
    useEffect(() => {
        if (user && supabase) {
            scheduleVersionService.initialize(supabase, user.id);
        }
    }, [user]);
    
    const [versions, setVersions] = useState<ScheduleVersion[]>([]);
    const [selectedVersions, setSelectedVersions] = useState<{ v1: ScheduleVersion | null; v2: ScheduleVersion | null }>({ v1: null, v2: null });
    const [comparisons, setComparisons] = useState<VersionComparisonItem[]>([]);
    const [showCompare, setShowCompare] = useState(false);
    const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
    const [rollbackVersion, setRollbackVersion] = useState<ScheduleVersion | null>(null);
    const [rollbackReason, setRollbackReason] = useState('');
    const [showCheckpoint, setShowCheckpoint] = useState(false);
    const [checkpointSummary, setCheckpointSummary] = useState('');
    const [checkpointReason, setCheckpointReason] = useState('');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const loadVersions = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await scheduleVersionService.getVersionHistory(scheduleId);
            setVersions(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load version history');
        } finally {
            setLoading(false);
        }
    }, [scheduleId]);

    useEffect(() => {
        loadVersions();
    }, [loadVersions]);

    const handleCompare = async () => {
        if (!selectedVersions.v1 || !selectedVersions.v2) return;
        
        try {
            setActionLoading(true);
            setError(null);
            const comparison = await scheduleVersionService.compareVersions(selectedVersions.v1.id, selectedVersions.v2.id);
            if (comparison && comparison.differences) {
                // Convert differences to array format expected by UI
                const comparisonArray = Object.entries(comparison.differences).map(([field, diff]) => ({
                    field,
                    old_value: (diff as { before: unknown }).before?.toString() || null,
                    new_value: (diff as { after: unknown }).after?.toString() || null,
                    change_type: (diff as { changed: boolean }).changed ? 'modified' : 'unchanged',
                })) as VersionComparisonItem[];
                setComparisons(comparisonArray);
                setShowCompare(true);
            } else {
                setComparisons([]);
                setShowCompare(true);
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to compare versions');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRollback = async () => {
        if (!rollbackVersion) return;
        
        try {
            setActionLoading(true);
            setError(null);
            const result = await scheduleVersionService.restoreVersion(rollbackVersion.id, {
                reason: rollbackReason,
                force: true,
            });
            if (result.success) {
                setSuccess(`Successfully rolled back to version ${rollbackVersion.version_number}`);
                setShowRollbackConfirm(false);
                setRollbackVersion(null);
                setRollbackReason('');
                loadVersions();
            } else {
                setError(result.message || 'Failed to rollback version');
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to rollback version');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCreateCheckpoint = async () => {
        if (!checkpointSummary.trim()) return;
        
        try {
            setActionLoading(true);
            setError(null);
            // Checkpoints are not directly supported in the new service
            // For now, disable this feature or show a message
            setError('Checkpoint feature not yet implemented in the new versioning system');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create checkpoint');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteVersion = async (version: ScheduleVersion) => {
        if (!confirm(`Delete version ${version.version_number}? This cannot be undone.`)) return;
        
        try {
            setActionLoading(true);
            setError(null);
            const result = await scheduleVersionService.deleteVersion(version.id);
            if (result.success) {
                setSuccess('Version deleted successfully');
                loadVersions();
            } else {
                setError(result.message || 'Failed to delete version');
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to delete version');
        } finally {
            setActionLoading(false);
        }
    };

    const selectForCompare = (version: ScheduleVersion, slot: 'v1' | 'v2') => {
        setSelectedVersions(prev => {
            // If clicking the same version in the same slot, deselect it
            if (prev[slot]?.id === version.id) {
                return { ...prev, [slot]: null };
            }
            // If clicking the same version in the other slot, swap
            if (prev[slot === 'v1' ? 'v2' : 'v1']?.id === version.id) {
                return { ...prev, [slot]: null };
            }
            return { ...prev, [slot]: version };
        });
    };

    const getChangeTypeIcon = (changeType: string) => {
        switch (changeType) {
            case 'created':
                return <CheckCircle size={16} className="text-green-500" />;
            case 'updated':
                return <Clock size={16} className="text-blue-500" />;
            case 'deleted':
                return <XCircle size={16} className="text-red-500" />;
            case 'status_change':
                return <AlertTriangle size={16} className="text-amber-500" />;
            case 'checkpoint':
                return <FileText size={16} className="text-purple-500" />;
            case 'publish':
                return <CheckCircle size={16} className="text-emerald-500" />;
            case 'overwrite':
                return <AlertTriangle size={16} className="text-orange-500" />;
            case 'restore':
                return <RotateCcw size={16} className="text-indigo-500" />;
            default:
                return null;
        }
    };

    const formatChangeType = (changeType: string) => {
        switch (changeType) {
            case 'created':
                return 'Created';
            case 'updated':
                return 'Updated';
            case 'deleted':
                return 'Deleted';
            case 'status_change':
                return 'Status Change';
            case 'checkpoint':
                return 'Checkpoint';
            case 'publish':
                return 'Published';
            case 'overwrite':
                return 'Overwritten';
            case 'restore':
                return 'Restored';
            default:
                return changeType;
        }
    };

    const formatComparisonChangeType = (changeType: string) => {
        switch (changeType) {
            case 'added':
                return 'Added';
            case 'removed':
                return 'Removed';
            case 'modified':
                return 'Modified';
            case 'unchanged':
                return 'Unchanged';
            default:
                return changeType;
        }
    };

    const formatFieldName = (field: string) => {
        return field
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    };

    const getComparisonChangeTypeIcon = (changeType: string) => {
        switch (changeType) {
            case 'added':
                return <CheckCircle size={14} className="text-green-500" />;
            case 'removed':
                return <XCircle size={14} className="text-red-500" />;
            case 'modified':
                return <AlertTriangle size={14} className="text-amber-500" />;
            default:
                return null;
        }
    };

    return (
        <div className="dash-card" style={{ padding: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button 
                        onClick={onBack}
                        className="btn btn-ghost"
                        style={{ padding: 8 }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="page-header">
                        <h1>Version History</h1>
                        <p>{scheduleName}</p>
                    </div>
                </div>
                {canManage && (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={() => setShowCheckpoint(true)}
                            className="btn btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                            <FileText size={16} />
                            Create Checkpoint
                        </button>
                    </div>
                )}
            </div>

            {/* Error/Success Messages */}
            {error && (
                <div style={{ 
                    padding: 12, 
                    background: 'rgba(239, 68, 68, 0.1)', 
                    border: '1px solid rgba(239, 68, 68, 0.3)', 
                    borderRadius: 8, 
                    marginBottom: 16,
                    color: '#ef4444',
                    fontSize: 14
                }}>
                    {error}
                </div>
            )}
            {success && (
                <div style={{ 
                    padding: 12, 
                    background: 'rgba(34, 197, 94, 0.1)', 
                    border: '1px solid rgba(34, 197, 94, 0.3)', 
                    borderRadius: 8, 
                    marginBottom: 16,
                    color: '#22c55e',
                    fontSize: 14
                }}>
                    {success}
                </div>
            )}

            {/* Compare Selection Bar */}
            {(selectedVersions.v1 || selectedVersions.v2) && (
                <div style={{ 
                    padding: 16, 
                    background: 'var(--bg-subtle)', 
                    border: '1px solid var(--border-subtle)', 
                    borderRadius: 8, 
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Version A:</span>
                            {selectedVersions.v1 ? (
                                <span style={{ fontSize: 14, fontWeight: 600 }}>v{selectedVersions.v1.version_number}</span>
                            ) : (
                                <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Not selected</span>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Version B:</span>
                            {selectedVersions.v2 ? (
                                <span style={{ fontSize: 14, fontWeight: 600 }}>v{selectedVersions.v2.version_number}</span>
                            ) : (
                                <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Not selected</span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={handleCompare}
                        disabled={!selectedVersions.v1 || !selectedVersions.v2 || actionLoading}
                        className="btn btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                        <GitCompare size={16} />
                        Compare
                    </button>
                </div>
            )}

            {/* Version List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 48 }}>
                    <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading version history...</p>
                </div>
            ) : versions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48 }}>
                    <History size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No version history available</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {versions.map((version) => (
                        <div
                            key={version.id}
                            style={{
                                padding: 16,
                                background: selectedVersions.v1?.id === version.id || selectedVersions.v2?.id === version.id
                                    ? 'var(--bg-subtle)'
                                    : 'var(--bg-surface)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onClick={() => selectForCompare(version, selectedVersions.v1 ? 'v2' : 'v1')}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <div style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 8,
                                    background: 'var(--bg-subtle)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {getChangeTypeIcon(version.change_type)}
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: 14, fontWeight: 600 }}>
                                            Version {version.version_number}
                                        </span>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: 4,
                                            fontSize: 11,
                                            fontWeight: 500,
                                            textTransform: 'uppercase',
                                            background: 'var(--bg-subtle)',
                                            color: 'var(--text-secondary)'
                                        }}>
                                            {formatChangeType(version.change_type)}
                                        </span>
                                    </div>
                                    {version.change_summary && (
                                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                                            {version.change_summary}
                                        </p>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                                        <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <User size={12} />
                                            {version.changed_by}
                                        </span>
                                        <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Clock size={12} />
                                            {new Date(version.changed_at).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {canManage && (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setRollbackVersion(version);
                                            setShowRollbackConfirm(true);
                                        }}
                                        className="btn btn-secondary"
                                        style={{ padding: 8 }}
                                        title="Rollback to this version"
                                    >
                                        <RotateCcw size={16} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteVersion(version);
                                        }}
                                        className="btn btn-ghost"
                                        style={{ padding: 8, color: '#ef4444' }}
                                        title="Delete version"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Compare Modal */}
            {showCompare && (
                <div className="modal-overlay" onClick={() => setShowCompare(false)}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
                        <div className="modal-header">
                            <h2>Compare Versions</h2>
                            <button className="btn btn-ghost" onClick={() => setShowCompare(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                Comparing Version {selectedVersions.v1?.version_number} → Version {selectedVersions.v2?.version_number}
                            </p>
                        </div>
                        {comparisons.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 32 }}>
                                <GitCompare size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>No differences found</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                                {comparisons.map((comp, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            padding: 12,
                                            background: 'var(--bg-subtle)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: 6,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12
                                        }}
                                    >
                                        {getComparisonChangeTypeIcon(comp.change_type)}
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                                                {formatFieldName(comp.field)}
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                {comp.old_value !== null && (
                                                    <span style={{ color: '#ef4444' }}>{comp.old_value}</span>
                                                )}
                                                {comp.old_value !== null && comp.new_value !== null && (
                                                    <span style={{ margin: '0 4px' }}>→</span>
                                                )}
                                                {comp.new_value !== null && (
                                                    <span style={{ color: '#22c55e' }}>{comp.new_value}</span>
                                                )}
                                            </div>
                                        </div>
                                        <span style={{
                                            padding: '2px 6px',
                                            borderRadius: 4,
                                            fontSize: 11,
                                            fontWeight: 500,
                                            background: 'var(--bg-surface)',
                                            color: 'var(--text-secondary)'
                                        }}>
                                            {formatComparisonChangeType(comp.change_type)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Rollback Confirmation Modal */}
            {showRollbackConfirm && rollbackVersion && (
                <div className="modal-overlay" onClick={() => setShowRollbackConfirm(false)}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="modal-header">
                            <h2>Confirm Rollback</h2>
                            <button className="btn btn-ghost" onClick={() => setShowRollbackConfirm(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ marginBottom: 20 }}>
                            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
                                Are you sure you want to rollback to <strong>Version {rollbackVersion.version_number}</strong>?
                                This will restore the schedule to the state at that version.
                            </p>
                            {rollbackVersion.change_summary && (
                                <div style={{
                                    padding: 12,
                                    background: 'var(--bg-subtle)',
                                    borderRadius: 6,
                                    marginBottom: 16
                                }}>
                                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                                        {rollbackVersion.change_summary}
                                    </p>
                                </div>
                            )}
                            <div className="field">
                                <label className="field-label">ROLLBACK REASON (OPTIONAL)</label>
                                <textarea
                                    className="input"
                                    rows={3}
                                    value={rollbackReason}
                                    onChange={e => setRollbackReason(e.target.value)}
                                    placeholder="Why are you rolling back to this version?"
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowRollbackConfirm(false)}
                                className="btn btn-secondary"
                                disabled={actionLoading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRollback}
                                className="btn btn-primary"
                                disabled={actionLoading}
                                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                                <RotateCcw size={16} />
                                {actionLoading ? 'Rolling back...' : 'Confirm Rollback'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Checkpoint Modal */}
            {showCheckpoint && (
                <div className="modal-overlay" onClick={() => setShowCheckpoint(false)}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="modal-header">
                            <h2>Create Checkpoint</h2>
                            <button className="btn btn-ghost" onClick={() => setShowCheckpoint(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleCreateCheckpoint(); }}>
                            <div className="field">
                                <label className="field-label">SUMMARY *</label>
                                <input
                                    className="input"
                                    required
                                    value={checkpointSummary}
                                    onChange={e => setCheckpointSummary(e.target.value)}
                                    placeholder="e.g., Before major schedule changes"
                                />
                            </div>
                            <div className="field">
                                <label className="field-label">REASON (OPTIONAL)</label>
                                <textarea
                                    className="input"
                                    rows={3}
                                    value={checkpointReason}
                                    onChange={e => setCheckpointReason(e.target.value)}
                                    placeholder="Detailed reason for creating this checkpoint..."
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                                <button
                                    type="button"
                                    onClick={() => setShowCheckpoint(false)}
                                    className="btn btn-secondary"
                                    disabled={actionLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={actionLoading || !checkpointSummary.trim()}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                                >
                                    <FileText size={16} />
                                    {actionLoading ? 'Creating...' : 'Create Checkpoint'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScheduleVersionHistory;
