-- =====================================================================
-- Client Error Logs for Observability
-- Idempotent — safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.client_error_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.profiles(id) on delete set null,
    url text not null,
    message text not null,
    stack text,
    user_agent text,
    component_stack text,
    created_at timestamptz not null default now(),
    metadata jsonb default '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_client_error_logs_user_created
    ON client_error_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_client_error_logs_created
    ON client_error_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS ix_client_error_logs_message
    ON client_error_logs(message);

-- RLS: Any authenticated user can insert (for error reporting)
-- Only Power Admin/System Admin can read
ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_error_logs_insert ON public.client_error_logs;
CREATE POLICY client_error_logs_insert ON public.client_error_logs
    FOR INSERT WITH CHECK (auth.uid() is not null);

DROP POLICY IF EXISTS client_error_logs_read ON public.client_error_logs;
CREATE POLICY client_error_logs_read ON public.client_error_logs
    FOR SELECT USING (
        exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('power_admin','system_admin'))
    );

-- RPC for reporting errors
CREATE OR REPLACE FUNCTION public.report_client_error(
    p_url text,
    p_message text,
    p_stack text default null,
    p_user_agent text default null,
    p_component_stack text default null,
    p_metadata jsonb default '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    new_id uuid;
BEGIN
    INSERT INTO public.client_error_logs (
        user_id, url, message, stack, user_agent, component_stack, metadata
    ) VALUES (
        auth.uid(), p_url, p_message, p_stack, p_user_agent, p_component_stack, p_metadata
    ) RETURNING id INTO new_id;
    RETURN new_id;
END;
$$;
