/**
 * Tests for the 15-phase CSP-based Schedule Generator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ScheduleGenerator } from './scheduleGenerator';
import type { GeneratorConfig, RawData } from './types';
import type { Teacher, Room, Section, Subject } from '../../pages/admin/ScheduleGenerate/types';

describe('ScheduleGenerator', () => {
  let mockConfig: GeneratorConfig;
  let mockRawData: RawData;

  beforeEach(() => {
    // Setup mock data
    mockRawData = {
      teachers: [
        {
          id: 'teacher-1',
          full_name: 'John Doe',
          max_hours: 40,
          max_classes_per_day: 8,
          weight: 50,
          preferred_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          availability: {},
        } as Teacher,
      ],
      rooms: [
        {
          id: 'room-1',
          name: 'Room 101',
          type: 'regular',
          capacity: 30,
          building: 'Main',
          floor: 1,
        } as Room,
      ],
      sections: [
        {
          id: 'section-1',
          name: 'Section A',
          program: 'BSIT',
          year_level: 1,
          student_count: 30,
          path: 'BSIT|1|Section A',
          weight: 50,
          load_category: 'normal',
          special_scheduling_rules: {},
        } as Section,
      ],
      subjects: [
        {
          id: 'subject-1',
          code: 'CS101',
          name: 'Computer Science 101',
          program: 'BSIT',
          year_level: 1,
          teacher_id: 'teacher-1',
          duration_hours: 3,
          weight: 50,
          type: 'common',
        } as Subject,
      ],
      existing: [],
      institutional_policies: {},
    };

    mockConfig = {
      mode: 'full',
      scope: {
        sections: ['section-1'],
        teachers: [],
        rooms: [],
        subjects: [],
        target: 'full',
        protectedElements: [],
      },
      schedule_window: {
        operating_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        day_start: '08:00',
        day_end: '17:00',
        session_granularity: 60,
        session_duration: 60,
        break_windows: [],
      },
      constraints: {
        hard: [],
        soft: [],
        preference: [],
      },
      seed: 42,
      max_attempts: 1,
      enable_forward_checking: false,
      enable_optimization: false,
      optimization_time_limit: 30,
      optimization_max_iterations: 100,
      optimization_profile: 'balanced',
      optimization_mode: 'safe',
      institutional_options: {
        split_session_support: false,
        compressed_week_support: false,
        staggered_break_support: false,
        shared_teacher_support: false,
        deloaded_teacher_support: false,
        special_room_fallback_policy: 'fail',
        priority_override_policy: 'flexible',
        overflow_policy: 'fail',
        max_consecutive_hours: 4,
        max_daily_load: 8,
      },
      scalability_options: {
        max_sessions: 0,
        enable_memoization: true,
        memoization_cache_size: 1000,
        enable_parallel_checking: false,
        parallel_worker_count: 4,
        enable_early_termination: false,
        early_termination_threshold: 95,
        max_generation_time: 0,
      },
    };
  });

  it('should instantiate without errors', () => {
    const generator = new ScheduleGenerator(mockConfig, mockRawData);
    expect(generator).toBeDefined();
  });

  it('should run generation pipeline without errors', async () => {
    const generator = new ScheduleGenerator(mockConfig, mockRawData);
    const result = await generator.generate();

    expect(result).toBeDefined();
    expect(result.timetable).toBeDefined();
    expect(result.placed_sessions_list).toBeInstanceOf(Array);
    expect(result.unplaced_sessions_list).toBeInstanceOf(Array);
  });

  it('should place sessions when valid configuration is provided', async () => {
    const generator = new ScheduleGenerator(mockConfig, mockRawData);
    const result = await generator.generate();

    expect(result.placed_sessions_list.length).toBeGreaterThan(0);
  });

  it('should return timetable organized by day', async () => {
    const generator = new ScheduleGenerator(mockConfig, mockRawData);
    const result = await generator.generate();

    expect(Object.keys(result.timetable)).toContain('Monday');
  });

  it('should include hard constraint compliance status', async () => {
    const generator = new ScheduleGenerator(mockConfig, mockRawData);
    const result = await generator.generate();

    expect(result.hard_constraint_compliance).toBeDefined();
    expect(result.hard_constraint_compliance.compliance_percentage).toBeGreaterThanOrEqual(0);
    expect(result.hard_constraint_compliance.compliance_percentage).toBeLessThanOrEqual(100);
  });

  it('should track version information', async () => {
    const generator = new ScheduleGenerator(mockConfig, mockRawData);
    const result = await generator.generate();

    expect(result.version_id).toBeDefined();
    expect(typeof result.version_id).toBe('string');
  });

  it('should use the provided seed for reproducibility', async () => {
    const generator = new ScheduleGenerator(mockConfig, mockRawData);
    const result = await generator.generate();

    expect(result.seed_used).toBe(42);
  });
});
