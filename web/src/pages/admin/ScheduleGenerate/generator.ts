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
} from './types';

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

const roomCompatible = (room: Room, subject: Subject, section: Section): boolean => {
    if (subject.requires_lab) {
        const t = (room.type || '').toLowerCase();
        if (!t.includes('lab')) return false;
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
    return t.includes('lab') || t.includes('special') || t.includes('studio');
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
): boolean => {
    if (!teacher.max_classes_per_day) return false;
    const dayCount = currentEntries.filter(e => e.teacherId === teacherId && e.day === day).length;
    return dayCount >= teacher.max_classes_per_day;
};

/** Check if placing this session would exceed teacher's max_hours (total weekly). */
const wouldExceedMaxHours = (
    teacherId: string,
    currentEntries: PlacedEntry[],
    teacher: Teacher,
    sessionMinutes: number,
): boolean => {
    if (!teacher.max_hours) return false;
    const totalHours = (currentEntries.filter(e => e.teacherId === teacherId).length * sessionMinutes) / 60;
    return totalHours >= teacher.max_hours;
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
            s => s.program === sub.program && s.year_level === sub.year_level,
        );
        const secScore = matchSec ? priorityOf(sectionP, matchSec.id) : 50;
        const subScore = priorityOf(subjectP, sub.id);
        const base = subScore * 0.6 + secScore * 0.4;
        const noise = (Math.random() - 0.5) * jitter;
        return { sub, score: base + noise };
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

/** Run the generator. Yields progress via onProgress; resolves with the best result. */
export async function runGenerator(
    input: GenerateInput,
    onProgress: ProgressFn,
): Promise<GenerationResult> {
    const { subjects, teachers, rooms, sections, existing, config } = input;

    const isPartial = config.mode === 'partial' && !!config.partialTarget;
    const target = isPartial ? config.partialTarget : null;

    // Lookup maps used for diff + room scoping.
    const subjectMap = new Map(subjects.map(s => [s.id, s]));
    const teacherMap = new Map(teachers.map(t => [t.id, t]));
    const roomMap    = new Map(rooms.map(r => [r.id, r]));
    const sectionMap = new Map(sections.map(s => [s.id, s]));

    // Scope: restrict by selected sections (full mode) or by target (partial mode).
    let scopedSections: Section[];
    if (isPartial && target) {
        if (target.kind === 'section') {
            const s = sectionMap.get(target.id);
            scopedSections = s ? [s] : [];
        } else if (target.kind === 'subject') {
            const sub = subjectMap.get(target.id);
            scopedSections = sub ? sections.filter(s => s.program === sub.program && s.year_level === sub.year_level) : [];
        } else {
            // teacher or room: keep all sections in play; subjects will be filtered later.
            scopedSections = sections;
        }
    } else {
        scopedSections = config.sectionIds.length
            ? sections.filter(s => config.sectionIds.includes(s.id))
            : sections;
    }
    const scopedSectionIds = new Set(scopedSections.map(s => s.id));

    // Available rooms: in room-partial mode, restrict to the target room only.
    const availableRooms = (isPartial && target?.kind === 'room')
        ? rooms.filter(r => r.id === target.id && r.is_available !== false)
        : rooms.filter(r => r.is_available !== false);
    const slots = buildSlots(config);
    const days = config.days.length ? config.days : ['Monday'];

    onProgress({
        subStage: 'loading',
        attempt: 0,
        totalAttempts: config.maxAttempts,
        placed: 0,
        total: 0,
        message: `Loading data. ${scopedSections.length} sections, ${availableRooms.length} rooms, ${teachers.length} teachers`,
    });
    await new Promise(r => setTimeout(r, 120));

    // Candidates: subjects that need a slot for any scoped section.
    // We replicate the old behavior (one placement per subject matched to first section).
    let scopedSubjects = subjects.filter(sub => {
        const hasSection = scopedSections.some(
            s => s.program === sub.program && s.year_level === sub.year_level,
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

    // Expand subjects into placement tasks based on sessions_needed (split sessions).
    interface PlacementTask {
        subject: Subject;
        section: Section;
        sessionIndex: number; // 0-based index for this subject-section pair
    }

    onProgress({
        subStage: 'ranking',
        attempt: 0,
        totalAttempts: config.maxAttempts,
        placed: 0,
        total: scopedSubjects.length,
        message: `Ranking ${scopedSubjects.length} subjects`,
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
            const sec = scopedSections.find(x => x.program === s.program && x.year_level === s.year_level);
            const subScore = priorityOf(subjectP, s.id);
            const secScore = sec ? priorityOf(sectionP, sec.id) : 50;
            return subScore >= 70 || secScore >= 70;
        }).map(s => s.id),
    );

    // Calculate total tasks needed for split sessions
    let totalTasks = 0;
    for (const sub of scopedSubjects) {
        totalTasks += sessionsNeeded(sub, config.sessionMinutes);
    }

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
                s => s.program === sub.program && s.year_level === sub.year_level,
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
                ? teachers.find(t => t.id === sub.teacher_id)
                : teachers[Math.floor(Math.random() * teachers.length)];
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
                if (wouldExceedMaxClassesPerDay(teacher.id, day, entries, teacher)) continue;
                for (const slot of slots) {
                    if (placed) break;
                    const sMin = toMin(slot.start);
                    const eMin = toMin(slot.end);
                    // Hard: respect teacher's explicit per-slot availability map.
                    if (!teacherAvailable(teacher, day, slot.start)) continue;
                    if (!isFree(busy, 'teacher', teacher.id, day, sMin, eMin)) continue;
                    if (!isFree(busy, 'section', section.id, day, sMin, eMin)) continue;
                    // Hard: check max_hours constraint
                    if (wouldExceedMaxHours(teacher.id, entries, teacher, config.sessionMinutes)) continue;

                    const compat = availableRooms.filter(r => roomCompatible(r, sub, section));
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
        if (best.placed === best.total && best.score >= 85) break;
    }

    // Compute diff against previous entries only in partial mode.
    if (isPartial) {
        best = { ...best, diff: buildDiff(previousEntries, best.entries) };
    }

    onProgress({
        subStage: 'done',
        attempt: config.maxAttempts,
        totalAttempts: config.maxAttempts,
        placed: best.placed,
        total: best.total,
        message: `Done. ${best.placed} of ${best.total} placed, score ${best.score}.`,
    });

    return best;
}
