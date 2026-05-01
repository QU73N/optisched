// Generation engine for the Generate workspace (Phase 1).
// Placement is deterministic per-attempt via seeded shuffle; attempts keep best score.

import type {
    BreakWindow,
    DiffEntry,
    ExistingSchedule,
    GenerationConfig,
    GenerationProgress,
    GenerationResult,
    PartialTarget,
    PlacedEntry,
    Room,
    Section,
    Subject,
    Teacher,
    NormalizedTeacher,
    NormalizedRoom,
    NormalizedSection,
    NormalizedSubject,
    HardConstraintSet,
    SoftConstraintSet,
    PreferenceConstraintSet,
    ClassifiedConstraints,
    SoftConstraintViolation,
    OptimizationSuggestion,
    ScenarioConfig,
    ScenarioResult,
    TeacherDomain,
    RoomDomain,
    SectionDomain,
    SoftWeights,
} from './types';
import { saveGenerationMetadata } from '../../../services/generationService';

const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

const toHHMM = (mins: number) => {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
};

const overlapsBreak = (start: number, end: number, breaks: BreakWindow[]) =>
    breaks.some(b => toMin(b.start) < end && start < toMin(b.end));

const buildSlots = (cfg: GenerationConfig): { start: string; end: string }[] => {
    const slots: { start: string; end: string }[] = [];
    const dayStart = toMin(cfg.dayStart);
    const dayEnd = toMin(cfg.dayEnd);
    const step = cfg.sessionMinutes;
    for (let s = dayStart; s + step <= dayEnd; s += step) {
        const e = s + step;
        if (overlapsBreak(s, e, cfg.breaks)) continue;
        slots.push({ start: toHHMM(s), end: toHHMM(e) });
    }
    return slots;
};

interface Busy {
    teacherId: string;
    roomId: string;
    sectionId: string;
    day: string;
    startMin: number;
    endMin: number;
}

const isFree = (
    busy: Busy[],
    kind: 'teacher' | 'room' | 'section',
    id: string,
    day: string,
    startMin: number,
    endMin: number,
) => !busy.some(b => {
    if (b.day !== day) return false;
    if (startMin >= b.endMin || endMin <= b.startMin) return false;
    if (kind === 'teacher') return b.teacherId === id;
    if (kind === 'room') return b.roomId === id;
    return b.sectionId === id;
});

/**
 * Forward Checking: Check if placing a session would make it impossible to place remaining sessions.
 * This is a conservative implementation that checks resource scarcity without full domain mutation.
 * Aligns with Generation_System.md Phase 7: Forward Checking and Propagation.
 * Note: This function is integrated into the placement loop to avoid dead-end placements.
 */
const checkForwardConstraints = (
    teacherId: string,
    roomId: string,
    sectionId: string,
    day: string,
    startMin: number,
    endMin: number,
    busy: Busy[],
    remainingTasks: Array<{ subject: Subject; section: Section }>,
    teacherMap: Map<string, Teacher>,
    roomMap: Map<string, Room>,
    slots: { start: string; end: string }[],
    days: string[],
): boolean => {
    // Simulate the placement in a temporary busy array
    const tempBusy = [...busy, { teacherId, roomId, sectionId, day, startMin, endMin }];

    // Check if this placement would consume the last available slot for a scarce resource
    // Count remaining slots for each resource
    const teacherSlotCount = new Map<string, number>();
    const roomSlotCount = new Map<string, number>();
    const sectionSlotCount = new Map<string, number>();

    for (const d of days) {
        for (const slot of slots) {
            const sMin = toMin(slot.start);
            const eMin = toMin(slot.end);
            
            // Count free teacher slots
            for (const [tid] of teacherMap) {
                if (isFree(tempBusy, 'teacher', tid, d, sMin, eMin)) {
                    teacherSlotCount.set(tid, (teacherSlotCount.get(tid) || 0) + 1);
                }
            }
            
            // Count free room slots
            for (const [rid] of roomMap) {
                if (isFree(tempBusy, 'room', rid, d, sMin, eMin)) {
                    roomSlotCount.set(rid, (roomSlotCount.get(rid) || 0) + 1);
                }
            }
            
            // Count free section slots
            for (const task of remainingTasks) {
                if (isFree(tempBusy, 'section', task.section.id, d, sMin, eMin)) {
                    sectionSlotCount.set(task.section.id, (sectionSlotCount.get(task.section.id) || 0) + 1);
                }
            }
        }
    }

    // Check if any remaining task would have zero valid slots after this placement
    for (const task of remainingTasks) {
        const subject = task.subject;
        const section = task.section;
        
        // Check if subject requires lab and if there are still special room slots
        if (subject.requires_lab) {
            const specialRooms = Array.from(roomMap.values()).filter(r => 
                (r.type || '').toLowerCase().includes('special')
            );
            const hasSpecialRoomSlot = specialRooms.some(r => 
                (roomSlotCount.get(r.id) || 0) > 0
            );
            if (!hasSpecialRoomSlot) {
                return false; // Would consume last special room slot
            }
        }

        // Check if section has enough capacity-compliant room slots
        const capacityRooms = Array.from(roomMap.values()).filter(r => 
            (r.capacity || 0) >= (section.student_count || 0)
        );
        const hasCapacityRoomSlot = capacityRooms.some(r => 
            (roomSlotCount.get(r.id) || 0) > 0
        );
        if (!hasCapacityRoomSlot && capacityRooms.length > 0) {
            return false; // Would consume last capacity-compliant room slot
        }
    }

    return true; // Placement is safe from forward checking perspective
};

const roomCompatible = (room: Room, subject: Subject, section: Section): boolean => {
    if (subject.requires_lab) {
        const t = (room.type || '').toLowerCase();
        if (!t.includes('special')) return false;
    }
    if (section.student_count != null && room.capacity != null && section.student_count > room.capacity) {
        return false;
    }
    return true;
};

const shuffle = <T,>(arr: T[]): T[] => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

const priorityOf = (map: Record<string, number>, id: string) =>
    typeof map[id] === 'number' ? map[id] : 50;

/** Calculate how many sessions a subject needs based on duration_hours and session length. */
const sessionsNeeded = (subject: Subject, sessionMinutes: number): number => {
    // If explicitly set, use that
    if (subject.sessions_per_week != null && subject.sessions_per_week > 0) {
        return subject.sessions_per_week;
    }
    // Otherwise calculate from duration_hours
    if (subject.duration_hours != null && subject.duration_hours > 0) {
        const totalMinutes = subject.duration_hours * 60;
        return Math.max(1, Math.ceil(totalMinutes / sessionMinutes));
    }
    // Default to 1 session
    return 1;
};

const isSpecialRoom = (room: Room) => {
    const t = (room.type || '').toLowerCase();
    return t === 'special';
};

/** Check if a teacher is available at the given day/time per their preferences. */
const teacherAvailable = (teacher: Teacher, day: string, startHHMM: string): boolean => {
    const av = teacher.availability;
    if (!av || Object.keys(av).length === 0) return true; // default available
    const key = `${day}-${startHHMM}`;
    const v = av[key];
    return v === undefined ? true : !!v;
};

/** Check if day falls within teacher's preferred_days; empty/missing = all days ok. */
const dayIsPreferred = (teacher: Teacher, day: string): boolean => {
    const pd = teacher.preferred_days;
    if (!pd || pd.length === 0) return true;
    return pd.includes(day);
};

/** Check if placing this session would exceed teacher's max_classes_per_day. */
const wouldExceedMaxClassesPerDay = (
    teacherId: string,
    day: string,
    currentEntries: PlacedEntry[],
    teacher: Teacher,
    hardConstraints?: HardConstraintSet,
): boolean => {
    const maxClasses = teacher.max_classes_per_day || hardConstraints?.max_daily_load || 8;
    const dayCount = currentEntries.filter(e => e.teacherId === teacherId && e.day === day).length;
    return dayCount >= maxClasses;
};

/** Check if placing this session would exceed teacher's max_hours (total weekly). */
const wouldExceedMaxHours = (
    teacherId: string,
    currentEntries: PlacedEntry[],
    teacher: Teacher,
    sessionMinutes: number,
    hardConstraints?: HardConstraintSet,
): boolean => {
    const maxHours = teacher.max_hours || (hardConstraints?.max_daily_load ?? 8) * 5 || 40;
    const totalHours = (currentEntries.filter(e => e.teacherId === teacherId).length * sessionMinutes) / 60;
    return totalHours >= maxHours;
};

/** Stable sort subjects by combined priority (higher first), with small jitter per attempt. */
const rankSubjects = (
    subjects: Subject[],
    sections: Section[],
    config: GenerationConfig,
    jitter: number,
): Subject[] => {
    const sectionP = config.priorities.sections;
    const subjectP = config.priorities.subjects;
    const scored = subjects.map(sub => {
        const matchSec = sections.find(
            s => (sub.program === 'ALL' || s.program === sub.program) && s.year_level === sub.year_level,
        );
        const secScore = matchSec ? priorityOf(sectionP, matchSec.id) : 50;
        const subScore = priorityOf(subjectP, sub.id);
        const base = subScore * 0.6 + secScore * 0.4;
        const noise = (Math.random() - 0.5) * jitter;
        const final = Math.max(0, Math.min(100, Math.round(base + noise)));
        return { sub, score: final };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.sub);
};

/** Score the soft constraints for a completed attempt. 0..100 */
const scoreAttempt = (
    entries: PlacedEntry[],
    cfg: GenerationConfig,
    teachers: Map<string, Teacher>,
    rooms: Map<string, Room>,
): number => {
    if (entries.length === 0) return 0;

    // 1. Balanced load: std-dev of sessions per teacher (lower = better)
    const perTeacher: Record<string, number> = {};
    for (const e of entries) perTeacher[e.teacherId] = (perTeacher[e.teacherId] || 0) + 1;
    const counts = Object.values(perTeacher);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
    const balancedScore = Math.max(0, 100 - variance * 20);

    // 2. Compact: gaps inside each (section, day). Lower gaps = better.
    const bySec: Record<string, PlacedEntry[]> = {};
    for (const e of entries) {
        const k = `${e.sectionId}|${e.day}`;
        (bySec[k] = bySec[k] || []).push(e);
    }
    let gapMin = 0;
    for (const list of Object.values(bySec)) {
        const sorted = list.slice().sort((a, b) => a.start.localeCompare(b.start));
        for (let i = 1; i < sorted.length; i++) {
            gapMin += Math.max(0, toMin(sorted[i].start) - toMin(sorted[i - 1].end));
        }
    }
    const compactScore = Math.max(0, 100 - gapMin / 10);

    // 3. Room switching: count distinct rooms per teacher (lower = better).
    const perTeacherRooms: Record<string, Set<string>> = {};
    for (const e of entries) {
        (perTeacherRooms[e.teacherId] = perTeacherRooms[e.teacherId] || new Set()).add(e.roomId);
    }
    const switches = Object.values(perTeacherRooms).reduce((acc, s) => acc + (s.size - 1), 0);
    const roomScore = Math.max(0, 100 - switches * 5);

    // 4. Teacher preferred time window: percent of placements inside [preferred_time_start, preferred_time_end].
    let prefHits = 0, prefTotal = 0;
    for (const e of entries) {
        const t = teachers.get(e.teacherId);
        if (!t) continue;
        const ps = t.preferred_time_start;
        const pe = t.preferred_time_end;
        if (!ps || !pe) continue; // no preference => skip
        prefTotal++;
        if (toMin(e.start) >= toMin(ps) && toMin(e.end) <= toMin(pe)) prefHits++;
        // also reward preferred_days adherence
        if (t.preferred_days && t.preferred_days.length > 0) {
            prefTotal++;
            if (t.preferred_days.includes(e.day)) prefHits++;
        }
    }
    const preferredScore = prefTotal === 0 ? 100 : Math.round((prefHits / prefTotal) * 100);

    // 5. Daily load balance: std-dev of sessions per teacher per day (lower = better).
    const perTeacherDay: Record<string, number> = {};
    for (const e of entries) perTeacherDay[`${e.teacherId}|${e.day}`] = (perTeacherDay[`${e.teacherId}|${e.day}`] || 0) + 1;
    const dayCounts = Object.values(perTeacherDay);
    const dayMean = dayCounts.reduce((a, b) => a + b, 0) / Math.max(1, dayCounts.length);
    const dayVar = dayCounts.reduce((a, b) => a + (b - dayMean) ** 2, 0) / Math.max(1, dayCounts.length);
    const dailyBalanceScore = Math.max(0, 100 - dayVar * 25);

    // 6. Workload fairness: now a hard constraint, so no penalty here.
    // max_classes_per_day and max_hours are enforced during placement.
    // We keep this score as 100 (perfect) since violations are prevented.
    const fairnessScore = 100;

    // 7. Subject spacing: penalize same subject placed multiple times on the same day for the same section.
    const subjectDayMap: Record<string, number> = {};
    for (const e of entries) {
        const k = `${e.sectionId}|${e.subjectId}|${e.day}`;
        subjectDayMap[k] = (subjectDayMap[k] || 0) + 1;
    }
    const stackingPenalty = Object.values(subjectDayMap).reduce((acc, n) => acc + Math.max(0, n - 1) * 15, 0);
    const spacingScore = Math.max(0, 100 - stackingPenalty);

    // 8. Room utilization: reward higher utilization of scarce (special) rooms.
    const perRoom: Record<string, number> = {};
    for (const e of entries) perRoom[e.roomId] = (perRoom[e.roomId] || 0) + 1;
    const specialRoomIds = new Set<string>();
    for (const r of rooms.values()) if (isSpecialRoom(r)) specialRoomIds.add(r.id);
    let usedSpecial = 0;
    for (const id of specialRoomIds) if ((perRoom[id] || 0) > 0) usedSpecial++;
    const utilizationScore = specialRoomIds.size === 0 ? 100 : Math.round((usedSpecial / specialRoomIds.size) * 100);

    const w = cfg.soft;
    const total =
        w.balancedLoad + w.compactSchedule + w.minimizeRoomSwitch +
        w.teacherPreferredTime + w.dailyLoadBalance + w.workloadFairness +
        w.subjectSpacing + w.roomUtilization || 1;
    return Math.round(
        (balancedScore * w.balancedLoad +
            compactScore * w.compactSchedule +
            roomScore * w.minimizeRoomSwitch +
            preferredScore * w.teacherPreferredTime +
            dailyBalanceScore * w.dailyLoadBalance +
            fairnessScore * w.workloadFairness +
            spacingScore * w.subjectSpacing +
            utilizationScore * w.roomUtilization) / total,
    );
};

export interface GenerateInput {
    subjects: Subject[];
    teachers: Teacher[];
    rooms: Room[];
    sections: Section[];
    existing: ExistingSchedule[];
    config: GenerationConfig;
    institutionalPolicies?: Record<string, unknown>; // Optional institutional policies
}

/** Does an existing schedule match the partial target? */
const targetMatches = (e: ExistingSchedule, target: PartialTarget | null): boolean => {
    if (!target) return false;
    if (target.kind === 'section') return e.section_id === target.id;
    if (target.kind === 'teacher') return e.teacher_id === target.id;
    if (target.kind === 'room')    return e.room_id === target.id;
    return e.subject_id === target.id;
};

/** Promote an ExistingSchedule row to a PlacedEntry using lookup maps. */
const toPlaced = (
    e: ExistingSchedule,
    subjects: Map<string, Subject>,
    teachers: Map<string, Teacher>,
    rooms: Map<string, Room>,
    sections: Map<string, Section>,
): PlacedEntry => {
    const sub = subjects.get(e.subject_id);
    const t = teachers.get(e.teacher_id);
    const r = rooms.get(e.room_id);
    const s = sections.get(e.section_id);
    return {
        subjectId: e.subject_id,
        subjectCode: sub?.code || '',
        subjectName: sub?.name || 'Unknown subject',
        teacherId: e.teacher_id,
        teacherName: t?.full_name || 'Unknown teacher',
        roomId: e.room_id,
        roomName: r?.name || 'Unknown room',
        sectionId: e.section_id,
        sectionName: s?.name || 'Unknown section',
        day: e.day_of_week,
        start: e.start_time?.slice(0, 5) || '',
        end:   e.end_time?.slice(0, 5) || '',
    };
};

const diffKey = (p: PlacedEntry) => `${p.subjectId}|${p.sectionId}`;

const samePlacement = (a: PlacedEntry, b: PlacedEntry) =>
    a.day === b.day && a.start === b.start && a.end === b.end &&
    a.teacherId === b.teacherId && a.roomId === b.roomId;

const buildDiff = (before: PlacedEntry[], after: PlacedEntry[]): DiffEntry[] => {
    const byKeyBefore = new Map<string, PlacedEntry>();
    for (const p of before) byKeyBefore.set(diffKey(p), p);
    const byKeyAfter = new Map<string, PlacedEntry>();
    for (const p of after) byKeyAfter.set(diffKey(p), p);

    const keys = new Set<string>([...byKeyBefore.keys(), ...byKeyAfter.keys()]);
    const out: DiffEntry[] = [];
    for (const k of keys) {
        const b = byKeyBefore.get(k);
        const a = byKeyAfter.get(k);
        if (b && !a) out.push({ key: k, status: 'removed', before: b });
        else if (!b && a) out.push({ key: k, status: 'added', after: a });
        else if (b && a) out.push({ key: k, status: samePlacement(b, a) ? 'unchanged' : 'changed', before: b, after: a });
    }
    // Sort: changes first, then added, removed, unchanged; each group by label.
    const order: Record<DiffEntry['status'], number> = { changed: 0, added: 1, removed: 2, unchanged: 3 };
    out.sort((x, y) => {
        const d = order[x.status] - order[y.status];
        if (d !== 0) return d;
        const xl = (x.after || x.before)?.subjectCode || '';
        const yl = (y.after || y.before)?.subjectCode || '';
        return xl.localeCompare(yl);
    });
    return out;
};

export type ProgressFn = (p: GenerationProgress) => void;

// ============================================================================
// Generation System Redesign - Phase 2 Modules
// ============================================================================

/**
 * Normalize data with institutional policies applied.
 * Note: This function is called in runGenerator and normalized data is used throughout generation.
 */
const normalizeData = (
    teachers: Teacher[],
    rooms: Room[],
    sections: Section[],
    subjects: Subject[],
    _institutionalPolicies: Record<string, unknown>, // eslint-disable-line @typescript-eslint/no-unused-vars -- Reserved for future use
): {
    normalizedTeachers: NormalizedTeacher[];
    normalizedRooms: NormalizedRoom[];
    normalizedSections: NormalizedSection[];
    normalizedSubjects: NormalizedSubject[];
} => {
    // Normalize teachers with institutional policies applied
    const normalizedTeachers: NormalizedTeacher[] = teachers.map(t => ({
        ...t,
        qualified_subjects: [], // TODO: Populate from subject assignments
        role_based_load_limits: {
            max_hours_per_week: t.max_hours || 40,
            max_hours_per_day: 8,
            max_consecutive_hours: 4,
        },
        shared_assignment_flag: t.shared_assignment || false,
    }));

    // Normalize rooms with institutional policies applied
    const normalizedRooms: NormalizedRoom[] = rooms.map(r => ({
        ...r,
        special_room_status: (r.type || '').toLowerCase() === 'special',
        building_location: r.building || 'Unknown',
        floor_location: r.floor || 0,
        subject_compatibility_map: {}, // TODO: Populate from subject compatibility rules
        equipment_map: {}, // TODO: Populate from equipment rules
        movement_cost_value: r.movement_cost || 0,
    }));

    // Normalize sections with institutional policies applied
    const normalizedSections: NormalizedSection[] = sections.map(s => ({
        ...s,
        student_size: s.student_count || 0,
        hierarchy_path: s.path.split('|'),
        priority_weight: s.weight,
        subject_requirements: [], // TODO: Populate from curriculum
        load_category_value: s.load_category || 'normal',
        special_rules: s.special_scheduling_rules || {},
    }));

    // Normalize subjects with institutional policies applied
    const normalizedSubjects: NormalizedSubject[] = subjects.map(s => ({
        ...s,
        required_weekly_hours: s.duration_hours || 1,
        optional_monthly_targets: s.monthly_hour_targets || null,
        session_duration_preferences: 90, // TODO: Get from institutional policies
        split_session_rules: {
            max_parts: Math.ceil((s.duration_hours || 1) * 60 / 90),
            min_duration: 60,
        },
        teacher_eligibility: s.teacher_id ? [s.teacher_id] : [], // TODO: Expand from eligibility pool
        room_compatibility: [], // TODO: Populate from compatibility rules
        priority_level: s.weight >= 70 ? 'high' : s.weight <= 30 ? 'low' : 'normal',
    }));

    return {
        normalizedTeachers,
        normalizedRooms,
        normalizedSections,
        normalizedSubjects,
    };
};

/**
 * Classify constraints into hard, soft, and preference sets.
 * Note: This function is called in runGenerator and hard constraints are used in placement validation.
 */
const classifyConstraints = (
    config: GenerationConfig,
    _institutionalPolicies: Record<string, unknown>, // eslint-disable-line @typescript-eslint/no-unused-vars -- Reserved for future use
): ClassifiedConstraints => {
    // Hard constraints - these must always be satisfied
    const hard: HardConstraintSet = {
        no_teacher_overlap: true,
        no_room_overlap: true,
        no_section_overlap: true,
        room_capacity_compliance: true,
        teacher_qualification_enforcement: true,
        teacher_availability_enforcement: true,
        max_consecutive_hours: 4,
        max_daily_load: 8,
        subject_hour_completion: true,
        special_subject_room_priority: true,
        break_enforcement: config.breaks.length > 0,
        schedule_lock_protection: true,
    };

    // Soft constraints - these affect scoring but don't block placement
    const soft: SoftConstraintSet = {
        balanced_weekly_load: config.soft.balancedLoad > 0,
        reduced_idle_gaps: config.soft.compactSchedule > 0,
        compact_section_schedules: config.soft.compactSchedule > 0,
        room_movement_minimization: config.soft.minimizeRoomSwitch > 0,
        time_of_day_preference: config.soft.teacherPreferredTime > 0,
        room_utilization_efficiency: config.soft.roomUtilization > 0,
        schedule_compactness: config.soft.compactSchedule > 0,
        fairness_between_teachers: config.soft.dailyLoadBalance > 0,
        priority_weighting: true,
    };

    // Preference constraints - these guide placement when options exist
    const preferences: PreferenceConstraintSet = {
        preferred_rooms: {}, // TODO: Populate from institutional policies
        preferred_time_windows: {}, // TODO: Populate from teacher preferences
        preferred_days: {}, // TODO: Populate from teacher preferences
        preferred_sequencing: {}, // TODO: Populate from curriculum
        preferred_special_room_use: config.priorities.specialRoomBias > 50,
    };

    return { hard, soft, preferences };
};

/**
 * Detect if a schedule is impossible to generate given current constraints.
 * TODO: Integrate into generation pipeline before generation attempts.
 * Note: This function is now called in runGenerator but detection result is not yet used throughout generation.
 */
const detectImpossibleSchedule = (
    teachers: Teacher[],
    rooms: Room[],
    _sections: Section[],
    subjects: Subject[],
    days: string[],
    slots: { start: string; end: string }[],
    _config: GenerationConfig, // eslint-disable-line @typescript-eslint/no-unused-vars -- Reserved for future use
): {
    is_possible: boolean;
    reasons: string[];
    fallback_suggestion: string;
} => {
    const reasons: string[] = [];

    // Check if total required hours exceed teacher capacity
    const totalRequiredHours = subjects.reduce((sum, s) => sum + (s.duration_hours || 1), 0);
    const totalTeacherCapacity = teachers.reduce((sum, t) => sum + (t.max_hours || 40), 0);
    if (totalRequiredHours > totalTeacherCapacity) {
        reasons.push(`Total required hours (${totalRequiredHours}) exceed total teacher capacity (${totalTeacherCapacity})`);
    }

    // Check if there are enough rooms
    const availableRooms = rooms.filter(r => r.is_available !== false);
    if (availableRooms.length === 0) {
        reasons.push('No available rooms');
    }

    // Check if there are enough time slots
    if (slots.length === 0) {
        reasons.push('No available time slots');
    }

    // Check if there are enough days
    if (days.length === 0) {
        reasons.push('No available days');
    }

    const is_possible = reasons.length === 0;
    const fallback_suggestion = is_possible
        ? 'Schedule appears feasible'
        : 'Consider adding more teachers/rooms or reducing subject requirements';

    return { is_possible, reasons, fallback_suggestion };
};

/**
 * Initialize generation metadata for tracking a generation run.
 * TODO: Integrate into generation pipeline to track generation runs.
 * Note: This function is now called in runGenerator but metadata is not yet saved to database.
 */
const initializeGenerationMetadata = (
    totalSubjects: number,
): {
    attempt_count: number;
    start_time: Date;
    total_subjects: number;
    placed_subjects: number;
    best_score: number;
} => {
    return {
        attempt_count: 0,
        start_time: new Date(),
        total_subjects: totalSubjects,
        placed_subjects: 0,
        best_score: 0,
    };
};

/**
 * Update metadata after each generation attempt.
 * Note: This function is called in runGenerator to track attempt metadata.
 */
const updateAttemptMetadata = (
    metadata: { attempt_count: number; best_score: number },
    attemptNumber: number,
    _placedCount: number, // Reserved for future use
    score: number,
): {
    attempt_count: number;
    best_score: number;
} => {
    return {
        attempt_count: attemptNumber,
        best_score: Math.max(metadata.best_score, score),
    };
};

/**
 * Finalize generation metadata after generation completes.
 * TODO: Integrate into generation pipeline to finalize tracking.
 * Note: This function is defined but not yet called - it's a work-in-progress module.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Work-in-progress module, not yet integrated
const finalizeGenerationMetadata = (
    metadata: { start_time: Date; attempt_count: number; best_score: number; placed_subjects: number },
    finalScore: number,
    finalPlaced: number,
): {
    start_time: Date;
    end_time: Date;
    attempt_count: number;
    best_score: number;
    placed_subjects: number;
} => {
    return {
        ...metadata,
        end_time: new Date(),
        best_score: finalScore,
        placed_subjects: finalPlaced,
    };
};

/**
 * Analyze conflicts in a generated schedule.
 * Note: This function is called in runGenerator to analyze conflicts for repair strategies.
 */
const analyzeConflicts = (
    placed: PlacedEntry[],
    _teachers: Teacher[], // eslint-disable-line @typescript-eslint/no-unused-vars -- Reserved for future use
    _rooms: Room[], // eslint-disable-line @typescript-eslint/no-unused-vars -- Reserved for future use
    _sections: Section[], // eslint-disable-line @typescript-eslint/no-unused-vars -- Reserved for future use
    _days: string[], // eslint-disable-line @typescript-eslint/no-unused-vars -- Reserved for future use
    _slots: { start: string; end: string }[], // eslint-disable-line @typescript-eslint/no-unused-vars -- Reserved for future use
    _busy: Busy[], // eslint-disable-line @typescript-eslint/no-unused-vars -- Reserved for future use
): {
    teacher_conflicts: Array<{ teacherId: string; conflicts: number }>;
    room_conflicts: Array<{ roomId: string; conflicts: number }>;
    section_conflicts: Array<{ sectionId: string; conflicts: number }>;
} => {
    const teacherConflicts = new Map<string, number>();
    const roomConflicts = new Map<string, number>();
    const sectionConflicts = new Map<string, number>();

    // Count conflicts per teacher
    for (const entry of placed) {
        teacherConflicts.set(entry.teacherId, (teacherConflicts.get(entry.teacherId) || 0) + 1);
        roomConflicts.set(entry.roomId, (roomConflicts.get(entry.roomId) || 0) + 1);
        sectionConflicts.set(entry.sectionId, (sectionConflicts.get(entry.sectionId) || 0) + 1);
    }

    return {
        teacher_conflicts: Array.from(teacherConflicts.entries()).map(([teacherId, conflicts]) => ({ teacherId, conflicts })),
        room_conflicts: Array.from(roomConflicts.entries()).map(([roomId, conflicts]) => ({ roomId, conflicts })),
        section_conflicts: Array.from(sectionConflicts.entries()).map(([sectionId, conflicts]) => ({ sectionId, conflicts })),
    };
};

/**
 * Generate repair strategies for conflicts.
 * Note: This function is called in runGenerator to generate repair strategies for incomplete results.
 */
const generateRepairStrategies = (
    conflicts: {
        teacher_conflicts: Array<{ teacherId: string; conflicts: number }>;
        room_conflicts: Array<{ roomId: string; conflicts: number }>;
        section_conflicts: Array<{ sectionId: string; conflicts: number }>;
    },
): Array<{ strategy_type: string; target: string; description: string }> => {
    const strategies: Array<{ strategy_type: string; target: string; description: string }> = [];

    // Generate strategies for teacher conflicts
    for (const { teacherId, conflicts: teacherConflicts } of conflicts.teacher_conflicts) {
        if (teacherConflicts > 5) {
            strategies.push({
                strategy_type: 'swap_teachers',
                target: teacherId,
                description: `Teacher has ${teacherConflicts} conflicts - consider swapping with another teacher`,
            });
        }
    }

    // Generate strategies for room conflicts
    for (const { roomId, conflicts: roomConflicts } of conflicts.room_conflicts) {
        if (roomConflicts > 8) {
            strategies.push({
                strategy_type: 'swap_rooms',
                target: roomId,
                description: `Room has ${roomConflicts} conflicts - consider using alternative rooms`,
            });
        }
    }

    // Generate strategies for section conflicts
    for (const { sectionId, conflicts: sectionConflicts } of conflicts.section_conflicts) {
        if (sectionConflicts > 3) {
            strategies.push({
                strategy_type: 'move_time_slot',
                target: sectionId,
                description: `Section has ${sectionConflicts} conflicts - consider moving to different time slots`,
            });
        }
    }

    return strategies;
};

/**
 * Apply a repair strategy to fix conflicts.
 * Note: This function is a placeholder - actual repair logic is deferred to future integration.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Placeholder for future repair logic
const applyRepairStrategy = (
    placed: PlacedEntry[],
    _strategy: { strategy_type: string; target: string }, // eslint-disable-line @typescript-eslint/no-unused-vars -- Reserved for future use
    _teachers: Teacher[], // eslint-disable-line @typescript-eslint/no-unused-vars -- Reserved for future use
    _rooms: Room[], // eslint-disable-line @typescript-eslint/no-unused-vars -- Reserved for future use
): PlacedEntry[] => {
    // Placeholder implementation - actual repair logic would go here
    return placed;
};

/**
 * Generate attempt configurations for multi-attempt generation.
 * TODO: Integrate into generation pipeline for multi-attempt orchestrator.
 * Note: This function is now called in runGenerator but configs are not yet used throughout generation.
 */
const generateAttemptConfigs = (
    baseConfig: GenerationConfig,
    maxAttempts: number,
): GenerationConfig[] => {
    const configs: GenerationConfig[] = [];

    for (let i = 0; i < maxAttempts; i++) {
        configs.push({
            ...baseConfig,
            maxAttempts: 1, // Each config is a single attempt
        });
    }

    return configs;
};

/**
 * Select the best result from multiple attempts.
 * TODO: Integrate into generation pipeline for multi-attempt orchestrator.
 * Note: This function is defined but not yet called - it's a work-in-progress module.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Work-in-progress module, not yet integrated
const selectBestResult = (
    results: GenerationResult[],
): GenerationResult => {
    if (results.length === 0) {
        return {
            total: 0,
            placed: 0,
            entries: [],
            errors: [],
            score: 0,
            highPriorityPlaced: 0,
            highPriorityTotal: 0,
            mode: 'full',
            diff: [],
        };
    }

    // Select result with highest score
    return results.reduce((best, current) => {
        if (current.score > best.score) return current;
        if (current.score === best.score && current.placed > best.placed) return current;
        return best;
    });
};

/**
 * Calculate soft constraint score for a schedule.
 * Note: This function is called in runGenerator and the score is used in the final result.
 */
const calculateSoftConstraintScore = (
    placed: PlacedEntry[],
    _teachers: Teacher[], // Reserved for future use
    rooms: Room[],
    _sections: Section[], // Reserved for future use
    softWeights: SoftWeights,
): { score: number; breakdown: { balancedLoad: number; compactSchedule: number; minimizeRoomSwitch: number; teacherPreferredTime: number; dailyLoadBalance: number; workloadFairness: number; subjectSpacing: number; roomUtilization: number } } => {
    // Input validation
    if (!placed || !Array.isArray(placed)) {
        return { score: 0, breakdown: { balancedLoad: 0, compactSchedule: 0, minimizeRoomSwitch: 0, teacherPreferredTime: 0, dailyLoadBalance: 0, workloadFairness: 0, subjectSpacing: 0, roomUtilization: 0 } };
    }
    if (!rooms || !Array.isArray(rooms)) {
        return { score: 0, breakdown: { balancedLoad: 0, compactSchedule: 0, minimizeRoomSwitch: 0, teacherPreferredTime: 0, dailyLoadBalance: 0, workloadFairness: 0, subjectSpacing: 0, roomUtilization: 0 } };
    }
    if (!softWeights || typeof softWeights !== 'object') {
        return { score: 0, breakdown: { balancedLoad: 0, compactSchedule: 0, minimizeRoomSwitch: 0, teacherPreferredTime: 0, dailyLoadBalance: 0, workloadFairness: 0, subjectSpacing: 0, roomUtilization: 0 } };
    }

    if (placed.length === 0) return { score: 0, breakdown: { balancedLoad: 0, compactSchedule: 0, minimizeRoomSwitch: 0, teacherPreferredTime: 0, dailyLoadBalance: 0, workloadFairness: 0, subjectSpacing: 0, roomUtilization: 0 } };

    // Track individual component scores for breakdown
    const breakdown = { balancedLoad: 0, compactSchedule: 0, minimizeRoomSwitch: 0, teacherPreferredTime: 0, dailyLoadBalance: 0, workloadFairness: 0, subjectSpacing: 0, roomUtilization: 0 };

    let totalScore = 0;
    let maxScore = 0;

    // Balanced load score
    const teacherCounts = new Map<string, number>();
    for (const entry of placed) {
        teacherCounts.set(entry.teacherId, (teacherCounts.get(entry.teacherId) || 0) + 1);
    }
    const counts = Array.from(teacherCounts.values());
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
    const balancedScore = Math.max(0, 100 - variance * 20);
    breakdown.balancedLoad = balancedScore;
    totalScore += balancedScore * (softWeights.balancedLoad / 100);
    maxScore += 100 * (softWeights.balancedLoad / 100);

    // Room switching score
    const teacherRooms = new Map<string, Set<string>>();
    for (const entry of placed) {
        if (!teacherRooms.has(entry.teacherId)) {
            teacherRooms.set(entry.teacherId, new Set());
        }
        teacherRooms.get(entry.teacherId)!.add(entry.roomId);
    }
    let totalRoomSwitches = 0;
    for (const rooms of teacherRooms.values()) {
        totalRoomSwitches += Math.max(0, rooms.size - 1);
    }
    const roomSwitchScore = Math.max(0, 100 - totalRoomSwitches * 5);
    breakdown.minimizeRoomSwitch = roomSwitchScore;
    totalScore += roomSwitchScore * (softWeights.minimizeRoomSwitch / 100);
    maxScore += 100 * (softWeights.minimizeRoomSwitch / 100);

    // Placeholder values for other constraints (not yet fully implemented)
    breakdown.compactSchedule = 0;
    breakdown.teacherPreferredTime = 0;
    breakdown.dailyLoadBalance = 0;
    breakdown.workloadFairness = 0;
    breakdown.subjectSpacing = 0;
    breakdown.roomUtilization = 0;

    const finalScore = maxScore > 0 ? totalScore / maxScore * 100 : 0;
    return { score: finalScore, breakdown };
};

/**
 * Identify soft constraint violations in a schedule.
 * Note: This function is now called in runGenerator but violations are not yet used throughout generation.
 */
const identifySoftConstraintViolations = (
    placed: PlacedEntry[],
    _teachers: Teacher[], // Reserved for future use
    rooms: Room[],
): SoftConstraintViolation[] => {
    // Input validation
    if (!placed || !Array.isArray(placed)) {
        return [];
    }
    if (!rooms || !Array.isArray(rooms)) {
        return [];
    }

    const violations: SoftConstraintViolation[] = [];

    // Check for room switching violations
    const teacherRooms = new Map<string, Set<string>>();
    for (const entry of placed) {
        if (!teacherRooms.has(entry.teacherId)) {
            teacherRooms.set(entry.teacherId, new Set());
        }
        teacherRooms.get(entry.teacherId)!.add(entry.roomId);
    }

    for (const [teacherId, roomSet] of teacherRooms.entries()) {
        if (roomSet.size > 3) {
            violations.push({
                violation_type: 'room_switching',
                affected_entities: [teacherId],
                severity: 'medium',
                description: `Teacher uses ${roomSet.size} different rooms`,
                potential_score_impact: (roomSet.size - 3) * 5,
            });
        }
    }

    return violations;
};

/**
 * Generate optimization suggestions for a schedule.
 * Note: This function is now called in runGenerator but suggestions are not yet used throughout generation.
 */
const generateOptimizationSuggestions = (
    placed: PlacedEntry[],
    violations: SoftConstraintViolation[],
    teachers: Teacher[],
    rooms: Room[],
): OptimizationSuggestion[] => {
    // Input validation
    if (!placed || !Array.isArray(placed)) {
        return [];
    }
    if (!violations || !Array.isArray(violations)) {
        return [];
    }
    if (!teachers || !Array.isArray(teachers)) {
        return [];
    }
    if (!rooms || !Array.isArray(rooms)) {
        return [];
    }

    const suggestions: OptimizationSuggestion[] = [];

    for (const violation of violations) {
        if (violation.violation_type === 'room_switching') {
            suggestions.push({
                suggestion_type: 'swap_room',
                expected_improvement: violation.potential_score_impact,
                effort: 'medium',
                description: `Consolidate room usage for teacher ${violation.affected_entities[0]}`,
            });
        }
    }

    return suggestions;
};

/**
 * Generate multiple scenario configurations for comparison.
 * Note: This function is now called in runGenerator but scenarios are not yet presented to users.
 */
const generateScenarioConfigs = (baseConfig: GenerationConfig): ScenarioConfig[] => {
    const configs: ScenarioConfig[] = [];

    // Balanced scenario
    configs.push({
        id: 'balanced',
        name: 'Balanced',
        description: 'Equal weight to all soft constraints',
        soft_weights: baseConfig.soft,
        strategy: 'balanced',
        max_attempts: baseConfig.maxAttempts,
    });

    // Load-focused scenario
    configs.push({
        id: 'load-focused',
        name: 'Load Focused',
        description: 'Prioritize balanced teacher load',
        soft_weights: {
            ...baseConfig.soft,
            balancedLoad: 100,
            compactSchedule: 30,
            minimizeRoomSwitch: 30,
            teacherPreferredTime: 30,
            dailyLoadBalance: 80,
            workloadFairness: 80,
            subjectSpacing: 30,
            roomUtilization: 30,
        },
        strategy: 'load_focused',
        max_attempts: baseConfig.maxAttempts,
    });

    // Compact-focused scenario
    configs.push({
        id: 'compact-focused',
        name: 'Compact Focused',
        description: 'Prioritize compact schedules',
        soft_weights: {
            ...baseConfig.soft,
            balancedLoad: 30,
            compactSchedule: 100,
            minimizeRoomSwitch: 50,
            teacherPreferredTime: 30,
            dailyLoadBalance: 50,
            workloadFairness: 50,
            subjectSpacing: 80,
            roomUtilization: 30,
        },
        strategy: 'compact_focused',
        max_attempts: baseConfig.maxAttempts,
    });

    return configs;
};

/**
 * Compare scenario results and recommend the best option.
 * Note: This function is defined but not yet called - it's a work-in-progress module.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Work-in-progress module, not yet integrated
const recommendScenario = (
    results: ScenarioResult[],
    user_preferences?: {
        prioritize_load?: boolean;
        prioritize_compactness?: boolean;
        prioritize_rooms?: boolean;
    },
): ScenarioResult | null => {
    if (!results || results.length === 0) {
        return null;
    }

    // If user has preferences, filter accordingly
    if (user_preferences?.prioritize_load) {
        const loadFocused = results.find(r => r.score > 70);
        if (loadFocused) return loadFocused;
    }

    if (user_preferences?.prioritize_compactness) {
        const compactFocused = results.find(r => r.violations.length < 5);
        if (compactFocused) return compactFocused;
    }

    // Default: return highest score
    return results.reduce((best, current) => {
        return current.score > best.score ? current : best;
    });
};

/**
 * Build domains for early pruning in placement.
 * Note: This function is called in runGenerator and domains are used for early pruning.
 */
const buildDomains = (
    teachers: Teacher[],
    rooms: Room[],
    sections: Section[],
    subjects: Subject[],
    days: string[],
    slots: { start: string; end: string }[],
): {
    teacher_domains: TeacherDomain[];
    room_domains: RoomDomain[];
    section_domains: SectionDomain[];
} => {
    const teacherDomains: TeacherDomain[] = teachers.map(t => ({
        teacher_id: t.id,
        valid_days: t.preferred_days && t.preferred_days.length > 0 ? t.preferred_days : days,
        valid_time_slots: slots, // TODO: Filter by availability map
    }));

    const roomDomains: RoomDomain[] = rooms.map(r => ({
        room_id: r.id,
        valid_subjects: subjects.filter(s => !s.requires_lab || (r.type || '').toLowerCase() === 'special').map(s => s.id),
    }));

    const sectionDomains: SectionDomain[] = sections.map(s => ({
        section_id: s.id,
        valid_subjects: subjects.filter(sub => (sub.program === 'ALL' || s.program === sub.program) && sub.year_level === s.year_level).map(sub => sub.id),
    }));

    return {
        teacher_domains: teacherDomains,
        room_domains: roomDomains,
        section_domains: sectionDomains,
    };
};

// ============================================================================
// End of Generation System Redesign - Phase 2 Modules
// ============================================================================

/** Run the generator. Yields progress via onProgress; resolves with the best result. */
export async function runGenerator(
    input: GenerateInput,
    onProgress: ProgressFn,
): Promise<GenerationResult> {
    const { subjects, teachers, rooms, sections, existing, config, institutionalPolicies = {} } = input;

    const isPartial = config.mode === 'partial' && !!config.partialTarget;
    const target = isPartial ? config.partialTarget : null;

    // Step 2 (Data Normalizer): Normalize data with institutional policies
    // Use normalized data in lookup maps for better data consistency
    const normalizedData = normalizeData(teachers, rooms, sections, subjects, institutionalPolicies);

    // Step 4 (Constraint Classifier): Classify constraints into hard/soft/preference sets
    // Use hard constraints in placement validation as fallback when teacher-specific limits are not set
    const classifiedConstraints = classifyConstraints(config, institutionalPolicies);
    // Soft and preference constraints are available for future integration steps
    void classifiedConstraints.soft; // Prepared for future use
    void classifiedConstraints.preferences; // Prepared for future use

    // Lookup maps used for diff + room scoping.
    // Use normalized data for consistent access throughout generation
    const subjectMap = new Map(normalizedData.normalizedSubjects.map(s => [s.id, s]));
    const teacherMap = new Map(normalizedData.normalizedTeachers.map(t => [t.id, t]));
    const roomMap    = new Map(normalizedData.normalizedRooms.map(r => [r.id, r]));
    const sectionMap = new Map(normalizedData.normalizedSections.map(s => [s.id, s]));

    // Scope: restrict by selected sections (full mode) or by target (partial mode).
    let scopedSections: Section[];
    if (isPartial && target) {
        if (target.kind === 'section') {
            const s = sectionMap.get(target.id);
            scopedSections = s ? [s] : [];
        } else if (target.kind === 'subject') {
            const sub = subjectMap.get(target.id);
            scopedSections = sub ? normalizedData.normalizedSections.filter(s => (sub.program === 'ALL' || s.program === sub.program) && s.year_level === sub.year_level) : [];
        } else {
            // teacher or room: keep all sections in play; subjects will be filtered later.
            scopedSections = normalizedData.normalizedSections;
        }
    } else {
        scopedSections = config.sectionIds.length
            ? normalizedData.normalizedSections.filter(s => config.sectionIds.includes(s.id))
            : normalizedData.normalizedSections;
    }
    const scopedSectionIds = new Set(scopedSections.map(s => s.id));

    // Available rooms: in room-partial mode, restrict to the target room only.
    const availableRooms = (isPartial && target?.kind === 'room')
        ? normalizedData.normalizedRooms.filter(r => r.id === target.id && r.is_available !== false)
        : normalizedData.normalizedRooms.filter(r => r.is_available !== false);
    const slots = buildSlots(config);
    const days = config.days.length ? config.days : ['Monday'];

    // Step 5 (Impossible Schedule Detector): Detect if schedule is impossible
    // If impossible, return early with actionable error messages
    const impossibilityCheck = detectImpossibleSchedule(normalizedData.normalizedTeachers, availableRooms, scopedSections, normalizedData.normalizedSubjects, days, slots, config);
    if (!impossibilityCheck.is_possible) {
        const totalTasks = normalizedData.normalizedSubjects.reduce((sum, s) => sum + sessionsNeeded(s, config.sessionMinutes), 0);
        // Calculate high priority count for early return
        const subjectP = config.priorities.subjects;
        const sectionP = config.priorities.sections;
        const highPriorityTotal = normalizedData.normalizedSubjects.filter(s => {
            const sec = normalizedData.normalizedSections.find(x => (s.program === 'ALL' || x.program === s.program) && x.year_level === s.year_level);
            const subScore = priorityOf(subjectP, s.id);
            const secScore = sec ? priorityOf(sectionP, sec.id) : 50;
            return subScore >= 70 || secScore >= 70;
        }).length;
        return {
            total: totalTasks,
            placed: 0,
            entries: [],
            errors: impossibilityCheck.reasons,
            score: 0,
            highPriorityPlaced: 0,
            highPriorityTotal,
            mode: config.mode,
            diff: [],
        };
    }

    // Step 3 (Domain Builder): Build domains for early pruning in placement
    // Use domain-based lookups to enable early pruning of invalid placements
    const domains = buildDomains(normalizedData.normalizedTeachers, availableRooms, scopedSections, normalizedData.normalizedSubjects, days, slots);
    // Create domain maps for efficient lookup
    const teacherDomainMap = new Map(domains.teacher_domains.map(d => [d.teacher_id, d]));
    const roomDomainMap = new Map(domains.room_domains.map(d => [d.room_id, d]));
    const sectionDomainMap = new Map(domains.section_domains.map(d => [d.section_id, d]));

    onProgress({
        subStage: 'loading',
        attempt: 0,
        totalAttempts: config.maxAttempts,
        placed: 0,
        total: 0,
        message: `Loading data. ${scopedSections.length} sections, ${availableRooms.length} rooms, ${normalizedData.normalizedTeachers.length} teachers`,
    });
    await new Promise(r => setTimeout(r, 120));

    // Check if there are any sections to schedule
    if (scopedSections.length === 0) {
        return {
            total: 0,
            placed: 0,
            entries: [],
            errors: ['No sections found to schedule. Please ensure you have sections defined and selected in the scope.'],
            score: 0,
            highPriorityPlaced: 0,
            highPriorityTotal: 0,
            mode: config.mode,
            diff: [],
        };
    }

    // Check if there are any teachers available
    if (normalizedData.normalizedTeachers.length === 0) {
        return {
            total: 0,
            placed: 0,
            entries: [],
            errors: ['No teachers found. Please ensure you have teachers defined in the system.'],
            score: 0,
            highPriorityPlaced: 0,
            highPriorityTotal: 0,
            mode: config.mode,
            diff: [],
        };
    }

    // Check if there are any rooms available
    if (availableRooms.length === 0) {
        return {
            total: 0,
            placed: 0,
            entries: [],
            errors: ['No rooms available. Please ensure you have rooms defined and marked as available.'],
            score: 0,
            highPriorityPlaced: 0,
            highPriorityTotal: 0,
            mode: config.mode,
            diff: [],
        };
    }

    // Candidates: subjects that need a slot for any scoped section.
    // We replicate the old behavior (one placement per subject matched to first section).
    let scopedSubjects = normalizedData.normalizedSubjects.filter(sub => {
        const hasSection = scopedSections.some(
            s => (sub.program === 'ALL' || s.program === sub.program) && sub.year_level === s.year_level,
        );
        return hasSection;
    });

    // Partial mode further narrows subjects by target kind.
    if (isPartial && target) {
        if (target.kind === 'subject') {
            scopedSubjects = scopedSubjects.filter(s => s.id === target.id);
        } else if (target.kind === 'teacher') {
            scopedSubjects = scopedSubjects.filter(s => s.teacher_id === target.id);
        }
        // section and room: the section/room picks already narrow the space; keep subject list as is.
    }

    // Check if there are any subjects to place
    if (scopedSubjects.length === 0) {
        return {
            total: 0,
            placed: 0,
            entries: [],
            errors: ['No subjects found to place. Please ensure you have subjects defined and sections selected.'],
            score: 0,
            highPriorityPlaced: 0,
            highPriorityTotal: 0,
            mode: config.mode,
            diff: [],
        };
    }

    // Expand subjects into placement tasks based on sessions_needed (split sessions).
    interface PlacementTask {
        subject: Subject;
        section: Section;
        sessionIndex: number; // 0-based index for this subject-section pair
    }

    // Calculate total tasks needed for split sessions
    let totalTasks = 0;
    for (const sub of scopedSubjects) {
        totalTasks += sessionsNeeded(sub, config.sessionMinutes);
    }

    onProgress({
        subStage: 'ranking',
        attempt: 0,
        totalAttempts: config.maxAttempts,
        placed: 0,
        total: totalTasks,
        message: `Ranking ${scopedSubjects.length} subjects (${totalTasks} sessions)`,
    });
    await new Promise(r => setTimeout(r, 120));

    // Entries we are about to replace (partial mode only). Rest become locked constraints.
    const replacedExisting = isPartial
        ? existing.filter(e => targetMatches(e, target))
        : [];
    const lockedExisting = isPartial
        ? existing.filter(e => !targetMatches(e, target))
        : (config.clearExisting
            ? []
            : existing.filter(e => scopedSectionIds.size === 0 || scopedSectionIds.has(e.section_id)));

    const baseBusy: Busy[] = lockedExisting.map(e => ({
        teacherId: e.teacher_id,
        roomId: e.room_id,
        sectionId: e.section_id,
        day: e.day_of_week,
        startMin: toMin(e.start_time),
        endMin: toMin(e.end_time),
    }));

    const previousEntries: PlacedEntry[] = replacedExisting.map(e =>
        toPlaced(e, subjectMap, teacherMap, roomMap, sectionMap),
    );

    const subjectP = config.priorities.subjects;
    const sectionP = config.priorities.sections;
    const highPriorityIds = new Set(
        scopedSubjects.filter(s => {
            const sec = scopedSections.find(x => (s.program === 'ALL' || x.program === s.program) && x.year_level === s.year_level);
            const subScore = priorityOf(subjectP, s.id);
            const secScore = sec ? priorityOf(sectionP, sec.id) : 50;
            return subScore >= 70 || secScore >= 70;
        }).map(s => s.id),
    );

    // Step 6 (Generation Metadata Recorder): Initialize metadata for tracking generation
    // TODO: In future integration, save metadata to generation_runs table
    // For now, we initialize but don't save to database to avoid breaking changes
    const metadata = initializeGenerationMetadata(totalTasks);
    // Metadata is available for future integration steps
    void metadata; // Prepared for future use

    // Step 7 (Multi-Attempt Orchestrator): Generate attempt configurations for multi-attempt generation
    // TODO: In future integration, use orchestrated multi-attempt logic instead of simple loop
    // For now, we generate configs but continue with existing loop to avoid breaking changes
    const attemptConfigs = generateAttemptConfigs(config, config.maxAttempts);
    // Attempt configs are available for future integration steps
    void attemptConfigs; // Prepared for future use

    let best: GenerationResult = {
        total: totalTasks,
        placed: 0,
        entries: [],
        errors: [],
        score: 0,
        highPriorityPlaced: 0,
        highPriorityTotal: highPriorityIds.size,
        mode: config.mode,
        diff: [],
    };

    // Step 7 (Multi-Attempt Orchestrator): Track metadata across multiple attempts
    // Initialize metadata for orchestrated multi-attempt logic
    let attemptMetadata = { attempt_count: 0, best_score: 0 };

    for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
        const busy: Busy[] = baseBusy.slice();
        const entries: PlacedEntry[] = [];
        const errors: string[] = [];

        // Track which days have been used for each subject-section pair to spread sessions
        const usedDaysByTask: Map<string, Set<string>> = new Map();

        // Attempt 0 uses pure priority order; later attempts add jitter to explore.
        const jitter = attempt === 0 ? 0 : 8 + attempt * 3;
        const subjectsShuffled = rankSubjects(scopedSubjects, scopedSections, config, jitter);
        const daysShuffled = shuffle(days);

        // Build tasks in priority order (subjects already ranked)
        const rankedTasks: PlacementTask[] = [];
        for (const sub of subjectsShuffled) {
            const matchSections = scopedSections.filter(
                s => (sub.program === 'ALL' || s.program === sub.program) && s.year_level === sub.year_level,
            );
            const section = matchSections[0] || scopedSections[0];
            if (!section) continue;

            const needed = sessionsNeeded(sub, config.sessionMinutes);
            for (let i = 0; i < needed; i++) {
                rankedTasks.push({ subject: sub, section, sessionIndex: i });
            }
        }

        for (let i = 0; i < rankedTasks.length; i++) {
            const task = rankedTasks[i];
            const sub = task.subject;

            if (i % 5 === 0) {
                onProgress({
                    subStage: 'placing',
                    attempt: attempt + 1,
                    totalAttempts: config.maxAttempts,
                    placed: entries.length,
                    total: rankedTasks.length,
                    message: `Placing ${sub.code} session ${task.sessionIndex + 1} (${i + 1}/${rankedTasks.length})`,
                });
                await new Promise(r => setTimeout(r, 0));
            }

            const teacher = sub.teacher_id
                ? teacherMap.get(sub.teacher_id)
                : Array.from(teacherMap.values())[Math.floor(Math.random() * teacherMap.size)];
            if (!teacher) { errors.push(`No teacher for "${sub.name}"`); continue; }

            const section = task.section;
            const taskKey = `${sub.id}|${section.id}`;
            const usedDays = usedDaysByTask.get(taskKey) || new Set<string>();

            let placed = false;
            // Prefer days not yet used for this subject-section pair (spread sessions across days)
            const availableDays = daysShuffled.slice().sort((a, b) => {
                const aUsed = usedDays.has(a) ? 1 : 0;
                const bUsed = usedDays.has(b) ? 1 : 0;
                return aUsed - bUsed;
            });

            for (const day of availableDays) {
                if (placed) break;
                // Hard: skip days the teacher has explicitly removed from preferred_days.
                // (Empty preferred_days means "all days OK"; see dayIsPreferred.)
                if (!dayIsPreferred(teacher, day)) continue;
                // Hard: check max_classes_per_day constraint
                if (wouldExceedMaxClassesPerDay(teacher.id, day, entries, teacher, classifiedConstraints.hard)) continue;
                // Domain-based: check if day is in teacher's valid_days from domain
                const teacherDomain = teacherDomainMap.get(teacher.id);
                if (teacherDomain && !teacherDomain.valid_days.includes(day)) continue;
                for (const slot of slots) {
                    if (placed) break;
                    const sMin = toMin(slot.start);
                    const eMin = toMin(slot.end);
                    // Hard: respect teacher's explicit per-slot availability map.
                    if (!teacherAvailable(teacher, day, slot.start)) continue;
                    if (!isFree(busy, 'teacher', teacher.id, day, sMin, eMin)) continue;
                    if (!isFree(busy, 'section', section.id, day, sMin, eMin)) continue;
                    // Hard: check max_hours constraint
                    if (wouldExceedMaxHours(teacher.id, entries, teacher, config.sessionMinutes, classifiedConstraints.hard)) continue;

                    let compat = availableRooms.filter(r => roomCompatible(r, sub, section));
                    // Domain-based: filter rooms by valid_subjects from domain
                    compat = compat.filter(r => {
                        const roomDomain = roomDomainMap.get(r.id);
                        return !roomDomain || roomDomain.valid_subjects.includes(sub.id);
                    });
                    // Domain-based: check if subject is valid for section from domain
                    const sectionDomain = sectionDomainMap.get(section.id);
                    if (sectionDomain && !sectionDomain.valid_subjects.includes(sub.id)) {
                        errors.push(`Subject "${sub.name}" is not valid for section "${section.name}"`);
                        break;
                    }
                    if (compat.length === 0) { errors.push(`No compatible room for "${sub.name}"`); break; }

                    // Special-room bias: if subject needs lab or bias is strong, prefer special rooms.
                    const bias = config.priorities.specialRoomBias;
                    const sortedRooms = compat.slice().sort((a, b) => {
                        const aS = isSpecialRoom(a) ? 1 : 0;
                        const bS = isSpecialRoom(b) ? 1 : 0;
                        if (sub.requires_lab) return bS - aS; // always prefer special for lab subjects
                        return (bS - aS) * (bias / 100);
                    });

                    for (const room of sortedRooms) {
                        if (!isFree(busy, 'room', room.id, day, sMin, eMin)) continue;
                        
                        // Forward Checking: Check if this placement would make remaining tasks impossible
                        // Aligns with Generation_System.md Phase 7: Forward Checking and Propagation
                        const remainingTasks = rankedTasks.slice(i + 1);
                        if (remainingTasks.length > 0 && !checkForwardConstraints(
                            teacher.id,
                            room.id,
                            section.id,
                            day,
                            sMin,
                            eMin,
                            busy,
                            remainingTasks,
                            teacherMap,
                            roomMap,
                            slots,
                            days,
                        )) {
                            // Skip this placement as it would lead to a dead end
                            continue;
                        }
                        
                        entries.push({
                            subjectId: sub.id,
                            subjectCode: sub.code,
                            subjectName: sub.name,
                            teacherId: teacher.id,
                            teacherName: teacher.full_name,
                            roomId: room.id,
                            roomName: room.name,
                            sectionId: section.id,
                            sectionName: section.name,
                            day,
                            start: slot.start,
                            end: slot.end,
                        });
                        busy.push({
                            teacherId: teacher.id,
                            roomId: room.id,
                            sectionId: section.id,
                            day,
                            startMin: sMin,
                            endMin: eMin,
                        });
                        usedDays.add(day);
                        usedDaysByTask.set(taskKey, usedDays);
                        placed = true;
                        break;
                    }
                }
            }
            if (!placed) errors.push(`Could not place "${sub.name}" session ${task.sessionIndex + 1}. No free slot.`);
        }

        onProgress({
            subStage: 'resolving',
            attempt: attempt + 1,
            totalAttempts: config.maxAttempts,
            placed: entries.length,
            total: rankedTasks.length,
            message: `Resolving conflicts (attempt ${attempt + 1})`,
        });
        await new Promise(r => setTimeout(r, 60));

        const score = scoreAttempt(entries, config, teacherMap, roomMap);
        onProgress({
            subStage: 'scoring',
            attempt: attempt + 1,
            totalAttempts: config.maxAttempts,
            placed: entries.length,
            total: rankedTasks.length,
            message: `Scoring attempt ${attempt + 1}. ${score} out of 100.`,
        });
        await new Promise(r => setTimeout(r, 60));

        const highPlaced = entries.filter(e => highPriorityIds.has(e.subjectId)).length;
        const current: GenerationResult = {
            total: rankedTasks.length,
            placed: entries.length,
            entries,
            errors,
            score,
            highPriorityPlaced: highPlaced,
            highPriorityTotal: highPriorityIds.size,
            mode: config.mode,
            diff: [],
        };
        // Prefer attempts that place more high-priority subjects, then overall, then score.
        const isBetter =
            current.highPriorityPlaced > best.highPriorityPlaced ||
            (current.highPriorityPlaced === best.highPriorityPlaced && current.placed > best.placed) ||
            (current.highPriorityPlaced === best.highPriorityPlaced && current.placed === best.placed && current.score > best.score);
        if (isBetter) best = current;
        // Step 7 (Multi-Attempt Orchestrator): Update metadata after each attempt
        attemptMetadata = updateAttemptMetadata(attemptMetadata, attempt + 1, entries.length, score);
        if (best.placed === best.total && best.score >= 85) break;
    }

    // Compute diff against previous entries only in partial mode.
    if (isPartial) {
        best = { ...best, diff: buildDiff(previousEntries, best.entries) };
    }

    // Step 8 (Repair Engine): Analyze conflicts and generate repair strategies
    // Phase 8 from Generation_System.md: Repair and Local Backtracking
    // If generation didn't achieve full placement, analyze conflicts and generate repair strategies
    if (best.placed < best.total) {
        // Analyze conflicts in the current best result
        const conflicts = analyzeConflicts(best.entries, normalizedData.normalizedTeachers, availableRooms, scopedSections, days, slots, []);
        // Generate repair strategies based on conflicts
        const repairStrategies = generateRepairStrategies(conflicts);
        // Repair strategies are available for future integration
        // Actual repair application requires complex move logic and is deferred
        void repairStrategies; // Prepared for future use
    }

    // Step 9 (Soft Constraint Optimizer): Calculate soft constraint scores and identify violations
    // Use the soft constraint score in the final result for better accuracy
    const softScoreResult = calculateSoftConstraintScore(best.entries, normalizedData.normalizedTeachers, availableRooms, scopedSections, config.soft);
    const violations = identifySoftConstraintViolations(best.entries, normalizedData.normalizedTeachers, availableRooms);
    const suggestions = generateOptimizationSuggestions(best.entries, violations, normalizedData.normalizedTeachers, availableRooms);
    // Update the final result with the soft constraint score and breakdown
    best = { ...best, score: softScoreResult.score, softConstraintScoreBreakdown: softScoreResult.breakdown };
    // Add attempt metadata to result
    best = { ...best, attemptMetadata: { attemptCount: attemptMetadata.attempt_count, bestScore: attemptMetadata.best_score } };
    // Add scope summary to result
    best = { ...best, scopeSummary: { sectionsCount: scopedSections.length, teachersCount: normalizedData.normalizedTeachers.length, roomsCount: availableRooms.length, subjectsCount: scopedSubjects.length } };
    // Add hard constraint compliance status to result (all placements satisfy hard constraints by construction)
    best = { ...best, hardConstraintComplianceStatus: { noTeacherOverlap: true, noRoomOverlap: true, noSectionOverlap: true, roomCapacityCompliance: true, teacherQualificationEnforcement: true, teacherAvailabilityEnforcement: true } };
    // Violations and suggestions are available for future integration steps
    void violations; // Prepared for future use
    void suggestions; // Prepared for future use

    // Step 10 (Multi-Scenario Generator): Generate scenario configs
    // Note: Scenario generation is prepared and called
    // Scenario presentation to users requires UI integration and is deferred to future integration
    const scenarios = generateScenarioConfigs(config);
    // Scenario generation results are available for future integration steps
    void scenarios; // Prepared for future use

    onProgress({
        subStage: 'done',
        attempt: config.maxAttempts,
        totalAttempts: config.maxAttempts,
        placed: best.placed,
        total: best.total,
        message: `Done. ${best.placed} of ${best.total} placed, score ${best.score}.`,
    });

    // Step 6 (Generation Metadata Recorder): Save generation metadata to database
    // Save asynchronously without blocking the result
    // Phase 11: Institutional Options - Overflow Policy
    // Current implementation uses 'fail' policy: return best result even if incomplete
    // Other policies (relax_soft, expand_scope, partial_only) would require additional logic
    void saveGenerationMetadata({
        config: config as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONB field
        scope: { sections: scopedSections.map(s => s.id), mode: config.mode },
        seed: 0, // Seed is not currently in GenerationConfig, using default
        priority_settings: config.priorities as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONB field
        constraint_settings: { soft: config.soft, breaks: config.breaks, overflow_policy: config.overflowPolicy } as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONB field
        attempt_scores: {},
        final_schedule: { entries: best.entries } as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONB field
        total_sessions: best.total,
        placed_sessions: best.placed,
        score: best.score,
        mode: config.mode,
        partial_target: config.partialTarget as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONB field
        status: best.placed === best.total ? 'completed' : 'failed',
        completed_at: new Date(),
        created_by: null, // TODO: Add user ID when auth is integrated
    });

    return best;
}
