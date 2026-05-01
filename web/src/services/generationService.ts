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
