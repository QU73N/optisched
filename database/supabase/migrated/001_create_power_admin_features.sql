-- =====================================================================
-- Power Admin Features: Backup Jobs, Emergency Overrides, Feature Flags
-- Idempotent — safe to re-run.
-- =====================================================================

-- ---------- 1. backup_jobs ----------
create table if not exists public.backup_jobs (
    id uuid primary key default gen_random_uuid(),
    kind text not null check (kind in ('full', 'schema', 'data', 'manual')),
    status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
    note text,
    file_path text,
    size_bytes bigint,
    created_by uuid references public.profiles(id) on delete set null,
    created_at timestamptz not null default now(),
    started_at timestamptz,
    finished_at timestamptz,
    error_message text
);
create index if not exists idx_backup_jobs_created_at on public.backup_jobs (created_at desc);
create index if not exists idx_backup_jobs_status on public.backup_jobs (status);

alter table public.backup_jobs enable row level security;
drop policy if exists backup_jobs_power_only on public.backup_jobs;
create policy backup_jobs_power_only on public.backup_jobs
    for all using (
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('power_admin','system_admin'))
    ) with check (
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('power_admin','system_admin'))
    );


-- ---------- 2. emergency_overrides ----------
create table if not exists public.emergency_overrides (
    id uuid primary key default gen_random_uuid(),
    kind text not null check (kind in ('disable_rate_limit','disable_idle_timeout','bypass_approval','maintenance_mode','custom')),
    reason text not null,
    payload jsonb not null default '{}'::jsonb,
    is_active boolean not null default true,
    activated_by uuid references public.profiles(id) on delete set null,
    activated_at timestamptz not null default now(),
    expires_at timestamptz,
    deactivated_by uuid references public.profiles(id) on delete set null,
    deactivated_at timestamptz
);
create index if not exists idx_overrides_active on public.emergency_overrides (is_active, expires_at);

alter table public.emergency_overrides enable row level security;
drop policy if exists overrides_power_only on public.emergency_overrides;
create policy overrides_power_only on public.emergency_overrides
    for all using (
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('power_admin','system_admin'))
    ) with check (
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('power_admin','system_admin'))
    );


-- ---------- 3. feature_flags ----------
create table if not exists public.feature_flags (
    key text primary key,
    label text not null,
    description text,
    enabled boolean not null default false,
    rollout_pct int not null default 0 check (rollout_pct between 0 and 100),
    audience text not null default 'all' check (audience in ('all','admin','teacher','student','beta')),
    updated_by uuid references public.profiles(id) on delete set null,
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create or replace function public.touch_feature_flags_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    new.updated_by = auth.uid();
    return new;
end$$;

drop trigger if exists trg_feature_flags_touch on public.feature_flags;
create trigger trg_feature_flags_touch before update on public.feature_flags
    for each row execute function public.touch_feature_flags_updated_at();

alter table public.feature_flags enable row level security;
drop policy if exists feature_flags_read on public.feature_flags;
create policy feature_flags_read on public.feature_flags
    for select using (auth.uid() is not null);

drop policy if exists feature_flags_write on public.feature_flags;
create policy feature_flags_write on public.feature_flags
    for all using (
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('power_admin','system_admin'))
    ) with check (
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('power_admin','system_admin'))
    );

-- Seed a few sensible defaults (idempotent)
insert into public.feature_flags (key, label, description, enabled, rollout_pct, audience)
values
    ('optibot_chat', 'OptiBot AI Chat', 'Enable the OptiBot floating AI assistant.', true, 100, 'all'),
    ('schedule_ai_chat', 'Schedule AI Chat', 'Enable Gemini-powered schedule chat for admins.', true, 100, 'admin'),
    ('csv_export', 'CSV Export', 'Allow users to export schedules and logs as CSV.', true, 100, 'all'),
    ('beta_dashboard_v3', 'Beta Dashboard v3', 'Roll out the redesigned dashboard to beta users.', false, 0, 'beta'),
    ('maintenance_banner', 'Maintenance Banner', 'Show the global maintenance banner.', false, 0, 'all')
on conflict (key) do nothing;
