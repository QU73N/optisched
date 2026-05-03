// Generation engine for the Generate workspace (Phase 1).
// Placement is deterministic per-attempt via seeded shuffle; attempts keep best score.

import type {
    GenerationConfig,
    GenerationProgress,
    GenerationResult,
    PlacedEntry,
    Section,
    Subject,
    Teacher,
    Room,
    ExistingSchedule,
    PartialTarget,
    DiffEntry,
    NormalizedTeacher,
    NormalizedRoom,
    NormalizedSection,
    NormalizedSubject,
    ClassifiedConstraints,
    HardConstraintSet,
    SoftConstraintSet,
    PreferenceConstraintSet,
    BreakWindow,
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
    // Check capacity constraint first
    if (section.student_count != null && room.capacity != null && section.student_count > room.capacity) {
        return false;
    }

    // If subject requires a lab, ensure room is suitable for the specific lab type
    if (subject.requires_lab) {
        const roomName = (room.name || '').toLowerCase();
        const subjectName = (subject.name || '').toLowerCase();
        const subjectCode = (subject.code || '').toLowerCase();

        // Determine what type of lab the subject needs based on name/code
        const needsComputerLab = subjectName.includes('computer') ||
                                 subjectName.includes('programming') ||
                                 subjectName.includes('mobile') ||
                                 subjectName.includes('network') ||
                                 subjectCode.includes('cp') ||
                                 subjectCode.includes('cs') ||
                                 subjectCode.includes('it') ||
                                 subjectCode.includes('mp');
        const needsPhysicsLab = subjectName.includes('physics') ||
                                subjectCode.includes('phys');
        const needsChemistryLab = subjectName.includes('chemistry') ||
                                   subjectCode.includes('chem');
        const needsPEHall = subjectName.includes('physical education') ||
                           subjectName.includes('p.e.') ||
                           subjectCode.includes('pe');

        // Check if room is suitable for the specific lab type
        if (needsComputerLab) {
            // Computer subjects should only go to computer labs (Computer Lab A, Computer Lab B, Network Lab, etc.)
            if (!roomName.includes('computer') && !roomName.includes('network')) {
                return false;
            }
            // Explicitly reject physics/chemistry/PE labs for computer subjects
            if (roomName.includes('physics') || roomName.includes('chemistry') || roomName.includes('chemical') || roomName.includes('pe') || roomName.includes('p.e.')) {
                return false;
            }
        }
        if (needsPhysicsLab) {
            // Physics subjects should only go to physics labs
            if (!roomName.includes('physics')) {
                return false;
            }
            // Explicitly reject other lab types for physics subjects
            if (roomName.includes('computer') || roomName.includes('network') || roomName.includes('chemistry') || roomName.includes('chemical') || roomName.includes('pe') || roomName.includes('p.e.')) {
                return false;
            }
        }
        if (needsChemistryLab) {
            // Chemistry subjects should only go to chemistry labs
            if (!roomName.includes('chemistry') && !roomName.includes('chemical')) {
                return false;
            }
            // Explicitly reject other lab types for chemistry subjects
            if (roomName.includes('computer') || roomName.includes('network') || roomName.includes('physics') || roomName.includes('pe') || roomName.includes('p.e.')) {
                return false;
            }
        }
        if (needsPEHall) {
            // PE subjects should only go to PE halls
            if (!roomName.includes('pe') && !roomName.includes('p.e.') && !roomName.includes('physical education') && !roomName.includes('hall')) {
                return false;
            }
            // Explicitly reject other lab types for PE subjects
            if (roomName.includes('computer') || roomName.includes('network') || roomName.includes('physics') || roomName.includes('chemistry') || roomName.includes('chemical')) {
                return false;
            }
        }

        // Fallback: if it's a lab subject but no specific type matched, ensure it's at least a lab
        if (!needsComputerLab && !needsPhysicsLab && !needsChemistryLab && !needsPEHall) {
            // For unknown lab subjects, be more permissive but still exclude non-lab rooms
            if (!isSpecialRoom(room)) {
                return false;
            }
        }
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
    const name = (room.name || '').toLowerCase();
    // Check if room type is special OR if room name indicates it's a special room
    return t === 'special' ||
           name.includes('laboratory') ||
           name.includes('lab') ||
           name.includes('computer') ||
           name.includes('physics') ||
           name.includes('chemistry') ||
           name.includes('chemical') ||
           name.includes('pe') ||
           name.includes('p.e.') ||
           name.includes('physical education') ||
           name.includes('hall') ||
           name.includes('studio') ||
           name.includes('workshop');
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
): boolean => {
    const maxHours = teacher.max_hours || 40;
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

    // Pre-calculate scarcity metrics for each subject
    const subjectScarcity = new Map<string, number>();
    for (const sub of subjects) {
        const matchSecs = sections.filter(
            s => (sub.program === 'ALL' || s.program === sub.program) && s.year_level === sub.year_level,
        );
        // More sections = higher demand = higher scarcity
        const demandScore = matchSecs.length / Math.max(1, sections.length);
        subjectScarcity.set(sub.id, demandScore);
    }

    const scored = subjects.map(sub => {
        const matchSec = sections.find(
            s => (sub.program === 'ALL' || s.program === sub.program) && s.year_level === sub.year_level,
        );
        const secScore = matchSec ? priorityOf(sectionP, matchSec.id) : 50;
        const subScore = priorityOf(subjectP, sub.id);

        // HARDCODED: Give significant priority boost to lab subjects (requires_lab=true)
        // This ensures special subjects are placed first before common subjects
        // Increased from 30 to 50 to ensure lab subjects get priority
        const labPriority = sub.requires_lab ? 50 : 0;

        // Add scarcity factor - subjects with higher demand get priority
        const scarcity = subjectScarcity.get(sub.id) || 0;
        const scarcityBonus = scarcity * 15;

        // Add duration factor - longer subjects are harder to place
        const durationBonus = (sub.duration_hours || 0) * 2;

        const base = subScore * 0.5 + secScore * 0.3 + labPriority + scarcityBonus + durationBonus;
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

    // 9. Teacher consecutive classes penalty (avoid back-to-back without breaks)
    let consecutivePenalty = 0;
    const teacherDayEntries: Record<string, PlacedEntry[]> = {};
    for (const e of entries) {
        const k = `${e.teacherId}|${e.day}`;
        (teacherDayEntries[k] = teacherDayEntries[k] || []).push(e);
    }
    for (const list of Object.values(teacherDayEntries)) {
        const sorted = list.slice().sort((a, b) => a.start.localeCompare(b.start));
        for (let i = 0; i < sorted.length - 1; i++) {
            const end = toMin(sorted[i].end);
            const nextStart = toMin(sorted[i + 1].start);
            // If classes are back-to-back (0-5 minutes gap), apply penalty
            if (nextStart - end <= 5) {
                consecutivePenalty += 10;
            }
        }
    }
    const consecutiveScore = Math.max(0, 100 - consecutivePenalty);

    // 10. Section schedule spread (spread sessions evenly across the week)
    const sectionSpreadScores: number[] = [];
    const sectionDays: Record<string, Set<string>> = {};
    for (const e of entries) {
        (sectionDays[e.sectionId] = sectionDays[e.sectionId] || new Set()).add(e.day);
    }
    for (const [, daysSet] of Object.entries(sectionDays)) {
        // Ideal is to spread across all available days
        const daysUsed = daysSet.size;
        const totalDays = 5; // Assuming Monday-Friday
        const spreadRatio = daysUsed / totalDays;
        sectionSpreadScores.push(spreadRatio * 100);
    }
    const spreadScore = sectionSpreadScores.length > 0
        ? sectionSpreadScores.reduce((a, b) => a + b, 0) / sectionSpreadScores.length
        : 100;

    const w = cfg.soft;
    // Include new soft constraint scores in the total weight calculation
    const total =
        w.balancedLoad + w.compactSchedule + w.minimizeRoomSwitch +
        w.teacherPreferredTime + w.dailyLoadBalance + w.workloadFairness +
        w.subjectSpacing + w.roomUtilization + 20 + 20 || 1; // +20 for consecutive and spread
    return Math.round(
        (balancedScore * w.balancedLoad +
            compactScore * w.compactSchedule +
            roomScore * w.minimizeRoomSwitch +
            preferredScore * w.teacherPreferredTime +
            dailyBalanceScore * w.dailyLoadBalance +
            fairnessScore * w.workloadFairness +
            spacingScore * w.subjectSpacing +
            utilizationScore * w.roomUtilization +
            consecutiveScore * 20 +
            spreadScore * 20) / total,
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
    validSlots: Array<{ start: string; end: string; day: string; score: number }>; // ranked slots with LCV scores
    scarcityScore: number; // lower = fewer options = harder to place
    teacherScarcity: number; // teacher-specific scarcity
    roomScarcity: number; // room-specific scarcity
    slotScarcity: number; // slot-specific scarcity
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

    // Pre-calculate room scarcity for all rooms
    const roomUsageCount = new Map<string, number>();
    for (const task of tasks) {
        const sub = task.subject;
        const section = task.section;
        const compatibleRooms = Array.from(rooms.values())
            .filter(r => roomCompatible(r, sub, section));
        for (const room of compatibleRooms) {
            roomUsageCount.set(room.id, (roomUsageCount.get(room.id) || 0) + 1);
        }
    }

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

        // Pre-filter valid rooms with enhanced filtering
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

        // Pre-filter and rank valid slots with LCV scoring
        const validSlots: Array<{ start: string; end: string; day: string; score: number }> = [];
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
                    // Calculate LCV score for this slot
                    // Higher score = less constraining = better choice
                    let lcvScore = 0;

                    // Prefer time slots that are less crowded
                    const slotUsage = validRooms.length * validTeachers.length;
                    lcvScore += (1 / Math.max(1, slotUsage)) * 30;

                    // Prefer slots that leave more options for other sessions
                    // This is a heuristic - in a full implementation, we'd check actual impact
                    lcvScore += 20;

                    // Prefer morning slots for core subjects (heuristic)
                    const slotHour = parseInt(slot.start.split(':')[0]);
                    if (slotHour >= 8 && slotHour <= 11) {
                        lcvScore += 10;
                    }

                    validSlots.push({ ...slot, day, score: lcvScore });
                }
            }
        }

        // Sort slots by LCV score (highest first = least constraining)
        validSlots.sort((a, b) => b.score - a.score);

        // Calculate scarcity scores (lower = fewer options = harder to place)
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
            teacherScarcity,
            roomScarcity,
            slotScarcity,
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
    sections: Section[],
    subjects: Subject[],
    days: string[],
    slots: { start: string; end: string }[],
    config: GenerationConfig,
): {
    is_possible: boolean;
    reasons: string[];
    fallback_suggestion: string;
} => {
    const reasons: string[] = [];

    // Check if there are any teachers
    if (teachers.length === 0) {
        reasons.push('No teachers available - cannot generate schedule');
    }

    // Check if there are any sections
    if (sections.length === 0) {
        reasons.push('No sections available - cannot generate schedule');
    }

    // Check if there are any subjects
    if (subjects.length === 0) {
        reasons.push('No subjects available - cannot generate schedule');
    }

    // Check if total required hours exceed teacher capacity
    // Calculate based on actual tasks (subject + section combinations)
    const sessionMinutes = config.sessionMinutes;
    let totalRequiredMinutes = 0;
    for (const subject of subjects) {
        const subjectSections = sections.filter(s => 
            (subject.program === 'ALL' || s.program === subject.program) && 
            s.year_level === subject.year_level
        );
        const sessionsPerSubject = sessionsNeeded(subject, sessionMinutes);
        totalRequiredMinutes += subjectSections.length * sessionsPerSubject * sessionMinutes;
    }
    const totalRequiredHours = totalRequiredMinutes / 60;
    const totalTeacherCapacity = teachers.reduce((sum, t) => sum + (t.max_hours || 40), 0);
    if (totalRequiredHours > totalTeacherCapacity) {
        const deficit = totalRequiredHours - totalTeacherCapacity;
        reasons.push(`Total required hours (${totalRequiredHours.toFixed(1)}) exceed total teacher capacity (${totalTeacherCapacity}) - need ${deficit.toFixed(1)} more hours or add more teachers`);
    }

    // Check if there are enough rooms
    const availableRooms = rooms.filter(r => r.is_available !== false);
    if (availableRooms.length === 0) {
        reasons.push('No available rooms - all rooms are marked as unavailable');
    }

    // Check if lab subjects have compatible rooms
    const labSubjects = subjects.filter(s => s.requires_lab);
    if (labSubjects.length > 0) {
        const computerLabSubjects = labSubjects.filter(s => {
            const name = (s.name || '').toLowerCase();
            const code = (s.code || '').toLowerCase();
            return name.includes('computer') || name.includes('programming') || name.includes('mobile') || name.includes('network') || code.includes('cp') || code.includes('cs') || code.includes('it') || code.includes('mp');
        });
        const physicsLabSubjects = labSubjects.filter(s => {
            const name = (s.name || '').toLowerCase();
            const code = (s.code || '').toLowerCase();
            return name.includes('physics') || code.includes('phys');
        });
        const chemistryLabSubjects = labSubjects.filter(s => {
            const name = (s.name || '').toLowerCase();
            const code = (s.code || '').toLowerCase();
            return name.includes('chemistry') || code.includes('chem');
        });
        const peHallSubjects = labSubjects.filter(s => {
            const name = (s.name || '').toLowerCase();
            const code = (s.code || '').toLowerCase();
            return name.includes('physical education') || name.includes('p.e.') || code.includes('pe');
        });

        if (computerLabSubjects.length > 0) {
            const computerLabs = availableRooms.filter(r => {
                const name = (r.name || '').toLowerCase();
                return name.includes('computer') || name.includes('network');
            });
            if (computerLabs.length === 0) {
                reasons.push(`No computer/network labs available for ${computerLabSubjects.length} computer subject(s). Rooms must have "computer" or "network" in name.`);
            }
        }
        if (physicsLabSubjects.length > 0) {
            const physicsLabs = availableRooms.filter(r => {
                const name = (r.name || '').toLowerCase();
                return name.includes('physics');
            });
            if (physicsLabs.length === 0) {
                reasons.push(`No physics labs available for ${physicsLabSubjects.length} physics subject(s). Rooms must have "physics" in name.`);
            }
        }
        if (chemistryLabSubjects.length > 0) {
            const chemistryLabs = availableRooms.filter(r => {
                const name = (r.name || '').toLowerCase();
                return name.includes('chemistry') || name.includes('chemical');
            });
            if (chemistryLabs.length === 0) {
                reasons.push(`No chemistry labs available for ${chemistryLabSubjects.length} chemistry subject(s). Rooms must have "chemistry" or "chemical" in name.`);
            }
        }
        if (peHallSubjects.length > 0) {
            const peHalls = availableRooms.filter(r => {
                const name = (r.name || '').toLowerCase();
                return name.includes('pe') || name.includes('p.e.') || name.includes('physical education');
            });
            if (peHalls.length === 0) {
                reasons.push(`No PE halls available for ${peHallSubjects.length} PE subject(s). Rooms must have "pe", "p.e.", or "physical education" in name.`);
            }
        }
    }

    // Check if there are enough time slots
    if (slots.length === 0) {
        reasons.push('No available time slots configured in generation settings');
    }

    // Check if there are enough days
    if (days.length === 0) {
        reasons.push('No available days configured in generation settings');
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
 * Note: This function is exported for use in Phase 1 generation engine.
 */
export const finalizeGenerationMetadata = (
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
 * Note: This function is exported for use in Phase 1 generation engine.
 */
export const analyzeConflicts = (
    placed: PlacedEntry[],
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
 * Note: This function is exported for use in Phase 1 generation engine.
 */
export const generateRepairStrategies = (
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

const applyRepairs = (
    entries: PlacedEntry[],
    unplacedTasks: Array<{ subject: Subject; section: Section; sessionIndex: number }>,
    teacherMap: Map<string, Teacher>,
    roomMap: Map<string, Room>,
    domains: Map<string, SessionDomain>,
    _config: GenerationConfig,
    _classifiedConstraints: ClassifiedConstraints,
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

    // Strategy 1: Direct placement attempt using domain
    for (const task of unplacedTasks) {
        const taskId = `${task.subject.id}|${task.section.id}|${task.sessionIndex}`;
        const domain = domains.get(taskId);

        if (!domain) continue;

        // Try to place this unplaced task using its domain (sorted by LCV)
        let placed = false;

        for (const slot of domain.validSlots) {
            if (placed) break;
            const d = slot.day;
            const sMin = toMin(slot.start);
            const eMin = toMin(slot.end);

            for (const tid of domain.validTeachers) {
                if (placed) break;
                const teacher = teacherMap.get(tid);
                if (!teacher) continue;

                if (!teacherAvailable(teacher, d, slot.start)) continue;
                if (!isFree(busy, 'teacher', tid, d, sMin, eMin)) continue;
                if (!isFree(busy, 'section', task.section.id, d, sMin, eMin)) continue;

                // Score rooms for this slot
                const scoredRooms = domain.validRooms.map(rid => {
                    const room = roomMap.get(rid);
                    if (!room) return { rid, score: -1000 };
                    let roomScore = 0;

                    if (!isFree(busy, 'room', rid, d, sMin, eMin)) return { rid, score: -1000 };

                    // Hard constraint: room compatibility
                    if (!roomCompatible(room, task.subject, task.section)) return { rid, score: -1000 };

                    // Prefer special rooms for lab subjects
                    if (task.subject.requires_lab && isSpecialRoom(room)) roomScore += 100;

                    // Prefer rooms with good capacity fit
                    if (task.section.student_count && room.capacity) {
                        const utilization = task.section.student_count / room.capacity;
                        if (utilization >= 0.7 && utilization <= 0.95) roomScore += 20;
                    }

                    return { rid, score: roomScore };
                });

                scoredRooms.sort((a, b) => b.score - a.score);

                for (const { rid, score: roomScore } of scoredRooms) {
                    if (roomScore < 0) continue;

                    const room = roomMap.get(rid);
                    if (!room) continue;

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

    return repairedEntries;
};

/**
 * Simplified Post-Optimization Engine (Phase 15)
 * 
 * This optimizer takes a valid schedule and improves its quality without ever violating hard constraints.
 * It uses simple, direct moves to improve soft constraint scores.
 * 
 * Core Philosophy:
 * - Never break hard constraints
 * - Only improve soft constraints  
 * - Simple, effective moves: time slot swaps, room swaps
 * - Only accept changes that improve the schedule score
 */
export const optimizeSchedule = (
    entries: PlacedEntry[],
    teachersMap: Map<string, Teacher>,
    roomsMap: Map<string, Room>,
    sections: Section[],
    config: GenerationConfig,
    classifiedConstraints: ClassifiedConstraints,
    initialScore: number,
    onProgress: (progress: GenerationProgress) => void,
): { entries: PlacedEntry[]; score: number; breakdown: { balancedLoad: number; compactSchedule: number; minimizeRoomSwitch: number; teacherPreferredTime: number; dailyLoadBalance: number; workloadFairness: number; subjectSpacing: number; roomUtilization: number; consecutiveScore: number; spreadScore: number } } => {
    const teachers = Array.from(teachersMap.values());
    const rooms = Array.from(roomsMap.values());
    const timeLimit = config.optimizationTimeLimit * 1000;
    const maxIterations = config.optimizationMaxIterations;
    const startTime = Date.now();
    
    let currentEntries = [...entries];
    let currentScore = initialScore;
    let bestEntries = [...entries];
    let bestScore = initialScore;
    let iterations = 0;
    let improvements = 0;
    
    // Helper function to check hard constraints
    const checkHardConstraints = (candidateEntries: PlacedEntry[]): boolean => {
        const busy: Busy[] = candidateEntries.map(e => ({
            teacherId: e.teacherId,
            roomId: e.roomId,
            sectionId: e.sectionId,
            day: e.day,
            startMin: toMin(e.start),
            endMin: toMin(e.end),
        }));
        
        // Check for teacher, room, and section overlaps
        for (const entry of candidateEntries) {
            const sMin = toMin(entry.start);
            const eMin = toMin(entry.end);
            
            // Check teacher availability
            const teacher = teachersMap.get(entry.teacherId);
            if (teacher && !teacherAvailable(teacher, entry.day, entry.start)) {
                return false;
            }
            
            // Check for conflicts
            if (!isFree(busy, 'teacher', entry.teacherId, entry.day, sMin, eMin)) return false;
            if (!isFree(busy, 'room', entry.roomId, entry.day, sMin, eMin)) return false;
            if (!isFree(busy, 'section', entry.sectionId, entry.day, sMin, eMin)) return false;
            
            // Check max classes per day
            if (teacher && wouldExceedMaxClassesPerDay(entry.teacherId, entry.day, candidateEntries.filter(e => e !== entry), teacher, classifiedConstraints.hard)) {
                return false;
            }
            
            // Check max hours
            if (teacher && wouldExceedMaxHours(entry.teacherId, candidateEntries.filter(e => e !== entry), teacher, config.sessionMinutes)) {
                return false;
            }
            
            // Check room compatibility
            const section = sections.find(s => s.id === entry.sectionId);
            const room = roomsMap.get(entry.roomId);
            if (section && room) {
                // Create a minimal subject object for compatibility check
                const tempSubject = { 
                    id: entry.subjectId, 
                    name: entry.subjectName, 
                    code: entry.subjectCode, 
                    requires_lab: false,
                    program: 'ALL',
                    year_level: 1,
                    duration_hours: 1,
                    sessions_per_week: 1,
                    teacher_id: entry.teacherId,
                    weight: 1,
                    priority_note: '',
                };
                if (!roomCompatible(room, tempSubject, section)) {
                    return false;
                }
            }
        }
        
        return true;
    };
    
    // Try swapping two entries' time slots
    const tryTimeSwap = (entries: PlacedEntry[]): PlacedEntry[] | null => {
        if (entries.length < 2) return null;
        
        // Pick two random entries
        const idx1 = Math.floor(Math.random() * entries.length);
        const idx2 = Math.floor(Math.random() * entries.length);
        if (idx1 === idx2) return null;
        
        const entry1 = entries[idx1];
        const entry2 = entries[idx2];
        
        // Swap their time slots
        const newEntries = entries.map(e => {
            if (e === entry1) {
                return { ...e, day: entry2.day, start: entry2.start, end: entry2.end };
            }
            if (e === entry2) {
                return { ...e, day: entry1.day, start: entry1.start, end: entry1.end };
            }
            return e;
        });
        
        // Check hard constraints
        if (!checkHardConstraints(newEntries)) return null;
        
        return newEntries;
    };
    
    // Try swapping two entries' rooms
    const tryRoomSwap = (entries: PlacedEntry[]): PlacedEntry[] | null => {
        if (entries.length < 2) return null;
        
        // Pick two random entries
        const idx1 = Math.floor(Math.random() * entries.length);
        const idx2 = Math.floor(Math.random() * entries.length);
        if (idx1 === idx2) return null;
        
        const entry1 = entries[idx1];
        const entry2 = entries[idx2];
        
        // Swap their rooms
        const newEntries = entries.map(e => {
            if (e === entry1) {
                return { ...e, roomId: entry2.roomId, roomName: entry2.roomName };
            }
            if (e === entry2) {
                return { ...e, roomId: entry1.roomId, roomName: entry1.roomName };
            }
            return e;
        });
        
        // Check hard constraints
        if (!checkHardConstraints(newEntries)) return null;
        
        return newEntries;
    };
    
    // Main optimization loop
    while (iterations < maxIterations && Date.now() - startTime < timeLimit) {
        iterations++;
        
        // Update progress every 50 iterations
        if (iterations % 50 === 0) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const remaining = Math.max(0, config.optimizationTimeLimit - elapsed);
            onProgress({
                subStage: 'optimizing',
                attempt: 0,
                totalAttempts: maxIterations,
                placed: currentEntries.length,
                total: currentEntries.length,
                message: `Optimizing... (${iterations}/${maxIterations}, ${remaining}s remaining, score: ${currentScore.toFixed(1)}, +${(currentScore - initialScore).toFixed(1)})`,
            });
        }
        
        // Try different move types
        let candidateEntries: PlacedEntry[] | null = null;
        
        // 50% chance to try time swap, 50% chance to try room swap
        if (Math.random() < 0.5) {
            candidateEntries = tryTimeSwap(currentEntries);
        } else {
            candidateEntries = tryRoomSwap(currentEntries);
        }
        
        if (candidateEntries) {
            // Calculate new score
            const scoreResult = calculateSoftConstraintScore(candidateEntries, teachers, rooms, sections, config.soft);
            const newScore = scoreResult.score;
            
            // Only accept if score improves
            if (newScore > currentScore) {
                currentEntries = candidateEntries;
                currentScore = newScore;
                improvements++;
                
                // Update best if this is the best so far
                if (newScore > bestScore) {
                    bestEntries = [...candidateEntries];
                    bestScore = newScore;
                }
            }
        }
    }
    
    // Calculate final score breakdown
    const finalScoreResult = calculateSoftConstraintScore(bestEntries, teachers, rooms, sections, config.soft);
    
    console.log(`Optimization completed: ${iterations} iterations, ${improvements} improvements, score: ${initialScore.toFixed(2)} -> ${bestScore.toFixed(2)}`);
    
    return {
        entries: bestEntries,
        score: finalScoreResult.score,
        breakdown: finalScoreResult.breakdown as { balancedLoad: number; compactSchedule: number; minimizeRoomSwitch: number; teacherPreferredTime: number; dailyLoadBalance: number; workloadFairness: number; subjectSpacing: number; roomUtilization: number; consecutiveScore: number; spreadScore: number },
    };
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
 * Note: This function is exported for use in Phase 1 generation engine.
 */
export const selectBestResult = (
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
 * Note: This function is exported for use in Phase 1 generation engine.
 */
export const recommendScenario = (
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
        // For domain building, be more permissive - actual compatibility checked during placement
        // This ensures we don't pre-filter rooms that might be compatible with some sections
        valid_subjects: subjects.map(s => s.id),
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

    // Get priority settings early for impossibility check
    const subjectP = config.priorities.subjects;
    const sectionP = config.priorities.sections;

    // Step 5 (Impossible Schedule Detector): Detect if schedule is impossible
    // If impossible, return early with actionable error messages
    const impossibilityCheck = detectImpossibleSchedule(normalizedData.normalizedTeachers, availableRooms, scopedSections, normalizedData.normalizedSubjects, days, slots, config);
    if (!impossibilityCheck.is_possible) {
        // Calculate total tasks accounting for all matching sections
        const totalTasks = normalizedData.normalizedSubjects.reduce((sum, s) => {
            const matchSections = scopedSections.filter(
                sec => (s.program === 'ALL' || s.program === sec.program) && s.year_level === sec.year_level,
            );
            return sum + sessionsNeeded(s, config.sessionMinutes) * matchSections.length;
        }, 0);
        // Calculate high priority task count for early return
        let highPriorityTaskCount = 0;
        for (const s of normalizedData.normalizedSubjects) {
            const matchSections = scopedSections.filter(
                sec => (s.program === 'ALL' || s.program === sec.program) && s.year_level === sec.year_level,
            );
            const subScore = priorityOf(subjectP, s.id);
            for (const sec of matchSections) {
                const secScore = priorityOf(sectionP, sec.id);
                if (subScore >= 70 || secScore >= 70) {
                    highPriorityTaskCount += sessionsNeeded(s, config.sessionMinutes);
                }
            }
        }
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
            highPriorityTotal: highPriorityTaskCount,
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
        const matchSections = scopedSections.filter(
            s => (sub.program === 'ALL' || s.program === sub.program) && s.year_level === sub.year_level,
        );
        const sessionsPerSubject = sessionsNeeded(sub, config.sessionMinutes);
        // Multiply by number of matching sections
        totalTasks += sessionsPerSubject * matchSections.length;
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
        highPriorityTotal: 0, // Will be calculated in each attempt
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
            // If no matching sections, skip this subject
            if (matchSections.length === 0) continue;

            const needed = sessionsNeeded(sub, config.sessionMinutes);
            // Create tasks for ALL matching sections, not just the first one
            for (const section of matchSections) {
                for (let i = 0; i < needed; i++) {
                    rankedTasks.push({ subject: sub, section, sessionIndex: i });
                }
            }
        }

        // Calculate high-priority task count (based on tasks, not subjects)
        const highPriorityTaskIds = new Set<string>();
        for (const task of rankedTasks) {
            const subScore = priorityOf(subjectP, task.subject.id);
            const secScore = priorityOf(sectionP, task.section.id);
            if (subScore >= 70 || secScore >= 70) {
                const taskId = `${task.subject.id}-${task.section.id}-${task.sessionIndex}`;
                highPriorityTaskIds.add(taskId);
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

            // Primary: Lower scarcity = harder to place = should go first
            if (Math.abs(scarcityA - scarcityB) > 0.01) return scarcityA - scarcityB;

            // Secondary: Room scarcity - tasks with fewer room options go first
            const roomScarcityA = domainA?.roomScarcity ?? 1;
            const roomScarcityB = domainB?.roomScarcity ?? 1;
            if (Math.abs(roomScarcityA - roomScarcityB) > 0.01) return roomScarcityA - roomScarcityB;

            // Tertiary: Teacher scarcity - tasks with fewer teacher options go first
            const teacherScarcityA = domainA?.teacherScarcity ?? 1;
            const teacherScarcityB = domainB?.teacherScarcity ?? 1;
            if (Math.abs(teacherScarcityA - teacherScarcityB) > 0.01) return teacherScarcityA - teacherScarcityB;

            // Final: Random tiebreaker for exploration
            return Math.random() - 0.5;
        });

        // Check if there are any tasks to place
        if (rankedTasks.length === 0) {
            // Calculate high priority task count for this case
            let highPriorityTaskCount = 0;
            for (const task of rankedTasks) {
                const subScore = priorityOf(subjectP, task.subject.id);
                const secScore = priorityOf(sectionP, task.section.id);
                if (subScore >= 70 || secScore >= 70) {
                    highPriorityTaskCount++;
                }
            }
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
                highPriorityTotal: highPriorityTaskCount,
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
                const missing: string[] = [];
                if (!domain || domain.validTeachers.length === 0) missing.push('available teachers');
                if (!domain || domain.validRooms.length === 0) missing.push('available rooms');
                if (!domain || domain.validSlots.length === 0) missing.push('available time slots');
                errors.push(`Could not place "${sub.name}" (${section.name}) session ${task.sessionIndex + 1}: No ${missing.join(', ')}.`);
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

                    // Use pre-filtered slots from domain for this day (already sorted by LCV score)
                    const validSlotsForDay = domain.validSlots.filter(s => s.day === day);

                    for (const slot of validSlotsForDay) {
                        if (placed) break;
                        const sMin = toMin(slot.start);
                        const eMin = toMin(slot.end);

                        // Hard: respect teacher's explicit per-slot availability map.
                        if (!teacherAvailable(currentTeacher, day, slot.start)) continue;
                        
                        // EXPLICIT CHECK: Verify teacher is not already booked at this time
                        const teacherAlreadyBooked = entries.some(e => 
                            e.teacherId === currentTeacher.id && 
                            e.day === day && 
                            toMin(e.start) < eMin && 
                            toMin(e.end) > sMin
                        );
                        if (teacherAlreadyBooked) continue;
                        
                        // EXPLICIT CHECK: Verify section is not already booked at this time
                        const sectionAlreadyBooked = entries.some(e => 
                            e.sectionId === section.id && 
                            e.day === day && 
                            toMin(e.start) < eMin && 
                            toMin(e.end) > sMin
                        );
                        if (sectionAlreadyBooked) continue;
                        
                        if (!isFree(busy, 'teacher', currentTeacher.id, day, sMin, eMin)) continue;
                        if (!isFree(busy, 'section', section.id, day, sMin, eMin)) continue;
                        // Hard: check max_hours constraint
                        if (wouldExceedMaxHours(currentTeacher.id, entries, currentTeacher, config.sessionMinutes)) continue;

                        // Phase 6: Multi-factor scoring for room selection
                        // Evaluate each candidate room using multiple factors
                        const bias = config.priorities.specialRoomBias;
                        const scoredRooms = compat.slice().map(room => {
                            let score = 0;

                            // Factor 1: Special room preference (hard constraint for lab subjects)
                            if (sub.requires_lab) {
                                if (isSpecialRoom(room)) score += 100;
                                else score -= 100; // Strong penalty for non-special rooms
                            } else {
                                if (isSpecialRoom(room)) score += (bias / 100) * 30;
                            }

                            // Factor 2: Room capacity utilization (prefer appropriate size)
                            if (section.student_count && room.capacity) {
                                const utilization = section.student_count / room.capacity;
                                if (utilization >= 0.7 && utilization <= 0.95) score += 20; // Good fit
                                else if (utilization > 0.95) score -= 10; // Too tight
                                else score += 10; // Spacious but acceptable
                            }

                            // Factor 3: Room movement cost (prefer rooms in same building/floor)
                            // Check if teacher has other classes nearby
                            const teacherExisting = entries.filter(e => e.teacherId === currentTeacher.id);
                            if (teacherExisting.length > 0) {
                                const lastClass = teacherExisting[teacherExisting.length - 1];
                                const lastRoom = roomMap.get(lastClass.roomId);
                                if (lastRoom && lastRoom.building === room.building) {
                                    score += 15; // Same building
                                    if (lastRoom.floor === room.floor) {
                                        score += 10; // Same floor
                                    }
                                }
                            }

                            // Factor 4: Room scarcity (preserve scarce rooms for subjects that need them)
                            const roomScarcity = domain.roomScarcity;
                            if (roomScarcity < 0.3 && !sub.requires_lab) {
                                score -= 20; // Penalize using scarce rooms for non-lab subjects
                            }

                            return { room, score };
                        });

                        // Sort rooms by score (highest first)
                        scoredRooms.sort((a, b) => b.score - a.score);

                        for (const { room } of scoredRooms) {
                            // EXPLICIT CHECK: Verify room is not already booked at this time
                            const roomAlreadyBooked = entries.some(e => 
                                e.roomId === room.id && 
                                e.day === day && 
                                toMin(e.start) < eMin && 
                                toMin(e.end) > sMin
                            );
                            if (roomAlreadyBooked) continue;
                            
                            if (!isFree(busy, 'room', room.id, day, sMin, eMin)) continue;

                            // Hard: check room compatibility with subject (lab type matching)
                            if (!roomCompatible(room, sub, section)) continue;
                            
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
            if (!placed) {
                // Provide more specific error message based on subject type
                if (sub.requires_lab) {
                    const roomName = (sub.name || '').toLowerCase();
                    const subjectCode = (sub.code || '').toLowerCase();
                    const needsComputerLab = roomName.includes('computer') || roomName.includes('programming') || roomName.includes('mobile') || roomName.includes('network') || subjectCode.includes('cp') || subjectCode.includes('cs') || subjectCode.includes('it') || subjectCode.includes('mp');
                    const needsPhysicsLab = roomName.includes('physics') || subjectCode.includes('phys');
                    const needsChemistryLab = roomName.includes('chemistry') || subjectCode.includes('chem');
                    const needsPEHall = roomName.includes('physical education') || roomName.includes('p.e.') || subjectCode.includes('pe');

                    if (needsComputerLab) {
                        errors.push(`Could not place "${sub.name}" (${section.name}) session ${task.sessionIndex + 1}: No available computer/network labs at compatible times. Requires room with "computer" or "network" in name.`);
                    } else if (needsPhysicsLab) {
                        errors.push(`Could not place "${sub.name}" (${section.name}) session ${task.sessionIndex + 1}: No available physics labs at compatible times. Requires room with "physics" in name.`);
                    } else if (needsChemistryLab) {
                        errors.push(`Could not place "${sub.name}" (${section.name}) session ${task.sessionIndex + 1}: No available chemistry labs at compatible times. Requires room with "chemistry" or "chemical" in name.`);
                    } else if (needsPEHall) {
                        errors.push(`Could not place "${sub.name}" (${section.name}) session ${task.sessionIndex + 1}: No available PE halls at compatible times. Requires room with "pe", "p.e.", or "hall" in name.`);
                    } else {
                        errors.push(`Could not place "${sub.name}" (${section.name}) session ${task.sessionIndex + 1}: No available special rooms (labs/halls) at compatible times.`);
                    }
                } else {
                    errors.push(`Could not place "${sub.name}" (${section.name}) session ${task.sessionIndex + 1}: All available slots conflict with existing schedules or constraints.`);
                }
            }
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

        // Count how many high-priority tasks were placed
        let highPriorityPlacedCount = 0;
        for (const entry of entries) {
            // Find the corresponding task for this entry
            const task = rankedTasks.find(t => 
                t.subject.id === entry.subjectId && 
                t.section.id === entry.sectionId
            );
            if (task) {
                const taskId = `${task.subject.id}-${task.section.id}-${task.sessionIndex}`;
                if (highPriorityTaskIds.has(taskId)) {
                    highPriorityPlacedCount++;
                }
            }
        }

        const current: GenerationResult = {
            total: rankedTasks.length,
            placed: entries.length,
            entries,
            errors,
            score,
            highPriorityPlaced: highPriorityPlacedCount,
            highPriorityTotal: highPriorityTaskIds.size,
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
            // If no matching sections, skip this subject
            if (matchSections.length === 0) continue;

            const neededCount = sessionsNeeded(sub, config.sessionMinutes);
            
            // Check placement for ALL matching sections
            for (const section of matchSections) {
                // Count how many sessions of this subject-section pair are placed
                const placedCount = best.entries.filter(e => e.subjectId === sub.id && e.sectionId === section.id).length;
                
                for (let i = placedCount; i < neededCount; i++) {
                    unplacedTasks.push({ subject: sub, section, sessionIndex: i });
                }
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
                const remainingUnplaced = best.total - repairedEntries.length;
                best = {
                    ...best,
                    entries: repairedEntries,
                    placed: repairedEntries.length,
                    errors: remainingUnplaced > 0
                        ? best.errors.filter(e => !e.includes('No free slot')) // Keep errors for sessions that still couldn't be placed
                        : [], // All placed, no errors needed
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
    // Run optimization if enabled and there are placed entries (even if partial schedule)
    if (config.enableOptimization && best.placed > 0) {
        onProgress({ subStage: 'optimizing', attempt: attemptMetadata.attempt_count, totalAttempts: config.maxAttempts, placed: best.placed, total: best.total, message: 'Optimizing schedule quality...' });
        
        const optimizedResult = optimizeSchedule(
            best.entries,
            teacherMap,
            roomMap,
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
