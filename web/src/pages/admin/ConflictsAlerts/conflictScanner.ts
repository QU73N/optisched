/**
 * Comprehensive Hard Constraint Scanner
 * Checks all hard constraints defined in the generation system
 */

import type {
    Schedule,
    Teacher,
    Room,
    Section,
    Subject,
} from '../../../types/database';

// Constants for constraint checking
const CONSECUTIVE_CLASS_GAP_TOLERANCE_MINUTES = 15;

// Helper function to get teacher name from profile or fall back to ID
const getTeacherName = (teacher: Teacher | undefined): string => {
    if (!teacher) return 'Unknown Teacher';
    return teacher.profile?.full_name || teacher.id;
};

export interface HardConstraintViolation {
    id: string;
    type: 'teacher_overlap' | 'room_overlap' | 'section_overlap'
        | 'room_capacity_exceeded' | 'room_subject_incompatible'
        | 'teacher_unqualified' | 'teacher_unavailable'
        | 'max_consecutive_hours' | 'max_daily_hours' | 'max_daily_classes'
        | 'max_weekly_hours' | 'break_violation' | 'fixed_time_violation'
        | 'locked_schedule_violation' | 'subject_room_inconsistency';
    severity: 'critical' | 'high' | 'medium';
    title: string;
    description: string;
    day?: string;
    scheduleIds: string[];
    affectedEntities: {
        type: 'teacher' | 'room' | 'section' | 'subject';
        id: string;
        name: string;
    }[];
    metrics?: {
        current: number;
        limit: number;
        unit: string;
    };
}

export interface SoftConstraintScore {
    totalScore: number;
    maxScore: number;
    breakdown: {
        balancedLoad: { score: number; max: number; violations: string[] };
        compactSchedule: { score: number; max: number; violations: string[] };
        minimizeRoomSwitch: { score: number; max: number; violations: string[] };
        teacherPreferredTime: { score: number; max: number; violations: string[] };
        dailyLoadBalance: { score: number; max: number; violations: string[] };
        workloadFairness: { score: number; max: number; violations: string[] };
        subjectSpacing: { score: number; max: number; violations: string[] };
        roomUtilization: { score: number; max: number; violations: string[] };
    };
}

export interface ScanResult {
    hardViolations: HardConstraintViolation[];
    softScore: SoftConstraintScore;
    totalSchedules: number;
    scannedAt: string;
}

export interface ScanProgressCallback {
    (progress: {
        current: number;
        total: number;
        currentPhase: string;
    }): void;
}

const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

const timesOverlap = (s1: string, e1: string, s2: string, e2: string) => {
    return s1 < e2 && s2 < e1;
};

const timesOverlapMin = (s1: number, e1: number, s2: number, e2: number) => {
    return s1 < e2 && s2 < e1;
};

/**
 * Main scanner function - checks all hard constraints and computes soft score
 */
export const scanAllConstraints = async (
    schedules: Schedule[],
    teachers: Teacher[],
    rooms: Room[],
    sections: Section[],
    subjects: Subject[],
    constraints: {
        maxConsecutiveHours: number;
        maxDailyHours: number;
        maxDailyClasses: number;
        maxWeeklyHours: number;
        breakWindows: { start: string; end: string }[];
    },
    onProgress?: ScanProgressCallback
): Promise<ScanResult> => {
    const violations: HardConstraintViolation[] = [];
    const seen = new Set<string>();
    
    // Define scanning phases for progress tracking
    const totalPhases = 13;
    let currentPhase = 0;

    const reportProgress = (phaseName: string) => {
        currentPhase++;
        if (onProgress) {
            onProgress({
                current: currentPhase,
                total: totalPhases,
                currentPhase: phaseName,
            });
        }
    };

    // Build maps
    reportProgress('Building data maps');
    const teacherMap = new Map(teachers.map(t => [t.id, t]));
    const roomMap = new Map(rooms.map(r => [r.id, r]));
    const sectionMap = new Map(sections.map(s => [s.id, s]));
    const subjectMap = new Map(subjects.map(s => [s.id, s]));

    // Group schedules by day for easier analysis
    const byDay = new Map<string, Schedule[]>();
    for (const s of schedules) {
        if (!byDay.has(s.day_of_week)) byDay.set(s.day_of_week, []);
        byDay.get(s.day_of_week)!.push(s);
    }

    // 1. Teacher Overlap
    reportProgress('Checking teacher overlaps');
    for (const [day, daySchedules] of byDay) {
        for (let i = 0; i < daySchedules.length; i++) {
            for (let j = i + 1; j < daySchedules.length; j++) {
                const a = daySchedules[i];
                const b = daySchedules[j];

                if (!a.teacher_id || !b.teacher_id || a.teacher_id !== b.teacher_id) continue;
                if (!timesOverlap(a.start_time, a.end_time, b.start_time, b.end_time)) continue;

                const key = `teacher_overlap_${a.teacher_id}_${day}_${[a.id, b.id].sort().join('_')}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    const teacher = teacherMap.get(a.teacher_id);
                    const subjectA = a.subject_id ? subjectMap.get(a.subject_id) : null;
                    const subjectB = b.subject_id ? subjectMap.get(b.subject_id) : null;
                    violations.push({
                        id: key,
                        type: 'teacher_overlap',
                        severity: 'critical',
                        title: `Teacher Overlap: ${getTeacherName(teacher)}`,
                        description: `Teacher ${getTeacherName(teacher)} is scheduled for ${subjectA?.name || a.subject_id || 'Unknown'} (${a.start_time}-${a.end_time}) and ${subjectB?.name || b.subject_id || 'Unknown'} (${b.start_time}-${b.end_time}) at the same time on ${day}.`,
                        day,
                        scheduleIds: [a.id, b.id],
                        affectedEntities: [
                            { type: 'teacher', id: a.teacher_id, name: getTeacherName(teacher) },
                        ],
                    });
                }
            }
        }
    }

    // 2. Room Overlap
    reportProgress('Checking room overlaps');
    for (const [day, daySchedules] of byDay) {
        for (let i = 0; i < daySchedules.length; i++) {
            for (let j = i + 1; j < daySchedules.length; j++) {
                const a = daySchedules[i];
                const b = daySchedules[j];

                if (!a.room_id || !b.room_id || a.room_id !== b.room_id) continue;
                if (!timesOverlap(a.start_time, a.end_time, b.start_time, b.end_time)) continue;

                const key = `room_overlap_${a.room_id}_${day}_${[a.id, b.id].sort().join('_')}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    const room = roomMap.get(a.room_id);
                    const subjectA = a.subject_id ? subjectMap.get(a.subject_id) : null;
                    const subjectB = b.subject_id ? subjectMap.get(b.subject_id) : null;
                    violations.push({
                        id: key,
                        type: 'room_overlap',
                        severity: 'high',
                        title: `Room Overlap: ${room?.name || 'Unknown Room'}`,
                        description: `${room?.name || 'Room'} is double-booked with ${subjectA?.name || a.subject_id || 'Unknown'} and ${subjectB?.name || b.subject_id || 'Unknown'} at the same time on ${day}.`,
                        day,
                        scheduleIds: [a.id, b.id],
                        affectedEntities: [
                            { type: 'room', id: a.room_id, name: room?.name || 'Unknown' },
                        ],
                    });
                }
            }
        }
    }

    // 3. Section Overlap
    reportProgress('Checking section overlaps');
    for (const [day, daySchedules] of byDay) {
        for (let i = 0; i < daySchedules.length; i++) {
            for (let j = i + 1; j < daySchedules.length; j++) {
                const a = daySchedules[i];
                const b = daySchedules[j];

                if (!a.section_id || !b.section_id || a.section_id !== b.section_id) continue;
                if (!timesOverlap(a.start_time, a.end_time, b.start_time, b.end_time)) continue;

                const key = `section_overlap_${a.section_id}_${day}_${[a.id, b.id].sort().join('_')}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    const section = sectionMap.get(a.section_id);
                    const subjectA = a.subject_id ? subjectMap.get(a.subject_id) : null;
                    const subjectB = b.subject_id ? subjectMap.get(b.subject_id) : null;
                    violations.push({
                        id: key,
                        type: 'section_overlap',
                        severity: 'high',
                        title: `Section Overlap: ${section?.name || 'Unknown Section'}`,
                        description: `${section?.name || 'Section'} has ${subjectA?.name || a.subject_id || 'Unknown'} (${a.start_time}-${a.end_time}) and ${subjectB?.name || b.subject_id || 'Unknown'} (${b.start_time}-${b.end_time}) scheduled at the same time on ${day}.`,
                        day,
                        scheduleIds: [a.id, b.id],
                        affectedEntities: [
                            { type: 'section', id: a.section_id, name: section?.name || 'Unknown' },
                        ],
                    });
                }
            }
        }
    }

    // 4. Room Capacity
    reportProgress('Checking room capacity');
    for (const s of schedules) {
        if (!s.room_id) continue;
        const room = roomMap.get(s.room_id);
        const section = s.section_id ? sectionMap.get(s.section_id) : null;
        const subject = s.subject_id ? subjectMap.get(s.subject_id) : null;
        
        if (room && section && room.capacity < 1) { // Placeholder check
            const key = `capacity_${s.id}`;
            if (!seen.has(key)) {
                seen.add(key);
                violations.push({
                    id: key,
                    type: 'room_capacity_exceeded',
                    severity: 'high',
                    title: `Room Capacity Exceeded: ${room.name}`,
                    description: `Section size exceeds room capacity for ${subject?.name || s.subject_id || 'Unknown'}.`,
                    day: s.day_of_week,
                    scheduleIds: [s.id],
                    affectedEntities: [
                        { type: 'room', id: room.id, name: room.name },
                    ],
                });
            }
        }
    }

    // 5. Room-Subject Compatibility
    reportProgress('Checking room-subject compatibility');
    for (const s of schedules) {
        if (!s.room_id || !s.subject_id) continue;
        const room = roomMap.get(s.room_id);
        const subject = subjectMap.get(s.subject_id);

        if (room && subject) {
            // Check if room type matches subject type
            if (subject.type === 'special' && room.type !== 'special') {
                const key = `room_type_${s.id}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    violations.push({
                        id: key,
                        type: 'room_subject_incompatible',
                        severity: 'medium',
                        title: `Room Type Mismatch`,
                        description: `Subject requires special room but assigned to ${room.name}.`,
                        day: s.day_of_week,
                        scheduleIds: [s.id],
                        affectedEntities: [
                            { type: 'room', id: room.id, name: room.name },
                            { type: 'subject', id: subject.id, name: subject.name },
                        ],
                    });
                }
            }
        }
    }

    // 6. Subject Room Consistency
    reportProgress('Checking subject room consistency');
    for (const [day, daySchedules] of byDay) {
        // Group schedules by subject + section
        const subjectSectionMap = new Map<string, { schedules: Schedule[]; rooms: Set<string> }>();
        
        for (const s of daySchedules) {
            if (!s.subject_id || !s.section_id) continue;
            const key = `${s.subject_id}_${s.section_id}`;
            
            if (!subjectSectionMap.has(key)) {
                subjectSectionMap.set(key, { schedules: [], rooms: new Set() });
            }
            
            const entry = subjectSectionMap.get(key)!;
            entry.schedules.push(s);
            if (s.room_id) {
                entry.rooms.add(s.room_id);
            }
        }
        
        // Check if any subject+section has multiple rooms on the same day
        for (const [key, entry] of subjectSectionMap) {
            if (entry.rooms.size > 1) {
                const [subjectId, sectionId] = key.split('_');
                const subject = subjectMap.get(subjectId);
                const section = sectionMap.get(sectionId);
                const roomIds = Array.from(entry.rooms);
                
                const violationKey = `subject_room_inconsistency_${key}_${day}`;
                if (!seen.has(violationKey)) {
                    seen.add(violationKey);
                    violations.push({
                        id: violationKey,
                        type: 'subject_room_inconsistency',
                        severity: 'high',
                        title: `Subject Split Across Rooms: ${subject?.name || 'Unknown Subject'}`,
                        description: `${subject?.name || 'Subject'} for ${section?.name || 'Section'} is scheduled in multiple rooms (${roomIds.length} different rooms) on ${day}. All sessions for a subject must be in the same room on the same day.`,
                        day,
                        scheduleIds: entry.schedules.map(s => s.id),
                        affectedEntities: [
                            { type: 'subject', id: subjectId, name: subject?.name || 'Unknown' },
                            { type: 'section', id: sectionId, name: section?.name || 'Unknown' },
                            ...roomIds.map(roomId => ({ type: 'room' as const, id: roomId, name: roomMap.get(roomId)?.name || 'Unknown' })),
                        ],
                    });
                }
            }
        }
    }

    // 7. Teacher Qualification
    reportProgress('Checking teacher qualifications');
    for (const s of schedules) {
        if (!s.teacher_id || !s.subject_id) continue;
        const teacher = teacherMap.get(s.teacher_id);
        const subject = subjectMap.get(s.subject_id);

        if (teacher && subject && subject.teacher_id && teacher.id !== subject.teacher_id) {
            const key = `qual_${s.id}`;
            if (!seen.has(key)) {
                seen.add(key);
                violations.push({
                    id: key,
                    type: 'teacher_unqualified',
                    severity: 'high',
                    title: `Teacher Qualification Mismatch`,
                    description: `Teacher ${getTeacherName(teacher)} is assigned to ${subject.name} (${subject.code}) which has a different preferred teacher.`,
                    day: s.day_of_week,
                    scheduleIds: [s.id],
                    affectedEntities: [
                        { type: 'teacher', id: teacher.id, name: getTeacherName(teacher) },
                        { type: 'subject', id: subject.id, name: subject.name },
                    ],
                });
            }
        }
    }

    // 8. Teacher Availability (placeholder - requires teacher_preferences table)
    // Skipped since unavailable_slots doesn't exist in Teacher type
    // This would need to be implemented using teacher_preferences table

    // 9. Max Consecutive Hours Per Day (Teacher)
    reportProgress('Checking consecutive hours');
    for (const [day, daySchedules] of byDay) {
        const teacherSessions = new Map<string, { start: number; end: number }[]>();
        
        for (const s of daySchedules) {
            if (!s.teacher_id) continue;
            if (!teacherSessions.has(s.teacher_id)) {
                teacherSessions.set(s.teacher_id, []);
            }
            teacherSessions.get(s.teacher_id)!.push({
                start: toMin(s.start_time),
                end: toMin(s.end_time),
            });
        }

        for (const [teacherId, sessions] of teacherSessions) {
            // Sort by start time - create a copy to avoid mutating the stored array
            const sortedSessions = [...sessions].sort((a, b) => a.start - b.start);
            
            // Find max consecutive
            let maxConsecutive = 0;
            let currentConsecutive = 0;
            let lastEnd = -1;

            for (const sess of sortedSessions) {
                if (lastEnd >= 0 && sess.start - lastEnd <= CONSECUTIVE_CLASS_GAP_TOLERANCE_MINUTES) {
                    currentConsecutive += (sess.end - sess.start) / 60;
                } else {
                    currentConsecutive = (sess.end - sess.start) / 60;
                }
                maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
                lastEnd = sess.end;
            }

            if (maxConsecutive > constraints.maxConsecutiveHours) {
                const teacher = teacherMap.get(teacherId);
                if (teacher) {
                    const key = `max_consecutive_${teacherId}_${day}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        violations.push({
                            id: key,
                            type: 'max_consecutive_hours',
                            severity: 'medium',
                            title: `Max Consecutive Hours Exceeded`,
                            description: `Teacher ${getTeacherName(teacher)} has ${maxConsecutive.toFixed(1)} consecutive hours on ${day}, exceeding the limit of ${constraints.maxConsecutiveHours} hours.`,
                            day,
                            scheduleIds: daySchedules.filter(s => s.teacher_id === teacherId).map(s => s.id),
                            affectedEntities: [
                                { type: 'teacher', id: teacherId, name: getTeacherName(teacher) },
                            ],
                            metrics: {
                                current: maxConsecutive,
                                limit: constraints.maxConsecutiveHours,
                                unit: 'hours',
                            },
                        });
                    }
                }
            }
        }
    }

    // 10. Max Daily Hours (Teacher)
    reportProgress('Checking daily hours');
    for (const [day, daySchedules] of byDay) {
        const teacherHours = new Map<string, number>();
        
        for (const s of daySchedules) {
            if (!s.teacher_id) continue;
            const hours = (toMin(s.end_time) - toMin(s.start_time)) / 60;
            teacherHours.set(s.teacher_id, (teacherHours.get(s.teacher_id) || 0) + hours);
        }

        for (const [teacherId, hours] of teacherHours) {
            if (hours > constraints.maxDailyHours) {
                const teacher = teacherMap.get(teacherId);
                if (teacher) {
                    const key = `max_daily_hours_${teacherId}_${day}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        violations.push({
                            id: key,
                            type: 'max_daily_hours',
                            severity: 'high',
                            title: `Max Daily Hours Exceeded`,
                            description: `Teacher ${getTeacherName(teacher)} has ${hours.toFixed(1)} hours on ${day}, exceeding the limit of ${constraints.maxDailyHours} hours.`,
                            day,
                            scheduleIds: daySchedules.filter(s => s.teacher_id === teacherId).map(s => s.id),
                            affectedEntities: [
                                { type: 'teacher', id: teacherId, name: getTeacherName(teacher) },
                            ],
                            metrics: {
                                current: hours,
                                limit: constraints.maxDailyHours,
                                unit: 'hours',
                            },
                        });
                    }
                }
            }
        }
    }

    // 11. Max Daily Classes (Teacher)
    reportProgress('Checking daily classes');
    for (const [day, daySchedules] of byDay) {
        const teacherClasses = new Map<string, number>();
        
        for (const s of daySchedules) {
            if (!s.teacher_id) continue;
            teacherClasses.set(s.teacher_id, (teacherClasses.get(s.teacher_id) || 0) + 1);
        }

        for (const [teacherId, count] of teacherClasses) {
            if (count > constraints.maxDailyClasses) {
                const teacher = teacherMap.get(teacherId);
                if (teacher) {
                    const key = `max_daily_classes_${teacherId}_${day}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        violations.push({
                            id: key,
                            type: 'max_daily_classes',
                            severity: 'medium',
                            title: `Max Daily Classes Exceeded`,
                            description: `Teacher ${getTeacherName(teacher)} has ${count} classes on ${day}, exceeding the limit of ${constraints.maxDailyClasses} classes.`,
                            day,
                            scheduleIds: daySchedules.filter(s => s.teacher_id === teacherId).map(s => s.id),
                            affectedEntities: [
                                { type: 'teacher', id: teacherId, name: getTeacherName(teacher) },
                            ],
                            metrics: {
                                current: count,
                                limit: constraints.maxDailyClasses,
                                unit: 'classes',
                            },
                        });
                    }
                }
            }
        }
    }

    // 12. Max Weekly Hours (Teacher)
    reportProgress('Checking weekly hours');
    const teacherWeeklyHours = new Map<string, number>();
    for (const s of schedules) {
        if (!s.teacher_id) continue;
        const hours = (toMin(s.end_time) - toMin(s.start_time)) / 60;
        teacherWeeklyHours.set(s.teacher_id, (teacherWeeklyHours.get(s.teacher_id) || 0) + hours);
    }

    for (const [teacherId, hours] of teacherWeeklyHours) {
        if (hours > constraints.maxWeeklyHours) {
            const teacher = teacherMap.get(teacherId);
            if (teacher) {
                const key = `max_weekly_hours_${teacherId}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    violations.push({
                        id: key,
                        type: 'max_weekly_hours',
                        severity: 'high',
                        title: `Max Weekly Hours Exceeded`,
                        description: `Teacher ${getTeacherName(teacher)} has ${hours.toFixed(1)} hours total this week, exceeding the limit of ${constraints.maxWeeklyHours} hours.`,
                        scheduleIds: schedules.filter(s => s.teacher_id === teacherId).map(s => s.id),
                        affectedEntities: [
                            { type: 'teacher', id: teacherId, name: getTeacherName(teacher) },
                        ],
                        metrics: {
                            current: hours,
                            limit: constraints.maxWeeklyHours,
                            unit: 'hours',
                        },
                    });
                }
            }
        }
    }

    // 13. Break Enforcement
    reportProgress('Checking break violations');
    if (constraints.breakWindows.length > 0) {
        for (const s of schedules) {
            const sMin = toMin(s.start_time);
            const eMin = toMin(s.end_time);

            for (const b of constraints.breakWindows) {
                const bMin = toMin(b.start);
                const bEnd = toMin(b.end);

                if (timesOverlapMin(sMin, eMin, bMin, bEnd)) {
                    const key = `break_violation_${s.id}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        violations.push({
                            id: key,
                            type: 'break_violation',
                            severity: 'medium',
                            title: `Break Violation`,
                            description: `Session scheduled during break time (${b.start}-${b.end}) on ${s.day_of_week}.`,
                            day: s.day_of_week,
                            scheduleIds: [s.id],
                            affectedEntities: [],
                        });
                    }
                }
            }
        }
    }

    // Compute soft score
    reportProgress('Computing soft score');
    const softScore = computeSoftScore(schedules, teachers, rooms, sections);

    return {
        hardViolations: violations,
        softScore,
        totalSchedules: schedules.length,
        scannedAt: new Date().toISOString(),
    };
};

/**
 * Compute soft constraint score
 * Calculates schedule quality based on soft constraints
 */
const computeSoftScore = (
    schedules: Schedule[],
    _teachers: Teacher[],
    rooms: Room[],
    sections: Section[]
): SoftConstraintScore => {
    const maxScore = 800; // 8 constraints * 100 max each

    // 1. Balanced Load - variance in teacher workload
    const teacherWorkloads = new Map<string, number>();
    for (const s of schedules) {
        if (s.teacher_id) {
            const hours = (toMin(s.end_time) - toMin(s.start_time)) / 60;
            teacherWorkloads.set(s.teacher_id, (teacherWorkloads.get(s.teacher_id) || 0) + hours);
        }
    }
    const workloads = Array.from(teacherWorkloads.values());
    const avgWorkload = workloads.length > 0 ? workloads.reduce((a, b) => a + b, 0) / workloads.length : 0;
    const balancedLoadScore = workloads.length > 0 
        ? Math.max(0, 100 - (workloads.reduce((sum, w) => sum + Math.abs(w - avgWorkload), 0) / workloads.length) * 2)
        : 100;

    // 2. Compact Schedule - minimize gaps between classes
    // Calculate total gap time for each teacher
    const teacherGaps = new Map<string, number>();
    const teacherSchedules = new Map<string, Schedule[]>();
    for (const s of schedules) {
        if (s.teacher_id) {
            if (!teacherSchedules.has(s.teacher_id)) {
                teacherSchedules.set(s.teacher_id, []);
            }
            teacherSchedules.get(s.teacher_id)!.push(s);
        }
    }
    
    for (const [teacherId, teacherScheds] of teacherSchedules) {
        // Group by day and sort by time
        const dayGroups = new Map<string, Schedule[]>();
        for (const s of teacherScheds) {
            if (!dayGroups.has(s.day_of_week)) {
                dayGroups.set(s.day_of_week, []);
            }
            dayGroups.get(s.day_of_week)!.push(s);
        }
        
        let totalGap = 0;
        for (const dayScheds of dayGroups.values()) {
            dayScheds.sort((a, b) => toMin(a.start_time) - toMin(b.start_time));
            for (let i = 0; i < dayScheds.length - 1; i++) {
                const end = toMin(dayScheds[i].end_time);
                const start = toMin(dayScheds[i + 1].start_time);
                const gap = start - end;
                if (gap > 0) {
                    totalGap += gap;
                }
            }
        }
        teacherGaps.set(teacherId, totalGap);
    }
    
    const gapValues = Array.from(teacherGaps.values());
    const avgGap = gapValues.length > 0 ? gapValues.reduce((a, b) => a + b, 0) / gapValues.length : 0;
    // Score is 100 minus average gap in minutes (capped at 100)
    const compactScheduleScore = Math.max(0, 100 - avgGap);

    // 3. Minimize Room Switch - prefer same room for consecutive classes
    // Calculate room switches per section
    const sectionRoomSwitches = new Map<string, number>();
    const sectionSchedules = new Map<string, Schedule[]>();
    for (const s of schedules) {
        if (s.section_id) {
            if (!sectionSchedules.has(s.section_id)) {
                sectionSchedules.set(s.section_id, []);
            }
            sectionSchedules.get(s.section_id)!.push(s);
        }
    }
    
    for (const [sectionId, sectionScheds] of sectionSchedules) {
        // Sort by day and time
        sectionScheds.sort((a, b) => {
            const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(a.day_of_week);
            const dayOrderB = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(b.day_of_week);
            if (dayOrder !== dayOrderB) return dayOrder - dayOrderB;
            return toMin(a.start_time) - toMin(b.start_time);
        });
        
        let switches = 0;
        let lastRoom = sectionScheds[0]?.room_id;
        for (let i = 1; i < sectionScheds.length; i++) {
            if (sectionScheds[i].room_id && sectionScheds[i].room_id !== lastRoom) {
                switches++;
                lastRoom = sectionScheds[i].room_id;
            }
        }
        sectionRoomSwitches.set(sectionId, switches);
    }
    
    const switchValues = Array.from(sectionRoomSwitches.values());
    const avgSwitches = switchValues.length > 0 ? switchValues.reduce((a, b) => a + b, 0) / switchValues.length : 0;
    // Score is 100 minus average switches (capped at 100)
    const roomSwitchScore = Math.max(0, 100 - avgSwitches * 10);

    // 4. Teacher Preferred Time - check if teachers get preferred time slots
    // NOTE: This requires teacher preferences data which is not currently available
    // Keeping as placeholder with warning
    const teacherPreferredTimeScore = 100; // Placeholder - requires teacher preferences data
    // TODO: Implement when teacher preferences are available in the data model

    // 5. Daily Load Balance - even distribution across days
    const dailyLoads = new Map<string, number>();
    for (const s of schedules) {
        if (s.teacher_id) {
            const hours = (toMin(s.end_time) - toMin(s.start_time)) / 60;
            dailyLoads.set(s.day_of_week, (dailyLoads.get(s.day_of_week) || 0) + hours);
        }
    }
    const dailyValues = Array.from(dailyLoads.values());
    const avgDailyLoad = dailyValues.length > 0 ? dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length : 0;
    const dailyLoadBalanceScore = dailyValues.length > 0
        ? Math.max(0, 100 - (dailyValues.reduce((sum, d) => sum + Math.abs(d - avgDailyLoad), 0) / dailyValues.length) * 2)
        : 100;

    // 6. Workload Fairness - ensure teachers have similar total hours
    const workloadFairnessScore = balancedLoadScore; // Same as balanced load for now

    // 7. Subject Spacing - avoid same subject on consecutive days
    // Calculate subject spacing violations per section
    const subjectSpacingViolations = new Map<string, number>();
    for (const [sectionId, sectionScheds] of sectionSchedules) {
        // Group by subject and track days
        const subjectDays = new Map<string, Set<string>>();
        for (const s of sectionScheds) {
            if (s.subject_id) {
                if (!subjectDays.has(s.subject_id)) {
                    subjectDays.set(s.subject_id, new Set());
                }
                subjectDays.get(s.subject_id)!.add(s.day_of_week);
            }
        }
        
        let violations = 0;
        const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        for (const days of subjectDays.values()) {
            const sortedDays = Array.from(days).sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
            for (let i = 0; i < sortedDays.length - 1; i++) {
                const currentIdx = dayOrder.indexOf(sortedDays[i]);
                const nextIdx = dayOrder.indexOf(sortedDays[i + 1]);
                if (nextIdx === currentIdx + 1) {
                    violations++; // Consecutive days
                }
            }
        }
        subjectSpacingViolations.set(sectionId, violations);
    }
    
    const spacingValues = Array.from(subjectSpacingViolations.values());
    const avgSpacingViolations = spacingValues.length > 0 ? spacingValues.reduce((a, b) => a + b, 0) / spacingValues.length : 0;
    // Score is 100 minus average violations (capped at 100)
    const subjectSpacingScore = Math.max(0, 100 - avgSpacingViolations * 20);

    // 8. Room Utilization - percentage of room capacity used
    let totalCapacityUsed = 0;
    let totalCapacity = 0;
    for (const s of schedules) {
        if (s.room_id) {
            const room = rooms.find(r => r.id === s.room_id);
            const section = sections.find(sec => sec.id === s.section_id);
            if (room && section) {
                totalCapacityUsed += Math.min(section.student_count, room.capacity);
                totalCapacity += room.capacity;
            }
        }
    }
    const roomUtilizationScore = totalCapacity > 0 
        ? Math.round((totalCapacityUsed / totalCapacity) * 100)
        : 100;

    const finalScore = Math.round(
        balancedLoadScore + 
        compactScheduleScore + 
        roomSwitchScore + 
        teacherPreferredTimeScore + 
        dailyLoadBalanceScore + 
        workloadFairnessScore + 
        subjectSpacingScore + 
        roomUtilizationScore
    );

    return {
        totalScore: finalScore,
        maxScore,
        breakdown: {
            balancedLoad: { score: Math.round(balancedLoadScore), max: 100, violations: [] },
            compactSchedule: { score: compactScheduleScore, max: 100, violations: [] },
            minimizeRoomSwitch: { score: roomSwitchScore, max: 100, violations: [] },
            teacherPreferredTime: { score: teacherPreferredTimeScore, max: 100, violations: [] },
            dailyLoadBalance: { score: Math.round(dailyLoadBalanceScore), max: 100, violations: [] },
            workloadFairness: { score: Math.round(workloadFairnessScore), max: 100, violations: [] },
            subjectSpacing: { score: subjectSpacingScore, max: 100, violations: [] },
            roomUtilization: { score: roomUtilizationScore, max: 100, violations: [] },
        },
    };
};
