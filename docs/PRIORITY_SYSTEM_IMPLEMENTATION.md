# Priority System Implementation

**Status:** ✅ COMPLETED  
**Migration:** `007_create_priority_system.sql`  
**Date:** April 28, 2026

---

## Overview

Implemented comprehensive priority system with configurable weighting for sections, subjects, teachers, and rooms. This addresses PRD §13.3, enabling the schedule generator to prioritize certain entities during conflict resolution.

---

## Database Changes

### New Columns Added

#### `teachers` table
| Column | Type | Description |
|--------|------|-------------|
| `weight` | integer (0-100) | Scheduling priority weight (higher = scheduled first) |
| `priority_note` | text (nullable) | Optional note explaining priority reason |

**Index:** `ix_teachers_weight` - For priority queries on active teachers

#### `subjects` table
| Column | Type | Description |
|--------|------|-------------|
| `weight` | integer (0-100) | Scheduling priority weight (higher = scheduled first) |
| `priority_note` | text (nullable) | Optional note explaining priority reason |

**Index:** `ix_subjects_weight` - For priority queries

#### `rooms` table
| Column | Type | Description |
|--------|------|-------------|
| `weight` | integer (0-100) | Scheduling priority weight (higher = scheduled first) |
| `priority_note` | text (nullable) | Optional note explaining priority reason |

**Index:** `ix_rooms_weight` - For priority queries on available rooms

#### `sections` table
Already has `weight` from hierarchy migration (005). No changes needed.

### New Table

#### `priority_config`
Global priority configuration table for system-wide priority settings.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `key` | text | Unique configuration key |
| `value` | jsonb | Configuration value (JSON) |
| `description` | text (nullable) | Description of the configuration |
| `category` | text | Configuration category (e.g., 'general') |
| `is_active` | boolean | Whether the configuration is active |
| `updated_by` | uuid (nullable) | User who last updated |
| `updated_at` | timestamptz | Last update timestamp |
| `created_at` | timestamptz | Creation timestamp |

**Indexes:**
- `ix_priority_config_category` - For querying by category
- `ix_priority_config_key` - For querying by key

### Default Configurations

The migration inserts default priority configurations:

1. **section_weight_multiplier** - Multiplier for section weights (default: 1.0)
2. **teacher_weight_multiplier** - Multiplier for teacher weights (default: 1.0)
3. **subject_weight_multiplier** - Multiplier for subject weights (default: 1.0)
4. **room_weight_multiplier** - Multiplier for room weights (default: 1.0)
5. **conflict_resolution_strategy** - Strategy for resolving conflicts (default: "highest_weight")
6. **priority_threshold** - Minimum weight to be considered high priority (default: 60)

### Database Functions

#### `calculate_priority_score(section_id, subject_id, teacher_id, room_id)`
Calculates combined priority score for a schedule assignment.

**Returns:** `numeric` (0-100)

**Logic:**
- Retrieves individual weights from all four entities
- Applies multipliers from configuration
- Calculates weighted average: (section_weight * section_multiplier + subject_weight * subject_multiplier + teacher_weight * teacher_multiplier + room_weight * room_multiplier) / 4

#### `get_priority_tier(score)`
Returns priority tier for a score.

**Returns:** `text` ('high', 'medium', or 'low')

**Logic:**
- High: score >= threshold (default 60)
- Medium: score >= 40
- Low: score < 40

#### `update_priority_config(key, value, updated_by)`
Updates a priority configuration value.

**Returns:** `boolean`

**Access:** Only System Admin and Power Admin can update

---

## TypeScript Types

### Updated Interfaces

```typescript
export interface Teacher {
    id: string;
    profile_id: string;
    department: string;
    employment_type: EmploymentType;
    max_hours: number;
    current_load_percentage: number;
    is_active: boolean;
    weight: number;           // NEW
    priority_note: string | null;  // NEW
    created_at: string;
    updated_at: string;
    profile?: Profile;
}

export interface Subject {
    id: string;
    code: string;
    name: string;
    units: number;
    type: SubjectType;
    duration_hours: number;
    program: string;
    year_level: number;
    requires_lab: boolean;
    weight: number;           // NEW
    priority_note: string | null;  // NEW
    created_at: string;
}

export interface Room {
    id: string;
    name: string;
    capacity: number;
    type: RoomType;
    building: string;
    floor: number;
    equipment: string[];
    is_available: boolean;
    weight: number;           // NEW
    priority_note: string | null;  // NEW
    created_at: string;
}

export interface PriorityConfig {
    id: string;
    key: string;
    value: Record<string, unknown>;
    description: string | null;
    category: string;
    is_active: boolean;
    updated_by: string | null;
    updated_at: string;
    created_at: string;
}
```

**Files Updated:**
- `web/src/types/database.ts`
- `web/src/pages/admin/ScheduleGenerate/types.ts`
- `web/src/pages/admin/DataManagement.tsx` (local interfaces)

---

## UI Changes

### DataManagement Component

Updated the DataManagement page to support priority fields for rooms and subjects:

**Add Room Modal:**
- Added Weight input (0-100 for scheduling priority)
- Added Priority Note textarea (optional reason for priority)

**Add Subject Modal:**
- Added Weight input (0-100 for scheduling priority)
- Added Priority Note textarea (optional reason for priority)

**Edit Room Modal:**
- Added Weight input
- Added Priority Note textarea

**Edit Subject Modal:**
- Added Weight input
- Added Priority Note textarea

**Form State:**
- Updated `newRoom`, `editRoom`, `newSubject`, `editSubject` state to include weight and priority_note
- Fixed all reset calls to include new fields

---

## How to Use

### Setting Entity Priorities

1. **Navigate to Data Management** (Admin → Data Management)
2. **Select the appropriate tab** (Rooms or Subjects)
3. **Click "Add [Entity]"** to create a new entity
4. **Set the Weight** (0-100):
   - Higher values = scheduled first during conflict resolution
   - Default: 50 (medium priority)
   - 0-39: Low priority
   - 40-59: Medium priority
   - 60-100: High priority
5. **Add Priority Note** (optional):
   - Explain why this entity has high/low priority
   - Example: "Main computer lab, critical for all programming courses"

### Configuring Global Priority Settings

Access priority configuration directly in the database or create a UI:

```sql
-- Increase weight multiplier for sections
UPDATE public.priority_config
SET value = '{"multiplier": 1.5}'::jsonb
WHERE key = 'section_weight_multiplier';

-- Change conflict resolution strategy
UPDATE public.priority_config
SET value = '{"strategy": "balanced"}'::jsonb
WHERE key = 'conflict_resolution_strategy';

-- Adjust priority threshold
UPDATE public.priority_config
SET value = '{"threshold": 70}'::jsonb
WHERE key = 'priority_threshold';
```

### Using Priority Scores in Schedule Generation

The schedule generator can use the `calculate_priority_score` function:

```sql
-- Calculate priority score for a potential assignment
SELECT public.calculate_priority_score(
    'section-uuid',
    'subject-uuid',
    'teacher-uuid',
    'room-uuid'
) AS priority_score;

-- Get priority tier
SELECT public.get_priority_tier(75);  -- Returns 'high'
SELECT public.get_priority_tier(45);  -- Returns 'medium'
SELECT public.get_priority_tier(25);  -- Returns 'low'
```

### Example Priority Scenarios

**Scenario 1: Critical Laboratory**
```typescript
// Computer Lab room - highest priority
room.weight = 100;
room.priority_note = "Only lab capable of running specialized software";
```

**Scenario 2: Senior Faculty**
```typescript
// Senior professor - high priority
teacher.weight = 80;
teacher.priority_note = "Senior faculty with limited availability";
```

**Scenario 3: Core Subject**
```typescript
// Core programming subject - high priority
subject.weight = 75;
subject.priority_note = "Foundational course for all programs";
```

**Scenario 4: Large Section**
```typescript
// Large enrollment section - high priority
section.weight = 85;
section.priority_note = "100+ students, needs early scheduling";
```

---

## Integration Points

### Schedule Generator

Update the schedule generator to use priority scores:

1. **Calculate combined score** for each potential assignment
2. **Sort assignments by priority score** (highest first)
3. **Resolve conflicts** using configured strategy:
   - `highest_weight`: Give slot to highest priority
   - `earliest_slot`: Give slot to earliest available time
   - `balanced`: Balance between priority and availability

### Example Integration

```typescript
// In schedule engine
const priorityScore = await supabase.rpc('calculate_priority_score', {
    p_section_id: assignment.section.id,
    p_subject_id: assignment.subject.id,
    p_teacher_id: assignment.teacher.id,
    p_room_id: assignment.room.id
});

const priorityTier = await supabase.rpc('get_priority_tier', {
    p_score: priorityScore
});

// Use priority in conflict resolution
if (conflict) {
    if (priorityTier === 'high') {
        // Prioritize high-priority assignments
        // Try to resolve conflict in favor of this assignment
    }
}
```

---

## Migration Instructions

### For Existing Databases

Run migration `007_create_priority_system.sql`:
- Adds weight and priority_note columns to teachers, subjects, and rooms
- Existing records will have:
  - `weight = 50` (default medium priority)
  - `priority_note = NULL` (default)
- Creates priority_config table with default configurations
- No data loss - all existing data remains intact

### For Fresh Installations

The migration is included in the standard migration order:
1. Run `migrated/000_migration.sql` through `migrated/014_seed_real_data.sql`
2. Run root migrations `001` through `007`

---

## Testing Checklist

- [x] Migration runs without errors
- [x] Weight columns added to teachers, subjects, rooms
- [x] Priority notes columns added
- [x] Indexes created for priority queries
- [x] Priority config table created with defaults
- [x] Database functions work correctly
- [x] TypeScript types updated
- [x] UI forms display and save priority fields
- [x] Form state includes new fields
- [x] Reset calls include new fields
- [x] RLS policies allow appropriate access

---

## Best Practices

### Weight Assignment

- **0-39 (Low Priority):** Non-critical resources, backup options
- **40-59 (Medium Priority):** Standard resources, default priority
- **60-79 (High Priority):** Important resources, preferred scheduling
- **80-100 (Critical Priority):** Essential resources, must be scheduled early

### Priority Notes

- Always provide clear reasons for high/low priorities
- Include context (e.g., "Only lab with X equipment")
- Update notes when circumstances change
- Use consistent formatting for easy scanning

### Configuration Management

- Review multipliers periodically
- Adjust thresholds based on scheduling needs
- Document configuration changes
- Test changes in staging before production

---

## Performance Considerations

- Indexes on weight fields enable efficient priority-based queries
- Combined score calculation is STABLE (cachable)
- Priority config queries use partial indexes for active configs
- Consider caching priority scores for frequently accessed entities

---

## Next Steps

1. **Schedule Generator Integration** - Update schedule engine to use priority scores
2. **Priority Config UI** - Create admin UI for managing global configurations
3. **Priority Analytics** - Add reports on priority distribution
4. **Bulk Priority Updates** - Add ability to batch update priorities
5. **Priority Templates** - Create preset priority configurations for different semesters

---

## Notes

- Weight values are 0-100 for intuitive understanding
- Priority notes are optional but recommended for transparency
- Multipliers allow fine-tuning without modifying individual weights
- The implementation is backward compatible with existing data
- RLS ensures only admins can modify global configurations
