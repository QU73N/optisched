/**
 * Schedule Version Service
 * 
 * This service manages schedule versioning, publishing, and rollback operations.
 * All operations integrate with the canonical state manager for consistency.
 * 
 * Core Principles:
 * - Never overwrite data silently
 * - Never lose previous versions
 * - Every publish creates a new version
 * - Versions are immutable, only the "active" pointer changes
 * - All operations go through canonical state manager
 * - All operations are logged and verifiable
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Schedule } from '../types/database';
import { scheduleStateManager } from './scheduleStateManager';
import { scheduleValidation } from './scheduleValidation';
import { scheduleLogger } from './scheduleLogger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScheduleVersion {
    id: string;
    schedule_id: string;
    version_number: number;
    snapshot: Schedule;
    change_type: 'created' | 'updated' | 'deleted' | 'status_change' | 'checkpoint' | 'publish' | 'overwrite' | 'restore';
    change_summary: string;
    change_reason: string;
    state_hash: string;
    soft_score: number;
    conflict_count: number;
    changed_by: string;
    changed_at: string;
    previous_version_id: string | null;
    is_active: boolean;
}

export interface ScheduleVersionSet {
    id: string;
    name: string;
    description: string | null;
    academic_year: string;
    semester: string;
    is_published: boolean;
    is_active: boolean;
    created_by: string;
    created_at: string;
}

export interface VersionComparison {
    version_1_id: string;
    version_1_number: number;
    version_1_data: Schedule;
    version_2_id: string;
    version_2_number: number;
    version_2_data: Schedule;
    differences: Record<string, { before: unknown; after: unknown; changed: boolean }>;
}

export interface PublishResult {
    success: boolean;
    message: string;
    version_set_id: string | null;
    version_count: number;
    active_version_id: string | null;
    warnings?: string[];
}

export interface RestoreResult {
    success: boolean;
    message: string;
    restored_version_id: string | null;
    previous_active_version_id: string | null;
}

// ---------------------------------------------------------------------------
// Service Class
// ---------------------------------------------------------------------------

class ScheduleVersionService {
    private supabase: SupabaseClient | null = null;
    private currentUserId: string | null = null;

    /**
     * Initialize the version service
     */
    initialize(supabase: SupabaseClient, userId: string): void {
        this.supabase = supabase;
        this.currentUserId = userId;
        console.log('[VERSION SERVICE] Initialized');
    }

    /**
     * Check if there is an active published schedule
     */
    async hasActiveSchedule(): Promise<boolean> {
        if (!this.supabase) {
            throw new Error('Version service not initialized');
        }

        const { data } = await this.supabase
            .from('schedules')
            .select('id')
            .eq('status', 'published')
            .limit(1);

        return (data && data.length > 0) || false;
    }

    /**
     * Get the current active schedule summary
     */
    async getActiveScheduleSummary(): Promise<{
        exists: boolean;
        version?: string;
        timestamp?: string;
        sessionCount?: number;
        score?: number;
    } | null> {
        if (!this.supabase) {
            throw new Error('Version service not initialized');
        }

        const { data: schedules } = await this.supabase
            .from('schedules')
            .select('*')
            .eq('status', 'published')
            .order('updated_at', { ascending: false })
            .limit(1);

        if (!schedules || schedules.length === 0) {
            return { exists: false };
        }

        // Get the active version for this schedule
        const { data: activeVersion } = await this.supabase
            .rpc('get_active_schedule_version', { p_schedule_id: schedules[0].id });

        if (!activeVersion || activeVersion.length === 0) {
            return {
                exists: true,
                sessionCount: schedules.length,
            };
        }

        const version = activeVersion[0] as ScheduleVersion;

        return {
            exists: true,
            version: `v${version.version_number}`,
            timestamp: version.changed_at,
            sessionCount: schedules.length,
            score: version.soft_score || 0,
        };
    }

    /**
     * Publish a new schedule with overwrite protection
     * 
     * CRITICAL: This method uses a compensating transaction pattern.
     * If any step fails, we attempt to rollback partial changes.
     */
    async publishSchedule(
        schedules: Schedule[],
        options: {
            academic_year: string;
            semester: string;
            score?: number;
            conflictCount?: number;
            changeReason?: string;
            force?: boolean; // Skip confirmation if true
        }
    ): Promise<PublishResult> {
        if (!this.supabase || !this.currentUserId) {
            throw new Error('Version service not initialized');
        }

        const startTime = Date.now();
        scheduleLogger.system.workflowStarted('Schedule publish');

        // Track state for rollback
        let deletedScheduleIds: string[] = [];
        let insertedScheduleIds: string[] = [];
        let createdVersionSetId: string | null = null;
        const createdVersionIds: string[] = [];

        try {
            // Check for existing active schedule
            const hasActive = await this.hasActiveSchedule();
            
            if (hasActive && !options.force) {
                return {
                    success: false,
                    message: 'Confirmation required: Active schedule exists and will be overwritten',
                    version_set_id: null,
                    version_count: 0,
                    active_version_id: null,
                };
            }

            // CRITICAL: No-OP detection - check if new schedule is identical to current
            if (hasActive) {
                const { data: currentSchedules } = await this.supabase
                    .from('schedules')
                    .select('*')
                    .eq('status', 'published');
                
                if (currentSchedules && currentSchedules.length > 0) {
                    const currentHash = scheduleValidation.computeStateHash(currentSchedules);
                    const newHash = scheduleValidation.computeStateHash(schedules);
                    
                    if (currentHash === newHash) {
                        scheduleLogger.log({
                            tab: 'system',
                            level: 'warn',
                            category: 'persistence',
                            message: 'No-op detected: New schedule is identical to current',
                            data: { hash: currentHash },
                        });
                        return {
                            success: true,
                            message: 'Schedule is identical to current published version. No changes made.',
                            version_set_id: null,
                            version_count: 0,
                            active_version_id: null,
                        };
                    }
                }
            }

            // Capture current active schedule for versioning if exists
            let previousActiveVersionId: string | null = null;
            if (hasActive) {
                const { data: currentSchedules } = await this.supabase
                    .from('schedules')
                    .select('id')
                    .eq('status', 'published')
                    .limit(1);

                if (currentSchedules && currentSchedules.length > 0) {
                    deletedScheduleIds = currentSchedules.map(s => s.id);
                    
                    const { data: activeVersion } = await this.supabase
                        .rpc('get_active_schedule_version', { p_schedule_id: currentSchedules[0].id });
                    
                    if (activeVersion && activeVersion.length > 0) {
                        previousActiveVersionId = activeVersion[0].id;
                    }
                }
            }

            // Compute state hash for the new schedules
            const stateHash = scheduleValidation.computeStateHash(schedules);

            // Compensating transaction: Step 1 - Delete existing published schedules
            if (hasActive) {
                const { error: deleteError } = await this.supabase
                    .from('schedules')
                    .delete()
                    .eq('status', 'published');

                if (deleteError) throw deleteError;
                scheduleLogger.system.stepCompleted('Deleted existing published schedules');
            }

            // Step 2 - Insert new schedules
            const inserts = schedules.map(s => ({
                subject_id: s.subject_id,
                teacher_id: s.teacher_id,
                room_id: s.room_id,
                section_id: s.section_id,
                day_of_week: s.day_of_week,
                start_time: s.start_time,
                end_time: s.end_time,
                status: 'published',
                semester: options.semester,
                academic_year: options.academic_year,
            }));

            const { data: insertedSchedules, error: insertError } = await this.supabase
                .from('schedules')
                .insert(inserts)
                .select('id');

            if (insertError) {
                // ROLLBACK: Attempt to restore deleted schedules
                if (deletedScheduleIds.length > 0) {
                    scheduleLogger.system.error('generate', 'persistence', 'Insert failed, attempting rollback', insertError);
                    // Note: We cannot restore the exact data without having stored it first
                    // This is a limitation of the compensating transaction pattern
                    throw new Error(`Insert failed: ${insertError.message}. CRITICAL: Previous schedules were deleted and cannot be restored automatically.`);
                }
                throw insertError;
            }

            insertedScheduleIds = (insertedSchedules || []).map(s => s.id);
            scheduleLogger.system.stepCompleted(`Inserted ${insertedScheduleIds.length} new schedules`);

            // Step 3 - Create version set for this publish operation
            const { data: versionSet, error: versionSetError } = await this.supabase
                .rpc('create_schedule_version_set', {
                    p_name: `Schedule Publish ${new Date().toISOString()}`,
                    p_description: options.changeReason || 'Published new schedule',
                    p_academic_year: options.academic_year,
                    p_semester: options.semester,
                    p_is_published: true,
                    p_created_by: this.currentUserId,
                });

            if (versionSetError) {
                // ROLLBACK: Delete inserted schedules
                scheduleLogger.system.error('generate', 'persistence', 'Version set creation failed, rolling back schedules', versionSetError);
                await this.supabase.from('schedules').delete().in('id', insertedScheduleIds);
                throw new Error(`Version set creation failed: ${versionSetError.message}. Inserted schedules have been rolled back.`);
            }

            createdVersionSetId = versionSet;
            console.log(`[VERSION SERVICE] Created version set ${createdVersionSetId}`);

            // Step 4 - Create versions for each schedule
            for (const schedule of insertedSchedules || []) {
                const { data: version, error: versionError } = await this.supabase
                    .rpc('create_schedule_version', {
                        p_schedule_id: schedule.id,
                        p_change_type: hasActive ? 'overwrite' : 'publish',
                        p_change_summary: `${schedules.length} sessions published`,
                        p_change_reason: options.changeReason || 'Schedule publish',
                        p_state_hash: stateHash,
                        p_soft_score: options.score || 0,
                        p_conflict_count: options.conflictCount || 0,
                        p_changed_by: this.currentUserId,
                        p_previous_version_id: previousActiveVersionId,
                    });

                if (versionError) {
                    // ROLLBACK: Clean up
                    scheduleLogger.system.error('generate', 'persistence', 'Version creation failed, rolling back', versionError);
                    await this.supabase.from('schedule_versions').delete().in('id', createdVersionIds);
                    await this.supabase.from('schedule_version_sets').delete().eq('id', createdVersionSetId);
                    await this.supabase.from('schedules').delete().in('id', insertedScheduleIds);
                    throw new Error(`Version creation failed: ${versionError.message}. Partial changes have been rolled back.`);
                }

                if (version) {
                    createdVersionIds.push(version);
                    
                    // Add version to set
                    const { error: addToSetError } = await this.supabase.rpc('add_version_to_set', {
                        p_version_set_id: createdVersionSetId,
                        p_schedule_version_id: version,
                    });

                    if (addToSetError) {
                        scheduleLogger.system.error('generate', 'persistence', 'Failed to add version to set', addToSetError);
                        // Continue anyway - this is not critical
                    }

                    // Activate this version
                    await this.supabase.rpc('activate_schedule_version', {
                        p_version_id: version,
                    });
                }
            }

            console.log(`[VERSION SERVICE] Created ${createdVersionIds.length} schedule versions`);

            // CRITICAL: Verify single active version
            const { data: activeVersions } = await this.supabase
                .from('schedule_versions')
                .select('id')
                .eq('is_active', true);

            if (activeVersions && activeVersions.length > 1) {
                scheduleLogger.system.error('generate', 'persistence', 'CRITICAL: Multiple active versions detected', { count: activeVersions.length });
                // Deactivate all but the most recent
                const versionsToDeactivate = activeVersions.slice(0, -1);
                for (const vId of versionsToDeactivate) {
                    await this.supabase.from('schedule_versions').update({ is_active: false }).eq('id', vId);
                }
            }

            // Step 5 - Update canonical state manager
            const { data: finalSchedules } = await this.supabase
                .from('schedules')
                .select('*')
                .in('status', ['published', 'draft']);

            if (finalSchedules) {
                await scheduleStateManager.updateState(
                    finalSchedules,
                    'generate',
                    {
                        conflictCount: options.conflictCount || 0,
                        softScore: options.score || 0,
                        changeDescription: hasActive ? 'Overwrote published schedule' : 'Published new schedule',
                    }
                );

                scheduleLogger.system.stateSynced('version_service', finalSchedules.length);
            }

            // CRITICAL: Verify state hash after persistence
            const { data: verifiedSchedules } = await this.supabase
                .from('schedules')
                .select('*')
                .eq('status', 'published');

            if (!verifiedSchedules || verifiedSchedules.length !== schedules.length) {
                throw new Error('Persistence verification failed: Schedule count mismatch');
            }

            const verifiedHash = scheduleValidation.computeStateHash(verifiedSchedules);
            if (verifiedHash !== stateHash) {
                scheduleLogger.system.error('system', 'persistence', 'CRITICAL: State hash mismatch after persistence', {
                    expected: stateHash,
                    actual: verifiedHash,
                });
                throw new Error('Persistence verification failed: State hash mismatch - data may have been modified by database triggers');
            }

            // Note: Event publishing is handled automatically by scheduleStateManager.updateState above

            scheduleLogger.system.workflowCompleted('Schedule publish', Date.now() - startTime, true);
            if (createdVersionSetId) {
                scheduleLogger.generate.schedulePersisted(0, createdVersionSetId);
            }

            return {
                success: true,
                message: hasActive 
                    ? `Successfully overwrote previous schedule. Created ${createdVersionIds.length} versions.`
                    : `Successfully published schedule. Created ${createdVersionIds.length} versions.`,
                version_set_id: createdVersionSetId,
                version_count: createdVersionIds.length,
                active_version_id: createdVersionIds[0] || null,
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            scheduleLogger.system.error('generate', 'persistence', 'Schedule publish failed', error);
            scheduleLogger.system.workflowCompleted('Schedule publish', Date.now() - startTime, false);

            return {
                success: false,
                message: `Failed to publish schedule: ${errorMessage}`,
                version_set_id: null,
                version_count: 0,
                active_version_id: null,
                warnings: [errorMessage],
            };
        }
    }

    /**
     * Get version history for a schedule
     */
    async getVersionHistory(scheduleId: string): Promise<ScheduleVersion[]> {
        if (!this.supabase) {
            throw new Error('Version service not initialized');
        }

        const { data, error } = await this.supabase
            .from('schedule_versions')
            .select('*')
            .eq('schedule_id', scheduleId)
            .order('version_number', { ascending: false });

        if (error) throw error;

        return (data as ScheduleVersion[]) || [];
    }

    /**
     * Get all version sets (for the Schedules tab)
     */
    async getAllVersionSets(): Promise<ScheduleVersionSet[]> {
        if (!this.supabase) {
            throw new Error('Version service not initialized');
        }

        const { data, error } = await this.supabase
            .from('schedule_version_sets')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data as ScheduleVersionSet[]) || [];
    }

    /**
     * Get versions in a version set
     */
    async getVersionsInSet(versionSetId: string): Promise<ScheduleVersion[]> {
        if (!this.supabase) {
            throw new Error('Version service not initialized');
        }

        const { data, error } = await this.supabase
            .from('schedule_version_set_items')
            .select('schedule_versions(*)')
            .eq('version_set_id', versionSetId);

        if (error) throw error;

        // Flatten the nested schedule_versions arrays
        const versions: ScheduleVersion[] = [];
        if (data) {
            for (const item of data) {
                if (item.schedule_versions && Array.isArray(item.schedule_versions)) {
                    versions.push(...item.schedule_versions as ScheduleVersion[]);
                }
            }
        }
        return versions;
    }

    /**
     * Compare two versions
     */
    async compareVersions(versionId1: string, versionId2: string): Promise<VersionComparison | null> {
        if (!this.supabase) {
            throw new Error('Version service not initialized');
        }

        const { data, error } = await this.supabase
            .rpc('compare_schedule_versions', {
                p_version_id_1: versionId1,
                p_version_id_2: versionId2,
            });

        if (error) throw error;

        if (!data || data.length === 0) {
            return null;
        }

        const comparison = data[0] as {
            version_1_id: string;
            version_1_number: number;
            version_1_data: Schedule;
            version_2_id: string;
            version_2_number: number;
            version_2_data: Schedule;
            differences: Record<string, { before: unknown; after: unknown; changed: boolean }>;
        };
        return {
            version_1_id: comparison.version_1_id,
            version_1_number: comparison.version_1_number,
            version_1_data: comparison.version_1_data,
            version_2_id: comparison.version_2_id,
            version_2_number: comparison.version_2_number,
            version_2_data: comparison.version_2_data,
            differences: comparison.differences || {},
        };
    }

    /**
     * Restore a schedule version
     * 
     * CRITICAL: This method restores ALL schedules in the version set, not just one.
     * Uses compensating transaction pattern for safety.
     */
    async restoreVersion(
        versionId: string,
        options: {
            reason?: string;
            force?: boolean;
        }
    ): Promise<RestoreResult> {
        if (!this.supabase || !this.currentUserId) {
            throw new Error('Version service not initialized');
        }

        const startTime = Date.now();
        scheduleLogger.system.workflowStarted('Version restore');

        // Track state for rollback
        let deletedScheduleIds: string[] = [];
        const insertedScheduleIds: string[] = [];
        let createdVersionId: string | null = null;

        try {
            // Get the version to restore
            const { data: versionData, error: versionError } = await this.supabase
                .from('schedule_versions')
                .select('*')
                .eq('id', versionId)
                .single();

            if (versionError || !versionData) {
                throw new Error('Version not found');
            }

            // Get the version set containing this version
            const { data: versionSetItem } = await this.supabase
                .from('schedule_version_set_items')
                .select('version_set_id')
                .eq('schedule_version_id', versionId)
                .single();

            if (!versionSetItem) {
                throw new Error('Version not in a version set');
            }

            // Get all versions in the version set
            const { data: allVersionItems } = await this.supabase
                .from('schedule_version_set_items')
                .select('schedule_version_id')
                .eq('version_set_id', versionSetItem.version_set_id);

            if (!allVersionItems || allVersionItems.length === 0) {
                throw new Error('Version set is empty');
            }

            // Get all version data for the set
            const versionIds = allVersionItems.map(v => v.schedule_version_id);
            const { data: allVersions } = await this.supabase
                .from('schedule_versions')
                .select('*')
                .in('id', versionIds);

            if (!allVersions || allVersions.length === 0) {
                throw new Error('No version data found');
            }

            // Get current active versions
            const { data: currentActiveVersions } = await this.supabase
                .from('schedule_versions')
                .select('*')
                .eq('is_active', true);

            const previousActiveVersionIds = currentActiveVersions ? currentActiveVersions.map(v => v.id) : [];

            // Verify the version is not already active
            if (versionData.is_active) {
                return {
                    success: false,
                    message: 'This version is already active',
                    restored_version_id: versionId,
                    previous_active_version_id: previousActiveVersionIds[0] || null,
                };
            }

            // CRITICAL: No-OP detection - check if restoring to same state
            const currentHash = scheduleValidation.computeStateHash(
                currentActiveVersions ? currentActiveVersions.map(v => v.snapshot as Schedule) : []
            );
            const targetHash = scheduleValidation.computeStateHash(
                allVersions.map(v => v.snapshot as Schedule)
            );

            if (currentHash === targetHash && !options.force) {
                scheduleLogger.log({
                    tab: 'system',
                    level: 'warn',
                    category: 'persistence',
                    message: 'No-op detected: Target version state is identical to current',
                    data: { hash: currentHash },
                });
                return {
                    success: true,
                    message: 'Target version state is identical to current. No changes made.',
                    restored_version_id: versionId,
                    previous_active_version_id: previousActiveVersionIds[0] || null,
                };
            }

            // Compensating transaction: Step 1 - Delete current published schedules
            const { error: deleteError } = await this.supabase
                .from('schedules')
                .delete()
                .eq('status', 'published');

            if (deleteError) {
                throw new Error(`Failed to delete current schedules: ${deleteError.message}`);
            }

            deletedScheduleIds = currentActiveVersions ? currentActiveVersions.map(v => v.schedule_id) : [];
            console.log(`[VERSION SERVICE] Deleted ${deletedScheduleIds.length} current schedules`);

            // Step 2 - Restore all schedules from version snapshots
            const restoredSchedules: Schedule[] = [];
            for (const version of allVersions) {
                const snapshot = version.snapshot as Schedule;
                const { data: insertedSchedule, error: insertError } = await this.supabase
                    .from('schedules')
                    .insert({
                        subject_id: snapshot.subject_id,
                        teacher_id: snapshot.teacher_id,
                        room_id: snapshot.room_id,
                        section_id: snapshot.section_id,
                        day_of_week: snapshot.day_of_week,
                        start_time: snapshot.start_time,
                        end_time: snapshot.end_time,
                        status: 'published',
                        semester: snapshot.semester || '',
                        academic_year: snapshot.academic_year || '',
                    })
                    .select('id')
                    .single();

                if (insertError) {
                    // ROLLBACK: We cannot restore the deleted schedules without their data
                    throw new Error(`Failed to restore schedule: ${insertError.message}. CRITICAL: Current schedules were deleted and cannot be restored automatically.`);
                }

                if (insertedSchedule) {
                    insertedScheduleIds.push(insertedSchedule.id);
                    restoredSchedules.push({ ...snapshot, id: insertedSchedule.id });
                }
            }

            console.log(`[VERSION SERVICE] Restored ${insertedScheduleIds.length} schedules from version set`);

            // Step 3 - Create a new version for the restore operation
            const newStateHash = scheduleValidation.computeStateHash(restoredSchedules);
            const { data: newVersion, error: newVersionError } = await this.supabase
                .rpc('create_schedule_version', {
                    p_schedule_id: versionData.schedule_id,
                    p_change_type: 'restore',
                    p_change_summary: `Restored from version ${versionData.version_number}`,
                    p_change_reason: options.reason || 'Version restore',
                    p_state_hash: newStateHash,
                    p_soft_score: versionData.soft_score,
                    p_conflict_count: versionData.conflict_count,
                    p_changed_by: this.currentUserId,
                    p_previous_version_id: versionId,
                });

            if (newVersionError) {
                // ROLLBACK: Delete restored schedules
                await this.supabase.from('schedules').delete().in('id', insertedScheduleIds);
                throw new Error(`Failed to create restore version: ${newVersionError.message}. Restored schedules have been rolled back.`);
            }

            createdVersionId = newVersion;

            // Step 4 - Deactivate all previous active versions
            for (const prevId of previousActiveVersionIds) {
                await this.supabase.from('schedule_versions').update({ is_active: false }).eq('id', prevId);
            }

            // Step 5 - Activate the new restore version
            await this.supabase.rpc('activate_schedule_version', {
                p_version_id: createdVersionId,
            });

            // CRITICAL: Verify single active version
            const { data: activeVersions } = await this.supabase
                .from('schedule_versions')
                .select('id')
                .eq('is_active', true);

            if (activeVersions && activeVersions.length > 1) {
                scheduleLogger.system.error('system', 'persistence', 'CRITICAL: Multiple active versions detected after restore', { count: activeVersions.length });
                // Deactivate all but the most recent
                const versionsToDeactivate = activeVersions.slice(0, -1);
                for (const vId of versionsToDeactivate) {
                    await this.supabase.from('schedule_versions').update({ is_active: false }).eq('id', vId);
                }
            }

            // Step 6 - Update canonical state manager
            const { data: allSchedules } = await this.supabase
                .from('schedules')
                .select('*')
                .in('status', ['published', 'draft']);

            if (allSchedules) {
                await scheduleStateManager.updateState(
                    allSchedules,
                    'conflicts',
                    {
                        conflictCount: versionData.conflict_count,
                        softScore: versionData.soft_score,
                        changeDescription: `Restored version ${versionData.version_number}`,
                    }
                );
            }

            // CRITICAL: Verify state hash after restore
            const { data: verifiedSchedules } = await this.supabase
                .from('schedules')
                .select('*')
                .eq('status', 'published');

            if (!verifiedSchedules || verifiedSchedules.length !== restoredSchedules.length) {
                throw new Error('Restore verification failed: Schedule count mismatch');
            }

            const verifiedHash = scheduleValidation.computeStateHash(verifiedSchedules);
            if (verifiedHash !== newStateHash) {
                scheduleLogger.system.error('system', 'persistence', 'CRITICAL: State hash mismatch after restore', {
                    expected: newStateHash,
                    actual: verifiedHash,
                });
                throw new Error('Restore verification failed: State hash mismatch - data may have been modified by database triggers');
            }

            // Note: Event publishing is handled automatically by scheduleStateManager.updateState above

            scheduleLogger.system.workflowCompleted('Version restore', Date.now() - startTime, true);

            return {
                success: true,
                message: `Successfully restored version ${versionData.version_number}. Restored ${restoredSchedules.length} schedules.`,
                restored_version_id: createdVersionId,
                previous_active_version_id: previousActiveVersionIds[0] || null,
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            scheduleLogger.system.error('conflicts', 'repair', 'Version restore failed', error);
            scheduleLogger.system.workflowCompleted('Version restore', Date.now() - startTime, false);

            return {
                success: false,
                message: `Failed to restore version: ${errorMessage}`,
                restored_version_id: null,
                previous_active_version_id: null,
            };
        }
    }

    /**
     * Delete a version (if not active)
     */
    async deleteVersion(versionId: string): Promise<{ success: boolean; message: string }> {
        if (!this.supabase) {
            throw new Error('Version service not initialized');
        }

        try {
            // Check if version is active
            const { data: versionData, error: versionError } = await this.supabase
                .from('schedule_versions')
                .select('is_active')
                .eq('id', versionId)
                .single();

            if (versionError || !versionData) {
                throw new Error('Version not found');
            }

            if (versionData.is_active) {
                return {
                    success: false,
                    message: 'Cannot delete active version',
                };
            }

            // Delete the version
            const { error: deleteError } = await this.supabase
                .from('schedule_versions')
                .delete()
                .eq('id', versionId);

            if (deleteError) throw deleteError;

            scheduleLogger.system.stateSynced('version_service', 0);

            return {
                success: true,
                message: 'Version deleted successfully',
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                message: `Failed to delete version: ${errorMessage}`,
            };
        }
    }
}

// ---------------------------------------------------------------------------
// Export singleton instance
// ---------------------------------------------------------------------------

export const scheduleVersionService = new ScheduleVersionService();
