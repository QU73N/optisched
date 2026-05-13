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
    console.log('[generationService] GET SYSTEM RULES START');
    const { data, error } = await supabase
        .from('system_rules')
        .select('*');

    if (error) {
        console.error('[generationService] GET SYSTEM RULES FAILED:', error);
        throw error;
    }
    console.log('[generationService] GET SYSTEM RULES SUCCESS:', { count: data?.length || 0 });
    return data || [];
}

/**
 * Get a specific system rule value
 * @param key - The rule key to fetch
 * @returns The rule value or null if not found
 */
export async function getRuleValue(key: string): Promise<unknown> {
    console.log('[generationService] GET RULE VALUE START:', { key });
    const { data, error } = await supabase
        .from('system_rules')
        .select('rule_value')
        .eq('rule_key', key)
        .maybeSingle();

    if (error) {
        console.error('[generationService] GET RULE VALUE FAILED:', error);
        throw error;
    }

    console.log('[generationService] GET RULE VALUE SUCCESS:', { found: !!data, value: data?.rule_value });
    return data?.rule_value ?? null;
}

/**
 * Get all system rules as a record
 * @returns Record of rule_key -> rule_value
 */
export async function getRulesAsRecord(): Promise<Record<string, unknown>> {
    console.log('[generationService] GET RULES AS RECORD START');
    const rules = await getSystemRules();
    const record: Record<string, unknown> = {};

    for (const rule of rules) {
        record[rule.rule_key] = rule.rule_value;
    }

    console.log('[generationService] GET RULES AS RECORD SUCCESS:', { count: Object.keys(record).length });
    return record;
}

export async function saveGenerationMetadata(input: SaveGenerationMetadataInput): Promise<string | null> {
    console.log('[generationService] SAVE GENERATION METADATA START:', {
        mode: input.mode,
        totalSessions: input.total_sessions,
        placedSessions: input.placed_sessions,
        score: input.score,
        status: input.status
    });
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
            .maybeSingle();

        if (error) {
            console.error('[generationService] SAVE GENERATION METADATA FAILED:', error);
            throw error;
        }
        console.log('[generationService] SAVE GENERATION METADATA SUCCESS:', { id: data?.id });
        return data?.id || null;
    } catch (error) {
        // Log error but don't fail generation
        console.error('[generationService] SAVE GENERATION METADATA ERROR:', error);
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
    console.log('[generationService] NOTIFY STUDENTS START:', { sectionIds: sectionIds.length, status, isUpdate });
    if (sectionIds.length === 0) {
        console.log('[generationService] NOTIFY STUDENTS: No sections to notify');
        return;
    }

    try {
        // Get all active students in the affected sections
        const { data: students, error: studentsError } = await supabase
            .from('students')
            .select('profile_id, section_id')
            .in('section_id', sectionIds)
            .eq('is_active', true);

        if (studentsError) {
            console.error('[generationService] NOTIFY STUDENTS: Failed to fetch students:', studentsError);
            return;
        }

        if (!students || students.length === 0) {
            console.log('[generationService] NOTIFY STUDENTS: No students found in sections');
            return; // No students to notify
        }

        console.log('[generationService] NOTIFY STUDENTS: Found students:', { count: students.length });

        // Group students by profile_id to avoid duplicate notifications
        const studentMap = new Map<string, string[]>();
        for (const student of students) {
            if (!studentMap.has(student.profile_id)) {
                studentMap.set(student.profile_id, []);
            }
            studentMap.get(student.profile_id)?.push(student.section_id);
        }

        console.log('[generationService] NOTIFY STUDENTS: Unique students to notify:', studentMap.size);

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
                console.error(`[generationService] NOTIFY STUDENTS: Failed for student ${profileId}:`, error);
            }
        });

        await Promise.all(notificationPromises);
        console.log(`[generationService] NOTIFY STUDENTS: Notified ${studentMap.size} students successfully`);
    } catch (error) {
        console.error('[generationService] NOTIFY STUDENTS: Error:', error);
    }
}

/**
 * Notify students when a schedule is published
 * @param sectionIds - Array of section IDs that were published
 */
export async function notifyStudentsOfSchedulePublication(sectionIds: string[]): Promise<void> {
    console.log('[generationService] NOTIFY PUBLICATION START:', { sectionIds: sectionIds.length });
    await notifyStudentsOfScheduleChanges(sectionIds, 'published', false);
}

