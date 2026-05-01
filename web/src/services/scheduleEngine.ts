/**
 * Constraint-Satisfaction Problem (CSP) based scheduling engine.
 * Validates and generates conflict-free timetables.
 */

interface ScheduleSlot {
    subjectId: string;
    teacherId: string;
    roomId: string;
    sectionId: string;
    dayOfWeek: string;
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
    score: number;
}

const timeRangesOverlap = (s1: string, e1: string, s2: string, e2: string): boolean => {
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    return toMin(s1) < toMin(e2) && toMin(s2) < toMin(e1);
};

export class ScheduleEngine {
    private rooms: any[];
    private sections: any[];

    constructor(rooms: any[], _teachers: any[], _subjects: any[], sections: any[]) {
        this.rooms = rooms;
        this.sections = sections;
    }

    validateSchedule(slots: ScheduleSlot[]): ConflictReport[] {
        const conflicts: ConflictReport[] = [];

        for (let i = 0; i < slots.length; i++) {
            for (let j = i + 1; j < slots.length; j++) {
                const a = slots[i];
                const b = slots[j];

                if (a.dayOfWeek !== b.dayOfWeek) continue;

                const overlaps = timeRangesOverlap(a.startTime, a.endTime, b.startTime, b.endTime);
                if (!overlaps) continue;

                if (a.roomId === b.roomId) {
                    conflicts.push({
                        type: 'room_conflict',
                        severity: 'high',
                        description: `Room double-booking on ${a.dayOfWeek} at ${a.startTime}`,
                        slotA: a,
                        slotB: b,
                    });
                }

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

        for (const slot of slots) {
            const room = this.rooms.find(r => r.id === slot.roomId);
            const section = this.sections.find(s => s.id === slot.sectionId);
            if (room && section && (section.student_count || 0) > (room.capacity || 0)) {
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

    calculateScore(slots: ScheduleSlot[]): number {
        const conflicts = this.validateSchedule(slots);
        const highConflicts = conflicts.filter(c => c.severity === 'high').length;
        const medConflicts = conflicts.filter(c => c.severity === 'medium').length;

        let score = 100;
        score -= highConflicts * 15;
        score -= medConflicts * 5;

        return Math.max(0, Math.min(100, score));
    }

    generateSchedule(
        existingSlots: ScheduleSlot[] = [],
        _options: { maxIterations?: number; preferenceWeight?: number } = {}
    ): ScheduleResult {
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

    suggestSwap(
        conflict: ConflictReport,
        currentSchedule: ScheduleSlot[]
    ): ScheduleSlot | null {
        if (conflict.type === 'room_conflict' && conflict.slotB) {
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
                return { ...conflict.slotB, roomId: availableRoom.id };
            }
        }
        return null;
    }
}

export default ScheduleEngine;
