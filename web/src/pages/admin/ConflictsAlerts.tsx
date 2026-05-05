import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RefreshCw, AlertTriangle, CheckCircle, AlertOctagon, AlertCircle, Info, Zap, Wrench, Search, Clock, ArrowLeft } from 'lucide-react';
import { type HardConstraintViolation, type ScanResult, scanAllConstraints } from './ConflictsAlerts/conflictScanner';
import { type FixOption, generateFixOptions, applyFix, applyAutonomousFixes, type FixMode } from './ConflictsAlerts/fixingEngine';
import { createConflictAlert, createConflictResolutionNotification } from '../../services/notificationService';
import { useToast } from '../../contexts/ToastContext';
import { scheduleStateManager } from '../../services/scheduleStateManager';
import { scheduleLogger } from '../../services/scheduleLogger';
import { scheduleValidation } from '../../services/scheduleValidation';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface DetectedConflict {
    id: string;
    type: 'room_conflict' | 'teacher_overlap' | 'section_overlap';
    severity: 'high' | 'medium';
    title: string;
    description: string;
    day: string;
    scheduleIds: string[];
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
    resolved_by?: string;
}

const ConflictsAlerts: React.FC = () => {
    const { showToast } = useToast();
    const { profile } = useAuth();
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
    
    // Version selection state - only used if no versionId is provided
    const [selectedVersion, setSelectedVersion] = useState<'published' | 'draft' | 'all'>('all');
    const [showVersionSelector, setShowVersionSelector] = useState(!versionId); // Auto-hide if versionId is provided
    
    // New state for comprehensive scanning and fixing
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [fixMode, setFixMode] = useState<FixMode | null>(null);
    const [selectedViolation, setSelectedViolation] = useState<HardConstraintViolation | null>(null);
    const [fixOptions, setFixOptions] = useState<FixOption[]>([]);
    const [fixing, setFixing] = useState(false);
    const [fixProgress, setFixProgress] = useState({ current: 0, total: 0, currentViolation: '', overallProgress: 0 });
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
    const [showSoftScoreModal, setShowSoftScoreModal] = useState(false);
    const [confirmDialogViolationCount, setConfirmDialogViolationCount] = useState(0);
    const isMountedRef = useRef(true);
    const [hasScanResults, setHasScanResults] = useState(false);
    const [scanResultLock, setScanResultLock] = useState<string | null>(null);

    // Track when hasScanResults changes
    useEffect(() => {
        console.log('[STATE CHANGE] hasScanResults changed to:', hasScanResults, 'lock:', scanResultLock);
    }, [hasScanResults, scanResultLock]);

    // Fetch from conflicts table and populate detected conflicts
    const fetchDbConflicts = useCallback(async () => {
        // CRITICAL: If we have a scan lock or results, NEVER overwrite with DB data
        if (hasScanResults || scanResultLock) {
            console.log('[FETCH DB] BLOCKED - scan state protected by lock', { hasScanResults, scanResultLock });
            return;
        }
        
        // If versionId is provided, fetch schedules for that specific version
        let scheduleIds: Set<string> = new Set();
        
        if (versionId) {
            // Fetch the version's snapshot data
            const { data: version } = await supabase
                .from('schedule_versions')
                .select('snapshot')
                .eq('id', versionId)
                .single();
            
            if (version && version.snapshot) {
                const snapshot = version.snapshot as { id: string }[] | { id: string };
                const schedules = Array.isArray(snapshot) ? snapshot : [snapshot];
                scheduleIds = new Set(schedules.map((s) => s.id).filter((id): id is string => !!id));
            }
        } else {
            // Build status filter based on selected version (legacy behavior)
            const statusFilter = selectedVersion === 'all' 
                ? ['published', 'draft'] 
                : [selectedVersion];
            
            // First, fetch schedule IDs for the selected version
            const { data: schedules } = await supabase
                .from('schedules')
                .select('id')
                .in('status', statusFilter);
            
            scheduleIds = new Set((schedules || []).map((s: { id: string }) => s.id));
        }
        
        console.log('Schedule IDs for scan:', scheduleIds.size);
        
        // Then fetch conflicts that involve schedules from the selected version
        let query = supabase.from('conflicts').select('*');
        
        // Filter conflicts by schedule_a_id or schedule_b_id being in the selected schedules
        if (scheduleIds.size > 0) {
            query = query.or(`schedule_a_id.in.(${Array.from(scheduleIds).join(',')}),schedule_b_id.in.(${Array.from(scheduleIds).join(',')})`);
        } else {
            // If no schedules match, return empty
            setDbConflicts([]);
            setDetectedConflicts([]);
            return;
        }
        
        const { data } = await query
            .order('is_resolved')
            .order('created_at', { ascending: false });
        setDbConflicts(data || []);
        
        console.log('Fetched conflicts from DB:', data?.length || 0, 'for version:', versionId || selectedVersion);
        
        // Only populate detected conflicts from database if we don't have recent scan results
        // This ensures scan results take priority over database
        if (!hasScanResults) {
            const unresolved = (data || []).filter((c: ConflictRow) => !c.is_resolved);
            console.log('Unresolved conflicts:', unresolved.length);
            const conflicts: DetectedConflict[] = unresolved.map((c: ConflictRow) => ({
                id: c.conflict_original_id || c.id, // Use original composite ID if available
                type: c.type as 'room_conflict' | 'teacher_overlap' | 'section_overlap',
                severity: c.severity as 'high' | 'medium',
                title: c.title,
                description: c.description,
                day: 'Multiple',
                scheduleIds: c.schedule_a_id ? [c.schedule_a_id] : [],
            }));
            setDetectedConflicts(conflicts);
            console.log('Set detected conflicts from DB:', conflicts.length);
        } else {
            console.log('Skipping DB fetch - using scan results');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedVersion, versionId, hasScanResults, scanResultLock]);

    // Load last scan result from database
    const fetchLastScanResult = useCallback(async () => {
        const { data } = await supabase
            .from('scan_results')
            .select('*')
            .order('scanned_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        
        if (data) {
            console.log('Last scan result loaded:', data);
        }
    }, []);

    // Save scan result to database
    const saveScanResult = useCallback(async (result: ScanResult, scanDuration: number) => {
        await supabase.from('scan_results').insert({
            scanned_at: result.scannedAt,
            scanned_by: profile?.id,
            total_conflicts: result.hardViolations.length,
            hard_violations_count: result.hardViolations.length,
            soft_violations_count: 0,
            soft_score: result.softScore.totalScore,
            scan_duration_ms: scanDuration,
        });
    }, [profile?.id]);

    // Comprehensive scan using the new conflict scanner
    const runComprehensiveScan = useCallback(async () => {
        const scanStartTime = Date.now();
        const currentLockId = crypto.randomUUID();
        
        console.log('[SCAN START] Acquiring lock:', currentLockId);
        setScanResultLock(currentLockId);
        setScanning(true);
        setFixProgress({ current: 0, total: 14, currentViolation: 'Initializing scan...', overallProgress: 0 });
        
        try {
            let schedules: any[] = [];
            
            // If versionId is provided, fetch schedules from that version's snapshot
            if (versionId) {
                console.log('Scanning version:', versionId);
                const { data: version } = await supabase
                    .from('schedule_versions')
                    .select('snapshot')
                    .eq('id', versionId)
                    .single();
                
                if (version && version.snapshot) {
                    const snapshot = version.snapshot as any[] | any;
                    schedules = Array.isArray(snapshot) ? snapshot : [snapshot];
                    console.log('Scanning', schedules.length, 'schedules from version snapshot');
                }
            } else {
                // Build status filter based on selected version (legacy behavior)
                const statusFilter = selectedVersion === 'all' 
                    ? ['published', 'draft'] 
                    : [selectedVersion];
                
                console.log('Scanning schedules with status:', statusFilter);
                
                // Fetch schedules by status
                const { data: schedulesData } = await supabase
                    .from('schedules')
                    .select('*')
                    .in('status', statusFilter);
                
                schedules = schedulesData || [];
            }
            
            // Fetch all necessary data
            const [teachersData, roomsData, sectionsData, subjectsData, breaksData] = await Promise.all([
                supabase.from('teachers').select('*, profile:profiles(*)').eq('is_active', true),
                supabase.from('rooms').select('*').eq('is_available', true),
                supabase.from('sections').select('*'),
                supabase.from('subjects').select('*'),
                supabase.from('institution_breaks').select('*'),
            ]);

            const teachers = teachersData.data || [];
            const rooms = roomsData.data || [];
            const sections = sectionsData.data || [];
            const subjects = subjectsData.data || [];
            const breaks = breaksData.data || [];

            // Default constraint config
            const constraintConfig = {
                maxConsecutiveHours: 4,
                maxDailyHours: 8,
                maxDailyClasses: 6,
                maxWeeklyHours: 40,
                breakWindows: breaks.map(b => ({ start: b.start_time, end: b.end_time })),
            };

            // Run comprehensive scan with progress tracking
            const result = await scanAllConstraints(
                schedules as any, 
                teachers, 
                rooms, 
                sections, 
                subjects, 
                constraintConfig,
                (progress) => {
                    if (isMountedRef.current) {
                        setFixProgress({
                            current: progress.current,
                            total: progress.total,
                            currentViolation: progress.currentPhase,
                            overallProgress: (progress.current / progress.total) * 10, // Scanning is 10% of total
                        });
                    }
                }
            );
            setScanResult(result);
            
            // Update canonical state manager with current schedules and scan results
            const version = await scheduleStateManager.updateState(
                schedules as any,
                'conflicts',
                {
                    conflictCount: result.hardViolations.length,
                    softScore: result.softScore.totalScore,
                    changeDescription: 'Deep conflict scan completed',
                }
            );
            scheduleLogger.conflicts.scanCompleted(
                version.version,
                result.hardViolations.length,
                result.softScore.totalScore,
                Date.now() - scanStartTime
            );
            scheduleLogger.conflicts.stateUpdated(version.version, version.hash);
            
            // First, set detected conflicts from the scan result (immediate UI update)
            const conflicts: DetectedConflict[] = result.hardViolations.map((v: HardConstraintViolation) => ({
                id: v.id,
                type: v.type as 'room_conflict' | 'teacher_overlap' | 'section_overlap',
                severity: v.severity as 'high' | 'medium',
                title: v.title,
                description: v.description,
                day: v.day || 'Multiple',
                scheduleIds: v.scheduleIds,
            }));
            setDetectedConflicts(conflicts);
            setHasScanResults(true);
            
            console.log('[SCAN COMPLETE] Set hasScanResults to true, conflicts:', conflicts.length);
            console.log('[SCAN COMPLETE] Stats should now show scan results instead of database');
            
            console.log('Set detected conflicts from scan:', conflicts.length);
            
            // Then sync with database (for persistence)
            // Fetch ALL conflicts (not just unresolved) because conflict_original_id is unique across the table
            const { data: existingConflicts } = await supabase
                .from('conflicts')
                .select('id, conflict_original_id');
            
            const existingIds = new Set((existingConflicts || []).map((c: { conflict_original_id?: string }) => c.conflict_original_id).filter((id): id is string => id !== undefined));
            const detectedIds = new Set(result.hardViolations.map((v: HardConstraintViolation) => v.id));
            
            console.log('Existing conflicts in DB:', existingIds.size);
            console.log('Detected conflicts in scan:', detectedIds.size);
            
            // Mark unresolved conflicts as resolved if they're no longer detected
            const { data: unresolvedConflicts } = await supabase
                .from('conflicts')
                .select('id, conflict_original_id')
                .eq('is_resolved', false);
            
            const unresolvedIds = new Set((unresolvedConflicts || []).map((c: { conflict_original_id?: string }) => c.conflict_original_id).filter((id): id is string => id !== undefined));
            const resolvedIds = [...unresolvedIds].filter(id => !detectedIds.has(id));
            if (resolvedIds.length > 0) {
                console.log('Marking as resolved:', resolvedIds.length);
                await supabase
                    .from('conflicts')
                    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
                    .in('conflict_original_id', resolvedIds);
            }
            
            // Insert only new conflicts (not already in database)
            const newConflicts = result.hardViolations.filter((v: HardConstraintViolation) => !existingIds.has(v.id));
            console.log('New conflicts to insert:', newConflicts.length);
            let insertSuccess = false;
            if (newConflicts.length > 0) {
                console.log('Sample conflict ID:', newConflicts[0].id);
                console.log('Sample conflict scheduleIds:', newConflicts[0].scheduleIds);
                const conflictInserts = newConflicts.map((v: HardConstraintViolation) => ({
                    id: crypto.randomUUID(), // Generate proper UUID for database
                    conflict_original_id: v.id, // Store scanner's composite ID
                    type: v.type,
                    severity: v.severity,
                    title: v.title,
                    description: v.description,
                    schedule_a_id: v.scheduleIds?.[0] || null,
                    schedule_b_id: v.scheduleIds?.[1] || null,
                    is_resolved: false,
                    created_at: new Date().toISOString(),
                }));
                
                console.log('Attempting to insert', conflictInserts.length, 'conflicts');
                const { error: insertError } = await supabase.from('conflicts').insert(conflictInserts);
                if (insertError) {
                    console.error('Error inserting conflicts:', insertError);
                    console.error('Error details:', JSON.stringify(insertError, null, 2));
                    console.error('First conflict being inserted:', conflictInserts[0]);
                } else {
                    console.log('Successfully inserted conflicts');
                    insertSuccess = true;
                }
            } else {
                insertSuccess = true; // No conflicts to insert = success
            }
            
            // Save scan result to database for tracking
            const scanDuration = Date.now() - scanStartTime;
            await saveScanResult(result, scanDuration);
            
            // Only refresh db conflicts if insert succeeded, otherwise keep scan results
            if (insertSuccess) {
                console.log('[SCAN SYNC] Sync succeeded, keeping scan results as source of truth');
                // We DO NOT call fetchDbConflicts() here anymore
            } else {
                console.log('Skipping DB fetch due to insert failure - keeping scan results');
            }
            
            // Create conflict alert notification if conflicts found
            if (result.hardViolations.length > 0) {
                const highSeverityCount = result.hardViolations.filter(v => v.severity === 'high').length;
                const severity = highSeverityCount > 0 ? 'high' : highSeverityCount > result.hardViolations.length / 2 ? 'medium' : 'low';
                await createConflictAlert(result.hardViolations.length, severity, {
                    soft_score: result.softScore.totalScore,
                    scan_timestamp: result.scannedAt,
                });
            }
            
            // Set success state before toast to ensure UI updates source
            setHasScanResults(true);
            
            showToast({
                type: 'success',
                title: 'Scan Complete',
                message: `Found ${result.hardViolations.length} conflicts. Soft score: ${result.softScore.totalScore}`,
            });
            
        } catch (error) {
            console.error('Scan failed:', error);
            setScanResultLock(null); // Release lock on failure
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            showToast({
                type: 'error',
                title: 'Scan Failed',
                message: `Unable to complete scan: ${errorMessage}. Please try again.`,
            });
        } finally {
            if (isMountedRef.current) {
                setScanning(false);
                setFixProgress({ current: 0, total: 0, currentViolation: '', overallProgress: 0 });
            }
        }
    }, [versionId, selectedVersion, profile?.id, saveScanResult, showToast]);

    // Handle autonomous fixing
    const handleAutonomousFix = useCallback(async () => {
        if (!scanResult) return;
        
        console.log('[CONFLICT ENGINE] Starting autonomous fix process');
        console.log('[CONFLICT ENGINE] Initial conflict count:', scanResult.hardViolations.length);
        console.log('[CONFLICT ENGINE] Initial soft score:', scanResult.softScore.totalScore);
        
        // Store the violation count when opening dialog to prevent race conditions
        setConfirmDialogViolationCount(scanResult.hardViolations.length);
        
        // Show confirmation dialog
        setShowConfirmDialog(true);
        setConfirmAction(() => async () => {
            if (!isMountedRef.current) return;
            setShowConfirmDialog(false);
            setFixing(true);
            setFixProgress({ current: 0, total: scanResult.hardViolations.length, currentViolation: 'Initializing...', overallProgress: 0 }); // Start at 0 for full pipeline
            
            console.log('[CONFLICT ENGINE] User confirmed fix operation');
            
            try {
                // Fetch fresh schedules from database to ensure we have the latest committed state
                console.log('[CONFLICT ENGINE] Fetching fresh schedules from database');
                const [schedulesData, teachersData, roomsData, sectionsData, subjectsData] = await Promise.all([
                    supabase.from('schedules').select('*').in('status', ['published', 'draft']),
                    supabase.from('teachers').select('*, profile:profiles(*)'),
                    supabase.from('rooms').select('*'),
                    supabase.from('sections').select('*'),
                    supabase.from('subjects').select('*'),
                ]);
                
                console.log('[CONFLICT ENGINE] Fetched', schedulesData.data?.length || 0, 'schedules from database');
                
                // Invalidate scan result state to ensure we don't use stale data
                console.log('[CONFLICT ENGINE] Invalidating scan result state');
                setScanResult(null);
                setHasScanResults(false);
                console.log('[CONFLICT ENGINE] Set hasScanResults to false (fix mode)');

                const result = await applyAutonomousFixes(
                    scanResult,
                    schedulesData.data || [],
                    teachersData.data || [],
                    roomsData.data || [],
                    sectionsData.data || [],
                    subjectsData.data || [],
                    supabase,
                    {
                        maxIterations: 5,
                        autoRescan: true,
                        includeScanPhase: false, // Scan was already done, just fix
                        onProgress: (progress) => {
                            if (isMountedRef.current) {
                                console.log('[CONFLICT ENGINE] Progress:', progress.phase, Math.round(progress.overallProgress) + '%', '-', progress.currentViolation);
                                setFixProgress({
                                    current: progress.current,
                                    total: progress.total,
                                    currentViolation: progress.currentViolation,
                                    overallProgress: progress.overallProgress,
                                });
                            }
                        },
                    }
                );
                
                console.log('[CONFLICT ENGINE] Fix process completed');
                console.log('[CONFLICT ENGINE] Success:', result.success);
                console.log('[CONFLICT ENGINE] Applied fixes:', result.appliedFixes.length);
                console.log('[CONFLICT ENGINE] Remaining violations:', result.remainingViolations.length);
                console.log('[CONFLICT ENGINE] Warnings:', result.warnings?.length || 0);
                
                // Log fix completion
                if (result.appliedFixes.length > 0) {
                    scheduleLogger.conflicts.fixApplied(
                        scheduleStateManager.getVersion()?.version || 0,
                        `Applied ${result.appliedFixes.length} autonomous fixes`,
                        scanResult.hardViolations.length,
                        result.remainingViolations.length
                    );
                }
                
                // Update canonical state with the latest schedules after fixes
                const { data: updatedSchedules } = await supabase
                    .from('schedules')
                    .select('*')
                    .in('status', ['published', 'draft']);
                
                if (updatedSchedules) {
                    const version = await scheduleStateManager.updateState(
                        updatedSchedules,
                        'conflicts',
                        {
                            conflictCount: result.remainingViolations.length,
                            softScore: 0, // Will be updated by rescan
                            changeDescription: `Applied ${result.appliedFixes.length} fixes`,
                        }
                    );
                    scheduleLogger.conflicts.fixPersisted(version.version, 'conflicts-tab');
                    scheduleLogger.conflicts.stateUpdated(version.version, version.hash);
                }
                
                if (isMountedRef.current) {
                    showToast({
                        type: result.success ? 'success' : 'warning',
                        title: result.success ? 'Fixes Applied' : 'Fix Completed with Warnings',
                        message: result.message,
                    });
                    
                    // Auto-rescan after fixing to update the UI with the latest state
                    if (result.appliedFixes.length > 0) {
                        console.log('[CONFLICT ENGINE] Running comprehensive scan to verify changes');
                        await runComprehensiveScan();
                        
                        // Create resolution notification after rescan
                        if (scanResult) {
                            await createConflictResolutionNotification(
                                result.conflictsResolvedInLastPass || result.appliedFixes.length,
                                scanResult.hardViolations.length
                            );
                        }
                    } else {
                        console.log('[CONFLICT ENGINE] No fixes were applied, skipping rescan');
                    }
                }
            } catch (error) {
                console.error('[CONFLICT ENGINE] Autonomous fix failed:', error);
                if (isMountedRef.current) {
                    showToast({
                        type: 'error',
                        title: 'Fix Application Failed',
                        message: error instanceof Error ? error.message : 'An unknown error occurred.',
                    });
                }
            } finally {
                if (isMountedRef.current) {
                    setFixing(false);
                    setFixProgress({ current: 0, total: 0, currentViolation: '', overallProgress: 0 });
                    console.log('[CONFLICT ENGINE] Fix process finished');
                }
            }
        });
    }, [showToast, runComprehensiveScan, scanResult]);

    // Handle fix mode selection
    const handleStartFixing = useCallback((mode: FixMode) => {
        setFixMode(mode);
        setFixOptions([]);
        setSelectedViolation(null);
        if (mode === 'autonomous' && scanResult) {
            handleAutonomousFix();
        } else {
            showToast({
                type: 'info',
                title: 'Manual Fix Mode',
                message: 'Click on a conflict to see fix options.',
            });
        }
    }, [scanResult, handleAutonomousFix, showToast]);

    // Handle interactive fix option selection
    const handleSelectViolation = useCallback(async (violation: HardConstraintViolation) => {
        setSelectedViolation(violation);
        
        try {
            const [schedulesData, teachersData, roomsData, sectionsData, subjectsData] = await Promise.all([
                supabase.from('schedules').select('*'),
                supabase.from('teachers').select('*, profile:profiles(*)'),
                supabase.from('rooms').select('*'),
                supabase.from('sections').select('*'),
                supabase.from('subjects').select('*'),
            ]);

            const options = await generateFixOptions(
                violation,
                schedulesData.data || [],
                teachersData.data || [],
                roomsData.data || [],
                sectionsData.data || [],
                subjectsData.data || []
            );
            
            setFixOptions(options);
            showToast({
                type: 'success',
                title: 'Fix Options Loaded',
                message: `Found ${options.length} fix options for ${violation.title}.`,
            });
        } catch (error) {
            console.error('Failed to load fix options:', error);
            showToast({
                type: 'error',
                title: 'Failed to Load Fix Options',
                message: 'Please try again.',
            });
        }
    }, [showToast]);

    // Helper to safely convert ConflictRow to HardConstraintViolation for interactive mode
    const convertToHardConstraintViolation = (conflict: ConflictRow | DetectedConflict): HardConstraintViolation => {
        // For live conflicts (from scanner), they already have the right structure
        if ('source' in conflict && conflict.source === 'live') {
            return conflict as unknown as HardConstraintViolation;
        }
        
        // For DB conflicts, create a minimal HardConstraintViolation structure
        return {
            id: conflict.id,
            type: (conflict.type || 'room_overlap') as HardConstraintViolation['type'],
            severity: (conflict.severity || 'high') as HardConstraintViolation['severity'],
            title: conflict.title,
            description: conflict.description,
            day: ('day' in conflict) ? conflict.day : undefined,
            scheduleIds: ('scheduleIds' in conflict) ? conflict.scheduleIds : [],
            affectedEntities: [],
        };
    };

    // Apply selected fix
    const handleApplyFix = useCallback(async (fix: FixOption) => {
        setFixing(true);
        
        try {
            // Capture before state for verification
            const beforeSchedules = await supabase.from('schedules').select('*').in('status', ['published', 'draft']);
            const beforeData = beforeSchedules.data || [];
            const beforeHash = scheduleValidation.computeStateHash(beforeData);
            const beforeConflictCount = scanResult?.hardViolations.length || 0;
            const beforeSoftScore = scanResult?.softScore.totalScore || 0;
            
            console.log('[FIX VERIFICATION] Before state:', {
                hash: beforeHash,
                conflictCount: beforeConflictCount,
                softScore: beforeSoftScore,
                scheduleCount: beforeData.length,
            });
            
            const schedulesData = await supabase.from('schedules').select('*');
            const result = await applyFix(fix, schedulesData.data || [], supabase);
            
            if (result.success) {
                // Capture after state for verification
                const afterSchedules = await supabase.from('schedules').select('*').in('status', ['published', 'draft']);
                const afterData = afterSchedules.data || [];
                const afterHash = scheduleValidation.computeStateHash(afterData);
                const diff = scheduleValidation.computeStateDiff(beforeData, afterData);
                const fixVerification = scheduleValidation.verifyFixApplied(beforeData, afterData);
                
                console.log('[FIX VERIFICATION] After state:', {
                    hash: afterHash,
                    scheduleCount: afterData.length,
                    diff,
                    fixVerification,
                });
                
                // Verify the fix actually changed the state
                if (!fixVerification.success) {
                    console.warn('[FIX VERIFICATION] Fix claimed success but state did not change:', fixVerification.reason);
                    scheduleLogger.system.error('conflicts', 'repair', 'Fix claimed success but state did not change', fixVerification.reason);
                }
                
                // Log the state change
                scheduleLogger.conflicts.fixApplied(
                    scheduleStateManager.getVersion()?.version || 0,
                    fix.title,
                    beforeConflictCount,
                    scanResult?.hardViolations.length || 0 // Will be updated after rescan
                );
            }
            
            if (isMountedRef.current) {
                showToast({
                    type: result.success ? 'success' : 'error',
                    title: result.success ? 'Fix Applied' : 'Fix Failed',
                    message: result.message,
                });
                
                // Auto-rescan after applying fix to update UI with latest state
                if (result.success) {
                    await runComprehensiveScan();
                }
            }
        } catch (error) {
            if (isMountedRef.current) {
                console.error('Fix application failed:', error);
                scheduleLogger.system.error('conflicts', 'repair', 'Fix application failed', error);
                showToast({
                    type: 'error',
                    title: 'Fix Application Failed',
                    message: 'Please try again.',
                });
            }
        } finally {
            if (isMountedRef.current) {
                setFixing(false);
            }
        }
    }, [showToast, runComprehensiveScan, scanResult]);

    useEffect(() => {
        isMountedRef.current = true;
        setHasScanResults(false); // Reset on mount to load from database
        console.log('[MOUNT] Set hasScanResults to false (mount)');
        
        // Initialize state manager and logger
        scheduleStateManager.initialize(supabase);
        scheduleLogger.system.workflowStarted('Conflicts tab initialization');
        
        // Subscribe to state changes from Generate tab
        const unsubscribe = scheduleStateManager.subscribe((event) => {
            if (event.source === 'generate' && event.type === 'schedule_updated') {
                console.log('[CONFLICT ENGINE] State updated by Generate tab, triggering rescan');
                scheduleLogger.system.cacheInvalidated('generate');
                // Invalidate local state and trigger rescan
                setScanResult(null);
                setHasScanResults(false);
                console.log('[CONFLICT ENGINE] Set hasScanResults to false (Generate update)');
                // Auto-rescan when Generate tab updates to ensure fresh state
                runComprehensiveScan().catch(err => {
                    console.error('[CONFLICT ENGINE] Auto-rescan after Generate save failed:', err);
                    scheduleLogger.system.error('conflicts', 'rescan', 'Auto-rescan after Generate save failed', err);
                });
            }
        });
        
        const init = async () => {
            setLoading(true);
            // Only fetch DB conflicts on mount, don't auto-scan
            await fetchDbConflicts();
            await fetchLastScanResult();
            setLoading(false);
        };
        
        init();
        
        return () => {
            unsubscribe(); // Unsubscribe from state manager
            isMountedRef.current = false;
        };
    }, [fetchDbConflicts, fetchLastScanResult, runComprehensiveScan]); // Run once on mount

    // Refetch conflicts when version changes
    useEffect(() => {
        console.log('[VERSION CHANGE] useEffect triggered, showVersionSelector:', showVersionSelector, 'hasScanResults:', hasScanResults);
        if (!showVersionSelector) {
            // Only refetch if version selector is closed (user has made a selection)
            // Don't reset hasScanResults if we have scan results - let them persist
            if (!hasScanResults) {
                console.log('[VERSION CHANGE] No scan results, fetching from DB');
                setScanResult(null);
                fetchDbConflicts();
            } else {
                console.log('[VERSION CHANGE] Scan results exist - keeping scan results');
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedVersion, showVersionSelector, fetchDbConflicts]);

    const handleResolveDb = async (id: string) => {
        try {
            const { error } = await supabase.from('conflicts').update({
                is_resolved: true,
                resolved_at: new Date().toISOString(),
            }).eq('id', id);
            
            if (error) {
                throw error;
            }
            
            fetchDbConflicts();
            showToast({
                type: 'success',
                title: 'Conflict Resolved',
                message: 'The conflict has been marked as resolved.',
            });
        } catch (error) {
            console.error('Failed to resolve conflict:', error);
            showToast({
                type: 'error',
                title: 'Failed to Resolve Conflict',
                message: error instanceof Error ? error.message : 'An unknown error occurred.',
            });
        }
    };

    const allConflicts = useMemo(() => {
        // Only use one source: scan results if available, otherwise database
        if (hasScanResults) {
            return detectedConflicts.map(c => ({ ...c, source: 'live' as const, is_resolved: false, created_at: new Date().toISOString() }));
        } else {
            return dbConflicts.map(c => ({ ...c, source: 'db' as const, scheduleIds: [] as string[], day: '' }));
        }
    }, [detectedConflicts, dbConflicts, hasScanResults]);

    const unresolvedCount = useMemo(() => allConflicts.filter(c => !c.is_resolved).length, [allConflicts]);
    
    // Filter and sort conflicts
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
            {/* Version Selector - Inline Card */}
            {showVersionSelector && (
                <div className="card" style={{ padding: 24, maxWidth: 800, margin: '0 auto 24px auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: 18 }}>
                            Select Schedule Version to Scan
                        </h3>
                        <button
                            onClick={() => setShowVersionSelector(false)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontSize: 20,
                            }}
                        >
                            ×
                        </button>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>
                        Choose which schedule version you want to check for conflicts. The scan will only examine schedules in the selected status.
                    </p>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <button
                            className={selectedVersion === 'published' ? 'btn btn-primary' : 'btn btn-secondary'}
                            onClick={() => {
                                console.log('[VERSION BUTTON] User clicked Published');
                                setScanResultLock(null); // Release lock to allow DB fetch
                                setSelectedVersion('published');
                                setShowVersionSelector(false);
                                setScanResult(null);
                                setHasScanResults(false);
                                console.log('[VERSION BUTTON] Set hasScanResults to false (user clicked Published)');
                                fetchDbConflicts();
                            }}
                            style={{ flex: 1, minWidth: 200, justifyContent: 'flex-start', padding: '12px 16px' }}
                        >
                            <div style={{ flex: 1, textAlign: 'left' }}>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>Published Schedules</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    Scan only published schedules (active schedule)
                                </div>
                            </div>
                        </button>
                        <button
                            className={selectedVersion === 'draft' ? 'btn btn-primary' : 'btn btn-secondary'}
                            onClick={() => {
                                console.log('[VERSION BUTTON] User clicked Draft');
                                setScanResultLock(null); // Release lock to allow DB fetch
                                setSelectedVersion('draft');
                                setShowVersionSelector(false);
                                setScanResult(null);
                                setHasScanResults(false);
                                console.log('[VERSION BUTTON] Set hasScanResults to false (user clicked Draft)');
                                fetchDbConflicts();
                            }}
                            style={{ flex: 1, minWidth: 200, justifyContent: 'flex-start', padding: '12px 16px' }}
                        >
                            <div style={{ flex: 1, textAlign: 'left' }}>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>Draft Schedules</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    Scan only draft schedules (work in progress)
                                </div>
                            </div>
                        </button>
                        <button
                            className={selectedVersion === 'all' ? 'btn btn-primary' : 'btn btn-secondary'}
                            onClick={() => {
                                console.log('[VERSION BUTTON] User clicked All');
                                setScanResultLock(null); // Release lock to allow DB fetch
                                setSelectedVersion('all');
                                setShowVersionSelector(false);
                                setScanResult(null);
                                setHasScanResults(false);
                                console.log('[VERSION BUTTON] Set hasScanResults to false (user clicked All)');
                                fetchDbConflicts();
                            }}
                            style={{ flex: 1, minWidth: 200, justifyContent: 'flex-start', padding: '12px 16px' }}
                        >
                            <div style={{ flex: 1, textAlign: 'left' }}>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>All Schedules</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    Scan both published and draft schedules
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            )}

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
                            {hasScanResults
                                ? `${detectedConflicts.length} conflict${detectedConflicts.length > 1 ? 's' : ''} found in scan`
                                : unresolvedCount > 0
                                ? `${unresolvedCount} active conflict${unresolvedCount > 1 ? 's' : ''} detected`
                                : 'No active conflicts'}
                        </p>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            ({selectedVersion === 'all' ? 'All schedules' : selectedVersion === 'published' ? 'Published only' : 'Draft only'})
                        </span>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowVersionSelector(true)}
                            style={{ fontSize: 12, padding: '4px 8px' }}
                            title="Change version filter"
                        >
                            Change
                        </button>
                    </div>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => { runComprehensiveScan(); fetchDbConflicts(); }}
                    disabled={scanning}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    aria-label={scanning ? 'Scanning for conflicts' : 'Scan for conflicts'}
                    title="Refresh scan"
                >
                    <RefreshCw size={16} className={scanning ? 'spinning' : ''} aria-hidden="true" />
                    {scanning ? 'Scanning...' : 'Scan Now'}
                </button>
            </div>

            {/* Stats */}
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

            {/* Scanning Progress */}
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

            {/* Fixing Controls */}
            {scanResult && scanResult.hardViolations.length > 0 && (
                <div className="card" style={{ marginBottom: 24, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: 16 }}>Conflict Resolution</h3>
                    </div>
                    
                    {fixing && fixProgress.total > 0 && (
                        <div style={{ marginBottom: 12, padding: 12, background: 'rgba(73, 136, 196, 0.1)', borderRadius: 8 }} role="status" aria-live="polite">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                    {fixProgress.currentViolation || 'Processing...'} ({fixProgress.current} / {fixProgress.total})
                                </span>
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }} aria-hidden="true">
                                    {Math.round(fixProgress.overallProgress)}%
                                </span>
                            </div>
                            <div style={{ height: 6, background: 'rgba(73, 136, 196, 0.2)', borderRadius: 3, overflow: 'hidden' }} aria-hidden="true">
                                <div 
                                    style={{ 
                                        height: '100%', 
                                        background: '#4988C4', 
                                        borderRadius: 3,
                                        transition: 'width 0.3s ease',
                                        width: `${fixProgress.overallProgress}%`
                                    }} 
                                />
                            </div>
                        </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-primary"
                            onClick={() => handleStartFixing('autonomous')}
                            disabled={fixing}
                            aria-label={fixing ? 'Fixing conflicts automatically' : 'Automatically fix all conflicts'}
                        >
                            {fixing ? (
                                <>
                                    <RefreshCw size={14} className="spinning" style={{ marginRight: 6 }} aria-hidden="true" />
                                    Fixing...
                                </>
                            ) : (
                                <>
                                    <Zap size={14} style={{ marginRight: 6 }} aria-hidden="true" />
                                    Auto-Fix All
                                </>
                            )}
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => handleStartFixing('interactive')}
                            disabled={fixing}
                            aria-label="Enter manual fix mode"
                        >
                            <Wrench size={14} style={{ marginRight: 6 }} aria-hidden="true" />
                            Manual Fixes
                        </button>
                    </div>
                    {fixMode === 'interactive' && selectedViolation && fixOptions.length > 0 && (
                        <div style={{ marginTop: 16, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                            <h4 style={{ color: 'var(--text-primary)', margin: '0 0 12px', fontSize: 14 }}>
                                Fix Options for {selectedViolation.title}
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {fixOptions.map(option => (
                                    <div
                                        key={option.id}
                                        className="card"
                                        style={{
                                            padding: 12,
                                            border: '1px solid var(--border-color)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                                                {option.title}
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                                {option.description}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                Impact: {option.estimatedSoftScoreImpact} • Effort: {option.effort}
                                            </div>
                                        </div>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => handleApplyFix(option)}
                                            disabled={fixing}
                                            style={{ fontSize: 12, padding: '6px 12px' }}
                                            aria-label={`Apply fix: ${option.title}`}
                                        >
                                            Apply
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Confirmation Dialog - Inline Card */}
            {showConfirmDialog && (
                <div className="card" style={{ padding: 24, maxWidth: 800, margin: '0 auto 24px auto', border: '2px solid var(--accent-warning)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: 18 }}>
                            Confirm Auto-Fix
                        </h3>
                        <button
                            onClick={() => setShowConfirmDialog(false)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontSize: 20,
                            }}
                        >
                            ×
                        </button>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
                        This will automatically apply fixes to {confirmDialogViolationCount} conflict(s). 
                        The system will make decisions about which fixes to apply based on severity and impact.
                        <br /><br />
                        <strong>Warning:</strong> This will modify your schedule data. Consider creating a backup first.
                    </p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowConfirmDialog(false)}
                            aria-label="Cancel auto-fix operation"
                        >
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={() => confirmAction?.()}
                            aria-label="Confirm and apply automatic fixes"
                        >
                            Confirm and Fix
                        </button>
                    </div>
                </div>
            )}

            {/* Soft Score Breakdown - Inline Card */}
            {showSoftScoreModal && scanResult?.softScore && (
                <div className="card" style={{ padding: 24, maxWidth: 800, margin: '0 auto 24px auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: 18 }}>
                            Soft Score Breakdown
                        </h3>
                        <button
                            onClick={() => setShowSoftScoreModal(false)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontSize: 20,
                            }}
                            aria-label="Close soft score breakdown"
                        >
                            ×
                        </button>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                            Total Score: {scanResult.softScore.totalScore}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                            Lower is better. This score represents overall schedule quality based on soft constraints.
                        </div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                        <h4 style={{ color: 'var(--text-primary)', margin: '0 0 12px', fontSize: 14 }}>
                            Score Components
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Balanced Load</span>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{scanResult.softScore.breakdown.balancedLoad.score} / {scanResult.softScore.breakdown.balancedLoad.max}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Compact Schedule</span>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{scanResult.softScore.breakdown.compactSchedule.score} / {scanResult.softScore.breakdown.compactSchedule.max}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Minimize Room Switch</span>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{scanResult.softScore.breakdown.minimizeRoomSwitch.score} / {scanResult.softScore.breakdown.minimizeRoomSwitch.max}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Teacher Preferred Time</span>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{scanResult.softScore.breakdown.teacherPreferredTime.score} / {scanResult.softScore.breakdown.teacherPreferredTime.max}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Daily Load Balance</span>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{scanResult.softScore.breakdown.dailyLoadBalance.score} / {scanResult.softScore.breakdown.dailyLoadBalance.max}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Workload Fairness</span>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{scanResult.softScore.breakdown.workloadFairness.score} / {scanResult.softScore.breakdown.workloadFairness.max}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Subject Spacing</span>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{scanResult.softScore.breakdown.subjectSpacing.score} / {scanResult.softScore.breakdown.subjectSpacing.max}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Room Utilization</span>
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{scanResult.softScore.breakdown.roomUtilization.score} / {scanResult.softScore.breakdown.roomUtilization.max}</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ marginTop: 16, padding: 12, background: 'rgba(73, 136, 196, 0.1)', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            <strong>Tip:</strong> Use the fixing engine to reduce this score by resolving conflicts and optimizing schedule preferences.
                        </div>
                    </div>
                </div>
            )}

            {/* Filter */}
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
                        <option value="room_subject_incompatible">Qualification Mismatch</option>
                        <option value="teacher_unqualified">Qualification Mismatch</option>
                        <option value="max_consecutive_hours">Workload Limit</option>
                        <option value="max_daily_hours">Workload Limit</option>
                        <option value="max_daily_classes">Workload Limit</option>
                        <option value="max_weekly_hours">Workload Limit</option>
                        <option value="break_violation">Break Violation</option>
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
                                    cursor: fixMode === 'interactive' ? 'pointer' : 'default',
                                }}
                                onClick={() => fixMode === 'interactive' && handleSelectViolation(convertToHardConstraintViolation(c))}
                                tabIndex={fixMode === 'interactive' ? 0 : undefined}
                                onKeyPress={(e) => {
                                    if (fixMode === 'interactive' && (e.key === 'Enter' || e.key === ' ')) {
                                        handleSelectViolation(convertToHardConstraintViolation(c));
                                    }
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
                                                            {c.scheduleIds.map((scheduleId) => (
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

            <style>{`
                .spinning { animation: spin 1s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default ConflictsAlerts;
