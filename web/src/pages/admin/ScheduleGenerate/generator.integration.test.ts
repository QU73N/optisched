import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runGenerator } from './generator';
import type { Subject, Teacher, Room, Section, ExistingSchedule, GenerationConfig } from './types';

// Mock data for integration tests
const mockTeachers: Teacher[] = [
    { id: 't1', full_name: 'Teacher 1', max_hours: 40, weight: 50, priority_note: null, preferred_days: ['Monday', 'Wednesday', 'Friday'], availability: {} },
    { id: 't2', full_name: 'Teacher 2', max_hours: 40, weight: 50, priority_note: null, preferred_days: ['Tuesday', 'Thursday'], availability: {} },
];

const mockRooms: Room[] = [
    { id: 'r1', name: 'Room 1', type: 'regular', building: 'A', floor: 1, is_available: true, weight: 50, priority_note: null, capacity: 30 },
    { id: 'r2', name: 'Room 2', type: 'special', building: 'B', floor: 1, is_available: true, weight: 50, priority_note: null, capacity: 30 },
];

const mockSections: Section[] = [
    { id: 's1', name: 'Section 1', program: 'BSIT', year_level: 1, student_count: 30, parent_id: null, weight: 50, path: 'BSIT|1', node_type: 'section', is_active: true, description: null, metadata: {}, sort_order: 0, load_category: 'normal', special_scheduling_rules: {} },
    { id: 's2', name: 'Section 2', program: 'BSIT', year_level: 2, student_count: 30, parent_id: null, weight: 50, path: 'BSIT|2', node_type: 'section', is_active: true, description: null, metadata: {}, sort_order: 0, load_category: 'normal', special_scheduling_rules: {} },
];

const mockSubjects: Subject[] = [
    { id: 'sub1', code: 'CS101', name: 'Intro to CS', program: 'BSIT', year_level: 1, teacher_id: 't1', duration_hours: 3, requires_lab: false, weight: 50, priority_note: null, monthly_hour_targets: null },
    { id: 'sub2', code: 'CS102', name: 'Data Structures', program: 'BSIT', year_level: 2, teacher_id: 't2', duration_hours: 3, requires_lab: false, weight: 50, priority_note: null, monthly_hour_targets: null },
];

const mockExisting: ExistingSchedule[] = [];

const mockConfig: GenerationConfig = {
    mode: 'full',
    sessionMinutes: 90,
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    dayStart: '08:00',
    dayEnd: '17:00',
    breaks: [],
    maxAttempts: 10,
    clearExisting: true,
    sectionIds: [],
    partialTarget: null,
    priorities: {
        subjects: {},
        sections: {},
        specialRoomBias: 50,
    },
    soft: {
        balancedLoad: 50,
        compactSchedule: 50,
        minimizeRoomSwitch: 50,
        teacherPreferredTime: 50,
        dailyLoadBalance: 50,
        workloadFairness: 50,
        subjectSpacing: 50,
        roomUtilization: 50,
    },
    overflowPolicy: 'fail',
};

describe('Generator Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('runGenerator - Full Generation Mode', () => {
        it('should complete generation with valid input', async () => {
            const progressFn = vi.fn();
            
            const result = await runGenerator(
                {
                    subjects: mockSubjects,
                    teachers: mockTeachers,
                    rooms: mockRooms,
                    sections: mockSections,
                    existing: mockExisting,
                    config: mockConfig,
                    institutionalPolicies: {},
                },
                progressFn,
            );

            expect(result).toBeDefined();
            expect(result.entries).toBeInstanceOf(Array);
            expect(result.total).toBeGreaterThan(0);
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
        });

        it('should call progress callback during generation', async () => {
            const progressFn = vi.fn();
            
            await runGenerator(
                {
                    subjects: mockSubjects,
                    teachers: mockTeachers,
                    rooms: mockRooms,
                    sections: mockSections,
                    existing: mockExisting,
                    config: mockConfig,
                    institutionalPolicies: {},
                },
                progressFn,
            );

            expect(progressFn).toHaveBeenCalled();
            expect(progressFn).toHaveBeenCalledTimes(6); // Progress is called 6 times during generation
        });

        it('should handle empty subjects array', async () => {
            const progressFn = vi.fn();
            
            const result = await runGenerator(
                {
                    subjects: [],
                    teachers: mockTeachers,
                    rooms: mockRooms,
                    sections: mockSections,
                    existing: mockExisting,
                    config: mockConfig,
                    institutionalPolicies: {},
                },
                progressFn,
            );

            expect(result.total).toBe(0);
            expect(result.placed).toBe(0);
        });

        it('should handle institutional policies', async () => {
            const progressFn = vi.fn();
            const policies = { max_teaching_hours: '35' };
            
            const result = await runGenerator(
                {
                    subjects: mockSubjects,
                    teachers: mockTeachers,
                    rooms: mockRooms,
                    sections: mockSections,
                    existing: mockExisting,
                    config: mockConfig,
                    institutionalPolicies: policies,
                },
                progressFn,
            );

            expect(result).toBeDefined();
        });
    });

    describe('runGenerator - Partial Generation Mode', () => {
        it('should generate for specific section target', async () => {
            const progressFn = vi.fn();
            
            const partialConfig: GenerationConfig = {
                ...mockConfig,
                mode: 'partial',
                partialTarget: { kind: 'section', id: 's1' },
            };

            const result = await runGenerator(
                {
                    subjects: mockSubjects,
                    teachers: mockTeachers,
                    rooms: mockRooms,
                    sections: mockSections,
                    existing: mockExisting,
                    config: partialConfig,
                    institutionalPolicies: {},
                },
                progressFn,
            );

            expect(result).toBeDefined();
            expect(result.mode).toBe('partial');
            expect(result.diff).toBeInstanceOf(Array);
        });

        it('should generate for specific teacher target', async () => {
            const progressFn = vi.fn();
            
            const partialConfig: GenerationConfig = {
                ...mockConfig,
                mode: 'partial',
                partialTarget: { kind: 'teacher', id: 't1' },
            };

            const result = await runGenerator(
                {
                    subjects: mockSubjects,
                    teachers: mockTeachers,
                    rooms: mockRooms,
                    sections: mockSections,
                    existing: mockExisting,
                    config: partialConfig,
                    institutionalPolicies: {},
                },
                progressFn,
            );

            expect(result).toBeDefined();
        });

        it('should generate for specific room target', async () => {
            const progressFn = vi.fn();
            
            const partialConfig: GenerationConfig = {
                ...mockConfig,
                mode: 'partial',
                partialTarget: { kind: 'room', id: 'r1' },
            };

            const result = await runGenerator(
                {
                    subjects: mockSubjects,
                    teachers: mockTeachers,
                    rooms: mockRooms,
                    sections: mockSections,
                    existing: mockExisting,
                    config: partialConfig,
                    institutionalPolicies: {},
                },
                progressFn,
            );

            expect(result).toBeDefined();
        });
    });

    describe('runGenerator - Error Handling', () => {
        it('should handle missing teacher gracefully', async () => {
            const progressFn = vi.fn();
            const subjectsWithoutTeacher = [
                { ...mockSubjects[0], teacher_id: 'invalid_id' },
            ];

            const result = await runGenerator(
                {
                    subjects: subjectsWithoutTeacher,
                    teachers: mockTeachers,
                    rooms: mockRooms,
                    sections: mockSections,
                    existing: mockExisting,
                    config: mockConfig,
                    institutionalPolicies: {},
                },
                progressFn,
            );

            expect(result.errors).toBeInstanceOf(Array);
            expect(result.placed).toBeLessThan(result.total);
        });

        it('should return early if schedule is impossible', async () => {
            const progressFn = vi.fn();
            const noRooms: Room[] = [];

            const result = await runGenerator(
                {
                    subjects: mockSubjects,
                    teachers: mockTeachers,
                    rooms: noRooms,
                    sections: mockSections,
                    existing: mockExisting,
                    config: mockConfig,
                    institutionalPolicies: {},
                },
                progressFn,
            );

            // Should return early with errors explaining why impossible
            expect(result.placed).toBe(0);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(e => e.includes('No available rooms'))).toBe(true);
        });

        it('should handle no available rooms', async () => {
            const progressFn = vi.fn();
            const unavailableRooms = [
                { ...mockRooms[0], is_available: false },
                { ...mockRooms[1], is_available: false },
            ];

            const result = await runGenerator(
                {
                    subjects: mockSubjects,
                    teachers: mockTeachers,
                    rooms: unavailableRooms,
                    sections: mockSections,
                    existing: mockExisting,
                    config: mockConfig,
                    institutionalPolicies: {},
                },
                progressFn,
            );

            // When no rooms are available, generation should place 0 entries
            expect(result.placed).toBe(0);
        });
    });

    describe('runGenerator - High Priority Handling', () => {
        it('should track high priority placement', async () => {
            const progressFn = vi.fn();
            const configWithHighPriority: GenerationConfig = {
                ...mockConfig,
                priorities: {
                    subjects: { 'sub1': 80 },
                    sections: {},
                    specialRoomBias: 50,
                },
            };

            const result = await runGenerator(
                {
                    subjects: mockSubjects,
                    teachers: mockTeachers,
                    rooms: mockRooms,
                    sections: mockSections,
                    existing: mockExisting,
                    config: configWithHighPriority,
                    institutionalPolicies: {},
                },
                progressFn,
            );

            expect(result.highPriorityTotal).toBeGreaterThan(0);
        });

        it('should use soft constraint score in final result', async () => {
            const progressFn = vi.fn();

            const result = await runGenerator(
                {
                    subjects: mockSubjects,
                    teachers: mockTeachers,
                    rooms: mockRooms,
                    sections: mockSections,
                    existing: mockExisting,
                    config: mockConfig,
                    institutionalPolicies: {},
                },
                progressFn,
            );

            // The score should be between 0 and 100 (soft constraint score range)
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);
        });
    });
});
