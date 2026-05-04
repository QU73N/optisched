# CSP-Based Schedule Generation Engine

A 15-phase Constraint Satisfaction Problem (CSP) based schedule generation engine for OptiSched.

## Overview

This engine implements a sophisticated CSP-based approach to schedule generation using 15 distinct phases to ensure optimal schedules that respect both hard constraints (must-have requirements) and soft constraints (preferences and optimizations).

## Architecture

### Core Components

- **scheduleGenerator.ts** (892 lines) - Main engine implementing the 15-phase pipeline
- **hardConstraintChecker.ts** (510 lines) - Hard constraint validation (10 constraint types)
- **softConstraintChecker.ts** (532 lines) - Soft constraint scoring (9 constraint types)
- **types.ts** (590 lines) - Comprehensive type definitions
- **generatorIntegration.ts** (173 lines) - Legacy integration layer

## The 15-Phase Pipeline

### Phase 1: Scope Definition
Parses and validates the generation scope, determining which teachers, rooms, sections, and subjects to include in the schedule.

### Phase 2: Data Preparation and Normalization
Normalizes input data into a consistent format, parsing teacher availability windows and building qualified subject lists.

### Phase 3: Constraint Classification
Categorizes constraints as hard, soft, or preference-based for appropriate handling during generation.

### Phase 4: Priority and Hardness Ranking
Ranks sessions by difficulty based on constraints, priority levels, and resource availability.

### Phase 5: Domain Construction
Builds candidate domains for each session, identifying valid teacher/room combinations.

### Phase 6: Initial Construction
Performs greedy initial session placement using domain values and constraint checking.

### Phase 7: Forward Checking and Propagation
Propagates constraint effects to prune domains and detect conflicts early.

### Phase 8: Repair and Local Backtracking
Repairs conflicts through local search and backtracking on violated constraints.

### Phase 9: Controlled Randomized Search
Explores solution space with controlled randomness to escape local optima.

### Phase 10: Multi-Objective Optimization
Optimizes for multiple objectives simultaneously (compactness, fairness, efficiency).

### Phase 11: Institutional Options
Applies institutional policies like split sessions, compressed weeks, and shared teachers.

### Phase 12: Impossible Schedule Handling
Detects impossible schedules and provides detailed failure analysis.

### Phase 13: Versioning and Reproducibility
Creates versioned outputs with seeds for reproducible generation.

### Phase 14: Partial Regeneration Options
Supports regenerating only affected portions of the schedule.

### Phase 15: Output and Review
Formats final output with compliance metrics and quality scores.

## Hard Constraints

The engine enforces 10 hard constraint types:

1. **No Teacher Overlap** - Teachers cannot be in two places at once
2. **No Room Overlap** - Rooms cannot host multiple sessions simultaneously
3. **No Section Overlap** - Sections cannot have conflicting sessions
4. **Room Capacity Compliance** - Room capacity must accommodate section size
5. **Teacher Qualification Enforcement** - Teachers must be qualified for subjects
6. **Teacher Availability Enforcement** - Teachers must be available at scheduled times
7. **Max Consecutive Hours** - Limits consecutive teaching hours (configurable)
8. **Max Daily Load** - Limits daily teaching hours (configurable)
9. **Subject Hour Completion** - Ensures subject hour requirements are met
10. **Special Subject Room Priority** - Prioritizes special rooms for specific subjects

## Soft Constraints

The engine optimizes for 9 soft constraint types:

1. **Balanced Weekly Load** - Ensures teachers have balanced teaching loads
2. **Reduced Idle Gaps** - Minimizes gaps between sessions for teachers
3. **Compact Section Schedules** - Ensures section schedules are time-compact
4. **Room Movement Minimization** - Reduces room switching for sections
5. **Time of Day Preference** - Respects subject time preferences
6. **Room Utilization Efficiency** - Maximizes room capacity usage
7. **Schedule Compactness** - Ensures overall schedule is compact
8. **Fairness Between Teachers** - Ensures fair session distribution
9. **Priority Weighting** - Prioritizes high-priority sessions

## Generation Modes

The engine supports 7 generation modes:

- **full** - Complete rebuild from scratch with optimization
- **partial** - Regenerate only affected elements, respecting protected sessions
- **draft** - Create temporary schedule for review without saving
- **locked** - Regenerate only in allowed slots while keeping protected sessions fixed
- **what-if** - Test scenarios without saving results
- **emergency** - React to broken schedules with relaxed constraints
- **multi-scenario** - Generate multiple candidate schedules for comparison

## Usage Example

```typescript
import { ScheduleGenerator } from './services/generator/scheduleGenerator';
import { generateWithNewEngine } from './services/generator/generatorIntegration';

// Using the integration layer (recommended)
const result = await generateWithNewEngine(legacyConfig, rawData);

// Or using the generator directly
const generator = new ScheduleGenerator(config, rawData);
const schedule = await generator.generate();
```

## Configuration

### GeneratorConfig

```typescript
interface GeneratorConfig {
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
```

### InstitutionalOptions

```typescript
interface InstitutionalOptions {
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
```

### ScalabilityOptions

```typescript
interface ScalabilityOptions {
  max_sessions: number;              // Max sessions before early termination (0 = no limit)
  enable_memoization: boolean;       // Enable constraint check caching
  memoization_cache_size: number;    // Cache size for memoization
  enable_parallel_checking: boolean; // Enable parallel constraint checking
  parallel_worker_count: number;     // Number of parallel workers
  enable_early_termination: boolean; // Enable early termination on good solution
  early_termination_threshold: number; // Compliance threshold for early termination
  max_generation_time: number;       // Max generation time in ms (0 = no limit)
}
```

### Scalability Presets

The engine provides pre-configured presets for different dataset sizes:

```typescript
import { ScalabilityPresets } from './services/generator/types';

// Small dataset (< 50 sessions) - Full optimization
config.scalability_options = ScalabilityPresets.small();

// Medium dataset (50-200 sessions) - Balanced performance
config.scalability_options = ScalabilityPresets.medium();

// Large dataset (200-500 sessions) - Performance optimized
config.scalability_options = ScalabilityPresets.large();

// Very large dataset (> 500 sessions) - Aggressive optimization
config.scalability_options = ScalabilityPresets.veryLarge();

// Default balanced configuration
config.scalability_options = ScalabilityPresets.default();
```

## Output Format

The generator returns a `ScheduleOutput` object containing:

- `timetable` - Schedule organized by day and time
- `placed_sessions_list` - Successfully placed sessions
- `unplaced_sessions_list` - Sessions that could not be placed (if any)
- `hard_constraint_compliance` - Compliance percentage and violations
- `soft_constraint_score` - Overall soft constraint penalty score
- `version_id` - Unique version identifier
- `seed_used` - Seed used for reproducibility
- `generation_metadata` - Timing and configuration metadata

## Testing

The engine includes comprehensive test coverage:

- Unit tests for individual constraint checkers
- Integration tests for the full pipeline
- Performance tests for various dataset sizes
- 80/84 tests passing (4 pre-existing failures unrelated to generator)

Run tests with:
```bash
npm test -- --run
```

## Performance Characteristics

- Small dataset (10 subjects, 5 teachers, 5 rooms, 5 sections): < 1 second
- Medium dataset (50 subjects, 10 teachers, 10 rooms, 10 sections): < 2 seconds
- Large datasets may require optimization based on constraint complexity

## Security

The engine is designed with security in mind:

- No hardcoded secrets or API keys
- No dangerous functions (eval, innerHTML, etc.)
- TypeScript strict typing for all inputs
- No SQL injection risk (no direct SQL execution)
- Input validation through type system

## Integration with Legacy System

The `generatorIntegration.ts` module provides compatibility with the existing OptiSched system:

- Converts legacy config to new format
- Converts legacy data to normalized format
- Converts new generator output to legacy format
- Maintains backward compatibility

## Future Enhancements

Potential areas for future improvement:

- Enhanced soft constraint weights and priorities
- Machine learning for constraint relaxation strategies
- Real-time conflict detection during generation
- Distributed generation for very large datasets
- Web Worker support for non-blocking generation
- Advanced visualization of constraint violations

## License

Part of the OptiSched project.
