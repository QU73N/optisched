import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useUserPreferences } from '../../../contexts/UserPreferencesContext';
import { POWER_ADMIN_ROLES, hasAnyRole } from '../../../types/database';
import {
    AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle, ChevronDown, ChevronUp, Clock, FileClock,
    Flag, GitBranch, Inbox, Layers, Lightbulb, ListChecks, Lock, Loader2, MapPin, Play, Plus,
    RefreshCw, RotateCcw, Save, Search as SearchIcon, Send, ShieldCheck, Sliders, Sparkles, Upload,
    Users, X, XCircle, Zap,
} from 'lucide-react';
import '../Dashboard.css';
import {
    ALL_DAYS, DEFAULT_CONFIG, HARD_CONSTRAINTS, MODE_LABELS, PARTIAL_KIND_LABELS, PRIORITY_TIERS,
    PRIORITY_VALUES, STAGES, WORKFLOW_META, tierFromValue, type GenerationMode,
    type BreakWindow, type DiffEntry, type ExistingSchedule, type GenerationConfig,
    type GenerationProgress, type GenerationResult, type PartialKind, type PartialTarget,
    type PlacedEntry, type PriorityTier, type Room, type Section, type StageKey,
    type Subject, type Teacher, type VersionSummary, type WorkflowState,
} from './types';
import { runGenerator, optimizeSchedule } from './generator';
import { getRulesAsRecord, notifyStudentsOfScheduleChanges } from '../../../services/generationService';
import { scheduleStateManager } from '../../../services/scheduleStateManager';
import { scheduleLogger } from '../../../services/scheduleLogger';
import { scheduleVersionService } from '../../../services/scheduleVersionService';
import { scheduleAudit } from '../../../services/auditService';
import { PublishOverwriteConfirm } from '../../../components/PublishOverwriteConfirm';

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

const ScheduleGenerate: React.FC = () => {
    const { roles, user } = useAuth();
    const { preferences, updatePreferences } = useUserPreferences();
    const canApprove = hasAnyRole(roles, [...POWER_ADMIN_ROLES, 'schedule_admin']);
    const [stage, setStage] = useState<StageKey>('scope');
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
    
    // Optimization state
    const [optimizing, setOptimizing] = useState(false);
    const [optimizationReport, setOptimizationReport] = useState<any>(null);
    const [optimizedResult, setOptimizedResult] = useState<GenerationResult | null>(null);
    const [optimizationError, setOptimizationError] = useState<string | null>(null);

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
                
                const [sub, t, r, sec, sch, prefs, prof] = await Promise.all([
                    supabase.from('subjects').select('id, name, code, duration_hours, requires_lab, program, year_level, teacher_id, sessions_per_week, weight, priority_note'),
                    supabase.from('teachers').select('id, max_hours, weight, priority_note, profile_id'),
                    supabase.from('rooms').select('id, name, capacity, type, building, floor, is_available, weight, priority_note'),
                    supabase.from('sections').select('id, name, program, year_level, student_count, parent_id, weight, path, node_type, is_active, description, metadata, sort_order, load_category, special_scheduling_rules'),
                    supabase.from('schedules').select('id, subject_id, teacher_id, room_id, section_id, day_of_week, start_time, end_time, status, created_at'),
                    supabase.from('teacher_preferences').select('teacher_id, preferred_days, preferred_time_start, preferred_time_end, max_classes_per_day, max_consecutive_classes, availability'),
                    supabase.from('profiles').select('id, full_name'),
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

            setSubjects((sub.data as unknown as Subject[]) || []);
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
    }, []);

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
        const ids = existing.filter(e => ((e.status as WorkflowState) || 'draft') === from).map(e => e.id);
        if (ids.length === 0) return;
        setWorkflowBusy(from);
        setWorkflowNote(null);
        setWorkflowError(null);
        try {
            const { error } = await supabase.from('schedules').update({ status: to }).in('id', ids);
            if (error) throw error;
            
            // Log audit for each schedule status change
            for (const id of ids) {
                if (to === 'submitted') {
                    await scheduleAudit.submitted(id, { submitted_by: user?.id });
                } else if (to === 'published') {
                    await scheduleAudit.published(id, { published_by: user?.id });
                } else if (to === 'approved') {
                    await scheduleAudit.approved(id, { approved_by: user?.id });
                } else if (to === 'rejected' as any) {
                    await scheduleAudit.rejected(id, { rejected_by: user?.id });
                }
            }
            
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
        if (next && canAdvance(stage)) setStage(next.key);
    };
    const goBack = () => {
        const prev = STAGES[stageIndex - 1];
        if (prev && !generating) setStage(prev.key);
    };
    const jumpTo = (key: StageKey) => {
        if (generating) return;
        const targetIdx = STAGES.findIndex(s => s.key === key);
        if (targetIdx <= stageIndex) setStage(key);
    };

    const startGeneration = async () => {
        setGenerating(true);
        setResult(null);
        setSavedId(null);
        setSaveError(null);
        setOptimizedResult(null);
        setOptimizationReport(null);
        setOptimizationError(null);
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

    const runOptimization = async () => {
        if (!result) return;
        
        setOptimizing(true);
        setOptimizationReport(null);
        setOptimizedResult(null);
        setOptimizationError(null);
        
        try {
            // Build maps for optimization
            const teachersMap = new Map(teachers.map(t => [t.id, t]));
            const roomsMap = new Map(rooms.map(r => [r.id, r]));
            
            // Build proper ClassifiedConstraints structure
            // Note: optimizer only uses hard constraints, soft is converted internally
            const classifiedConstraints = {
                hard: {
                    no_teacher_overlap: true,
                    no_room_overlap: true,
                    no_section_overlap: true,
                    room_capacity_compliance: true,
                    teacher_qualification_enforcement: true,
                    teacher_availability_enforcement: true,
                    max_consecutive_hours: 4,
                    max_daily_load: 6,
                    subject_hour_completion: false,
                    special_subject_room_priority: false,
                    break_enforcement: config.breaks.length > 0,
                    schedule_lock_protection: false,
                },
                soft: {
                    balanced_weekly_load: config.soft.balancedLoad > 0,
                    reduced_idle_gaps: config.soft.compactSchedule > 0,
                    compact_section_schedules: config.soft.compactSchedule > 0,
                    room_movement_minimization: config.soft.minimizeRoomSwitch > 0,
                    time_of_day_preference: config.soft.teacherPreferredTime > 0,
                    room_utilization_efficiency: config.soft.roomUtilization > 0,
                    schedule_compactness: config.soft.compactSchedule > 0,
                    fairness_between_teachers: config.soft.workloadFairness > 0,
                    priority_weighting: config.soft.dailyLoadBalance > 0,
                },
                preferences: {
                    preferred_rooms: {},
                    preferred_time_windows: {},
                    preferred_days: {},
                    preferred_sequencing: {},
                    preferred_special_room_use: false,
                },
            };
            
            // Run optimization (synchronous function)
            const optimizedEntries = optimizeSchedule(
                result.entries,
                teachersMap,
                roomsMap,
                sections,
                config,
                classifiedConstraints,
                result.score,
                (p) => setProgress(p),
            );
            
            setOptimizedResult({
                ...result,
                entries: optimizedEntries.entries,
                score: optimizedEntries.score,
            });
            
            setOptimizationReport({
                initialScore: result.score,
                finalScore: optimizedEntries.score,
                improvement: optimizedEntries.score - result.score,
            });
            
        } catch (error) {
            console.error('Optimization failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during optimization';
            setOptimizationError(errorMessage);
        } finally {
            setOptimizing(false);
        }
    };

    const saveAs = async (initialState: 'draft' | 'submitted') => {
        if (!result) return;
        
        // If submitting, check for existing active schedule
        if (initialState === 'submitted') {
            const summary = await scheduleVersionService.getActiveScheduleSummary();
            setCurrentScheduleSummary(summary);
            
            if (summary && summary.exists) {
                // Show overwrite confirmation modal
                setShowOverwriteConfirm(true);
                return;
            }
        }
        
        // Proceed with save
        await performSave(initialState);
    };

    const performSave = async (initialState: 'draft' | 'submitted') => {
        if (!result) return;
        setSaving(true); setSaveError(null);
        try {
            if (config.mode === 'partial') {
                const t = config.partialTarget;
                if (!t?.id) throw new Error('No partial regeneration target selected.');
                const column =
                    t.kind === 'section' ? 'section_id' :
                    t.kind === 'teacher' ? 'teacher_id' :
                    t.kind === 'room'    ? 'room_id' : 'subject_id';
                // Only replace unpublished rows in the slice so live schedules survive.
                const { error: delErr } = await supabase
                    .from('schedules')
                    .delete()
                    .eq(column, t.id)
                    .in('status', ['draft', 'submitted', 'approved']);
                if (delErr) throw delErr;
            } else if (config.clearExisting) {
                // Delete existing schedules for the scope
                const scope = config.sectionIds;
                const q = supabase.from('schedules').delete();
                const { error: delErr } = scope.length
                    ? await q.in('section_id', scope)
                    : await q.neq('id', '00000000-0000-0000-0000-000000000000');
                if (delErr) throw delErr;
                
                // Also delete non-published generation_runs for the same scope
                // This prevents accumulation of old generation runs
                const { error: genDelErr } = await supabase
                    .from('generation_runs')
                    .delete()
                    .in('status', ['running', 'failed'])
                    .neq('id', '00000000-0000-0000-0000-000000000000');
                if (genDelErr) throw genDelErr;
            }
            
            // Insert new schedule entries
            const inserts = result.entries.map(e => ({
                subject_id: e.subjectId, teacher_id: e.teacherId, room_id: e.roomId,
                section_id: e.sectionId, day_of_week: e.day, start_time: e.start, end_time: e.end,
                status: initialState,
            }));
            const { error, data } = await supabase.from('schedules').insert(inserts).select('id');
            if (error) throw error;
            setSavedId(data && data[0] ? data[0].id : 'ok');
            
            // Log audit for each created schedule
            for (const scheduleId of (data || []).map((d: { id: string }) => d.id)) {
                await scheduleAudit.created(scheduleId, { 
                    section: result.entries[0]?.sectionId,
                    teacher: result.entries[0]?.teacherId,
                    subject: result.entries[0]?.subjectId,
                });
            }
            
            await refreshExisting();

            // Update canonical state manager with the saved schedules
            const { data: savedSchedules } = await supabase
                .from('schedules')
                .select('*')
                .in('status', ['published', 'draft']);
            
            if (savedSchedules) {
                const version = await scheduleStateManager.updateState(
                    savedSchedules,
                    'generate',
                    {
                        conflictCount: 0, // Will be updated by Conflicts tab scan
                        softScore: result.score,
                        changeDescription: `Generated schedule with ${result.placed} sessions`,
                    }
                );
                scheduleLogger.generate.schedulePersisted(version.version, data && data[0] ? data[0].id : 'ok');
                scheduleLogger.generate.stateUpdated(version.version, version.hash);
                scheduleLogger.generate.scheduleCreated(version.version, version.hash, `Saved as ${initialState}`);
            }

            // Notify students of schedule changes
            const affectedSectionIds = Array.from(new Set(result.entries.map(e => e.sectionId)));
            await notifyStudentsOfScheduleChanges(affectedSectionIds, initialState, false);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setSaveError(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleOverwriteConfirm = async () => {
        if (!result) return;
        
        setShowOverwriteConfirm(false);
        
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
        setOptimizedResult(null);
        setOptimizationReport(null);
        setOptimizationError(null);
        setOptimizing(false);
        setStage('scope');
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

            <Stepper stage={stage} onJump={jumpTo} canJump={!generating} />

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
                            onOptimize={() => setStage('optimize')}
                            onSave={() => setStage('save')}
                        />
                    )}
                    {stage === 'optimize' && result && (
                        <OptimizeStage
                            result={result}
                            optimizing={optimizing}
                            optimizationReport={optimizationReport}
                            optimizedResult={optimizedResult}
                            optimizationError={optimizationError}
                            onOptimize={runOptimization}
                            onUseOptimized={() => {
                                if (optimizedResult) {
                                    setResult(optimizedResult);
                                    setOptimizedResult(null);
                                    setOptimizationReport(null);
                                }
                            }}
                            onDiscard={() => {
                                setOptimizedResult(null);
                                setOptimizationReport(null);
                                setOptimizationError(null);
                                setStage('results');
                            }}
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
                        <button className="btn btn-primary" onClick={() => setStage('optimize')} disabled={!result || result.entries.length === 0}>
                            Optimize Schedule <ArrowRight size={14} />
                        </button>
                    ) : stage === 'optimize' ? (
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

const Stepper: React.FC<{ stage: StageKey; onJump: (k: StageKey) => void; canJump: boolean }> = ({ stage, onJump, canJump }) => {
    const idx = STAGES.findIndex(s => s.key === stage);
    const onKey = (e: React.KeyboardEvent, i: number) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
        e.preventDefault();
        let next = i;
        if (e.key === 'ArrowLeft')  next = Math.max(0, i - 1);
        if (e.key === 'ArrowRight') next = Math.min(idx, i + 1);
        if (e.key === 'Home')       next = 0;
        if (e.key === 'End')        next = idx;
        const el = document.querySelector<HTMLButtonElement>(`[data-sg-step="${STAGES[next].key}"]`);
        el?.focus();
    };
    return (
        <ol className="sg-stepper" role="tablist" aria-label="Generation stages">
            {STAGES.map((s, i) => {
                const state = i < idx ? 'done' : i === idx ? 'current' : 'upcoming';
                return (
                    <li key={s.key} className={`sg-step sg-step-${state}`}>
                        <button
                            type="button"
                            role="tab"
                            data-sg-step={s.key}
                            className="sg-step-btn"
                            onClick={() => onJump(s.key)}
                            onKeyDown={e => onKey(e, i)}
                            disabled={!canJump || i > idx}
                            aria-current={i === idx ? 'step' : undefined}
                            aria-selected={i === idx}
                            aria-label={`${i + 1} of ${STAGES.length}: ${s.label}. ${s.hint}.`}
                            tabIndex={i === idx ? 0 : -1}
                        >
                            <span className="sg-step-num" aria-hidden="true">{i < idx ? <CheckCircle size={14} /> : i + 1}</span>
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
            case 'draft':
                // Draft mode: flexible to explore options
                return {
                    overflowPolicy: 'relax_soft' as const,
                    maxCapacity: 100,
                    overflowPercent: 20,
                };
            case 'locked':
                // Locked mode: strict to avoid conflicts with locked items
                return {
                    overflowPolicy: 'relax_soft' as const,
                    maxCapacity: 100,
                    overflowPercent: 5,
                };
            case 'whatif':
                // What-if: flexible to explore different configurations
                return {
                    overflowPolicy: 'expand_scope' as const,
                    maxCapacity: 100,
                    overflowPercent: 25,
                };
            case 'emergency':
                // Emergency: very flexible to get a working schedule quickly
                return {
                    overflowPolicy: 'expand_scope' as const,
                    maxCapacity: 100,
                    overflowPercent: 50,
                };
            case 'multiscenario':
                // Multi-scenario: balanced approach for valid comparisons
                return {
                    overflowPolicy: 'relax_soft' as const,
                    maxCapacity: 100,
                    overflowPercent: 15,
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
                {(Object.keys(MODE_LABELS) as GenerationMode[]).map(mode => (
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
                                {mode === 'draft' && <FileClock size={16} />}
                                {mode === 'locked' && <Lock size={16} />}
                                {mode === 'whatif' && <Lightbulb size={16} />}
                                {mode === 'emergency' && <RefreshCw size={16} />}
                                {mode === 'multiscenario' && <Layers size={16} />}
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
                        <label className="sg-inline-check" style={{ marginLeft: 'auto' }}>
                            <input type="checkbox" checked={config.clearExisting} onChange={e => setConfig(c => ({ ...c, clearExisting: e.target.checked }))} />
                            Clear existing schedules in scope before saving
                        </label>
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

// ---------------------------------------------------------------------------
// Stage 2 — Structure
// ---------------------------------------------------------------------------

const StructureStage: React.FC<{ config: GenerationConfig; setConfig: React.Dispatch<React.SetStateAction<GenerationConfig>>; compact?: boolean }> = ({ config, setConfig, compact = false }) => {
    const toggleDay = (d: string) => setConfig(c => ({
        ...c,
        days: c.days.includes(d) ? c.days.filter(x => x !== d) : [...c.days, d],
    }));
    const addBreak = () => setConfig(c => ({
        ...c,
        breaks: [...c.breaks, { id: `brk-${Date.now()}`, label: 'Break', start: '10:00', end: '10:15' }],
    }));
    const updateBreak = (id: string, patch: Partial<BreakWindow>) => setConfig(c => ({
        ...c,
        breaks: c.breaks.map(b => b.id === id ? { ...b, ...patch } : b),
    }));
    const removeBreak = (id: string) => setConfig(c => ({ ...c, breaks: c.breaks.filter(b => b.id !== id) }));

    const formatDuration = (start: string, end: string) => {
        const startMins = toMinutes(start);
        const endMins = toMinutes(end);
        const diff = endMins - startMins;
        if (diff <= 0) return '';
        const hours = Math.floor(diff / 60);
        const mins = diff % 60;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    return (
        <div>
            <StageHeader icon={<Clock size={16} />} title="Structure" desc="Define the working week, session length, and any shared breaks." compact={compact} />

            <div className="sg-fields">
                <div>
                    <div className="sg-field-label">Working days</div>
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
                        <div className="sg-field-label">Day starts</div>
                        <input type="time" className="input" value={config.dayStart} onChange={e => setConfig(c => ({ ...c, dayStart: e.target.value }))} />
                    </div>
                    <div>
                        <div className="sg-field-label">Day ends</div>
                        <input type="time" className="input" value={config.dayEnd} onChange={e => setConfig(c => ({ ...c, dayEnd: e.target.value }))} />
                    </div>
                    <div>
                        <div className="sg-field-label">Session length</div>
                        <select className="input" value={config.sessionMinutes} onChange={e => setConfig(c => ({ ...c, sessionMinutes: Number(e.target.value) }))}>
                            <option value={60}>60 minutes</option>
                            <option value={90}>90 minutes</option>
                            <option value={120}>120 minutes</option>
                        </select>
                    </div>
                </div>

                <div>
                    <div className="sg-field-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Breaks</span>
                        <button className="btn btn-secondary" onClick={addBreak} style={{ padding: '4px 10px', fontSize: 12 }}>+ Add break</button>
                    </div>
                    {config.breaks.length === 0 ? (
                        <div className="sg-empty">No breaks. Sessions pack the entire day.</div>
                    ) : (
                        <div className="sg-break-list">
                            {config.breaks.map(b => (
                                <div key={b.id} className="sg-break-row">
                                    <input className="input" value={b.label} onChange={e => updateBreak(b.id, { label: e.target.value })} placeholder="Label" />
                                    <input type="time" className="input" value={b.start} onChange={e => updateBreak(b.id, { start: e.target.value })} />
                                    <span className="sg-sep">to</span>
                                    <input type="time" className="input" value={b.end} onChange={e => updateBreak(b.id, { end: e.target.value })} />
                                    <span className="sg-break-duration">{formatDuration(b.start, b.end)}</span>
                                    <button className="sg-icon-btn" onClick={() => removeBreak(b.id)} aria-label="Remove break"><X size={14} /></button>
                                </div>
                            ))}
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
    const updateSoft = (key: keyof GenerationConfig['soft'], val: number) =>
        setConfig(c => ({ ...c, soft: { ...c.soft, [key]: val } }));

    return (
        <div>
            <StageHeader icon={<Sliders size={16} />} title="Constraints" desc="Hard rules are always enforced. Tune soft weights to guide optimization." compact={compact} />

            <div className="sg-subhead"><Lock size={12} /> Hard Constraints. Always On.</div>
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

            <div className="sg-subhead" style={{ marginTop: 0 }}><Sliders size={12} /> Soft Optimization Weights</div>
            <div className="sg-sliders">
                <SoftSlider label="Balanced Teacher Load" desc="Spread sessions evenly across teachers." value={config.soft.balancedLoad} onChange={v => updateSoft('balancedLoad', v)} compact={compact} />
                <SoftSlider label="Compact Schedules" desc="Reduce idle gaps inside a day." value={config.soft.compactSchedule} onChange={v => updateSoft('compactSchedule', v)} compact={compact} />
                <SoftSlider label="Minimize Room Switching" desc="Keep teachers in fewer rooms." value={config.soft.minimizeRoomSwitch} onChange={v => updateSoft('minimizeRoomSwitch', v)} compact={compact} />
                <SoftSlider label="Teacher Preferred Time" desc="Honor each teacher's preferred days and time window." value={config.soft.teacherPreferredTime} onChange={v => updateSoft('teacherPreferredTime', v)} compact={compact} />
                <SoftSlider label="Daily Load Balance" desc="Even teaching load per teacher per day." value={config.soft.dailyLoadBalance} onChange={v => updateSoft('dailyLoadBalance', v)} compact={compact} />
                <SoftSlider label="Workload Fairness" desc="Respect max hours and max classes per day." value={config.soft.workloadFairness} onChange={v => updateSoft('workloadFairness', v)} compact={compact} />
                <SoftSlider label="Subject Spacing" desc="Avoid stacking the same subject on one day." value={config.soft.subjectSpacing} onChange={v => updateSoft('subjectSpacing', v)} compact={compact} />
                <SoftSlider label="Room Utilization" desc="Reward high utilization of scarce specialty rooms." value={config.soft.roomUtilization} onChange={v => updateSoft('roomUtilization', v)} compact={compact} />
            </div>

            <div className="sg-subhead" style={{ marginTop: 20 }}><ShieldCheck size={12} /> Institutional Policies</div>
            <button
                type="button"
                className="sg-hard-constraints-btn"
                onClick={() => setPoliciesOpen(!policiesOpen)}
                aria-expanded={policiesOpen}
            >
                <span>Configure institutional policies</span>
                {policiesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {policiesOpen && (
                <div className="sg-hard-list-expanded" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <div className="sg-field-label">Overflow Policy</div>
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
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Overflow policy controls how the generator handles sections that exceed room capacity. 
                        "Fail" stops generation, "Relax soft" temporarily reduces soft constraint weights, 
                        "Expand scope" searches more aggressively, and "Partial only" applies only to partial regeneration.
                    </div>
                </div>
            )}

            <div className="sg-grid-3" style={{ marginTop: policiesOpen ? 20 : 16 }}>
                <div>
                    <div className="sg-field-label">Attempts</div>
                    <select className="input" value={config.maxAttempts} onChange={e => setConfig(c => ({ ...c, maxAttempts: Number(e.target.value) }))}>
                        {[10, 25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                </div>
            </div>
        </div>
    );
};

const SoftSlider: React.FC<{ label: string; desc: string; value: number; onChange: (v: number) => void; compact?: boolean }> = ({ label, desc, value, onChange, compact = false }) => (
    <div className="sg-slider">
        <div className="sg-slider-head">
            <div>
                <div className="sg-slider-label">{label}</div>
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

const ReviewStage: React.FC<{
    config: GenerationConfig;
    blockers: string[];
    counts: { subjects: number; teachers: number; rooms: number; sections: number; existing: number };
    targetLabel: string;
}> = ({ config, blockers, counts, targetLabel }) => {
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
                            ['Clear existing', config.clearExisting ? 'Yes' : 'No'],
                            ['Existing entries', String(counts.existing)],
                        ]
                    }
                />
                <ReviewBlock title="Structure"
                    items={[
                        ['Days', config.days.map(d => d.slice(0, 3)).join(', ') || 'None'],
                        ['Hours', `${config.dayStart} to ${config.dayEnd}`],
                        ['Session', `${config.sessionMinutes} min`],
                        ['Breaks', config.breaks.map(b => `${b.label} ${b.start} to ${b.end}`).join(', ') || 'None'],
                    ]}
                />
                <ReviewBlock title="Soft Weights"
                    items={[
                        ['Balanced Load', `${config.soft.balancedLoad}`],
                        ['Compact', `${config.soft.compactSchedule}`],
                        ['Attempts', String(config.maxAttempts)],
                    ]}
                />
                <ReviewBlock title="Priorities"
                    items={[
                        ['High Priority Sections', String(Object.values(config.priorities.sections).filter(v => v >= 70).length)],
                        ['High Priority Subjects', String(Object.values(config.priorities.subjects).filter(v => v >= 70).length)],
                        ['Low Priority Items', String([...Object.values(config.priorities.sections), ...Object.values(config.priorities.subjects)].filter(v => v <= 30).length)],
                        ['Special Room Bias', `${config.priorities.specialRoomBias}`],
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

const ResultsStage: React.FC<{ result: GenerationResult; onOptimize: () => void; onSave: () => void }> = ({ result, onOptimize, onSave }) => {
    const perfect = result.placed === result.total && result.errors.length === 0;
    const scoreRounded = result.score.toFixed(2);
    const unplacedCount = result.total - result.placed;

    return (
        <div>
            <StageHeader
                icon={perfect ? <CheckCircle size={16} /> : <Layers size={16} />}
                title={perfect ? 'Schedule ready' : 'Partial schedule'}
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
                                <tr key={`${e.subjectId}-${e.day}-${e.start}`}>
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

            {/* Action buttons for optimize or save */}
            <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={onOptimize} disabled={result.entries.length === 0}>
                    <Zap size={14} /> Optimize Schedule
                </button>
                <button className="btn btn-primary" onClick={onSave} disabled={result.entries.length === 0}>
                    <Save size={14} /> Save Schedule
                </button>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Stage 7 — Optimize
// ---------------------------------------------------------------------------

const OptimizeStage: React.FC<{
    result: GenerationResult;
    optimizing: boolean;
    optimizationReport: any;
    optimizedResult: GenerationResult | null;
    optimizationError: string | null;
    onOptimize: () => void;
    onUseOptimized: () => void;
    onDiscard: () => void;
}> = ({ result, optimizing, optimizationReport, optimizedResult, optimizationError, onOptimize, onUseOptimized, onDiscard }) => {
    return (
        <div>
            <StageHeader
                icon={<Sparkles size={16} />}
                title="Optimize Schedule"
                desc="Improve schedule quality using post-optimization without breaking hard constraints."
            />

            {!optimizedResult ? (
                <div style={{ padding: '20px 0' }}>
                    {optimizationError && (
                        <div className="sg-banner sg-banner-error" style={{ marginBottom: 16 }}>
                            <XCircle size={14} /> {optimizationError}
                        </div>
                    )}
                    
                    <div style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Current Score</h3>
                        <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent-primary)' }}>
                            {result.score.toFixed(2)}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {result.placed} of {result.total} sessions placed
                        </div>
                    </div>

                    <button 
                        className="btn btn-primary" 
                        onClick={onOptimize} 
                        disabled={optimizing}
                        style={{ width: '100%' }}
                    >
                        {optimizing ? (
                            <>
                                <Loader2 size={16} className="animate-spin" style={{ marginRight: 8 }} />
                                Optimizing...
                            </>
                        ) : (
                            <>
                                <Sparkles size={16} style={{ marginRight: 8 }} />
                                Run Optimization
                            </>
                        )}
                    </button>

                    <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                        <p><strong>Safe Mode:</strong> Only accepts strictly improving changes. Ideal for demonstrations.</p>
                        <p><strong>Advanced Mode:</strong> Uses simulated annealing to escape local optima. May temporarily accept small negative moves early in the process.</p>
                    </div>
                </div>
            ) : (
                <div style={{ padding: '20px 0' }}>
                    <div style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Optimization Complete</h3>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Before</div>
                                <div style={{ fontSize: 24, fontWeight: 600 }}>{result.score.toFixed(2)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>After</div>
                                <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--accent-success)' }}>
                                    {optimizedResult.score.toFixed(2)}
                                </div>
                            </div>
                        </div>

                        {optimizationReport && (
                            <div style={{ 
                                padding: 12, 
                                background: optimizationReport.improvement > 0 
                                    ? 'var(--accent-success-alpha, rgba(47, 143, 91, 0.1)' 
                                    : 'var(--accent-warning-alpha, rgba(211, 139, 32, 0.1))',
                                borderRadius: 6,
                                marginBottom: 16
                            }}>
                                <div style={{ 
                                    fontSize: 18, 
                                    fontWeight: 700,
                                    color: optimizationReport.improvement > 0 ? 'var(--accent-success)' : 'var(--accent-warning)'
                                }}>
                                    {optimizationReport.improvement > 0 ? '+' : ''}{optimizationReport.improvement.toFixed(2)}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    Score improvement
                                </div>
                            </div>
                        )}
                    </div>

                    <button 
                        className="btn btn-primary" 
                        onClick={onUseOptimized}
                        style={{ width: '100%', marginBottom: 8 }}
                    >
                        <Check size={16} style={{ marginRight: 8 }} />
                        Use Optimized Schedule
                    </button>

                    <button 
                        className="btn btn-secondary" 
                        onClick={onDiscard}
                        style={{ width: '100%' }}
                    >
                        <X size={16} style={{ marginRight: 8 }} />
                        Discard Optimization
                    </button>
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Stage 7 — Save
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

const StageHeader: React.FC<{ icon: React.ReactNode; title: string; desc: string; compact?: boolean }> = ({ icon, title, desc, compact = false }) => (
    <div className="sg-stage-head">
        <div className="sg-stage-icon">{icon}</div>
        <div>
            <div className="sg-stage-title">{title}</div>
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
    // Subjects: lab subjects land on High (special-room pressure), electives (no program) on Low.
    const smartSuggest = () => {
        if (kind === 'sections') {
            const sized = sections.filter(s => s.student_count != null) as { id: string; student_count: number | null }[];
            if (sized.length === 0) return;
            const counts = sized.map(s => s.student_count || 0).sort((a, b) => a - b);
            const qHigh = counts[Math.floor(counts.length * 0.75)] ?? counts[counts.length - 1];
            const qLow  = counts[Math.floor(counts.length * 0.25)] ?? counts[0];
            const next: Record<string, number> = {};
            for (const s of sections) {
                const n = s.student_count ?? -1;
                if (n >= qHigh && n > 0) next[s.id] = PRIORITY_VALUES.high;
                else if (n > 0 && n <= qLow) next[s.id] = PRIORITY_VALUES.low;
            }
            setMap(next);
        } else {
            const next: Record<string, number> = {};
            for (const s of subjects) {
                if (s.requires_lab) next[s.id] = PRIORITY_VALUES.high;
                else if (!s.program)  next[s.id] = PRIORITY_VALUES.low;
            }
            setMap(next);
        }
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
            <StageHeader
                icon={<Flag size={16} />}
                title="Priorities"
                desc="Flag what matters most. The engine places high priority items first and protects their slots."
                compact={compact}
            />

            <div className="sg-prio-bias">
                <div className="sg-slider-head">
                    <div>
                        <div className="sg-slider-label">Special Room Bias</div>
                        {!compact && <div className="sg-slider-desc">How strongly to reserve labs and studios for subjects that need them. Lab subjects always get labs.</div>}
                    </div>
                    <div className="sg-slider-val">{config.priorities.specialRoomBias}</div>
                </div>
                <input
                    type="range" min={0} max={100} step={5}
                    value={config.priorities.specialRoomBias}
                    onChange={e => setConfig(c => ({ ...c, priorities: { ...c.priorities, specialRoomBias: Number(e.target.value) } }))}
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
                    title={kind === 'sections'
                        ? 'Flag larger sections as high, smaller as low'
                        : 'Flag lab subjects as high, electives as low'}
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

            <div className="sg-prio-legend">
                {PRIORITY_TIERS.map(t => (
                    <span key={t.key} className={`sg-prio-pill sg-prio-${t.key}`}>
                        {t.label}
                        <span className="sg-prio-pill-sub">{t.desc}</span>
                    </span>
                ))}
            </div>
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
