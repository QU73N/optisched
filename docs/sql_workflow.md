# SQL Workflow for OptiSched

## Discipline

**Never edit existing SQL files.** Every database change creates a new file under `database/supabase/`.

## Naming Convention

Use the format: `YYYYMMDD_description.sql`

Examples:
- `20250128_create_governance_v2.sql`
- `20250130_create_power_admin_features.sql`
- `20250201_create_performance_indexes.sql`

## File Structure

All SQL files should be **idempotent** — safe to re-run multiple times.

Use these patterns:
```sql
-- Create table if not exists
CREATE TABLE IF NOT EXISTS public.example ( ... );

-- Drop policy if exists, then create
DROP POLICY IF EXISTS example_policy ON public.example;
CREATE POLICY example_policy ON public.example ...;

-- Create or replace function
CREATE OR REPLACE FUNCTION public.example() RETURNS ... AS $$ ... $$;
```

## Roll Forward Process

1. **Create new SQL file** with descriptive name in `database/supabase/`
2. **Write idempotent SQL** that can be safely re-run
3. **Test locally** (if using local Postgres) or in Supabase preview branch
4. **Run in Supabase SQL editor** on the target environment
5. **Verify** the changes work as expected
6. **Commit** the SQL file to version control
7. **Update CHANGELOG** with a brief description

## Categories of Changes

### Schema Changes
- New tables, columns, constraints
- Table modifications (use `ALTER TABLE IF EXISTS`)

### RLS Policies
- New policies or policy updates
- Always use `DROP POLICY IF EXISTS` before `CREATE POLICY`

### Functions & Triggers
- New RPC functions
- Triggers for data integrity
- Always use `CREATE OR REPLACE FUNCTION` and `DROP TRIGGER IF EXISTS`

### Indexes
- Performance improvements
- Use `CREATE INDEX IF NOT EXISTS`

### Data Migrations
- Seed data
- Data transformations
- Use `INSERT ... ON CONFLICT DO NOTHING` for idempotency

## Common Patterns

### New Table with RLS
```sql
CREATE TABLE IF NOT EXISTS public.example (
    id uuid primary key default gen_random_uuid(),
    -- columns
    created_at timestamptz not null default now()
);

ALTER TABLE public.example ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS example_select ON public.example;
CREATE POLICY example_select ON public.example
    FOR SELECT USING (auth.uid() is not null);
```

### New RPC Function
```sql
CREATE OR REPLACE FUNCTION public.example_rpc(p_param text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- logic
    RETURN jsonb_build_object('result', 'success');
END;
$$;
```

### Idempotent Data Insert
```sql
INSERT INTO public.example (key, value)
VALUES ('example', 'data')
ON CONFLICT (key) DO NOTHING;
```

## Rollback Strategy

If a change needs to be reverted:
1. Create a new SQL file with the rollback logic
2. Name it appropriately (e.g., `20250201_rollback_example_change.sql`)
3. Document the reason in the file header

## Notes

- All SQL files are tracked in version control
- The `migrated/` folder contains historical migrations (read-only)
- Active development goes directly into `database/supabase/`
