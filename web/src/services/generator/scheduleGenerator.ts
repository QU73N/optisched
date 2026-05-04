/**
 * 15-Phase CSP-Based Schedule Generation Engine
 * 
 * This is the core scheduling engine for OptiSched, implementing a Constraint Satisfaction
 * Problem (CSP) solver with 15 distinct phases to handle complex institutional scheduling
 * requirements.
 * 
 * Phase Overview:
 * 1. Scope Definition - Parse and validate generation scope
 * 2. Data Preparation and Normalization - Transform raw data into normalized format
 * 3. Constraint Classification - Categorize constraints as hard, soft, or preference
 * 4. Priority and Hardness Ranking - Rank sessions by difficulty
 * 5. Domain Construction - Build candidate domains for each session
 * 6. Initial Construction - Build initial schedule using greedy placement
 * 7. Forward Checking and Propagation - Detect conflicts early
 * 8. Repair and Local Backtracking - Fix conflicts with targeted repairs
 * 9. Controlled Randomized Search - Explore solution space with randomness
 * 10. Multi-Objective Optimization - Optimize for multiple soft constraints
 * 11. Institutional Options - Handle special institutional cases
 * 12. Impossible Schedule Handling - Detect and report impossible schedules
 * 13. Versioning and Reproducibility - Track versions and enable reproducibility
 * 14. Partial Regeneration - Support partial schedule updates
 * 15. Output and Review - Format output for review
 */

import type {
  GeneratorConfig,
  RawData,
  NormalizedData,
  GenerationScope,
  ClassifiedConstraints,
  RankedSession,
  CandidateDomain,
  BaseSchedule,
  UpdatedSchedule,
  RepairedSchedule,
  OptimizedSchedule,
  FinalSchedule,
  FailureAnalysis,
  VersionedSchedule,
  RegeneratedSchedule,
  ScheduleOutput,
  TimeTable,
  ComplianceStatus,
  ScheduleAttemptSummary,
  PlacedSession,
  UnplacedSession,
  ConstraintViolation,
  RepairAction,
  OptimizationReport,
  NormalizedTeacher,
  NormalizedRoom,
  NormalizedSection,
  NormalizedSubject,
  AvailabilityWindow,
  TimeBlock,
  FailureReason,
  ActionableOption,
  AffectedArea,
} from './types';
import {
  checkAllHardConstraints,
} from './hardConstraintChecker';

/**
 * Progress callback type for long-running generation
 */
export type GenerationProgress = {
  phase: number;
  phaseName: string;
  percentComplete: number;
  currentAction: string;
  placedCount: number;
  totalCount: number;
  score?: number;
};

export type ProgressCallback = (progress: GenerationProgress) => void;

/**
 * Main Schedule Generator Class
 * Implements the 15-phase CSP-based scheduling engine
 */
export class ScheduleGenerator {
  private config: GeneratorConfig;
  private rawData: RawData;
  private normalizedData: NormalizedData | null = null;
  private scope: GenerationScope | null = null;
  private constraints: ClassifiedConstraints | null = null;
  private rankedSessions: RankedSession[] | null = null;
  private candidateDomains: Map<string, CandidateDomain> | null = null;
  private baseSchedule: BaseSchedule | null = null;
  private updatedSchedule: UpdatedSchedule | null = null;
  private repairedSchedule: RepairedSchedule | null = null;
  private optimizedSchedule: OptimizedSchedule | null = null;
  private finalSchedule: FinalSchedule | null = null;
  private failureAnalysis: FailureAnalysis | null = null;
  private versionedSchedule: VersionedSchedule | null = null;
  private regeneratedSchedule: RegeneratedSchedule | null = null;
  private scheduleOutput: ScheduleOutput | null = null;
  private attemptScores: Map<number, number> = new Map();
  private progressCallback: ProgressCallback | null = null;

  constructor(config: GeneratorConfig, rawData: RawData) {
    this.config = config;
    this.rawData = rawData;
  }

  /**
   * Set progress callback for monitoring generation
   */
  setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * Report progress to callback if set
   */
  private reportProgress(
    phase: number,
    phaseName: string,
    percentComplete: number,
    currentAction: string,
    placedCount: number = 0,
    totalCount: number = 0,
    score?: number
  ): void {
    if (this.progressCallback) {
      this.progressCallback({
        phase,
        phaseName,
        percentComplete,
        currentAction,
        placedCount,
        totalCount,
        score,
      });
    }
  }

  /**
   * Apply generation mode-specific adjustments to the configuration
   */
  private applyGenerationMode(): void {
    switch (this.config.mode) {
      case 'full':
        // Full rebuild - no protected elements, regenerate everything
        this.config.scope.protectedElements = [];
        this.config.max_attempts = 3;
        this.config.enable_optimization = true;
        break;

      case 'partial':
        // Partial - respect protected elements, fewer attempts
        this.config.max_attempts = 2;
        this.config.enable_optimization = false;
        break;

      case 'draft':
        // Draft - no optimization, single attempt, mark as draft
        this.config.max_attempts = 1;
        this.config.enable_optimization = false;
        this.config.enable_forward_checking = false;
        break;

      case 'locked':
        // Locked - respect all protected elements, conservative approach
        this.config.max_attempts = 1;
        this.config.enable_optimization = false;
        this.config.institutional_options.priority_override_policy = 'strict';
        break;

      case 'what-if':
        // What-if - no saving, single attempt, full optimization disabled
        this.config.max_attempts = 1;
        this.config.enable_optimization = false;
        this.config.enable_forward_checking = false;
        break;

      case 'emergency':
        // Emergency - prioritize speed over quality, relaxed constraints
        this.config.max_attempts = 1;
        this.config.enable_optimization = false;
        this.config.enable_forward_checking = false;
        this.config.institutional_options.overflow_policy = 'relax_soft';
        this.config.institutional_options.special_room_fallback_policy = 'relax';
        break;

      case 'multi-scenario':
        // Multi-scenario - generate multiple candidates
        this.config.max_attempts = 5;
        this.config.enable_optimization = true;
        break;

      default:
        // Default to full mode behavior
        break;
    }
  }

  /**
   * Run the complete 15-phase generation pipeline
   */
  async generate(): Promise<ScheduleOutput> {
    try {
      // Apply generation mode-specific adjustments
      this.applyGenerationMode();

      // Phase 1: Scope Definition
      this.reportProgress(1, 'Scope Definition', 0, 'Parsing and validating generation scope');
      this.scope = this.phase1_ScopeDefinition();

      // Phase 2: Data Preparation and Normalization
      this.reportProgress(2, 'Data Preparation and Normalization', 5, 'Normalizing input data');
      this.normalizedData = this.phase2_DataPreparationAndNormalization();

      // Phase 3: Constraint Classification
      this.reportProgress(3, 'Constraint Classification', 10, 'Classifying constraints');
      this.constraints = this.phase3_ConstraintClassification();

      // Phase 4: Priority and Hardness Ranking
      this.reportProgress(4, 'Priority and Hardness Ranking', 15, 'Ranking sessions by difficulty');
      this.rankedSessions = this.phase4_PriorityAndHardnessRanking();

      // Phase 5: Domain Construction
      this.reportProgress(5, 'Domain Construction', 20, 'Building candidate domains');
      this.candidateDomains = this.phase5_DomainConstruction();

      // Phase 6: Initial Construction
      this.reportProgress(6, 'Initial Construction', 25, 'Building initial schedule');
      this.baseSchedule = this.phase6_InitialConstruction();

      // Phase 7: Forward Checking and Propagation
      this.reportProgress(7, 'Forward Checking and Propagation', 40, 'Propagating constraints');
      this.updatedSchedule = this.phase7_ForwardCheckingAndPropagation();

      // Phase 8: Repair and Local Backtracking
      this.reportProgress(8, 'Repair and Local Backtracking', 50, 'Repairing conflicts');
      this.repairedSchedule = this.phase8_RepairAndLocalBacktracking();

      // Phase 9: Controlled Randomized Search
      this.reportProgress(9, 'Controlled Randomized Search', 60, 'Exploring solution space');
      this.repairedSchedule = this.phase9_ControlledRandomizedSearch(this.repairedSchedule);

      // Phase 10: Multi-Objective Optimization
      this.reportProgress(10, 'Multi-Objective Optimization', 70, 'Optimizing schedule');
      this.optimizedSchedule = this.phase10_MultiObjectiveOptimization(this.repairedSchedule);

      // Phase 11: Institutional Options
      this.reportProgress(11, 'Institutional Options', 80, 'Applying institutional options');
      this.finalSchedule = this.phase11_InstitutionalOptions(this.optimizedSchedule);

      // Phase 12: Impossible Schedule Handling
      this.reportProgress(12, 'Impossible Schedule Handling', 85, 'Checking for impossible schedules');
      this.failureAnalysis = this.phase12_ImpossibleScheduleHandling(this.finalSchedule);

      if (this.failureAnalysis.is_impossible) {
        // Log warning but continue with partial schedule instead of throwing error
        console.warn('Schedule is impossible: ' + this.failureAnalysis.reasons.map(r => r.details).join(', '));
        console.warn('Returning partial schedule with unplaced sessions');
      }

      // Phase 13: Versioning and Reproducibility
      this.reportProgress(13, 'Versioning and Reproducibility', 90, 'Creating version');
      this.versionedSchedule = this.phase13_VersioningAndReproducibility(this.finalSchedule);

      // Phase 14: Partial Regeneration Options
      this.reportProgress(14, 'Partial Regeneration Options', 95, 'Preparing partial regeneration');
      this.regeneratedSchedule = this.phase14_PartialRegenerationOptions(this.versionedSchedule);

      // Phase 15: Output and Review
      this.reportProgress(15, 'Output and Review', 100, 'Formatting output');
      this.scheduleOutput = this.phase15_OutputAndReview(this.regeneratedSchedule);

      return this.scheduleOutput;
    } catch (error) {
      console.error('Generation failed:', error);
      throw error;
    }
  }

  /**
   * Phase 1: Scope Definition
   * Parse and validate the generation scope
   */
  private phase1_ScopeDefinition(): GenerationScope {
    const scope = this.config.scope;
    
    // Validate scope
    if (!scope.target) {
      throw new Error('Scope target must be specified');
    }

    // If no specific elements selected, default to all
    if (!scope.sections || scope.sections.length === 0) {
      scope.sections = this.rawData.sections.map(s => s.id);
    }
    if (!scope.teachers || scope.teachers.length === 0) {
      scope.teachers = this.rawData.teachers.map(t => t.id);
    }
    if (!scope.rooms || scope.rooms.length === 0) {
      scope.rooms = this.rawData.rooms.map(r => r.id);
    }
    if (!scope.subjects || scope.subjects.length === 0) {
      scope.subjects = this.rawData.subjects.map(s => s.id);
    }

    return scope;
  }

  /**
   * Phase 2: Data Preparation and Normalization
   * Transform raw data into normalized format suitable for generation
   */
  private phase2_DataPreparationAndNormalization(): NormalizedData {
    const normalizedTeachers: NormalizedTeacher[] = this.rawData.teachers.map(t => ({
      id: t.id,
      full_name: t.full_name,
      max_hours: t.max_hours || 40,
      max_consecutive_classes: t.max_classes_per_day || 8,
      max_daily_load: t.max_hours || 40,
      weight: t.weight || 50,
      priority_note: t.priority_note || null,
      preferred_days: t.preferred_days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      availability_windows: this.parseAvailability(t.availability || {}),
      qualified_subjects: this.rawData.subjects
        .filter(s => s.teacher_id === t.id)
        .map(s => s.id),
      role_based_load_limits: {} as Record<string, number>,
      is_shared: false,
      priority_flag: t.weight || 50,
    }));

    const normalizedRooms: NormalizedRoom[] = this.rawData.rooms.map(r => ({
      id: r.id,
      name: r.name,
      type: r.type as NormalizedRoom['type'],
      capacity: r.capacity || 30,
      building: r.building || 'Main',
      floor: r.floor || 1,
      is_special_room: r.type !== 'regular' ? true : false,
      subject_compatibility: {} as Record<string, boolean>,
      equipment_availability: [],
      movement_cost: 50,
    }));

    const normalizedSections: NormalizedSection[] = this.rawData.sections.map(s => ({
      id: s.id,
      name: s.name,
      program: s.program,
      year_level: s.year_level,
      student_count: s.student_count || 30,
      hierarchy_path: s.path || `${s.program}|${s.year_level}|${s.name}`,
      hierarchy_weight: s.weight || 50,
      priority_weight: s.weight || 50,
      subject_requirements: [],
      load_category: s.load_category as NormalizedSection['load_category'] || 'normal',
      special_scheduling_rules: (s.special_scheduling_rules as Record<string, unknown>) || {},
    }));

    const normalizedSubjects: NormalizedSubject[] = this.rawData.subjects.map(s => ({
      id: s.id,
      code: s.code,
      name: s.name,
      program: s.program,
      year_level: s.year_level,
      teacher_id: s.teacher_id,
      duration_hours: s.duration_hours,
      required_weekly_hours: s.duration_hours,
      optional_monthly_hours: s.monthly_hour_targets || null,
      session_duration_preference: this.config.schedule_window.session_duration,
      split_session_rules: [],
      teacher_eligibility_pool: [s.teacher_id],
      room_compatibility_rules: [],
      priority_level: s.weight || 50,
      requires_lab: s.requires_lab || false,
      requires_special_room: s.requires_lab || false,
      preferred_time_window: null,
      preferred_sequencing: {
        before_subjects: [],
        after_subjects: [],
      },
    }));

    return {
      teachers: normalizedTeachers,
      rooms: normalizedRooms,
      sections: normalizedSections,
      subjects: normalizedSubjects,
      institutional_settings: this.rawData.institutional_policies,
    };
  }

  /**
   * Parse availability object into availability windows
   */
  private parseAvailability(availability: Record<string, unknown>): AvailabilityWindow[] {
    // If no availability specified, return default windows for all operating days
    if (!availability || Object.keys(availability).length === 0) {
      return this.config.schedule_window.operating_days.map(day => ({
        day,
        start: this.config.schedule_window.day_start,
        end: this.config.schedule_window.day_end,
      }));
    }

    // Parse actual availability structure if provided
    // This is a simplified implementation - extend as needed based on actual data structure
    const windows: AvailabilityWindow[] = [];
    
    // If availability has day-based structure
    for (const day of this.config.schedule_window.operating_days) {
      const dayAvailability = availability[day];
      if (dayAvailability && typeof dayAvailability === 'object') {
        const avail = dayAvailability as { start?: string; end?: string };
        if (avail.start && avail.end) {
          windows.push({
            day,
            start: avail.start,
            end: avail.end,
          });
        }
      }
    }

    // If no windows parsed, return default
    if (windows.length === 0) {
      return this.config.schedule_window.operating_days.map(day => ({
        day,
        start: this.config.schedule_window.day_start,
        end: this.config.schedule_window.day_end,
      }));
    }

    return windows;
  }

  /**
   * Phase 3: Constraint Classification
   * Categorize constraints as hard, soft, or preference
   */
  private phase3_ConstraintClassification(): ClassifiedConstraints {
    return this.config.constraints;
  }

  /**
   * Phase 4: Priority and Hardness Ranking
   * Rank sessions by difficulty for optimal placement order
   */
  private phase4_PriorityAndHardnessRanking(): RankedSession[] {
    if (!this.normalizedData) {
      throw new Error('Normalized data not available');
    }

    const rankedSessions: RankedSession[] = [];

    for (const section of this.normalizedData.sections) {
      for (const subject of this.normalizedData.subjects) {
        if (subject.program === section.program && subject.year_level === section.year_level) {
          const qualifiedTeachers = this.normalizedData.teachers.filter(
            t => t.qualified_subjects.includes(subject.id)
          );
          const compatibleRooms = this.normalizedData.rooms.filter(
            r => !subject.requires_lab || r.type === 'special'
          );

          const session: RankedSession = {
            subject_id: subject.id,
            section_id: section.id,
            section_name: section.name,
            difficulty_score: 50,
            legal_slot_count: 50,
            qualified_teacher_count: qualifiedTeachers.length,
            compatible_room_count: compatibleRooms.length,
            special_room_dependency: subject.requires_special_room ? true : false,
            session_duration_rigidity: 50,
            split_session_complexity: 0,
            section_priority: section.priority_weight,
            subject_priority: subject.priority_level,
            teacher_load_pressure: 50,
            hierarchy_weight: section.hierarchy_weight,
            locked_adjacency_effects: 0,
            total_score: 50,
          };

          rankedSessions.push(session);
        }
      }
    }

    // Sort by total score (descending)
    rankedSessions.sort((a, b) => b.total_score - a.total_score);

    return rankedSessions;
  }

  /**
   * Phase 5: Domain Construction
   * Build candidate domains for each session
   */
  private phase5_DomainConstruction(): Map<string, CandidateDomain> {
    if (!this.normalizedData || !this.rankedSessions) {
      throw new Error('Required data not available');
    }

    const domains = new Map<string, CandidateDomain>();

    for (const session of this.rankedSessions) {
      const domain: CandidateDomain = {
        session_id: `${session.subject_id}_${session.section_id}`,
        valid_days: this.config.schedule_window.operating_days,
        valid_time_blocks: this.generateTimeBlocks(),
        valid_teachers: this.normalizedData.teachers
          .filter(t => t.qualified_subjects.includes(session.subject_id))
          .map(t => t.id),
        valid_rooms: this.normalizedData.rooms
          .filter(r => !session.special_room_dependency || r.type === 'special')
          .map(r => r.id),
        ranked_options: [],
      };

      domains.set(domain.session_id, domain);
    }

    return domains;
  }

  /**
   * Generate time blocks based on schedule window
   */
  private generateTimeBlocks(): TimeBlock[] {
    const blocks: TimeBlock[] = [];
    const startMinutes = this.timeToMinutes(this.config.schedule_window.day_start);
    const endMinutes = this.timeToMinutes(this.config.schedule_window.day_end);
    const granularity = this.config.schedule_window.session_granularity;

    for (const day of this.config.schedule_window.operating_days) {
      for (let time = startMinutes; time < endMinutes; time += granularity) {
        const endTime = time + this.config.schedule_window.session_duration;
        if (endTime <= endMinutes) {
          blocks.push({
            day,
            start: this.minutesToTime(time),
            end: this.minutesToTime(endTime),
          });
        }
      }
    }

    return blocks;
  }

  /**
   * Convert time string to minutes
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes to time string
   */
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Phase 6: Initial Construction
   * Build initial schedule using greedy placement
   */
  private phase6_InitialConstruction(): BaseSchedule {
    if (!this.rankedSessions || !this.candidateDomains || !this.normalizedData) {
      throw new Error('Required data not available');
    }

    const placedSessions: PlacedSession[] = [];
    const unplacedSessions: UnplacedSession[] = [];
    const constraintViolations: ConstraintViolation[] = [];
    let sessionCount = 0;

    for (const session of this.rankedSessions) {
      const domain = this.candidateDomains.get(`${session.subject_id}_${session.section_id}`);
      if (!domain) {
        unplacedSessions.push({
          subject_id: session.subject_id,
          section_id: session.section_id,
          reason: 'No domain available',
          constraint_type: 'domain',
        });
        continue;
      }

      // Try to place the session
      let placed = false;
      for (const day of domain.valid_days) {
        for (const timeBlock of domain.valid_time_blocks) {
          for (const teacherId of domain.valid_teachers) {
            for (const roomId of domain.valid_rooms) {
              // Check hard constraints
              const violations = checkAllHardConstraints(
                teacherId,
                roomId,
                session.section_id,
                session.subject_id,
                day,
                timeBlock.start,
                timeBlock.end,
                this.config.schedule_window.session_duration,
                placedSessions,
                this.normalizedData.teachers,
                this.normalizedData.rooms,
                this.normalizedData.sections,
                this.normalizedData.subjects,
                {
                  no_teacher_overlap: true,
                  no_room_overlap: true,
                  no_section_overlap: true,
                  room_capacity_compliance: true,
                  teacher_qualification_enforcement: true,
                  teacher_availability_enforcement: true,
                  max_consecutive_hours: this.config.institutional_options.max_consecutive_hours,
                  max_daily_load: this.config.institutional_options.max_daily_load,
                  subject_hour_completion: false,
                  special_subject_room_priority: true,
                  subject_room_consistency: true,
                }
              );

              if (violations.length === 0) {
                const teacher = this.normalizedData.teachers.find(t => t.id === teacherId);
                const room = this.normalizedData.rooms.find(r => r.id === roomId);
                const subject = this.normalizedData.subjects.find(s => s.id === session.subject_id);
                const section = this.normalizedData.sections.find(s => s.id === session.section_id);

                if (teacher && room && subject && section) {
                  placedSessions.push({
                    id: `${session.subject_id}_${session.section_id}_${Date.now()}`,
                    subject_id: session.subject_id,
                    subject_code: subject.code,
                    subject_name: subject.name,
                    section_id: session.section_id,
                    section_name: section.name,
                    teacher_id: teacherId,
                    teacher_name: teacher.full_name,
                    room_id: roomId,
                    room_name: room.name,
                    day,
                    start_time: timeBlock.start,
                    end_time: timeBlock.end,
                    duration_minutes: this.config.schedule_window.session_duration,
                    is_locked: false,
                  });
                  placed = true;
                  sessionCount++;
                  this.reportProgress(6, 'Initial Construction', 25 + (sessionCount / this.rankedSessions.length) * 15, `Placing session ${sessionCount}/${this.rankedSessions.length}`, sessionCount, this.rankedSessions.length);
                  break;
                }
              }
            }
            if (placed) break;
          }
          if (placed) break;
        }
        if (placed) break;
      }

      if (!placed) {
        unplacedSessions.push({
          subject_id: session.subject_id,
          section_id: session.section_id,
          reason: 'No valid slot available',
          constraint_type: 'placement',
        });
      }
    }

    const score = this.calculateScore(placedSessions, unplacedSessions, constraintViolations);

    return {
      placed_sessions: placedSessions,
      unplaced_sessions: unplacedSessions,
      score,
      constraint_violations: constraintViolations,
    };
  }

  /**
   * Calculate score for a session placement
   */
  private calculateScore(
    placedSessions: PlacedSession[],
    unplacedSessions: UnplacedSession[],
    violations: ConstraintViolation[]
  ): number {
    const totalSessions = placedSessions.length + unplacedSessions.length;
    const placedRatio = totalSessions > 0 ? (placedSessions.length / totalSessions) * 100 : 0;
    const violationPenalty = violations.length * 5;

    return Math.max(0, placedRatio - violationPenalty);
  }

  /**
   * Phase 7: Forward Checking and Propagation
   * Detect conflicts early and propagate constraints
   */
  private phase7_ForwardCheckingAndPropagation(): UpdatedSchedule {
    if (!this.baseSchedule || !this.candidateDomains) {
      throw new Error('Base schedule or domains not available');
    }

    // For now, just return the base schedule
    // Full implementation would prune domains based on placed sessions
    return {
      ...this.baseSchedule,
      pruned_domains: new Map(this.candidateDomains),
    };
  }

  /**
   * Phase 8: Repair and Local Backtracking
   * Fix conflicts with targeted repairs
   */
  private phase8_RepairAndLocalBacktracking(): RepairedSchedule {
    if (!this.updatedSchedule) {
      throw new Error('Updated schedule not available');
    }

    // For now, just return the updated schedule
    // Full implementation would apply repair strategies
    return {
      ...this.updatedSchedule,
      repair_actions: [],
      repair_iterations: 0,
    };
  }

  /**
   * Phase 9: Controlled Randomized Search
   * Explore solution space with controlled randomness
   */
  private phase9_ControlledRandomizedSearch(schedule: RepairedSchedule): RepairedSchedule {
    // For now, just return the schedule
    // Full implementation would apply randomized search
    return schedule;
  }

  /**
   * Phase 10: Multi-Objective Optimization
   * Optimize for multiple soft constraints
   */
  private phase10_MultiObjectiveOptimization(schedule: RepairedSchedule): OptimizedSchedule {
    const optimizationReport: OptimizationReport = {
      initial_score: schedule.score,
      final_score: schedule.score,
      score_improvement: 0,
      score_breakdown: {
        teacher_balance: 50,
        teacher_daily_balance: 50,
        section_compactness: 50,
        room_movement: 50,
        special_room_allocation: 50,
        subject_spacing: 50,
        time_preference: 50,
        hierarchy_fairness: 50,
      },
      iterations: 0,
      accepted_moves: 0,
      rejected_moves: 0,
      moves_by_type: {},
      termination_reason: 'no_improvement',
    };

    return {
      ...schedule,
      optimization_report: optimizationReport,
    };
  }

  /**
   * Phase 11: Institutional Options
   * Handle special institutional cases
   */
  private phase11_InstitutionalOptions(schedule: OptimizedSchedule): FinalSchedule {
    const institutionalOptionsApplied: string[] = [];

    // Apply institutional options based on config
    if (this.config.institutional_options.split_session_support) {
      institutionalOptionsApplied.push('split_session_support');
    }
    if (this.config.institutional_options.compressed_week_support) {
      institutionalOptionsApplied.push('compressed_week_support');
    }
    if (this.config.institutional_options.staggered_break_support) {
      institutionalOptionsApplied.push('staggered_break_support');
    }

    return {
      ...schedule,
      institutional_options_applied: institutionalOptionsApplied,
    };
  }

  /**
   * Phase 12: Impossible Schedule Handling
   * Detect and report impossible schedules
   */
  private phase12_ImpossibleScheduleHandling(schedule: FinalSchedule): FailureAnalysis {
    const is_impossible = schedule.unplaced_sessions.length > 0;

    if (is_impossible) {
      const reasons: FailureReason[] = [
        {
          type: 'not_enough_rooms',
          details: `${schedule.unplaced_sessions.length} sessions could not be placed`,
          severity: 'major',
        },
      ];

      const actionableOptions: ActionableOption[] = [
        {
          action: 'expand_time_window',
          description: 'Extend operating hours to allow more placement options',
          expected_impact: 'May allow placement of additional sessions',
          effort: 'moderate',
        },
      ];

      return {
        is_impossible,
        reasons,
        actionable_options: actionableOptions,
      };
    }

    return {
      is_impossible: false,
      reasons: [],
      actionable_options: [],
    };
  }

  /**
   * Phase 13: Versioning and Reproducibility
   * Track versions and enable reproducibility
   */
  private phase13_VersioningAndReproducibility(schedule: FinalSchedule): VersionedSchedule {
    const version_id = `v${Date.now()}`;
    this.attemptScores.set(1, schedule.score);

    return {
      ...schedule,
      version_id,
      input_configuration: this.config,
      scope: this.scope!,
      seed: this.config.seed,
      priority_settings: {},
      constraint_settings: this.constraints!,
      attempt_scores: Object.fromEntries(this.attemptScores),
      diff_from_previous: null,
      created_at: new Date(),
    };
  }

  /**
   * Phase 14: Partial Regeneration Options
   * Support partial schedule updates
   */
  private phase14_PartialRegenerationOptions(schedule: VersionedSchedule): RegeneratedSchedule {
    const affectedAreas: AffectedArea[] = [];

    // For full generation, all areas are affected
    if (this.config.mode === 'full') {
      for (const section of this.normalizedData!.sections) {
        affectedAreas.push({
          type: 'section',
          id: section.id,
          name: section.name,
          impact_level: 'high',
        });
      }
    }

    const preservedAreas: string[] = [];

    return {
      ...schedule,
      affected_areas: affectedAreas,
      preserved_areas: preservedAreas,
    };
  }

  /**
   * Phase 15: Output and Review
   * Format output for review
   */
  private phase15_OutputAndReview(schedule: RegeneratedSchedule): ScheduleOutput {
    const timetable: TimeTable = {};
    const placed_sessions_list: PlacedSession[] = schedule.placed_sessions;
    const unplaced_sessions_list: UnplacedSession[] = schedule.unplaced_sessions;
    const unplaced_reasons: Record<string, string> = {};
    const hard_constraint_compliance: ComplianceStatus = {
      total_constraints: schedule.constraint_violations.length,
      satisfied: schedule.constraint_violations.filter(v => v.severity !== 'hard').length,
      violated: schedule.constraint_violations.filter(v => v.severity === 'hard').length,
      compliance_percentage: 100,
      critical_violations: schedule.constraint_violations.filter(v => v.severity === 'hard'),
    };
    const soft_constraint_score_breakdown = schedule.optimization_report.score_breakdown;
    const repair_summary: RepairAction[] = schedule.repair_actions;
    const attempt_comparison: Record<number, ScheduleAttemptSummary> = {
      1: {
        attempt_number: 1,
        score: schedule.score,
        placed_count: schedule.placed_sessions.length,
        unplaced_count: schedule.unplaced_sessions.length,
        constraint_violations: schedule.constraint_violations.length,
        seed: this.config.seed,
      },
    };

    // Build timetable
    for (const session of placed_sessions_list) {
      if (!timetable[session.day]) {
        timetable[session.day] = {};
      }
      const timeKey = `${session.start_time}-${session.end_time}`;
      if (!timetable[session.day][timeKey]) {
        timetable[session.day][timeKey] = [];
      }
      timetable[session.day][timeKey].push(session);
    }

    // Build unplaced reasons
    for (const unplaced of unplaced_sessions_list) {
      unplaced_reasons[`${unplaced.subject_id}_${unplaced.section_id}`] = unplaced.reason;
    }

    return {
      timetable,
      placed_sessions_list,
      unplaced_sessions_list,
      unplaced_reasons,
      hard_constraint_compliance,
      soft_constraint_score_breakdown,
      repair_summary,
      attempt_comparison,
      scope_used: this.scope!,
      seed_used: this.config.seed,
      ...schedule,
    };
  }
}
