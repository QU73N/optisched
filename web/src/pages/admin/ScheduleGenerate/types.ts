// Shared types for the Schedule Generate workspace.
// Phase 2 adds priorities and special-room bias.

export type StageKey =
    | 'scope'
    | 'structure'
    | 'constraints'
    | 'priorities'
    | 'review'
    | 'generate'
    | 'results'
    | 'save';

export interface Subject {
    id: string;
    name: string;
    code: string;
    duration_hours: number | null;
    requires_lab: boolean | null;
    program: string | null;
    year_level: number | null;
    teacher_id: string | null;
    weight: number;
    priority_note: string | null;
    monthly_hour_targets?: number | null; // optional monthly targets
    teacher_eligibility_pool?: Record<string, unknown>; // which teachers can teach this
    // For split sessions: number of sessions per week (calculated from duration_hours / session_minutes if not set)
    sessions_per_week?: number | null;
}

export interface Teacher {
    id: string;
    max_hours: number | null;
    full_name: string;
    weight: number;
    priority_note: string | null;
    shared_assignment?: boolean | null; // can teach across programs
    // Preferences (from teacher_preferences; optional to stay backward-compatible)
    preferred_days?: string[];
    preferred_time_start?: string | null; // HH:MM
    preferred_time_end?: string | null;   // HH:MM
    max_classes_per_day?: number | null;
    max_consecutive_classes?: number | null;
    // Per-slot availability map: { "Monday-08:00": false, ... } — missing keys default to true
    availability?: Record<string, boolean>;
}

export interface Room {
    id: string;
    name: string;
    capacity: number | null;
    type: string | null;
    building: string | null;
    floor: number | null;
    is_available: boolean | null;
    weight: number;
    priority_note: string | null;
    subject_compatibility?: Record<string, unknown>; // which subjects can use this room
    equipment_available?: Record<string, unknown>; // lab equipment, etc.
    movement_cost?: number | null; // cost to move between buildings/floors
}

export interface Section {
    id: string;
    name: string;
    program: string | null;
    year_level: number | null;
    student_count: number | null;
    parent_id: string | null;
    weight: number;
    path: string;
    node_type: 'group' | 'section';
    is_active: boolean;
    description: string | null;
    metadata: Record<string, unknown>;
    sort_order: number;
    load_category?: 'light' | 'normal' | 'heavy' | null;
    special_scheduling_rules?: Record<string, unknown>; // custom rules
}

export interface ExistingSchedule {
    id: string;
    subject_id: string;
    teacher_id: string;
    room_id: string;
    section_id: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    status: string | null;
    created_at: string | null;
    is_protected?: boolean | null; // for locked regeneration
    protection_level?: 'none' | 'approved' | 'published' | 'admin_locked' | null;
    protected_version_id?: string | null;
}

export type WorkflowState = 'draft' | 'submitted' | 'approved' | 'published';

export interface VersionSummary {
    state: WorkflowState;
    count: number;
    latest: string | null; // ISO date of most recent row
    label: string;
    desc: string;
}

export const WORKFLOW_META: Record<WorkflowState, { label: string; desc: string }> = {
    draft:     { label: 'Draft',     desc: 'Saved but not sent for review.' },
    submitted: { label: 'Submitted', desc: 'Waiting on an administrator.' },
    approved:  { label: 'Approved',  desc: 'Cleared for publishing.' },
    published: { label: 'Published', desc: 'Live for teachers and students.' },
};

export interface BreakWindow {
    id: string;
    label: string;
    start: string; // HH:MM
    end: string;   // HH:MM
}

export interface SoftWeights {
    balancedLoad: number;         // 0 to 100 — spread sessions evenly across teachers
    compactSchedule: number;      // 0 to 100 — reduce idle gaps inside section days
    minimizeRoomSwitch: number;   // 0 to 100 — keep teachers in fewer rooms
    teacherPreferredTime: number; // 0 to 100 — honor each teacher's preferred window
    dailyLoadBalance: number;     // 0 to 100 — even teaching load per teacher per day
    workloadFairness: number;     // 0 to 100 — (now hard constraint, kept for compatibility)
    subjectSpacing: number;       // 0 to 100 — avoid stacking the same subject on one day
    roomUtilization: number;      // 0 to 100 — reward high utilization of scarce rooms
}

export type PriorityTier = 'high' | 'normal' | 'low';

export const PRIORITY_VALUES: Record<PriorityTier, number> = {
    high: 80,
    normal: 50,
    low: 20,
};

export const PRIORITY_TIERS: { key: PriorityTier; label: string; desc: string }[] = [
    { key: 'high',   label: 'High',   desc: 'Place first, protect its slots.' },
    { key: 'normal', label: 'Normal', desc: 'Default treatment.' },
    { key: 'low',    label: 'Low',    desc: 'Fill in after the rest.' },
];

export const tierFromValue = (v: number): PriorityTier => {
    if (v >= 70) return 'high';
    if (v <= 30) return 'low';
    return 'normal';
};

export interface Priorities {
    sections: Record<string, number>; // sectionId -> 0..100, missing means 50
    subjects: Record<string, number>; // subjectId -> 0..100, missing means 50
    specialRoomBias: number;          // 0..100, how strongly special subjects prefer special rooms
}

export type GenerationMode = 'full' | 'partial' | 'draft' | 'locked' | 'whatif' | 'emergency' | 'multiscenario';

export const MODE_LABELS: Record<GenerationMode, { label: string; desc: string }> = {
    full: { label: 'Full generation', desc: 'Rebuild the selected scope from scratch.' },
    partial: { label: 'Partial regeneration', desc: 'Recalculate only affected sections while preserving the rest.' },
    draft: { label: 'Draft generation', desc: 'Create a temporary schedule for review without overwriting.' },
    locked: { label: 'Locked regeneration', desc: 'Regenerate only inside allowed slots while keeping approved sessions fixed.' },
    whatif: { label: 'What-if simulation', desc: 'Test a scheduling scenario without saving for comparison.' },
    emergency: { label: 'Emergency repair', desc: 'Repair only the impacted area after sudden changes.' },
    multiscenario: { label: 'Multi-scenario', desc: 'Generate several candidate schedules and compare side by side.' },
};
export type PartialKind = 'section' | 'teacher' | 'room' | 'subject';

export interface PartialTarget {
    kind: PartialKind;
    id: string;
}

export const PARTIAL_KIND_LABELS: Record<PartialKind, string> = {
    section: 'Section',
    teacher: 'Teacher',
    room:    'Room',
    subject: 'Subject',
};

export interface GenerationConfig {
    // Mode
    mode: GenerationMode;
    partialTarget: PartialTarget | null;
    // Scope
    sectionIds: string[];          // empty => all
    clearExisting: boolean;
    // Structure
    days: string[];                // subset of Mon..Sat
    dayStart: string;              // HH:MM
    dayEnd: string;                // HH:MM
    sessionMinutes: number;        // 60 | 90 | 120
    breaks: BreakWindow[];
    // Constraints
    soft: SoftWeights;
    // Priorities
    priorities: Priorities;
    // Run
    maxAttempts: number;
    // Phase 11: Institutional Options - Overflow Policy
    overflowPolicy: 'fail' | 'relax_soft' | 'expand_scope' | 'partial_only';
    // Phase 7: Forward Checking - Enable/disable forward checking (can be expensive on large datasets)
    enableForwardChecking: boolean;
}

export interface PlacedEntry {
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    teacherId: string;
    teacherName: string;
    roomId: string;
    roomName: string;
    sectionId: string;
    sectionName: string;
    day: string;
    start: string;
    end: string;
}

export type DiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export interface DiffEntry {
    key: string;
    status: DiffStatus;
    before?: PlacedEntry;
    after?: PlacedEntry;
}

export interface GenerationResult {
    total: number;
    placed: number;
    entries: PlacedEntry[];
    errors: string[];
    score: number; // 0 to 100 soft score of best attempt
    highPriorityPlaced: number;
    highPriorityTotal: number;
    mode: GenerationMode;
    diff: DiffEntry[]; // empty when mode is full
    // Phase 15: Output and Review enhancements
    softConstraintScoreBreakdown?: {
        balancedLoad: number;
        compactSchedule: number;
        minimizeRoomSwitch: number;
        teacherPreferredTime: number;
        dailyLoadBalance: number;
        workloadFairness: number;
        subjectSpacing: number;
        roomUtilization: number;
    };
    hardConstraintComplianceStatus?: {
        noTeacherOverlap: boolean;
        noRoomOverlap: boolean;
        noSectionOverlap: boolean;
        roomCapacityCompliance: boolean;
        teacherQualificationEnforcement: boolean;
        teacherAvailabilityEnforcement: boolean;
    };
    attemptMetadata?: {
        attemptCount: number;
        bestScore: number;
    };
    scopeSummary?: {
        sectionsCount: number;
        teachersCount: number;
        roomsCount: number;
        subjectsCount: number;
    };
    // Phase 12: Impossible Schedule Handling - Actionable recommendations
    recommendations?: string[];
}

export interface GenerationProgress {
    subStage: 'loading' | 'ranking' | 'placing' | 'resolving' | 'scoring' | 'done' | 'idle';
    attempt: number;
    totalAttempts: number;
    placed: number;
    total?: number;
    message: string;
}

export const DEFAULT_CONFIG: GenerationConfig = {
    mode: 'full',
    partialTarget: null,
    sectionIds: [],
    clearExisting: false,
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    dayStart: '07:00',
    dayEnd: '17:30',
    sessionMinutes: 90,
    breaks: [
        { id: 'lunch', label: 'Lunch', start: '12:00', end: '13:00' },
    ],
    soft: {
        balancedLoad: 60,
        compactSchedule: 70,
        minimizeRoomSwitch: 50,
        teacherPreferredTime: 60,
        dailyLoadBalance: 50,
        workloadFairness: 60,
        subjectSpacing: 50,
        roomUtilization: 40,
    },
    priorities: { sections: {}, subjects: {}, specialRoomBias: 70 },
    maxAttempts: 100,
    overflowPolicy: 'relax_soft',
    enableForwardChecking: false, // Disabled by default for performance
};

export const STAGES: { key: StageKey; label: string; hint: string }[] = [
    { key: 'scope',       label: 'Scope',       hint: 'What to generate' },
    { key: 'structure',   label: 'Structure',   hint: 'Days, hours, breaks' },
    { key: 'constraints', label: 'Constraints', hint: 'Hard rules and soft weights' },
    { key: 'priorities',  label: 'Priorities',  hint: 'What gets placed first' },
    { key: 'review',      label: 'Review',      hint: 'Confirm inputs' },
    { key: 'generate',    label: 'Generate',    hint: 'Run the engine' },
    { key: 'results',     label: 'Results',     hint: 'Preview placements' },
    { key: 'save',        label: 'Save',        hint: 'Persist as draft' },
];

export const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const HARD_CONSTRAINTS: string[] = [
    'No Teacher Overlap',
    'No Room Overlap',
    'No Section Overlap',
    'Room Capacity Compliance',
    'Room and Subject Compatibility',
    'Teacher Qualification Enforcement',
    'Teacher Availability Enforcement',
    'Maximum Consecutive Hours Per Day',
    'Maximum Daily Teaching Hours',
    'Maximum Classes Per Day (Teacher)',
    'Maximum Total Hours Per Week (Teacher)',
    'Break Enforcement When Enabled',
    'Single Teacher Per Session',
    'Single Room Per Session',
    'Fixed-Time Enforcement',
    'Locked Schedule Enforcement',
];

// ============================================================================
// Generation System Types
// ============================================================================

export type GenerationModeExtended = 'full' | 'partial' | 'draft' | 'locked' | 'what-if' | 'emergency' | 'multi-scenario';

export interface GenerationRun {
    id: string;
    config: GenerationConfig;
    scope: {
        sections: string[];
        teachers: string[];
        rooms: string[];
        subjects: string[];
    };
    seed: number;
    priority_settings: Priorities;
    constraint_settings: SoftWeights;
    attempt_scores?: Array<{
        attempt: number;
        score: number;
        placed: number;
        total: number;
    }>;
    final_schedule?: PlacedEntry[];
    repair_actions?: Array<{
        type: string;
        description: string;
        affected_sessions: string[];
    }>;
    invalid_sessions?: Array<{
        sessionId: string;
        reason: string;
    }>;
    failure_reason?: string;
    failure_category?: 'specific' | 'general';
    actionable_options?: Array<{
        option: string;
        description: string;
    }>;
    total_sessions: number;
    placed_sessions: number;
    score?: number;
    mode: GenerationModeExtended;
    partial_target?: PartialTarget;
    status: 'running' | 'completed' | 'failed';
    started_at: string;
    completed_at?: string;
    created_by?: string;
}

export interface InstitutionalPolicy {
    id: string;
    institution_id: string;
    policy_name: string;
    policy_value: Record<string, unknown>;
    policy_category: 'scheduling' | 'breaks' | 'approvals' | 'regeneration' | 'overflow' | 'priority_override';
    is_active: boolean;
    version: number;
    created_at: string;
    updated_at: string;
    created_by?: string;
}

export interface NormalizedTeacher extends Teacher {
    qualified_subjects: string[]; // subject IDs this teacher can teach
    role_based_load_limits: {
        max_hours_per_week: number;
        max_hours_per_day: number;
        max_consecutive_hours: number;
    };
    shared_assignment_flag: boolean;
}

export interface NormalizedRoom extends Room {
    special_room_status: boolean;
    building_location: string;
    floor_location: number;
    subject_compatibility_map: Record<string, boolean>; // subjectId -> compatible
    equipment_map: Record<string, boolean>; // equipment type -> available
    movement_cost_value: number;
}

export interface NormalizedSection extends Section {
    student_size: number;
    hierarchy_path: string[];
    priority_weight: number;
    subject_requirements: string[]; // subject IDs required
    load_category_value: 'light' | 'normal' | 'heavy';
    special_rules: Record<string, unknown>;
}

export interface NormalizedSubject extends Subject {
    required_weekly_hours: number;
    optional_monthly_targets: number | null;
    session_duration_preferences: number;
    split_session_rules: {
        max_parts: number;
        min_duration: number;
    };
    teacher_eligibility: string[]; // teacher IDs
    room_compatibility: string[]; // room IDs
    priority_level: 'high' | 'normal' | 'low';
}

export interface HardConstraintSet {
    no_teacher_overlap: boolean;
    no_room_overlap: boolean;
    no_section_overlap: boolean;
    room_capacity_compliance: boolean;
    teacher_qualification_enforcement: boolean;
    teacher_availability_enforcement: boolean;
    max_consecutive_hours: number;
    max_daily_load: number;
    subject_hour_completion: boolean;
    special_subject_room_priority: boolean;
    break_enforcement: boolean;
    schedule_lock_protection: boolean;
}

export interface SoftConstraintSet {
    balanced_weekly_load: boolean;
    reduced_idle_gaps: boolean;
    compact_section_schedules: boolean;
    room_movement_minimization: boolean;
    time_of_day_preference: boolean;
    room_utilization_efficiency: boolean;
    schedule_compactness: boolean;
    fairness_between_teachers: boolean;
    priority_weighting: boolean;
}

export interface PreferenceConstraintSet {
    preferred_rooms: Record<string, string[]>; // subjectId -> roomIds
    preferred_time_windows: Record<string, { start: string; end: string }>; // teacherId -> window
    preferred_days: Record<string, string[]>; // teacherId -> days
    preferred_sequencing: Record<string, string[]>; // sectionId -> subject order
    preferred_special_room_use: boolean;
}

export interface PlacementTask {
    subject: NormalizedSubject;
    section: NormalizedSection;
    sessionIndex: number; // 0-based index for split sessions
    priority_tier: 'high' | 'normal' | 'low';
    mrv_score: number; // minimum remaining values
}

export interface TeacherDomain {
    teacher_id: string;
    valid_days: string[];
    valid_time_slots: Array<{ start: string; end: string }>;
}

export interface RoomDomain {
    room_id: string;
    valid_subjects: string[];
}

export interface SectionDomain {
    section_id: string;
    valid_subjects: string[];
}

// ============================================================================
// Generation System Additional Types
// ============================================================================

export interface ClassifiedConstraints {
    hard: HardConstraintSet;
    soft: SoftConstraintSet;
    preferences: PreferenceConstraintSet;
}

export interface SoftConstraintViolation {
    violation_type: 'unbalanced_load' | 'idle_gaps' | 'room_switching' | 'time_preference' | 'subject_stacking';
    affected_entities: string[]; // teacher IDs, section IDs, etc.
    severity: 'low' | 'medium' | 'high';
    description: string;
    potential_score_impact: number;
}

export interface OptimizationSuggestion {
    suggestion_type: 'swap_time_slot' | 'swap_room' | 'swap_teacher' | 'adjust_session_length';
    expected_improvement: number;
    effort: 'low' | 'medium' | 'high';
    description: string;
}

export interface ScenarioConfig {
    id: string;
    name: string;
    description: string;
    soft_weights: SoftWeights;
    strategy: 'balanced' | 'load_focused' | 'compact_focused' | 'room_focused';
    max_attempts: number;
}

export interface ScenarioResult {
    scenario_id: string;
    placed_entries: PlacedEntry[];
    score: number;
    violations: SoftConstraintViolation[];
    generation_time_ms: number;
    success: boolean;
}
