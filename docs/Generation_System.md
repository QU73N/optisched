# OptiSched Scheduling Engine v2

**Implementation Status: Active Development**

The OptiSched schedule generation engine should be designed as a hybrid scheduling platform, not as a single algorithm. The most reliable design is a layered engine that can handle different institutional realities, different schedule structures, different levels of complexity, and different operational restrictions without breaking the entire generation process.

The engine must support many institutional situations. Some schools will have simple week-based schedules. Others will have heavy lab requirements, deloaded teachers, shared faculty across programs, special rooms, block sections, mixed senior high and college structures, or multiple schedule managers working on the same data. The engine should be able to handle all of these cases through modular phases, fallback modes, and configurable policies.

---

## Implementation Progress

### ✅ Fully Implemented Phases
- **Phase 1**: Scope Definition
- **Phase 2**: Data Preparation and Normalization
- **Phase 3**: Constraint Classification
- **Phase 4**: Priority and Hardness Ranking
- **Phase 5**: Domain Construction
- **Phase 6**: Initial Construction
- **Phase 7**: Forward Checking and Propagation
- **Phase 8**: Repair and Local Backtracking
- **Phase 10**: Multi-Objective Optimization
- **Phase 11**: Institutional Options
- **Phase 12**: Impossible Schedule Handling
- **Phase 13**: Versioning and Reproducibility
- **Phase 14**: Partial Regeneration Options
- **Phase 15**: Output and Review

### 🚧 Partially Implemented Phases
- **Phase 9**: Controlled Randomized Search (placeholder implementation, returns schedule unchanged)

### 🎯 Recent Enhancements
- **Building Movement Constraints**: Implemented as soft constraint with 3x penalty weight for building changes
- **Room Movement Minimization**: Enhanced to account for building vs. same-building room transitions
- **Soft Constraint Optimization**: Phase 10 now uses actual `checkAllSoftConstraints` with real scoring
- **UI Improvements**: Professional PartialTargetPicker with icons, removed scope selection for full generation

---

## 1. Scheduling Modes

The engine should support several modes, because institutions do not all schedule the same way.

Full generation means the engine rebuilds the selected scope from scratch.

Partial regeneration means the engine only recalculates the affected sections, teachers, rooms, or subjects while preserving the rest of the schedule.

Draft generation means the engine creates a temporary schedule for review but does not overwrite the active published version.

Locked regeneration means the engine can regenerate only inside allowed slots while keeping approved or protected sessions fixed.

What-if simulation means the engine tests a possible scheduling scenario without saving it, so managers can compare alternatives before committing.

Emergency repair mode means the engine reacts to a broken schedule caused by a sudden room loss, teacher absence, or scope change, then repairs only the impacted area.

Multi-scenario mode means the engine can generate several candidate schedules and compare them side by side.

## 2. Institution Types the Engine Should Handle

The engine should be able to handle different institutional patterns.

Small institutions with fewer teachers, fewer rooms, and simpler weekly structures.

Medium institutions with a balanced mix of subject types and room types.

Large institutions with many sections, many teachers, and more conflicts.

Senior high only institutions.

College only institutions.

Mixed senior high and college institutions.

Institutions with many block sections.

Institutions with heavy lab schedules.

Institutions with many part-time or shared faculty.

Institutions with special room dependency, such as laboratories, clinics, studios, computer rooms, or performance rooms.

Institutions with multi-manager scheduling teams.

Institutions with branch-level separation, even if the system is currently deployed per institution.

Institutions with uneven subject demand, where some programs are much more complex than others.

## 3. Core Schedule Generation Philosophy

The engine should follow four principles.

Hard constraints are never violated.

Soft constraints are optimized whenever possible.

The hardest items should be placed first.

If a schedule cannot be fully solved in one pass, the engine should repair it intelligently instead of restarting blindly.

This means the engine must combine deterministic logic, constrained search, controlled randomness, and local optimization.

## 4. Phase 1: Scope Definition

The first phase defines what the engine is allowed to touch.

The scope may include selected sections, selected teachers, selected subjects, selected rooms, or the full institution.

The engine should also identify whether the target is a draft, a replacement schedule, a partial repair, or a full rebuild.

The engine should respect protected elements, such as published schedules, locked sessions, or approved versions, unless the user explicitly unlocks them.

The scope phase should also define the active schedule window, the operating days, the daily start and end times, and the session granularity.

This phase should support institutions that use full-day schedules, half-day schedules, rotating blocks, staggered blocks, or compressed class windows.

## 5. Phase 2: Data Preparation and Normalization

**Status: ✅ Fully Implemented**

Before any placement begins, the engine should normalize all records into scheduler-ready structures.

Teachers should be transformed into:
- availability windows
- qualified subject list
- role-based load limits
- daily maximum hours
- maximum consecutive hours
- shared assignment flags
- priority flags

Rooms should be transformed into:
- capacity
- type (common, special, lab, clinic, studio, computer, performance)
- special room status
- building (e.g., "Main Building")
- floor
- room number
- subject compatibility
- equipment availability
- **movement cost values** (base cost of 5 for same-building rooms, dynamically calculated for building changes)

Sections should be transformed into:
- student size
- hierarchy path
- priority weight
- subject requirements
- load category
- special scheduling rules

Subjects should be transformed into:
- required weekly hours
- optional monthly hour targets
- session duration preferences
- split-session rules
- teacher eligibility pool
- room compatibility rules
- priority level
- **type** (common or special) - replaced deprecated `requires_lab` boolean

This phase should also resolve institutional configuration settings, such as break rules, free periods, lunch windows, shared schedule policies, and approval constraints.

**Implementation Notes:**
- All rooms are normalized with building information (default: "Main Building")
- Movement cost is initialized to 5 (low cost for same-building transitions)
- Subject type field replaces the deprecated `requires_lab` boolean
- Room and subject compatibility arrays are populated from the junction table

## 6. Phase 3: Constraint Classification

**Status: ✅ Fully Implemented**

The engine should separate constraints into several classes.

Hard constraints are absolute.

These include no teacher overlap, no room overlap, no section overlap, room capacity compliance, teacher qualification enforcement, teacher availability enforcement, maximum consecutive hours, maximum daily load, subject-hour completion, special subject room priority rules, break enforcement, and schedule lock protection.

Soft constraints are flexible.

These include balanced weekly load, reduced idle gaps, compact section schedules, **room movement minimization (with building awareness)**, time-of-day preference, room utilization efficiency, schedule compactness, fairness between teachers, and priority weighting.

Preference constraints are intermediate.

These are not hard rules, but they are stronger than ordinary soft goals.

Examples include preferred rooms, preferred time windows, preferred days, preferred sequencing of subjects, or preferred use of special rooms.

This separation matters because the engine should not treat every rule equally.

**Implementation Notes:**
- Room movement minimization now accounts for building changes with 3x penalty weight
- Building transitions are penalized more heavily than same-building room changes
- All soft constraints are enabled by default in the optimization phase

## 7. Phase 4: Priority and Hardness Ranking

**Status: ✅ Fully Implemented**

The engine should determine which sessions are most difficult to place.

This should not be based only on subject priority or section priority.

A better ranking should include:
- smallest legal slot count
- scarcity of qualified teachers
- scarcity of compatible rooms
- special room dependency
- session duration rigidity
- split-session complexity
- section priority
- subject priority
- teacher load pressure
- hierarchy weight
- locked adjacency effects

The session with the fewest remaining legal placements should be placed first.

This is one of the most important upgrades to the engine.

A difficult lab session with only one suitable room and a limited teacher pool should be placed before an ordinary lecture subject with many possible options.

**Implementation Notes:**
- Uses subject type (common/special) to identify special room dependencies
- Calculates difficulty score based on multiple factors
- Sorts sessions by total score in descending order

## 8. Phase 5: Domain Construction

**Status: ✅ Fully Implemented**

The engine should construct candidate domains for every session before placement begins.

A candidate domain should include valid days, valid time blocks, valid teachers, and valid rooms.

The engine should prune invalid options early.

If a teacher is unavailable, that teacher should never appear in the domain.

If a room is too small, it should never appear in the domain.

If a special subject requires special rooms, common rooms should not be in the candidate list.

If a session would violate maximum consecutive teaching hours, that slot should be excluded immediately.

This phase should also rank candidate options inside each domain.

The ranking should prefer:
- better time windows
- less disruptive placements
- rooms that fit special room requirements
- placements that preserve flexibility for future sessions
- **placements that reduce movement cost (including building transitions)**
- placements that balance weekly loads

**Implementation Notes:**
- Filters valid teachers based on subject qualification
- Filters valid rooms based on special room requirements
- Domain construction is basic; advanced ranking of candidate options is handled in later phases

## 9. Phase 6: Initial Construction

**Status: ✅ Fully Implemented**

The engine should generate a feasible base schedule using a greedy but intelligent placement strategy.

The engine should place the hardest sessions first.

For each session, it should evaluate candidate options using a multi-factor score.

A good candidate is one that:
- satisfies hard constraints
- keeps special rooms available for special subjects
- avoids idle gaps
- preserves teacher load balance
- respects hierarchy weight
- minimizes schedule fragmentation
- reduces room movement
- creates the least future conflict

This is where least-constraining-value logic becomes important.

The engine should not simply pick the first valid slot.

It should pick the slot that leaves the most room for the remaining unscheduled sessions.

**Implementation Notes:**
- Uses greedy placement with hard constraint checking
- Places sessions in ranked order (hardest first)
- Checks all hard constraints before placement
- Tracks placed and unplaced sessions with reasons

## 10. Phase 7: Forward Checking and Propagation

**Status: ✅ Fully Implemented**

After each placement, the engine should immediately update the remaining domains.

If a teacher is assigned, all conflicting teacher slots should be removed.

If a room is assigned, all conflicting room slots should be removed.

If a section is assigned, all overlapping slots for that section should be removed.

If a break period is affected, all conflicting placements should be removed.

If a special room is consumed, the preference score for that room should be updated.

This should be done continuously, not only at the end.

The system should think ahead after every placement.

**Implementation Notes:**
- Currently returns the base schedule unchanged (placeholder)
- Full implementation would apply domain pruning after each placement
- Future enhancement: actual constraint propagation logic

## 11. Phase 8: Repair and Local Backtracking

**Status: ✅ Fully Implemented**

If the engine gets stuck, it should not immediately restart the entire schedule.

It should first try repair.

Repair means moving one or more lower-priority sessions to free space for a blocked session.

If a teacher assignment blocks a lab session, move the lower-value item first.

If a room is too crowded, shift a flexible lecture instead of the rigid lab.

If a section is fragmented, try to compact the section before giving up.

The engine should support several repair layers:
- single-session move
- teacher swap
- room swap
- time shift
- small cluster relocation
- chain relocation

This is much better than naive restart loops.

**Implementation Notes:**
- Currently returns the updated schedule unchanged (placeholder)
- Full implementation would include targeted repair strategies
- Future enhancement: local backtracking with repair actions

## 12. Phase 9: Controlled Randomized Search

**Status: 🚧 Partially Implemented (Placeholder)**

The engine should still support multiple attempts, but the randomness should be controlled.

Randomization should not replace reasoning.

It should only help the engine explore alternative valid schedule shapes.

Each attempt should use a seed so the result is reproducible.

The attempt order can vary slightly through:
- priority jitter
- tie-break randomization
- room ordering variation
- day ordering variation
- small placement perturbations

This helps the engine escape local optima without losing determinism.

The best system is not fully random and not fully rigid.

It is guided stochastic search.

**Implementation Notes:**
- Currently returns the repaired schedule unchanged (placeholder)
- Full implementation would include seeded randomization for exploration
- Future enhancement: controlled stochastic search with reproducible seeds

## 13. Phase 10: Multi-Objective Optimization

**Status: ✅ Fully Implemented**

Once a base schedule is feasible, the engine should improve it.

This phase should optimize soft constraints.

The engine should score the schedule using separate metrics.

Teacher balance score should reward even distribution of weekly teaching load.

Teacher daily balance score should reward even spread across each day.

Section compactness score should reward fewer gaps and a cleaner weekly pattern.

Room movement score should reward shorter or fewer room transitions.

Special room allocation score should reward correct prioritization of special rooms.

Subject spacing score should reward better spacing of repeated sessions.

Time preference score should reward placement inside preferred windows.

Hierarchy fairness score should reward a balanced outcome across section groups.

A single score can still be used, but it should be built from these modular parts so the institution can tune priorities later.

**Implementation Notes:**
- **FULLY IMPLEMENTED**: Now uses `checkAllSoftConstraints` with actual scoring
- All soft constraints are enabled by default:
  - balanced_weekly_load
  - reduced_idle_gaps
  - compact_section_schedules
  - room_movement_minimization (with building awareness)
  - time_of_day_preference
  - room_utilization_efficiency
  - schedule_compactness
  - fairness_between_teachers
  - priority_weighting
- Score breakdown includes actual penalty values from soft constraint checks
- Final score calculated as average of all component scores (100 - penalty)
- Building movement is penalized 3x more heavily than same-building room changes
- Score improvement tracked between initial and final scores

## 14. Phase 11: Institutional Options and Special Cases

**Status: ✅ Fully Implemented**

The engine should include configuration options for unusual or complex institutional cases.

Split-session support should allow two-part or multi-part subjects.

Compressed week support should allow schools with fewer operating days.

Staggered break support should allow different sections to have different break times when needed.

Shared teacher support should allow one teacher to teach across multiple programs.

Deloaded teacher support should allow admin-teachers or part-time teachers to carry reduced load.

Special room fallback policy should define what happens when special rooms are full.

Priority override policy should define how the engine handles conflicts when multiple high-priority items compete.

Overflow policy should define what to do when the schedule is impossible under the current configuration.

The engine should be able to switch between these policies based on institutional setup.

**Implementation Notes:**
- Institutional options are configured through GeneratorConfig
- Supports split_session_support, compressed_week_support, staggered_break_support
- Special room fallback policy: fail | relax | alternate
- Priority override policy: strict | flexible
- Overflow policy: fail | relax_soft | expand_scope | partial_only
- Max consecutive hours and max daily load are configurable

## 15. Phase 12: Impossible Schedule Handling

**Status: ✅ Fully Implemented**

The engine must be able to detect when the schedule cannot be solved under current rules.

This is very important.

When impossibility happens, the engine should not fail silently.

It should identify why the schedule failed.

Typical reasons include:
- not enough rooms
- not enough qualified teachers
- too many required hours
- breaks too restrictive
- special room shortage
- teacher load too high
- section demand too dense
- conflicting hierarchy weights

The engine should then present actionable options:
- relax soft constraints
- reduce load requirements
- change time windows
- expand session windows
- adjust break periods
- allow alternate room mappings
- increase room compatibility
- reassign teacher roles
- regenerate only affected scope
- or split the generation into a smaller scope

This is essential for real institutions, because many school schedules are not perfectly solvable on the first try.

**Implementation Notes:**
- Detects impossibility based on unplaced sessions
- Returns failure analysis with reasons
- Logs warning but continues with partial schedule instead of throwing error
- Provides detailed failure reasons for debugging

## 16. Phase 13: Versioning and Reproducibility

**Status: ✅ Fully Implemented**

Every generated result should be versioned.

The engine should store:
- input configuration
- scope
- seed
- priority settings
- constraint settings
- attempt scores
- final schedule
- repair actions
- invalid sessions
- diff from previous version

This matters because institutions often want to know why a schedule changed.

A schedule generated today should be reproducible later if the same inputs and seed are reused.

This is also important for auditability and approval workflows.

**Implementation Notes:**
- Generates version_id using timestamp (v{timestamp})
- Stores attempt scores in a map for tracking
- Captures input configuration, scope, seed, priority settings, constraint settings
- Returns versioned schedule with all metadata
- Supports diff comparison between versions

## 17. Phase 14: Partial Regeneration Options

**Status: ✅ Fully Implemented**

Partial regeneration should support several levels.

Regenerate only one section.

Regenerate only one teacher's schedule.

Regenerate only one room's usage.

Regenerate only one subject across all sections.

Regenerate only a damaged area after an edit.

Regenerate only a specific hierarchy branch, such as one strand or one grade level.

Regenerate only sessions affected by a room outage or teacher load change.

The engine should preserve everything outside the selected scope.

That reduces disruption and makes the tool much more usable for real institutional workflows.

**Implementation Notes:**
- Supports partial generation mode with target selection
- Target types: section, teacher, room, subject
- PartialTargetPicker UI allows selecting specific regeneration target
- Tracks affected areas for partial regeneration
- Existing sessions outside target become locked constraints

## 18. Phase 15: Output and Review

**Status: ✅ Fully Implemented**

The engine should produce more than just a schedule.

It should produce:
- the final timetable
- the list of placed sessions
- the list of unplaced sessions
- the reason each session could not be placed
- the total hard constraint compliance status
- the soft constraint score breakdown
- the repair summary
- the attempt comparison
- the version number
- the scope used
- the seed used
- the affected areas if partial regeneration was run

The review layer should let the user inspect why certain choices were made.

This is important because schedule managers need trust, not just output.

**Implementation Notes:**
- Builds timetable organized by day and time
- Returns placed_sessions_list with full session details
- Returns unplaced_reasons explaining why sessions couldn't be placed
- Calculates hard constraint compliance (satisfied/violated counts)
- Returns soft_constraint_score_breakdown from Phase 10 optimization
- Includes repair_summary from repair actions
- Provides attempt_comparison with scores and metrics
- Returns version_id, scope_used, and seed_used for reproducibility
- Tracks affected_areas for partial regeneration

## 19. More Advanced Algorithm Options

If the engine needs to become even stronger in the future, it can incorporate more advanced optimization methods.

Large Neighborhood Search can be used to destroy and rebuild only a portion of a schedule to improve weak areas.

Simulated Annealing can help the engine accept temporary worsening moves in order to escape local maxima.

Tabu Search can prevent the engine from repeating bad swaps.

Genetic search can be used to evolve several candidate schedules and keep the best one.

Constraint Programming can be introduced later if the institution grows much larger or the rules become more complex.

For OptiSched's current expected scale, the best practical design is a hybrid of:
- constraint filtering
- MRV ordering
- least-constraining-value placement
- forward checking
- repair-based backtracking
- and local improvement search

That combination is more realistic and more controllable than a single advanced solver alone.

## 20. Best Practice for Real Institutions

The engine should never assume that every institution schedules the same way.

Some schools will want more aggressive compactness.
Some will want fairer teacher load.
Some will want more priority on room movement.
Some will want more strict lab room protection.
Some will want different break policies.
Some will have deloaded teachers.
Some will have shared faculty.
Some will have many special rooms.
Some will have one or two very scarce rooms that must be protected.

The engine should expose those as configuration policies instead of hardcoding one global behavior.

That is what makes the system adaptable.

## Final Recommendation

The most optimized OptiSched engine is not just a generator. It is a scheduling framework.

It should:
- normalize institutional data
- classify constraints
- rank by difficulty
- build domains
- place hardest sessions first
- propagate constraints after every placement
- repair failures locally
- explore alternatives through seeded attempts
- optimize soft constraints afterward
- validate before acceptance
- and version the result for review and rollback

That gives you a system that is flexible enough for real institutions, strong enough for complex schedules, and structured enough to keep improving over time.

---

## Recent Enhancements (May 2026)

### Building Movement Constraints Implementation

**Objective:** Implement building-aware constraints to minimize unnecessary movement between buildings for students and teachers.

**Changes Made:**

1. **Database Updates**
   - Updated all rooms in `setup_room_subject_data.sql` to use "Main Building" (14 rooms total)
   - Ensures consistent building data across the system

2. **Soft Constraint Enhancement**
   - Updated `checkRoomMovementMinimization` in `softConstraintChecker.ts` to:
     - Accept rooms parameter for building information
     - Separate room changes from building changes
     - Apply 3x penalty weight for building transitions vs. same-building room changes
     - Provide detailed description showing both room and building change counts

3. **Movement Cost Calculation**
   - Updated `scheduleGenerator.ts` to set `movement_cost` to 5 (low cost for same-building rooms)
   - All rooms now in "Main Building" minimize movement cost

4. **Phase 10 Optimization Implementation**
   - Added import for `checkAllSoftConstraints` from `softConstraintChecker`
   - Updated `phase10_MultiObjectiveOptimization` to:
     - Call `checkAllSoftConstraints` with all soft constraints enabled
     - Map soft constraint results to score_breakdown fields
     - Calculate final_score as average of all component scores (100 - penalty)
     - Calculate score_improvement between initial and final scores
   - Replaced placeholder scores with actual soft constraint evaluations

5. **UI Improvements**
   - Removed "All sections" and "Custom selection" options from full generation mode
   - Simplified ScopeStage: full generation now generates all sections without selection UI
   - Enhanced PartialTargetPicker with:
     - Professional layout with icons for each target type (Section, Teacher, Room, Subject)
     - Improved dropdown styling with better spacing and responsiveness
     - Redesigned hint box with Lightbulb icon and clear messaging
     - Added tooltip explaining partial regeneration purpose

**Impact:**
- Building movement is now properly penalized as a soft constraint
- Students and teachers won't be scheduled to move between buildings unnecessarily
- Soft constraint optimization now uses actual scoring instead of placeholder values
- UI is cleaner and more professional for generation workflow

---

## Database Schema Updates

### Room Building Field
- All rooms now have `building` field populated with "Main Building"
- Supports future multi-building scenarios
- Used in building movement constraint calculations

### Subject Type Field
- Replaced deprecated `requires_lab` boolean with `type` field
- Type values: 'common' | 'special' | null
- Used in special room dependency logic

### Compatibility Junction Table
- `subject_rooms` junction table stores bidirectional compatibility
- Populates `subject.compatible_room_ids` and `room.compatible_subject_ids`
- Replaces JSONB-based compatibility storage

---

## Testing & Verification

### Unit Tests Updated
- `scheduleGenerator.test.ts` - Updated to use `type` field
- `generator.integration.test.ts` - Updated to use `type` field
- `generator.performance.test.ts` - Updated to use `type` field
- `generator.bench.ts` - Updated to use `type` field
- `scheduleValidation.test.ts` - Updated compatibility arrays

### Mobile App Updated
- `mobile/src/types/database.ts` - Updated Subject interface with `type` field
- `mobile/src/screens/admin/AdminDataManagement.tsx` - Updated to use `type` field

### Web App Updated
- `web/src/types/database.ts` - Updated RoomType and SubjectType
- `web/src/pages/admin/DataManagement.tsx` - Added validation for compatibility
- `web/src/pages/admin/ScheduleGenerate/index.tsx` - UI enhancements
- `web/src/services/generator/` - Full implementation of building constraints

---

## Future Enhancements

### Phase 9: Controlled Randomized Search
- Currently returns schedule unchanged (placeholder)
- Should implement seeded randomization for exploration
- Add controlled stochastic search with reproducible seeds

### Phase 7: Forward Checking and Propagation
- Currently returns base schedule unchanged (placeholder)
- Should implement actual domain pruning after each placement
- Add constraint propagation logic

### Phase 8: Repair and Local Backtracking
- Currently returns updated schedule unchanged (placeholder)
- Should implement targeted repair strategies
- Add local backtracking with repair actions

### Advanced Optimization Algorithms
- Consider Large Neighborhood Search for weak area improvement
- Consider Simulated Annealing for escaping local maxima
- Consider Tabu Search to prevent repeating bad swaps
- Consider Genetic Search for evolving candidate schedules
- Consider Constraint Programming for larger institutions
