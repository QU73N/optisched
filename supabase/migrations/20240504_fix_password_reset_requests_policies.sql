-- Ensure password reset requests are visible to admins and insertable from login screens.

create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);

alter table public.password_reset_requests enable row level security;

drop policy if exists "Anyone can insert password_reset_requests" on public.password_reset_requests;
create policy "Anyone can insert password_reset_requests"
on public.password_reset_requests
for insert
to anon, authenticated
with check (true);

drop policy if exists "Users can insert own password_reset_requests" on public.password_reset_requests;
create policy "Users can insert own password_reset_requests"
on public.password_reset_requests
for insert
to authenticated
with check (user_id is null or user_id = auth.uid());

drop policy if exists "Admins can view password_reset_requests" on public.password_reset_requests;
create policy "Admins can view password_reset_requests"
on public.password_reset_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
  )
);

drop policy if exists "Admins can update password_reset_requests" on public.password_reset_requests;
create policy "Admins can update password_reset_requests"
on public.password_reset_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager')
  )
);

create index if not exists idx_password_reset_requests_status_requested_at
on public.password_reset_requests (status, requested_at desc);
