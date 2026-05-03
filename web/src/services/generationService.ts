import { supabase } from '../lib/supabase';
import { createNotification } from './notificationService';

export interface SystemRule {
    id: string;
    rule_key: string;
    rule_value: unknown;
    description: string | null;
    category: string;
    role_overrides: Record<string, unknown>;
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

/**
 * Get system rules for generation configuration
 * Uses system_rules table instead of institutional_policies
 */
export async function getSystemRules(): Promise<SystemRule[]> {
    const { data, error } = await supabase
        .from('system_rules')
        .select('*');

    if (error) throw error;
    return data || [];
}

/**
 * Get a specific system rule value
 * @param key - The rule key to fetch
 * @returns The rule value or null if not found
 */
export async function getRuleValue(key: string): Promise<unknown> {
    const { data, error } = await supabase
        .from('system_rules')
        .select('rule_value')
        .eq('rule_key', key)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // Not found, return null
            return null;
        }
        throw error;
    }

    return data?.rule_value ?? null;
}

/**
 * Get all system rules as a record
 * @returns Record of rule_key -> rule_value
 */
export async function getRulesAsRecord(): Promise<Record<string, unknown>> {
    const rules = await getSystemRules();
    const record: Record<string, unknown> = {};

    for (const rule of rules) {
        record[rule.rule_key] = rule.rule_value;
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

/**
 * Notify students in affected sections about schedule changes
 * @param sectionIds - Array of section IDs that were affected by the schedule change
 * @param status - The status of the schedule (draft, submitted, approved, published)
 * @param isUpdate - Whether this is an update to an existing schedule or a new one
 */
export async function notifyStudentsOfScheduleChanges(
    sectionIds: string[],
    status: 'draft' | 'submitted' | 'approved' | 'published',
    isUpdate: boolean = false
): Promise<void> {
    if (sectionIds.length === 0) return;

    try {
        // Get all active students in the affected sections
        const { data: students, error: studentsError } = await supabase
            .from('students')
            .select('profile_id, section_id')
            .in('section_id', sectionIds)
            .eq('is_active', true);

        if (studentsError) {
            console.error('Failed to fetch students for notification:', studentsError);
            return;
        }

        if (!students || students.length === 0) {
            return; // No students to notify
        }

        // Group students by profile_id to avoid duplicate notifications
        const studentMap = new Map<string, string[]>();
        for (const student of students) {
            if (!studentMap.has(student.profile_id)) {
                studentMap.set(student.profile_id, []);
            }
            studentMap.get(student.profile_id)?.push(student.section_id);
        }

        // Create notifications for each unique student
        const notificationPromises = Array.from(studentMap.entries()).map(async ([profileId, affectedSectionIds]) => {
            const action = isUpdate ? 'updated' : 'created';
            const statusLabel = status === 'published' ? 'published' : status;
            const title = `Schedule ${action}`;
            const message = `Your class schedule has been ${action} and is now ${statusLabel}. Check your schedule for the latest updates.`;
            const actionUrl = '/student/schedule';

            try {
                await createNotification(
                    profileId,
                    'schedule_change',
                    title,
                    message,
                    { section_ids: affectedSectionIds, status },
                    actionUrl,
                    168 // 7 days
                );
            } catch (error) {
                console.error(`Failed to create notification for student ${profileId}:`, error);
            }
        });

        await Promise.all(notificationPromises);
        console.log(`Notified ${studentMap.size} students of schedule changes`);
    } catch (error) {
        console.error('Failed to notify students of schedule changes:', error);
    }
}

/**
 * Notify students when a schedule is published
 * @param sectionIds - Array of section IDs that were published
 */
export async function notifyStudentsOfSchedulePublication(sectionIds: string[]): Promise<void> {
    await notifyStudentsOfScheduleChanges(sectionIds, 'published', false);
}

