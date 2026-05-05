/**
 * Type definitions for the 15-phase CSP-based schedule generation engine
 */

import type { Teacher, Room, Section, Subject, ExistingSchedule } from '../../pages/admin/ScheduleGenerate/types';

/**
 * Generation modes supported by the engine
 */
export type GenerationMode =
  | 'full'      // Rebuild the selected scope from scratch
  | 'partial'   // Recalculate only affected sections/teachers/rooms/subjects
  | 'draft'     // Create temporary schedule for review (no overwrite)
  | 'locked'    // Regenerate only in allowed slots while keeping approved/protected sessions fixed
  | 'what-if'   // Test a possible scenario without saving
  | 'emergency' // React to broken schedule (room loss, teacher absence, scope change)
  | 'multi-scenario'; // Generate several candidate schedules and compare

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
 * Scope definition for generation
 */
export interface GenerationScope {
  sections?: string[];      // Selected section IDs (empty = all)
  teachers?: string[];      // Selected teacher IDs (empty = all)
  rooms?: string[];         // Selected room IDs (empty = all)
  subjects?: string[];      // Selected subject IDs (empty = all)
  target: 'full' | 'partial' | 'draft' | 'replacement' | 'repair';
  protectedElements?: ProtectedElement[]; // Published schedules, locked sessions, approved versions to respect
}

/**
 * Protected elements that should not be modified during generation
 */
export interface ProtectedElement {
  type: 'session' | 'version' | 'schedule';
  id: string;
  reason: string;
}

/**
 * Schedule window configuration
 */
export interface ScheduleWindow {
  operating_days: string[];          // e.g., ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  day_start: string;                  // e.g., '08:00'
  day_end: string;                    // e.g., '17:00'
  session_granularity: number;       // Minutes per session slot (e.g., 30, 60, 90)
  session_duration: number;           // Default session duration in minutes
  break_windows: BreakWindow[];
}

/**
 * Break window configuration
 */
export interface BreakWindow {
  start: string;  // e.g., '12:00'
  end: string;    // e.g., '13:00'
  days: string[]; // Days this break applies to
}

/**
 * Normalized teacher data for generation
 */
export interface NormalizedTeacher {
  id: string;
  full_name: string;
  max_hours: number;
  max_consecutive_classes: number;
  max_daily_load: number;
  weight: number;
  priority_note: string | null;
  preferred_days: string[];
  availability_windows: AvailabilityWindow[];
  qualified_subjects: string[];      // Subject IDs this teacher can teach
  role_based_load_limits: Record<string, number>; // Per-role load limits
  is_shared: boolean;                // Teaches across multiple programs
  priority_flag: number;             // 0-100 priority for placement
}

/**
 * Teacher availability window
 */
export interface AvailabilityWindow {
  day: string;
  start: string;
  end: string;
}

/**
 * Normalized room data for generation
 */
export interface NormalizedRoom {
  id: string;
  name: string;
  type: 'regular' | 'special' | 'lab' | 'clinic' | 'studio' | 'computer' | 'performance';
  capacity: number;
  building: string;
  floor: number;
  is_special_room: boolean;
  subject_compatibility: Record<string, boolean>; // Subject IDs this room supports
  equipment_availability: string[];   // Equipment IDs available in this room
  movement_cost: number;              // Cost of moving to/from this room (0-100)
}

/**
 * Normalized section data for generation
 */
export interface NormalizedSection {
  id: string;
  name: string;
  program: string | null;
  year_level: number | null;
  student_count: number;
  hierarchy_path: string;             // e.g., 'BSIT|1|Section1'
  hierarchy_weight: number;           // 0-100 weight for hierarchy-based fairness
  priority_weight: number;            // 0-100 priority for this section
  subject_requirements: SubjectRequirement[];
  load_category: 'normal' | 'heavy' | 'light';
  special_scheduling_rules: Record<string, unknown>;
}

/**
 * Subject requirement for a section
 */
export interface SubjectRequirement {
  subject_id: string;
  required_weekly_hours: number;
  optional_monthly_hours: number | null;
  session_duration_preference: number;
  split_session_rules: SplitSessionRule[];
  teacher_eligibility_pool: string[]; // Teacher IDs who can teach this
  room_compatibility_rules: string[]; // Room IDs compatible with this subject
  priority_level: number;             // 0-100 priority
  requires_special_room: boolean;
}

/**
 * Split session rule for multi-part subjects
 */
export interface SplitSessionRule {
  parts: number;                      // e.g., 2 for two-part subject
  min_gap_minutes: number;            // Minimum gap between parts
  max_gap_minutes: number;            // Maximum gap between parts
  same_room_required: boolean;
  same_teacher_required: boolean;
}

/**
 * Normalized subject data for generation
 */
export interface NormalizedSubject {
  id: string;
  code: string;
  name: string;
  program: string | null;
  year_level: number | null;
  teacher_id: string | null;
  duration_hours: number | null;
  required_weekly_hours: number | null;
  optional_monthly_hours: number | null;
  session_duration_preference: number;
  split_session_rules: SplitSessionRule[];
  teacher_eligibility_pool: (string | null)[];
  room_compatibility_rules: (string | null)[];
  priority_level: number;
  type: 'common' | 'special' | null;
  preferred_time_window: 'early' | 'mid' | 'late' | null;
  preferred_sequencing: {
    before_subjects: string[];
    after_subjects: string[];
  };
}

/**
 * Classified constraints
 */
export interface ClassifiedConstraints {
  hard: HardConstraint[];
  soft: SoftConstraint[];
  preference: PreferenceConstraint[];
}

/**
 * Hard constraint (absolute, never violated)
 */
export interface HardConstraint {
  type: 'no_teacher_overlap' | 'no_room_overlap' | 'no_section_overlap' 
    | 'room_capacity' | 'teacher_qualification' | 'teacher_availability'
    | 'max_consecutive_hours' | 'max_daily_load' | 'subject_hour_completion'
    | 'special_room_priority' | 'break_enforcement' | 'schedule_lock_protection'
    | 'fixed_time_enforcement' | 'locked_schedule_enforcement' | 'hierarchy_integrity'
    | 'active_version_integrity';
  severity: 'absolute';
  checkFunction: string;
}

/**
 * Soft constraint (flexible, optimization goal)
 */
export interface SoftConstraint {
  type: 'balanced_load' | 'reduced_idle_gaps' | 'compact_schedule'
    | 'room_movement_minimization' | 'time_of_day_preference' | 'room_utilization'
    | 'schedule_compactness' | 'fairness_between_teachers' | 'priority_weighting'
    | 'preferred_sequencing' | 'soft_load_smoothing' | 'late_day_minimization'
    | 'early_day_minimization' | 'even_distribution_hierarchy';
  weight: number;  // 0-100 importance
  checkFunction: string;
}

/**
 * Preference constraint (intermediate, stronger than soft but not hard)
 */
export interface PreferenceConstraint {
  type: 'preferred_room' | 'preferred_time_window' | 'preferred_day'
    | 'preferred_sequencing' | 'preferred_special_room';
  subject_id?: string;
  teacher_id?: string;
  room_id?: string;
  value: unknown;
  strength: number;  // 0-100
}

/**
 * Ranked session (sorted by difficulty)
 */
export interface RankedSession {
  subject_id: string;
  section_id: string;
  section_name: string;
  difficulty_score: number;
  legal_slot_count: number;
  qualified_teacher_count: number;
  compatible_room_count: number;
  special_room_dependency: boolean;
  session_duration_rigidity: number;
  split_session_complexity: number;
  section_priority: number;
  subject_priority: number;
  teacher_load_pressure: number;
  hierarchy_weight: number;
  locked_adjacency_effects: number;
  total_score: number;
}

/**
 * Candidate domain for a session
 */
export interface CandidateDomain {
  session_id: string;
  valid_days: string[];
  valid_time_blocks: TimeBlock[];
  valid_teachers: string[];
  valid_rooms: string[];
  ranked_options: CandidateOption[];
}

/**
 * Time block
 */
export interface TimeBlock {
  start: string;
  end: string;
  day: string;
}

/**
 * Ranked candidate option
 */
export interface CandidateOption {
  day: string;
  time_block: TimeBlock;
  teacher_id: string;
  room_id: string;
  score: number;
  score_breakdown: {
    time_window_quality: number;
    disruption_level: number;
    special_room_fit: number;
    future_flexibility: number;
    movement_cost: number;
    weekly_load_balance: number;
  };
}

/**
 * Base schedule after initial construction
 */
export interface BaseSchedule {
  placed_sessions: PlacedSession[];
  unplaced_sessions: UnplacedSession[];
  score: number;
  constraint_violations: ConstraintViolation[];
}

/**
 * Placed session
 */
export interface PlacedSession {
  id: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  section_id: string;
  section_name: string;
  teacher_id: string;
  teacher_name: string;
  room_id: string;
  room_name: string;
  day: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  is_locked: boolean;
}

/**
 * Unplaced session with reason
 */
export interface UnplacedSession {
  subject_id: string;
  section_id: string;
  reason: string;
  constraint_type: string;
}

/**
 * Constraint violation
 */
export interface ConstraintViolation {
  type: string;
  severity: 'hard' | 'soft' | 'preference';
  session_id: string;
  description: string;
}

/**
 * Updated schedule after forward checking
 */
export interface UpdatedSchedule extends BaseSchedule {
  pruned_domains: Map<string, CandidateDomain>; // Updated domains after propagation
}

/**
 * Repaired schedule after local backtracking
 */
export interface RepairedSchedule extends UpdatedSchedule {
  repair_actions: RepairAction[];
  repair_iterations: number;
}

/**
 * Repair action taken
 */
export interface RepairAction {
  type: 'single_session_move' | 'teacher_swap' | 'room_swap' | 'time_shift' 
    | 'cluster_relocation' | 'chain_relocation';
  affected_sessions: string[];
  reason: string;
}

/**
 * Optimized schedule after multi-objective optimization
 */
export interface OptimizedSchedule extends RepairedSchedule {
  optimization_report: OptimizationReport;
}

/**
 * Optimization report
 */
export interface OptimizationReport {
  initial_score: number;
  final_score: number;
  score_improvement: number;
  score_breakdown: {
    teacher_balance: number;
    teacher_daily_balance: number;
    section_compactness: number;
    room_movement: number;
    special_room_allocation: number;
    subject_spacing: number;
    time_preference: number;
    hierarchy_fairness: number;
  };
  iterations: number;
  accepted_moves: number;
  rejected_moves: number;
  moves_by_type: Record<string, number>;
  termination_reason: 'no_improvement' | 'score_stabilized' | 'time_limit' | 'max_iterations';
}

/**
 * Final schedule with institutional options applied
 */
export interface FinalSchedule extends OptimizedSchedule {
  institutional_options_applied: string[];
}

/**
 * Failure analysis for impossible schedules
 */
export interface FailureAnalysis {
  is_impossible: boolean;
  reasons: FailureReason[];
  actionable_options: ActionableOption[];
}

/**
 * Reason for failure
 */
export interface FailureReason {
  type: 'not_enough_rooms' | 'not_enough_teachers' | 'too_many_hours'
    | 'breaks_too_restrictive' | 'special_room_shortage' | 'teacher_load_too_high'
    | 'section_demand_too_dense' | 'conflicting_hierarchy_weights';
  details: string;
  severity: 'critical' | 'major' | 'minor';
}

/**
 * Actionable option to fix failure
 */
export interface ActionableOption {
  action: string;
  description: string;
  expected_impact: string;
  effort: 'quick' | 'moderate' | 'significant';
}

/**
 * Versioned schedule for reproducibility
 */
export interface VersionedSchedule extends FinalSchedule {
  version_id: string;
  input_configuration: GeneratorConfig;
  scope: GenerationScope;
  seed: number;
  priority_settings: Record<string, unknown>;
  constraint_settings: ClassifiedConstraints;
  attempt_scores: Record<number, number>;
  diff_from_previous: ScheduleDiff | null;
  created_at: Date;
}

/**
 * Schedule diff between versions
 */
export interface ScheduleDiff {
  added_sessions: PlacedSession[];
  removed_sessions: PlacedSession[];
  modified_sessions: Array<{ old: PlacedSession; new: PlacedSession }>;
}

/**
 * Partial regeneration result
 */
export interface RegeneratedSchedule extends VersionedSchedule {
  affected_areas: AffectedArea[];
  preserved_areas: string[];
}

/**
 * Affected area in partial regeneration
 */
export interface AffectedArea {
  type: 'section' | 'teacher' | 'room' | 'subject' | 'hierarchy_branch';
  id: string;
  name: string;
  impact_level: 'low' | 'medium' | 'high';
}

/**
 * Complete schedule output
 */
export interface ScheduleOutput extends RegeneratedSchedule {
  timetable: TimeTable;
  placed_sessions_list: PlacedSession[];
  unplaced_sessions_list: UnplacedSession[];
  unplaced_reasons: Record<string, string>;
  hard_constraint_compliance: ComplianceStatus;
  soft_constraint_score_breakdown: OptimizationReport['score_breakdown'];
  repair_summary: RepairAction[];
  attempt_comparison: Record<number, ScheduleAttemptSummary>;
  scope_used: GenerationScope;
  seed_used: number;
}

/**
 * Timetable organized by day and time
 */
export interface TimeTable {
  [day: string]: {
    [time_slot: string]: PlacedSession[];
  };
}

/**
 * Compliance status
 */
export interface ComplianceStatus {
  total_constraints: number;
  satisfied: number;
  violated: number;
  compliance_percentage: number;
  critical_violations: ConstraintViolation[];
}

/**
 * Schedule attempt summary
 */
export interface ScheduleAttemptSummary {
  attempt_number: number;
  score: number;
  placed_count: number;
  unplaced_count: number;
  constraint_violations: number;
  seed: number;
}

/**
 * Generator configuration
 */
export interface GeneratorConfig {
  mode: GenerationMode;
  scope: GenerationScope;
  schedule_window: ScheduleWindow;
  constraints: ClassifiedConstraints;
  seed: number;
  max_attempts: number;
  enable_forward_checking: boolean;
  enable_optimization: boolean;
  optimization_time_limit: number;
  optimization_max_iterations: number;
  optimization_profile: 'balanced' | 'compact' | 'teacher_friendly' | 'room_efficiency';
  optimization_mode: 'safe' | 'advanced';
  institutional_options: InstitutionalOptions;
  scalability_options: ScalabilityOptions;
}

/**
 * Scalability options for performance tuning
 */
export interface ScalabilityOptions {
  /**
   * Maximum number of sessions to process before applying early termination
   * Set to 0 for no limit (default)
   */
  max_sessions: number;
  
  /**
   * Enable memoization for expensive constraint checks
   * Improves performance for large datasets at cost of memory
   */
  enable_memoization: boolean;
  
  /**
   * Cache size for constraint memoization (number of entries)
   * Only used if enable_memoization is true
   */
  memoization_cache_size: number;
  
  /**
   * Enable parallel constraint checking where possible
   * Requires Web Worker support
   */
  enable_parallel_checking: boolean;
  
  /**
   * Number of parallel workers for constraint checking
   * Only used if enable_parallel_checking is true
   */
  parallel_worker_count: number;
  
  /**
   * Enable early termination when a good enough solution is found
   * Based on compliance percentage threshold
   */
  enable_early_termination: boolean;
  
  /**
   * Compliance percentage threshold for early termination (0-100)
   * Only used if enable_early_termination is true
   */
  early_termination_threshold: number;
  
  /**
   * Maximum time (in milliseconds) for the entire generation process
   * Set to 0 for no limit (default)
   */
  max_generation_time: number;
}

/**
 * Preset scalability configurations for different dataset sizes
 */
export const ScalabilityPresets = {
  /**
   * Small dataset (< 50 sessions) - Full optimization, no limits
   */
  small: (): ScalabilityOptions => ({
    max_sessions: 0,
    enable_memoization: false,
    memoization_cache_size: 0,
    enable_parallel_checking: false,
    parallel_worker_count: 0,
    enable_early_termination: false,
    early_termination_threshold: 100,
    max_generation_time: 0,
  }),
  
  /**
   * Medium dataset (50-200 sessions) - Balanced performance
   */
  medium: (): ScalabilityOptions => ({
    max_sessions: 0,
    enable_memoization: true,
    memoization_cache_size: 500,
    enable_parallel_checking: false,
    parallel_worker_count: 0,
    enable_early_termination: false,
    early_termination_threshold: 95,
    max_generation_time: 0,
  }),
  
  /**
   * Large dataset (200-500 sessions) - Performance optimized
   */
  large: (): ScalabilityOptions => ({
    max_sessions: 0,
    enable_memoization: true,
    memoization_cache_size: 2000,
    enable_parallel_checking: true,
    parallel_worker_count: 4,
    enable_early_termination: true,
    early_termination_threshold: 90,
    max_generation_time: 30000, // 30 seconds
  }),
  
  /**
   * Very large dataset (> 500 sessions) - Aggressive optimization
   */
  veryLarge: (): ScalabilityOptions => ({
    max_sessions: 0,
    enable_memoization: true,
    memoization_cache_size: 5000,
    enable_parallel_checking: true,
    parallel_worker_count: 8,
    enable_early_termination: true,
    early_termination_threshold: 85,
    max_generation_time: 60000, // 60 seconds
  }),
  
  /**
   * Default configuration - Balanced for general use
   */
  default: (): ScalabilityOptions => ({
    max_sessions: 0,
    enable_memoization: true,
    memoization_cache_size: 1000,
    enable_parallel_checking: false,
    parallel_worker_count: 4,
    enable_early_termination: false,
    early_termination_threshold: 95,
    max_generation_time: 0,
  }),
};

/**
 * Institutional options
 */
export interface InstitutionalOptions {
  split_session_support: boolean;
  compressed_week_support: boolean;
  staggered_break_support: boolean;
  shared_teacher_support: boolean;
  deloaded_teacher_support: boolean;
  special_room_fallback_policy: 'fail' | 'relax' | 'alternate';
  priority_override_policy: 'strict' | 'flexible';
  overflow_policy: 'fail' | 'relax_soft' | 'expand_scope' | 'partial_only';
  max_consecutive_hours: number;
  max_daily_load: number;
}

/**
 * Normalized data for generation
 */
export interface NormalizedData {
  teachers: NormalizedTeacher[];
  rooms: NormalizedRoom[];
  sections: NormalizedSection[];
  subjects: NormalizedSubject[];
  institutional_settings: Record<string, unknown>;
}

/**
 * Raw input data
 */
export interface RawData {
  teachers: Teacher[];
  rooms: Room[];
  sections: Section[];
  subjects: Subject[];
  existing: ExistingSchedule[];
  institutional_policies: Record<string, unknown>;
}
