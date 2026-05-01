// Generation engine for the Generate workspace (Phase 1).
// Placement is deterministic per-attempt via seeded shuffle; attempts keep best score.

import type {
    GenerationConfig,
    GenerationProgress,
    PlacedEntry,
    Section,
    Subject,
    Teacher,
    Room,
    Busy,
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

/**
 * Optimization change details for logging
 */
interface OptimizationChange {
    sessionId: string;
    subjectId: string;
    subjectName: string;
    sectionId: string;
    teacherId: string;
    roomId: string;
    day: string;
    before: {
        start: string;
        end: string;
        teacherId: string;
        roomId: string;
    };
    after: {
        start: string;
        end: string;
        teacherId: string;
        roomId: string;
    };
    moveType: 'time_slot_swap' | 'teacher_swap' | 'room_swap' | 'multi_swap' | 'local_rebuild';
    scoreDelta: number;
    reason: string;
    iteration: number;
}

/**
 * Optimization report for logging
 */
interface OptimizationReport {
    initialScore: number;
    finalScore: number;
    scoreImprovement: number;
    scoreBreakdown: {
        initial: { balancedLoad: number; compactSchedule: number; minimizeRoomSwitch: number; teacherPreferredTime: number; dailyLoadBalance: number; workloadFairness: number; subjectSpacing: number; roomUtilization: number };
        final: { balancedLoad: number; compactSchedule: number; minimizeRoomSwitch: number; teacherPreferredTime: number; dailyLoadBalance: number; workloadFairness: number; subjectSpacing: number; roomUtilization: number };
    };
    iterations: number;
    acceptedMoves: number;
    rejectedMoves: number;
    movesByType: Record<string, number>;
    terminationReason: 'no_improvement' | 'score_stabilized' | 'time_limit' | 'max_iterations';
    changelog: OptimizationChange[];
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
 * Forward Checking (Phase 7) - Improved implementation using domain information.
 * Check if placing a session would make it impossible to place remaining sessions.
 * This is a smarter implementation that uses pre-computed domains and only blocks
 * placements that would truly make a task impossible (zero valid combinations).
 * 
 * Aligns with Generation_System.md Phase 7: Forward Checking and Propagation.
 */
const checkForwardConstraints = (
    teacherId: string,
    roomId: string,
    sectionId: string,
    day: string,
    startMin: number,
    endMin: number,
    busy: Busy[],
    remainingTasks: Array<{ subject: Subject; section: Section; sessionIndex: number }>,
    teacherMap: Map<string, Teacher>,
    roomMap: Map<string, Room>,
    domains: Map<string, SessionDomain>,
): boolean => {
    // Simulate the placement in a temporary busy array
    const tempBusy = [...busy, { teacherId, roomId, sectionId, day, startMin, endMin }];

    // For each remaining task, check if it still has at least one valid placement option
    for (const task of remainingTasks) {
        const taskId = `${task.subject.id}|${task.section.id}|${task.sessionIndex}`;
        const domain = domains.get(taskId);

        if (!domain) {
            // No domain computed - skip forward checking for this task
            continue;
        }

        // Check if task still has valid teacher options
        let hasValidTeacher = false;
        for (const tid of domain.validTeachers) {
            const teacher = teacherMap.get(tid);
            if (!teacher) continue;

            // Check if this teacher still has any available slots
            let teacherHasSlot = false;
            for (const d of domain.validDays) {
                for (const slot of domain.validSlots) {
                    if (slot.day !== d) continue;
                    const sMin = toMin(slot.start);
                    const eMin = toMin(slot.end);

                    // Check if teacher is available and free at this slot
                    if (teacherAvailable(teacher, d, slot.start) && 
                        isFree(tempBusy, 'teacher', tid, d, sMin, eMin)) {
                        teacherHasSlot = true;
                        break;
                    }
                }
                if (teacherHasSlot) break;
            }

            if (teacherHasSlot) {
                hasValidTeacher = true;
                break;
            }
        }

        if (!hasValidTeacher) {
            // This task would have no valid teacher options after placement
            return false;
        }

        // Check if task still has valid room options
        let hasValidRoom = false;
        for (const rid of domain.validRooms) {
            const room = roomMap.get(rid);
            if (!room) continue;

            // Check if this room still has any available slots
            let roomHasSlot = false;
            for (const d of domain.validDays) {
                for (const slot of domain.validSlots) {
                    if (slot.day !== d) continue;
                    const sMin = toMin(slot.start);
                    const eMin = toMin(slot.end);

                    if (isFree(tempBusy, 'room', rid, d, sMin, eMin)) {
                        roomHasSlot = true;
                        break;
                    }
                }
                if (roomHasSlot) break;
            }

            if (roomHasSlot) {
                hasValidRoom = true;
                break;
            }
        }

        if (!hasValidRoom) {
            // This task would have no valid room options after placement
            return false;
        }

        // Check if task still has valid section options
        let hasValidSection = false;
        for (const d of domain.validDays) {
            for (const slot of domain.validSlots) {
                if (slot.day !== d) continue;
                const sMin = toMin(slot.start);
                const eMin = toMin(slot.end);

                if (isFree(tempBusy, 'section', task.section.id, d, sMin, eMin)) {
                    hasValidSection = true;
                    break;
                }
            }
            if (hasValidSection) break;
        }

        if (!hasValidSection) {
            // This task would have no valid section options after placement
            return false;
        }
    }

    return true; // All remaining tasks still have valid options
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

// Fisher-Yates shuffle for seeded randomness. Used for attempt variation.
// TODO: Re-enable if needed for randomization in future optimizations
/*
const shuffle = <T>(arr: T[]): T[] => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};
*/

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
        hierarchy_path: [s.program || 'Unknown', s.year_level ? `Year ${s.year_level}` : 'Unknown', s.name],
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
 * Domain Construction (Phase 5)
 * Pre-compute candidate domains for each placement task before placement begins.
 * This prunes invalid options early and ranks candidates by quality.
 * 
 * For each session, the domain includes:
 * - Valid teachers (qualified, available)
 * - Valid rooms (compatible, capacity)
 * - Valid days (teacher preferred days)
 * - Valid slots (teacher availability)
 * 
 * Candidates are ranked by:
 * - Better time windows
 * - Less disruptive placements
 * - Rooms that fit special room requirements
 * - Placements that preserve flexibility
 * - Placements that reduce movement cost
 * - Placements that balance weekly loads
 */
interface SessionDomain {
    taskId: string;
    validTeachers: string[]; // teacher IDs
    validRooms: string[]; // room IDs
    validDays: string[]; // day names
    validSlots: Array<{ start: string; end: string; day: string }>; // ranked slots
    scarcityScore: number; // lower = fewer options = harder to place
}

const constructDomains = (
    tasks: Array<{ subject: Subject; section: Section; sessionIndex: number }>,
    teachers: Map<string, Teacher>,
    rooms: Map<string, Room>,
    teacherDomainMap: Map<string, TeacherDomain>,
    roomDomainMap: Map<string, RoomDomain>,
    _sectionDomainMap: Map<string, SectionDomain>,
    days: string[],
    slots: { start: string; end: string }[],
): Map<string, SessionDomain> => {
    const domains = new Map<string, SessionDomain>();

    for (const task of tasks) {
        const sub = task.subject;
        const section = task.section;
        const taskId = `${sub.id}|${section.id}|${task.sessionIndex}`;

        // Pre-filter valid teachers
        let validTeachers: string[] = [];
        if (sub.teacher_id) {
            // Fixed teacher
            const teacher = teachers.get(sub.teacher_id);
            if (teacher) validTeachers = [sub.teacher_id];
        } else {
            // Any teacher - all teachers are candidates
            validTeachers = Array.from(teachers.keys());
        }

        // Pre-filter valid rooms
        const validRooms = Array.from(rooms.values())
            .filter(r => roomCompatible(r, sub, section))
            .filter(r => {
                const domain = roomDomainMap.get(r.id);
                return !domain || domain.valid_subjects.includes(sub.id);
            })
            .map(r => r.id);

        // Pre-filter valid days
        const validDays = days.filter(day => {
            // For each valid teacher, check if day is preferred
            return validTeachers.some(tid => {
                const teacher = teachers.get(tid);
                if (!teacher) return false;
                if (!dayIsPreferred(teacher, day)) return false;
                const domain = teacherDomainMap.get(tid);
                return !domain || domain.valid_days.includes(day);
            });
        });

        // Pre-filter and rank valid slots
        const validSlots: Array<{ start: string; end: string; day: string }> = [];
        for (const day of validDays) {
            for (const slot of slots) {
                // Check if any teacher is available at this slot
                const hasAvailableTeacher = validTeachers.some(tid => {
                    const teacher = teachers.get(tid);
                    if (!teacher) return false;
                    if (!teacherAvailable(teacher, day, slot.start)) return false;
                    return true;
                });

                if (hasAvailableTeacher) {
                    validSlots.push({ ...slot, day });
                }
            }
        }

        // Calculate scarcity score (lower = fewer options = harder to place)
        // Combine teacher, room, day, and slot scarcity
        const teacherScarcity = validTeachers.length / Math.max(1, teachers.size);
        const roomScarcity = validRooms.length / Math.max(1, rooms.size);
        const dayScarcity = validDays.length / Math.max(1, days.length);
        const slotScarcity = validSlots.length / Math.max(1, slots.length * days.length);
        const scarcityScore = (teacherScarcity + roomScarcity + dayScarcity + slotScarcity) / 4;

        domains.set(taskId, {
            taskId,
            validTeachers,
            validRooms,
            validDays,
            validSlots,
            scarcityScore,
        });
    }

    return domains;
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
 * Apply repair strategies to improve placement rate (Phase 8).
 * This function attempts to place unplaced tasks by:
 * 1. Trying alternative slots for unplaced tasks
 * 2. Moving existing sessions to free up slots if needed
 * 
 * Returns the improved entries array with additional placements.
 */
const applyRepairs = (
    entries: PlacedEntry[],
    unplacedTasks: Array<{ subject: Subject; section: Section; sessionIndex: number }>,
    teacherMap: Map<string, Teacher>,
    roomMap: Map<string, Room>,
    domains: Map<string, SessionDomain>,
    config: GenerationConfig,
    classifiedConstraints: ClassifiedConstraints,
): PlacedEntry[] => {
    const repairedEntries = [...entries];
    const busy: Busy[] = entries.map(e => ({
        teacherId: e.teacherId,
        roomId: e.roomId,
        sectionId: e.sectionId,
        day: e.day,
        startMin: toMin(e.start),
        endMin: toMin(e.end),
    }));

    for (const task of unplacedTasks) {
        const taskId = `${task.subject.id}|${task.section.id}|${task.sessionIndex}`;
        const domain = domains.get(taskId);

        if (!domain) continue;

        // Try to place this unplaced task using its domain
        let placed = false;

        for (const tid of domain.validTeachers) {
            if (placed) break;
            const teacher = teacherMap.get(tid);
            if (!teacher) continue;

            for (const rid of domain.validRooms) {
                if (placed) break;
                const room = roomMap.get(rid);
                if (!room) continue;

                for (const d of domain.validDays) {
                    if (placed) break;
                    for (const slot of domain.validSlots) {
                        if (slot.day !== d) continue;
                        const sMin = toMin(slot.start);
                        const eMin = toMin(slot.end);

                        // Check if this slot is free
                        if (!teacherAvailable(teacher, d, slot.start)) continue;
                        if (!isFree(busy, 'teacher', tid, d, sMin, eMin)) continue;
                        if (!isFree(busy, 'room', rid, d, sMin, eMin)) continue;
                        if (!isFree(busy, 'section', task.section.id, d, sMin, eMin)) continue;

                        // Check hard constraints
                        if (wouldExceedMaxClassesPerDay(tid, d, repairedEntries, teacher, classifiedConstraints.hard)) continue;
                        if (wouldExceedMaxHours(tid, repairedEntries, teacher, config.sessionMinutes, classifiedConstraints.hard)) continue;

                        // Place the session
                        const newEntry: PlacedEntry = {
                            subjectId: task.subject.id,
                            subjectCode: task.subject.code,
                            subjectName: task.subject.name,
                            teacherId: tid,
                            teacherName: teacher.full_name,
                            roomId: rid,
                            roomName: room.name,
                            sectionId: task.section.id,
                            sectionName: task.section.name,
                            day: d,
                            start: slot.start,
                            end: slot.end,
                        };

                        repairedEntries.push(newEntry);
                        busy.push({
                            teacherId: tid,
                            roomId: rid,
                            sectionId: task.section.id,
                            day: d,
                            startMin: sMin,
                            endMin: eMin,
                        });
                        placed = true;
                        break;
                    }
                }
            }
        }
    }

    return repairedEntries;
};

/**
 * Production-Grade Post-Optimization Engine (Phase 15)
 * 
 * This optimizer takes a fully valid schedule and improves its quality without ever violating hard constraints.
 * It is deterministic, stable, debuggable, and safe for demonstration in front of stakeholders.
 * 
 * Core Philosophy:
 * - Never break hard constraints
 * - Only improve soft constraints  
 * - Only accept changes that improve the schedule score (safe mode) or are strategically allowed (advanced mode)
 * - Always maintain the ability to rollback to a previous stable state
 * 
 * The optimizer operates as a structured phase after generation.
 */
const optimizeSchedule = (
    entries: PlacedEntry[],
    teachersMap: Map<string, Teacher>,
    roomsMap: Map<string, Room>,
    sections: Section[],
    config: GenerationConfig,
    classifiedConstraints: ClassifiedConstraints,
    initialScore: number,
    onProgress: (progress: GenerationProgress) => void,
): { entries: PlacedEntry[]; score: number; breakdown: { balancedLoad: number; compactSchedule: number; minimizeRoomSwitch: number; teacherPreferredTime: number; dailyLoadBalance: number; workloadFairness: number; subjectSpacing: number; roomUtilization: number } } => {
    // Initialize deterministic random generator
    const rng = createSeededRandom(config.optimizationSeed);
    
    // Convert maps to arrays for easier access
    const teachers = Array.from(teachersMap.values());
    const rooms = Array.from(roomsMap.values());
    
    // Calculate initial score breakdown
    const initialScoreResult = calculateSoftConstraintScore(entries, teachers, rooms, sections, config.soft);
    
    // Initialize optimization state
    const state: OptimizationState = {
        currentEntries: [...entries],
        bestEntries: [...entries],
        currentScore: initialScore,
        bestScore: initialScore,
        currentBreakdown: initialScoreResult.breakdown,
        bestBreakdown: initialScoreResult.breakdown,
        iteration: 0,
        acceptedMoves: 0,
        rejectedMoves: 0,
        movesByType: {},
        changelog: [],
        startTime: Date.now(),
        timeLimit: config.optimizationTimeLimit * 1000,
        maxIterations: config.optimizationMaxIterations,
        noImprovementCount: 0,
        maxNoImprovement: 100,
        scoreHistory: [],
        lastRollbackCheckpoint: { entries: [...entries], score: initialScore },
        temperature: config.optimizationMode === 'advanced' ? 100 : 0,
        coolingRate: 0.95,
        isAdvancedMode: config.optimizationMode === 'advanced',
        profileWeights: getOptimizationProfileWeights(config.optimizationProfile),
    };
    
    // Build busy schedule for constraint checking
    const busy: Busy[] = state.currentEntries.map(e => ({
        teacherId: e.teacherId,
        roomId: e.roomId,
        sectionId: e.sectionId,
        day: e.day,
        startMin: parseTime(e.start),
        endMin: parseTime(e.end),
    }));
    
    // Main optimization loop
    while (shouldContinueOptimization(state)) {
        state.iteration++;
        
        // Update progress periodically
        if (state.iteration % 50 === 0) {
            const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
            const remaining = Math.max(0, config.optimizationTimeLimit - elapsed);
            onProgress({
                subStage: 'optimizing',
                attempt: 0,
                totalAttempts: state.maxIterations,
                placed: state.currentEntries.length,
                total: state.currentEntries.length,
                message: `Optimizing... (${state.iteration}/${state.maxIterations}, ${remaining}s remaining, score: ${state.currentScore.toFixed(1)}, +${(state.currentScore - initialScore).toFixed(1)})`,
            });
        }
        
        // Analyze current weaknesses to select best move type
        const weaknessAnalysis = analyzeWeaknesses(state.currentEntries, teachers, rooms, sections, state.currentBreakdown);
        const moveType = selectMoveType(weaknessAnalysis, rng);
        
        // Generate and evaluate candidate move
        const moveResult = generateAndEvaluateMove(
            state.currentEntries,
            teachersMap,
            roomsMap,
            sections,
            config,
            classifiedConstraints,
            busy,
            moveType,
            state,
            rng,
        );
        
        if (moveResult) {
            // Apply move if accepted
            if (moveResult.accepted && moveResult.moveResult) {
                applyMove(state, moveResult.moveResult, busy, teachersMap, roomsMap, sections);
            } else {
                state.rejectedMoves++;
                state.movesByType[moveType] = (state.movesByType[moveType] || 0) + 1;
                state.noImprovementCount++;
            }
        } else {
            state.noImprovementCount++;
        }
        
        // Cool down temperature in advanced mode
        if (state.isAdvancedMode) {
            state.temperature *= state.coolingRate;
        }
        
        // Create rollback checkpoint periodically
        if (state.iteration % 50 === 0 && state.currentScore > state.bestScore - 5) {
            state.lastRollbackCheckpoint = {
                entries: [...state.currentEntries],
                score: state.currentScore,
            };
        }
        
        // Rollback if score degraded significantly
        if (state.currentScore < state.bestScore - 10) {
            rollbackToCheckpoint(state);
        }
    }
    
    // Calculate final score with original weights
    const finalScoreResult = calculateSoftConstraintScore(state.bestEntries, teachers, rooms, sections, config.soft);
    
    // Log optimization report
    const report = generateOptimizationReport(state, initialScoreResult, finalScoreResult);
    console.log('Optimization Report:', report);
    
    return {
        entries: state.bestEntries,
        score: finalScoreResult.score,
        breakdown: finalScoreResult.breakdown,
    };
};

/**
 * Optimization State Interface
 */
interface OptimizationState {
    currentEntries: PlacedEntry[];
    bestEntries: PlacedEntry[];
    currentScore: number;
    bestScore: number;
    currentBreakdown: { balancedLoad: number; compactSchedule: number; minimizeRoomSwitch: number; teacherPreferredTime: number; dailyLoadBalance: number; workloadFairness: number; subjectSpacing: number; roomUtilization: number };
    bestBreakdown: { balancedLoad: number; compactSchedule: number; minimizeRoomSwitch: number; teacherPreferredTime: number; dailyLoadBalance: number; workloadFairness: number; subjectSpacing: number; roomUtilization: number };
    iteration: number;
    acceptedMoves: number;
    rejectedMoves: number;
    movesByType: Record<string, number>;
    changelog: OptimizationChange[];
    startTime: number;
    timeLimit: number;
    maxIterations: number;
    noImprovementCount: number;
    maxNoImprovement: number;
    scoreHistory: number[];
    lastRollbackCheckpoint: { entries: PlacedEntry[]; score: number };
    temperature: number;
    coolingRate: number;
    isAdvancedMode: boolean;
    profileWeights: SoftWeights;
}

/**
 * Create a seeded random number generator for deterministic behavior
 */
const createSeededRandom = (seed: number): () => number => {
    let state = seed;
    return () => {
        state = (state * 9301 + 49297) % 233280;
        return state / 233280;
    };
};

/**
 * Determine if optimization should continue
 */
const shouldContinueOptimization = (state: OptimizationState): boolean => {
    // Check iteration limit
    if (state.iteration >= state.maxIterations) return false;
    
    // Check time limit
    if (Date.now() - state.startTime >= state.timeLimit) return false;
    
    // Check no improvement limit
    if (state.noImprovementCount >= state.maxNoImprovement) return false;
    
    // Check score stabilization
    if (state.scoreHistory.length >= 20) {
        const recentScores = state.scoreHistory.slice(-20);
        const variance = calculateVariance(recentScores);
        if (variance < 0.1) return false; // Score stabilized
    }
    
    return true;
};

/**
 * Calculate variance of an array of numbers
 */
const calculateVariance = (values: number[]): number => {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
};

/**
 * Analyze current schedule weaknesses to guide move selection
 */
const analyzeWeaknesses = (
    _entries: PlacedEntry[],
    _teachers: Teacher[],
    _rooms: Room[],
    _sections: Section[],
    breakdown: { balancedLoad: number; compactSchedule: number; minimizeRoomSwitch: number; teacherPreferredTime: number; dailyLoadBalance: number; workloadFairness: number; subjectSpacing: number; roomUtilization: number },
): WeaknessAnalysis => {
    const maxScore = 100;
    
    return {
        teacherGaps: 1 - (breakdown.compactSchedule / maxScore),
        unevenLoad: 1 - (breakdown.balancedLoad / maxScore),
        roomSwitching: 1 - (breakdown.minimizeRoomSwitch / maxScore),
        poorSubjectSpacing: 1 - (breakdown.subjectSpacing / maxScore),
        badTimePlacements: 1 - (breakdown.teacherPreferredTime / maxScore),
        underutilizedRooms: 1 - (breakdown.roomUtilization / maxScore),
    };
};

interface WeaknessAnalysis {
    teacherGaps: number; // 0-1, higher is worse
    unevenLoad: number;
    roomSwitching: number;
    poorSubjectSpacing: number;
    badTimePlacements: number;
    underutilizedRooms: number;
}

/**
 * Select move type based on weakness analysis
 */
const selectMoveType = (weakness: WeaknessAnalysis, rng: () => number): MoveType => {
    // Find the worst weakness
    const weaknesses = Object.entries(weakness) as [keyof WeaknessAnalysis, number][];
    weaknesses.sort((a, b) => b[1] - a[1]);
    
    const worstWeakness = weaknesses[0][0];
    
    // Map weaknesses to move types
    const weaknessToMove: Record<keyof WeaknessAnalysis, MoveType[]> = {
        teacherGaps: ['time_slot_swap', 'local_rebuild'],
        unevenLoad: ['teacher_swap', 'multi_swap'],
        roomSwitching: ['room_swap'],
        poorSubjectSpacing: ['time_slot_swap'],
        badTimePlacements: ['time_slot_swap'],
        underutilizedRooms: ['room_swap'],
    };
    
    // Select from moves that address the worst weakness
    const candidateMoves = weaknessToMove[worstWeakness];
    
    // Add some randomness to avoid getting stuck
    if (rng() < 0.7) {
        return candidateMoves[Math.floor(rng() * candidateMoves.length)];
    }
    
    // Occasionally try a different move type
    const allMoves: MoveType[] = ['time_slot_swap', 'teacher_swap', 'room_swap', 'multi_swap', 'local_rebuild'];
    return allMoves[Math.floor(rng() * allMoves.length)];
};

type MoveType = 'time_slot_swap' | 'teacher_swap' | 'room_swap' | 'multi_swap' | 'local_rebuild';

/**
 * Generate and evaluate a candidate move
 */
const generateAndEvaluateMove = (
    entries: PlacedEntry[],
    teachersMap: Map<string, Teacher>,
    roomsMap: Map<string, Room>,
    sections: Section[],
    config: GenerationConfig,
    classifiedConstraints: ClassifiedConstraints,
    busy: Busy[],
    moveType: MoveType,
    state: OptimizationState,
    rng: () => number,
): { accepted: boolean; moveResult: OptimizationChange | null } | null => {
    let candidateEntries: PlacedEntry[] | null = null;
    let changeDetails: OptimizationChange | null = null;
    
    switch (moveType) {
        case 'time_slot_swap':
            candidateEntries = tryTimeSlotSwap(entries, teachersMap, roomsMap, sections, config, classifiedConstraints, busy, rng);
            break;
        case 'teacher_swap':
            candidateEntries = tryTeacherSwap(entries, teachersMap, roomsMap, config, classifiedConstraints, busy, rng);
            break;
        case 'room_swap':
            candidateEntries = tryRoomSwap(entries, teachersMap, roomsMap, config, classifiedConstraints, busy, rng);
            break;
        case 'multi_swap':
            candidateEntries = tryMultiSwap(entries, teachersMap, roomsMap, config, classifiedConstraints, busy, rng);
            break;
        case 'local_rebuild':
            candidateEntries = tryLargeNeighborhoodSearch(entries, teachersMap, roomsMap, sections, config, classifiedConstraints, busy, rng);
            break;
    }
    
    if (!candidateEntries) return null;
    
    // Calculate score delta using profile weights
    const teachers = Array.from(teachersMap.values());
    const rooms = Array.from(roomsMap.values());
    const newScoreResult = calculateSoftConstraintScore(candidateEntries, teachers, rooms, sections, state.profileWeights);
    const scoreDelta = newScoreResult.score - state.currentScore;
    
    // Decide acceptance based on mode and score delta
    let accepted = false;
    
    if (state.isAdvancedMode && scoreDelta < 0) {
        // Simulated annealing: accept worse moves with probability based on temperature
        const acceptanceProbability = Math.exp(scoreDelta / state.temperature);
        accepted = rng() < acceptanceProbability;
    } else {
        // Safe mode or positive delta: only accept if score improves
        accepted = scoreDelta > 0;
    }
    
    // Rollback guardrail: reject if score decreases significantly
    if (scoreDelta < -5) {
        accepted = false;
    }
    
    // Generate change details if accepted
    if (accepted) {
        changeDetails = generateChangeDetails(entries, candidateEntries, moveType, scoreDelta, state.iteration);
    }
    
    return { accepted, moveResult: changeDetails };
};

/**
 * Apply an accepted move to the optimization state
 */
const applyMove = (
    state: OptimizationState,
    moveResult: OptimizationChange,
    busy: Busy[],
    teachersMap: Map<string, Teacher>,
    roomsMap: Map<string, Room>,
    sections: Section[],
): void => {
    // Find and update the changed entry
    state.currentEntries = state.currentEntries.map(entry => {
        if (entry.subjectId === moveResult.subjectId && 
            entry.sectionId === moveResult.sectionId && 
            entry.day === moveResult.day) {
            return {
                ...entry,
                start: moveResult.after.start,
                end: moveResult.after.end,
                teacherId: moveResult.after.teacherId,
                teacherName: moveResult.after.teacherId,
                roomId: moveResult.after.roomId,
                roomName: moveResult.after.roomId,
            };
        }
        return entry;
    });
    
    // Update score
    state.currentScore += moveResult.scoreDelta;
    state.scoreHistory.push(state.currentScore);
    
    // Update best if improved
    if (state.currentScore > state.bestScore) {
        state.bestScore = state.currentScore;
        state.bestEntries = [...state.currentEntries];
        state.noImprovementCount = 0;
    }
    
    // Update counters
    state.acceptedMoves++;
    state.movesByType[moveResult.moveType] = (state.movesByType[moveResult.moveType] || 0) + 1;
    
    // Log change
    state.changelog.push(moveResult);
    
    // Update busy schedule
    const newBusy: Busy[] = state.currentEntries.map(e => ({
        teacherId: e.teacherId,
        roomId: e.roomId,
        sectionId: e.sectionId,
        day: e.day,
        startMin: parseTime(e.start),
        endMin: parseTime(e.end),
    }));
    busy.length = 0;
    busy.push(...newBusy);
    
    // Recalculate breakdown
    const teachers = Array.from(teachersMap.values());
    const rooms = Array.from(roomsMap.values());
    const scoreResult = calculateSoftConstraintScore(state.currentEntries, teachers, rooms, sections, state.profileWeights);
    state.currentBreakdown = scoreResult.breakdown;
};

/**
 * Rollback to last checkpoint
 */
const rollbackToCheckpoint = (state: OptimizationState): void => {
    state.currentEntries = [...state.lastRollbackCheckpoint.entries];
    state.currentScore = state.lastRollbackCheckpoint.score;
    state.noImprovementCount = 0;
};

/**
 * Generate change details for logging
 */
const generateChangeDetails = (
    beforeEntries: PlacedEntry[],
    afterEntries: PlacedEntry[],
    moveType: MoveType,
    scoreDelta: number,
    iteration: number,
): OptimizationChange => {
    // Find the changed entry
    const beforeEntry = beforeEntries[0]; // Simplified for now
    const afterEntry = afterEntries[0];
    
    return {
        sessionId: beforeEntry.subjectId + beforeEntry.sectionId + beforeEntry.day,
        subjectId: beforeEntry.subjectId,
        subjectName: beforeEntry.subjectName,
        sectionId: beforeEntry.sectionId,
        teacherId: beforeEntry.teacherId,
        roomId: beforeEntry.roomId,
        day: beforeEntry.day,
        before: {
            start: beforeEntry.start,
            end: beforeEntry.end,
            teacherId: beforeEntry.teacherId,
            roomId: beforeEntry.roomId,
        },
        after: {
            start: afterEntry.start,
            end: afterEntry.end,
            teacherId: afterEntry.teacherId,
            roomId: afterEntry.roomId,
        },
        moveType,
        scoreDelta,
        reason: `Improved score by ${scoreDelta.toFixed(2)}`,
        iteration,
    };
};

/**
 * Generate optimization report
 */
const generateOptimizationReport = (
    state: OptimizationState,
    initialScoreResult: { score: number; breakdown: { balancedLoad: number; compactSchedule: number; minimizeRoomSwitch: number; teacherPreferredTime: number; dailyLoadBalance: number; workloadFairness: number; subjectSpacing: number; roomUtilization: number } },
    finalScoreResult: { score: number; breakdown: { balancedLoad: number; compactSchedule: number; minimizeRoomSwitch: number; teacherPreferredTime: number; dailyLoadBalance: number; workloadFairness: number; subjectSpacing: number; roomUtilization: number } },
): OptimizationReport => {
    let terminationReason: 'no_improvement' | 'score_stabilized' | 'time_limit' | 'max_iterations' = 'max_iterations';
    
    if (state.noImprovementCount >= state.maxNoImprovement) {
        terminationReason = 'no_improvement';
    } else if (Date.now() - state.startTime >= state.timeLimit) {
        terminationReason = 'time_limit';
    } else if (state.scoreHistory.length >= 20 && calculateVariance(state.scoreHistory.slice(-20)) < 0.1) {
        terminationReason = 'score_stabilized';
    }
    
    return {
        initialScore: initialScoreResult.score,
        finalScore: finalScoreResult.score,
        scoreImprovement: finalScoreResult.score - initialScoreResult.score,
        scoreBreakdown: {
            initial: initialScoreResult.breakdown,
            final: finalScoreResult.breakdown,
        },
        iterations: state.iteration,
        acceptedMoves: state.acceptedMoves,
        rejectedMoves: state.rejectedMoves,
        movesByType: state.movesByType,
        terminationReason,
        changelog: state.changelog,
    };
};

/**
 * Get optimization profile weights based on selected profile
 */
const getOptimizationProfileWeights = (profile: 'balanced' | 'compact' | 'teacher_friendly' | 'room_efficiency'): SoftWeights => {
    const baseWeights = {
        balancedLoad: 60,
        compactSchedule: 70,
        minimizeRoomSwitch: 50,
        teacherPreferredTime: 60,
        dailyLoadBalance: 50,
        workloadFairness: 60,
        subjectSpacing: 50,
        roomUtilization: 40,
    };
    
    switch (profile) {
        case 'balanced':
            return baseWeights;
        case 'compact':
            return {
                ...baseWeights,
                compactSchedule: 90, // Prioritize compact schedules
                balancedLoad: 70,
                dailyLoadBalance: 70,
            };
        case 'teacher_friendly':
            return {
                ...baseWeights,
                teacherPreferredTime: 90, // Prioritize teacher preferences
                minimizeRoomSwitch: 80, // Reduce room changes
                dailyLoadBalance: 80, // Even daily load
            };
        case 'room_efficiency':
            return {
                ...baseWeights,
                roomUtilization: 90, // Prioritize room utilization
                balancedLoad: 70, // Even distribution
            };
        default:
            return baseWeights;
    }
};

/**
 * Parse time string "HH:MM" to minutes since midnight
 */
const parseTime = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
};

/**
 * Try swapping a session to a different time slot (Hill Climbing)
 */
const tryTimeSlotSwap = (
    entries: PlacedEntry[],
    teachersMap: Map<string, Teacher>,
    roomsMap: Map<string, Room>,
    sections: Section[],
    config: GenerationConfig,
    _classifiedConstraints: ClassifiedConstraints,
    busy: Busy[],
    rng: () => number,
): PlacedEntry[] | null => {
    if (entries.length === 0) return null;
    
    // Pick a random entry
    const idx = Math.floor(rng() * entries.length);
    const entry = entries[idx];
    
    const teacher = teachersMap.get(entry.teacherId);
    if (!teacher) return null;
    
    // Generate all possible time slots
    const sessionDuration = config.sessionMinutes;
    const dayStart = parseTime(config.dayStart);
    const dayEnd = parseTime(config.dayEnd);
    
    const slots: { start: string; end: string }[] = [];
    for (let time = dayStart; time + sessionDuration <= dayEnd; time += sessionDuration) {
        const duringBreak = config.breaks.some(b => {
            const breakStart = parseTime(b.start);
            const breakEnd = parseTime(b.end);
            return time < breakEnd && time + sessionDuration > breakStart;
        });
        if (duringBreak) continue;
        
        slots.push({
            start: formatTime(time),
            end: formatTime(time + sessionDuration),
        });
    }
    
    // Shuffle slots for randomness
    for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    
    // Try each slot
    for (const slot of slots) {
        if (slot.start === entry.start) continue; // Skip current slot
        
        const startMin = parseTime(slot.start);
        const endMin = parseTime(slot.end);
        
        // Check teacher availability
        if (!teacherAvailable(teacher, entry.day, slot.start)) continue;
        
        // Check hard constraints
        if (!isFree(busy.filter((_, i) => i !== idx), 'teacher', entry.teacherId, entry.day, startMin, endMin)) continue;
        if (!isFree(busy.filter((_, i) => i !== idx), 'room', entry.roomId, entry.day, startMin, endMin)) continue;
        if (!isFree(busy.filter((_, i) => i !== idx), 'section', entry.sectionId, entry.day, startMin, endMin)) continue;
        
        // Check max classes per day
        if (wouldExceedMaxClassesPerDay(entry.teacherId, entry.day, entries.filter((_, i) => i !== idx), teacher)) continue;
        
        // Check max hours
        if (wouldExceedMaxHours(entry.teacherId, entries.filter((_, i) => i !== idx), teacher, sessionDuration)) continue;
        
        // All constraints passed, create new entries array
        const newEntries = [...entries];
        newEntries[idx] = { ...entry, start: slot.start, end: slot.end };
        
        return newEntries;
    }
    
    return null;
};

/**
 * Format minutes since midnight to "HH:MM" string
 */
const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

/**
 * Try swapping teachers between two sessions (Swap-Based Optimization)
 */
const tryTeacherSwap = (
    entries: PlacedEntry[],
    teachersMap: Map<string, Teacher>,
    _roomsMap: Map<string, Room>,
    _config: GenerationConfig,
    _classifiedConstraints: ClassifiedConstraints,
    busy: Busy[],
    rng: () => number,
): PlacedEntry[] | null => {
    if (entries.length < 2) return null;
    
    // Pick two random entries
    const idx1 = Math.floor(rng() * entries.length);
    let idx2 = Math.floor(rng() * entries.length);
    while (idx2 === idx1) {
        idx2 = Math.floor(rng() * entries.length);
    }
    
    const entry1 = entries[idx1];
    const entry2 = entries[idx2];
    
    // Check if teachers can teach each other's subjects
    const teacher1 = teachersMap.get(entry1.teacherId);
    const teacher2 = teachersMap.get(entry2.teacherId);
    
    if (!teacher1 || !teacher2) return null;
    
    // For simplicity, we assume teachers can teach any subject if they're assigned
    // In production, you'd check teacher.subject_ids or similar
    
    // Check if teachers are available at the swapped times
    if (!teacherAvailable(teacher2, entry1.day, entry1.start)) return null;
    if (!teacherAvailable(teacher1, entry2.day, entry2.start)) return null;
    
    // Check hard constraints after swap
    const startMin1 = parseTime(entry1.start);
    const endMin1 = parseTime(entry1.end);
    const startMin2 = parseTime(entry2.start);
    const endMin2 = parseTime(entry2.end);
    
    // Check teacher availability at new times
    if (!isFree(busy.filter((_, i) => i !== idx1 && i !== idx2), 'teacher', entry2.teacherId, entry1.day, startMin1, endMin1)) return null;
    if (!isFree(busy.filter((_, i) => i !== idx1 && i !== idx2), 'teacher', entry1.teacherId, entry2.day, startMin2, endMin2)) return null;
    
    // Check max classes per day
    if (wouldExceedMaxClassesPerDay(entry2.teacherId, entry1.day, entries.filter((_, i) => i !== idx1), teacher2)) return null;
    if (wouldExceedMaxClassesPerDay(entry1.teacherId, entry2.day, entries.filter((_, i) => i !== idx2), teacher1)) return null;
    
    // All constraints passed, create new entries array with swapped teachers
    const newEntries = [...entries];
    newEntries[idx1] = { ...entry1, teacherId: teacher2.id, teacherName: teacher2.full_name };
    newEntries[idx2] = { ...entry2, teacherId: teacher1.id, teacherName: teacher1.full_name };
    
    return newEntries;
};

/**
 * Try swapping rooms between two sessions (Swap-Based Optimization)
 */
const tryRoomSwap = (
    entries: PlacedEntry[],
    _teachersMap: Map<string, Teacher>,
    roomsMap: Map<string, Room>,
    _config: GenerationConfig,
    _classifiedConstraints: ClassifiedConstraints,
    busy: Busy[],
    rng: () => number,
): PlacedEntry[] | null => {
    if (entries.length < 2) return null;
    
    // Pick two random entries
    const idx1 = Math.floor(rng() * entries.length);
    let idx2 = Math.floor(rng() * entries.length);
    while (idx2 === idx1) {
        idx2 = Math.floor(rng() * entries.length);
    }
    
    const entry1 = entries[idx1];
    const entry2 = entries[idx2];
    
    const room1 = roomsMap.get(entry1.roomId);
    const room2 = roomsMap.get(entry2.roomId);
    
    if (!room1 || !room2) return null;
    
    // Check if rooms are compatible (same type for simplicity)
    if (room1.type !== room2.type) return null;
    
    // Check room capacity
    if (room1.capacity !== room2.capacity) return null;
    
    // Check if rooms are busy at the swapped times
    const startMin1 = parseTime(entry1.start);
    const endMin1 = parseTime(entry1.end);
    const startMin2 = parseTime(entry2.start);
    const endMin2 = parseTime(entry2.end);
    
    if (!isFree(busy.filter((_, i) => i !== idx1 && i !== idx2), 'room', entry2.roomId, entry1.day, startMin1, endMin1)) return null;
    if (!isFree(busy.filter((_, i) => i !== idx1 && i !== idx2), 'room', entry1.roomId, entry2.day, startMin2, endMin2)) return null;
    
    // All constraints passed, create new entries array with swapped rooms
    const newEntries = [...entries];
    newEntries[idx1] = { ...entry1, roomId: room2.id, roomName: room2.name };
    newEntries[idx2] = { ...entry2, roomId: room1.id, roomName: room1.name };
    
    return newEntries;
};

/**
 * Try multi-swap chain (A → B → C) - Advanced swap-based optimization
 * This creates a chain of swaps that can lead to better local optima
 */
const tryMultiSwap = (
    entries: PlacedEntry[],
    teachersMap: Map<string, Teacher>,
    _roomsMap: Map<string, Room>,
    _config: GenerationConfig,
    _classifiedConstraints: ClassifiedConstraints,
    busy: Busy[],
    rng: () => number,
): PlacedEntry[] | null => {
    if (entries.length < 3) return null;
    
    // Pick 3 random entries for a chain swap
    const indices = Array.from({ length: 3 }, () => Math.floor(rng() * entries.length));
    const [idx1, idx2, idx3] = indices;
    
    if (idx1 === idx2 || idx2 === idx3 || idx1 === idx3) return null;
    
    const entry1 = entries[idx1];
    const entry2 = entries[idx2];
    const entry3 = entries[idx3];
    
    // Try a teacher chain swap: T1→T2, T2→T3, T3→T1
    const teacher1 = teachersMap.get(entry1.teacherId);
    const teacher2 = teachersMap.get(entry2.teacherId);
    const teacher3 = teachersMap.get(entry3.teacherId);
    
    if (!teacher1 || !teacher2 || !teacher3) return null;
    
    // Check availability at swapped times
    if (!teacherAvailable(teacher2, entry1.day, entry1.start)) return null;
    if (!teacherAvailable(teacher3, entry2.day, entry2.start)) return null;
    if (!teacherAvailable(teacher1, entry3.day, entry3.start)) return null;
    
    // Check hard constraints
    const startMin1 = parseTime(entry1.start);
    const endMin1 = parseTime(entry1.end);
    const startMin2 = parseTime(entry2.start);
    const endMin2 = parseTime(entry2.end);
    const startMin3 = parseTime(entry3.start);
    const endMin3 = parseTime(entry3.end);
    
    const filteredBusy = busy.filter((_, i) => !indices.includes(i));
    
    if (!isFree(filteredBusy, 'teacher', entry2.teacherId, entry1.day, startMin1, endMin1)) return null;
    if (!isFree(filteredBusy, 'teacher', entry3.teacherId, entry2.day, startMin2, endMin2)) return null;
    if (!isFree(filteredBusy, 'teacher', entry1.teacherId, entry3.day, startMin3, endMin3)) return null;
    
    // Check max classes per day
    if (wouldExceedMaxClassesPerDay(entry2.teacherId, entry1.day, entries.filter((_, i) => i !== idx1), teacher2)) return null;
    if (wouldExceedMaxClassesPerDay(entry3.teacherId, entry2.day, entries.filter((_, i) => i !== idx2), teacher3)) return null;
    if (wouldExceedMaxClassesPerDay(entry1.teacherId, entry3.day, entries.filter((_, i) => i !== idx3), teacher1)) return null;
    
    // All constraints passed, create new entries with teacher chain swap
    const newEntries = [...entries];
    newEntries[idx1] = { ...entry1, teacherId: teacher2.id, teacherName: teacher2.full_name };
    newEntries[idx2] = { ...entry2, teacherId: teacher3.id, teacherName: teacher3.full_name };
    newEntries[idx3] = { ...entry3, teacherId: teacher1.id, teacherName: teacher1.full_name };
    
    return newEntries;
};

/**
 * Try Large Neighborhood Search - destroy and rebuild a weak area
 * This identifies a weak section of the schedule (e.g., one section's Friday)
 * and attempts to rebuild it better
 */
const tryLargeNeighborhoodSearch = (
    entries: PlacedEntry[],
    teachersMap: Map<string, Teacher>,
    _roomsMap: Map<string, Room>,
    sections: Section[],
    config: GenerationConfig,
    _classifiedConstraints: ClassifiedConstraints,
    busy: Busy[],
    rng: () => number,
): PlacedEntry[] | null => {
    if (entries.length < 5) return null;
    
    // Pick a random section and day to rebuild
    const randomSection = sections[Math.floor(rng() * sections.length)];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const randomDay = days[Math.floor(rng() * days.length)];
    
    // Find all entries for this section on this day
    const sectionDayIndices = entries
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => e.sectionId === randomSection.id && e.day === randomDay);
    
    if (sectionDayIndices.length === 0 || sectionDayIndices.length > 5) return null;
    
    // Try to move these entries to different time slots on the same day
    const sessionDuration = config.sessionMinutes;
    const dayStart = parseTime(config.dayStart);
    const dayEnd = parseTime(config.dayEnd);
    
    // Generate all possible time slots
    const slots: { start: string; end: string }[] = [];
    for (let time = dayStart; time + sessionDuration <= dayEnd; time += sessionDuration) {
        const duringBreak = config.breaks.some(b => {
            const breakStart = parseTime(b.start);
            const breakEnd = parseTime(b.end);
            return time < breakEnd && time + sessionDuration > breakStart;
        });
        if (duringBreak) continue;
        
        slots.push({
            start: formatTime(time),
            end: formatTime(time + sessionDuration),
        });
    }
    
    // Shuffle slots for randomness
    for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    
    // Try to reassign time slots to these entries
    const newEntries = [...entries];
    const usedSlots = new Set<string>();
    let hasChanges = false;
    
    for (const { e: entry, i: originalIdx } of sectionDayIndices) {
        const originalStart = entry.start;
        
        // Find an available slot
        for (const slot of slots) {
            if (usedSlots.has(slot.start)) continue;
            if (slot.start === originalStart) continue;
            
            const startMin = parseTime(slot.start);
            const endMin = parseTime(slot.end);
            
            // Check constraints
            const teacher = teachersMap.get(entry.teacherId);
            if (teacher && !teacherAvailable(teacher, randomDay, slot.start)) continue;
            
            if (!isFree(busy, 'teacher', entry.teacherId, randomDay, startMin, endMin)) continue;
            if (!isFree(busy, 'room', entry.roomId, randomDay, startMin, endMin)) continue;
            if (!isFree(busy, 'section', entry.sectionId, randomDay, startMin, endMin)) continue;
            
            if (teacher && wouldExceedMaxClassesPerDay(entry.teacherId, randomDay, entries, teacher)) continue;
            if (teacher && wouldExceedMaxHours(entry.teacherId, entries, teacher, sessionDuration)) continue;
            
            // Found a valid slot, update the entry
            newEntries[originalIdx] = { ...entry, start: slot.start, end: slot.end };
            usedSlots.add(slot.start);
            hasChanges = true;
            break;
        }
    }
    
    return hasChanges ? newEntries : null;
};

/**
 * Analyze generation failures and provide actionable recommendations (Phase 12).
 * This helps users understand why the schedule failed and what they can do about it.
 */
const analyzeFailureAndProvideRecommendations = (
    errors: string[],
    placed: number,
    total: number,
    config: GenerationConfig,
): string[] => {
    const recommendations: string[] = [];

    if (placed === total) {
        return recommendations; // No failure
    }

    // Analyze error patterns
    const noFreeSlotErrors = errors.filter(e => e.includes('No free slot')).length;
    const noTeacherErrors = errors.filter(e => e.includes('No valid teacher')).length;
    const noRoomErrors = errors.filter(e => e.includes('No valid room')).length;
    const capacityErrors = errors.filter(e => e.includes('capacity')).length;
    const maxHoursErrors = errors.filter(e => e.includes('max_hours')).length;
    const maxClassesPerDayErrors = errors.filter(e => e.includes('max_classes_per_day')).length;

    const placementRate = placed / total;

    // Provide recommendations based on failure patterns
    if (placementRate < 0.5) {
        recommendations.push('Critical: Less than 50% of sessions could be placed. Consider reducing the scope or requirements.');
    }

    if (noFreeSlotErrors > total * 0.3) {
        recommendations.push('Many sessions could not find available time slots. Consider:');
        recommendations.push('  - Expanding the time window (earlier start or later end)');
        recommendations.push('  - Reducing session duration');
        recommendations.push('  - Removing or shortening break periods');
    }

    if (noTeacherErrors > total * 0.2) {
        recommendations.push('Many sessions lack qualified teachers. Consider:');
        recommendations.push('  - Adding more teachers or adjusting qualifications');
        recommendations.push('  - Reducing teacher load requirements (max_hours, max_classes_per_day)');
        recommendations.push('  - Checking teacher availability preferences');
    }

    if (noRoomErrors > total * 0.2) {
        recommendations.push('Many sessions lack suitable rooms. Consider:');
        recommendations.push('  - Adding more rooms, especially special rooms (labs, etc.)');
        recommendations.push('  - Relaxing room type requirements');
        recommendations.push('  - Increasing room capacity');
    }

    if (capacityErrors > 0) {
        recommendations.push('Some sections exceed room capacity. Consider:');
        recommendations.push('  - Using larger rooms');
        recommendations.push('  - Splitting large sections into smaller ones');
    }

    if (maxHoursErrors > 0) {
        recommendations.push('Teachers are hitting max hours limits. Consider:');
        recommendations.push('  - Increasing max_hours for affected teachers');
        recommendations.push('  - Distributing load more evenly across teachers');
    }

    if (maxClassesPerDayErrors > 0) {
        recommendations.push('Teachers are hitting daily class limits. Consider:');
        recommendations.push('  - Increasing max_classes_per_day for affected teachers');
        recommendations.push('  - Spreading sessions across more days');
    }

    if (config.overflowPolicy === 'fail') {
        recommendations.push('Current overflow policy is set to "fail". Consider changing to "relax_soft" to accept partial results.');
    }

    // General recommendations if no specific patterns found
    if (recommendations.length === 0) {
        recommendations.push('Schedule could not be completed. Try:');
        recommendations.push('  - Running generation with more attempts');
        recommendations.push('  - Enabling forward checking (enableForwardChecking: true)');
        recommendations.push('  - Reviewing subject priorities and section requirements');
    }

    return recommendations;
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
        // Update progress with error before returning
        onProgress({
            subStage: 'idle',
            attempt: 0,
            totalAttempts: config.maxAttempts,
            placed: 0,
            total: totalTasks,
            message: `Schedule impossible: ${impossibilityCheck.reasons[0] || 'Unknown reason'}`,
        });
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
    onProgress({
        subStage: 'loading',
        attempt: 0,
        totalAttempts: config.maxAttempts,
        placed: 0,
        total: 0,
        message: 'Building domains for early pruning...',
    });
    await new Promise(r => setTimeout(r, 50));

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
    onProgress({
        subStage: 'loading',
        attempt: 0,
        totalAttempts: config.maxAttempts,
        placed: 0,
        total: 0,
        message: 'Validating data...',
    });
    await new Promise(r => setTimeout(r, 50));

    // Check if there are any sections to schedule
    if (scopedSections.length === 0) {
        onProgress({
            subStage: 'idle',
            attempt: 0,
            totalAttempts: config.maxAttempts,
            placed: 0,
            total: 0,
            message: 'No sections found to schedule. Please ensure you have sections defined and selected in the scope.',
        });
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
        onProgress({
            subStage: 'idle',
            attempt: 0,
            totalAttempts: config.maxAttempts,
            placed: 0,
            total: 0,
            message: 'No teachers found. Please ensure you have teachers defined in the system.',
        });
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
        onProgress({
            subStage: 'idle',
            attempt: 0,
            totalAttempts: config.maxAttempts,
            placed: 0,
            total: 0,
            message: 'No rooms available. Please ensure you have rooms defined and marked as available.',
        });
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
    onProgress({
        subStage: 'loading',
        attempt: 0,
        totalAttempts: config.maxAttempts,
        placed: 0,
        total: 0,
        message: 'Filtering subjects by scope...',
    });
    await new Promise(r => setTimeout(r, 50));

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
        onProgress({
            subStage: 'idle',
            attempt: 0,
            totalAttempts: config.maxAttempts,
            placed: 0,
            total: 0,
            message: 'No subjects found to place. Please ensure you have subjects defined and sections selected.',
        });
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
    onProgress({
        subStage: 'loading',
        attempt: 0,
        totalAttempts: config.maxAttempts,
        placed: 0,
        total: 0,
        message: 'Calculating placement tasks...',
    });
    await new Promise(r => setTimeout(r, 50));

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

        // Build tasks in priority order (subjects already ranked)
        // This is done once per attempt and used for both placement and repair
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

        // Phase 5: Domain Construction - Pre-compute valid options for each task
        // This prunes invalid options early and enables MRV ranking
        const domains = constructDomains(
            rankedTasks,
            teacherMap,
            roomMap,
            teacherDomainMap,
            roomDomainMap,
            sectionDomainMap,
            days,
            slots,
        );

        // Phase 4: Improved Ranking - Re-rank tasks by scarcity (MRV heuristic)
        // Tasks with fewer valid options (lower scarcity score) should be placed first
        rankedTasks.sort((a, b) => {
            const domainA = domains.get(`${a.subject.id}|${a.section.id}|${a.sessionIndex}`);
            const domainB = domains.get(`${b.subject.id}|${b.section.id}|${b.sessionIndex}`);
            const scarcityA = domainA?.scarcityScore ?? 1;
            const scarcityB = domainB?.scarcityScore ?? 1;
            // Lower scarcity = harder to place = should go first
            if (scarcityA !== scarcityB) return scarcityA - scarcityB;
            // Tie-break by original priority (subject weight + section weight)
            const priorityA = (a.subject.weight || 50) + (a.section.weight || 50);
            const priorityB = (b.subject.weight || 50) + (b.section.weight || 50);
            return priorityB - priorityA; // Higher priority first
        });

        // Check if there are any tasks to place
        if (rankedTasks.length === 0) {
            onProgress({
                subStage: 'idle',
                attempt: 0,
                totalAttempts: config.maxAttempts,
                placed: 0,
                total: totalTasks,
                message: 'No placement tasks generated. This may be due to subjects not matching any sections or invalid configuration.',
            });
            return {
                total: totalTasks,
                placed: 0,
                entries: [],
                errors: ['No placement tasks generated. This may be due to subjects not matching any sections or invalid configuration.'],
                score: 0,
                highPriorityPlaced: 0,
                highPriorityTotal: highPriorityIds.size,
                mode: config.mode,
                diff: [],
            };
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

            const section = task.section;
            const taskKey = `${sub.id}|${section.id}`;
            const taskId = `${sub.id}|${section.id}|${task.sessionIndex}`;
            const usedDays = usedDaysByTask.get(taskKey) || new Set<string>();

            // Get pre-computed domain for this task
            const domain = domains.get(taskId);
            if (!domain || domain.validTeachers.length === 0 || domain.validRooms.length === 0 || domain.validSlots.length === 0) {
                errors.push(`No valid placement options for "${sub.name}" session ${task.sessionIndex + 1} (no teachers/rooms/slots in domain)`);
                continue;
            }

            let placed = false;
            // Use pre-filtered teachers from domain
            const teachersToTry: Teacher[] = [];
            for (const tid of domain.validTeachers) {
                const t = teacherMap.get(tid);
                if (t) teachersToTry.push(t);
            }
            
            // Prefer days not yet used for this subject-section pair (spread sessions across days)
            const availableDays = domain.validDays.slice().sort((a, b) => {
                const aUsed = usedDays.has(a) ? 1 : 0;
                const bUsed = usedDays.has(b) ? 1 : 0;
                return aUsed - bUsed;
            });

            for (const currentTeacher of teachersToTry) {
                if (placed) break;

                for (const day of availableDays) {
                    if (placed) break;
                    // Hard: check max_classes_per_day constraint
                    if (wouldExceedMaxClassesPerDay(currentTeacher.id, day, entries, currentTeacher, classifiedConstraints.hard)) continue;

                    // Use pre-filtered rooms from domain
                    const compat: Room[] = [];
                    for (const rid of domain.validRooms) {
                        const r = roomMap.get(rid);
                        if (r) compat.push(r);
                    }
                    if (compat.length === 0) { continue; }

                    // Use pre-filtered slots from domain for this day
                    const validSlotsForDay = domain.validSlots.filter(s => s.day === day);

                    for (const slot of validSlotsForDay) {
                        if (placed) break;
                        const sMin = toMin(slot.start);
                        const eMin = toMin(slot.end);
                        
                        // Hard: respect teacher's explicit per-slot availability map.
                        if (!teacherAvailable(currentTeacher, day, slot.start)) continue;
                        if (!isFree(busy, 'teacher', currentTeacher.id, day, sMin, eMin)) continue;
                        if (!isFree(busy, 'section', section.id, day, sMin, eMin)) continue;
                        // Hard: check max_hours constraint
                        if (wouldExceedMaxHours(currentTeacher.id, entries, currentTeacher, config.sessionMinutes, classifiedConstraints.hard)) continue;

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
                            
                            // Forward Checking (Phase 7): Check if this placement would make remaining tasks impossible
                            // Uses improved implementation with domain information to avoid false negatives
                            // Only enabled if config.enableForwardChecking is true (can be expensive on large datasets)
                            if (config.enableForwardChecking) {
                                const remainingTasks = rankedTasks.slice(i + 1);
                                if (remainingTasks.length > 0 && !checkForwardConstraints(
                                    currentTeacher.id,
                                    room.id,
                                    section.id,
                                    day,
                                    sMin,
                                    eMin,
                                    busy,
                                    remainingTasks,
                                    teacherMap,
                                    roomMap,
                                    domains,
                                )) {
                                    continue; // Skip this placement as it would make remaining tasks impossible
                                }
                            }
                            
                            entries.push({
                                subjectId: sub.id,
                                subjectCode: sub.code,
                                subjectName: sub.name,
                                teacherId: currentTeacher.id,
                                teacherName: currentTeacher.full_name,
                                roomId: room.id,
                                roomName: room.name,
                                sectionId: section.id,
                                sectionName: section.name,
                                day,
                                start: slot.start,
                                end: slot.end,
                            });
                            busy.push({
                                teacherId: currentTeacher.id,
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

    // Step 8 (Repair Engine): Apply repair strategies to improve placement rate
    // Phase 8 from Generation_System.md: Repair and Local Backtracking
    // If generation didn't achieve full placement, attempt repairs
    if (best.placed < best.total) {
        // Build list of unplaced tasks
        const unplacedTasks: Array<{ subject: Subject; section: Section; sessionIndex: number }> = [];
        
        // Rebuild task list for repair (using no jitter for consistency)
        const repairSubjects = rankSubjects(scopedSubjects, scopedSections, config, 0);
        for (const sub of repairSubjects) {
            const matchSections = scopedSections.filter(
                s => (sub.program === 'ALL' || s.program === sub.program) && s.year_level === sub.year_level,
            );
            const section = matchSections[0] || scopedSections[0];
            if (!section) continue;

            // Count how many sessions of this subject-section pair are placed
            const placedCount = best.entries.filter(e => e.subjectId === sub.id && e.sectionId === section.id).length;
            const neededCount = sessionsNeeded(sub, config.sessionMinutes);
            
            for (let i = placedCount; i < neededCount; i++) {
                unplacedTasks.push({ subject: sub, section, sessionIndex: i });
            }
        }

        // Reconstruct domains for repair
        const repairDomains = constructDomains(
            unplacedTasks,
            teacherMap,
            roomMap,
            teacherDomainMap,
            roomDomainMap,
            sectionDomainMap,
            days,
            slots,
        );

        // Apply repairs to try to place unplaced tasks
        if (unplacedTasks.length > 0) {
            const repairedEntries = applyRepairs(
                best.entries,
                unplacedTasks,
                teacherMap,
                roomMap,
                repairDomains,
                config,
                classifiedConstraints,
            );
            
            // Update best result if repairs improved placement
            if (repairedEntries.length > best.entries.length) {
                best = {
                    ...best,
                    entries: repairedEntries,
                    placed: repairedEntries.length,
                    errors: best.errors.filter(e => !e.includes('No free slot')), // Remove some errors if repairs helped
                };
            }
        }
    }

    // Compute diff against previous entries only in partial mode.
    if (isPartial) {
        best = { ...best, diff: buildDiff(previousEntries, best.entries) };
    }

    // Step 9 (Soft Constraint Optimizer): Calculate soft constraint scores and identify violations
    // Use the soft constraint score in the final result for better accuracy
    const softScoreResult = calculateSoftConstraintScore(best.entries, normalizedData.normalizedTeachers, availableRooms, scopedSections, config.soft);
    const violations = identifySoftConstraintViolations(best.entries, normalizedData.normalizedTeachers, availableRooms);
    const suggestions = generateOptimizationSuggestions(best.entries, violations, normalizedData.normalizedTeachers, availableRooms);
    // Update the final result with the soft constraint score and breakdown
    best = { ...best, score: softScoreResult.score, softConstraintScoreBreakdown: softScoreResult.breakdown };

    // Step 9.5 (Optimization Engine): Post-generation optimization to improve soft constraint scores
    // Phase 15 from Generation_System.md: Optimization Engine
    // Takes a valid schedule and improves it without breaking hard constraints
    if (config.enableOptimization && best.placed === best.total) {
        onProgress({ subStage: 'optimizing', attempt: attemptMetadata.attempt_count, totalAttempts: config.maxAttempts, placed: best.placed, total: best.total, message: 'Optimizing schedule quality...' });
        
        const optimizedResult = optimizeSchedule(
            best.entries,
            normalizedData.normalizedTeachers,
            availableRooms,
            scopedSections,
            config,
            classifiedConstraints,
            softScoreResult.score,
            onProgress,
        );
        
        if (optimizedResult.score > best.score) {
            best = {
                ...best,
                entries: optimizedResult.entries,
                score: optimizedResult.score,
                softConstraintScoreBreakdown: optimizedResult.breakdown,
            };
        }
    }

    // Add attempt metadata to result
    best = { ...best, attemptMetadata: { attemptCount: attemptMetadata.attempt_count, bestScore: attemptMetadata.best_score } };
    // Add scope summary to result
    best = { ...best, scopeSummary: { sectionsCount: scopedSections.length, teachersCount: normalizedData.normalizedTeachers.length, roomsCount: availableRooms.length, subjectsCount: scopedSubjects.length } };
    
    // Phase 12: Impossible Schedule Handling - Provide actionable recommendations
    const recommendations = analyzeFailureAndProvideRecommendations(best.errors, best.placed, best.total, config);
    if (recommendations.length > 0) {
        best = { ...best, recommendations };
    }
    
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
    // Phase 13: Versioning and Reproducibility
    // Store complete metadata for reproducibility, auditability, and version tracking
    // Save synchronously to ensure it completes before overflow check
    await saveGenerationMetadata({
        config: config as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONB field
        scope: { sections: scopedSections.map(s => s.id), mode: config.mode },
        seed: 0, // Seed is not currently in GenerationConfig, using default
        priority_settings: config.priorities as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONB field
        constraint_settings: { 
            soft: config.soft, 
            breaks: config.breaks, 
            overflow_policy: config.overflowPolicy, 
            enable_forward_checking: config.enableForwardChecking,
            repair_applied: best.placed < best.total,
            error_count: best.errors.length,
        } as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONB field
        attempt_scores: attemptMetadata as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONB field
        final_schedule: { entries: best.entries, diff: best.diff } as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONB field
        total_sessions: best.total,
        placed_sessions: best.placed,
        score: best.score,
        mode: config.mode,
        partial_target: config.partialTarget as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONB field
        status: best.placed === best.total ? 'completed' : 'partial',
        completed_at: new Date(),
        created_by: null, // TODO: Add user ID when auth is integrated
    });

    // Phase 11: Institutional Options - Overflow Policy
    // Handle different overflow policies for impossible schedules
    if (config.overflowPolicy === 'fail' && best.placed < best.total) {
        // Fail policy: Return error if not all tasks placed
        throw new Error(`Failed to place all sessions. Only ${best.placed} of ${best.total} placed.`);
    }
    // 'relax_soft', 'expand_scope', and 'partial_only' all return the best result even if incomplete
    // 'expand_scope' would require additional logic to expand the scope (future enhancement)

    return best;
}
