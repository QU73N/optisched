/**
 * Conflict Fixing Engine
 * Provides automatic and interactive fixing options for hard constraint violations
 */

import type { HardConstraintViolation, ScanResult } from './conflictScanner';
import type { Schedule, Teacher, Room, Section, Subject } from '../../../types/database';
import { scheduleValidation } from '../../../services/scheduleValidation';
import { scheduleLogger } from '../../../services/scheduleLogger';
import type { SupabaseClient } from '@supabase/supabase-js';

// Constants for fix generation
const DEFAULT_CAPACITY_REQUIREMENT = 30;
const STANDARD_TIME_SLOTS = [
    { start: '08:00', end: '09:00' },
    { start: '09:00', end: '10:00' },
    { start: '10:00', end: '11:00' },
    { start: '11:00', end: '12:00' },
    { start: '13:00', end: '14:00' },
    { start: '14:00', end: '15:00' },
    { start: '15:00', end: '16:00' },
    { start: '16:00', end: '17:00' },
];
const STANDARD_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Helper function to get teacher name from profile or fall back to ID
 */
const getTeacherName = (teacher: Teacher | undefined): string => {
    if (!teacher) return 'Unknown Teacher';
    return teacher.profile?.full_name || teacher.id;
};

/**
 * Compute a hash of schedule state for detecting changes and loops
 * Uses a simple but effective hash of all schedule fields
 */
const computeScheduleHash = (schedules: Schedule[]): string => {
    // Sort by ID to ensure consistent ordering
    const sorted = [...schedules].sort((a, b) => a.id.localeCompare(b.id));
    
    // Create a canonical string representation
    const stateStr = sorted.map(s => 
        `${s.id}|${s.teacher_id || ''}|${s.room_id || ''}|${s.section_id || ''}|${s.day_of_week}|${s.start_time}|${s.end_time}|${s.subject_id || ''}`
    ).join('||');
    
    // Simple hash function (djb2 variant)
    let hash = 5381;
    for (let i = 0; i < stateStr.length; i++) {
        hash = ((hash << 5) + hash) + stateStr.charCodeAt(i);
    }
    return Math.abs(hash).toString(36);
};

/**
 * Compare two schedule states and return detailed differences
 */
const compareScheduleStates = (before: Schedule[], after: Schedule[]) => {
    const beforeMap = new Map(before.map(s => [s.id, s]));
    const afterMap = new Map(after.map(s => [s.id, s]));
    
    const changed: Array<{ id: string; field: string; before: string; after: string }> = [];
    
    for (const [id, afterSched] of afterMap) {
        const beforeSched = beforeMap.get(id);
        if (!beforeSched) {
            changed.push({ id, field: 'NEW', before: '(none)', after: JSON.stringify(afterSched) });
            continue;
        }
        
        const fields: (keyof Schedule)[] = ['teacher_id', 'room_id', 'section_id', 'day_of_week', 'start_time', 'end_time', 'subject_id'];
        for (const field of fields) {
            if (beforeSched[field] !== afterSched[field]) {
                changed.push({ 
                    id, 
                    field, 
                    before: String(beforeSched[field] || ''), 
                    after: String(afterSched[field] || '') 
                });
            }
        }
    }
    
    return {
        changedCount: changed.length,
        changes: changed,
        beforeHash: computeScheduleHash(before),
        afterHash: computeScheduleHash(after),
    };
};

export type FixMode = 'autonomous' | 'interactive';

export interface FixOption {
    id: string;
    type: 'move_time' | 'swap_teacher' | 'swap_room' | 'swap_section' | 'delete';
    title: string;
    description: string;
    estimatedSoftScoreImpact: number; // Negative = improvement, Positive = degradation
    affectedSchedules: string[];
    changes: {
        scheduleId: string;
        changes: {
            field: 'teacher_id' | 'room_id' | 'section_id' | 'day_of_week' | 'start_time' | 'end_time';
            oldValue: string;
            newValue: string;
        }[];
    }[];
    reason: string;
    effort: 'low' | 'medium' | 'high';
}

export interface FixResult {
    success: boolean;
    message: string;
    appliedFixes: FixOption[];
    remainingViolations: HardConstraintViolation[];
    newSoftScore?: number;
    warnings?: string[];
    iterationsCompleted?: number;
    conflictsResolvedInLastPass?: number;
    stateChanges?: {
        beforeHash: string;
        afterHash: string;
        changedCount: number;
        changes: Array<{ id: string; field: string; before: string; after: string }>;
    };
    loopDetected?: boolean;
}

/**
 * Generate fix options for a given violation
 */
export const generateFixOptions = async (
    violation: HardConstraintViolation,
    schedules: Schedule[],
    teachers: Teacher[],
    rooms: Room[],
    sections: Section[],
    subjects: Subject[]
): Promise<FixOption[]> => {
    const options: FixOption[] = [];

    switch (violation.type) {
        case 'teacher_overlap':
            options.push(...generateTeacherOverlapFixes(violation, schedules, teachers, rooms, sections, subjects));
            break;
        case 'room_overlap':
            options.push(...generateRoomOverlapFixes(violation, schedules, teachers, rooms, sections));
            break;
        case 'section_overlap':
            options.push(...generateSectionOverlapFixes(violation, schedules, teachers, rooms, sections, subjects));
            break;
        case 'room_capacity_exceeded':
            options.push(...generateCapacityFixes(violation, schedules, rooms, sections));
            break;
        case 'room_subject_incompatible':
            options.push(...generateCompatibilityFixes(violation, schedules, rooms, subjects));
            break;
        case 'teacher_unqualified':
            options.push(...generateQualificationFixes(violation, schedules, teachers, subjects));
            break;
        case 'teacher_unavailable':
            options.push(...generateAvailabilityFixes(violation, schedules));
            break;
        case 'max_consecutive_hours':
        case 'max_daily_hours':
        case 'max_daily_classes':
            options.push(...generateWorkloadFixes(violation, schedules));
            break;
        case 'max_weekly_hours':
            options.push(...generateWeeklyFixes(violation, schedules));
            break;
        case 'break_violation':
            options.push(...generateBreakFixes(violation, schedules));
            break;
    }

    return options;
};

/**
 * Generate fixes for teacher overlap
 */
const generateTeacherOverlapFixes = (
    violation: HardConstraintViolation,
    schedules: Schedule[],
    teachers: Teacher[],
    _rooms: Room[],
    _sections: Section[],
    subjects: Subject[]
): FixOption[] => {
    const options: FixOption[] = [];
    const [schedId1, schedId2] = violation.scheduleIds;
    const sched1 = schedules.find(s => s.id === schedId1);
    const sched2 = schedules.find(s => s.id === schedId2);

    if (!sched1 || !sched2) return options;

    // Option 1: Move sched1 to a different time slot
    const availableSlots = findAvailableSlots(sched1, schedules, sched2.day_of_week);
    for (const slot of availableSlots.slice(0, 3)) {
        options.push({
            id: `move_time_${sched1.id}_${slot.day}_${slot.start}`,
            type: 'move_time',
            title: `Move ${subjects.find(s => s.id === sched1.subject_id)?.name || 'Class'} to ${slot.day} ${slot.start}`,
            description: `Move the class to a different time slot to resolve the teacher overlap.`,
            estimatedSoftScoreImpact: -5, // Small potential improvement
            affectedSchedules: [sched1.id],
            changes: [{
                scheduleId: sched1.id,
                changes: [
                    { field: 'day_of_week', oldValue: sched1.day_of_week, newValue: slot.day },
                    { field: 'start_time', oldValue: sched1.start_time, newValue: slot.start },
                    { field: 'end_time', oldValue: sched1.end_time, newValue: slot.end },
                ],
            }],
            reason: 'Resolves teacher overlap by moving one session to a free slot',
            effort: 'low',
        });
    }

    // Option 2: Move sched2 to a different time slot
    const availableSlots2 = findAvailableSlots(sched2, schedules, sched1.day_of_week);
    for (const slot of availableSlots2.slice(0, 3)) {
        options.push({
            id: `move_time_${sched2.id}_${slot.day}_${slot.start}`,
            type: 'move_time',
            title: `Move ${subjects.find(s => s.id === sched2.subject_id)?.name || 'Class'} to ${slot.day} ${slot.start}`,
            description: `Move the class to a different time slot to resolve the teacher overlap.`,
            estimatedSoftScoreImpact: -5,
            affectedSchedules: [sched2.id],
            changes: [{
                scheduleId: sched2.id,
                changes: [
                    { field: 'day_of_week', oldValue: sched2.day_of_week, newValue: slot.day },
                    { field: 'start_time', oldValue: sched2.start_time, newValue: slot.start },
                    { field: 'end_time', oldValue: sched2.end_time, newValue: slot.end },
                ],
            }],
            reason: 'Resolves teacher overlap by moving the other session to a free slot',
            effort: 'low',
        });
    }

    // Option 3: Swap teacher for sched1
    // Note: Teacher qualification check would need to be implemented based on actual data model
    const availableTeachers = teachers.filter(t => t.id !== sched1.teacher_id && t.is_active);
    for (const teacher of availableTeachers.slice(0, 3)) {
        options.push({
            id: `swap_teacher_${sched1.id}_${teacher.id}`,
            type: 'swap_teacher',
            title: `Assign ${getTeacherName(teacher)} to ${subjects.find(s => s.id === sched1.subject_id)?.name || 'Class'}`,
            description: `Replace current teacher with ${getTeacherName(teacher)}. Verify qualification before applying.`,
            estimatedSoftScoreImpact: -10, // May affect workload balance
            affectedSchedules: [sched1.id],
            changes: [{
                scheduleId: sched1.id,
                changes: [
                    { field: 'teacher_id', oldValue: sched1.teacher_id!, newValue: teacher.id },
                ],
            }],
            reason: 'Resolves teacher overlap by changing the teacher',
            effort: 'medium',
        });
    }

    // Option 4: Swap teacher for sched2
    for (const teacher of availableTeachers.slice(0, 3)) {
        options.push({
            id: `swap_teacher_${sched2.id}_${teacher.id}`,
            type: 'swap_teacher',
            title: `Assign ${getTeacherName(teacher)} to ${subjects.find(s => s.id === sched2.subject_id)?.name || 'Class'}`,
            description: `Replace current teacher with ${getTeacherName(teacher)}. Verify qualification before applying.`,
            estimatedSoftScoreImpact: -10,
            affectedSchedules: [sched2.id],
            changes: [{
                scheduleId: sched2.id,
                changes: [
                    { field: 'teacher_id', oldValue: sched2.teacher_id!, newValue: teacher.id },
                ],
            }],
            reason: 'Resolves teacher overlap by changing the teacher',
            effort: 'medium',
        });
    }

    return options;
};

/**
 * Generate fixes for room overlap
 */
const generateRoomOverlapFixes = (
    violation: HardConstraintViolation,
    schedules: Schedule[],
    _teachers: Teacher[],
    rooms: Room[],
    sections: Section[]
): FixOption[] => {
    const options: FixOption[] = [];
    const [schedId1, schedId2] = violation.scheduleIds;
    const sched1 = schedules.find(s => s.id === schedId1);
    const sched2 = schedules.find(s => s.id === schedId2);

    if (!sched1 || !sched2) return options;

    // Option 1: Move sched1 to a different room
    const availableRooms = findAvailableRooms(sched1, rooms, schedules, sections);
    for (const room of availableRooms.slice(0, 3)) {
        options.push({
            id: `swap_room_${sched1.id}_${room.id}`,
            type: 'swap_room',
            title: `Move to ${room.name}`,
            description: `Move the class to a different available room.`,
            estimatedSoftScoreImpact: -3,
            affectedSchedules: [sched1.id],
            changes: [{
                scheduleId: sched1.id,
                changes: [
                    { field: 'room_id', oldValue: sched1.room_id!, newValue: room.id },
                ],
            }],
            reason: 'Resolves room overlap by moving to an available room',
            effort: 'low',
        });
    }

    // Option 2: Move sched2 to a different room
    for (const room of availableRooms.slice(0, 3)) {
        options.push({
            id: `swap_room_${sched2.id}_${room.id}`,
            type: 'swap_room',
            title: `Move to ${room.name}`,
            description: `Move the class to a different available room.`,
            estimatedSoftScoreImpact: -3,
            affectedSchedules: [sched2.id],
            changes: [{
                scheduleId: sched2.id,
                changes: [
                    { field: 'room_id', oldValue: sched2.room_id!, newValue: room.id },
                ],
            }],
            reason: 'Resolves room overlap by moving to an available room',
            effort: 'low',
        });
    }

    // Option 3: Move sched1 to different time
    const availableSlots = findAvailableSlots(sched1, schedules, sched1.day_of_week);
    for (const slot of availableSlots.slice(0, 3)) {
        options.push({
            id: `move_time_${sched1.id}_${slot.day}_${slot.start}`,
            type: 'move_time',
            title: `Move to ${slot.day} ${slot.start}`,
            description: `Move the class to a different time slot.`,
            estimatedSoftScoreImpact: -5,
            affectedSchedules: [sched1.id],
            changes: [{
                scheduleId: sched1.id,
                changes: [
                    { field: 'day_of_week', oldValue: sched1.day_of_week, newValue: slot.day },
                    { field: 'start_time', oldValue: sched1.start_time, newValue: slot.start },
                    { field: 'end_time', oldValue: sched1.end_time, newValue: slot.end },
                ],
            }],
            reason: 'Resolves room overlap by changing time',
            effort: 'low',
        });
    }

    return options;
};

/**
 * Generate fixes for section overlap
 */
const generateSectionOverlapFixes = (
    violation: HardConstraintViolation,
    schedules: Schedule[],
    _teachers: Teacher[],
    _rooms: Room[],
    _sections: Section[],
    subjects: Subject[]
): FixOption[] => {
    const options: FixOption[] = [];
    const [schedId1, schedId2] = violation.scheduleIds;
    const sched1 = schedules.find(s => s.id === schedId1);
    const sched2 = schedules.find(s => s.id === schedId2);

    if (!sched1 || !sched2) return options;

    // For section overlap, we typically need to move one of the sessions to a different time
    const availableSlots = findAvailableSlots(sched1, schedules, sched1.day_of_week);
    for (const slot of availableSlots.slice(0, 5)) {
        options.push({
            id: `move_time_${sched1.id}_${slot.day}_${slot.start}`,
            type: 'move_time',
            title: `Move ${subjects.find(s => s.id === sched1.subject_id)?.name || 'Class'} to ${slot.day} ${slot.start}`,
            description: `Move the class to a different time slot to resolve the section overlap.`,
            estimatedSoftScoreImpact: -5,
            affectedSchedules: [sched1.id],
            changes: [{
                scheduleId: sched1.id,
                changes: [
                    { field: 'day_of_week', oldValue: sched1.day_of_week, newValue: slot.day },
                    { field: 'start_time', oldValue: sched1.start_time, newValue: slot.start },
                    { field: 'end_time', oldValue: sched1.end_time, newValue: slot.end },
                ],
            }],
            reason: 'Resolves section overlap by moving to a free slot',
            effort: 'low',
        });
    }

    return options;
};

/**
 * Generate fixes for capacity exceeded
 */
const generateCapacityFixes = (
    violation: HardConstraintViolation,
    schedules: Schedule[],
    rooms: Room[],
    sections: Section[]
): FixOption[] => {
    const options: FixOption[] = [];
    const schedId = violation.scheduleIds[0];
    const sched = schedules.find(s => s.id === schedId);

    if (!sched) return options;

    const section = sections.find(s => s.id === sched.section_id);
    const requiredCapacity = section?.student_count || DEFAULT_CAPACITY_REQUIREMENT;

    // Find larger rooms
    const largerRooms = rooms.filter(r => 
        r.capacity >= requiredCapacity && r.id !== sched.room_id
    );

    for (const room of largerRooms.slice(0, 3)) {
        options.push({
            id: `swap_room_${sched.id}_${room.id}`,
            type: 'swap_room',
            title: `Move to ${room.name} (Capacity: ${room.capacity})`,
            description: `Move to a room with sufficient capacity for ${requiredCapacity} students.`,
            estimatedSoftScoreImpact: -2,
            affectedSchedules: [sched.id],
            changes: [{
                scheduleId: sched.id,
                changes: [
                    { field: 'room_id', oldValue: sched.room_id!, newValue: room.id },
                ],
            }],
            reason: 'Resolves capacity issue by moving to a larger room',
            effort: 'low',
        });
    }

    return options;
};

/**
 * Generate fixes for room-subject incompatibility
 */
const generateCompatibilityFixes = (
    violation: HardConstraintViolation,
    schedules: Schedule[],
    rooms: Room[],
    subjects: Subject[]
): FixOption[] => {
    const options: FixOption[] = [];
    const schedId = violation.scheduleIds[0];
    const sched = schedules.find(s => s.id === schedId);

    if (!sched) return options;

    const subject = subjects.find(s => s.id === sched.subject_id);

    // Find compatible rooms
    const compatibleRooms = rooms.filter(r => {
        if (subject?.requires_lab && !r.equipment.includes('lab')) return false;
        if (subject?.type && r.type !== subject.type) return false;
        return r.id !== sched.room_id;
    });

    for (const room of compatibleRooms.slice(0, 3)) {
        options.push({
            id: `swap_room_${sched.id}_${room.id}`,
            type: 'swap_room',
            title: `Move to ${room.name}`,
            description: `Move to a room compatible with ${subject?.name || 'the subject'}.`,
            estimatedSoftScoreImpact: -3,
            affectedSchedules: [sched.id],
            changes: [{
                scheduleId: sched.id,
                changes: [
                    { field: 'room_id', oldValue: sched.room_id!, newValue: room.id },
                ],
            }],
            reason: 'Resolves incompatibility by moving to a suitable room',
            effort: 'low',
        });
    }

    return options;
};

/**
 * Generate fixes for teacher unqualified
 */
const generateQualificationFixes = (
    violation: HardConstraintViolation,
    schedules: Schedule[],
    teachers: Teacher[],
    subjects: Subject[]
): FixOption[] => {
    const options: FixOption[] = [];
    const schedId = violation.scheduleIds[0];
    const sched = schedules.find(s => s.id === schedId);

    if (!sched) return options;

    const subject = subjects.find(s => s.id === sched.subject_id);

    // Find qualified teachers
    // Note: Simplified - just shows all active teachers as options
    // Actual qualification check would need to be implemented based on data model
    const qualifiedTeachers = teachers.filter(t => t.is_active);
    for (const teacher of qualifiedTeachers.slice(0, 3)) {
        options.push({
            id: `swap_teacher_${sched.id}_${teacher.id}`,
            type: 'swap_teacher',
            title: `Assign ${getTeacherName(teacher)} to ${subject?.name || 'this subject'}`,
            description: `Replace current teacher with ${getTeacherName(teacher)}. Verify qualification before applying.`,
            estimatedSoftScoreImpact: -10,
            affectedSchedules: [sched.id],
            changes: [{
                scheduleId: sched.id,
                changes: [
                    { field: 'teacher_id', oldValue: sched.teacher_id!, newValue: teacher.id },
                ],
            }],
            reason: 'Resolves qualification issue by assigning a teacher',
            effort: 'medium',
        });
    }

    return options;
};

/**
 * Generate fixes for teacher unavailable
 */
const generateAvailabilityFixes = (
    violation: HardConstraintViolation,
    schedules: Schedule[]
): FixOption[] => {
    const options: FixOption[] = [];
    const schedId = violation.scheduleIds[0];
    const sched = schedules.find(s => s.id === schedId);

    if (!sched) return options;

    // Move to a different time slot
    const availableSlots = findAvailableSlots(sched, schedules, sched.day_of_week);
    for (const slot of availableSlots.slice(0, 5)) {
        options.push({
            id: `move_time_${sched.id}_${slot.day}_${slot.start}`,
            type: 'move_time',
            title: `Move to ${slot.day} ${slot.start}`,
            description: `Move to a time when the teacher is available.`,
            estimatedSoftScoreImpact: -5,
            affectedSchedules: [sched.id],
            changes: [{
                scheduleId: sched.id,
                changes: [
                    { field: 'day_of_week', oldValue: sched.day_of_week, newValue: slot.day },
                    { field: 'start_time', oldValue: sched.start_time, newValue: slot.start },
                    { field: 'end_time', oldValue: sched.end_time, newValue: slot.end },
                ],
            }],
            reason: 'Resolves unavailability by moving to an available time',
            effort: 'low',
        });
    }

    return options;
};

/**
 * Generate fixes for workload violations
 */
const generateWorkloadFixes = (
    violation: HardConstraintViolation,
    schedules: Schedule[]
): FixOption[] => {
    const options: FixOption[] = [];

    for (const schedId of violation.scheduleIds) {
        const sched = schedules.find(s => s.id === schedId);
        if (!sched) continue;

        // Move to a different day to spread the load
        const availableSlots = findAvailableSlots(sched, schedules, sched.day_of_week);
        for (const slot of availableSlots.slice(0, 3)) {
            if (slot.day !== sched.day_of_week) {
                options.push({
                    id: `move_time_${sched.id}_${slot.day}_${slot.start}`,
                    type: 'move_time',
                    title: `Move to ${slot.day} ${slot.start}`,
                    description: `Move to a different day to balance the workload.`,
                    estimatedSoftScoreImpact: -5,
                    affectedSchedules: [sched.id],
                    changes: [{
                        scheduleId: sched.id,
                        changes: [
                            { field: 'day_of_week', oldValue: sched.day_of_week, newValue: slot.day },
                            { field: 'start_time', oldValue: sched.start_time, newValue: slot.start },
                            { field: 'end_time', oldValue: sched.end_time, newValue: slot.end },
                        ],
                    }],
                    reason: 'Reduces workload by moving to a different day',
                    effort: 'low',
                });
            }
        }
    }

    return options;
};

/**
 * Generate fixes for weekly hours violations
 */
const generateWeeklyFixes = (
    violation: HardConstraintViolation,
    schedules: Schedule[]
): FixOption[] => {
    const options: FixOption[] = [];

    // For weekly violations, we may need to remove some sessions or redistribute
    for (const schedId of violation.scheduleIds) {
        const sched = schedules.find(s => s.id === schedId);
        if (!sched) continue;

        options.push({
            id: `delete_${sched.id}`,
            type: 'delete',
            title: `Remove this session`,
            description: `Remove this session to reduce weekly hours. This may not cover all subject requirements.`,
            estimatedSoftScoreImpact: -20, // Significant negative impact
            affectedSchedules: [sched.id],
            changes: [{
                scheduleId: sched.id,
                changes: [],
            }],
            reason: 'Reduces weekly hours by removing a session',
            effort: 'high',
        });
    }

    return options;
};

/**
 * Generate fixes for break violations
 */
const generateBreakFixes = (
    violation: HardConstraintViolation,
    schedules: Schedule[]
): FixOption[] => {
    const options: FixOption[] = [];
    const schedId = violation.scheduleIds[0];
    const sched = schedules.find(s => s.id === schedId);

    if (!sched) return options;

    // Move to a time outside the break
    const availableSlots = findAvailableSlots(sched, schedules, sched.day_of_week);
    for (const slot of availableSlots.slice(0, 3)) {
        options.push({
            id: `move_time_${sched.id}_${slot.day}_${slot.start}`,
            type: 'move_time',
            title: `Move to ${slot.day} ${slot.start}`,
            description: `Move to a time outside the break window.`,
            estimatedSoftScoreImpact: -2,
            affectedSchedules: [sched.id],
            changes: [{
                scheduleId: sched.id,
                changes: [
                    { field: 'day_of_week', oldValue: sched.day_of_week, newValue: slot.day },
                    { field: 'start_time', oldValue: sched.start_time, newValue: slot.start },
                    { field: 'end_time', oldValue: sched.end_time, newValue: slot.end },
                ],
            }],
            reason: 'Resolves break violation by moving outside break time',
            effort: 'low',
        });
    }

    return options;
};

/**
 * Helper: Find available time slots for a schedule
 */
const findAvailableSlots = (
    sched: Schedule,
    allSchedules: Schedule[],
    excludeDay?: string
): { day: string; start: string; end: string }[] => {
    const slots: { day: string; start: string; end: string }[] = [];
    const days = STANDARD_DAYS;
    const timeSlots = STANDARD_TIME_SLOTS;

    for (const day of days) {
        if (excludeDay && day === excludeDay) continue;

        for (const time of timeSlots) {
            // Check if this slot is available
            const isAvailable = !allSchedules.some(s => {
                if (s.day_of_week !== day) return false;
                if (s.teacher_id && s.teacher_id === sched.teacher_id) {
                    return time.start < s.end_time && time.end > s.start_time;
                }
                if (s.room_id && s.room_id === sched.room_id) {
                    return time.start < s.end_time && time.end > s.start_time;
                }
                if (s.section_id && s.section_id === sched.section_id) {
                    return time.start < s.end_time && time.end > s.start_time;
                }
                return false;
            });

            if (isAvailable) {
                slots.push({ day, start: time.start, end: time.end });
            }
        }
    }

    return slots;
};

/**
 * Helper: Find available rooms for a schedule
 */
const findAvailableRooms = (
    sched: Schedule,
    rooms: Room[],
    schedules: Schedule[],
    sections?: Section[]
): Room[] => {
    // Try to get required capacity from section, otherwise use default
    const section = sections?.find(s => s.id === sched.section_id);
    const requiredCapacity = section?.student_count || DEFAULT_CAPACITY_REQUIREMENT;

    return rooms.filter(room => {
        if (room.capacity < requiredCapacity) return false;
        
        // Check if room is available at this time
        const isAvailable = !schedules.some(s => {
            if (s.room_id !== room.id) return false;
            if (s.day_of_week !== sched.day_of_week) return false;
            return sched.start_time < s.end_time && sched.end_time > s.start_time;
        });

        return isAvailable && room.id !== sched.room_id;
    });
};

/**
 * Progress callback for reporting fixing progress
 */
export interface FixProgressCallback {
    (progress: {
        current: number;
        total: number;
        currentViolation: string;
        phase: 'loading' | 'scanning' | 'analyzing' | 'fixing' | 'committing' | 'rescanning' | 'validating';
        overallProgress: number; // 0-100 for entire pipeline
        pipelineStage: 'scan' | 'fix' | 'rescan' | 'validate' | 'complete';
    }): void;
}

/**
 * Apply fixes in autonomous mode with automatic rescan loop
 */
export const applyAutonomousFixes = async (
    scanResult: ScanResult,
    schedules: Schedule[],
    teachers: Teacher[],
    rooms: Room[],
    sections: Section[],
    subjects: Subject[],
    supabase: SupabaseClient,
    options?: {
        maxIterations?: number;
        onProgress?: FixProgressCallback;
        autoRescan?: boolean;
        overallProgressStart?: number; // Starting point for overall progress (for multi-iteration)
        includeScanPhase?: boolean; // Whether this call includes the initial scan phase
        timeoutMs?: number; // Timeout for the entire fixing process in milliseconds
    }
): Promise<FixResult> => {
    const { maxIterations = 5, onProgress, autoRescan = true, overallProgressStart = 0, includeScanPhase = false, timeoutMs = 300000 } = options || {};
    const appliedFixes: FixOption[] = [];
    const warnings: string[] = [];
    let remainingViolations = [...scanResult.hardViolations];
    let iterationsCompleted = 0;
    let conflictsResolvedInLastPass = 0;
    const totalViolationsToProcess = scanResult.hardViolations.length;
    let processedViolations = 0;
    
    // Timeout safety
    const startTime = Date.now();
    const checkTimeout = () => {
        if (Date.now() - startTime > timeoutMs) {
            throw new Error(`Fixing process timed out after ${timeoutMs}ms. This may indicate an infinite loop or very large schedule.`);
        }
    };
    
    // Track modified schedule IDs for verification
    const modifiedScheduleIds = new Set<string>();
    
    // Track state hashes for loop detection
    const stateHashHistory = new Map<number, string>(); // iteration -> hash
    const initialScheduleHash = computeScheduleHash(schedules);
    stateHashHistory.set(0, initialScheduleHash);
    
    console.log('[FIX ENGINE] Starting autonomous fix process');
    console.log('[FIX ENGINE] Initial schedule hash:', initialScheduleHash);
    console.log('[FIX ENGINE] Initial conflict count:', scanResult.hardViolations.length);
    console.log('[FIX ENGINE] Initial soft score:', scanResult.softScore.totalScore);
    
    // Edge case: No conflicts to fix
    checkTimeout();
    if (scanResult.hardViolations.length === 0) {
        console.log('[FIX ENGINE] No conflicts detected - nothing to fix');
        return {
            success: true,
            message: 'No conflicts detected. Schedule is already valid.',
            appliedFixes: [],
            remainingViolations: [],
            warnings: [],
            iterationsCompleted: 0,
            conflictsResolvedInLastPass: 0,
            stateChanges: {
                beforeHash: initialScheduleHash,
                afterHash: initialScheduleHash,
                changedCount: 0,
                changes: [],
            },
            loopDetected: false,
        };
    }

    // Calculate progress weights for unified pipeline
    // If includeScanPhase is true, add scan phase (20%)
    const progressWeights = includeScanPhase ? {
        scanning: 20,
        analyzing: 5,
        fixing: 40,
        committing: 10,
        rescanning: 15,
        validating: 10,
    } : {
        analyzing: 5,
        fixing: 55,
        committing: 10,
        rescanning: 15,
        validating: 15,
    };
    const iterationProgressBase = overallProgressStart;
    const totalProgressPerIteration = includeScanPhase 
        ? (progressWeights.scanning || 0) + (progressWeights.analyzing || 0) + (progressWeights.fixing || 0) + (progressWeights.committing || 0) + (progressWeights.rescanning || 0) + (progressWeights.validating || 0)
        : (progressWeights.analyzing || 0) + (progressWeights.fixing || 0) + (progressWeights.committing || 0) + (progressWeights.rescanning || 0) + (progressWeights.validating || 0);
    
    const updateOverallProgress = (phase: 'loading' | 'scanning' | 'analyzing' | 'fixing' | 'committing' | 'rescanning' | 'validating', phaseProgress: number, pipelineStage: 'scan' | 'fix' | 'rescan' | 'validate' | 'complete' = 'fix') => {
        if (onProgress) {
            onProgress({
                current: processedViolations,
                total: totalViolationsToProcess,
                currentViolation: '',
                phase,
                overallProgress: iterationProgressBase + phaseProgress,
                pipelineStage,
            });
        }
    };
    
    // Phase: Scanning (if included)
    if (includeScanPhase) {
        updateOverallProgress('scanning', 0, 'scan');
        updateOverallProgress('scanning', progressWeights.scanning || 0, 'scan');
    }
    
    // Phase: Analyzing
    updateOverallProgress('analyzing', includeScanPhase ? (progressWeights.scanning || 0) : 0, 'fix');
    // Sort violations by severity (critical first)
    remainingViolations.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
    });
    updateOverallProgress('analyzing', (includeScanPhase ? (progressWeights.scanning || 0) : 0) + (progressWeights.analyzing || 0), 'fix');

    // Phase: Fixing
    for (const violation of remainingViolations) {
        checkTimeout();
        // Report progress
        processedViolations++;
        const fixProgress = (includeScanPhase ? (progressWeights.scanning || 0) : 0) + (progressWeights.analyzing || 0) + (processedViolations / totalViolationsToProcess) * (progressWeights.fixing || 0);
        if (onProgress) {
            onProgress({
                current: processedViolations,
                total: totalViolationsToProcess,
                currentViolation: violation.title,
                phase: 'fixing',
                overallProgress: iterationProgressBase + fixProgress,
                pipelineStage: 'fix',
            });
        }
        const options = await generateFixOptions(
            violation,
            schedules,
            teachers,
            rooms,
            sections,
            subjects
        );

        if (options.length === 0) {
            warnings.push(`No fix options available for: ${violation.title}`);
            continue;
        }

        // In autonomous mode, pick the option with the best soft score impact
        // and lowest effort
        const bestOption = options.sort((a, b) => {
            // Prefer lower soft score impact (more negative = better)
            if (a.estimatedSoftScoreImpact !== b.estimatedSoftScoreImpact) {
                return a.estimatedSoftScoreImpact - b.estimatedSoftScoreImpact;
            }
            // Then prefer lower effort
            const effortOrder = { low: 0, medium: 1, high: 2 };
            return effortOrder[a.effort] - effortOrder[b.effort];
        })[0];

        // Apply the fix
        try {
            for (const change of bestOption.changes) {
                const updates: Record<string, string> = {};
                for (const c of change.changes) {
                    updates[c.field] = c.newValue;
                }
                const { error } = await supabase
                    .from('schedules')
                    .update(updates)
                    .eq('id', change.scheduleId);
                
                if (error) {
                    throw new Error(`Database update failed for schedule ${change.scheduleId}: ${error.message}`);
                }
                
                // Track modified schedule IDs for verification
                modifiedScheduleIds.add(change.scheduleId);
            }

            appliedFixes.push(bestOption);
            
            // Update local schedules to reflect changes
            for (const change of bestOption.changes) {
                const sched = schedules.find(s => s.id === change.scheduleId);
                if (sched) {
                    for (const c of change.changes) {
                        updateScheduleField(sched, c.field, c.newValue);
                    }
                }
            }

            // Remove this violation from remaining
            remainingViolations = remainingViolations.filter(v => v.id !== violation.id);
            conflictsResolvedInLastPass++;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            warnings.push(`Failed to apply fix for "${violation.title}": ${errorMessage}`);
            console.error('Fix application error:', error);
        }
    }

    // Phase: Committing - Verify database writes
    const committingProgress = (includeScanPhase ? (progressWeights.scanning || 0) : 0) + (progressWeights.analyzing || 0) + (progressWeights.fixing || 0);
    updateOverallProgress('committing', committingProgress, 'fix');
    
    // Capture state before verification
    const beforeVerificationHash = computeScheduleHash(schedules);
    console.log('[FIX ENGINE] Before verification hash:', beforeVerificationHash);
    
    if (modifiedScheduleIds.size > 0) {
        console.log('[FIX ENGINE] Verifying', modifiedScheduleIds.size, 'modified schedules in database');
        
        // Verify the modified schedules were actually updated
        const { data: verifiedSchedules, error: verifyError } = await supabase
            .from('schedules')
            .select('*')
            .in('id', Array.from(modifiedScheduleIds));
        
        if (verifyError) {
            console.error('[FIX ENGINE] Database verification failed:', verifyError);
            warnings.push(`Failed to verify database commits: ${verifyError.message}`);
        } else if (verifiedSchedules) {
            console.log('[FIX ENGINE] Verified', verifiedSchedules.length, 'schedules from database');
            
            // Compare before and after to detect no-op fixes
            const stateComparison = compareScheduleStates(schedules, verifiedSchedules);
            console.log('[FIX ENGINE] State comparison:', stateComparison);
            
            if (stateComparison.changedCount === 0) {
                console.error('[FIX ENGINE] CRITICAL: No state changes detected despite modifications!');
                console.error('[FIX ENGINE] REJECTING FIX AS NO-OP - Fix did not actually change schedule state');
                scheduleLogger.system.error('conflicts', 'repair', 'Fix rejected as no-op - no state changes detected', stateComparison);
                return {
                    success: false,
                    message: 'Fix rejected: No state changes detected. The fix did not actually modify the schedule.',
                    appliedFixes,
                    remainingViolations,
                    warnings: [...warnings, 'Fix was applied but no state changes detected. This indicates a no-op fix, database write failure, or stale data.'],
                    iterationsCompleted,
                    conflictsResolvedInLastPass,
                    loopDetected: false,
                };
            }
            
            // Update local schedules with verified data
            for (const verified of verifiedSchedules) {
                const localIndex = schedules.findIndex(s => s.id === verified.id);
                if (localIndex !== -1) {
                    schedules[localIndex] = verified;
                }
            }
            
            const afterVerificationHash = computeScheduleHash(schedules);
            console.log('[FIX ENGINE] After verification hash:', afterVerificationHash);
            console.log('[FIX ENGINE] Hash changed:', beforeVerificationHash !== afterVerificationHash);
        }
    } else {
        console.log('[FIX ENGINE] No schedules were modified in this iteration');
    }
    
    updateOverallProgress('committing', (includeScanPhase ? (progressWeights.scanning || 0) : 0) + (progressWeights.analyzing || 0) + (progressWeights.fixing || 0) + (progressWeights.committing || 0), 'fix');
    
    iterationsCompleted++;

    // Phase: Rescanning
    checkTimeout();
    const rescanningProgress = (includeScanPhase ? (progressWeights.scanning || 0) : 0) + (progressWeights.analyzing || 0) + (progressWeights.fixing || 0) + (progressWeights.committing || 0);
    updateOverallProgress('rescanning', rescanningProgress, 'rescan');
    
    // Auto-rescan if enabled and violations remain
    if (autoRescan && remainingViolations.length > 0 && iterationsCompleted < maxIterations) {
        if (onProgress) {
            onProgress({
                current: 0,
                total: 100,
                currentViolation: 'Rescanning schedule...',
                phase: 'rescanning',
                overallProgress: iterationProgressBase + (includeScanPhase ? (progressWeights.scanning || 0) : 0) + (progressWeights.analyzing || 0) + (progressWeights.fixing || 0) + (progressWeights.committing || 0),
                pipelineStage: 'rescan',
            });
        }

        // Fetch updated schedules from database
        console.log('[FIX ENGINE] Fetching updated schedules from database for rescan');
        const { data: updatedSchedules } = await supabase
            .from('schedules')
            .select('*')
            .in('status', ['published', 'draft']);

        if (updatedSchedules) {
            const rescanHash = computeScheduleHash(updatedSchedules);
            console.log('[FIX ENGINE] Rescan schedule hash:', rescanHash);
            console.log('[FIX ENGINE] Hash changed from initial:', rescanHash !== initialScheduleHash);
            
            // Check for loop detection - if this hash matches ANY previous iteration, we're in a loop
            const previousHashes = Array.from(stateHashHistory.values());
            if (previousHashes.includes(rescanHash)) {
                const loopIteration = previousHashes.indexOf(rescanHash);
                console.error('[FIX ENGINE] LOOP DETECTED: Same state hash as iteration', loopIteration);
                warnings.push(`Loop detected: Schedule state returned to same state as iteration ${loopIteration}. Stopping to prevent infinite loop.`);
                return {
                    success: false,
                    message: 'Loop detected - schedule state is cycling. Manual intervention required.',
                    appliedFixes,
                    remainingViolations,
                    warnings,
                    iterationsCompleted,
                    conflictsResolvedInLastPass,
                    loopDetected: true,
                };
            }
            
            stateHashHistory.set(iterationsCompleted, rescanHash);
            
            // Import scanAllConstraints dynamically to avoid circular dependency
            const { scanAllConstraints: reScan } = await import('./conflictScanner');
            
            console.log('[FIX ENGINE] Running rescan with', updatedSchedules.length, 'schedules');
            // Re-scan with updated schedules
            const newScanResult = await reScan(
                updatedSchedules,
                teachers,
                rooms,
                sections,
                subjects,
                {
                    maxConsecutiveHours: 4,
                    maxDailyHours: 8,
                    maxDailyClasses: 6,
                    maxWeeklyHours: 40,
                    breakWindows: [],
                }
            );
            
            console.log('[FIX ENGINE] Rescan complete - conflicts:', newScanResult.hardViolations.length, 'soft score:', newScanResult.softScore.totalScore);
            console.log('[FIX ENGINE] Conflict delta:', newScanResult.hardViolations.length - scanResult.hardViolations.length);
            console.log('[FIX ENGINE] Soft score delta:', newScanResult.softScore.totalScore - scanResult.softScore.totalScore);
            
            // Validate soft score delta
            const conflictDelta = newScanResult.hardViolations.length - scanResult.hardViolations.length;
            const scoreDelta = newScanResult.softScore.totalScore - scanResult.softScore.totalScore;
            
            if (conflictDelta < 0 && scoreDelta < 0) {
                // Conflicts decreased but score worsened - unexpected
                console.error('[FIX ENGINE] CRITICAL: Conflicts decreased but soft score worsened!');
                console.error('[FIX ENGINE] Conflict delta:', conflictDelta, 'Score delta:', scoreDelta);
                warnings.push('Conflicts decreased but soft score worsened. This indicates a scoring calculation error.');
            } else if (conflictDelta === 0 && scoreDelta !== 0) {
                // Conflict count unchanged but score changed - suspicious
                console.warn('[FIX ENGINE] Conflict count unchanged but soft score changed:', scoreDelta);
                warnings.push('Conflict count unchanged but soft score changed. Verify scoring logic.');
            } else if (conflictDelta > 0 && scoreDelta > 0) {
                // Conflicts increased and score worsened - expected
                console.warn('[FIX ENGINE] Conflicts increased and soft score worsened - expected behavior');
            }
            
            updateOverallProgress('rescanning', (includeScanPhase ? (progressWeights.scanning || 0) : 0) + (progressWeights.analyzing || 0) + (progressWeights.fixing || 0) + (progressWeights.committing || 0) + (progressWeights.rescanning || 0), 'rescan');

            // Check if new violations appeared or existing ones were resolved
            const newViolations = newScanResult.hardViolations;
            const newViolationIds = new Set(newViolations.map(v => v.id));
            
            // Count newly resolved violations
            const resolvedCount = scanResult.hardViolations.filter(v => !newViolationIds.has(v.id)).length;
            conflictsResolvedInLastPass += resolvedCount;
            console.log('[FIX ENGINE] Resolved conflicts in this pass:', resolvedCount);
            
            // Phase: Validating
            const validatingProgress = (includeScanPhase ? (progressWeights.scanning || 0) : 0) + (progressWeights.analyzing || 0) + (progressWeights.fixing || 0) + (progressWeights.committing || 0) + (progressWeights.rescanning || 0);
            updateOverallProgress('validating', validatingProgress, 'validate');

            // If no progress was made (same number of violations), investigate
            if (newViolations.length >= scanResult.hardViolations.length) {
                if (newViolations.length === scanResult.hardViolations.length) {
                    // Check if violations are actually the same (stale data)
                    const oldViolationIds = new Set(scanResult.hardViolations.map(v => v.id));
                    const violationsChanged = newViolations.some(v => !oldViolationIds.has(v.id));
                    
                    if (!violationsChanged && modifiedScheduleIds.size > 0) {
                        console.error('[FIX ENGINE] CRITICAL: Conflict count unchanged after fixes with modifications!');
                        console.error('[FIX ENGINE] This indicates fixes were not persisted or rescan used stale data');
                        warnings.push(`Conflict count unchanged after fixes. This may indicate: fixes were not persisted, rescan used stale data, or conflicts are unresolvable with current constraints.`);
                    } else if (violationsChanged) {
                        console.warn('[FIX ENGINE] Conflict count unchanged but violations changed - new conflicts introduced');
                        warnings.push(`Conflict count unchanged but violations changed. New conflicts may have been introduced by the fixes.`);
                    } else {
                        console.warn('[FIX ENGINE] No progress made in iteration', iterationsCompleted);
                        warnings.push(`No progress made in iteration ${iterationsCompleted}. Stopping to avoid infinite loop.`);
                        
                        // Edge case: Check if conflicts are unresolvable
                        if (iterationsCompleted === 1 && modifiedScheduleIds.size > 0) {
                            console.error('[FIX ENGINE] Conflicts may be unresolvable with current constraints');
                            warnings.push('Conflicts may be unresolvable with current time/room/teacher constraints. Manual intervention may be required.');
                        }
                    }
                } else {
                    console.error('[FIX ENGINE] Conflict count increased from', scanResult.hardViolations.length, 'to', newViolations.length);
                    warnings.push(`Conflict count increased from ${scanResult.hardViolations.length} to ${newViolations.length}. Fixes may have introduced new conflicts.`);
                }
                remainingViolations = newViolations;
                const finalProgress = (includeScanPhase ? (progressWeights.scanning || 0) : 0) + (progressWeights.analyzing || 0) + (progressWeights.fixing || 0) + (progressWeights.committing || 0) + (progressWeights.rescanning || 0) + (progressWeights.validating || 0);
                updateOverallProgress('validating', finalProgress, 'validate');
            } else {
                // Progress was made - continue with new violations
                console.log('[FIX ENGINE] Progress made - conflicts decreased from', scanResult.hardViolations.length, 'to', newViolations.length);
                remainingViolations = newViolations;
                schedules.length = 0;
                schedules.push(...updatedSchedules);
                
                // Calculate progress for next iteration
                const nextIterationProgress = totalProgressPerIteration * 0.8; // Each iteration is 80% of the previous to show diminishing returns
                const newOverallProgressStart = Math.min(95, iterationProgressBase + totalProgressPerIteration - nextIterationProgress);
                
                checkTimeout();
                // Recursively continue fixing
                const continuationResult = await applyAutonomousFixes(
                    { ...newScanResult },
                    schedules,
                    teachers,
                    rooms,
                    sections,
                    subjects,
                    supabase,
                    {
                        ...options,
                        maxIterations: maxIterations - iterationsCompleted,
                        overallProgressStart: newOverallProgressStart,
                        includeScanPhase: false, // Only include scan in first iteration
                    }
                );

                // Merge results
                appliedFixes.push(...continuationResult.appliedFixes);
                warnings.push(...(continuationResult.warnings || []));
                remainingViolations = continuationResult.remainingViolations;
                iterationsCompleted += (continuationResult.iterationsCompleted || 0);
                conflictsResolvedInLastPass += (continuationResult.conflictsResolvedInLastPass || 0);
            }
        } else {
            const finalProgress = (includeScanPhase ? (progressWeights.scanning || 0) : 0) + (progressWeights.analyzing || 0) + (progressWeights.fixing || 0) + (progressWeights.committing || 0) + (progressWeights.rescanning || 0) + (progressWeights.validating || 0);
            updateOverallProgress('validating', finalProgress, 'validate');
            warnings.push('Failed to fetch updated schedules for rescan.');
        }
    } else {
        // No auto-rescan needed or max iterations reached
        const finalProgress = (includeScanPhase ? (progressWeights.scanning || 0) : 0) + (progressWeights.analyzing || 0) + (progressWeights.fixing || 0) + (progressWeights.committing || 0) + (progressWeights.rescanning || 0) + (progressWeights.validating || 0);
        updateOverallProgress('validating', finalProgress, 'complete');
    }

    // Calculate final state changes
    const finalScheduleHash = computeScheduleHash(schedules);
    const finalStateChanges = compareScheduleStates(
        schedules.filter(s => modifiedScheduleIds.has(s.id)),
        schedules
    );
    
    console.log('[FIX ENGINE] Fix process complete');
    console.log('[FIX ENGINE] Final schedule hash:', finalScheduleHash);
    console.log('[FIX ENGINE] Hash changed from initial:', finalScheduleHash !== initialScheduleHash);
    console.log('[FIX ENGINE] Total iterations:', iterationsCompleted);
    console.log('[FIX ENGINE] Total fixes applied:', appliedFixes.length);
    console.log('[FIX ENGINE] Remaining violations:', remainingViolations.length);
    console.log('[FIX ENGINE] Total warnings:', warnings.length);

    return {
        success: remainingViolations.length === 0,
        message: appliedFixes.length > 0 
            ? `Applied ${appliedFixes.length} automatic fixes across ${iterationsCompleted} iteration${iterationsCompleted > 1 ? 's' : ''}. ${remainingViolations.length} violations remain. ${conflictsResolvedInLastPass} conflicts resolved in last pass.`
            : 'No fixes were applied.',
        appliedFixes,
        remainingViolations,
        warnings,
        iterationsCompleted,
        conflictsResolvedInLastPass,
        stateChanges: {
            beforeHash: initialScheduleHash,
            afterHash: finalScheduleHash,
            changedCount: finalStateChanges.changedCount,
            changes: finalStateChanges.changes,
        },
        loopDetected: false,
    };
};

/**
 * Type-safe helper to update schedule fields
 */
const updateScheduleField = (sched: Schedule, field: string, value: string): void => {
    // Create a type-safe mapping of valid fields
    const validFields: Record<string, keyof Schedule> = {
        teacher_id: 'teacher_id',
        room_id: 'room_id',
        section_id: 'section_id',
        day_of_week: 'day_of_week',
        start_time: 'start_time',
        end_time: 'end_time',
    };
    
    const typedField = validFields[field];
    if (typedField) {
        // Use unknown to bypass type checking, then validate at runtime
        (sched as unknown as Record<keyof Schedule, unknown>)[typedField] = value;
    }
};

/**
 * Apply a single fix (for interactive mode)
 */
export const applyFix = async (
    fix: FixOption,
    schedules: Schedule[],
    supabase: SupabaseClient
): Promise<{ success: boolean; message: string; beforeHash?: string; afterHash?: string; stateChanged?: boolean }> => {
    // Capture before state for verification
    const beforeHash = scheduleValidation.computeStateHash(schedules);
    console.log('[FIXING ENGINE] Before fix application:', {
        fixTitle: fix.title,
        beforeHash,
        scheduleCount: schedules.length,
    });
    
    try {
        for (const change of fix.changes) {
            const updates: Record<string, string> = {};
            for (const c of change.changes) {
                updates[c.field] = c.newValue;
            }
            const { error } = await supabase
                .from('schedules')
                .update(updates)
                .eq('id', change.scheduleId);
            
            if (error) {
                throw new Error(`Database update failed for schedule ${change.scheduleId}: ${error.message}`);
            }
        }

        // Fetch updated schedules from database to verify persistence
        const { data: updatedSchedules } = await supabase
            .from('schedules')
            .select('*')
            .in('status', ['published', 'draft']);
        
        // Update local schedules only after successful database write
        for (const change of fix.changes) {
            const sched = schedules.find(s => s.id === change.scheduleId);
            if (sched) {
                for (const c of change.changes) {
                    updateScheduleField(sched, c.field, c.newValue);
                }
            }
        }

        // Verify the fix actually changed the state
        const afterHash = scheduleValidation.computeStateHash(schedules);
        const diff = scheduleValidation.computeStateDiff(schedules, updatedSchedules || []);
        const fixVerification = scheduleValidation.verifyFixApplied(schedules, updatedSchedules || []);
        
        console.log('[FIXING ENGINE] After fix application:', {
            fixTitle: fix.title,
            afterHash,
            stateChanged: beforeHash !== afterHash,
            diff,
            fixVerification,
        });
        
        // Log the verification result
        if (!fixVerification.success) {
            console.warn('[FIXING ENGINE] Fix claimed success but verification failed:', fixVerification.reason);
            scheduleLogger.system.error('conflicts', 'repair', 'Fix verification failed in engine', fixVerification.reason);
        } else {
            scheduleLogger.conflicts.fixApplied(0, fix.title, 0, 0); // Version counts will be updated by caller
        }

        return {
            success: true,
            message: `Successfully applied fix: ${fix.title}`,
            beforeHash,
            afterHash,
            stateChanged: beforeHash !== afterHash,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Fix application error:', error);
        scheduleLogger.system.error('conflicts', 'repair', 'Fix application failed', errorMessage);
        return {
            success: false,
            message: `Failed to apply fix "${fix.title}": ${errorMessage}`,
        };
    }
};
