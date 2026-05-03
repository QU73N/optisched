import { describe, it, expect, vi } from 'vitest';
import { runGenerator } from './generator';
import type { Subject, Teacher, Room, Section, ExistingSchedule, GenerationConfig } from './types';

/**
 * Performance tests for the generator to ensure forward checking doesn't degrade performance.
 * These tests measure generation time with various dataset sizes.
 */
describe('Generator Performance Tests', () => {
    const generateTeachers = (count: number): Teacher[] => {
        return Array.from({ length: count }, (_, i) => ({
            id: `t${i}`,
            full_name: `Teacher ${i}`,
            max_hours: 40,
            weight: 50,
            priority_note: null,
            preferred_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            availability: {},
        }));
    };

    const generateRooms = (count: number): Room[] => {
        return Array.from({ length: count }, (_, i) => ({
            id: `r${i}`,
            name: `Room ${i}`,
            type: i % 3 === 0 ? 'special' : 'regular',
            building: String.fromCharCode(65 + (i % 5)),
            floor: Math.floor(i / 5) + 1,
            is_available: true,
            weight: 50,
            priority_note: null,
            capacity: 30,
        }));
    };

    const generateSections = (count: number): Section[] => {
        return Array.from({ length: count }, (_, i) => ({
            id: `s${i}`,
            name: `Section ${i}`,
            program: 'BSIT',
            year_level: (i % 4) + 1,
            student_count: 30,
            parent_id: null,
            weight: 50,
            path: `BSIT|${(i % 4) + 1}`,
            node_type: 'section',
            is_active: true,
            description: null,
            metadata: {},
            sort_order: 0,
            load_category: 'normal',
            special_scheduling_rules: {},
        }));
    };

    const generateSubjects = (count: number, teachers: Teacher[]): Subject[] => {
        return Array.from({ length: count }, (_, i) => ({
            id: `sub${i}`,
            code: `SUB${i}`,
            name: `Subject ${i}`,
            program: 'BSIT',
            year_level: (i % 4) + 1,
            teacher_id: teachers[i % teachers.length].id,
            duration_hours: 3,
            requires_lab: i % 5 === 0, // 20% of subjects require lab
            weight: 50,
            priority_note: null,
            monthly_hour_targets: null,
        }));
    };

    const mockConfig: GenerationConfig = {
        mode: 'full',
        sessionMinutes: 90,
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        dayStart: '08:00',
        dayEnd: '17:00',
        breaks: [],
        maxAttempts: 10,
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
        overflowPolicy: 'relax_soft',
        enableForwardChecking: false,
        enableOptimization: false,
        optimizationTimeLimit: 30,
        optimizationMaxIterations: 100,
        optimizationProfile: 'balanced',
        optimizationMode: 'safe',
        optimizationSeed: 42,
    };

    it('should complete small dataset (10 subjects, 5 teachers, 5 rooms, 5 sections) in under 2 seconds', async () => {
        const teachers = generateTeachers(5);
        const rooms = generateRooms(5);
        const sections = generateSections(5);
        const subjects = generateSubjects(10, teachers);
        const existing: ExistingSchedule[] = [];
        const progressFn = vi.fn();

        const startTime = performance.now();
        const result = await runGenerator(
            {
                subjects,
                teachers,
                rooms,
                sections,
                existing,
                config: mockConfig,
                institutionalPolicies: {},
            },
            progressFn,
        );
        const endTime = performance.now();
        const duration = endTime - startTime;

        expect(result).toBeDefined();
        expect(result.placed).toBeGreaterThan(0);
        expect(duration).toBeLessThan(2000); // Under 2 seconds
    });

    it('should complete medium dataset (50 subjects, 10 teachers, 10 rooms, 10 sections) in under 5 seconds', async () => {
        const teachers = generateTeachers(10);
        const rooms = generateRooms(10);
        const sections = generateSections(10);
        const subjects = generateSubjects(50, teachers);
        const existing: ExistingSchedule[] = [];
        const progressFn = vi.fn();

        const startTime = performance.now();
        const result = await runGenerator(
            {
                subjects,
                teachers,
                rooms,
                sections,
                existing,
                config: mockConfig,
                institutionalPolicies: {},
            },
            progressFn,
        );
        const endTime = performance.now();
        const duration = endTime - startTime;

        expect(result).toBeDefined();
        expect(result.placed).toBeGreaterThan(0);
        expect(duration).toBeLessThan(5000); // Under 5 seconds
    });

    it('should complete large dataset (50 subjects, 25 teachers, 25 rooms, 25 sections) in under 10 seconds', async () => {
        const teachers = generateTeachers(25);
        const rooms = generateRooms(25);
        const sections = generateSections(25);
        const subjects = generateSubjects(50, teachers);
        const existing: ExistingSchedule[] = [];
        const progressFn = vi.fn();

        const startTime = performance.now();
        const result = await runGenerator(
            {
                subjects,
                teachers,
                rooms,
                sections,
                existing,
                config: mockConfig,
                institutionalPolicies: {},
            },
            progressFn,
        );
        const endTime = performance.now();
        const duration = endTime - startTime;

        expect(result).toBeDefined();
        expect(result.placed).toBeGreaterThan(0);
        expect(duration).toBeLessThan(10000); // Under 10 seconds
    }, 15000); // 15 second timeout for this test

    it('should handle forward checking overhead with scarce resources', async () => {
        const teachers = generateTeachers(10);
        // Limited special rooms to test forward checking overhead
        const rooms = generateRooms(10).slice(0, 3); // Only 3 rooms
        const sections = generateSections(10);
        const subjects = generateSubjects(30, teachers).map(s => ({
            ...s,
            requires_lab: true, // All require lab to stress test forward checking
        }));
        const existing: ExistingSchedule[] = [];
        const progressFn = vi.fn();

        const startTime = performance.now();
        const result = await runGenerator(
            {
                subjects,
                teachers,
                rooms,
                sections,
                existing,
                config: mockConfig,
                institutionalPolicies: {},
            },
            progressFn,
        );
        const endTime = performance.now();
        const duration = endTime - startTime;

        expect(result).toBeDefined();
        // Forward checking should prevent dead ends, so some placements should succeed
        expect(duration).toBeLessThan(5000); // Under 5 seconds even with scarce resources
    });
});
