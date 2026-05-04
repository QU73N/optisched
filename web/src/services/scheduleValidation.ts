/**
 * Schedule Validation and Invariant Enforcement
 * 
 * This service provides runtime validation and invariant checking for the OptiSched system.
 * Every meaningful operation should be followed by verification.
 */

import type { Schedule, Teacher, Room, Section, Subject } from '../types/database';

// ---------------------------------------------------------------------------
// Validation Result Types
// ---------------------------------------------------------------------------

export interface ValidationError {
    field: string;
    message: string;
    severity: 'error' | 'warning';
    invariant?: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
}

export interface StateDiff {
    changed: boolean;
    added: string[];
    removed: string[];
    modified: string[];
    details: Record<string, { before: unknown; after: unknown }>;
}

export interface BeforeAfterSnapshot {
    before: {
        scheduleHash: string;
        conflictCount: number;
        softScore: number;
        scheduleIds: string[];
    };
    after: {
        scheduleHash: string;
        conflictCount: number;
        softScore: number;
        scheduleIds: string[];
    };
    diff: StateDiff;
}

// ---------------------------------------------------------------------------
// Validation Service
// ---------------------------------------------------------------------------

class ScheduleValidationService {
    /**
     * Validate a single schedule entry against invariants
     */
    validateScheduleEntry(entry: Schedule, teachers: Teacher[], rooms: Room[], sections: Section[], subjects: Subject[]): ValidationResult {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];

        // Invariant: Every schedule must have required fields
        if (!entry.id) {
            errors.push({ field: 'id', message: 'Schedule ID is required', severity: 'error', invariant: 'schedule_id_required' });
        }
        if (!entry.subject_id) {
            errors.push({ field: 'subject_id', message: 'Subject ID is required', severity: 'error', invariant: 'subject_id_required' });
        }
        if (!entry.teacher_id) {
            errors.push({ field: 'teacher_id', message: 'Teacher ID is required', severity: 'error', invariant: 'teacher_id_required' });
        }
        if (!entry.room_id) {
            errors.push({ field: 'room_id', message: 'Room ID is required', severity: 'error', invariant: 'room_id_required' });
        }
        if (!entry.section_id) {
            errors.push({ field: 'section_id', message: 'Section ID is required', severity: 'error', invariant: 'section_id_required' });
        }
        if (!entry.day_of_week) {
            errors.push({ field: 'day_of_week', message: 'Day of week is required', severity: 'error', invariant: 'day_required' });
        }
        if (!entry.start_time) {
            errors.push({ field: 'start_time', message: 'Start time is required', severity: 'error', invariant: 'start_time_required' });
        }
        if (!entry.end_time) {
            errors.push({ field: 'end_time', message: 'End time is required', severity: 'error', invariant: 'end_time_required' });
        }

        // Invariant: End time must be after start time
        if (entry.start_time && entry.end_time) {
            const start = this.timeToMinutes(entry.start_time);
            const end = this.timeToMinutes(entry.end_time);
            if (end <= start) {
                errors.push({ 
                    field: 'time_range', 
                    message: `End time (${entry.end_time}) must be after start time (${entry.start_time})`, 
                    severity: 'error', 
                    invariant: 'time_range_valid' 
                });
            }
        }

        // Invariant: Referenced entities must exist
        if (entry.teacher_id && !teachers.find(t => t.id === entry.teacher_id)) {
            errors.push({ 
                field: 'teacher_id', 
                message: `Teacher ${entry.teacher_id} does not exist`, 
                severity: 'error', 
                invariant: 'teacher_exists' 
            });
        }
        if (entry.room_id && !rooms.find(r => r.id === entry.room_id)) {
            errors.push({ 
                field: 'room_id', 
                message: `Room ${entry.room_id} does not exist`, 
                severity: 'error', 
                invariant: 'room_exists' 
            });
        }
        if (entry.section_id && !sections.find(s => s.id === entry.section_id)) {
            errors.push({ 
                field: 'section_id', 
                message: `Section ${entry.section_id} does not exist`, 
                severity: 'error', 
                invariant: 'section_exists' 
            });
        }
        if (entry.subject_id && !subjects.find(s => s.id === entry.subject_id)) {
            errors.push({ 
                field: 'subject_id', 
                message: `Subject ${entry.subject_id} does not exist`, 
                severity: 'error', 
                invariant: 'subject_exists' 
            });
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Validate an array of schedule entries for overlaps
     */
    validateNoOverlaps(schedules: Schedule[]): ValidationResult {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];

        // Group by day
        const byDay = new Map<string, Schedule[]>();
        for (const sched of schedules) {
            if (!sched.day_of_week) continue;
            if (!byDay.has(sched.day_of_week)) {
                byDay.set(sched.day_of_week, []);
            }
            byDay.get(sched.day_of_week)!.push(sched);
        }

        // Check for overlaps within each day
        for (const [day, daySchedules] of byDay) {
            // Teacher overlaps
            const byTeacher = new Map<string, Schedule[]>();
            for (const sched of daySchedules) {
                if (!sched.teacher_id) continue;
                if (!byTeacher.has(sched.teacher_id)) {
                    byTeacher.set(sched.teacher_id, []);
                }
                byTeacher.get(sched.teacher_id)!.push(sched);
            }

            for (const [teacherId, teacherSchedules] of byTeacher) {
                const overlaps = this.findOverlaps(teacherSchedules);
                for (const overlap of overlaps) {
                    errors.push({
                        field: 'teacher_overlap',
                        message: `Teacher ${teacherId} has overlapping sessions on ${day}: ${overlap[0].id} (${overlap[0].start_time}-${overlap[0].end_time}) and ${overlap[1].id} (${overlap[1].start_time}-${overlap[1].end_time})`,
                        severity: 'error',
                        invariant: 'no_teacher_overlap',
                    });
                }
            }

            // Room overlaps
            const byRoom = new Map<string, Schedule[]>();
            for (const sched of daySchedules) {
                if (!sched.room_id) continue;
                if (!byRoom.has(sched.room_id)) {
                    byRoom.set(sched.room_id, []);
                }
                byRoom.get(sched.room_id)!.push(sched);
            }

            for (const [roomId, roomSchedules] of byRoom) {
                const overlaps = this.findOverlaps(roomSchedules);
                for (const overlap of overlaps) {
                    errors.push({
                        field: 'room_overlap',
                        message: `Room ${roomId} has overlapping sessions on ${day}: ${overlap[0].id} (${overlap[0].start_time}-${overlap[0].end_time}) and ${overlap[1].id} (${overlap[1].start_time}-${overlap[1].end_time})`,
                        severity: 'error',
                        invariant: 'no_room_overlap',
                    });
                }
            }

            // Section overlaps
            const bySection = new Map<string, Schedule[]>();
            for (const sched of daySchedules) {
                if (!sched.section_id) continue;
                if (!bySection.has(sched.section_id)) {
                    bySection.set(sched.section_id, []);
                }
                bySection.get(sched.section_id)!.push(sched);
            }

            for (const [sectionId, sectionSchedules] of bySection) {
                const overlaps = this.findOverlaps(sectionSchedules);
                for (const overlap of overlaps) {
                    errors.push({
                        field: 'section_overlap',
                        message: `Section ${sectionId} has overlapping sessions on ${day}: ${overlap[0].id} (${overlap[0].start_time}-${overlap[0].end_time}) and ${overlap[1].id} (${overlap[1].start_time}-${overlap[1].end_time})`,
                        severity: 'error',
                        invariant: 'no_section_overlap',
                    });
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Find overlapping schedules in a list
     */
    private findOverlaps(schedules: Schedule[]): [Schedule, Schedule][] {
        const overlaps: [Schedule, Schedule][] = [];
        const sorted = [...schedules].sort((a, b) => this.timeToMinutes(a.start_time) - this.timeToMinutes(b.start_time));

        for (let i = 0; i < sorted.length; i++) {
            for (let j = i + 1; j < sorted.length; j++) {
                const a = sorted[i];
                const b = sorted[j];
                const aStart = this.timeToMinutes(a.start_time);
                const aEnd = this.timeToMinutes(a.end_time);
                const bStart = this.timeToMinutes(b.start_time);
                const bEnd = this.timeToMinutes(b.end_time);

                // Check for overlap
                if (aStart < bEnd && bStart < aEnd) {
                    overlaps.push([a, b]);
                }
                // If no overlap and b starts after a ends, no need to check further
                if (bStart >= aEnd) {
                    break;
                }
            }
        }

        return overlaps;
    }

    /**
     * Convert time string "HH:MM" to minutes
     */
    private timeToMinutes(time: string): number {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }

    /**
     * Compute a hash of schedule state
     */
    computeStateHash(schedules: Schedule[]): string {
        // CRITICAL: Sort by essential fields (NOT id, which may be generated server-side)
        const sorted = [...schedules].sort((a, b) => {
            const aKey = `${a.subject_id}|${a.teacher_id}|${a.room_id}|${a.section_id}|${a.day_of_week}|${a.start_time}`;
            const bKey = `${b.subject_id}|${b.teacher_id}|${b.room_id}|${b.section_id}|${b.day_of_week}|${b.start_time}`;
            return aKey.localeCompare(bKey);
        });
        
        // Create hash from essential fields ONLY (excludes id which changes after insertion)
        const stateStr = sorted.map(s => 
            `${s.teacher_id || ''}|${s.room_id || ''}|${s.section_id || ''}|${s.day_of_week}|${s.start_time}|${s.end_time}|${s.subject_id || ''}`
        ).join('||');
        
        let hash = 5381;
        for (let i = 0; i < stateStr.length; i++) {
            hash = ((hash << 5) + hash) + stateStr.charCodeAt(i);
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * Compute deep diff between two schedule arrays
     */
    computeStateDiff(before: Schedule[], after: Schedule[]): StateDiff {
        const beforeMap = new Map(before.map(s => [s.id, s]));
        const afterMap = new Map(after.map(s => [s.id, s]));
        
        const beforeIds = new Set(beforeMap.keys());
        const afterIds = new Set(afterMap.keys());
        
        const added: string[] = [];
        const removed: string[] = [];
        const modified: string[] = [];
        const details: Record<string, { before: unknown; after: unknown }> = {};

        // Find added
        for (const id of afterIds) {
            if (!beforeIds.has(id)) {
                added.push(id);
            }
        }

        // Find removed
        for (const id of beforeIds) {
            if (!afterIds.has(id)) {
                removed.push(id);
            }
        }

        // Find modified
        for (const id of beforeIds) {
            if (afterIds.has(id)) {
                const beforeSched = beforeMap.get(id)!;
                const afterSched = afterMap.get(id)!;
                if (JSON.stringify(beforeSched) !== JSON.stringify(afterSched)) {
                    modified.push(id);
                    details[id] = { before: beforeSched, after: afterSched };
                }
            }
        }

        return {
            changed: added.length > 0 || removed.length > 0 || modified.length > 0,
            added,
            removed,
            modified,
            details,
        };
    }

    /**
     * Verify that a fix actually changed the state
     */
    verifyFixApplied(before: Schedule[], after: Schedule[]): { success: boolean; reason?: string } {
        const diff = this.computeStateDiff(before, after);
        
        if (!diff.changed) {
            return { success: false, reason: 'Fix did not change schedule state (no-op fix)' };
        }

        if (diff.modified.length === 0 && diff.added.length === 0 && diff.removed.length === 0) {
            return { success: false, reason: 'Fix produced no meaningful changes' };
        }

        return { success: true };
    }

    /**
     * Verify that a score is consistent with the schedule state
     */
    verifyScoreConsistency(score: number, recomputedScore: number): { consistent: boolean; delta: number } {
        const delta = Math.abs(score - recomputedScore);
        const consistent = delta < 0.01; // Allow small floating-point differences
        return { consistent, delta };
    }

    /**
     * Create a before/after snapshot for verification
     */
    createSnapshot(
        beforeSchedules: Schedule[],
        afterSchedules: Schedule[],
        beforeConflictCount: number,
        afterConflictCount: number,
        beforeSoftScore: number,
        afterSoftScore: number
    ): BeforeAfterSnapshot {
        return {
            before: {
                scheduleHash: this.computeStateHash(beforeSchedules),
                conflictCount: beforeConflictCount,
                softScore: beforeSoftScore,
                scheduleIds: beforeSchedules.map(s => s.id),
            },
            after: {
                scheduleHash: this.computeStateHash(afterSchedules),
                conflictCount: afterConflictCount,
                softScore: afterSoftScore,
                scheduleIds: afterSchedules.map(s => s.id),
            },
            diff: this.computeStateDiff(beforeSchedules, afterSchedules),
        };
    }

    /**
     * Verify that a snapshot represents a valid state transition
     */
    verifySnapshot(snapshot: BeforeAfterSnapshot): { valid: boolean; issues: string[] } {
        const issues: string[] = [];

        // If state changed, hash should be different
        if (snapshot.diff.changed && snapshot.before.scheduleHash === snapshot.after.scheduleHash) {
            issues.push('State changed but hash remained the same (hash collision or bug)');
        }

        // If state didn't change, hash should be the same
        if (!snapshot.diff.changed && snapshot.before.scheduleHash !== snapshot.after.scheduleHash) {
            issues.push('State unchanged but hash changed (hash inconsistency)');
        }

        // If schedules were added/removed, conflict count should likely change
        if ((snapshot.diff.added.length > 0 || snapshot.diff.removed.length > 0) && 
            snapshot.before.conflictCount === snapshot.after.conflictCount) {
            issues.push('Schedules added/removed but conflict count unchanged (possible stale scan)');
        }

        // If schedules were modified, score should likely change
        if (snapshot.diff.modified.length > 0 && 
            Math.abs(snapshot.before.softScore - snapshot.after.softScore) < 0.01) {
            issues.push('Schedules modified but soft score unchanged (possible stale score)');
        }

        return {
            valid: issues.length === 0,
            issues,
        };
    }

    /**
     * Assert an invariant at runtime
     */
    assertInvariant(condition: boolean, invariantName: string, message: string): void {
        if (!condition) {
            console.error(`[INVARIANT VIOLATION] ${invariantName}: ${message}`);
            throw new Error(`Invariant violated: ${invariantName} - ${message}`);
        }
    }

    /**
     * Assert that a value is not null/undefined
     */
    assertNotNil<T>(value: T | null | undefined, name: string): T {
        if (value === null || value === undefined) {
            throw new Error(`Assertion failed: ${name} is null or undefined`);
        }
        return value;
    }
}

// ---------------------------------------------------------------------------
// Export singleton instance
// ---------------------------------------------------------------------------

export const scheduleValidation = new ScheduleValidationService();
