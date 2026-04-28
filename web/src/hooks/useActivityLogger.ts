// useActivityLogger - lightweight wrapper that posts to user_activity_logs.
// Uses the log_activity RPC defined in create_governance_v2.sql.
// Called by AuthContext (login/logout), Layout (page_view), and ad-hoc by mutations.

import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { redactPii, redactErrorMessage } from '../utils/pii';

export type ActivityType =
    | 'login'
    | 'logout'
    | 'page_view'
    | 'mutation'
    | 'rls_denied'
    | 'ai_prompt'
    | 'error'
    | 'export'
    | 'admin_action';

export interface LogPayload {
    actionType: ActivityType;
    resource?: string;
    resourceId?: string | null;
    details?: Record<string, unknown>;
    success?: boolean;
    error?: string;
    durationMs?: number;
}

export async function logActivity(p: LogPayload): Promise<void> {
    try {
        await supabase.rpc('log_activity', {
            p_action_type: p.actionType,
            p_resource: p.resource ?? null,
            p_resource_id: p.resourceId ?? null,
            p_details: p.details ?? {},
            p_success: p.success ?? true,
            p_error: p.error ?? null,
            p_duration_ms: p.durationMs ?? null,
        });
    } catch {
        // Logging must never throw — silently swallow.
    }
}

export function useActivityLogger() {
    const log = useCallback((p: LogPayload) => logActivity(p), []);
    return { log };
}

// Convenience: log an audit entry (admin-tier only, server-enforced)
export async function logAudit(
    action: string,
    targetTable?: string,
    targetId?: string | null,
    details: Record<string, unknown> = {}
): Promise<void> {
    try {
        await supabase.rpc('log_audit', {
            p_action: action,
            p_target_table: targetTable ?? null,
            p_target_id: targetId ?? null,
            p_details: redactPii(details),
        });
    } catch (err) {
        console.warn('[logAudit] failed (will not retry):', err);
    }
}
