import { describe, bench } from 'vitest';
import { runGenerator } from './generator';
import type { Subject, Teacher, Room, Section, ExistingSchedule, GenerationConfig } from './types';

// Benchmark data - small dataset
const smallTeachers: Teacher[] = [
    { id: 't1', full_name: 'Teacher 1', max_hours: 40, weight: 50, priority_note: null, preferred_days: ['Monday', 'Wednesday', 'Friday'], availability: {} },
    { id: 't2', full_name: 'Teacher 2', max_hours: 40, weight: 50, priority_note: null, preferred_days: ['Tuesday', 'Thursday'], availability: {} },
];

const smallRooms: Room[] = [
    { id: 'r1', name: 'Room 1', type: 'regular', building: 'A', floor: 1, is_available: true, weight: 50, priority_note: null, capacity: 30 },
    { id: 'r2', name: 'Room 2', type: 'special', building: 'B', floor: 1, is_available: true, weight: 50, priority_note: null, capacity: 30 },
];

const smallSections: Section[] = [
    { id: 's1', name: 'Section 1', program: 'BSIT', year_level: 1, student_count: 30, parent_id: null, weight: 50, path: 'BSIT|1', node_type: 'section', is_active: true, description: null, metadata: {}, sort_order: 0, load_category: 'normal', special_scheduling_rules: {} },
];

const smallSubjects: Subject[] = [
    { id: 'sub1', code: 'CS101', name: 'Intro to CS', program: 'BSIT', year_level: 1, teacher_id: 't1', duration_hours: 3, type: 'common', weight: 50, priority_note: null, monthly_hour_targets: null },
];

const smallExisting: ExistingSchedule[] = [];

const smallConfig: GenerationConfig = {
    mode: 'full',
    sessionMinutes: 90,
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    dayStart: '08:00',
    dayEnd: '17:00',
    breaks: [],
    maxAttempts: 5,
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

// Benchmark data - medium dataset
const mediumTeachers: Teacher[] = Array.from({ length: 10 }, (_, i) => ({
    id: `t${i}`,
    full_name: `Teacher ${i}`,
    max_hours: 40,
    weight: 50,
    priority_note: null,
    preferred_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    availability: {},
}));

const mediumRooms: Room[] = Array.from({ length: 8 }, (_, i) => ({
    id: `r${i}`,
    name: `Room ${i}`,
    type: i % 2 === 0 ? 'regular' : 'special',
    building: ['A', 'B'][i % 2],
    floor: Math.floor(i / 2) + 1,
    is_available: true,
    weight: 50,
    priority_note: null,
    capacity: 30,
}));

const mediumSections: Section[] = Array.from({ length: 5 }, (_, i) => ({
    id: `s${i}`,
    name: `Section ${i}`,
    program: 'BSIT',
    year_level: i + 1,
    student_count: 30,
    parent_id: null,
    weight: 50,
    path: `BSIT|${i + 1}`,
    node_type: 'section',
    is_active: true,
    description: null,
    metadata: {},
    sort_order: 0,
    load_category: 'normal',
    special_scheduling_rules: {},
}));

const mediumSubjects: Subject[] = Array.from({ length: 15 }, (_, i) => ({
    id: `sub${i}`,
    code: `CS${100 + i}`,
    name: `Subject ${i}`,
    program: 'BSIT',
    year_level: (i % 4) + 1,
    teacher_id: `t${i % 10}`,
    duration_hours: 3,
    type: i % 3 === 0 ? 'special' : 'common',
    weight: 50,
    priority_note: null,
    monthly_hour_targets: null,
}));

describe('Generator Performance Benchmarks', () => {
    bench('Small dataset generation (2 teachers, 2 rooms, 1 section, 1 subject)', async () => {
        const progressFn = () => {
            // Progress callback for benchmark
        };

        await runGenerator(
            {
                subjects: smallSubjects,
                teachers: smallTeachers,
                rooms: smallRooms,
                sections: smallSections,
                existing: smallExisting,
                config: smallConfig,
                institutionalPolicies: {},
            },
            progressFn,
        );
    });

    bench('Medium dataset generation (10 teachers, 8 rooms, 5 sections, 15 subjects)', async () => {
        const progressFn = () => {
            // Progress callback for benchmark
        };

        await runGenerator(
            {
                subjects: mediumSubjects,
                teachers: mediumTeachers,
                rooms: mediumRooms,
                sections: mediumSections,
                existing: smallExisting,
                config: { ...smallConfig, maxAttempts: 10 },
                institutionalPolicies: {},
            },
            progressFn,
        );
    });
});
