import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RefreshCw, AlertTriangle, CheckCircle, AlertOctagon, AlertCircle, Info, Search, Clock, ArrowLeft } from 'lucide-react';
import { type HardConstraintViolation, type ScanResult, scanAllConstraints } from './ConflictsAlerts/conflictScanner';
import { useToast } from '../../contexts/ToastContext';
import { scheduleStateManager } from '../../services/scheduleStateManager';
import { supabase } from '../../lib/supabase';

interface DetectedConflict {
    id: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    day: string;
    scheduleIds: string[];
    source: 'live' | 'db';
}

interface ConflictRow {
    id: string;
    conflict_original_id?: string;
    type: string;
    severity: string;
    title: string;
    description: string;
    schedule_a_id?: string;
    schedule_b_id?: string;
    is_resolved: boolean;
    created_at: string;
    resolved_at: string | null;
}

const ConflictsAlerts: React.FC = () => {
    const { showToast } = useToast();
    const { versionId } = useParams<{ versionId: string }>();
    const navigate = useNavigate();
    const [dbConflicts, setDbConflicts] = useState<ConflictRow[]>([]);
    const [detectedConflicts, setDetectedConflicts] = useState<DetectedConflict[]>([]);
    const [loading, setLoading] = useState(true);
    const [scanning, setScanning] = useState(false);
    const [showResolved, setShowResolved] = useState(false);
    const [filterType, setFilterType] = useState<string>('all');
    const [sortBy, setSortBy] = useState<string>('severity');
    const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(new Set());
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [showSoftScoreModal, setShowSoftScoreModal] = useState(false);
    const [fixProgress, setFixProgress] = useState({ current: 0, total: 0, currentViolation: '', overallProgress: 0 });
    const isMountedRef = useRef(true);
    const [hasScanResults, setHasScanResults] = useState(false);
    const [scanResultLock, setScanResultLock] = useState<string | null>(null);

    useEffect(() => {
        console.log('[STATE CHANGE] hasScanResults:', hasScanResults, 'lock:', scanResultLock);
    }, [hasScanResults, scanResultLock]);

    const fetchDbConflicts = useCallback(async () => {
        if (hasScanResults || scanResultLock) {
            console.log('[FETCH DB] BLOCKED - scan state protected', { hasScanResults, scanResultLock });
            return;
        }

        let scheduleIds: Set<string> = new Set();
        
        if (versionId) {
            const { data: versionData } = await supabase
                .from('schedule_versions')
                .select('snapshot')
                .eq('id', versionId)
                .single();
            
            if (versionData?.snapshot) {
                const snapshot = versionData.snapshot as { id: string }[] | { schedules: { id: string }[] };
                const schedules = Array.isArray(snapshot) ? snapshot : (snapshot.schedules || []);
                scheduleIds = new Set(schedules.map((s: { id: string }) => s.id).filter((id: string): id is string => !!id));
            }
        } else {
            const { data: schedules } = await supabase.from('schedules').select('id').eq('is_active', true);
            scheduleIds = new Set((schedules || []).map((s: { id: string }) => s.id));
        }
        
        if (scheduleIds.size === 0) {
            setDbConflicts([]);
            setDetectedConflicts([]);
            return;
        }
        
        const { data } = await supabase.from('conflicts')
            .select('*')
            .or(`schedule_a_id.in.(${Array.from(scheduleIds).join(',')}),schedule_b_id.in.(${Array.from(scheduleIds).join(',')})`)
            .order('is_resolved')
            .order('created_at', { ascending: false });
            
        setDbConflicts(data || []);
        
        if (!hasScanResults) {
            const unresolved = (data || []).filter((c: ConflictRow) => !c.is_resolved);
            const conflicts: DetectedConflict[] = unresolved.map((c: ConflictRow) => ({
                id: c.conflict_original_id || c.id,
                type: c.type,
                severity: c.severity,
                title: c.title,
                description: c.description,
                day: 'Multiple',
                scheduleIds: c.schedule_a_id ? [c.schedule_a_id] : [],
                source: 'db'
            }));
            setDetectedConflicts(conflicts);
        }
    }, [versionId, hasScanResults, scanResultLock]);

    const runComprehensiveScan = useCallback(async () => {
        const currentLockId = crypto.randomUUID();
        
        console.log('[SCAN START] Acquiring lock:', currentLockId);
        setScanResultLock(currentLockId);
        setScanning(true);
        setFixProgress({ current: 0, total: 14, currentViolation: 'Initializing scan...', overallProgress: 0 });
        
        try {
            let schedulesToScan: Record<string, unknown>[] = [];
            
            if (versionId) {
                const { data: versionData } = await supabase
                    .from('schedule_versions')
                    .select('snapshot')
                    .eq('id', versionId)
                    .single();
                
                if (versionData?.snapshot) {
                    const snapshot = versionData.snapshot as { id: string }[] | { schedules: { id: string }[] };
                    schedulesToScan = Array.isArray(snapshot) ? snapshot : (snapshot.schedules || []);
                }
            } else {
                const { data: schedulesData } = await supabase.from('schedules').select('*').eq('is_active', true);
                schedulesToScan = schedulesData || [];
            }
            
            const [teachersData, roomsData, sectionsData, subjectsData, breaksData] = await Promise.all([
                supabase.from('teachers').select('*, profile:profiles(*)').eq('is_active', true),
                supabase.from('rooms').select('*').eq('is_available', true),
                supabase.from('sections').select('*'),
                supabase.from('subjects').select('*'),
                supabase.from('institution_breaks').select('*'),
            ]);

            const result = await scanAllConstraints(
                schedulesToScan as any, 
                teachersData.data || [], 
                roomsData.data || [], 
                sectionsData.data || [], 
                subjectsData.data || [], 
                {
                    maxConsecutiveHours: 4,
                    maxDailyHours: 8,
                    maxDailyClasses: 6,
                    maxWeeklyHours: 40,
                    breakWindows: (breaksData.data || []).map((b: { start_time: string; end_time: string }) => ({ start: b.start_time, end: b.end_time })),
                },
                (progress: { current: number; total: number; currentPhase: string }) => {
                    if (isMountedRef.current) {
                        setFixProgress({
                            current: progress.current,
                            total: progress.total,
                            currentViolation: progress.currentPhase,
                            overallProgress: (progress.current / progress.total) * 100,
                        });
                    }
                }
            );

            setScanResult(result);
            
            const scanConflicts: DetectedConflict[] = result.hardViolations.map((v: HardConstraintViolation) => ({
                id: v.id,
                type: v.type,
                severity: v.severity,
                title: v.title,
                description: v.description,
                day: v.day || 'Multiple',
                scheduleIds: v.scheduleIds,
                source: 'live'
            }));
            
            setDetectedConflicts(scanConflicts);

            const { data: dbExisting } = await supabase.from('conflicts').select('id, conflict_original_id');
            const existingIds = new Set((dbExisting || []).map((c: { conflict_original_id?: string }) => c.conflict_original_id).filter((id): id is string => !!id));
            const detectedIds = new Set(result.hardViolations.map((v: HardConstraintViolation) => v.id));
            
            const { data: dbUnresolved } = await supabase.from('conflicts').select('id, conflict_original_id').eq('is_resolved', false);
            const unresolvedIds = new Set((dbUnresolved || []).map((c: { conflict_original_id?: string }) => c.conflict_original_id).filter((id): id is string => !!id));
            const resolvedIds = [...unresolvedIds].filter(id => !detectedIds.has(id));
            
            if (resolvedIds.length > 0) {
                await supabase.from('conflicts').update({ is_resolved: true, resolved_at: new Date().toISOString() }).in('conflict_original_id', resolvedIds);
            }
            
            const newConflicts = result.hardViolations.filter((v: HardConstraintViolation) => !existingIds.has(v.id));
            if (newConflicts.length > 0) {
                const conflictInserts = newConflicts.map((v: HardConstraintViolation) => ({
                    id: crypto.randomUUID(),
                    conflict_original_id: v.id,
                    type: v.type,
                    severity: v.severity,
                    title: v.title,
                    description: v.description,
                    schedule_a_id: v.scheduleIds?.[0] || null,
                    schedule_b_id: v.scheduleIds?.[1] || null,
                    is_resolved: false,
                    created_at: new Date().toISOString(),
                }));
                await supabase.from('conflicts').insert(conflictInserts);
            }
            
            // Save scan result to scan_results table for AdminDashboard to read
            await supabase.from('scan_results').insert({
                hard_violations_count: result.hardViolations.length,
                soft_score: result.softScore.totalScore,
                scanned_at: new Date().toISOString(),
            });
            
            setHasScanResults(true);
            
            showToast({
                type: 'success',
                title: 'Scan Complete',
                message: `Found ${result.hardViolations.length} conflicts.`,
            });
            
        } catch (error) {
            console.error('Scan failed:', error);
            setScanResultLock(null);
            showToast({ type: 'error', title: 'Scan Failed', message: 'Unable to complete scan.' });
        } finally {
            if (isMountedRef.current) {
                setScanning(false);
                setFixProgress({ current: 0, total: 0, currentViolation: '', overallProgress: 0 });
            }
        }
    }, [versionId, showToast]);

    useEffect(() => {
        isMountedRef.current = true;
        setHasScanResults(false);
        setScanResultLock(null);
        
        scheduleStateManager.initialize(supabase);
        const unsubscribe = scheduleStateManager.subscribe((event) => {
            if (event.source === 'generate' && event.type === 'schedule_updated') {
                setScanResult(null);
                setHasScanResults(false);
                setScanResultLock(null);
                runComprehensiveScan().catch(err => console.error('[ConflictsAlerts] Scan failed:', err));
            }
        });
        
        const init = async () => {
            setLoading(true);
            await fetchDbConflicts();
            if (isMountedRef.current) setLoading(false);
        };
        
        init();
        return () => {
            unsubscribe();
            isMountedRef.current = false;
        };
    }, [fetchDbConflicts, runComprehensiveScan]);

    useEffect(() => {
        if (!hasScanResults && !scanResultLock) {
            setScanResult(null);
            fetchDbConflicts();
        }
    }, [versionId, fetchDbConflicts, hasScanResults, scanResultLock]);

    const handleResolveDb = async (id: string) => {
        try {
            const { error } = await supabase.from('conflicts').update({
                is_resolved: true,
                resolved_at: new Date().toISOString(),
            }).eq('id', id);
            
            if (error) throw error;
            
            fetchDbConflicts();
            showToast({ type: 'success', title: 'Conflict Resolved', message: 'The conflict has been marked as resolved.' });
        } catch (error) {
            console.error('Failed to resolve conflict:', error);
            showToast({ type: 'error', title: 'Failed to Resolve Conflict', message: 'Please try again.' });
        }
    };

    const allConflicts = useMemo(() => {
        if (hasScanResults || scanResultLock) {
            return detectedConflicts.map(c => ({ ...c, source: 'live' as const, is_resolved: false, created_at: new Date().toISOString() }));
        }
        return dbConflicts.map(c => ({ 
            id: c.id,
            type: c.type,
            severity: c.severity,
            title: c.title,
            description: c.description,
            is_resolved: c.is_resolved,
            created_at: c.created_at,
            source: 'db' as const, 
            scheduleIds: [] as string[], 
            day: '' 
        }));
    }, [detectedConflicts, dbConflicts, hasScanResults, scanResultLock]);

    const unresolvedCount = useMemo(() => allConflicts.filter(c => !c.is_resolved).length, [allConflicts]);
    
    const filteredConflicts = useMemo(() => allConflicts.filter(c => {
        if (!showResolved && c.is_resolved) return false;
        if (filterType !== 'all' && c.type !== filterType) return false;
        return true;
    }), [allConflicts, showResolved, filterType]);

    const sortedConflicts = useMemo(() => [...filteredConflicts].sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        switch (sortBy) {
            case 'severity':
                return (severityOrder[a.severity as keyof typeof severityOrder] || 99) - 
                       (severityOrder[b.severity as keyof typeof severityOrder] || 99);
            case 'day':
                return (a.day || '').localeCompare(b.day || '');
            default:
                return 0;
        }
    }), [filteredConflicts, sortBy]);

    const getSeverityIcon = (severity: string) => {
        if (severity === 'critical') return <AlertOctagon size={12} aria-hidden="true" />;
        if (severity === 'high') return <AlertCircle size={12} aria-hidden="true" />;
        if (severity === 'medium') return <AlertTriangle size={12} aria-hidden="true" />;
        if (severity === 'low') return <Info size={12} aria-hidden="true" />;
        return null;
    };

    const getSeverityStyle = (severity: string) => {
        if (severity === 'critical') return { bg: 'rgba(200, 75, 75, 0.15)', color: '#C84B4B', border: '#C84B4B' };
        if (severity === 'high') return { bg: 'rgba(200, 75, 75, 0.15)', color: '#C84B4B', border: '#C84B4B' };
        if (severity === 'medium') return { bg: 'rgba(211, 139, 32, 0.15)', color: '#D38B20', border: '#D38B20' };
        if (severity === 'low') return { bg: 'rgba(73, 136, 196, 0.15)', color: '#4988C4', border: '#4988C4' };
        return { bg: 'rgba(100, 116, 139, 0.15)', color: '#64748B', border: '#64748B' };
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'room_conflict': return 'Room Conflict';
            case 'teacher_overlap': return 'Teacher Overlap';
            case 'section_overlap': return 'Section Overlap';
            case 'capacity_exceeded': return 'Capacity Exceeded';
            default: return type.replace(/_/g, ' ');
        }
    };

    const getTypeTooltip = (type: string) => {
        switch (type) {
            case 'teacher_overlap': return 'A teacher is scheduled for two different classes at the same time.';
            case 'room_overlap': return 'A room is assigned to two different classes at the same time.';
            case 'section_overlap': return 'A section has two different classes scheduled at the same time.';
            case 'room_capacity_exceeded': return 'The number of students exceeds the room capacity.';
            case 'room_subject_mismatch': return 'The room type does not match the subject requirements (e.g., lab required).';
            case 'teacher_unqualified': return 'The teacher assigned is not the preferred teacher for this subject.';
            case 'teacher_unavailable': return 'The teacher is marked as unavailable at this time.';
            case 'workload_limit_exceeded': return 'The teacher has exceeded their maximum weekly hours.';
            case 'break_violation': return 'A teacher does not have the required break between consecutive classes.';
            case 'weekly_hours_exceeded': return 'A teacher exceeds their allowed weekly teaching hours.';
            default: return type.replace(/_/g, ' ');
        }
    };

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header" style={{ margin: '12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    {versionId && (
                        <button
                            className="btn btn-secondary"
                            onClick={() => navigate('/admin/conflicts')}
                            style={{ marginBottom: 8, fontSize: 13, padding: '6px 12px' }}
                        >
                            <ArrowLeft size={14} /> Back to Versions
                        </button>
                    )}
                    <h1 className="dashboard-title"><AlertTriangle size={20} /> Conflicts & Alerts</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                        <p className="dashboard-subtitle" style={{ margin: 0 }}>
                            {hasScanResults || scanResultLock
                                ? `${detectedConflicts.length} conflict${detectedConflicts.length > 1 ? 's' : ''} found in scan`
                                : unresolvedCount > 0
                                ? `${unresolvedCount} active conflict${unresolvedCount > 1 ? 's' : ''} detected`
                                : 'No active conflicts'}
                        </p>
                    </div>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => runComprehensiveScan()}
                    disabled={scanning}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    aria-label={scanning ? 'Scanning for conflicts' : 'Scan for conflicts'}
                    title="Refresh scan"
                >
                    <RefreshCw size={16} className={scanning ? 'spinning' : ''} aria-hidden="true" />
                    {scanning ? 'Scanning...' : 'Scan Now'}
                </button>
            </div>

            <div className="stats-grid" style={{ marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <div className="stat-card">
                    <div className="stat-number">
                        {hasScanResults || scanResultLock ? detectedConflicts.length : dbConflicts.filter(c => !c.is_resolved).length}
                    </div>
                    <div className="stat-label">Total</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number" style={{ color: (hasScanResults || scanResultLock ? detectedConflicts.length : unresolvedCount) > 0 ? '#C84B4B' : undefined }}>
                        {hasScanResults || scanResultLock ? detectedConflicts.length : unresolvedCount}
                    </div>
                    <div className="stat-label">Active</div>
                </div>
                <div className="stat-card">
                    <div className="stat-number">{detectedConflicts.filter(c => c.severity === 'high').length}</div>
                    <div className="stat-label">High Severity</div>
                </div>
                <div 
                    className="stat-card" 
                    style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                    onClick={() => setShowSoftScoreModal(true)}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            setShowSoftScoreModal(true);
                        }
                    }}
                    aria-label="View soft score breakdown details"
                >
                    <div className="stat-number">{scanResult?.softScore?.totalScore ?? 0}</div>
                    <div className="stat-label">Soft Score</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Click for details</div>
                </div>
            </div>

            {scanning && (
                <div className="card" style={{ marginBottom: 24, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: 16 }}>Scanning Schedule</h3>
                    </div>
                    <div style={{ marginBottom: 12, padding: 12, background: 'rgba(211, 139, 32, 0.1)', borderRadius: 8 }} role="status" aria-live="polite">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                {fixProgress.currentViolation || 'Scanning...'} ({fixProgress.current} / {fixProgress.total})
                            </span>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }} aria-hidden="true">
                                {Math.round(fixProgress.overallProgress)}%
                            </span>
                        </div>
                        <div style={{ height: 6, background: 'rgba(211, 139, 32, 0.2)', borderRadius: 3, overflow: 'hidden' }} aria-hidden="true">
                            <div 
                                style={{ 
                                    height: '100%', 
                                    background: '#D38B20', 
                                    borderRadius: 3,
                                    transition: 'width 0.3s ease',
                                    width: `${fixProgress.overallProgress}%`
                                }} 
                            />
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}>
                    <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} id="show-resolved" />
                    <span>Show resolved conflicts</span>
                </label>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label htmlFor="filter-type" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Filter:</label>
                    <select 
                        id="filter-type"
                        value={filterType}
                        onChange={e => setFilterType(e.target.value)}
                        style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: '1px solid var(--border-color)',
                            background: 'var(--card-bg)',
                            color: 'var(--text-primary)',
                            fontSize: 13,
                        }}
                        aria-label="Filter conflicts by type"
                    >
                        <option value="all">All Types</option>
                        <option value="teacher_overlap">Teacher Overlap</option>
                        <option value="room_overlap">Room Conflict</option>
                        <option value="section_overlap">Section Overlap</option>
                        <option value="room_capacity_exceeded">Capacity Exceeded</option>
                    </select>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label htmlFor="sort-by" style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Sort:</label>
                    <select 
                        id="sort-by"
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value)}
                        style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: '1px solid var(--border-color)',
                            background: 'var(--card-bg)',
                            color: 'var(--text-primary)',
                            fontSize: 13,
                        }}
                        aria-label="Sort conflicts by"
                    >
                        <option value="severity">Sort by Severity</option>
                        <option value="day">Sort by Day</option>
                    </select>
                </div>
                
                {detectedConflicts.length > 0 && (
                    <span style={{ fontSize: 12, color: '#2F8F5B', background: 'rgba(47, 143, 91, 0.1)', padding: '4px 10px', borderRadius: 20 }}>
                        <Search size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        Live scan: {detectedConflicts.length} found
                    </span>
                )}
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : sortedConflicts.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 60 }}>
                    <CheckCircle size={48} style={{ color: 'var(--accent-success)', margin: '0 auto 16px' }} />
                    <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>All Clear!</h3>
                    <p style={{ color: 'var(--text-muted)' }}>
                        No scheduling conflicts detected. All schedules are conflict-free.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {sortedConflicts.map((c) => {
                        const severity = getSeverityStyle(c.severity);
                        const isExpanded = expandedConflicts.has(c.id);
                        return (
                            <div key={c.id}
                                className="card"
                                role="article"
                                aria-labelledby={`conflict-title-${c.id}`}
                                style={{
                                    borderLeftWidth: 4,
                                    borderLeftStyle: 'solid',
                                    borderLeftColor: severity.color,
                                    opacity: c.is_resolved ? 0.6 : 1,
                                    padding: '16px 20px',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                            <AlertTriangle size={16} style={{ color: severity.color, flexShrink: 0 }} aria-hidden="true" />
                                            <span id={`conflict-title-${c.id}`} style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.title}</span>
                                            <span 
                                                className="badge" 
                                                style={{ 
                                                    background: severity.bg, 
                                                    color: severity.color,
                                                    border: `1px solid ${severity.border || severity.color}`,
                                                    fontWeight: 500,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                }}
                                            >
                                                {getSeverityIcon(c.severity)}
                                                {c.severity?.toUpperCase()}
                                            </span>
                                            <span 
                                                className="badge" 
                                                style={{ background: 'rgba(73, 136, 196, 0.15)', color: '#4988C4' }}
                                                title={getTypeTooltip(c.type)}
                                            >
                                                {getTypeLabel(c.type)}
                                            </span>
                                            {c.source === 'live' && (
                                                <span className="badge" style={{ background: 'rgba(47, 143, 91, 0.15)', color: '#2F8F5B' }}>LIVE</span>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const newExpanded = new Set(expandedConflicts);
                                                    if (newExpanded.has(c.id)) {
                                                        newExpanded.delete(c.id);
                                                    } else {
                                                        newExpanded.add(c.id);
                                                    }
                                                    setExpandedConflicts(newExpanded);
                                                }}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: 'var(--text-secondary)',
                                                    cursor: 'pointer',
                                                    padding: 4,
                                                    marginLeft: 'auto',
                                                }}
                                                aria-label={isExpanded ? `Collapse details for ${c.title}` : `Expand details for ${c.title}`}
                                                aria-expanded={isExpanded}
                                                aria-controls={`conflict-details-${c.id}`}
                                            >
                                                {isExpanded ? '▼' : '▶'}
                                            </button>
                                        </div>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6 }}>{c.description}</p>
                                        {c.day && (
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {c.day}
                                            </span>
                                        )}
                                        {c.source === 'db' && (
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 12 }}>
                                                <Clock size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                                {new Date(c.created_at).toLocaleString()}
                                            </span>
                                        )}
                                        {isExpanded && (
                                            <div id={`conflict-details-${c.id}`} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)' }} role="region" aria-label="Additional conflict details">
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                                                    <div>
                                                        <strong>Conflict ID:</strong> {c.id}
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigator.clipboard.writeText(c.id);
                                                            showToast({
                                                                type: 'success',
                                                                title: 'ID Copied',
                                                                message: 'Conflict ID copied to clipboard',
                                                            });
                                                        }}
                                                        style={{
                                                            background: 'rgba(73, 136, 196, 0.1)',
                                                            border: '1px solid #4988C4',
                                                            color: '#4988C4',
                                                            borderRadius: 4,
                                                            padding: '4px 8px',
                                                            fontSize: 11,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s',
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(73, 136, 196, 0.2)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(73, 136, 196, 0.1)'}
                                                        aria-label={`Copy conflict ID ${c.id}`}
                                                    >
                                                        Copy ID
                                                    </button>
                                                </div>
                                                {c.scheduleIds && c.scheduleIds.length > 0 && (
                                                    <div style={{ marginTop: 8 }}>
                                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                                            <strong>Affected Schedules ({c.scheduleIds.length}):</strong>
                                                        </div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                            {c.scheduleIds.map((scheduleId: string) => (
                                                                <div key={scheduleId} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>
                                                                    <span>{scheduleId}</span>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            navigator.clipboard.writeText(scheduleId);
                                                                            showToast({
                                                                                type: 'success',
                                                                                title: 'ID Copied',
                                                                                message: 'Schedule ID copied to clipboard',
                                                                            });
                                                                        }}
                                                                        style={{
                                                                            background: 'none',
                                                                            border: 'none',
                                                                            color: '#4988C4',
                                                                            cursor: 'pointer',
                                                                            padding: 0,
                                                                            fontSize: 10,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                        }}
                                                                        aria-label={`Copy schedule ID ${scheduleId}`}
                                                                        title="Copy ID"
                                                                    >
                                                                        📋
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {!c.is_resolved && c.source === 'db' && (
                                        <button 
                                            className="btn btn-secondary" 
                                            style={{ flexShrink: 0 }} 
                                            onClick={() => handleResolveDb(c.id)}
                                            aria-label={`Resolve conflict: ${c.title}`}
                                        >
                                            <CheckCircle size={14} aria-hidden="true" />
                                            Resolve
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showSoftScoreModal && scanResult?.softScore && (
                <div className="dash-modal-overlay" onClick={() => setShowSoftScoreModal(false)}>
                    <div className="dash-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
                        <div className="dash-modal-header">
                            <h3 className="dash-modal-title">Soft Score Breakdown</h3>
                            <button className="dash-modal-close" onClick={() => setShowSoftScoreModal(false)}>×</button>
                        </div>
                        <div className="dash-modal-body">
                            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                                <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)' }}>{scanResult.softScore.totalScore}</div>
                                <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Total Quality Score (Lower is better)</div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                {Object.entries(scanResult.softScore.breakdown).map(([key, value]: [string, { score: number; max: number }]) => (
                                    <div key={key} className="stat-card" style={{ padding: 12 }}>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</div>
                                        <div style={{ fontSize: 18, fontWeight: 600 }}>{value.score} / {value.max}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .spinning { animation: spin 1s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
                .dash-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
                .dash-modal { background: var(--card-bg); border-radius: 12px; width: 100%; box-shadow: var(--shadow-lg); overflow: hidden; }
                .dash-modal-header { padding: 16px 24px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; }
                .dash-modal-title { margin: 0; font-size: 18px; font-weight: 600; }
                .dash-modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted); }
                .dash-modal-body { padding: 24px; }
            `}</style>
        </div>
    );
};

export default ConflictsAlerts;
