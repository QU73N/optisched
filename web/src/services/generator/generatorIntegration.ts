/**
 * Integration layer for the 15-phase CSP-based Schedule Generator
 * 
 * This service bridges the new ScheduleGenerator with the existing codebase,
 * providing backward compatibility and a smooth migration path.
 */

import { ScheduleGenerator } from './scheduleGenerator';
import type {
  GeneratorConfig,
  RawData,
  ScheduleOutput,
  GenerationProgress,
} from './types';
import type {
  Teacher,
  Room,
  Section,
  Subject,
  ExistingSchedule,
  GenerationConfig as LegacyGenerationConfig,
  GenerationResult,
} from '../../pages/admin/ScheduleGenerate/types';

/**
 * Convert legacy config to new generator config
 */
function convertLegacyConfig(legacyConfig: LegacyGenerationConfig): GeneratorConfig {
  // Convert break windows to new format with days field
  const breakWindows: { start: string; end: string; days: string[] }[] = [];
  
  if (legacyConfig.breakMode === 'fixed') {
    // For fixed breaks, use the fixedBreak config
    breakWindows.push({
      start: legacyConfig.fixedBreak.start,
      end: legacyConfig.fixedBreak.end,
      days: legacyConfig.days,
    });
  }
  // Variable breaks would need more complex conversion logic

  return {
    mode: legacyConfig.mode as GeneratorConfig['mode'],
    scope: {
      sections: legacyConfig.sectionIds,
      teachers: [],
      rooms: [],
      subjects: [],
      target: !legacyConfig.partialTarget ? 'full' : 'partial',
      protectedElements: [],
    },
    schedule_window: {
      operating_days: legacyConfig.days,
      day_start: legacyConfig.dayStart,
      day_end: legacyConfig.dayEnd,
      session_granularity: legacyConfig.sessionMinutes,
      session_duration: legacyConfig.sessionMinutes,
      break_windows: breakWindows,
    },
    constraints: {
      hard: [],
      soft: [],
      preference: [],
    },
    seed: 42,
    max_attempts: legacyConfig.maxAttempts,
    enable_forward_checking: legacyConfig.enableForwardChecking,
    enable_optimization: legacyConfig.enableOptimization,
    optimization_time_limit: legacyConfig.optimizationTimeLimit,
    optimization_max_iterations: legacyConfig.optimizationMaxIterations,
    optimization_profile: legacyConfig.optimizationProfile,
    optimization_mode: legacyConfig.optimizationMode,
    institutional_options: {
      split_session_support: false,
      compressed_week_support: false,
      staggered_break_support: false,
      shared_teacher_support: false,
      deloaded_teacher_support: false,
      special_room_fallback_policy: legacyConfig.overflowPolicy === 'relax_soft' ? 'relax' : 'fail',
      priority_override_policy: 'flexible',
      overflow_policy: legacyConfig.overflowPolicy,
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
}

/**
 * Convert legacy raw data to new generator raw data
 */
function convertLegacyRawData(
  teachers: Teacher[],
  rooms: Room[],
  sections: Section[],
  subjects: Subject[],
  existing: ExistingSchedule[],
  institutionalPolicies: Record<string, unknown>
): RawData {
  return {
    teachers,
    rooms,
    sections,
    subjects,
    existing,
    institutional_policies: institutionalPolicies,
  };
}

/**
 * Convert new generator output to legacy generation result
 */
function convertToLegacyResult(output: ScheduleOutput): GenerationResult {
  return {
    total: output.placed_sessions_list.length + output.unplaced_sessions_list.length,
    placed: output.placed_sessions_list.length,
    entries: output.placed_sessions_list.map(session => ({
      subjectId: session.subject_id,
      subjectCode: session.subject_code,
      subjectName: session.subject_name,
      sectionId: session.section_id,
      sectionName: session.section_name,
      teacherId: session.teacher_id,
      teacherName: session.teacher_name,
      roomId: session.room_id,
      roomName: session.room_name,
      day: session.day,
      start: session.start_time,
      end: session.end_time,
    })),
    errors: output.unplaced_sessions_list.map(unplaced => 
      `${unplaced.subject_id}:${unplaced.section_id} - ${unplaced.reason}`
    ),
    score: output.hard_constraint_compliance.compliance_percentage,
    highPriorityPlaced: output.placed_sessions_list.length,
    highPriorityTotal: output.placed_sessions_list.length + output.unplaced_sessions_list.length,
    mode: 'full',
    diff: [],
  };
}

/**
 * Run the new 15-phase generator with legacy interface
 */
export async function run15PhaseGenerator(
  teachers: Teacher[],
  rooms: Room[],
  sections: Section[],
  subjects: Subject[],
  existing: ExistingSchedule[],
  config: LegacyGenerationConfig,
  institutionalPolicies: Record<string, unknown>,
  progressCallback?: (progress: GenerationProgress) => void
): Promise<GenerationResult> {
  // Convert legacy data to new format
  const generatorConfig = convertLegacyConfig(config);
  const rawData = convertLegacyRawData(teachers, rooms, sections, subjects, existing, institutionalPolicies);

  // Create generator instance
  const generator = new ScheduleGenerator(generatorConfig, rawData);

  // Set progress callback if provided
  if (progressCallback) {
    generator.setProgressCallback(progressCallback);
  }

  // Run generation
  const output = await generator.generate();

  // Convert output back to legacy format
  return convertToLegacyResult(output);
}

/**
 * Check if the new 15-phase generator should be used
 */
export function shouldUse15PhaseGenerator(config: LegacyGenerationConfig): boolean {
  // Use the new generator when optimization is enabled
  // This provides a gradual migration path
  return config.enableOptimization || config.enableForwardChecking;
}
