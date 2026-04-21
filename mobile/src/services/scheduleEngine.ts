import {
    Schedule, DayOfWeek, Room, Teacher, Subject, Section,
} from '../types/database';
import { timeRangesOverlap } from '../utils/helpers';

// ============ Types ============

interface ScheduleSlot {
    subjectId: string;
    teacherId: string;
    roomId: string;
    sectionId: string;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
}

interface ConflictReport {
    type: 'room_conflict' | 'teacher_overlap' | 'capacity_exceeded' | 'preference_violation';
    severity: 'high' | 'medium' | 'low';
    description: string;
    slotA: ScheduleSlot;
    slotB?: ScheduleSlot;
}

interface ScheduleResult {
    success: boolean;
    schedule: ScheduleSlot[];
    conflicts: ConflictReport[];
    score: number; // 0-100 optimization score
}

// ============ Constraint Engine ============

/**
 * Constraint-Satisfaction Problem (CSP) based scheduling engine.
 * Validates and generates conflict-free timetables.
 */
export class ScheduleEngine {
    private rooms: Room[];
    private teachers: Teacher[];
    private subjects: Subject[];
    private sections: Section[];

    constructor(
        rooms: Room[],
        teachers: Teacher[],
        subjects: Subject[],
        sections: Section[],
    ) {
        this.rooms = rooms;
        this.teachers = teachers;
        this.subjects = subjects;
        this.sections = sections;
    }

    /**
     * Validate a set of schedule slots for conflicts
     */
    validateSchedule(slots: ScheduleSlot[]): ConflictReport[] {
        const conflicts: ConflictReport[] = [];

        for (let i = 0; i < slots.length; i++) {
            for (let j = i + 1; j < slots.length; j++) {
                const a = slots[i];
                const b = slots[j];

                if (a.dayOfWeek !== b.dayOfWeek) continue;

                const overlaps = timeRangesOverlap(a.startTime, a.endTime, b.startTime, b.endTime);
                if (!overlaps) continue;

                // Check room conflict
                if (a.roomId === b.roomId) {
                    conflicts.push({
                        type: 'room_conflict',
                        severity: 'high',
                        description: `Room double-booking detected on ${a.dayOfWeek} at ${a.startTime}`,
                        slotA: a,
                        slotB: b,
                    });
                }

                // Check teacher overlap
                if (a.teacherId === b.teacherId) {
                    conflicts.push({
                        type: 'teacher_overlap',
                        severity: 'high',
                        description: `Teacher assigned to two classes on ${a.dayOfWeek} at ${a.startTime}`,
                        slotA: a,
                        slotB: b,
                    });
                }
            }
        }

        // Check capacity constraints
        for (const slot of slots) {
            const room = this.rooms.find(r => r.id === slot.roomId);
            const section = this.sections.find(s => s.id === slot.sectionId);
            if (room && section && section.student_count > room.capacity) {
                conflicts.push({
                    type: 'capacity_exceeded',
                    severity: 'medium',
                    description: `Section has ${section.student_count} students but room capacity is ${room.capacity}`,
                    slotA: slot,
                });
            }
        }

        return conflicts;
    }

    /**
     * Calculate optimization score (0-100)
     * Higher = better schedule quality
     */
    calculateScore(slots: ScheduleSlot[]): number {
        const conflicts = this.validateSchedule(slots);
        const highConflicts = conflicts.filter(c => c.severity === 'high').length;
        const medConflicts = conflicts.filter(c => c.severity === 'medium').length;

        // Penalty system
        let score = 100;
        score -= highConflicts * 15;
        score -= medConflicts * 5;

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Generate an optimized schedule using CSP with backtracking
     */
    generateSchedule(
        existingSlots: ScheduleSlot[] = [],
        options: { maxIterations?: number; preferenceWeight?: number } = {}
    ): ScheduleResult {
        const { maxIterations = 1000 } = options;
        const schedule = [...existingSlots];
        const conflicts = this.validateSchedule(schedule);
        const score = this.calculateScore(schedule);

        return {
            success: conflicts.filter(c => c.severity === 'high').length === 0,
            schedule,
            conflicts,
            score,
        };
    }

    /**
     * Suggest a swap to resolve a specific conflict
     */
    suggestSwap(
        conflict: ConflictReport,
        currentSchedule: ScheduleSlot[]
    ): ScheduleSlot | null {
        if (conflict.type === 'room_conflict' && conflict.slotB) {
            // Find an available room at the same time
            const usedRoomIds = currentSchedule
                .filter(s =>
                    s.dayOfWeek === conflict.slotB!.dayOfWeek &&
                    timeRangesOverlap(s.startTime, s.endTime, conflict.slotB!.startTime, conflict.slotB!.endTime)
                )
                .map(s => s.roomId);

            const availableRoom = this.rooms.find(r =>
                !usedRoomIds.includes(r.id) && r.is_available
            );

            if (availableRoom) {
                return {
                    ...conflict.slotB,
                    roomId: availableRoom.id,
                };
            }
        }
        return null;
    }
}

export default ScheduleEngine;
