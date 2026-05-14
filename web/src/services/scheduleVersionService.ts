/**
 * Schedule Version Service
 * 
 * This service manages schedule versioning, publishing, and rollback operations.
 * All operations integrate with the canonical state manager for consistency.
 * 
 * Core Principles:
 * - Never overwrite data silently
 * - Never lose previous versions
 * - Status transitions (draft -> submitted -> approved -> published) change ONLY the status field, not create new versions
 * - Only creating a NEW set of schedules creates a new version (e.g., saveDraft, publishSchedule with new data)
 * - Versions are immutable, only the "active" pointer changes
 * - Only one schedule can be active at a time (is_active = true)
 * - All operations go through canonical state manager
 * - All operations are logged and verifiable
 */
/**
 * Version Workflow:
 * 1. saveDraft() - Creates new schedules and a new version (change_type: 'created')
 * 2. submitSchedule() - Changes status from 'draft' to 'submitted' (change_type: 'status_change')
 * 3. approveSchedule() - Changes status from 'submitted' to 'approved' (change_type: 'status_change')
 * 4. publishApprovedSchedule() - Changes status from 'approved' to 'published' (change_type: 'overwrite' or 'publish')
 * 5. unpublishSchedule() - Changes status from 'published' back to 'draft', version marked as inactive (becomes "previous")
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { scheduleValidation } from './scheduleValidation';
import { scheduleStateManager } from './scheduleStateManager';
import { scheduleLogger } from './scheduleLogger';
import { detectConflicts } from './conflictDetector';
import type { Schedule } from '../types/database';

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
            .eq('is_active', true)
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
            .eq('is_active', true)
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
     * Rollback to a previous schedule version
     * Reactivates the schedules from a previous batch version and deactivates the current active schedules
     */
    async rollbackToVersion(versionId: string): Promise<{ success: boolean; message: string }> {
        if (!this.supabase || !this.currentUserId) {
            throw new Error('Version service not initialized');
        }

        try {
            // Get the version details
            const { data: version, error: versionError } = await this.supabase
                .from('schedule_versions')
                .select('*')
                .eq('id', versionId)
                .single();

            if (versionError || !version) {
                return { success: false, message: 'Version not found' };
            }

            // Get the batch snapshot data from the version
            const snapshot = version.snapshot as Schedule[];
            if (!snapshot || snapshot.length === 0) {
                return { success: false, message: 'Version has no schedule data' };
            }

            // Get the batch_id from the version
            const batchId = version.batch_id;
            if (!batchId) {
                return { success: false, message: 'Version is not associated with a batch' };
            }

            // Deactivate currently active published schedules
            const { error: deactivateError } = await this.supabase
                .from('schedules')
                .update({ is_active: false })
                .eq('status', 'published')
                .eq('is_active', true);

            if (deactivateError) {
                return { success: false, message: `Failed to deactivate current schedules: ${deactivateError.message}` };
            }

            // Create a new batch for the rollback
            const { data: newBatch, error: newBatchError } = await this.supabase
                .rpc('create_schedule_batch', {
                    p_name: `Rollback Batch ${new Date().toISOString()}`,
                    p_description: `Rollback to version ${version.version_number}`,
                    p_academic_year: snapshot[0].academic_year || '2025-2026',
                    p_semester: snapshot[0].semester || '1st Semester',
                    p_created_by: this.currentUserId,
                });

            if (newBatchError) {
                // Rollback failed, try to reactivate current schedules
                await this.supabase
                    .from('schedules')
                    .update({ is_active: true })
                    .eq('status', 'published')
                    .eq('is_active', false);
                return { success: false, message: `Failed to create rollback batch: ${newBatchError.message}` };
            }

            // Insert the rollback schedules with new batch_id
            const inserts = snapshot.map(s => ({
                subject_id: s.subject_id,
                teacher_id: s.teacher_id,
                room_id: s.room_id,
                section_id: s.section_id,
                day_of_week: s.day_of_week,
                start_time: s.start_time,
                end_time: s.end_time,
                status: 'published',
                is_active: true,
                batch_id: newBatch, // Link to new rollback batch
                semester: s.semester || '1st Semester',
                academic_year: s.academic_year || '2025-2026',
                created_by: this.currentUserId,
            }));

            const { error: insertError } = await this.supabase
                .from('schedules')
                .insert(inserts);

            if (insertError) {
                // Rollback failed, try to reactivate current schedules and delete new batch
                await this.supabase
                    .from('schedules')
                    .update({ is_active: true })
                    .eq('status', 'published')
                    .eq('is_active', false);
                await this.supabase.from('schedule_batches').delete().eq('id', newBatch);
                return { success: false, message: `Failed to insert rollback schedules: ${insertError.message}` };
            }

            // Create a new version for the rollback operation
            const { data: rollbackVersion, error: rollbackVersionError } = await this.supabase
                .rpc('create_batch_version', {
                    p_batch_id: newBatch,
                    p_change_type: 'restore',
                    p_change_summary: 'Rollback to previous version',
                    p_change_reason: `Rolled back to version ${version.version_number}`,
                    p_state_hash: version.state_hash,
                    p_soft_score: version.soft_score,
                    p_conflict_count: version.conflict_count,
                    p_changed_by: this.currentUserId,
                    p_previous_version_id: versionId,
                });

            if (rollbackVersionError) {
                // Rollback failed, clean up
                await this.supabase
                    .from('schedules')
                    .delete()
                    .eq('batch_id', newBatch);
                await this.supabase.from('schedule_batches').delete().eq('id', newBatch);
                await this.supabase
                    .from('schedules')
                    .update({ is_active: true })
                    .eq('status', 'published')
                    .eq('is_active', false);
                return { success: false, message: `Failed to create rollback version: ${rollbackVersionError.message}` };
            }

            // Activate the new rollback batch
            await this.supabase
                .from('schedule_batches')
                .update({ is_active: true })
                .eq('id', newBatch);

            // Deactivate the previous batch
            if (batchId) {
                await this.supabase
                    .from('schedule_batches')
                    .update({ is_active: false })
                    .eq('id', batchId);
            }

            // Activate the rollback version
            await this.supabase
                .rpc('activate_batch_version', { p_version_id: rollbackVersion });

            // Rescan for conflicts after rollback
            const { data: rollbackSchedules } = await this.supabase
                .from('schedules')
                .select('*')
                .eq('batch_id', newBatch)
                .eq('is_active', true);

            let conflictCount = 0;
            if (rollbackSchedules && rollbackSchedules.length > 0) {
                const conflicts = detectConflicts(rollbackSchedules);
                conflictCount = conflicts.length;

                // Update the version with the actual conflict count
                await this.supabase
                    .from('schedule_versions')
                    .update({ conflict_count: conflictCount })
                    .eq('id', rollbackVersion);

                // Save conflicts to database
                if (conflicts.length > 0) {
                    await this.supabase.from('conflicts').insert(
                        conflicts.map(c => ({
                            schedule_a_id: c.scheduleAId,
                            schedule_b_id: c.scheduleBId,
                            type: c.type,
                            severity: c.severity,
                            description: c.description,
                            is_resolved: false,
                        }))
                    );
                }
            }

            scheduleLogger.system.workflowCompleted('Schedule rollback', Date.now(), true);
            return { success: true, message: `Successfully rolled back to version ${version.version_number} with ${conflictCount} conflicts` };
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            scheduleLogger.system.error('system', 'persistence', 'Rollback failed', error);
            return { success: false, message: `Rollback failed: ${msg}` };
        }
    }

    /**
     * Save a schedule as draft
     * 
     * Creates a draft version of the schedule without affecting published schedules.
     * Drafts are versioned and can be compared, but are not visible to students.
     */
    async saveDraft(
        schedules: Schedule[],
        options: {
            academic_year: string;
            semester: string;
            score?: number;
            conflictCount?: number;
            changeReason?: string;
        }
    ): Promise<PublishResult> {
        console.log('[scheduleVersionService] SAVE DRAFT START:', {
            scheduleCount: schedules.length,
            options
        });
        if (!this.supabase || !this.currentUserId) {
            throw new Error('Version service not initialized');
        }

        const startTime = Date.now();
        scheduleLogger.system.workflowStarted('Schedule save draft');

        let createdBatchId: string | null = null;
        let createdVersionId: string | null = null;
        let insertedScheduleIds: string[] = [];

        if (!schedules || schedules.length === 0) {
            console.warn('[scheduleVersionService] SAVE DRAFT: No schedules provided');
            return {
                success: false,
                message: 'No schedules provided to save. Draft cannot be empty.',
                version_set_id: null,
                version_count: 0,
                active_version_id: null,
                warnings: [],
            };
        }

        try {
            // Check for existing active drafts before creating new one
            const { data: existingDrafts } = await this.supabase
                .from('schedules')
                .select('batch_id, status, is_active')
                .eq('status', 'draft')
                .eq('is_active', true);

            console.log('[scheduleVersionService] SAVE DRAFT: Existing active drafts:', {
                count: existingDrafts?.length || 0,
                batchIds: [...new Set(existingDrafts?.map(d => d.batch_id) || [])]
            });

            // Check for active versions across all batches
            const { data: allActiveVersions } = await this.supabase
                .from('schedule_versions')
                .select('id, batch_id, is_active, change_type')
                .eq('is_active', true);

            console.log('[scheduleVersionService] SAVE DRAFT: All active versions before save:', {
                total: allActiveVersions?.length || 0,
                versions: allActiveVersions?.map(v => ({ id: v.id, batch_id: v.batch_id, change_type: v.change_type }))
            });

            // Compute state hash for the new schedules
            const stateHash = scheduleValidation.computeStateHash(schedules);
            console.log('[scheduleVersionService] SAVE DRAFT: State hash computed:', stateHash);

            // Step 1 - Create new batch for the draft
            const { data: newBatch, error: batchError } = await this.supabase
                .rpc('create_schedule_batch', {
                    p_name: `Draft Batch ${new Date().toISOString()}`,
                    p_description: options.changeReason || 'Draft schedule',
                    p_academic_year: options.academic_year,
                    p_semester: options.semester,
                    p_created_by: this.currentUserId,
                });

            if (batchError) {
                console.error('[scheduleVersionService] SAVE DRAFT: Failed to create batch:', batchError);
                throw new Error(`Failed to create batch: ${batchError.message}`);
            }

            createdBatchId = newBatch;
            console.log(`[scheduleVersionService] SAVE DRAFT: Created draft batch ${createdBatchId}`);

            // Step 2 - Deactivate existing draft schedules (keep only one active draft)
            console.log('[scheduleVersionService] SAVE DRAFT: Deactivating existing draft schedules');
            const { error: deactivateError } = await this.supabase
                .from('schedules')
                .update({ is_active: false })
                .eq('status', 'draft')
                .eq('is_active', true);

            if (deactivateError) {
                console.warn('[scheduleVersionService] SAVE DRAFT: Failed to deactivate previous drafts:', deactivateError);
                // Continue anyway
            } else {
                console.log('[scheduleVersionService] SAVE DRAFT: Existing drafts deactivated successfully');
            }

            // Step 3 - Insert new draft schedules with batch_id
            const inserts = schedules.map(s => ({
                subject_id: s.subject_id,
                teacher_id: s.teacher_id,
                room_id: s.room_id,
                section_id: s.section_id,
                day_of_week: s.day_of_week,
                start_time: s.start_time,
                end_time: s.end_time,
                status: 'draft',
                is_active: true,
                batch_id: createdBatchId,
                semester: options.semester,
                academic_year: options.academic_year,
                created_by: this.currentUserId,
            }));

            console.log('[scheduleVersionService] SAVE DRAFT: Inserting schedules:', { count: inserts.length });

            const { data: insertedSchedules, error: insertError } = await this.supabase
                .from('schedules')
                .insert(inserts)
                .select('id');

            if (insertError) {
                console.error('[scheduleVersionService] SAVE DRAFT: Insert failed:', insertError);
                // ROLLBACK: Clean up
                await this.supabase.from('schedule_batches').delete().eq('id', createdBatchId);
                throw new Error(`Insert failed: ${insertError.message}`);
            }

            insertedScheduleIds = (insertedSchedules || []).map(s => s.id);
            console.log(`[scheduleVersionService] SAVE DRAFT: Inserted ${insertedScheduleIds.length} draft schedules into batch ${createdBatchId}`);

            // Step 4 - Create batch-level version for the draft
            console.log('[scheduleVersionService] SAVE DRAFT: Creating batch version');
            const { data: version, error: versionError } = await this.supabase
                .rpc('create_batch_version', {
                    p_batch_id: createdBatchId,
                    p_change_type: 'created',
                    p_change_summary: `${schedules.length} sessions saved as draft`,
                    p_change_reason: options.changeReason || 'Draft save',
                    p_state_hash: stateHash,
                    p_soft_score: options.score || 0,
                    p_conflict_count: options.conflictCount || 0,
                    p_changed_by: this.currentUserId,
                    p_previous_version_id: null,
                });

            if (versionError) {
                console.error('[scheduleVersionService] SAVE DRAFT: Version creation failed:', versionError);
                // ROLLBACK: Clean up
                await this.supabase.from('schedules').delete().in('id', insertedScheduleIds);
                await this.supabase.from('schedule_batches').delete().eq('id', createdBatchId);
                throw new Error(`Version creation failed: ${versionError.message}. Partial changes have been rolled back.`);
            }

            createdVersionId = version;
            console.log(`[scheduleVersionService] SAVE DRAFT: Created draft version ${createdVersionId}`);

            // Step 5 - Activate the draft batch and version
            console.log('[scheduleVersionService] SAVE DRAFT: Activating batch and version');
            await this.supabase
                .from('schedule_batches')
                .update({ is_active: true })
                .eq('id', createdBatchId);
                
            await this.supabase
                .rpc('activate_batch_version', { p_version_id: createdVersionId });

            // CRITICAL: Verify state hash after persistence
            const { data: verifiedSchedules } = await this.supabase
                .from('schedules')
                .select('*')
                .eq('batch_id', createdBatchId)
                .eq('is_active', true);

            if (!verifiedSchedules || verifiedSchedules.length !== schedules.length) {
                console.error('[scheduleVersionService] SAVE DRAFT: Schedule count mismatch:', {
                    expected: schedules.length,
                    actual: verifiedSchedules?.length || 0,
                });
                scheduleLogger.system.error('system', 'persistence', 'Schedule count mismatch', {
                    expected: schedules.length,
                    actual: verifiedSchedules?.length || 0,
                });
                throw new Error(`Persistence verification failed: Schedule count mismatch (expected ${schedules.length}, got ${verifiedSchedules?.length || 0})`);
            }

            console.log('[scheduleVersionService] SAVE DRAFT: Schedule count verified:', verifiedSchedules.length);

            // NORMALIZE FETCHED DATA: Remove server-generated fields before hash comparison
            // The database INSERT adds id, created_at, updated_at fields not present in input
            const normalizedFetched = verifiedSchedules.map(s => ({
                subject_id: s.subject_id,
                teacher_id: s.teacher_id,
                room_id: s.room_id,
                section_id: s.section_id,
                day_of_week: s.day_of_week,
                start_time: s.start_time,
                end_time: s.end_time,
                status: s.status,
                is_active: s.is_active,
                batch_id: s.batch_id,
                semester: s.semester,
                academic_year: s.academic_year,
                created_by: s.created_by,
            }));

            const verifiedHash = scheduleValidation.computeStateHash(normalizedFetched as unknown as Schedule[]);
            console.log('[scheduleVersionService] SAVE DRAFT: Hash verification:', {
                expected: stateHash,
                actual: verifiedHash,
                scheduleCount: verifiedSchedules.length,
                inputScheduleCount: schedules.length,
            });
            
            if (verifiedHash !== stateHash) {
                // DETAILED DEBUGGING: Log field comparison to diagnose mismatch
                const debugInfo = {
                    inputCount: schedules.length,
                    fetchedCount: verifiedSchedules.length,
                    normalizedCount: normalizedFetched.length,
                    firstInputFields: schedules[0] ? Object.keys(schedules[0]).sort() : [],
                    firstFetchedFields: verifiedSchedules[0] ? Object.keys(verifiedSchedules[0]).sort() : [],
                    firstNormalizedFields: normalizedFetched[0] ? Object.keys(normalizedFetched[0]).sort() : [],
                };
                console.error('[scheduleVersionService] SAVE DRAFT: State hash mismatch:', debugInfo);
                scheduleLogger.system.error('system', 'persistence', 'State hash mismatch - data normalization debugging', debugInfo);
                throw new Error('Persistence verification failed: State hash mismatch after normalization');
            }

            console.log('[scheduleVersionService] SAVE DRAFT: Hash verified successfully');

            // Verify no duplicate active versions after save
            const { data: finalActiveVersions } = await this.supabase
                .from('schedule_versions')
                .select('id, batch_id, is_active, change_type')
                .eq('is_active', true);

            console.log('[scheduleVersionService] SAVE DRAFT: Final active versions:', {
                total: finalActiveVersions?.length || 0,
                versions: finalActiveVersions?.map(v => ({ id: v.id, batch_id: v.batch_id, change_type: v.change_type }))
            });

            if (finalActiveVersions && finalActiveVersions.length > 1) {
                console.error('[scheduleVersionService] SAVE DRAFT: WARNING - Multiple active versions detected!');
            }

            // Update canonical state manager
            if (verifiedSchedules) {
                const version = await scheduleStateManager.updateState(
                    verifiedSchedules,
                    'generate',
                    {
                        conflictCount: options.conflictCount || 0,
                        softScore: options.score || 0,
                        changeDescription: `Saved draft with ${verifiedSchedules.length} sessions`,
                    }
                );
                console.log(`[scheduleVersionService] SAVE DRAFT: State manager updated: ${version}`);
            }

            scheduleLogger.system.workflowCompleted('Schedule save draft', Date.now(), true);
            scheduleLogger.system.stateSynced('version_service', verifiedSchedules.length);

            return {
                success: true,
                message: `Successfully saved ${schedules.length} sessions as draft`,
                version_set_id: createdBatchId,
                version_count: 1,
                active_version_id: createdVersionId,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[scheduleVersionService] SAVE DRAFT: Error:', error);
            scheduleLogger.system.error('generate', 'persistence', 'Draft save failed', error);
            scheduleLogger.system.workflowCompleted('Schedule save draft', Date.now() - startTime, false);

            return {
                success: false,
                message: `Failed to save draft: ${errorMessage}`,
                version_set_id: null,
                version_count: 0,
                active_version_id: null,
                warnings: [errorMessage],
            };
        }
    }

    /**
     * Submit a draft schedule for approval
     * 
     * Transitions a draft schedule to 'submitted' status.
     * This creates a new version to track the status change.
     */
    async submitSchedule(
        batchId: string,
        options: {
            changeReason?: string;
        }
    ): Promise<PublishResult> {
        console.log('[scheduleVersionService] SUBMIT SCHEDULE START:', { batchId, options });
        if (!this.supabase || !this.currentUserId) {
            throw new Error('Version service not initialized');
        }

        const startTime = Date.now();
        scheduleLogger.system.workflowStarted('Schedule submit');

        try {
            // Get the draft batch
            const { data: batch, error: batchError } = await this.supabase
                .from('schedule_batches')
                .select('*')
                .eq('id', batchId)
                .single();

            if (batchError || !batch) {
                console.error('[scheduleVersionService] SUBMIT: Batch not found:', batchError);
                throw new Error('Draft batch not found');
            }

            console.log('[scheduleVersionService] SUBMIT: Batch found:', { id: batch.id, name: batch.name, status: batch.status });

            // Get the schedules in this batch
            const { data: schedules, error: schedulesError } = await this.supabase
                .from('schedules')
                .select('*')
                .eq('batch_id', batchId)
                .eq('is_active', true);

            if (schedulesError || !schedules) {
                console.error('[scheduleVersionService] SUBMIT: Failed to fetch schedules:', schedulesError);
                throw new Error('Failed to fetch schedules from batch');
            }

            console.log('[scheduleVersionService] SUBMIT: Schedules fetched:', { count: schedules.length, statuses: [...new Set(schedules.map(s => s.status))] });

            if (schedules.length === 0) {
                throw new Error('Cannot submit an empty schedule');
            }

            // Get the active version for this batch (if exists)
            const { data: activeVersion } = await this.supabase
                .rpc('get_active_batch_version', { p_batch_id: batchId });

            console.log('[scheduleVersionService] SUBMIT: Active version check:', {
                found: !!(activeVersion && activeVersion.length > 0),
                version: activeVersion && activeVersion.length > 0 ? { id: activeVersion[0].id, change_type: activeVersion[0].change_type, is_active: activeVersion[0].is_active } : null
            });

            // Use existing active version, otherwise promote latest existing version (no creation)
            let versionId: string | null = activeVersion && activeVersion.length > 0 ? activeVersion[0].id : null;

            if (!versionId) {
                const { data: latestVersion, error: latestError } = await this.supabase
                    .from('schedule_versions')
                    .select('id, is_active, change_type')
                    .eq('batch_id', batchId)
                    .order('changed_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (latestError) {
                    console.error('[scheduleVersionService] SUBMIT: Failed to find latest version:', latestError);
                    throw new Error(`Failed to find version for submit: ${latestError.message}`);
                }

                console.log('[scheduleVersionService] SUBMIT: Latest version found:', latestVersion);

                if (latestVersion?.id) {
                    versionId = latestVersion.id;
                    if (!latestVersion.is_active) {
                        console.log('[scheduleVersionService] SUBMIT: Activating latest version:', versionId);
                        await this.supabase
                            .from('schedule_versions')
                            .update({ is_active: true })
                            .eq('id', versionId);
                    }
                }
            }

            if (!versionId) {
                console.error('[scheduleVersionService] SUBMIT: No version exists for batch');
                throw new Error('No version exists for this draft batch; cannot submit without an existing version');
            }

            console.log('[scheduleVersionService] SUBMIT: Using version ID:', versionId);

            // Deactivate the old version before activating the new one
            await this.supabase
                .from('schedule_versions')
                .update({ is_active: false })
                .eq('batch_id', batchId)
                .eq('is_active', true);

            // Activate the new version
            await this.supabase
                .rpc('activate_batch_version', { p_version_id: versionId });

            console.log('[scheduleVersionService] SUBMIT: Version activated');

            // Check for duplicate active versions in this batch before update
            const { data: allVersions } = await this.supabase
                .from('schedule_versions')
                .select('id, is_active, change_type, changed_at')
                .eq('batch_id', batchId);

            console.log('[scheduleVersionService] SUBMIT: All versions in batch:', {
                total: allVersions?.length || 0,
                active: allVersions?.filter(v => v.is_active).length || 0,
                versions: allVersions?.map(v => ({ id: v.id, is_active: v.is_active, change_type: v.change_type }))
            });

            // Update schedules to submitted status
            console.log('[scheduleVersionService] SUBMIT: Updating schedules to submitted status');
            const { error: updateError } = await this.supabase
                .from('schedules')
                .update({
                    status: 'submitted',
                    submitted_at: new Date().toISOString(),
                })
                .eq('batch_id', batchId)
                .eq('is_active', true);

            if (updateError) {
                console.error('[scheduleVersionService] SUBMIT: Failed to update schedules:', updateError);
                throw new Error(`Failed to update status: ${updateError.message}`);
            }

            console.log('[scheduleVersionService] SUBMIT: Schedules updated successfully');

            // Update the version to reflect the status change
            // If we created a new version, update it; if we used an existing one, update that one
            console.log('[scheduleVersionService] SUBMIT: Updating version metadata to status_change');
            const { error: versionUpdateError } = await this.supabase
                .from('schedule_versions')
                .update({
                    change_type: 'status_change',
                    change_summary: 'Submitted for approval',
                    change_reason: options.changeReason || 'Schedule submission',
                    changed_by: this.currentUserId,
                    changed_at: new Date().toISOString(),
                })
                .eq('id', versionId);

            if (versionUpdateError) {
                console.error('[scheduleVersionService] SUBMIT: Version update failed, rolling back:', versionUpdateError);
                // ROLLBACK: Revert status back to draft
                await this.supabase
                    .from('schedules')
                    .update({ status: 'draft', submitted_at: null })
                    .eq('batch_id', batchId)
                    .eq('is_active', true);
                throw new Error(`Version update failed: ${versionUpdateError.message}. Status has been reverted.`);
            }

            console.log('[scheduleVersionService] SUBMIT: Version updated successfully');

            // Verify no duplicate active versions after update
            const { data: finalVersions } = await this.supabase
                .from('schedule_versions')
                .select('id, is_active, change_type')
                .eq('batch_id', batchId);

            console.log('[scheduleVersionService] SUBMIT: Final version state:', {
                total: finalVersions?.length || 0,
                active: finalVersions?.filter(v => v.is_active).length || 0,
                versions: finalVersions?.map(v => ({ id: v.id, is_active: v.is_active, change_type: v.change_type }))
            });

            if (finalVersions && finalVersions.filter(v => v.is_active).length > 1) {
                console.error('[scheduleVersionService] SUBMIT: WARNING - Multiple active versions detected!');
            }

            scheduleLogger.system.workflowCompleted('Schedule submit', Date.now(), true);

            return {
                success: true,
                message: `Successfully submitted ${schedules.length} sessions for approval`,
                version_set_id: batchId,
                version_count: 1,
                active_version_id: versionId,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[scheduleVersionService] SUBMIT: Error:', error);
            scheduleLogger.system.error('generate', 'persistence', 'Schedule submission failed', error);
            scheduleLogger.system.workflowCompleted('Schedule submit', Date.now() - startTime, false);

            return {
                success: false,
                message: `Failed to submit schedule: ${errorMessage}`,
                version_set_id: null,
                version_count: 0,
                active_version_id: null,
                warnings: [errorMessage],
            };
        }
    }

    /**
     * Approve a submitted schedule
     * Transitions a submitted schedule to 'approved' status.
     * Creates a new version for the status change.
     */
    async approveSchedule(
        batchId: string,
        options: { changeReason?: string } = {}
    ): Promise<PublishResult> {
        console.log('[scheduleVersionService] APPROVE SCHEDULE START:', { batchId, options });
        if (!this.supabase || !this.currentUserId) throw new Error('Version service not initialized');
        const startTime = Date.now();
        scheduleLogger.system.workflowStarted('Schedule approve');

        try {
            // Get active version (required)
            const { data: activeVersion } = await this.supabase.rpc('get_active_batch_version', { p_batch_id: batchId });
            if (!activeVersion || activeVersion.length === 0) {
                console.error('[scheduleVersionService] APPROVE: No active version found');
                throw new Error('No active version found');
            }

            console.log('[scheduleVersionService] APPROVE: Active version:', {
                id: activeVersion[0].id,
                change_type: activeVersion[0].change_type,
                is_active: activeVersion[0].is_active
            });

            // Get schedules
            console.log('[scheduleVersionService] APPROVE: Fetching schedules for batch:', batchId);
            const { data: schedules, error: schedulesError } = await this.supabase.from('schedules').select('*').eq('batch_id', batchId).eq('is_active', true);
            if (schedulesError) {
                console.error('[scheduleVersionService] APPROVE: Error fetching schedules:', schedulesError);
                throw new Error(`Failed to fetch schedules: ${schedulesError.message}`);
            }
            if (!schedules || schedules.length === 0) {
                console.error('[scheduleVersionService] APPROVE: No schedules found for batch:', batchId);
                // Try fetching all schedules in batch (even inactive) for debugging
                const { data: allSchedules } = await this.supabase.from('schedules').select('id, status, is_active').eq('batch_id', batchId);
                console.log('[scheduleVersionService] APPROVE: All schedules in batch:', allSchedules);
                throw new Error('Failed to fetch schedules: No active schedules found in batch');
            }

            console.log('[scheduleVersionService] APPROVE: Schedules fetched:', {
                count: schedules.length,
                statuses: [...new Set(schedules.map(s => s.status))]
            });

            // Check for duplicate active versions before update
            const { data: allVersions } = await this.supabase
                .from('schedule_versions')
                .select('id, is_active, change_type')
                .eq('batch_id', batchId);

            console.log('[scheduleVersionService] APPROVE: All versions in batch before update:', {
                total: allVersions?.length || 0,
                active: allVersions?.filter(v => v.is_active).length || 0,
                versions: allVersions?.map(v => ({ id: v.id, is_active: v.is_active, change_type: v.change_type }))
            });

            // Update schedules
            console.log('[scheduleVersionService] APPROVE: Updating schedules to approved status');
            const { error: updateError } = await this.supabase.from('schedules')
                .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: this.currentUserId })
                .eq('batch_id', batchId).eq('is_active', true);
            if (updateError) {
                console.error('[scheduleVersionService] APPROVE: Failed to update schedules:', updateError);
                throw updateError;
            }

            console.log('[scheduleVersionService] APPROVE: Schedules updated successfully');

            // Update the existing active version to reflect the status change
            // Instead of creating a new version, we update the current version's metadata
            console.log('[scheduleVersionService] APPROVE: Updating version metadata to status_change');
            const { error: versionUpdateError } = await this.supabase
                .from('schedule_versions')
                .update({
                    change_type: 'status_change',
                    change_summary: 'Approved for publishing',
                    change_reason: options.changeReason || 'Schedule approval',
                    changed_by: this.currentUserId,
                    changed_at: new Date().toISOString(),
                })
                .eq('id', activeVersion[0].id);

            if (versionUpdateError) {
                console.error('[scheduleVersionService] APPROVE: Version update failed, rolling back:', versionUpdateError);
                // Rollback
                await this.supabase.from('schedules').update({ status: 'submitted', approved_at: null, approved_by: null }).eq('batch_id', batchId).eq('is_active', true);
                throw new Error(`Version update failed: ${versionUpdateError.message}. Status has been reverted.`);
            }

            console.log('[scheduleVersionService] APPROVE: Version updated successfully');

            // Verify no duplicate active versions after update
            const { data: finalVersions } = await this.supabase
                .from('schedule_versions')
                .select('id, is_active, change_type')
                .eq('batch_id', batchId);

            console.log('[scheduleVersionService] APPROVE: Final version state:', {
                total: finalVersions?.length || 0,
                active: finalVersions?.filter(v => v.is_active).length || 0,
                versions: finalVersions?.map(v => ({ id: v.id, is_active: v.is_active, change_type: v.change_type }))
            });

            if (finalVersions && finalVersions.filter(v => v.is_active).length > 1) {
                console.error('[scheduleVersionService] APPROVE: WARNING - Multiple active versions detected!');
            }

            scheduleLogger.system.workflowCompleted('Schedule approve', Date.now(), true);
            return { success: true, message: 'Schedule approved successfully', version_set_id: batchId, version_count: 1, active_version_id: activeVersion[0].id };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[scheduleVersionService] APPROVE: Error:', error);
            scheduleLogger.system.error('generate', 'persistence', 'Schedule approval failed', error);
            scheduleLogger.system.workflowCompleted('Schedule approve', Date.now() - startTime, false);
            return { success: false, message: errorMessage, version_set_id: null, version_count: 0, active_version_id: null, warnings: [] };
        }
    }

    /**
     * Publish an approved schedule
     * Transitions an approved schedule to 'published' status.
     * Deactivates existing published schedules.
     */
    async publishApprovedSchedule(
        batchId: string,
        options: { changeReason?: string } = {}
    ): Promise<PublishResult> {
        console.log('[scheduleVersionService] PUBLISH APPROVED SCHEDULE START:', { batchId, options });
        if (!this.supabase || !this.currentUserId) throw new Error('Version service not initialized');
        const startTime = Date.now();
        scheduleLogger.system.workflowStarted('Schedule publish');
        
        try {
            // Check if there's an active published schedule
            const hasActive = await this.hasActiveSchedule();
            console.log('[scheduleVersionService] PUBLISH: Has active published schedule:', hasActive);

            // Deactivate existing published schedules (but not archived ones)
            if (hasActive) {
                console.log('[scheduleVersionService] PUBLISH: Deactivating existing published schedules');
                await this.supabase.from('schedules').update({ is_active: false }).eq('status', 'published').eq('is_active', true).neq('status', 'archived');

                // Deactivate ALL old active versions from other batches (not just publish/overwrite/restore)
                // This ensures status_change versions are also deactivated
                // But exclude archived versions
                console.log('[scheduleVersionService] PUBLISH: Deactivating old active versions from other batches');
                await this.supabase.from('schedule_versions')
                    .update({ is_active: false })
                    .neq('batch_id', batchId)
                    .eq('is_active', true)
                    .or('change_type.neq.status_change,change_summary.neq.Version archived');
            }

            // Get active version
            const { data: activeVersion } = await this.supabase.rpc('get_active_batch_version', { p_batch_id: batchId });
            if (!activeVersion || activeVersion.length === 0) {
                console.error('[scheduleVersionService] PUBLISH: No active version found');
                throw new Error('No active version found');
            }

            console.log('[scheduleVersionService] PUBLISH: Active version:', {
                id: activeVersion[0].id,
                change_type: activeVersion[0].change_type,
                is_active: activeVersion[0].is_active
            });

            // Get schedules
            console.log('[scheduleVersionService] PUBLISH: Fetching schedules for batch:', batchId);
            const { data: schedules, error: schedulesError } = await this.supabase.from('schedules').select('*').eq('batch_id', batchId).eq('is_active', true);
            if (schedulesError) {
                console.error('[scheduleVersionService] PUBLISH: Error fetching schedules:', schedulesError);
                throw new Error(`Failed to fetch schedules: ${schedulesError.message}`);
            }
            if (!schedules || schedules.length === 0) {
                console.error('[scheduleVersionService] PUBLISH: No schedules found for batch:', batchId);
                // Try fetching all schedules in batch (even inactive) for debugging
                const { data: allSchedules } = await this.supabase.from('schedules').select('id, status, is_active').eq('batch_id', batchId);
                console.log('[scheduleVersionService] PUBLISH: All schedules in batch:', allSchedules);
                throw new Error('Failed to fetch schedules: No active schedules found in batch');
            }

            console.log('[scheduleVersionService] PUBLISH: Schedules fetched:', {
                count: schedules.length,
                statuses: [...new Set(schedules.map(s => s.status))]
            });

            // Check for duplicate active versions before update
            const { data: allVersions } = await this.supabase
                .from('schedule_versions')
                .select('id, is_active, change_type')
                .eq('batch_id', batchId);

            console.log('[scheduleVersionService] PUBLISH: All versions in batch before update:', {
                total: allVersions?.length || 0,
                active: allVersions?.filter(v => v.is_active).length || 0,
                versions: allVersions?.map(v => ({ id: v.id, is_active: v.is_active, change_type: v.change_type }))
            });

            // Update schedules
            console.log('[scheduleVersionService] PUBLISH: Updating schedules to published status');
            const { error: updateError } = await this.supabase.from('schedules')
                .update({ status: 'published' })
                .eq('batch_id', batchId).eq('is_active', true);
            if (updateError) {
                console.error('[scheduleVersionService] PUBLISH: Failed to update schedules:', updateError);
                throw updateError;
            }

            console.log('[scheduleVersionService] PUBLISH: Schedules updated successfully');

            // Update the existing active version to reflect the status change
            // Instead of creating a new version, we update the current version's metadata
            const newChangeType = hasActive ? 'overwrite' : 'publish';
            console.log('[scheduleVersionService] PUBLISH: Updating version metadata to', newChangeType);
            const { error: versionUpdateError } = await this.supabase
                .from('schedule_versions')
                .update({
                    change_type: newChangeType,
                    change_summary: 'Published schedule',
                    change_reason: options.changeReason || 'Publish approved schedule',
                    changed_by: this.currentUserId,
                    changed_at: new Date().toISOString(),
                })
                .eq('id', activeVersion[0].id);

            if (versionUpdateError) {
                console.error('[scheduleVersionService] PUBLISH: Version update failed, rolling back:', versionUpdateError);
                // Rollback
                await this.supabase.from('schedules').update({ status: 'approved' }).eq('batch_id', batchId).eq('is_active', true);
                throw new Error(`Version update failed: ${versionUpdateError.message}. Status has been reverted.`);
            }

            console.log('[scheduleVersionService] PUBLISH: Version updated successfully');
            
            // Activate the batch
            console.log('[scheduleVersionService] PUBLISH: Activating batch');
            await this.supabase.from('schedule_batches').update({ is_active: true }).eq('id', batchId);

            // Verify no duplicate active versions after update
            const { data: finalVersions } = await this.supabase
                .from('schedule_versions')
                .select('id, is_active, change_type')
                .eq('batch_id', batchId);

            console.log('[scheduleVersionService] PUBLISH: Final version state:', {
                total: finalVersions?.length || 0,
                active: finalVersions?.filter(v => v.is_active).length || 0,
                versions: finalVersions?.map(v => ({ id: v.id, is_active: v.is_active, change_type: v.change_type }))
            });

            if (finalVersions && finalVersions.filter(v => v.is_active).length > 1) {
                console.error('[scheduleVersionService] PUBLISH: WARNING - Multiple active versions detected!');
            }

            // Verify global active versions (across all batches)
            const { data: globalActiveVersions } = await this.supabase
                .from('schedule_versions')
                .select('id, batch_id, is_active, change_type')
                .eq('is_active', true);

            console.log('[scheduleVersionService] PUBLISH: Global active versions:', {
                total: globalActiveVersions?.length || 0,
                versions: globalActiveVersions?.map(v => ({ id: v.id, batch_id: v.batch_id, change_type: v.change_type }))
            });

            if (globalActiveVersions && globalActiveVersions.length > 1) {
                console.error('[scheduleVersionService] PUBLISH: WARNING - Multiple active versions across all batches!');
            }
            
            scheduleLogger.system.workflowCompleted('Schedule publish', Date.now(), true);
            return { success: true, message: 'Schedule published successfully', version_set_id: batchId, version_count: 1, active_version_id: activeVersion[0].id };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[scheduleVersionService] PUBLISH: Error:', error);
            scheduleLogger.system.error('generate', 'persistence', 'Schedule publish failed', error);
            scheduleLogger.system.workflowCompleted('Schedule publish', Date.now() - startTime, false);
            return { success: false, message: errorMessage, version_set_id: null, version_count: 0, active_version_id: null, warnings: [] };
        }
    }

    /**
     * Unpublish a published schedule
     * Transitions a published schedule back to 'draft' status.
     * The version is marked as inactive and becomes a "previous" version.
     */
    async unpublishSchedule(
        batchId: string,
        options: { changeReason?: string } = {}
    ): Promise<PublishResult> {
        console.log('[scheduleVersionService] UNPUBLISH SCHEDULE START:', { batchId, options });
        if (!this.supabase || !this.currentUserId) throw new Error('Version service not initialized');
        const startTime = Date.now();
        scheduleLogger.system.workflowStarted('Schedule unpublish');
        
        try {
            // Get active version
            const { data: activeVersion } = await this.supabase.rpc('get_active_batch_version', { p_batch_id: batchId });
            if (!activeVersion || activeVersion.length === 0) {
                console.error('[scheduleVersionService] UNPUBLISH: No active version found');
                throw new Error('No active version found');
            }

            console.log('[scheduleVersionService] UNPUBLISH: Active version:', {
                id: activeVersion[0].id,
                change_type: activeVersion[0].change_type,
                is_active: activeVersion[0].is_active
            });

            // Get schedules
            const { data: schedules } = await this.supabase.from('schedules').select('*').eq('batch_id', batchId).eq('is_active', true);
            if (!schedules) {
                console.error('[scheduleVersionService] UNPUBLISH: Failed to fetch schedules');
                throw new Error('Failed to fetch schedules');
            }

            console.log('[scheduleVersionService] UNPUBLISH: Schedules fetched:', {
                count: schedules.length,
                statuses: [...new Set(schedules.map(s => s.status))]
            });

            // Check for duplicate active versions before update
            const { data: allVersions } = await this.supabase
                .from('schedule_versions')
                .select('id, is_active, change_type')
                .eq('batch_id', batchId);

            console.log('[scheduleVersionService] UNPUBLISH: All versions in batch before update:', {
                total: allVersions?.length || 0,
                active: allVersions?.filter(v => v.is_active).length || 0,
                versions: allVersions?.map(v => ({ id: v.id, is_active: v.is_active, change_type: v.change_type }))
            });

            // Update schedules back to draft status (but not archived ones)
            console.log('[scheduleVersionService] UNPUBLISH: Updating schedules to draft status');
            const { error: updateError } = await this.supabase.from('schedules')
                .update({ status: 'draft', published_at: null })
                .eq('batch_id', batchId).eq('is_active', true).neq('status', 'archived');
            if (updateError) {
                console.error('[scheduleVersionService] UNPUBLISH: Failed to update schedules:', updateError);
                throw new Error;
            }

            console.log('[scheduleVersionService] UNPUBLISH: Schedules updated successfully');

            // Update the existing active version to mark it as inactive (becomes "previous")
            // But only if it's not already archived
            if (activeVersion[0].change_type !== 'status_change' || activeVersion[0].change_summary !== 'Version archived') {
                console.log('[scheduleVersionService] UNPUBLISH: Marking version as inactive');
                const { error: versionUpdateError } = await this.supabase
                    .from('schedule_versions')
                    .update({
                        is_active: false, // Mark as inactive so it shows as "previous"
                        change_summary: 'Unpublished schedule (now previous)',
                        change_reason: options.changeReason || 'Schedule unpublish',
                        changed_by: this.currentUserId,
                        changed_at: new Date().toISOString(),
                    })
                    .eq('id', activeVersion[0].id);

                if (versionUpdateError) {
                    console.error('[scheduleVersionService] UNPUBLISH: Version update failed, rolling back:', versionUpdateError);
                    // Rollback
                    await this.supabase.from('schedules').update({ status: 'published' }).eq('batch_id', batchId).eq('is_active', true);
                    throw new Error(`Version update failed: ${versionUpdateError.message}. Status has been reverted.`);
                }
            } else {
                console.log('[scheduleVersionService] UNPUBLISH: Skipping version update - version is already archived');
            }

            console.log('[scheduleVersionService] UNPUBLISH: Version marked as inactive successfully');

            // Verify no duplicate active versions after update
            const { data: finalVersions } = await this.supabase
                .from('schedule_versions')
                .select('id, is_active, change_type')
                .eq('batch_id', batchId);

            console.log('[scheduleVersionService] UNPUBLISH: Final version state:', {
                total: finalVersions?.length || 0,
                active: finalVersions?.filter(v => v.is_active).length || 0,
                versions: finalVersions?.map(v => ({ id: v.id, is_active: v.is_active, change_type: v.change_type }))
            });

            if (finalVersions && finalVersions.filter(v => v.is_active).length > 0) {
                console.error('[scheduleVersionService] UNPUBLISH: WARNING - Active versions still exist after unpublish!');
            }
            
            scheduleLogger.system.workflowCompleted('Schedule unpublish', Date.now(), true);
            return { success: true, message: 'Schedule unpublished successfully (now marked as previous)', version_set_id: batchId, version_count: 1, active_version_id: activeVersion[0].id };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[scheduleVersionService] UNPUBLISH: Error:', error);
            scheduleLogger.system.error('generate', 'persistence', 'Schedule unpublish failed', error);
            scheduleLogger.system.workflowCompleted('Schedule unpublish', Date.now() - startTime, false);
            return { success: false, message: errorMessage, version_set_id: null, version_count: 0, active_version_id: null, warnings: [] };
        }
    }

    /**
     * Publish a new schedule with overwrite protection
     * 
     * CRITICAL: This method now uses batch-level versioning.
     * All schedule entries in the batch share the same batch_id and are versioned together.
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
        let previousBatchId: string | null = null;
        let insertedScheduleIds: string[] = [];
        let createdBatchId: string | null = null;
        let createdVersionId: string | null = null;

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
                    .eq('status', 'published')
                    .eq('is_active', true);
                
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

            // Capture current active batch for versioning if exists
            let previousActiveVersionId: string | null = null;
            if (hasActive) {
                const { data: currentSchedules } = await this.supabase
                    .from('schedules')
                    .select('id, batch_id')
                    .eq('status', 'published')
                    .eq('is_active', true)
                    .limit(1);

                if (currentSchedules && currentSchedules.length > 0) {
                    previousBatchId = currentSchedules[0].batch_id;
                    
                    // Get the active version for this batch
                    if (previousBatchId) {
                        const { data: activeVersion } = await this.supabase
                            .rpc('get_active_batch_version', { p_batch_id: previousBatchId });
                        
                        if (activeVersion && activeVersion.length > 0) {
                            previousActiveVersionId = activeVersion[0].id;
                        }
                    }
                }
            }

            // Compute state hash for the new schedules
            const stateHash = scheduleValidation.computeStateHash(schedules);

            // Compensating transaction: Step 1 - Create new batch
            const { data: newBatch, error: batchError } = await this.supabase
                .rpc('create_schedule_batch', {
                    p_name: `Schedule Batch ${new Date().toISOString()}`,
                    p_description: options.changeReason || 'Published new schedule',
                    p_academic_year: options.academic_year,
                    p_semester: options.semester,
                    p_created_by: this.currentUserId,
                });

            if (batchError) {
                throw new Error(`Failed to create batch: ${batchError.message}`);
            }

            createdBatchId = newBatch;
            console.log(`[VERSION SERVICE] Created batch ${createdBatchId}`);

            // Step 2 - Deactivate existing published schedules (but not archived ones)
            if (hasActive) {
                const { error: deactivateError } = await this.supabase
                    .from('schedules')
                    .update({ is_active: false })
                    .eq('status', 'published')
                    .eq('is_active', true)
                    .neq('status', 'archived');

                if (deactivateError) throw deactivateError;

                // Deactivate old published versions from other batches (but not archived ones)
                await this.supabase.from('schedule_versions')
                    .update({ is_active: false })
                    .in('change_type', ['publish', 'overwrite', 'restore'])
                    .eq('is_active', true)
                    .or('change_type.neq.status_change,change_summary.neq.Version archived');
            }

            // Step 3 - Insert new schedules with batch_id
            const inserts = schedules.map(s => ({
                subject_id: s.subject_id,
                teacher_id: s.teacher_id,
                room_id: s.room_id,
                section_id: s.section_id,
                day_of_week: s.day_of_week,
                start_time: s.start_time,
                end_time: s.end_time,
                status: 'published',
                is_active: true,
                batch_id: createdBatchId, // Link to batch
                semester: options.semester,
                academic_year: options.academic_year,
            }));

            const { data: insertedSchedules, error: insertError } = await this.supabase
                .from('schedules')
                .insert(inserts)
                .select('id');

            if (insertError) {
                // ROLLBACK: Reactivate the previously deactivated schedules
                if (hasActive) {
                    scheduleLogger.system.error('generate', 'persistence', 'Insert failed, attempting rollback', insertError);
                    await this.supabase
                        .from('schedules')
                        .update({ is_active: true })
                        .eq('status', 'published')
                        .eq('is_active', false);
                    throw new Error(`Insert failed: ${insertError.message}. Previous schedules have been reactivated.`);
                }
                throw insertError;
            }

            insertedScheduleIds = (insertedSchedules || []).map(s => s.id);
            console.log(`[VERSION SERVICE] Inserted ${insertedScheduleIds.length} schedules into batch ${createdBatchId}`);

            // Step 4 - Create batch-level version
            const { data: version, error: versionError } = await this.supabase
                .rpc('create_batch_version', {
                    p_batch_id: createdBatchId,
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
                await this.supabase.from('schedules').delete().in('id', insertedScheduleIds);
                await this.supabase.from('schedule_batches').delete().eq('id', createdBatchId);
                if (hasActive) {
                    await this.supabase
                        .from('schedules')
                        .update({ is_active: true })
                        .eq('status', 'published')
                        .eq('is_active', false);
                }
                throw new Error(`Version creation failed: ${versionError.message}. Partial changes have been rolled back.`);
            }

            createdVersionId = version;
            console.log(`[VERSION SERVICE] Created batch version ${createdVersionId}`);

            // Step 5 - Activate the batch
            await this.supabase
                .from('schedule_batches')
                .update({ is_active: true })
                .eq('id', createdBatchId);

            // Deactivate previous batch
            if (previousBatchId) {
                await this.supabase
                    .from('schedule_batches')
                    .update({ is_active: false })
                    .eq('id', previousBatchId);
            }

            // Step 6 - Activate the version
            await this.supabase
                .rpc('activate_batch_version', { p_version_id: createdVersionId });

            // CRITICAL: Verify state hash after persistence
            const { data: verifiedSchedules } = await this.supabase
                .from('schedules')
                .select('*')
                .eq('status', 'published')
                .eq('is_active', true);

            if (!verifiedSchedules || verifiedSchedules.length !== schedules.length) {
                throw new Error('Persistence verification failed: Schedule count mismatch');
            }

            const verifiedHash = scheduleValidation.computeStateHash(verifiedSchedules);
            if (verifiedHash !== stateHash) {
                scheduleLogger.system.error('system', 'persistence', 'CRITICAL: State hash mismatch after persistence', {
                    expected: stateHash,
                    actual: verifiedHash,
                });
                throw new Error('Persistence verification failed: State hash mismatch');
            }

            // Update canonical state manager
            if (verifiedSchedules) {
                const version = await scheduleStateManager.updateState(
                    verifiedSchedules,
                    'manual',
                    {
                        conflictCount: options.conflictCount || 0,
                        softScore: options.score || 0,
                        changeDescription: `Published schedule with ${verifiedSchedules.length} sessions`,
                    }
                );
                console.log(`[VERSION SERVICE] State manager updated: ${version}`);
            }

            scheduleLogger.system.workflowCompleted('Schedule publish', Date.now(), true);
            scheduleLogger.system.stateSynced('version_service', verifiedSchedules.length);

            return {
                success: true,
                message: `Successfully published ${schedules.length} sessions`,
                version_set_id: createdBatchId,
                version_count: 1,
                active_version_id: createdVersionId,
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
     * CRITICAL: This method now works with batch-level versioning.
     * Restores all schedules from a batch version snapshot.
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
        let previousBatchId: string | null = null;
        const insertedScheduleIds: string[] = [];
        let createdBatchId: string | null = null;
        let createdVersionId: string | null = null;

        try {
            // Get the version to restore
            const { data: versionData, error: versionError } = await this.supabase
                .from('schedule_versions')
                .select('*')
                .eq('id', versionId)
                .maybeSingle();

            if (versionError || !versionData) {
                throw new Error('Version not found');
            }

            // Verify the version has a batch_id (batch-level versioning)
            if (!versionData.batch_id) {
                throw new Error('Version is not associated with a batch. This version was created before batch-level versioning was implemented.');
            }

            // Get the batch snapshot
            const snapshot = versionData.snapshot as Schedule[];
            if (!snapshot || snapshot.length === 0) {
                throw new Error('Version has no schedule data');
            }

            // Get current active batch
            const { data: currentActiveBatch } = await this.supabase
                .from('schedule_batches')
                .select('id')
                .eq('is_active', true)
                .maybeSingle();

            if (currentActiveBatch) {
                previousBatchId = currentActiveBatch.id;
            }

            // Verify the version is not already active
            if (versionData.is_active) {
                return {
                    success: false,
                    message: 'Target version is already active. No changes made.',
                    restored_version_id: versionId,
                    previous_active_version_id: null,
                };
            }

            // No-OP detection: check if target state is identical to current
            if (previousBatchId) {
                const { data: currentSchedules } = await this.supabase
                    .from('schedules')
                    .select('*')
                    .eq('batch_id', previousBatchId)
                    .eq('is_active', true);

                if (currentSchedules && currentSchedules.length > 0) {
                    const currentHash = scheduleValidation.computeStateHash(currentSchedules);
                    const targetHash = versionData.state_hash;

                    if (currentHash === targetHash) {
                        return {
                            success: false,
                            message: 'Target version state is identical to current. No changes made.',
                            restored_version_id: versionId,
                            previous_active_version_id: null,
                        };
                    }
                }
            }

            // Compensating transaction: Step 1 - Create new batch for restoration
            const { data: newBatch, error: batchError } = await this.supabase
                .rpc('create_schedule_batch', {
                    p_name: `Restored Batch ${new Date().toISOString()}`,
                    p_description: options.reason || `Restored from version ${versionData.version_number}`,
                    p_academic_year: snapshot[0].academic_year || '2025-2026',
                    p_semester: snapshot[0].semester || '1st Semester',
                    p_created_by: this.currentUserId,
                });

            if (batchError) {
                throw new Error(`Failed to create batch: ${batchError.message}`);
            }

            createdBatchId = newBatch;
            console.log(`[VERSION SERVICE] Created restore batch ${createdBatchId}`);

            // Step 2 - Deactivate current active schedules
            const { error: deactivateError } = await this.supabase
                .from('schedules')
                .update({ is_active: false })
                .eq('status', 'published')
                .eq('is_active', true);

            if (deactivateError) {
                throw new Error(`Failed to deactivate current schedules: ${deactivateError.message}`);
            }

            // Step 3 - Restore all schedules from version snapshot
            const restoredSchedules: Schedule[] = [];
            for (const snapshotItem of snapshot) {
                const { data: insertedSchedule, error: insertError } = await this.supabase
                    .from('schedules')
                    .insert({
                        subject_id: snapshotItem.subject_id,
                        teacher_id: snapshotItem.teacher_id,
                        room_id: snapshotItem.room_id,
                        section_id: snapshotItem.section_id,
                        day_of_week: snapshotItem.day_of_week,
                        start_time: snapshotItem.start_time,
                        end_time: snapshotItem.end_time,
                        status: 'published',
                        is_active: true,
                        batch_id: createdBatchId, // Link to new restore batch
                        semester: snapshotItem.semester || '',
                        academic_year: snapshotItem.academic_year || '',
                    })
                    .select('id')
                    .maybeSingle();

                if (insertError) {
                    // ROLLBACK: We cannot restore the deactivated schedules without their data
                    throw new Error(`Failed to restore schedule: ${insertError.message}. CRITICAL: Current schedules were deactivated and cannot be restored automatically.`);
                }

                if (insertedSchedule) {
                    insertedScheduleIds.push(insertedSchedule.id);
                    restoredSchedules.push(snapshotItem);
                }
            }

            console.log(`[VERSION SERVICE] Restored ${insertedScheduleIds.length} schedules into batch ${createdBatchId}`);

            // Step 4 - Create version for the restore operation
            const newStateHash = scheduleValidation.computeStateHash(restoredSchedules);
            const { data: newVersion, error: newVersionError } = await this.supabase
                .rpc('create_batch_version', {
                    p_batch_id: createdBatchId,
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
                // ROLLBACK: Clean up
                await this.supabase.from('schedules').delete().in('id', insertedScheduleIds);
                await this.supabase.from('schedule_batches').delete().eq('id', createdBatchId);
                if (previousBatchId) {
                    await this.supabase
                        .from('schedules')
                        .update({ is_active: true })
                        .eq('batch_id', previousBatchId);
                }
                throw new Error(`Failed to create version: ${newVersionError.message}. Partial changes have been rolled back.`);
            }

            createdVersionId = newVersion;

            // Step 5 - Activate the new restore batch
            await this.supabase
                .from('schedule_batches')
                .update({ is_active: true })
                .eq('id', createdBatchId);

            // Deactivate previous batch
            if (previousBatchId) {
                await this.supabase
                    .from('schedule_batches')
                    .update({ is_active: false })
                    .eq('id', previousBatchId);
            }

            // Step 6 - Activate the version
            await this.supabase
                .rpc('activate_batch_version', { p_version_id: createdVersionId });

            // Rescan for conflicts after restore
            const { data: restoredSchedulesWithDetails } = await this.supabase
                .from('schedules')
                .select('*, subject:subjects(*), teacher:teachers(*), room:rooms(*), section:sections(*)')
                .eq('batch_id', createdBatchId)
                .eq('is_active', true);

            let conflictCount = 0;
            if (restoredSchedulesWithDetails && restoredSchedulesWithDetails.length > 0) {
                const conflicts = detectConflicts(restoredSchedulesWithDetails);
                conflictCount = conflicts.length;

                // Update the version with the actual conflict count
                await this.supabase
                    .from('schedule_versions')
                    .update({ conflict_count: conflictCount })
                    .eq('id', createdVersionId);

                // Save conflicts to database
                if (conflicts.length > 0) {
                    await this.supabase.from('conflicts').insert(
                        conflicts.map(c => ({
                            schedule_a_id: c.scheduleAId,
                            schedule_b_id: c.scheduleBId,
                            type: c.type,
                            severity: c.severity,
                            description: c.description,
                            is_resolved: false,
                        }))
                    );
                }
            }

            // CRITICAL: Verify state hash after restore
            const { data: verifiedSchedules } = await this.supabase
                .from('schedules')
                .select('*')
                .eq('status', 'published')
                .eq('is_active', true);

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
                message: `Successfully restored version ${versionData.version_number} with ${restoredSchedules.length} sessions`,
                restored_version_id: versionId,
                previous_active_version_id: null, // Previous version is not tracked at batch level
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
     * Archive a schedule version
     *
     * Marks a version as archived and updates the associated schedules to 'archived' status.
     * Archived schedules are not visible in the main schedule views but can be restored.
     */
    async archiveVersion(versionId: string, reason?: string): Promise<{ success: boolean; message: string }> {
        if (!this.supabase || !this.currentUserId) {
            throw new Error('Version service not initialized');
        }

        const startTime = Date.now();
        scheduleLogger.system.workflowStarted('Version archive');

        try {
            // Get the version details
            const { data: versionData, error: versionError } = await this.supabase
                .from('schedule_versions')
                .select('*')
                .eq('id', versionId)
                .maybeSingle();

            if (versionError || !versionData) {
                throw new Error('Version not found');
            }

            // Check if version is already archived
            if (versionData.change_type === 'status_change' && versionData.change_summary === 'Version archived') {
                return {
                    success: false,
                    message: 'Version is already archived',
                };
            }

            // Get the batch_id from the version
            const batchId = versionData.batch_id;
            if (!batchId) {
                return {
                    success: false,
                    message: 'Version is not associated with a batch',
                };
            }

            // Check if version is active
            if (versionData.is_active) {
                return {
                    success: false,
                    message: 'Cannot archive active version. Please deactivate it first.',
                };
            }

            // Update the version change_type to 'status_change'
            const { error: updateVersionError } = await this.supabase
                .from('schedule_versions')
                .update({
                    change_type: 'status_change',
                    change_summary: reason || 'Version archived',
                    change_reason: reason || 'Version archived',
                })
                .eq('id', versionId);

            if (updateVersionError) {
                throw new Error(`Failed to update version: ${updateVersionError.message}`);
            }

            // Update the schedules in this batch to 'archived' status
            const { error: updateSchedulesError } = await this.supabase
                .from('schedules')
                .update({ status: 'archived' })
                .eq('batch_id', batchId);

            if (updateSchedulesError) {
                // Rollback: revert version change_type
                await this.supabase
                    .from('schedule_versions')
                    .update({
                        change_type: versionData.change_type,
                        change_summary: versionData.change_summary,
                        change_reason: versionData.change_reason,
                    })
                    .eq('id', versionId);
                throw new Error(`Failed to archive schedules: ${updateSchedulesError.message}`);
            }

            scheduleLogger.system.workflowCompleted('Version archive', Date.now() - startTime, true);
            scheduleLogger.system.stateSynced('version_service', 0);

            return {
                success: true,
                message: `Successfully archived version ${versionData.version_number}`,
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            scheduleLogger.system.error('system', 'persistence', 'Version archive failed', error);
            scheduleLogger.system.workflowCompleted('Version archive', Date.now() - startTime, false);

            return {
                success: false,
                message: `Failed to archive version: ${errorMessage}`,
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
                .maybeSingle();

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
