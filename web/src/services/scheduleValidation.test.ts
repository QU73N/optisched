/**
 * Schedule Validation Service Tests
 * 
 * Tests for runtime validation, invariant enforcement, and state verification
 * These tests ensure the validation service correctly detects invalid states,
 * enforces invariants, and verifies that changes actually occurred.
 */

import { describe, it, expect } from 'vitest';
import { scheduleValidation } from './scheduleValidation';
import type { Schedule, Teacher, Room, Section, Subject } from '../types/database';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const mockTeachers: Teacher[] = [
    {
        id: 'teacher1',
        profile_id: 'profile1',
        department: 'CS',
        employment_type: 'full-time',
        max_hours: 40,
        max_hours_per_day: 8,
        current_load_percentage: 0,
        is_active: true,
        weight: 50,
        priority_note: null,
        owner_id: null,
        is_public: true,
        shared_with: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
    {
        id: 'teacher2',
        profile_id: 'profile2',
        department: 'CS',
        employment_type: 'full-time',
        max_hours: 40,
        max_hours_per_day: 8,
        current_load_percentage: 0,
        is_active: true,
        weight: 50,
        priority_note: null,
        owner_id: null,
        is_public: true,
        shared_with: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    },
];

const mockRooms: Room[] = [
    {
        id: 'room1',
        name: 'Room 101',
        capacity: 30,
        type: 'common',
        building: 'A',
        floor: 1,
        equipment: [],
        is_available: true,
        compatible_subject_ids: [],
        weight: 50,
        priority_note: null,
        owner_id: null,
        is_public: true,
        shared_with: [],
        created_at: new Date().toISOString(),
    },
    {
        id: 'room2',
        name: 'Room 102',
        capacity: 40,
        type: 'common',
        building: 'A',
        floor: 1,
        equipment: [],
        is_available: true,
        compatible_subject_ids: ['subject2'],
        weight: 50,
        priority_note: null,
        owner_id: null,
        is_public: true,
        shared_with: [],
        created_at: new Date().toISOString(),
    },
];

const mockSections: Section[] = [
    {
        id: 'section1',
        name: 'Section A',
        program: 'CS',
        year_level: 1,
        student_count: 30,
        parent_id: null,
        weight: 50,
        path: '',
        node_type: 'section',
        is_active: true,
        description: '',
        metadata: {},
        sort_order: 0,
        owner_id: null,
        is_public: true,
        shared_with: [],
        created_at: new Date().toISOString(),
    },
    {
        id: 'section2',
        name: 'Section B',
        program: 'CS',
        year_level: 1,
        student_count: 30,
        parent_id: null,
        weight: 50,
        path: '',
        node_type: 'section',
        is_active: true,
        description: '',
        metadata: {},
        sort_order: 0,
        owner_id: null,
        is_public: true,
        shared_with: [],
        created_at: new Date().toISOString(),
    },
];

const mockSubjects: Subject[] = [
    {
        id: 'subject1',
        code: 'MATH101',
        name: 'Math 101',
        units: 3,
        type: 'common',
        duration_hours: 3,
        program: 'CS',
        year_level: 1,
        compatible_room_ids: [],
        teacher_id: 'teacher1',
        weight: 50,
        priority_note: null,
        owner_id: null,
        is_public: true,
        shared_with: [],
        created_at: new Date().toISOString(),
    },
    {
        id: 'subject2',
        code: 'PHYS101',
        name: 'Physics 101',
        units: 3,
        type: 'special',
        duration_hours: 3,
        program: 'CS',
        year_level: 1,
        compatible_room_ids: ['room2'],
        teacher_id: 'teacher2',
        weight: 50,
        priority_note: null,
        owner_id: null,
        is_public: true,
        shared_with: [],
        created_at: new Date().toISOString(),
    },
];

const validSchedule: Schedule = {
    id: 'sched1',
    subject_id: 'subject1',
    teacher_id: 'teacher1',
    room_id: 'room1',
    section_id: 'section1',
    day_of_week: 'Monday',
    start_time: '09:00',
    end_time: '10:00',
    status: 'published',
    semester: '2024-1',
    academic_year: '2024',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: 'user1',
    submitted_at: null,
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    deleted_at: null,
    deleted_by: null,
    is_locked: false,
    locked_by: null,
    locked_at: null,
    lock_reason: null,
};

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('ScheduleValidation Service', () => {
    describe('validateScheduleEntry', () => {
        it('should accept a valid schedule entry', () => {
            const result = scheduleValidation.validateScheduleEntry(
                validSchedule,
                mockTeachers,
                mockRooms,
                mockSections,
                mockSubjects
            );
            
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject schedule with missing id', () => {
            const invalidSchedule = { ...validSchedule, id: '' };
            const result = scheduleValidation.validateScheduleEntry(
                invalidSchedule,
                mockTeachers,
                mockRooms,
                mockSections,
                mockSubjects
            );
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'id')).toBe(true);
        });

        it('should reject schedule with missing subject_id', () => {
            const invalidSchedule = { ...validSchedule, subject_id: '' };
            const result = scheduleValidation.validateScheduleEntry(
                invalidSchedule,
                mockTeachers,
                mockRooms,
                mockSections,
                mockSubjects
            );
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'subject_id')).toBe(true);
        });

        it('should reject schedule with invalid time range (end before start)', () => {
            const invalidSchedule = { ...validSchedule, start_time: '10:00', end_time: '09:00' };
            const result = scheduleValidation.validateScheduleEntry(
                invalidSchedule,
                mockTeachers,
                mockRooms,
                mockSections,
                mockSubjects
            );
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'time_range')).toBe(true);
        });

        it('should reject schedule with non-existent teacher', () => {
            const invalidSchedule = { ...validSchedule, teacher_id: 'nonexistent' };
            const result = scheduleValidation.validateScheduleEntry(
                invalidSchedule,
                mockTeachers,
                mockRooms,
                mockSections,
                mockSubjects
            );
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'teacher_id')).toBe(true);
        });

        it('should reject schedule with non-existent room', () => {
            const invalidSchedule = { ...validSchedule, room_id: 'nonexistent' };
            const result = scheduleValidation.validateScheduleEntry(
                invalidSchedule,
                mockTeachers,
                mockRooms,
                mockSections,
                mockSubjects
            );
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'room_id')).toBe(true);
        });
    });

    describe('validateNoOverlaps', () => {
        it('should accept schedules with no overlaps', () => {
            const schedules: Schedule[] = [
                {
                    ...validSchedule,
                    id: 'sched1',
                    day_of_week: 'Monday',
                    start_time: '09:00',
                    end_time: '10:00',
                },
                {
                    ...validSchedule,
                    id: 'sched2',
                    day_of_week: 'Monday',
                    start_time: '10:00',
                    end_time: '11:00',
                },
            ];
            
            const result = scheduleValidation.validateNoOverlaps(schedules);
            
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect teacher overlaps on same day', () => {
            const schedules: Schedule[] = [
                {
                    ...validSchedule,
                    id: 'sched1',
                    teacher_id: 'teacher1',
                    day_of_week: 'Monday',
                    start_time: '09:00',
                    end_time: '10:30',
                },
                {
                    ...validSchedule,
                    id: 'sched2',
                    teacher_id: 'teacher1',
                    day_of_week: 'Monday',
                    start_time: '10:00',
                    end_time: '11:30',
                },
            ];
            
            const result = scheduleValidation.validateNoOverlaps(schedules);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'teacher_overlap')).toBe(true);
        });

        it('should detect room overlaps on same day', () => {
            const schedules: Schedule[] = [
                {
                    ...validSchedule,
                    id: 'sched1',
                    room_id: 'room1',
                    day_of_week: 'Monday',
                    start_time: '09:00',
                    end_time: '10:30',
                },
                {
                    ...validSchedule,
                    id: 'sched2',
                    room_id: 'room1',
                    day_of_week: 'Monday',
                    start_time: '10:00',
                    end_time: '11:30',
                },
            ];
            
            const result = scheduleValidation.validateNoOverlaps(schedules);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'room_overlap')).toBe(true);
        });

        it('should detect section overlaps on same day', () => {
            const schedules: Schedule[] = [
                {
                    ...validSchedule,
                    id: 'sched1',
                    section_id: 'section1',
                    day_of_week: 'Monday',
                    start_time: '09:00',
                    end_time: '10:30',
                },
                {
                    ...validSchedule,
                    id: 'sched2',
                    section_id: 'section1',
                    day_of_week: 'Monday',
                    start_time: '10:00',
                    end_time: '11:30',
                },
            ];
            
            const result = scheduleValidation.validateNoOverlaps(schedules);
            
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.field === 'section_overlap')).toBe(true);
        });

        it('should allow same teacher on different days', () => {
            const schedules: Schedule[] = [
                {
                    ...validSchedule,
                    id: 'sched1',
                    teacher_id: 'teacher1',
                    day_of_week: 'Monday',
                    start_time: '09:00',
                    end_time: '10:30',
                },
                {
                    ...validSchedule,
                    id: 'sched2',
                    teacher_id: 'teacher1',
                    day_of_week: 'Tuesday',
                    start_time: '09:00',
                    end_time: '10:30',
                },
            ];
            
            const result = scheduleValidation.validateNoOverlaps(schedules);
            
            expect(result.valid).toBe(true);
        });
    });

    describe('computeStateHash', () => {
        it('should produce consistent hash for same schedules', () => {
            const schedules: Schedule[] = [validSchedule];
            
            const hash1 = scheduleValidation.computeStateHash(schedules);
            const hash2 = scheduleValidation.computeStateHash(schedules);
            
            expect(hash1).toBe(hash2);
        });

        it('should produce different hash for different schedules', () => {
            const schedules1: Schedule[] = [validSchedule];
            const schedules2: Schedule[] = [
                { ...validSchedule, start_time: '10:00' },
            ];
            
            const hash1 = scheduleValidation.computeStateHash(schedules1);
            const hash2 = scheduleValidation.computeStateHash(schedules2);
            
            expect(hash1).not.toBe(hash2);
        });

        it('should be order-independent', () => {
            const schedules1: Schedule[] = [
                { ...validSchedule, id: 'sched1' },
                { ...validSchedule, id: 'sched2' },
            ];
            const schedules2: Schedule[] = [
                { ...validSchedule, id: 'sched2' },
                { ...validSchedule, id: 'sched1' },
            ];
            
            const hash1 = scheduleValidation.computeStateHash(schedules1);
            const hash2 = scheduleValidation.computeStateHash(schedules2);
            
            expect(hash1).toBe(hash2);
        });
    });

    describe('computeStateDiff', () => {
        it('should detect no changes when schedules are identical', () => {
            const before: Schedule[] = [validSchedule];
            const after: Schedule[] = [validSchedule];
            
            const diff = scheduleValidation.computeStateDiff(before, after);
            
            expect(diff.changed).toBe(false);
            expect(diff.added).toHaveLength(0);
            expect(diff.removed).toHaveLength(0);
            expect(diff.modified).toHaveLength(0);
        });

        it('should detect added schedules', () => {
            const before: Schedule[] = [validSchedule];
            const after: Schedule[] = [
                validSchedule,
                { ...validSchedule, id: 'sched2' },
            ];
            
            const diff = scheduleValidation.computeStateDiff(before, after);
            
            expect(diff.changed).toBe(true);
            expect(diff.added).toContain('sched2');
            expect(diff.removed).toHaveLength(0);
            expect(diff.modified).toHaveLength(0);
        });

        it('should detect removed schedules', () => {
            const before: Schedule[] = [
                validSchedule,
                { ...validSchedule, id: 'sched2' },
            ];
            const after: Schedule[] = [validSchedule];
            
            const diff = scheduleValidation.computeStateDiff(before, after);
            
            expect(diff.changed).toBe(true);
            expect(diff.added).toHaveLength(0);
            expect(diff.removed).toContain('sched2');
            expect(diff.modified).toHaveLength(0);
        });

        it('should detect modified schedules', () => {
            const before: Schedule[] = [validSchedule];
            const after: Schedule[] = [
                { ...validSchedule, start_time: '10:00' },
            ];
            
            const diff = scheduleValidation.computeStateDiff(before, after);
            
            expect(diff.changed).toBe(true);
            expect(diff.added).toHaveLength(0);
            expect(diff.removed).toHaveLength(0);
            expect(diff.modified).toContain(validSchedule.id);
            expect(diff.details[validSchedule.id]).toBeDefined();
        });
    });

    describe('verifyFixApplied', () => {
        it('should accept fix that changed the state', () => {
            const before: Schedule[] = [validSchedule];
            const after: Schedule[] = [
                { ...validSchedule, start_time: '10:00' },
            ];
            
            const result = scheduleValidation.verifyFixApplied(before, after);
            
            expect(result.success).toBe(true);
        });

        it('should reject fix that did not change the state (no-op)', () => {
            const before: Schedule[] = [validSchedule];
            const after: Schedule[] = [validSchedule];
            
            const result = scheduleValidation.verifyFixApplied(before, after);
            
            expect(result.success).toBe(false);
            expect(result.reason).toContain('no-op');
        });

        it('should reject fix with empty diff', () => {
            const before: Schedule[] = [];
            const after: Schedule[] = [];
            
            const result = scheduleValidation.verifyFixApplied(before, after);
            
            expect(result.success).toBe(false);
        });
    });

    describe('verifyScoreConsistency', () => {
        it('should accept consistent scores', () => {
            const result = scheduleValidation.verifyScoreConsistency(100, 100);
            
            expect(result.consistent).toBe(true);
            expect(result.delta).toBe(0);
        });

        it('should accept scores within tolerance', () => {
            const result = scheduleValidation.verifyScoreConsistency(100, 100.005);
            
            expect(result.consistent).toBe(true);
            expect(result.delta).toBeLessThan(0.01);
        });

        it('should reject inconsistent scores', () => {
            const result = scheduleValidation.verifyScoreConsistency(100, 95);
            
            expect(result.consistent).toBe(false);
            expect(result.delta).toBeGreaterThan(0.01);
        });
    });

    describe('createSnapshot', () => {
        it('should create a snapshot with before and after state', () => {
            const before: Schedule[] = [validSchedule];
            const after: Schedule[] = [
                { ...validSchedule, start_time: '10:00' },
            ];
            
            const snapshot = scheduleValidation.createSnapshot(
                before,
                after,
                5,
                3,
                100,
                95
            );
            
            expect(snapshot.before.scheduleHash).toBeDefined();
            expect(snapshot.after.scheduleHash).toBeDefined();
            expect(snapshot.before.conflictCount).toBe(5);
            expect(snapshot.after.conflictCount).toBe(3);
            expect(snapshot.before.softScore).toBe(100);
            expect(snapshot.after.softScore).toBe(95);
            expect(snapshot.diff.changed).toBe(true);
        });
    });

    describe('verifySnapshot', () => {
        it('should accept valid state transition', () => {
            const before: Schedule[] = [validSchedule];
            const after: Schedule[] = [
                { ...validSchedule, start_time: '10:00' },
            ];
            
            const snapshot = scheduleValidation.createSnapshot(
                before,
                after,
                5,
                3,
                100,
                95
            );
            
            const result = scheduleValidation.verifySnapshot(snapshot);
            
            expect(result.valid).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        it('should reject snapshot where state changed but hash remained same', () => {
            const before: Schedule[] = [validSchedule];
            const after: Schedule[] = [
                { ...validSchedule, start_time: '10:00' },
            ];
            
            const snapshot = scheduleValidation.createSnapshot(
                before,
                after,
                5,
                3,
                100,
                95
            );
            
            // Manually corrupt the hash to simulate hash collision
            snapshot.before.scheduleHash = snapshot.after.scheduleHash;
            
            const result = scheduleValidation.verifySnapshot(snapshot);
            
            expect(result.valid).toBe(false);
            expect(result.issues.some(i => i.includes('hash'))).toBe(true);
        });

        it('should reject snapshot where schedules added/removed but conflict count unchanged', () => {
            const before: Schedule[] = [validSchedule];
            const after: Schedule[] = [
                validSchedule,
                { ...validSchedule, id: 'sched2' },
            ];
            
            const snapshot = scheduleValidation.createSnapshot(
                before,
                after,
                5, // Conflict count unchanged despite adding schedule
                5,
                100,
                100
            );
            
            const result = scheduleValidation.verifySnapshot(snapshot);
            
            expect(result.valid).toBe(false);
            expect(result.issues.some(i => i.includes('conflict count'))).toBe(true);
        });

        it('should reject snapshot where schedules modified but score unchanged', () => {
            const before: Schedule[] = [validSchedule];
            const after: Schedule[] = [
                { ...validSchedule, start_time: '10:00' },
            ];
            
            const snapshot = scheduleValidation.createSnapshot(
                before,
                after,
                5,
                5,
                100, // Score unchanged despite modifying schedule
                100
            );
            
            const result = scheduleValidation.verifySnapshot(snapshot);
            
            expect(result.valid).toBe(false);
            expect(result.issues.some(i => i.includes('soft score'))).toBe(true);
        });
    });

    describe('assertInvariant', () => {
        it('should not throw when invariant holds', () => {
            expect(() => {
                scheduleValidation.assertInvariant(true, 'test_invariant', 'Test passed');
            }).not.toThrow();
        });

        it('should throw when invariant violated', () => {
            expect(() => {
                scheduleValidation.assertInvariant(false, 'test_invariant', 'Test failed');
            }).toThrow('Invariant violated: test_invariant');
        });
    });

    describe('assertNotNil', () => {
        it('should return value when not null/undefined', () => {
            const result = scheduleValidation.assertNotNil('test', 'test_value');
            expect(result).toBe('test');
        });

        it('should throw when value is null', () => {
            expect(() => {
                scheduleValidation.assertNotNil(null, 'test_value');
            }).toThrow('Assertion failed: test_value is null or undefined');
        });

        it('should throw when value is undefined', () => {
            expect(() => {
                scheduleValidation.assertNotNil(undefined, 'test_value');
            }).toThrow('Assertion failed: test_value is null or undefined');
        });
    });
});
