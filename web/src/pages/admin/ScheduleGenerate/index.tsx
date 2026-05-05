import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';

import { useAuth } from '../../../contexts/AuthContext';
import { useUserPreferences } from '../../../contexts/UserPreferencesContext';
import { POWER_ADMIN_ROLES, hasAnyRole } from '../../../types/database';
import type { Schedule } from '../../../types/database';
import {
    AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle, ChevronDown, ChevronUp, Clock, FileClock,
    Flag, GitBranch, HelpCircle, Inbox, Layers, Lightbulb, ListChecks, Lock, MapPin, Play, Plus,
    RefreshCw, RotateCcw, Save, Search as SearchIcon, Send, ShieldCheck, Sliders, Sparkles, Upload,
    Users, X, XCircle,
} from 'lucide-react';
import '../Dashboard.css';
import {
    ALL_DAYS, DEFAULT_CONFIG, HARD_CONSTRAINTS, MODE_LABELS, PARTIAL_KIND_LABELS, PRIORITY_TIERS,
    PRIORITY_VALUES, STAGES, WORKFLOW_META, tierFromValue, type GenerationMode,
    type DiffEntry, type ExistingSchedule, type GenerationConfig,
    type GenerationProgress, type GenerationResult, type PartialKind, type PartialTarget,
    type PlacedEntry, type PriorityTier, type Room, type Section, type StageKey,
    type Subject, type Teacher, type VersionSummary, type WorkflowState,
} from './types';
import { runGenerator } from './generator';
import { getRulesAsRecord, notifyStudentsOfScheduleChanges } from '../../../services/generationService';
import { scheduleStateManager } from '../../../services/scheduleStateManager';
import { scheduleLogger } from '../../../services/scheduleLogger';
import { scheduleVersionService } from '../../../services/scheduleVersionService';
// Temporarily disabled audit logging - log_audit RPC function doesn't exist
// import { scheduleAudit } from '../../../services/auditService';
import { detectConflicts } from '../../../services/conflictDetector';
import { PublishOverwriteConfirm } from '../../../components/PublishOverwriteConfirm';
import { ScheduleDragDrop } from '../../../components/ScheduleDragDrop';

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

const ScheduleGenerate: React.FC = () => {
    const { roles, user } = useAuth();
    const { preferences, updatePreferences } = useUserPreferences();
    const canApprove = hasAnyRole(roles, [...POWER_ADMIN_ROLES, 'schedule_admin']);
    const [stage, setStage] = useState<StageKey>('scope');
    const [maxStageReached, setMaxStageReached] = useState<StageKey>('scope');
    const [config, setConfig] = useState<GenerationConfig>(DEFAULT_CONFIG);

    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [existing, setExisting] = useState<ExistingSchedule[]>([]);
    const [dataLoading, setDataLoading] = useState(true);

    const [progress, setProgress] = useState<GenerationProgress>({
        subStage: 'idle', attempt: 0, totalAttempts: 0, placed: 0, total: 0, message: 'Ready',
    });
    const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
    const [result, setResult] = useState<GenerationResult | null>(null);
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savedId, setSavedId] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [versionsOpen, setVersionsOpen] = useState(false);
    const [workflowBusy, setWorkflowBusy] = useState<WorkflowState | null>(null);
    const [workflowNote, setWorkflowNote] = useState<string | null>(null);
    const [workflowError, setWorkflowError] = useState<string | null>(null);
    const cancelRef = useRef(false);

    type DetectedConflict = {
        type: string;
        severity: string;
        title: string;
        description: string;
        scheduleAId: string | null;
        scheduleBId: string | null;
    };

    type VersionWorkflowService = typeof scheduleVersionService & {
        approveSchedule: (batchId: string, options: { changeReason: string }) => Promise<{ success: boolean; message?: string }>;
        publishApprovedSchedule: (batchId: string, options: { changeReason: string }) => Promise<{ success: boolean; message?: string; active_version_id?: string | null }>;
    };

    // Version control state
    const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
    const [currentScheduleSummary, setCurrentScheduleSummary] = useState<{
        exists: boolean;
        version?: string;
        timestamp?: string;
        sessionCount?: number;
        score?: number;
    } | null>(null);

    const refreshExisting = async () => {
        // Query generation_runs table to count actual schedules (not individual sessions)
        const { data } = await supabase
            .from('generation_runs')
            .select('id, status, completed_at');
        
        // Map generation_runs status to workflow states
        // generation_runs status: 'running', 'completed', 'failed'
        // workflow states: 'draft', 'submitted', 'approved', 'published'
        // For now, treat all completed runs as 'draft' since the workflow state is stored separately
        const mappedData = (data || []).map(run => ({
            id: run.id,
            status: run.status === 'completed' ? 'draft' : run.status,
            created_at: run.completed_at,
        }));
        
        setExisting(mappedData as unknown as ExistingSchedule[]);
    };

    useEffect(() => {
        const load = async () => {
            setDataLoading(true);
            try {
                // Initialize state manager, logger, and version service
                scheduleStateManager.initialize(supabase);
                scheduleLogger.system.workflowStarted('Generate tab initialization');
                
                // Initialize version service if user is available
                if (user?.id) {
                    scheduleVersionService.initialize(supabase, user.id);
                }
                
                const [sub, t, r, sec, sch, prefs, prof, sr] = await Promise.all([
                    supabase.from('subjects').select('id, name, code, duration_hours, requires_lab, program, year_level, teacher_id, teacher_eligibility_pool, sessions_per_week, weight, priority_note'),
                    supabase.from('teachers').select('id, max_hours, weight, priority_note, profile_id'),
                    supabase.from('rooms').select('id, name, capacity, type, building, floor, is_available, weight, priority_note'),
                    supabase.from('sections').select('id, name, program, year_level, student_count, parent_id, weight, path, node_type, is_active, description, metadata, sort_order, load_category, special_scheduling_rules'),
                    supabase.from('schedules').select('id, subject_id, teacher_id, room_id, section_id, day_of_week, start_time, end_time, status, created_at, batch_id'),
                    supabase.from('teacher_preferences').select('teacher_id, preferred_days, preferred_time_start, preferred_time_end, max_classes_per_day, max_consecutive_classes, availability'),
                    supabase.from('profiles').select('id, full_name'),
                    supabase.from('subject_rooms').select('subject_id, room_id, priority'),
                ]);

                if (t.error) {
                    console.error('Teachers query error:', t.error);
                }
                if (sub.error) {
                    console.error('Subjects query error:', sub.error);
                }
                if (r.error) {
                    console.error('Rooms query error:', r.error);
                }
                if (sec.error) {
                    console.error('Sections query error:', sec.error);
                }
                if (sch.error) {
                    console.error('Schedules query error:', sch.error);
                }
                if (prefs.error) {
                    console.error('Preferences query error:', prefs.error);
                }
                if (prof.error) {
                    console.error('Profiles query error:', prof.error);
                }

            // Index preferences by teacher_id for quick lookup
            type PrefRow = {
                teacher_id: string;
                preferred_days: string[] | null;
                preferred_time_start: string | null;
                preferred_time_end: string | null;
                max_classes_per_day: number | null;
                max_consecutive_classes: number | null;
                availability: Record<string, boolean> | null;
            };
            const prefByTeacher = new Map<string, PrefRow>();
            for (const p of (prefs.data as unknown as PrefRow[]) || []) {
                prefByTeacher.set(p.teacher_id, p);
            }

            // Index profiles by id for quick lookup
            type ProfileRow = {
                id: string;
                full_name: string;
            };
            const profileById = new Map<string, ProfileRow>();
            for (const p of (prof.data as unknown as ProfileRow[]) || []) {
                profileById.set(p.id, p);
            }

            // Populate compatible_rooms from subject_rooms data
            const subjectRoomsMap = new Map<string, Array<{ room_id: string; priority: number }>>();
            for (const row of (sr.data as unknown as { subject_id: string; room_id: string; priority: number }[]) || []) {
                const existing = subjectRoomsMap.get(row.subject_id) || [];
                existing.push({ room_id: row.room_id, priority: row.priority });
                subjectRoomsMap.set(row.subject_id, existing);
            }

            setSubjects(
                ((sub.data as unknown as Subject[]) || []).map(s => ({
                    ...s,
                    compatible_rooms: subjectRoomsMap.get(s.id) || [],
                }))
            );
            setTeachers(
                ((t.data as unknown as { id: string; max_hours: number | null; weight: number; priority_note: string | null; profile_id: string | null }[]) || [])
                    .map(x => {
                        const pref = prefByTeacher.get(x.id);
                        const profile = x.profile_id ? profileById.get(x.profile_id) : null;
                        return {
                            id: x.id,
                            max_hours: x.max_hours,
                            full_name: profile?.full_name || 'Unnamed',
                            weight: x.weight ?? 50,
                            priority_note: x.priority_note,
                            preferred_days: pref?.preferred_days || undefined,
                            preferred_time_start: pref?.preferred_time_start || null,
                            preferred_time_end: pref?.preferred_time_end || null,
                            max_classes_per_day: pref?.max_classes_per_day ?? null,
                            max_consecutive_classes: pref?.max_consecutive_classes ?? null,
                            availability: pref?.availability || undefined,
                        };
                    }),
            );
            setRooms((r.data as unknown as Room[]) || []);
            setSections((sec.data as unknown as Section[]) || []);
            setExisting((sch.data as unknown as ExistingSchedule[]) || []);
            setDataLoading(false);
            } catch (err) {
                console.error('Data load error:', err);
                setDataLoading(false);
            }
        };
        load();
        
        // Subscribe to state changes from Conflicts tab
        const unsubscribe = scheduleStateManager.subscribe((event) => {
            if (event.source === 'conflicts' && event.type === 'schedule_updated') {
                console.log('[GENERATE] State updated by Conflicts tab, refreshing existing schedules');
                scheduleLogger.system.cacheInvalidated('conflicts');
                // Refresh existing schedules when Conflicts tab applies fixes
                refreshExisting();
            }
        });
        
        return () => {
            unsubscribe(); // Unsubscribe from state manager
        };
    }, [user?.id]);

    const blockers = useMemo(() => {
        const issues: string[] = [];
        if (subjects.length === 0) issues.push('No subjects found. Add subjects in Data.');
        if (teachers.length === 0) issues.push('No teachers found. Add teachers in Data.');
        if (rooms.length === 0) issues.push('No rooms found. Add rooms in Data.');
        if (sections.length === 0) issues.push('No sections found. Add sections in Data.');
        if (config.days.length === 0) issues.push('Select at least one working day.');
        if (toMinutes(config.dayEnd) <= toMinutes(config.dayStart)) issues.push('Day end must be after day start.');
        if (config.sessionMinutes <= 0) issues.push('Session length must be positive.');
        if (config.mode === 'partial' && !config.partialTarget?.id) issues.push('Pick a partial regeneration target.');
        return issues;
    }, [subjects, teachers, rooms, sections, config]);

    // Auto-switch to results stage when generator reports completion
    useEffect(() => {
        if (generating && progress.subStage === 'done' && result) {
            setStage('results');
            setMaxStageReached('results');
        }
    }, [generating, progress.subStage, result]);

    const stageIndex = STAGES.findIndex(s => s.key === stage);

    const versionSummary: VersionSummary[] = useMemo(() => {
        const states: WorkflowState[] = ['draft', 'submitted', 'approved', 'published'];
        return states.map(state => {
            const rows = existing.filter(e => ((e.status as WorkflowState) || 'draft') === state);
            const latest = rows.reduce<string | null>((acc, r) => {
                if (!r.created_at) return acc;
                return !acc || r.created_at > acc ? r.created_at : acc;
            }, null);
            // For published state, count schedule_versions instead of schedules
            const count = state === 'published' 
                ? (rows.length > 0 ? 1 : 0) // Each published schedule represents one version
                : rows.length;
            return { state, count, latest, label: WORKFLOW_META[state].label, desc: WORKFLOW_META[state].desc };
        });
    }, [existing]);

    const transitionAll = async (from: WorkflowState, to: WorkflowState) => {
        // Collect the row ids in this status so the update never reaches unrelated
        // schedules that land in the table between the read and the write.
        const matchingSchedules = existing.filter(e => ((e.status as WorkflowState) || 'draft') === from) as Array<ExistingSchedule & { batch_id?: string | null }>;
        const ids = matchingSchedules.map(e => e.id);
        if (ids.length === 0) return;
        
        // Extract batch ID for version service operations
        const batchIds = new Set(matchingSchedules.filter(s => Boolean(s.batch_id)).map(s => s.batch_id as string));
        const batchId = Array.from(batchIds)[0];

        setWorkflowBusy(from);
        setWorkflowNote(null);
        setWorkflowError(null);
        try {
            const versionWorkflowService = scheduleVersionService as VersionWorkflowService;

            if (batchId && user?.id) {
                scheduleVersionService.initialize(supabase, user.id);
                if (to === 'submitted') {
                    const result = await scheduleVersionService.submitSchedule(batchId, { changeReason: 'Submitted via workflow panel' });
                    if (!result.success) throw new Error(result.message);
                } else if (to === 'approved') {
                    const result = await versionWorkflowService.approveSchedule(batchId, { changeReason: 'Approved via workflow panel' });
                    if (!result.success) throw new Error(result.message);
                } else if (to === 'published') {
                    const result = await versionWorkflowService.publishApprovedSchedule(batchId, { changeReason: 'Published via workflow panel' });
                    if (!result.success) throw new Error(result.message);
                }
            } else {
                // Fallback for legacy items without batch_id
                const { error } = await supabase.from('schedules').update({ 
                    status: to,
                    submitted_at: to === 'submitted' ? new Date().toISOString() : undefined,
                    approved_at: to === 'approved' ? new Date().toISOString() : undefined,
                    approved_by: to === 'approved' && user ? user.id : undefined,
                }).in('id', ids);
                if (error) throw error;
            }

            // Log audit for each schedule status change
            // Temporarily disabled - log_audit RPC function doesn't exist
            // for (const id of ids) {
            //     if (to === 'submitted') {
            //         await scheduleAudit.submitted(id, { submitted_by: user?.id });
            //     } else if (to === 'published') {
            //         await scheduleAudit.published(id, { published_by: user?.id });
            //     } else if (to === 'approved') {
            //         await scheduleAudit.approved(id, { approved_by: user?.id });
            //     }
            // }
            
            await refreshExisting();
            setWorkflowNote(`${ids.length} ${WORKFLOW_META[from].label.toLowerCase()} ${ids.length === 1 ? 'entry' : 'entries'} moved to ${WORKFLOW_META[to].label}.`);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setWorkflowError(`Could not update: ${msg}`);
        } finally {
            setWorkflowBusy(null);
        }
    };

    const canAdvance = (from: StageKey): boolean => {
        if (from === 'review') return blockers.length === 0;
        if (from === 'generate') return !!result && !generating;
        if (from === 'results') return !!result && result.entries.length > 0;
        return true;
    };

    const goNext = () => {
        const next = STAGES[stageIndex + 1];
        if (next && canAdvance(stage)) {
            setStage(next.key);
            // Update max stage reached
            const nextIdx = STAGES.findIndex(s => s.key === next.key);
            const maxIdx = STAGES.findIndex(s => s.key === maxStageReached);
            if (nextIdx > maxIdx) {
                setMaxStageReached(next.key);
            }
        }
    };
    const goBack = () => {
        const prev = STAGES[stageIndex - 1];
        if (prev && !generating) setStage(prev.key);
    };
    const jumpTo = (key: StageKey) => {
        if (generating) return;
        const targetIdx = STAGES.findIndex(s => s.key === key);
        const maxIdx = STAGES.findIndex(s => s.key === maxStageReached);
        const currentIdx = STAGES.findIndex(s => s.key === stage);

        // Ensure maxStageReached never decreases - if current stage is higher, update it
        if (currentIdx > maxIdx) {
            setMaxStageReached(stage);
            // Recalculate maxIdx after update
            const newMaxIdx = STAGES.findIndex(s => s.key === stage);
            if (targetIdx <= newMaxIdx) {
                setStage(key);
            }
            return;
        }

        // Allow jumping to any phase up to the maximum phase reached
        if (targetIdx <= maxIdx) {
            setStage(key);
        }
    };

    const startGeneration = async () => {
        setGenerating(true);
        setResult(null);
        setSavedId(null);
        setSaveError(null);
        cancelRef.current = false;
        setGenerationStartTime(Date.now());
        // Initialize progress with config values
        setProgress({
            subStage: 'loading',
            attempt: 0,
            totalAttempts: config.maxAttempts,
            placed: 0,
            total: undefined, // Will be set by generator
            message: 'Initializing...',
        });
        try {
            // Fetch institutional policies (optional, generation proceeds with defaults if fetch fails)
            let institutionalPolicies: Record<string, unknown> = {};
            try {
                institutionalPolicies = await getRulesAsRecord();
            } catch (error) {
                console.warn('Failed to fetch system rules, using defaults:', error);
                // Generation continues with empty policies (defaults)
            }

            const res = await runGenerator(
                { subjects, teachers, rooms, sections, existing, config, institutionalPolicies },
                p => setProgress(p),
            );
            if (cancelRef.current) return;
            setResult(res);
            setStage('results');
        } finally {
            setGenerating(false);
            setGenerationStartTime(null);
        }
    };

    const cancelGeneration = () => {
        cancelRef.current = true;
        setGenerating(false);
        setGenerationStartTime(null);
        setProgress(p => ({ ...p, subStage: 'idle', message: 'Cancelled' }));
    };

    const saveAs = async (initialState: 'draft' | 'submitted') => {
        if (!result) return;

        console.log('[SAVE AS] Called with initialState:', initialState);

        // If submitting, check for existing active schedule
        if (initialState === 'submitted') {
            try {
                const summary = await scheduleVersionService.getActiveScheduleSummary();
                setCurrentScheduleSummary(summary);

                if (summary && summary.exists) {
                    // Show overwrite confirmation modal
                    console.log('[SAVE AS] Showing overwrite confirmation modal');
                    setShowOverwriteConfirm(true);
                    return;
                }
            } catch (error) {
                console.error('[SAVE] Error checking active schedule:', error);
                // Continue with save even if check fails
            }
        }

        // Proceed with save
        console.log('[SAVE AS] Proceeding with performSave, initialState:', initialState);
        await performSave(initialState);
    };

    const performSave = async (initialState: 'draft' | 'submitted') => {
        if (!result) return;
        if (!user?.id) {
            setSaveError('Not authenticated. Please log in again.');
            return;
        }

        setSaving(true);
        setSaveError(null);
        setSavedId(null);

        // Initialize state tracker with all variables
        const saveState = {
            step: 'init',
            timestamp: Date.now(),
            startScheduleCount: result.entries.length,
            mode: config.mode,
            partialTarget: config.partialTarget,
            userId: user.id,
            batchId: null as string | null,
            versionId: null as string | null,
            createdScheduleIds: [] as string[],
            savedAt: null as string | null,
            errors: [] as string[],
        };

        console.log('[SAVE START] Comprehensive save with state tracking:', saveState);

        try {
            // Step 1: Verify service initialization
            saveState.step = 'verify_service';
            scheduleVersionService.initialize(supabase, user.id);
            console.log('[SAVE] Version service initialized');

            // Step 2: Handle partial mode cleanup
            saveState.step = 'cleanup_partial';
            if (config.mode === 'partial') {
                const t = config.partialTarget;
                if (!t?.id) throw new Error('No partial regeneration target selected.');

                const column =
                    t.kind === 'section' ? 'section_id' :
                    t.kind === 'teacher' ? 'teacher_id' :
                    t.kind === 'room' ? 'room_id' : 'subject_id';

                const { error: delErr } = await supabase
                    .from('schedules')
                    .delete()
                    .eq(column, t.id)
                    .in('status', ['draft', 'submitted', 'approved']);

                if (delErr) throw delErr;
                console.log('[SAVE] Cleaned up partial mode schedules for', t.kind);
            }

            // Step 3: Convert result entries to Schedule format
            saveState.step = 'convert_schedules';
            const schedules: Schedule[] = result.entries.map(e => ({
                id: crypto.randomUUID(),
                subject_id: e.subjectId,
                teacher_id: e.teacherId,
                room_id: e.roomId,
                section_id: e.sectionId,
                day_of_week: e.day as 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday',
                start_time: e.start,
                end_time: e.end,
                semester: '1st Semester',
                academic_year: '2025-2026',
                status: initialState,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                created_by: user.id,
                submitted_at: null,
                approved_by: null,
                approved_at: null,
                rejected_by: null,
                rejected_at: null,
                rejection_reason: null,
                deleted_at: null,
                deleted_by: null,
                is_locked: false,
                locked_by: null,
                locked_at: null,
                lock_reason: null,
            }));

            saveState.createdScheduleIds = schedules.map(s => s.id);
            console.log('[SAVE] Converted to schedules format:', schedules.length, 'entries');

            // Step 4: Save to database via version service
            saveState.step = 'persist_version';
            let saveResult;

            if (initialState === 'draft') {
                console.log('[SAVE] Saving as draft...');
                saveResult = await scheduleVersionService.saveDraft(schedules, {
                    academic_year: '2025-2026',
                    semester: '1st Semester',
                    score: result.score,
                    conflictCount: 0,
                    changeReason: 'Generated from Generate tab',
                });

                saveState.batchId = saveResult.version_set_id;
                saveState.versionId = saveResult.active_version_id;

                if (!saveResult.success) {
                    throw new Error(saveResult.message || 'Draft save failed');
                }

                console.log('[SAVE] Draft saved with batch:', saveState.batchId);
            } else {
                // Submitted mode: save as draft first
                console.log('[SAVE] Saving as draft before submission...');
                const draftResult = await scheduleVersionService.saveDraft(schedules, {
                    academic_year: '2025-2026',
                    semester: '1st Semester',
                    score: result.score,
                    conflictCount: 0,
                    changeReason: 'Generated for submission',
                });

                saveState.batchId = draftResult.version_set_id;
                saveState.versionId = draftResult.active_version_id;

                if (!draftResult.success) {
                    throw new Error(draftResult.message || 'Draft save failed');
                }

                console.log('[SAVE] Draft saved, batch:', saveState.batchId);

                // Now submit the draft
                saveState.step = 'submit_version';
                console.log('[SAVE] Submitting draft...');
                const submitResult = await scheduleVersionService.submitSchedule(
                    draftResult.version_set_id!,
                    { changeReason: 'Submitted from Generate tab' }
                );

                if (!submitResult.success) {
                    throw new Error(submitResult.message || 'Submission failed');
                }

                console.log('[SAVE] Schedule submitted successfully');
            }

            // Step 5: Verify persistence
            saveState.step = 'verify_persistence';
            if (!saveState.batchId) {
                throw new Error('Batch ID not set after save');
            }

            const { data: savedSchedules, error: fetchError } = await supabase
                .from('schedules')
                .select('id, status, is_active, batch_id')
                .eq('batch_id', saveState.batchId)
                .eq('is_active', true);

            if (fetchError || !savedSchedules) {
                throw new Error(
                    `Failed to verify saved schedules: ${fetchError?.message || 'Unknown error'}`
                );
            }

            if (savedSchedules.length !== schedules.length) {
                const warning = `Schedule count mismatch: expected ${schedules.length}, got ${savedSchedules.length}`;
                console.warn('[SAVE]', warning);
                saveState.errors.push(warning);
            }

            console.log('[SAVE] Persistence verified:', savedSchedules.length, 'schedules');

            // Step 6: Detect conflicts
            saveState.step = 'detect_conflicts';
            const { data: fullSchedules, error: fullError } = await supabase
                .from('schedules')
                .select(`
                    id, subject_id, teacher_id, room_id, section_id, 
                    day_of_week, start_time, end_time, status, is_active,
                    subject:subjects(*),
                    teacher:teachers(*),
                    room:rooms(*),
                    section:sections(*)
                `)
                .eq('batch_id', saveState.batchId)
                .eq('is_active', true);

            if (!fullError && fullSchedules && fullSchedules.length > 0) {
                const conflicts = detectConflicts(fullSchedules);
                console.log('[SAVE] Detected conflicts:', conflicts.length);

                // Save conflicts
                if (conflicts.length > 0) {
                    const conflictInserts = conflicts.map((c: DetectedConflict) => ({
                        type: c.type,
                        severity: c.severity,
                        title: c.title,
                        description: c.description,
                        schedule_a_id: c.scheduleAId,
                        schedule_b_id: c.scheduleBId,
                        is_resolved: false,
                    }));

                    const { error: conflictError } = await supabase
                        .from('conflicts')
                        .insert(conflictInserts);

                    if (conflictError) {
                        console.warn('[SAVE] Conflict save error:', conflictError);
                        saveState.errors.push(`Conflict save failed: ${conflictError.message}`);
                    } else {
                        console.log('[SAVE] Conflicts saved');
                    }
                }
            }

            // Step 7: Audit logging
            // Temporarily disabled - log_audit RPC function doesn't exist
            // saveState.step = 'audit_logging';
            // if (savedSchedules && savedSchedules.length > 0) {
            //     for (const schedule of savedSchedules) {
            //         await scheduleAudit.created(schedule.id, {
            //             section: result.entries[0]?.sectionId,
            //             teacher: result.entries[0]?.teacherId,
            //             subject: result.entries[0]?.subjectId,
            //         });
            //     }
            //     console.log('[SAVE] Audit logged for', savedSchedules.length, 'schedules');
            // }
            console.log('[SAVE] Audit logging skipped (RPC function not implemented)');

            // Step 8: Student notifications
            saveState.step = 'notify_students';
            const affectedSections = Array.from(new Set(result.entries.map(e => e.sectionId)));
            await notifyStudentsOfScheduleChanges(affectedSections, initialState, false);
            console.log('[SAVE] Notified students for', affectedSections.length, 'sections');

            // Step 9: Refresh UI state
            saveState.step = 'refresh_ui';
            await refreshExisting();
            console.log('[SAVE] Refreshed UI state');

            // Success - update UI
            saveState.savedAt = new Date().toISOString();
            saveState.step = 'complete';
            setSavedId(initialState);

            console.log('[SAVE COMPLETE] Final state:', saveState);
        } catch (err) {
            saveState.step = 'error';
            const errorMessage = err instanceof Error ? err.message : String(err);
            saveState.errors.push(errorMessage);

            console.error('[SAVE ERROR] State at failure:', saveState);
            console.error('[SAVE ERROR] Full error:', err);

            // Determine user-friendly error message
            let userMessage = 'Save failed';
            if (errorMessage.includes('count mismatch')) {
                userMessage = 'Some schedules failed to save. Please verify in the Schedules tab and try again.';
            } else if (errorMessage.includes('not authenticated')) {
                userMessage = 'Not authenticated. Please log in again.';
            } else if (errorMessage.includes('version') || errorMessage.includes('batch')) {
                userMessage = 'Version control error. Please try again.';
            } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
                userMessage = 'Network error. Check your connection and try again.';
            } else {
                userMessage = `Save failed: ${errorMessage}`;
            }

            setSaveError(userMessage);

            // Log to system
            scheduleLogger.system.error('generate', 'persistence', 'Save failed', {
                message: errorMessage,
                state: saveState,
                originalError: err,
            });
        } finally {
            setSaving(false);
        }
    };

    const handleOverwriteConfirm = async () => {
        if (!result) return;
        
        setShowOverwriteConfirm(false);
        
        // Initialize version service
        scheduleVersionService.initialize(supabase, user?.id || '');
        
        // Use version service to publish with overwrite
        const schedules = result.entries.map(e => ({
            id: crypto.randomUUID(),
            subject_id: e.subjectId,
            teacher_id: e.teacherId,
            room_id: e.roomId,
            section_id: e.sectionId,
            day_of_week: e.day as 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday',
            start_time: e.start,
            end_time: e.end,
            status: 'published' as const,
            semester: '1st Semester',
            academic_year: '2025-2026',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: user?.id || null,
            submitted_at: null,
            approved_by: null,
            approved_at: null,
            rejected_by: null,
            rejected_at: null,
            rejection_reason: null,
            deleted_at: null,
            deleted_by: null,
            is_locked: false,
            locked_by: null,
            locked_at: null,
            lock_reason: null,
        }));

        const publishResult = await scheduleVersionService.publishSchedule(schedules, {
            academic_year: '2025-2026',
            semester: '1st Semester',
            score: result.score,
            conflictCount: 0,
            changeReason: 'Published from Generate tab',
            force: true,
        });

        if (publishResult.success) {
            setSavedId('published');
            await refreshExisting();
        } else {
            setSaveError(publishResult.message);
        }
    };

    const handleOverwriteCancel = () => {
        setShowOverwriteConfirm(false);
        setCurrentScheduleSummary(null);
    };
    const saveDraft = () => saveAs('draft');
    const saveAndSubmit = () => saveAs('submitted');

    const resetAll = () => {
        setResult(null);
        setSavedId(null);
        setSaveError(null);
        setStage('scope');
        setMaxStageReached('scope');
    };

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title"><Sparkles size={20} /> Generate</h1>
                    <p className="dashboard-subtitle">
                        Build a conflict-free weekly schedule. {STAGES[stageIndex].hint}.
                    </p>
                </div>
                <div className="dash-header-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={() => updatePreferences({ compact_mode: !preferences.compact_mode })}
                        title={preferences.compact_mode ? 'Show detailed view' : 'Show compact view'}
                    >
                        <Layers size={14} /> {preferences.compact_mode ? 'Detailed' : 'Compact'}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => setVersionsOpen(v => !v)}
                        aria-expanded={versionsOpen}
                    >
                        <FileClock size={14} /> Versions
                        {versionsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>
            </div>

            {versionsOpen && (
                <VersionsPanel
                    summary={versionSummary}
                    busy={workflowBusy}
                    note={workflowNote}
                    error={workflowError}
                    canApprove={canApprove}
                    onSubmitDrafts={() => transitionAll('draft', 'submitted')}
                    onApproveSubmitted={() => transitionAll('submitted', 'approved')}
                    onPublishApproved={() => transitionAll('approved', 'published')}
                    onDismissNote={() => { setWorkflowNote(null); setWorkflowError(null); }}
                />
            )}

            <Stepper stage={stage} onJump={jumpTo} canJump={!generating} maxStageReached={maxStageReached} />

            {dataLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : (
                <div className={`sg-stage-card ${preferences.compact_mode ? 'sg-compact' : ''}`}>
                    {stage === 'scope' && (
                        <ScopeStage
                            config={config}
                            setConfig={setConfig}
                            sections={sections}
                            teachers={teachers}
                            rooms={rooms}
                            subjects={subjects}
                            compact={preferences.compact_mode}
                        />
                    )}
                    {stage === 'structure' && (
                        <StructureStage config={config} setConfig={setConfig} compact={preferences.compact_mode} />
                    )}
                    {stage === 'constraints' && (
                        <ConstraintsStage config={config} setConfig={setConfig} compact={preferences.compact_mode} />
                    )}
                    {stage === 'priorities' && (
                        <PrioritiesStage config={config} setConfig={setConfig} sections={sections} subjects={subjects} compact={preferences.compact_mode} />
                    )}
                    {stage === 'review' && (
                        <ReviewStage
                            config={config}
                            blockers={blockers}
                            counts={{ subjects: subjects.length, teachers: teachers.length, rooms: rooms.length, sections: sections.length, existing: existing.length }}
                            targetLabel={resolveTargetLabel(config.partialTarget, { sections, teachers, rooms, subjects })}
                        />
                    )}
                    {stage === 'generate' && (
                        <GenerateStage
                            progress={progress}
                            generating={generating}
                            generationStartTime={generationStartTime}
                            onCancel={cancelGeneration}
                            onRun={startGeneration}
                        />
                    )}
                    {stage === 'results' && result && (
                        <ResultsStage
                            result={result}
                        />
                    )}
                    {stage === 'outcome' && result && (
                        <OutcomeStage
                            result={result}
                            teachers={teachers}
                            rooms={rooms}
                            sections={sections}
                        />
                    )}
                    {stage === 'save' && result && (
                        <>
                            {/* Publish Status Card */}
                            {currentScheduleSummary && currentScheduleSummary.exists && (
                                <div style={{
                                    marginBottom: 24,
                                    padding: 20,
                                    backgroundColor: 'var(--surface-soft)',
                                    border: '1px solid var(--border-light)',
                                    borderRadius: 'var(--radius-md)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 16
                                }}>
                                    <div style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 'var(--radius-md)',
                                        backgroundColor: 'var(--accent-warning-10, rgba(211, 139, 32, 0.1))',
                                        border: '2px solid var(--accent-warning)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <AlertTriangle size={24} style={{ color: 'var(--accent-warning)' }} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                                            Active Schedule Published
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                            {currentScheduleSummary.version && `Version ${currentScheduleSummary.version} • `}
                                            {currentScheduleSummary.timestamp && new Date(currentScheduleSummary.timestamp).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </div>
                                        {currentScheduleSummary.sessionCount !== undefined && currentScheduleSummary.score !== undefined && (
                                            <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                                                <span style={{ color: 'var(--text-muted)' }}>
                                                    <strong style={{ color: 'var(--text-primary)' }}>{currentScheduleSummary.sessionCount}</strong> sessions
                                                </span>
                                                <span style={{ color: 'var(--text-muted)' }}>
                                                    Score: <strong style={{ color: 'var(--text-primary)' }}>{currentScheduleSummary.score.toFixed(0)}</strong>
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{
                                        padding: '8px 16px',
                                        backgroundColor: 'var(--accent-warning)',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        color: 'white',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        Overwrite Required
                                    </div>
                                </div>
                            )}
                            <SaveStage
                                result={result}
                                saving={saving}
                                savedId={savedId}
                                saveError={saveError}
                                onSave={saveDraft}
                                onSaveAndSubmit={saveAndSubmit}
                                onRegenerate={() => { setStage('generate'); setTimeout(startGeneration, 50); }}
                                onReset={resetAll}
                            />
                        </>
                    )}
                </div>
            )}

            {!dataLoading && stage !== 'generate' && (
                <div className="sg-nav">
                    <button className="btn btn-secondary" onClick={goBack} disabled={stageIndex === 0 || generating}>
                        <ArrowLeft size={14} /> Back
                    </button>
                    {stage === 'review' ? (
                        <button className="btn btn-primary" onClick={() => { setStage('generate'); setTimeout(startGeneration, 50); }} disabled={blockers.length > 0}>
                            <Sparkles size={14} /> Start generation
                        </button>
                    ) : stage === 'results' ? (
                        <button className="btn btn-primary" onClick={() => setStage('outcome')} disabled={!result || result.entries.length === 0}>
                            View Outcome <ArrowRight size={14} />
                        </button>
                    ) : stage === 'outcome' ? (
                        <button className="btn btn-primary" onClick={() => setStage('save')} disabled={!result || result.entries.length === 0}>
                            Continue to save <ArrowRight size={14} />
                        </button>
                    ) : stage === 'save' ? null : (
                        <button className="btn btn-primary" onClick={goNext} disabled={!canAdvance(stage)}>
                            Next <ArrowRight size={14} />
                        </button>
                    )}
                </div>
            )}
            
            {/* Overwrite Confirmation Modal */}
            {showOverwriteConfirm && currentScheduleSummary && result && (
                <PublishOverwriteConfirm
                    isOpen={showOverwriteConfirm}
                    currentSchedule={currentScheduleSummary}
                    newSchedule={{
                        sessionCount: result.placed,
                        score: result.score,
                    }}
                    onConfirm={handleOverwriteConfirm}
                    onCancel={handleOverwriteCancel}
                />
            )}
        </div>
    );
};

const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

const Stepper: React.FC<{ stage: StageKey; onJump: (k: StageKey) => void; canJump: boolean; maxStageReached: StageKey }> = ({ stage, onJump, canJump, maxStageReached }) => {
    const idx = STAGES.findIndex(s => s.key === stage);
    const maxIdx = STAGES.findIndex(s => s.key === maxStageReached);
    const onKey = (e: React.KeyboardEvent, i: number) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
        e.preventDefault();
        let next = i;
        if (e.key === 'ArrowLeft')  next = Math.max(0, i - 1);
        if (e.key === 'ArrowRight') next = Math.min(maxIdx, i + 1);
        if (e.key === 'Home')       next = 0;
        if (e.key === 'End')        next = maxIdx;
        const el = document.querySelector<HTMLButtonElement>(`[data-sg-step="${STAGES[next].key}"]`);
        el?.focus();
    };
    return (
        <ol className="sg-stepper" role="tablist" aria-label="Generation stages">
            {STAGES.map((s, i) => {
                // Use maxIdx to determine if a stage has been visited (not grayed out)
                const state = i < idx ? 'done' : i === idx ? 'current' : i <= maxIdx ? 'visited' : 'upcoming';
                // Button is clickable if: not generating AND stage has been visited (i <= maxIdx)
                const isClickable = canJump && i <= maxIdx;
                return (
                    <li key={s.key} className={`sg-step sg-step-${state}`}>
                        <button
                            type="button"
                            role="tab"
                            data-sg-step={s.key}
                            className="sg-step-btn"
                            onClick={() => isClickable && onJump(s.key)}
                            onKeyDown={e => onKey(e, i)}
                            disabled={!isClickable}
                            aria-current={i === idx ? 'step' : undefined}
                            aria-selected={i === idx}
                            aria-label={`${i + 1} of ${STAGES.length}: ${s.label}. ${s.hint}.`}
                            tabIndex={i === idx ? 0 : -1}
                        >
                            <span className="sg-step-num" aria-hidden="true">{i < idx ? <CheckCircle size={14} /> : i <= maxIdx ? <CheckCircle size={14} /> : i + 1}</span>
                            <span className="sg-step-label">{s.label}</span>
                        </button>
                    </li>
                );
            })}
        </ol>
    );
};

// ---------------------------------------------------------------------------
// Stage 1 — Scope
// ---------------------------------------------------------------------------

const ScopeStage: React.FC<{
    config: GenerationConfig;
    setConfig: React.Dispatch<React.SetStateAction<GenerationConfig>>;
    sections: Section[];
    teachers: Teacher[];
    rooms: Room[];
    subjects: Subject[];
    compact?: boolean;
}> = ({ config, setConfig, sections, teachers, rooms, subjects, compact = false }) => {
    const allSelected = config.sectionIds.length === 0;
    const [studentFilter, setStudentFilter] = useState<'all' | 'large' | 'small'>('all');
    
    const toggle = (id: string) => {
        setConfig(c => {
            const set = new Set(c.sectionIds);
            if (set.has(id)) set.delete(id); else set.add(id);
            return { ...c, sectionIds: Array.from(set) };
        });
    };
    
    const toggleGroup = (groupSections: Section[]) => {
        const allSelected = groupSections.every(s => config.sectionIds.includes(s.id));
        if (allSelected) {
            // Deselect all in group
            setConfig(c => ({
                ...c,
                sectionIds: c.sectionIds.filter(id => !groupSections.some(s => s.id === id)),
            }));
        } else {
            // Select all in group
            setConfig(c => ({
                ...c,
                sectionIds: [...new Set([...c.sectionIds, ...groupSections.map(s => s.id)])],
            }));
        }
    };
    
    const grouped = useMemo(() => {
        const m = new Map<string, Section[]>();
        for (const s of sections) {
            const k = `${s.program || 'Unassigned'} · Year ${s.year_level ?? '?'}`;
            const arr = m.get(k) || [];
            arr.push(s);
            m.set(k, arr);
        }
        return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [sections]);

    const filteredGrouped = useMemo(() => {
        if (studentFilter === 'all') return grouped;
        return grouped.map(([group, list]) => {
            const filtered = list.filter(s => {
                if (studentFilter === 'large') return (s.student_count || 0) >= 30;
                if (studentFilter === 'small') return (s.student_count || 0) > 0 && (s.student_count || 0) < 30;
                return true;
            });
            return [group, filtered] as [string, Section[]];
        }).filter(([, list]) => list.length > 0);
    }, [grouped, studentFilter]);

    // Get default institutional policies for each mode
    const getModePolicies = (mode: GenerationConfig['mode']) => {
        switch (mode) {
            case 'full':
                // Full generation: prioritize getting everything scheduled
                return {
                    overflowPolicy: 'relax_soft' as const,
                    maxCapacity: 100,
                    overflowPercent: 15,
                };
            case 'partial':
                // Partial regeneration: conservative to avoid disrupting existing schedules
                return {
                    overflowPolicy: 'partial_only' as const,
                    maxCapacity: 100,
                    overflowPercent: 10,
                };
            default:
                return {
                    overflowPolicy: 'fail' as const,
                    maxCapacity: 100,
                    overflowPercent: 0,
                };
        }
    };

    const setMode = (mode: GenerationConfig['mode']) =>
        setConfig(c => ({
            ...c,
            mode,
            partialTarget: mode === 'full' ? null : c.partialTarget,
            ...getModePolicies(mode),
        }));

    const setPartialKind = (kind: PartialKind) =>
        setConfig(c => ({ ...c, partialTarget: { kind, id: '' } }));

    const setPartialId = (id: string) =>
        setConfig(c => ({ ...c, partialTarget: c.partialTarget ? { ...c.partialTarget, id } : { kind: 'section', id } }));

    const targetOptions: { id: string; label: string; sub?: string }[] = useMemo(() => {
        const kind = config.partialTarget?.kind ?? 'section';
        if (kind === 'section') return sections.map(s => ({
            id: s.id, label: s.name,
            sub: [s.program, s.year_level ? `Year ${s.year_level}` : null].filter(Boolean).join(' · '),
        }));
        if (kind === 'teacher') return teachers.map(t => ({ id: t.id, label: t.full_name }));
        if (kind === 'room')    return rooms.map(r => ({
            id: r.id, label: r.name,
            sub: [r.building, r.type, r.capacity ? `${r.capacity} seats` : null].filter(Boolean).join(' · '),
        }));
        return subjects.map(s => ({ id: s.id, label: s.code, sub: s.name }));
    }, [config.partialTarget?.kind, sections, teachers, rooms, subjects]);

    return (
        <div>
            <StageHeader icon={<Users size={16} />} title="Scope" desc="Pick a generation mode, then choose what to generate." compact={compact} />

            <div className="sg-mode-cards">
                {(['full', 'partial'] as GenerationMode[]).map(mode => (
                    <button
                        key={mode}
                        type="button"
                        className={`sg-mode-card ${config.mode === mode ? 'sg-mode-card-active' : ''}`}
                        onClick={() => setMode(mode)}
                    >
                        <div className="sg-mode-card-header">
                            <span className="sg-mode-card-icon">
                                {mode === 'full' && <Sparkles size={16} />}
                                {mode === 'partial' && <GitBranch size={16} />}
                            </span>
                            <span className="sg-mode-card-title">{MODE_LABELS[mode].label}</span>
                        </div>
                        {!compact && (
                            <div className="sg-mode-card-desc">{MODE_LABELS[mode].desc}</div>
                        )}
                    </button>
                ))}
            </div>

            {config.mode === 'full' ? (
                <>
                    <div className="sg-row">
                        <button className={`sg-chip ${allSelected ? 'sg-chip-active' : ''}`} onClick={() => setConfig(c => ({ ...c, sectionIds: [] }))}>All sections</button>
                        <button className={`sg-chip ${!allSelected ? 'sg-chip-active' : ''}`} onClick={() => { if (allSelected && sections[0]) setConfig(c => ({ ...c, sectionIds: [sections[0].id] })); }}>Custom selection</button>
                    </div>

                    {!allSelected && (
                        <>
                            <div className="sg-row" style={{ marginBottom: 12 }}>
                                <span className="sg-field-label">Filter by size</span>
                                <div className="sg-chip-wrap">
                                    <button className={`sg-chip ${studentFilter === 'all' ? 'sg-chip-active' : ''}`} onClick={() => setStudentFilter('all')}>All</button>
                                    <button className={`sg-chip ${studentFilter === 'large' ? 'sg-chip-active' : ''}`} onClick={() => setStudentFilter('large')}>30+ students</button>
                                    <button className={`sg-chip ${studentFilter === 'small' ? 'sg-chip-active' : ''}`} onClick={() => setStudentFilter('small')}>Under 30</button>
                                </div>
                            </div>
                            <div className="sg-scroll">
                                {filteredGrouped.map(([group, list]) => (
                                    <div key={group} style={{ marginBottom: 14 }}>
                                        <div className="sg-group-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>{group}</span>
                                            <button className="sg-prio-mini" onClick={() => toggleGroup(list)} title="Select/deselect all in group">
                                                {list.every(s => config.sectionIds.includes(s.id)) ? 'Deselect all' : 'Select all'}
                                            </button>
                                        </div>
                                        <div className="sg-chip-wrap">
                                            {list.map(s => (
                                                <button
                                                    key={s.id}
                                                    className={`sg-chip ${config.sectionIds.includes(s.id) ? 'sg-chip-active' : ''}`}
                                                    onClick={() => toggle(s.id)}
                                                >
                                                    {s.name}
                                                    {s.student_count != null && <span className="sg-chip-sub">· {s.student_count}</span>}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            ) : (
                <PartialTargetPicker
                    target={config.partialTarget}
                    options={targetOptions}
                    onKindChange={setPartialKind}
                    onIdChange={setPartialId}
                />
            )}
        </div>
    );
};

const PartialTargetPicker: React.FC<{
    target: PartialTarget | null;
    options: { id: string; label: string; sub?: string }[];
    onKindChange: (kind: PartialKind) => void;
    onIdChange: (id: string) => void;
}> = ({ target, options, onKindChange, onIdChange }) => {
    const kind = target?.kind ?? 'section';
    return (
        <div className="sg-partial">
            <div className="sg-field-label">Target</div>
            <div className="sg-tabs-mini" style={{ marginBottom: 16 }}>
                {(Object.keys(PARTIAL_KIND_LABELS) as PartialKind[]).map(k => (
                    <button
                        key={k}
                        className={`sg-tab-mini ${kind === k ? 'sg-tab-mini-active' : ''}`}
                        onClick={() => onKindChange(k)}
                    >
                        {PARTIAL_KIND_LABELS[k]}
                    </button>
                ))}
            </div>
            <select
                className="input"
                value={target?.id || ''}
                onChange={e => onIdChange(e.target.value)}
                style={{ maxWidth: 420 }}
            >
                <option value="">Pick a {PARTIAL_KIND_LABELS[kind].toLowerCase()}</option>
                {options.map(o => (
                    <option key={o.id} value={o.id}>
                        {o.label}{o.sub ? ` (${o.sub})` : ''}
                    </option>
                ))}
            </select>
            <div className="sg-partial-hint">
                Existing sessions outside this {PARTIAL_KIND_LABELS[kind].toLowerCase()} become locked constraints. Matching sessions get re-solved.
            </div>
        </div>
    );
};

// Simple tooltip component for field labels
const FieldTooltip: React.FC<{ children: string }> = ({ children }) => (
    <div className="sg-field-tooltip-wrapper">
        <HelpCircle size={14} style={{ color: 'var(--text-muted)', cursor: 'help' }} />
        <div className="sg-field-tooltip">{children}</div>
    </div>
);

// ---------------------------------------------------------------------------
// Stage 2 — Structure
// ---------------------------------------------------------------------------

const StructureStage: React.FC<{ config: GenerationConfig; setConfig: React.Dispatch<React.SetStateAction<GenerationConfig>>; compact?: boolean }> = ({ config, setConfig, compact = false }) => {
    const toggleDay = (d: string) => setConfig(c => ({
        ...c,
        days: c.days.includes(d) ? c.days.filter(x => x !== d) : [...c.days, d],
    }));

    return (
        <div>
            <StageHeader icon={<Clock size={16} />} title="Structure" desc="Define the working week, session length, and break configuration." compact={compact} />

            <div className="sg-fields">
                <div>
                    <div className="sg-field-label">
                        Working days
                        <FieldTooltip>Select which days of the week classes can be scheduled. At least one day must be selected.</FieldTooltip>
                    </div>
                    <div className="sg-chip-wrap">
                        {ALL_DAYS.map(d => (
                            <button
                                key={d}
                                className={`sg-chip ${config.days.includes(d) ? 'sg-chip-active' : ''}`}
                                onClick={() => toggleDay(d)}
                            >{d.slice(0, 3)}</button>
                        ))}
                    </div>
                </div>

                <div className="sg-grid-3">
                    <div>
                        <div className="sg-field-label">
                            Day starts
                            <FieldTooltip>The earliest time classes can begin each day.</FieldTooltip>
                        </div>
                        <input type="time" className="input" value={config.dayStart} onChange={e => setConfig(c => ({ ...c, dayStart: e.target.value }))} />
                    </div>
                    <div>
                        <div className="sg-field-label">
                            Day ends
                            <FieldTooltip>The latest time classes can end each day.</FieldTooltip>
                        </div>
                        <input type="time" className="input" value={config.dayEnd} onChange={e => setConfig(c => ({ ...c, dayEnd: e.target.value }))} />
                    </div>
                    <div>
                        <div className="sg-field-label">
                            Session length
                            <FieldTooltip>Base duration for class sessions. The system will dynamically adjust to fit subject requirements without overflow.</FieldTooltip>
                        </div>
                        <select className="input" value={config.sessionMinutes} onChange={e => setConfig(c => ({ ...c, sessionMinutes: Number(e.target.value) }))}>
                            <option value={60}>60 minutes</option>
                            <option value={90}>90 minutes</option>
                            <option value={120}>120 minutes</option>
                        </select>
                    </div>
                </div>

                {/* Section 1: Break Mode */}
                <div className="sg-break-config-section">
                    <div className="sg-field-label sg-break-config-label">
                        Break Mode
                        <FieldTooltip>Choose between a fixed break time for everyone, or variable breaks that teachers/sections can customize.</FieldTooltip>
                    </div>
                    <div className="sg-break-mode-toggle">
                        <button
                            className={`btn ${config.breakMode === 'fixed' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setConfig(c => ({ ...c, breakMode: 'fixed' }))}
                        >
                            Fixed Break
                        </button>
                        <button
                            className={`btn ${config.breakMode === 'variable' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setConfig(c => ({ ...c, breakMode: 'variable' }))}
                        >
                            Variable Break
                        </button>
                    </div>

                    {config.breakMode === 'fixed' && (
                        <div className="sg-grid-3">
                            <div>
                                <div className="sg-field-label">
                                    Label
                                    <FieldTooltip>Name for this break period (e.g., Lunch, Recess).</FieldTooltip>
                                </div>
                                <input
                                    className="input"
                                    value={config.fixedBreak.label}
                                    onChange={e => setConfig(c => ({ ...c, fixedBreak: { ...c.fixedBreak, label: e.target.value } }))}
                                    placeholder="e.g., Lunch"
                                />
                            </div>
                            <div>
                                <div className="sg-field-label">
                                    Start time
                                    <FieldTooltip>When the break period starts each day.</FieldTooltip>
                                </div>
                                <input
                                    type="time"
                                    className="input"
                                    value={config.fixedBreak.start}
                                    onChange={e => setConfig(c => ({ ...c, fixedBreak: { ...c.fixedBreak, start: e.target.value } }))}
                                />
                            </div>
                            <div>
                                <div className="sg-field-label">
                                    End time
                                    <FieldTooltip>When the break period ends each day.</FieldTooltip>
                                </div>
                                <input
                                    type="time"
                                    className="input"
                                    value={config.fixedBreak.end}
                                    onChange={e => setConfig(c => ({ ...c, fixedBreak: { ...c.fixedBreak, end: e.target.value } }))}
                                />
                            </div>
                        </div>
                    )}

                    {config.breakMode === 'variable' && (
                        <div className="sg-grid-4">
                            <div>
                                <div className="sg-field-label">
                                    Start time
                                    <FieldTooltip>Earliest time teachers/sections can schedule their break.</FieldTooltip>
                                </div>
                                <input
                                    type="time"
                                    className="input"
                                    value={config.variableBreak.startTime}
                                    onChange={e => setConfig(c => ({ ...c, variableBreak: { ...c.variableBreak, startTime: e.target.value } }))}
                                />
                            </div>
                            <div>
                                <div className="sg-field-label">
                                    End time
                                    <FieldTooltip>Latest time teachers/sections can schedule their break.</FieldTooltip>
                                </div>
                                <input
                                    type="time"
                                    className="input"
                                    value={config.variableBreak.endTime}
                                    onChange={e => setConfig(c => ({ ...c, variableBreak: { ...c.variableBreak, endTime: e.target.value } }))}
                                />
                            </div>
                            <div>
                                <div className="sg-field-label">
                                    Duration (min)
                                    <FieldTooltip>Length of each break period in minutes.</FieldTooltip>
                                </div>
                                <input
                                    type="number"
                                    className="input"
                                    value={config.variableBreak.duration}
                                    onChange={e => setConfig(c => ({ ...c, variableBreak: { ...c.variableBreak, duration: Number(e.target.value) } }))}
                                    min={15}
                                    step={15}
                                />
                            </div>
                            <div>
                                <div className="sg-field-label">
                                    Increments (min)
                                    <FieldTooltip>Time granularity for scheduling breaks (e.g., 15 = breaks can start at :00, :15, :30, :45).</FieldTooltip>
                                </div>
                                <input
                                    type="number"
                                    className="input"
                                    value={config.variableBreak.increments}
                                    onChange={e => setConfig(c => ({ ...c, variableBreak: { ...c.variableBreak, increments: Number(e.target.value) } }))}
                                    min={15}
                                    step={15}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Section 2: Common Break */}
                <div className="sg-break-config-section">
                    <div className="sg-field-label sg-break-config-label">
                        Common Break
                        <FieldTooltip>Overrides all other breaks on selected day. All classes and teachers have a break at this time.</FieldTooltip>
                    </div>
                    <div className="sg-common-break-toggle">
                        <label className="sg-toggle-label">
                            <input
                                type="checkbox"
                                checked={config.commonBreak.enabled}
                                onChange={e => setConfig(c => ({ ...c, commonBreak: { ...c.commonBreak, enabled: e.target.checked } }))}
                                className="sg-toggle-checkbox"
                            />
                            <span className="sg-toggle-slider"></span>
                            <span className="sg-toggle-text">Enable Common Break</span>
                        </label>
                    </div>

                    {config.commonBreak.enabled && (
                        <div className="sg-grid-3">
                            <div>
                                <div className="sg-field-label">
                                    Day
                                    <FieldTooltip>Select which day has the common break.</FieldTooltip>
                                </div>
                                <select
                                    className="input"
                                    value={config.commonBreak.day}
                                    onChange={e => setConfig(c => ({ ...c, commonBreak: { ...c.commonBreak, day: e.target.value } }))}
                                >
                                    {ALL_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <div className="sg-field-label">
                                    Time
                                    <FieldTooltip>When the common break occurs on the selected day.</FieldTooltip>
                                </div>
                                <input
                                    type="time"
                                    className="input"
                                    value={config.commonBreak.time}
                                    onChange={e => setConfig(c => ({ ...c, commonBreak: { ...c.commonBreak, time: e.target.value } }))}
                                />
                            </div>
                            <div>
                                <div className="sg-field-label">
                                    Duration (min)
                                    <FieldTooltip>Length of the common break in minutes.</FieldTooltip>
                                </div>
                                <input
                                    type="number"
                                    className="input"
                                    value={config.commonBreak.duration}
                                    onChange={e => setConfig(c => ({ ...c, commonBreak: { ...c.commonBreak, duration: Number(e.target.value) } }))}
                                    min={15}
                                    step={15}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Stage 3 — Constraints
// ---------------------------------------------------------------------------

const ConstraintsStage: React.FC<{ config: GenerationConfig; setConfig: React.Dispatch<React.SetStateAction<GenerationConfig>>; compact?: boolean }> = ({ config, setConfig, compact = false }) => {
    const [hardConstraintsOpen, setHardConstraintsOpen] = useState(false);
    const [policiesOpen, setPoliciesOpen] = useState(false);
    const [softConstraintsOpen, setSoftConstraintsOpen] = useState(false);
    const updateSoft = (key: keyof GenerationConfig['soft'], val: number) =>
        setConfig(c => ({ ...c, soft: { ...c.soft, [key]: val } }));

    return (
        <div>
            <StageHeader icon={<Sliders size={16} />} title="Constraints" desc="Hard rules are always enforced. Tune soft weights to guide optimization." compact={compact} />

            <div className="sg-subhead"><ShieldCheck size={12} /> Institutional Policies</div>
            <button
                type="button"
                className="sg-hard-constraints-btn"
                onClick={() => setPoliciesOpen(!policiesOpen)}
                aria-expanded={policiesOpen}
                style={{ marginBottom: 16 }}
            >
                <span>Configure institutional policies</span>
                {policiesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {policiesOpen && (
                <div className="sg-hard-list-expanded" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <div className="sg-field-label">
                            Overflow Policy
                            <FieldTooltip>Controls how the generator handles sections that exceed room capacity. Fail stops generation, Relax soft reduces constraint weights, Expand scope searches more aggressively, Partial only applies to partial regeneration.</FieldTooltip>
                        </div>
                        <select
                            className="input"
                            value={config.overflowPolicy || 'relax_soft'}
                            onChange={e => setConfig(c => ({ ...c, overflowPolicy: e.target.value as 'fail' | 'relax_soft' | 'expand_scope' | 'partial_only' }))}
                        >
                            <option value="fail">Fail on Overflow</option>
                            <option value="relax_soft">Relax Soft Constraints</option>
                            <option value="expand_scope">Expand Search Scope</option>
                            <option value="partial_only">Partial Only</option>
                        </select>
                    </div>
                </div>
            )}

            <div className="sg-grid-3" style={{ marginTop: 16 }}>
                <div>
                    <div className="sg-field-label">
                        Attempts
                        <FieldTooltip>Number of times the generator will try to place all sessions. Higher values take longer but may find better solutions.</FieldTooltip>
                    </div>
                    <select className="input" value={config.maxAttempts} onChange={e => setConfig(c => ({ ...c, maxAttempts: Number(e.target.value) }))}>
                        {[10, 25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                </div>
            </div>

            <div className="sg-subhead" style={{ marginTop: 20 }}>
                <Lock size={12} /> Hard Constraints
                <FieldTooltip>These rules are always enforced and cannot be violated during schedule generation.</FieldTooltip>
            </div>
            <button
                type="button"
                className="sg-hard-constraints-btn"
                onClick={() => setHardConstraintsOpen(!hardConstraintsOpen)}
                aria-expanded={hardConstraintsOpen}
                style={{ marginBottom: 16 }}
            >
                <span>View {HARD_CONSTRAINTS.length} Hard Constraints</span>
                {hardConstraintsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {hardConstraintsOpen && (
                <ul className="sg-hard-list sg-hard-list-expanded">
                    {HARD_CONSTRAINTS.map(h => (
                        <li key={h}><CheckCircle size={12} /> {h}</li>
                    ))}
                </ul>
            )}

            <div className="sg-subhead" style={{ marginTop: 0 }}>
                <Sliders size={12} /> Soft Constraints
                <FieldTooltip>These are optimization goals that guide the generator. Higher weights prioritize these objectives during placement.</FieldTooltip>
            </div>
            <button
                type="button"
                className="sg-hard-constraints-btn"
                onClick={() => setSoftConstraintsOpen(!softConstraintsOpen)}
                aria-expanded={softConstraintsOpen}
                style={{ marginBottom: 16 }}
            >
                <span>Configure Soft Constraints</span>
                {softConstraintsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {softConstraintsOpen && (
                <div className="sg-sliders sg-hard-list-expanded">
                    <SoftSlider label="Balanced Teacher Load" desc="Spread sessions evenly across teachers." value={config.soft.balancedLoad} onChange={v => updateSoft('balancedLoad', v)} compact={compact} tooltip="Distributes teaching workload evenly across all teachers to prevent overloading any single instructor." />
                    <SoftSlider label="Compact Schedules" desc="Reduce idle gaps inside a day." value={config.soft.compactSchedule} onChange={v => updateSoft('compactSchedule', v)} compact={compact} tooltip="Minimizes gaps between classes to create more compact daily schedules." />
                    <SoftSlider label="Minimize Room Switching" desc="Keep teachers in fewer rooms." value={config.soft.minimizeRoomSwitch} onChange={v => updateSoft('minimizeRoomSwitch', v)} compact={compact} tooltip="Reduces the number of different rooms teachers need to move between during the day." />
                    <SoftSlider label="Teacher Preferred Time" desc="Honor each teacher's preferred days and time window." value={config.soft.teacherPreferredTime} onChange={v => updateSoft('teacherPreferredTime', v)} compact={compact} tooltip="Respects teacher-specified preferred days and time windows when scheduling classes." />
                    <SoftSlider label="Daily Load Balance" desc="Even teaching load per teacher per day." value={config.soft.dailyLoadBalance} onChange={v => updateSoft('dailyLoadBalance', v)} compact={compact} tooltip="Balances teaching hours evenly across the week for each teacher." />
                    <SoftSlider label="Workload Fairness" desc="Respect max hours and max classes per day." value={config.soft.workloadFairness} onChange={v => updateSoft('workloadFairness', v)} compact={compact} tooltip="Ensures teachers don't exceed their maximum allowed hours or daily class limits." />
                    <SoftSlider label="Subject Spacing" desc="Avoid stacking the same subject on one day." value={config.soft.subjectSpacing} onChange={v => updateSoft('subjectSpacing', v)} compact={compact} tooltip="Spreads sessions of the same subject across different days instead of clustering them." />
                    <SoftSlider label="Room Utilization" desc="Reward high utilization of scarce specialty rooms." value={config.soft.roomUtilization} onChange={v => updateSoft('roomUtilization', v)} compact={compact} tooltip="Prioritizes efficient use of scarce specialty rooms like labs and studios." />
                    <SoftSlider label="Special Room Bias" desc="How strongly to reserve labs and studios for subjects that need them." value={config.soft.specialRoomBias} onChange={v => updateSoft('specialRoomBias', v)} compact={compact} tooltip="Controls how strongly to prioritize reserving special rooms for subjects that specifically require them." />
                </div>
            )}
        </div>
    );
};

const SoftSlider: React.FC<{ label: string; desc: string; value: number; onChange: (v: number) => void; compact?: boolean; tooltip?: string }> = ({ label, desc, value, onChange, compact = false, tooltip }) => (
    <div className="sg-slider">
        <div className="sg-slider-head">
            <div>
                <div className="sg-slider-label">
                    {label}
                    {tooltip && <FieldTooltip>{tooltip}</FieldTooltip>}
                </div>
                {!compact && <div className="sg-slider-desc">{desc}</div>}
            </div>
            <div className="sg-slider-val">{value}</div>
        </div>
        <input type="range" min={0} max={100} step={5} value={value} onChange={e => onChange(Number(e.target.value))} />
    </div>
);

// ---------------------------------------------------------------------------
// Stage 4 — Review
// ---------------------------------------------------------------------------

// Helper function to format time based on user preference
const formatTimeDisplay = (time: string, format: '12h' | '24h') => {
    if (format === '24h') return time;
    
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12; // Convert 0 to 12
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${period}`;
};

const ReviewStage: React.FC<{
    config: GenerationConfig;
    blockers: string[];
    counts: { subjects: number; teachers: number; rooms: number; sections: number; existing: number };
    targetLabel: string;
}> = ({ config, blockers, counts, targetLabel }) => {
    const { preferences } = useUserPreferences();
    return (
        <div>
            <StageHeader icon={<ListChecks size={16} />} title="Review inputs" desc="Quick summary before running the engine." />

            <div className="stats-grid" style={{ marginBottom: 16 }}>
                <Stat label="Subjects" value={counts.subjects} />
                <Stat label="Teachers" value={counts.teachers} />
                <Stat label="Rooms" value={counts.rooms} />
                <Stat label="Sections" value={counts.sections} />
            </div>

            <div className="sg-review-grid">
                <ReviewBlock title="Scope"
                    items={config.mode === 'partial'
                        ? [
                            ['Mode', 'Partial regeneration'],
                            ['Target type', config.partialTarget ? PARTIAL_KIND_LABELS[config.partialTarget.kind] : 'Not set'],
                            ['Target', targetLabel || 'Not set'],
                            ['Existing entries', String(counts.existing)],
                        ]
                        : [
                            ['Mode', 'Full generation'],
                            ['Sections', config.sectionIds.length ? `${config.sectionIds.length} selected` : `All (${counts.sections})`],
                            ['Existing entries', String(counts.existing)],
                        ]
                    }
                />
                <ReviewBlock title="Structure"
                    items={[
                        ['Days', compressDayRange(config.days)],
                        ['Hours', `${formatTimeDisplay(config.dayStart, preferences.time_format)} to ${formatTimeDisplay(config.dayEnd, preferences.time_format)}`],
                        ['Session', `${config.sessionMinutes} min`],
                        ['Break Mode', config.breakMode === 'fixed' ? 'Fixed' : 'Variable'],
                        ['Break', config.breakMode === 'fixed' 
                            ? `${config.fixedBreak.label} ${formatTimeDisplay(config.fixedBreak.start, preferences.time_format)} to ${formatTimeDisplay(config.fixedBreak.end, preferences.time_format)}`
                            : `${config.variableBreak.duration}min breaks from ${formatTimeDisplay(config.variableBreak.startTime, preferences.time_format)} to ${formatTimeDisplay(config.variableBreak.endTime, preferences.time_format)} (${config.variableBreak.increments}min increments)`
                        ],
                        ['Common Break', config.commonBreak.enabled 
                            ? `${config.commonBreak.day} at ${formatTimeDisplay(config.commonBreak.time, preferences.time_format)} (${config.commonBreak.duration}min)`
                            : 'Disabled'
                        ],
                    ]}
                />
                <ReviewBlock title="Soft Weights"
                    items={[
                        ['Balanced Load', `${config.soft.balancedLoad}`],
                        ['Compact', `${config.soft.compactSchedule}`],
                        ['Special Room Bias', `${config.soft.specialRoomBias}`],
                        ['Attempts', String(config.maxAttempts)],
                    ]}
                />
                <ReviewBlock title="Priorities"
                    items={[
                        ['High Priority Sections', String(Object.values(config.priorities.sections).filter(v => v >= 70).length)],
                        ['High Priority Subjects', String(Object.values(config.priorities.subjects).filter(v => v >= 70).length)],
                        ['Low Priority Items', String([...Object.values(config.priorities.sections), ...Object.values(config.priorities.subjects)].filter(v => v <= 30).length)],
                    ]}
                />
            </div>

            {blockers.length > 0 && (
                <div className="sg-blockers">
                    <div className="sg-blockers-head"><XCircle size={14} /> Fix these before generating</div>
                    <ul>{blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>
                </div>
            )}
        </div>
    );
};

const ReviewBlock: React.FC<{ title: string; items: [string, string][] }> = ({ title, items }) => (
    <div className="sg-review-block">
        <div className="sg-review-title">{title}</div>
        <dl>
            {items.map(([k, v]) => (
                <div key={k} className="sg-review-row">
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                </div>
            ))}
        </dl>
    </div>
);

// Helper function to compress consecutive days into ranges
const compressDayRange = (days: string[]): string => {
    if (days.length === 0) return 'None';
    if (days.length === 1) return days[0].slice(0, 3);
    
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const shortDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Get indices of the selected days
    const indices = days.map(d => dayOrder.indexOf(d)).sort((a, b) => a - b);
    
    // Group consecutive days into ranges
    const ranges: string[] = [];
    let start = indices[0];
    let end = indices[0];
    
    for (let i = 1; i < indices.length; i++) {
        if (indices[i] === end + 1) {
            end = indices[i];
        } else {
            if (start === end) {
                ranges.push(shortDays[start]);
            } else {
                ranges.push(`${shortDays[start]}-${shortDays[end]}`);
            }
            start = indices[i];
            end = indices[i];
        }
    }
    
    // Add the last range
    if (start === end) {
        ranges.push(shortDays[start]);
    } else {
        ranges.push(`${shortDays[start]}-${shortDays[end]}`);
    }
    
    return ranges.join(', ');
};

const resolveTargetLabel = (
    target: PartialTarget | null,
    lookups: { sections: Section[]; teachers: Teacher[]; rooms: Room[]; subjects: Subject[] },
): string => {
    if (!target?.id) return '';
    if (target.kind === 'section') return lookups.sections.find(s => s.id === target.id)?.name || '';
    if (target.kind === 'teacher') return lookups.teachers.find(t => t.id === target.id)?.full_name || '';
    if (target.kind === 'room')    return lookups.rooms.find(r => r.id === target.id)?.name || '';
    const sub = lookups.subjects.find(s => s.id === target.id);
    return sub ? `${sub.code} ${sub.name}` : '';
};

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
    <div className="stat-card">
        <div className="stat-number">{value}</div>
        <div className="stat-label">{label}</div>
    </div>
);

// ---------------------------------------------------------------------------
// Stage 5 — Generate (progress)
// ---------------------------------------------------------------------------

const SUBSTAGES: { key: GenerationProgress['subStage']; label: string }[] = [
    { key: 'loading', label: 'Loading data' },
    { key: 'ranking', label: 'Ranking subjects' },
    { key: 'placing', label: 'Placing sessions' },
    { key: 'resolving', label: 'Resolving conflicts' },
    { key: 'optimizing', label: 'Optimizing schedule' },
    { key: 'scoring', label: 'Scoring' },
];

const GenerateStage: React.FC<{
    progress: GenerationProgress;
    generating: boolean;
    generationStartTime: number | null;
    onCancel: () => void;
    onRun: () => void;
}> = ({ progress, generating, generationStartTime, onCancel, onRun }) => {
    const pct = progress.totalAttempts && progress.totalAttempts > 0 ? Math.round((progress.attempt / progress.totalAttempts) * 100) : 0;
    const currentIdx = SUBSTAGES.findIndex(s => s.key === progress.subStage);
    const [currentTime, setCurrentTime] = useState(0);
    const attemptSpeedHistoryRef = useRef<number[]>([]);
    const [attemptSpeedHistory, setAttemptSpeedHistory] = useState<number[]>([]);

    // Update current time every second when generating
    useEffect(() => {
        if (!generating) {
            attemptSpeedHistoryRef.current = [];
            // Use setTimeout to avoid synchronous setState
            setTimeout(() => setAttemptSpeedHistory([]), 0);
            return;
        }
        const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
        // Set initial time after a brief delay to avoid synchronous setState
        const timeout = setTimeout(() => setCurrentTime(Date.now()), 0);
        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, [generating]);

    // Calculate speed (attempts per second) and update history
    useEffect(() => {
        if (!generating || !generationStartTime || progress.totalAttempts <= 0) return;

        const elapsed = currentTime - generationStartTime;
        if (elapsed < 1000) return;

        const completedAttempts = progress.attempt;
        if (completedAttempts > 0) {
            const attemptsPerSecond = completedAttempts / (elapsed / 1000);
            attemptSpeedHistoryRef.current = [...attemptSpeedHistoryRef.current, attemptsPerSecond].slice(-10);
            setAttemptSpeedHistory(attemptSpeedHistoryRef.current);
        }
    }, [currentTime, progress, generating, generationStartTime]);

    // Calculate estimated time remaining using average attempt speed
    let estimatedTimeText = '';
    if (generationStartTime && attemptSpeedHistory.length > 0) {
        const avgAttemptsPerSecond = attemptSpeedHistory.reduce((a, b) => a + b, 0) / attemptSpeedHistory.length;
        if (avgAttemptsPerSecond > 0) {
            const remainingAttempts = progress.totalAttempts - progress.attempt;
            const remainingSeconds = remainingAttempts / avgAttemptsPerSecond;

            if (remainingSeconds > 0) {
                if (remainingSeconds < 60) {
                    estimatedTimeText = `~${Math.ceil(remainingSeconds)}s`;
                } else if (remainingSeconds < 3600) {
                    estimatedTimeText = `~${Math.ceil(remainingSeconds / 60)}m`;
                } else {
                    estimatedTimeText = `~${Math.ceil(remainingSeconds / 3600)}h`;
                }
            }
        }
    }
    return (
        <div>
            <StageHeader icon={<Sparkles size={16} />} title="Generate" desc="The engine is running. You can cancel and adjust inputs at any time." />
            <div className="sg-progress-wrap">
                <div className="sg-progress-bar"><div className="sg-progress-fill" style={{ width: `${pct}%` }} /></div>
                <div className="sg-progress-meta">
                    <span>Attempt {progress.attempt} of {progress.totalAttempts || '?'}{estimatedTimeText && ` (${estimatedTimeText})`}</span>
                    <span>{progress.placed} of {progress.total || '?'} placed</span>
                </div>
                <div className="sg-progress-msg">{progress.message}</div>
            </div>

            <ol className="sg-substages">
                {SUBSTAGES.map((s, i) => {
                    const state = currentIdx < 0 ? 'upcoming' : i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'upcoming';
                    return (
                        <li key={s.key} className={`sg-substage sg-substage-${state}`}>
                            <span className="sg-substage-dot" />
                            {s.label}
                        </li>
                    );
                })}
            </ol>

            <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                {generating ? (
                    <button className="btn btn-secondary" onClick={onCancel}><X size={14} /> Cancel</button>
                ) : progress.subStage === 'done' ? (
                    <button className="btn btn-secondary" disabled><Check size={14} /> Results ready</button>
                ) : (
                    <button className="btn btn-primary" onClick={onRun}><RefreshCw size={14} /> Run again</button>
                )}
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Stage 6 — Results
// ---------------------------------------------------------------------------

const ResultsStage: React.FC<{ result: GenerationResult }> = ({ result }) => {
    const perfect = result.placed === result.total && result.errors.length === 0;
    const scoreRounded = result.score.toFixed(2);
    const unplacedCount = result.total - result.placed;
    const noSessionsPlaced = result.placed === 0;

    return (
        <div>
            <StageHeader
                icon={perfect ? <CheckCircle size={16} /> : noSessionsPlaced ? <XCircle size={16} /> : <Layers size={16} />}
                title={perfect ? 'Schedule ready' : noSessionsPlaced ? 'Generation failed' : 'Partial schedule'}
                desc={`${result.placed} of ${result.total} sessions placed. Soft score ${scoreRounded} out of 100.${!perfect && unplacedCount > 0 ? ` ${unplacedCount} session${unplacedCount === 1 ? '' : 's'} could not be placed.` : ''}`}
            />

            {result.highPriorityTotal > 0 && (
                <div className="sg-highlight">
                    <Flag size={13} />
                    <span>High priority placed</span>
                    <strong>{result.highPriorityPlaced} of {result.highPriorityTotal}</strong>
                </div>
            )}

            {result.mode === 'partial' && <DiffView diff={result.diff} />}

            <div className="sg-progress-bar" style={{ marginBottom: 16 }}>
                <div className="sg-progress-fill" style={{ width: `${(result.placed / Math.max(result.total, 1)) * 100}%`, background: perfect ? 'var(--accent-success, #2F8F5B)' : 'var(--accent-warning, #D38B20)' }} />
            </div>

            {!perfect && unplacedCount > 0 && (
                <div className="sg-banner sg-banner-error" style={{ marginBottom: 16 }}>
                    <AlertTriangle size={14} />
                    <span>
                        <strong>{unplacedCount} session{unplacedCount === 1 ? '' : 's'} could not be placed</strong> due to scheduling conflicts or resource constraints. Check the details below for specific issues.
                    </span>
                </div>
            )}

            {result.errors.length > 0 && (
                <details className="sg-errors" open>
                    <summary><XCircle size={13} /> {result.errors.length} unresolved issue{result.errors.length === 1 ? '' : 's'}</summary>
                    <ul>{result.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}</ul>
                    {result.errors.length > 20 && <div className="sg-errors-more">+ {result.errors.length - 20} more</div>}
                </details>
            )}

            {result.entries.length > 0 && (
                <div className="table-container" style={{ maxHeight: 360, overflow: 'auto', marginTop: 12 }}>
                    <table>
                        <thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th><th>Section</th></tr></thead>
                        <tbody>
                            {result.entries.slice().sort((a, b) => {
                                const d = ALL_DAYS.indexOf(a.day) - ALL_DAYS.indexOf(b.day);
                                return d !== 0 ? d : a.start.localeCompare(b.start);
                            }).map(e => (
                                <tr key={`${e.teacherId}-${e.subjectId}-${e.roomId}-${e.sectionId}-${e.day}-${e.start}`}>
                                    <td style={{ fontWeight: 600 }}>{e.day}</td>
                                    <td><Clock size={12} style={{ verticalAlign: 'middle', color: 'var(--text-muted)', marginRight: 4 }} />{e.start} to {e.end}</td>
                                    <td><strong>{e.subjectCode}</strong><br /><span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.subjectName}</span></td>
                                    <td>{e.teacherName}</td>
                                    <td><MapPin size={12} style={{ verticalAlign: 'middle', color: 'var(--text-muted)', marginRight: 4 }} />{e.roomName}</td>
                                    <td>{e.sectionName}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Stage 7 — Outcome
// ---------------------------------------------------------------------------

const OutcomeStage: React.FC<{
    result: GenerationResult;
    teachers: Teacher[];
    rooms: Room[];
    sections: Section[];
}> = ({ result, teachers, rooms, sections }) => {
    const [viewMode, setViewMode] = useState<'section' | 'teacher' | 'room'>('section');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    
    // Local state for editable schedule entries (for drag-and-drop)
    const [localEntries, setLocalEntries] = useState<typeof result.entries>(result.entries);

    // Type helper for ScheduleDragDrop component
    type ScheduleEntry = typeof result.entries[number] & { key: string };

    const dayOrder = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], []);
    const START_HOUR = 7;
    const END_HOUR = 19;
    const SLOT_MINUTES = 30;
    const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;
    const EVENT_COLORS = ['c-navy', 'c-core', 'c-bright', 'c-ice'] as const;

    const timeToMinutes = (t: string) => {
        if (!t) return 0;
        const [h, m] = t.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };

    const slotIndex = useCallback((t: string) => {
        const mins = timeToMinutes(t) - START_HOUR * 60;
        return Math.max(0, Math.min(TOTAL_SLOTS, Math.round(mins / SLOT_MINUTES)));
    }, [START_HOUR, SLOT_MINUTES, TOTAL_SLOTS]);

    const formatTime = (t: string) => {
        if (!t) return '';
        const [h, m] = t.split(':').map(Number);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const colorForKey = (key: string) => {
        let h = 0;
        for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
        return EVENT_COLORS[Math.abs(h) % EVENT_COLORS.length];
    };

    // Format teacher name: last name only, or "Last, F." if duplicate last names
    const formatTeacherName = (teacher: Teacher, allTeachers: Teacher[]) => {
        // Parse name from full_name
        const nameParts = teacher.full_name?.trim().split(' ') || [];
        let lastName = '';
        let firstName = '';

        if (nameParts.length >= 3) {
            // Format: "First Middle Last" or "First Middle Last Suffix"
            // Last name is at index 2 (third word), suffix (if any) is at last index
            lastName = nameParts[2];
            firstName = nameParts[0];
        } else if (nameParts.length === 2) {
            // Format: "First Last"
            lastName = nameParts[1];
            firstName = nameParts[0];
        } else if (nameParts.length === 1) {
            lastName = nameParts[0];
            firstName = '';
        } else {
            lastName = teacher.full_name || '';
            firstName = '';
        }
        
        // Check if any other teacher has the same last name
        const hasDuplicateLastName = allTeachers.some(t => {
            const tLastName = (() => {
                const parts = t.full_name?.trim().split(' ') || [];
                if (parts.length >= 3) return parts[2];
                if (parts.length === 2) return parts[1];
                return parts[0] || t.full_name || '';
            })();
            return t.id !== teacher.id && tLastName === lastName;
        });
        
        if (hasDuplicateLastName && firstName) {
            return `${lastName}, ${firstName.charAt(0)}.`;
        }
        return lastName;
    };

    // Group entries by section, teacher, or room (using localEntries for drag-and-drop)
    const groupedBySection = useMemo(() => {
        const groups: Record<string, typeof localEntries> = {};
        localEntries.forEach(entry => {
            const key = entry.sectionId;
            if (!groups[key]) groups[key] = [];
            groups[key].push(entry);
        });
        return groups;
    }, [localEntries]);

    const groupedByTeacher = useMemo(() => {
        const groups: Record<string, typeof localEntries> = {};
        localEntries.forEach(entry => {
            const key = entry.teacherId;
            if (!groups[key]) groups[key] = [];
            groups[key].push(entry);
        });
        return groups;
    }, [localEntries]);

    const groupedByRoom = useMemo(() => {
        const groups: Record<string, typeof localEntries> = {};
        localEntries.forEach(entry => {
            const key = entry.roomId;
            if (!groups[key]) groups[key] = [];
            groups[key].push(entry);
        });
        return groups;
    }, [localEntries]);

    const selectedEntries = useMemo(() => selectedId
        ? (viewMode === 'section' ? groupedBySection[selectedId]
           : viewMode === 'teacher' ? groupedByTeacher[selectedId]
           : groupedByRoom[selectedId]) || []
        : [], [selectedId, viewMode, groupedBySection, groupedByTeacher, groupedByRoom]);

    // Convert entries to event format for grid display
    const events = useMemo(() => {
        return selectedEntries.map(entry => {
            const dayIdx = dayOrder.indexOf(entry.day);
            const start = slotIndex(entry.start);
            const end = slotIndex(entry.end);
            return { entry, dayIdx, start, span: Math.max(1, end - start) };
        }).filter(e => e.dayIdx >= 0);
    }, [selectedEntries, dayOrder, slotIndex]);

    return (
        <div>
            <StageHeader
                icon={<Layers size={16} />}
                title="Outcome"
                desc="View the generated schedule from different perspectives."
            />

            <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <button
                        className={`btn ${viewMode === 'section' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => { setViewMode('section'); setSelectedId(null); }}
                    >
                        <Users size={14} style={{ marginRight: 8 }} /> Sections
                    </button>
                    <button
                        className={`btn ${viewMode === 'teacher' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => { setViewMode('teacher'); setSelectedId(null); }}
                    >
                        <Users size={14} style={{ marginRight: 8 }} /> Teachers
                    </button>
                    <button
                        className={`btn ${viewMode === 'room' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => { setViewMode('room'); setSelectedId(null); }}
                    >
                        <MapPin size={14} style={{ marginRight: 8 }} /> Rooms
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: 20 }}>
                    {viewMode === 'section' && sections.filter(s => (groupedBySection[s.id]?.length || 0) > 0).map(section => (
                        <button
                            key={section.id}
                            className={`btn ${selectedId === section.id ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setSelectedId(section.id)}
                            style={{ justifyContent: 'flex-start' }}
                        >
                            <Users size={14} style={{ marginRight: 8 }} />
                            {section.name}
                            <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.7 }}>
                                {groupedBySection[section.id]?.length || 0}
                            </span>
                        </button>
                    ))}
                    {viewMode === 'teacher' && teachers.filter(t => (groupedByTeacher[t.id]?.length || 0) > 0).map(teacher => (
                        <button
                            key={teacher.id}
                            className={`btn ${selectedId === teacher.id ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setSelectedId(teacher.id)}
                            style={{ justifyContent: 'flex-start' }}
                        >
                            <Users size={14} style={{ marginRight: 8 }} />
                            {formatTeacherName(teacher, teachers)}
                            <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.7 }}>
                                {groupedByTeacher[teacher.id]?.length || 0}
                            </span>
                        </button>
                    ))}
                    {viewMode === 'room' && rooms.filter(r => (groupedByRoom[r.id]?.length || 0) > 0).map(room => (
                        <button
                            key={room.id}
                            className={`btn ${selectedId === room.id ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setSelectedId(room.id)}
                            style={{ justifyContent: 'flex-start' }}
                        >
                            <MapPin size={14} style={{ marginRight: 8 }} />
                            {room.name}
                            <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.7 }}>
                                {groupedByRoom[room.id]?.length || 0}
                            </span>
                        </button>
                    ))}
                </div>

                {selectedId && events.length > 0 ? (
                    <div style={{ background: 'var(--surface-soft)', borderRadius: 8, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
                            <div>
                                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                                    {viewMode === 'section' ? sections.find(s => s.id === selectedId)?.name
                                     : viewMode === 'teacher' ? formatTeacherName(teachers.find(t => t.id === selectedId)!, teachers)
                                     : rooms.find(r => r.id === selectedId)?.name}
                                </div>
                                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                                    {events.length} {events.length === 1 ? 'session' : 'sessions'} this week
                                </div>
                            </div>
                        </div>

                        <ScheduleDragDrop
                            entries={localEntries.map(e => ({ ...e, key: `${e.subjectId}-${e.sectionId}-${e.day}-${e.start}` }) as ScheduleEntry)}
                            rooms={rooms}
                            teachers={teachers}
                            sections={sections}
                            onUpdate={async (entry, newDay, newStartTime, newEndTime) => {
                                // Update local entries for PlacedEntry
                                const entryKey = entry.key;
                                const updatedEntries = localEntries.map(e => {
                                    const key = `${e.subjectId}-${e.sectionId}-${e.day}-${e.start}`;
                                    if (key === entryKey) {
                                        const updated = { ...e };
                                        if (newDay) updated.day = newDay;
                                        if (newStartTime) updated.start = newStartTime;
                                        if (newEndTime) updated.end = newEndTime;
                                        return updated;
                                    }
                                    return e;
                                });
                                setLocalEntries(updatedEntries);
                            }}
                            dayOrder={dayOrder}
                            START_HOUR={START_HOUR}
                            TOTAL_SLOTS={TOTAL_SLOTS}
                            formatTime={formatTime}
                            colorForKey={colorForKey}
                            viewMode={viewMode}
                            events={events.map(ev => ({ 
                                ...ev, 
                                entry: { 
                                    ...ev.entry, 
                                    key: `${ev.entry.subjectId}-${ev.entry.sectionId}-${ev.entry.day}-${ev.entry.start}` 
                                } 
                            }))}
                        />
                    </div>
                ) : selectedId ? (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                        No entries found for this selection
                    </div>
                ) : (
                    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                        Select a {viewMode} to view their schedule
                    </div>
                )}
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Stage 8 — Save
// ---------------------------------------------------------------------------

const SaveStage: React.FC<{
    result: GenerationResult;
    saving: boolean;
    savedId: string | null;
    saveError: string | null;
    onSave: () => void;
    onSaveAndSubmit: () => void;
    onRegenerate: () => void;
    onReset: () => void;
}> = ({ result, saving, savedId, saveError, onSave, onSaveAndSubmit, onRegenerate, onReset }) => {
    const scoreRounded = result.score.toFixed(2);
    return (
    <div>
        <StageHeader icon={<Save size={16} />} title="Save" desc="Persist this run as a draft, or send it for approval right away." />

        <div className="sg-review-grid">
            <ReviewBlock title="Summary" items={[
                ['Placed', `${result.placed}/${result.total}`],
                ['Unresolved', String(result.errors.length)],
                ['Soft score', `${scoreRounded}/100`],
            ]} />
        </div>

        {savedId && (
            <div className="sg-banner sg-banner-success">
                <CheckCircle size={14} /> Saved. Open the Versions panel or Schedule Management to keep moving it through the workflow.
            </div>
        )}
        {saveError && (
            <div className="sg-banner sg-banner-error">
                <XCircle size={14} /> {saveError}
            </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={onSave} disabled={saving || !!savedId}>
                <Play size={14} /> {saving ? 'Saving…' : savedId ? 'Saved' : 'Save as draft'}
            </button>
            <button className="btn btn-primary" onClick={onSaveAndSubmit} disabled={saving || !!savedId}>
                <Send size={14} /> Save and submit for approval
            </button>
            <button className="btn btn-secondary" onClick={onRegenerate} disabled={saving}>
                <RefreshCw size={14} /> Regenerate
            </button>
            <button className="btn btn-secondary" onClick={onReset} disabled={saving}>
                <ArrowLeft size={14} /> Start over
            </button>
        </div>
    </div>
    );
};

// ---------------------------------------------------------------------------
// Versions panel (Phase 4)
// ---------------------------------------------------------------------------

const STATE_ACTION: Record<WorkflowState, { nextLabel: string; icon: React.ReactNode } | null> = {
    draft:     { nextLabel: 'Submit for approval', icon: <Send size={13} /> },
    submitted: { nextLabel: 'Approve',              icon: <CheckCircle size={13} /> },
    approved:  { nextLabel: 'Publish',              icon: <Upload size={13} /> },
    published: null,
};

const formatRelativeTime = (iso: string | null): string => {
    if (!iso) return 'No entries yet';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return iso;
    const diff = Date.now() - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} d ago`;
    return new Date(iso).toLocaleDateString();
};

const VersionsPanel: React.FC<{
    summary: VersionSummary[];
    busy: WorkflowState | null;
    note: string | null;
    error: string | null;
    canApprove: boolean;
    onSubmitDrafts: () => void;
    onApproveSubmitted: () => void;
    onPublishApproved: () => void;
    onDismissNote: () => void;
}> = ({ summary, busy, note, error, canApprove, onSubmitDrafts, onApproveSubmitted, onPublishApproved, onDismissNote }) => {
    const actionFor = (state: WorkflowState) => {
        if (state === 'draft')     return onSubmitDrafts;
        if (state === 'submitted') return canApprove ? onApproveSubmitted : undefined;
        if (state === 'approved')  return canApprove ? onPublishApproved  : undefined;
        return undefined;
    };
    const lockedReason = (state: WorkflowState) =>
        (state === 'submitted' || state === 'approved') && !canApprove
            ? 'Only a Schedule Administrator can move this forward.'
            : null;
    return (
        <div className="sg-versions">
            <div className="sg-versions-head">
                <FileClock size={14} />
                <span>Workflow versions</span>
                <span className="sg-versions-hint">Move a group forward when it is ready.</span>
            </div>
            <div className="sg-versions-grid">
                {summary.map(v => {
                    const action = STATE_ACTION[v.state];
                    const onClick = actionFor(v.state);
                    return (
                        <div key={v.state} className={`sg-version-card sg-version-${v.state}`}>
                            <div className="sg-version-label">
                                {v.state === 'published' ? <Upload size={13} /> :
                                 v.state === 'approved'  ? <CheckCircle size={13} /> :
                                 v.state === 'submitted' ? <Inbox size={13} /> : <Save size={13} />}
                                {v.label}
                            </div>
                            <div className="sg-version-count">{v.count}</div>
                            <div className="sg-version-desc">{v.desc}</div>
                            <div className="sg-version-meta">{formatRelativeTime(v.latest)}</div>
                            {action && onClick ? (
                                <button
                                    className="btn btn-secondary sg-version-action"
                                    onClick={onClick}
                                    disabled={v.count === 0 || busy === v.state}
                                >
                                    {action.icon} {busy === v.state ? 'Working…' : action.nextLabel}
                                </button>
                            ) : lockedReason(v.state) && v.count > 0 ? (
                                <div className="sg-version-locked">{lockedReason(v.state)}</div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
            {note && (
                <div className="sg-banner sg-banner-success" style={{ marginTop: 12, justifyContent: 'space-between' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle size={14} /> {note}
                    </span>
                    <button className="sg-icon-btn" onClick={onDismissNote} aria-label="Dismiss"><X size={12} /></button>
                </div>
            )}
            {error && (
                <div className="sg-banner sg-banner-error" style={{ marginTop: 12, justifyContent: 'space-between' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <XCircle size={14} /> {error}
                    </span>
                    <button className="sg-icon-btn" onClick={onDismissNote} aria-label="Dismiss"><X size={12} /></button>
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Diff view (partial mode only)
// ---------------------------------------------------------------------------

const STATUS_META: Record<DiffEntry['status'], { label: string; icon: React.ReactNode }> = {
    changed:   { label: 'Moved',     icon: <RefreshCw size={12} /> },
    added:     { label: 'Added',     icon: <Plus size={12} /> },
    removed:   { label: 'Removed',   icon: <X size={12} /> },
    unchanged: { label: 'Unchanged', icon: <CheckCircle size={12} /> },
};

const DiffView: React.FC<{ diff: DiffEntry[] }> = ({ diff }) => {
    const counts = diff.reduce((acc, d) => { acc[d.status] = (acc[d.status] || 0) + 1; return acc; }, {} as Record<string, number>);
    if (diff.length === 0) {
        return <div className="sg-diff-empty">No prior sessions to compare. Everything in this slice is new.</div>;
    }
    return (
        <div className="sg-diff">
            <div className="sg-diff-head">
                <GitBranch size={13} />
                <span>Changes vs current schedule</span>
                <div className="sg-diff-counts">
                    {(['changed', 'added', 'removed', 'unchanged'] as const).map(s => counts[s] ? (
                        <span key={s} className={`sg-diff-chip sg-diff-${s}`}>
                            {STATUS_META[s].icon} {STATUS_META[s].label} {counts[s]}
                        </span>
                    ) : null)}
                </div>
            </div>
            <ul className="sg-diff-list">
                {diff.map(d => <DiffRow key={d.key} entry={d} />)}
            </ul>
        </div>
    );
};

const placementLine = (p: PlacedEntry) =>
    `${p.day.slice(0, 3)} ${p.start} to ${p.end} · ${p.roomName} · ${p.teacherName}`;

const DiffRow: React.FC<{ entry: DiffEntry }> = ({ entry }) => {
    const meta = STATUS_META[entry.status];
    const label = entry.after || entry.before;
    return (
        <li className={`sg-diff-row sg-diff-${entry.status}`}>
            <span className={`sg-diff-tag sg-diff-${entry.status}`}>{meta.icon} {meta.label}</span>
            <div className="sg-diff-body">
                <div className="sg-diff-title">
                    <strong>{label?.subjectCode || 'Session'}</strong>
                    <span className="sg-diff-sub">{label?.sectionName}</span>
                </div>
                {entry.status === 'changed' && entry.before && entry.after ? (
                    <div className="sg-diff-delta">
                        <span className="sg-diff-before">{placementLine(entry.before)}</span>
                        <ArrowRight size={11} />
                        <span className="sg-diff-after">{placementLine(entry.after)}</span>
                    </div>
                ) : (
                    <div className="sg-diff-delta">
                        <span>{placementLine(label!)}</span>
                    </div>
                )}
            </div>
        </li>
    );
};

const StageHeader: React.FC<{ icon: React.ReactNode; title: string; desc: string; compact?: boolean; titleIcon?: React.ReactNode }> = ({ icon, title, desc, compact = false, titleIcon }) => (
    <div className="sg-stage-head">
        <div className="sg-stage-icon">{icon}</div>
        <div>
            <div className="sg-stage-title">
                {title}
                {titleIcon && <span style={{ marginLeft: 6, display: 'inline-flex', verticalAlign: 'middle' }}>{titleIcon}</span>}
            </div>
            {!compact && <div className="sg-stage-desc">{desc}</div>}
        </div>
    </div>
);

// ---------------------------------------------------------------------------
// Stage 4 - Priorities
// ---------------------------------------------------------------------------

type PriorityKind = 'sections' | 'subjects';

interface PriorityItem {
    id: string;
    label: string;
    sub: string;
    groupKey: string;
}

const PrioritiesStage: React.FC<{
    config: GenerationConfig;
    setConfig: React.Dispatch<React.SetStateAction<GenerationConfig>>;
    sections: Section[];
    subjects: Subject[];
    compact?: boolean;
}> = ({ config, setConfig, sections, subjects, compact = false }) => {
    const [kind, setKind] = useState<PriorityKind>('sections');
    const [search, setSearch] = useState('');

    const items: PriorityItem[] = useMemo(() => {
        if (kind === 'sections') {
            return sections.map(s => ({
                id: s.id,
                label: s.name,
                sub: [s.program, s.year_level ? `Year ${s.year_level}` : null].filter(Boolean).join(' · ') || 'Section',
                groupKey: `${s.program || 'Unassigned'} · Year ${s.year_level ?? '?'}`,
            }));
        }
        return subjects.map(s => ({
            id: s.id,
            label: s.code,
            sub: s.name,
            groupKey: `${s.program || 'Unassigned'} · Year ${s.year_level ?? '?'}`,
        }));
    }, [kind, sections, subjects]);

    const grouped = useMemo(() => {
        const q = search.trim().toLowerCase();
        const filtered = q
            ? items.filter(it => it.label.toLowerCase().includes(q) || it.sub.toLowerCase().includes(q))
            : items;
        const m = new Map<string, PriorityItem[]>();
        for (const it of filtered) {
            const arr = m.get(it.groupKey) || [];
            arr.push(it);
            m.set(it.groupKey, arr);
        }
        return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [items, search]);

    const map = kind === 'sections' ? config.priorities.sections : config.priorities.subjects;
    const setMap = (next: Record<string, number>) => setConfig(c => ({
        ...c,
        priorities: { ...c.priorities, [kind]: next },
    }));

    const setOne = (id: string, tier: PriorityTier) => {
        const next = { ...map, [id]: PRIORITY_VALUES[tier] };
        setMap(next);
    };
    const setMany = (ids: string[], tier: PriorityTier) => {
        const next = { ...map };
        for (const id of ids) next[id] = PRIORITY_VALUES[tier];
        setMap(next);
    };
    const resetAll = () => setMap({});

    // Sections: top quartile by student count lands on High, bottom quartile on Low.
    // Also considers load_category for smarter defaults.
    // Subjects: lab subjects and subjects with scarce teachers land on High, electives on Low.
    const smartSuggest = () => {
        // Configure sections priorities
        const sized = sections.filter(s => s.student_count != null) as { id: string; student_count: number | null }[];
        const sectionPriorities: Record<string, number> = {};
        if (sized.length > 0) {
            const counts = sized.map(s => s.student_count || 0).sort((a, b) => a - b);
            const qHigh = counts[Math.floor(counts.length * 0.75)] ?? counts[counts.length - 1];
            const qLow  = counts[Math.floor(counts.length * 0.25)] ?? counts[0];
            const hasVariance = counts[0] !== counts[counts.length - 1]; // Check if there's actual variance
            for (const s of sections) {
                const n = s.student_count ?? -1;
                // Only use quartile logic if there's actual variance in student counts
                if (s.load_category === 'heavy' || (hasVariance && n >= qHigh && n > 0)) {
                    sectionPriorities[s.id] = PRIORITY_VALUES.high;
                } else if (s.load_category === 'light' || (hasVariance && n > 0 && n <= qLow)) {
                    sectionPriorities[s.id] = PRIORITY_VALUES.low;
                }
            }
        }

        // Configure subjects priorities
        const subjectPriorities: Record<string, number> = {};

        // First, check if all subjects have the same teacher pool size (e.g., all 0)
        const teacherPools = subjects.map(s => {
            const pool = (s.teacher_eligibility_pool && typeof s.teacher_eligibility_pool === 'object')
                ? Object.keys(s.teacher_eligibility_pool as Record<string, unknown>).length
                : 0;
            return pool;
        });
        const hasTeacherVariance = new Set(teacherPools).size > 1;

        for (const s of subjects) {
            const teacherPool = (s.teacher_eligibility_pool && typeof s.teacher_eligibility_pool === 'object')
                ? Object.keys(s.teacher_eligibility_pool as Record<string, unknown>).length
                : 0;
            // Only consider teachers scarce if there's variance in teacher pools
            const scarceTeachers = hasTeacherVariance && (teacherPool <= 2 || (s.teacher_id ? false : teacherPool === 0));
            const needsLab = s.requires_lab;

            if (needsLab || scarceTeachers) {
                subjectPriorities[s.id] = PRIORITY_VALUES.high;
            } else if (!s.program) {
                subjectPriorities[s.id] = PRIORITY_VALUES.low;
            }
        }

        // Update both sections and subjects priorities simultaneously
        setConfig(c => ({
            ...c,
            priorities: {
                ...c.priorities,
                sections: sectionPriorities,
                subjects: subjectPriorities,
            },
        }));
    };

    const cycleTier = (id: string) => {
        const current = tierFromValue(map[id] ?? 50);
        const order: PriorityTier[] = ['normal', 'high', 'low'];
        const idx = order.indexOf(current);
        setOne(id, order[(idx + 1) % order.length]);
    };

    const touched = Object.keys(map).length;

    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                <StageHeader
                    icon={<Flag size={16} />}
                    title="Priorities"
                    desc="Flag what matters most. The engine places high priority items first and protects their slots."
                    compact={compact}
                    titleIcon={
                        <div className="sg-prio-tooltip-wrapper">
                            <HelpCircle size={16} style={{ color: 'var(--text-muted)', cursor: 'help' }} />
                            <div className="sg-prio-tooltip">
                                {PRIORITY_TIERS.map(t => (
                                    <div key={t.key} className={`sg-prio-tooltip-item sg-prio-tooltip-${t.key}`}>
                                        <strong>{t.label}:</strong> {t.desc}
                                    </div>
                                ))}
                            </div>
                        </div>
                    }
                />
            </div>

            <div className="sg-prio-toolbar">
                <div className="sg-tabs-mini">
                    <button className={`sg-tab-mini ${kind === 'sections' ? 'sg-tab-mini-active' : ''}`} onClick={() => setKind('sections')}>
                        Sections <span className="sg-tab-mini-count">{sections.length}</span>
                    </button>
                    <button className={`sg-tab-mini ${kind === 'subjects' ? 'sg-tab-mini-active' : ''}`} onClick={() => setKind('subjects')}>
                        Subjects <span className="sg-tab-mini-count">{subjects.length}</span>
                    </button>
                </div>
                <div className="sg-prio-search">
                    <SearchIcon size={14} />
                    <input
                        className="input"
                        placeholder={`Search ${kind}`}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <button
                    className="sg-icon-btn sg-reset-btn"
                    onClick={smartSuggest}
                    title="Auto-configure priorities for both sections and subjects"
                >
                    <Lightbulb size={13} /> Smart Suggest
                </button>
                <button className="sg-icon-btn sg-reset-btn" onClick={resetAll} disabled={touched === 0} title="Reset to normal">
                    <RotateCcw size={13} /> Reset
                </button>
            </div>

            {grouped.length === 0 ? (
                <div className="sg-empty">Nothing matches your search.</div>
            ) : (
                <div className="sg-scroll sg-prio-scroll">
                    {grouped.map(([groupKey, list]) => (
                        <PriorityGroup
                            key={groupKey}
                            title={groupKey}
                            items={list}
                            map={map}
                            onCycle={cycleTier}
                            onSetAll={tier => setMany(list.map(i => i.id), tier)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const PriorityGroup: React.FC<{
    title: string;
    items: PriorityItem[];
    map: Record<string, number>;
    onCycle: (id: string) => void;
    onSetAll: (tier: PriorityTier) => void;
}> = ({ title, items, map, onCycle, onSetAll }) => {
    const tiers = items.map(i => tierFromValue(map[i.id] ?? 50));
    const allSame = tiers.every(t => t === tiers[0]) ? tiers[0] : null;
    
    // Calculate distribution for border color
    const highCount = tiers.filter(t => t === 'high').length;
    const normalCount = tiers.filter(t => t === 'normal').length;
    const lowCount = tiers.filter(t => t === 'low').length;
    
    let borderClass = '';
    if (allSame === 'high') borderClass = 'sg-prio-group-high';
    else if (allSame === 'low') borderClass = 'sg-prio-group-low';
    else if (allSame === 'normal') borderClass = 'sg-prio-group-normal';
    else if (highCount > normalCount && highCount > lowCount) borderClass = 'sg-prio-group-mixed-high';
    else if (lowCount > normalCount && lowCount > highCount) borderClass = 'sg-prio-group-mixed-low';
    
    return (
        <div className={`sg-prio-group ${borderClass}`}>
            <div className="sg-prio-group-head">
                <span className="sg-prio-group-title">{title}</span>
                <span className="sg-prio-group-count">{items.length}</span>
                <div className="sg-prio-group-actions">
                    <span className="sg-prio-group-hint">Set all</span>
                    {PRIORITY_TIERS.map(t => (
                        <button
                            key={t.key}
                            className={`sg-prio-mini sg-prio-${t.key} ${allSame === t.key ? 'sg-prio-mini-active' : ''}`}
                            onClick={() => onSetAll(t.key)}
                            title={t.desc}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>
            <ul className="sg-prio-list">
                {items.map(it => {
                    const tier = tierFromValue(map[it.id] ?? 50);
                    return (
                        <li key={it.id}>
                            <button className="sg-prio-row" onClick={() => onCycle(it.id)} title="Click to cycle priority">
                                <span className="sg-prio-row-main">
                                    <span className="sg-prio-row-label">{it.label}</span>
                                    <span className="sg-prio-row-sub">{it.sub}</span>
                                </span>
                                <span className={`sg-prio-pill sg-prio-${tier}`}>{tier}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default ScheduleGenerate;
