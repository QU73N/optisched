import { supabase } from '../lib/supabase';

export interface InstitutionalPolicy {
    id: string;
    policy_key: string;
    policy_value: string;
    description: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface GenerationMetadata {
    attempt_count: number;
    start_time: Date;
    total_subjects: number;
    placed_subjects: number;
    best_score: number;
}

export interface SaveGenerationMetadataInput {
    config: Record<string, unknown>;
    scope: Record<string, unknown>;
    seed: number;
    priority_settings: Record<string, unknown>;
    constraint_settings: Record<string, unknown>;
    attempt_scores: Record<string, unknown>;
    final_schedule: Record<string, unknown> | null;
    total_sessions: number;
    placed_sessions: number;
    score: number;
    mode: string;
    partial_target: Record<string, unknown> | null;
    status: string;
    completed_at: Date | null;
    created_by: string | null;
}

export async function getInstitutionalPolicies(): Promise<InstitutionalPolicy[]> {
    const { data, error } = await supabase
        .from('institutional_policies')
        .select('*')
        .eq('is_active', true);

    if (error) throw error;
    return data || [];
}

export async function getPolicyValue(key: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('institutional_policies')
        .select('policy_value')
        .eq('policy_key', key)
        .eq('is_active', true)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // Not found, return null
            return null;
        }
        throw error;
    }

    return data?.policy_value || null;
}

export async function getPoliciesAsRecord(): Promise<Record<string, string>> {
    const policies = await getInstitutionalPolicies();
    const record: Record<string, string> = {};

    for (const policy of policies) {
        record[policy.policy_key] = policy.policy_value;
    }

    return record;
}

export async function saveGenerationMetadata(input: SaveGenerationMetadataInput): Promise<string | null> {
    try {
        const { data, error } = await supabase
            .from('generation_runs')
            .insert({
                config: input.config as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONB field requires any
                scope: input.scope as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONB field requires any
                seed: input.seed,
                priority_settings: input.priority_settings as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONB field requires any
                constraint_settings: input.constraint_settings as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONB field requires any
                attempt_scores: input.attempt_scores as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONB field requires any
                final_schedule: input.final_schedule as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONB field requires any
                total_sessions: input.total_sessions,
                placed_sessions: input.placed_sessions,
                score: input.score,
                mode: input.mode,
                partial_target: input.partial_target as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- JSONB field requires any
                status: input.status,
                completed_at: input.completed_at?.toISOString() || null,
                created_by: input.created_by,
            })
            .select('id')
            .single();

        if (error) throw error;
        return data?.id || null;
    } catch (error) {
        // Log error but don't fail generation
        console.error('Failed to save generation metadata:', error);
        return null;
    }
}
