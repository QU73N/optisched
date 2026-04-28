# Section Hierarchy Implementation

**Status:** ✅ COMPLETED  
**Migration:** `005_create_section_hierarchy.sql`  
**Date:** April 28, 2026

---

## Overview

Implemented folder-style hierarchical grouping of sections with weights for scheduling priority and institutional structure (College → SHS → Grade → Programs). This addresses PRD §7.2 and §11.2.

---

## Database Changes

### New Columns Added to `sections` table

| Column | Type | Description |
|--------|------|-------------|
| `parent_id` | uuid (nullable) | Parent section ID for hierarchy (null for root nodes) |
| `weight` | integer (0-100) | Scheduling priority weight (higher = scheduled first) |
| `path` | text | Materialized path for efficient hierarchy queries (e.g., "uuid1/uuid2/uuid3") |
| `node_type` | enum ('group', 'section') | Node type: "group" for folders, "section" for actual student sections |
| `is_active` | boolean | Soft delete flag (inactive sections excluded from scheduling) |
| `description` | text (nullable) | Optional description for clarity |
| `metadata` | jsonb | Extensible JSONB for custom attributes |
| `sort_order` | integer | Display order within parent (for UI sorting) |

### Database Functions Created

1. **`update_section_path()`** - Trigger function to automatically maintain path field when parent changes
2. **`rebuild_section_paths(section_id)`** - Recursively rebuild paths for all descendants
3. **`get_section_level(section_id)`** - Returns hierarchy depth (level) of a section
4. **`get_section_descendants(section_id)`** - Returns all descendants of a section with level info
5. **`get_section_ancestors(section_id)`** - Returns all ancestors of a section with level info

### Indexes Created

- `ix_sections_parent_id` - For efficient parent lookups
- `ix_sections_path` - For path-based hierarchy queries
- `ix_sections_node_type` - For filtering by node type
- `ix_sections_weight` - For ordering by weight

### RLS Policies

- `sections_manage` - Schedule Managers can manage sections (full CRUD)
- `sections_read` - Teachers and Students can read active sections

---

## TypeScript Type Changes

### Updated Section Interface

```typescript
export interface Section {
    id: string;
    name: string;
    program: string;
    year_level: number;
    student_count: number;
    parent_id: string | null;
    weight: number;
    path: string;
    node_type: 'group' | 'section';
    is_active: boolean;
    description: string | null;
    metadata: Record<string, unknown>;
    sort_order: number;
    created_at: string;
}
```

**Files Updated:**
- `web/src/types/database.ts`
- `web/src/pages/admin/ScheduleGenerate/types.ts`
- `web/src/pages/admin/DataManagement.tsx`

---

## UI Changes

### DataManagement Component

Updated the Section management UI in `DataManagement.tsx` to support hierarchy:

**Add Section Modal:**
- Added Node Type selector (Section vs Group)
- Added Parent Section dropdown (with hierarchy-aware filtering)
- Added Weight input (0-100 for scheduling priority)
- Added Sort Order input (for display ordering)
- Added Description textarea (optional)

**Edit Section Modal:**
- Same fields as Add Section modal
- Parent dropdown excludes current section to prevent cycles
- All hierarchy fields editable

**Form State:**
- Updated `newSection` and `editSection` state to include all hierarchy fields
- Fixed TypeScript types to allow both 'group' and 'section' node types

---

## How to Use

### Creating a Hierarchy Structure

1. **Create Root Groups** (e.g., "College", "SHS")
   - Set Node Type: "group"
   - Set Parent: None (root level)
   - Set Weight: Higher for more important branches

2. **Create Sub-Groups** (e.g., "Grade 11", "Grade 12" under SHS)
   - Set Node Type: "group"
   - Set Parent: Select "SHS"
   - Set Weight: Higher for priority

3. **Create Program Groups** (e.g., "STEM 11", "ABM 11" under Grade 11)
   - Set Node Type: "group"
   - Set Parent: Select "Grade 11"
   - Set Weight: Based on program importance

4. **Create Actual Sections** (e.g., "STEM 11-A", "ABM 11-B")
   - Set Node Type: "section"
   - Set Parent: Select appropriate program group
   - Set Weight: Individual section priority
   - Fill in Program, Year Level, Student Count

### Example Hierarchy

```
STI College (group, weight=80)
├── SHS (group, weight=70, parent=STI College)
│   ├── Grade 11 (group, weight=60, parent=SHS)
│   │   ├── STEM 11 (group, weight=50, parent=Grade 11)
│   │   │   ├── STEM 11-A (section, weight=40, parent=STEM 11)
│   │   │   └── STEM 11-B (section, weight=40, parent=STEM 11)
│   │   └── ABM 11 (group, weight=50, parent=Grade 11)
│   │       ├── ABM 11-A (section, weight=40, parent=ABM 11)
│   │       └── ABM 11-B (section, weight=40, parent=ABM 11)
│   └── Grade 12 (group, weight=60, parent=SHS)
│       └── ... (similar structure)
└── College (group, weight=70, parent=STI College)
    └── ... (college programs)
```

### Using Database Functions

```sql
-- Get all descendants of a group
SELECT * FROM get_section_descendants('uuid-of-shs');

-- Get all ancestors of a section
SELECT * FROM get_section_ancestors('uuid-of-stem-11-a');

-- Get hierarchy level
SELECT get_section_level('uuid-of-stem-11-a');
-- Returns: 4 (STI College → SHS → Grade 11 → STEM 11 → STEM 11-A)
```

---

## Integration Points

### Schedule Generator (Future Work)

The schedule generator should be updated to:
1. Use `weight` field to prioritize sections during conflict resolution
2. Filter by `is_active = true` to exclude inactive sections
3. Use `path` to understand institutional structure for optimization
4. Only schedule actual sections (`node_type = 'section'`), not groups

### UI Enhancements (Future Work)

- Tree view for section hierarchy in DataManagement
- Expand/collapse functionality
- Drag-and-drop for reordering hierarchy
- Visual indicators for weight (color coding)
- Hierarchy breadcrumb navigation

---

## Migration Instructions

### For Existing Databases

Run migration `005_create_section_hierarchy.sql`:
- Adds new columns to existing sections table
- Existing sections will have:
  - `parent_id = NULL` (root level)
  - `weight = 50` (default)
  - `path = id::text` (materialized path)
  - `node_type = 'section'` (default)
  - `is_active = true` (default)
  - `description = NULL` (default)
  - `sort_order = 0` (default)
  - `metadata = {}` (default)

### For Fresh Installations

The migration is included in the standard migration order:
1. Run `migrated/000_migration.sql` through `migrated/014_seed_real_data.sql`
2. Run root migrations `001` through `005`

---

## Testing Checklist

- [x] Migration runs without errors
- [x] Existing sections migrate correctly with default values
- [x] New sections can be created with hierarchy fields
- [x] Parent-child relationships work correctly
- [x] Path is automatically maintained on parent changes
- [x] Database functions return correct results
- [x] UI forms display and save all hierarchy fields
- [x] TypeScript types are correct
- [x] RLS policies allow appropriate access

---

## Next Steps

1. **Update Schedule Generator** to use weights for priority scheduling
2. **Add Tree View UI** for better hierarchy visualization
3. **Add Drag-and-Drop** for easy hierarchy management
4. **Update Reports** to show hierarchy-based statistics
5. **Add Hierarchy Export/Import** for bulk operations

---

## Notes

- The `path` field uses materialized path pattern for efficient hierarchical queries
- Recursive path rebuild is triggered automatically when parent changes
- Soft delete via `is_active` allows recovery of deleted sections
- `node_type` distinguishes between organizational groups and actual student sections
- Weight values (0-100) provide flexible priority control
- The implementation is backward compatible with existing data
