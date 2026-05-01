/**
 * Schedule Versioning Service
 * 
 * Provides functions for managing schedule versions, comparing versions,
 * and rolling back to previous states.
 */

import { supabase } from '../lib/supabase';
import type { ScheduleVersion, ScheduleVersionSet, VersionComparison } from '../types/database';

/**
 * Get version history for a specific schedule
 */
export async function getScheduleVersions(scheduleId: string): Promise<ScheduleVersion[]> {
    const { data, error } = await supabase
        .from('schedule_versions')
        .select('*')
        .eq('schedule_id', scheduleId)
        .order('version_number', { ascending: false });
    
    if (error) throw error;
    return data || [];
}

/**
 * Get a specific version by ID
 */
export async function getScheduleVersion(versionId: string): Promise<ScheduleVersion | null> {
    const { data, error } = await supabase
        .from('schedule_versions')
        .select('*')
        .eq('id', versionId)
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
    }
    return data;
}

/**
 * Compare two schedule versions and return differences
 */
export async function compareScheduleVersions(versionId1: string, versionId2: string): Promise<VersionComparison[]> {
    const { data, error } = await supabase
        .rpc('compare_schedule_versions', {
            p_version_id_1: versionId1,
            p_version_id_2: versionId2
        });
    
    if (error) throw error;
    return data || [];
}

/**
 * Rollback a schedule to a specific version
 * @param versionId - The version ID to rollback to
 * @param reason - Optional reason for the rollback
 * @returns true if successful
 */
export async function rollbackScheduleVersion(versionId: string, reason?: string): Promise<boolean> {
    const { data, error } = await supabase
        .rpc('rollback_schedule_version', {
            p_version_id: versionId,
            p_rollback_reason: reason || null
        });
    
    if (error) throw error;
    return data === true;
}

/**
 * Create a manual checkpoint version for a schedule
 * @param scheduleId - The schedule ID
 * @param summary - Summary of the checkpoint
 * @param reason - Detailed reason for the checkpoint
 */
export async function createScheduleCheckpoint(
    scheduleId: string,
    summary: string,
    reason?: string
): Promise<string> {
    const { data, error } = await supabase
        .rpc('create_schedule_version', {
            p_schedule_id: scheduleId,
            p_change_type: 'checkpoint',
            p_change_summary: summary,
            p_change_reason: reason || null
        });
    
    if (error) throw error;
    return data;
}

/**
 * Get all version sets (logical groupings of versions)
 */
export async function getScheduleVersionSets(academicYear?: string, semester?: string): Promise<ScheduleVersionSet[]> {
    let query = supabase
        .from('schedule_version_sets')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (academicYear) {
        query = query.eq('academic_year', academicYear);
    }
    
    if (semester) {
        query = query.eq('semester', semester);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
}

/**
 * Get a specific version set
 */
export async function getScheduleVersionSet(versionSetId: string): Promise<ScheduleVersionSet | null> {
    const { data, error } = await supabase
        .from('schedule_version_sets')
        .select('*')
        .eq('id', versionSetId)
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
    }
    return data;
}

/**
 * Create a version set (checkpoint for entire schedule)
 * @param name - Name of the version set
 * @param description - Optional description
 * @param academicYear - Academic year
 * @param semester - Semester
 */
export async function createScheduleVersionSet(
    name: string,
    description: string | null,
    academicYear: string,
    semester: string
): Promise<string> {
    const { data, error } = await supabase
        .rpc('create_schedule_version_set', {
            p_name: name,
            p_description: description,
            p_academic_year: academicYear,
            p_semester: semester
        });
    
    if (error) throw error;
    return data;
}

/**
 * Get all versions in a version set
 */
export async function getVersionSetVersions(versionSetId: string): Promise<ScheduleVersion[]> {
    const { data, error } = await supabase
        .from('schedule_version_set_items')
        .select('schedule_versions(*)')
        .eq('version_set_id', versionSetId);
    
    if (error) throw error;
    return (data || []).map(item => item.schedule_versions as unknown as ScheduleVersion).filter(v => v !== null);
}

/**
 * Delete a version (only for creator or admin)
 * @param versionId - The version ID to delete
 */
export async function deleteScheduleVersion(versionId: string): Promise<void> {
    const { error } = await supabase
        .from('schedule_versions')
        .delete()
        .eq('id', versionId);
    
    if (error) throw error;
}

/**
 * Delete a version set (only for creator or admin)
 * @param versionSetId - The version set ID to delete
 */
export async function deleteScheduleVersionSet(versionSetId: string): Promise<void> {
    const { error } = await supabase
        .from('schedule_version_sets')
        .delete()
        .eq('id', versionSetId);
    
    if (error) throw error;
}

/**
 * Format change type for display
 */
export function formatChangeType(changeType: string): string {
    const typeMap: Record<string, string> = {
        'created': 'Created',
        'updated': 'Updated',
        'deleted': 'Deleted',
        'status_change': 'Status Changed',
        'checkpoint': 'Checkpoint'
    };
    return typeMap[changeType] || changeType;
}

/**
 * Format comparison change type for display
 */
export function formatComparisonChangeType(changeType: string): string {
    const typeMap: Record<string, string> = {
        'added': 'Added',
        'removed': 'Removed',
        'modified': 'Modified'
    };
    return typeMap[changeType] || changeType;
}

/**
 * Get a human-readable field name
 */
export function formatFieldName(field: string): string {
    const fieldMap: Record<string, string> = {
        'id': 'ID',
        'subject_id': 'Subject',
        'teacher_id': 'Teacher',
        'room_id': 'Room',
        'section_id': 'Section',
        'day_of_week': 'Day',
        'start_time': 'Start Time',
        'end_time': 'End Time',
        'semester': 'Semester',
        'academic_year': 'Academic Year',
        'status': 'Status',
        'created_at': 'Created At',
        'updated_at': 'Updated At',
        'created_by': 'Created By',
        'submitted_at': 'Submitted At',
        'approved_by': 'Approved By',
        'approved_at': 'Approved At',
        'rejection_reason': 'Rejection Reason'
    };
    return fieldMap[field] || field;
}
