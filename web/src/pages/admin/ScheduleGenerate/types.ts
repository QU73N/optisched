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
}

export interface Teacher {
    id: string;
    max_hours: number | null;
    full_name: string;
}

export interface Room {
    id: string;
    name: string;
    capacity: number | null;
    type: string | null;
    building: string | null;
    is_available: boolean | null;
}

export interface Section {
    id: string;
    name: string;
    program: string | null;
    year_level: number | null;
    student_count: number | null;
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
    balancedLoad: number;      // 0 to 100
    compactSchedule: number;   // 0 to 100
    minimizeRoomSwitch: number;// 0 to 100
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

export type GenerationMode = 'full' | 'partial';
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
}

export interface GenerationProgress {
    subStage: 'loading' | 'ranking' | 'placing' | 'resolving' | 'scoring' | 'done' | 'idle';
    attempt: number;
    totalAttempts: number;
    placed: number;
    total: number;
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
    soft: { balancedLoad: 60, compactSchedule: 70, minimizeRoomSwitch: 50 },
    priorities: { sections: {}, subjects: {}, specialRoomBias: 70 },
    maxAttempts: 5,
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
    'No teacher overlap',
    'No room overlap',
    'No section overlap',
    'Room capacity compliance',
    'Room and subject compatibility',
    'Teacher qualification enforcement',
    'Teacher availability enforcement',
    'Maximum consecutive hours per day',
    'Maximum daily teaching hours',
    'Break enforcement when enabled',
    'Single teacher per session',
    'Single room per session',
    'Fixed-time enforcement',
    'Locked schedule enforcement',
];
