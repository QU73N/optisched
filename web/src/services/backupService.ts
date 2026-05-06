/**
 * Backup Service
 * Handles comprehensive database backup and restore operations
 */

import { supabase } from '../lib/supabase';

export interface BackupData {
    metadata: {
        backup_id: string;
        timestamp: string;
        kind: string;
        note: string | null;
        version: string;
    };
    tables: Record<string, unknown[]>;
    table_counts: Record<string, number>;
}

const TABLES_TO_BACKUP = [
    'profiles',
    'teachers',
    'teacher_preferences',
    'subjects',
    'rooms',
    'sections',
    'schedules',
    'schedule_versions',
    'schedule_version_sets',
    'schedule_version_set_items',
    'conflicts',
    'system_rules',
    'institution_breaks',
    'announcements',
    'notifications',
    'teacher_messages',
    'chat_messages',
    'admin_messages',
    'admin_tasks',
    'custom_events',
    'emergency_overrides',
    'feature_flags',
    'priority_config',
    'sharing_requests',
    'schedule_change_requests',
    'approval_requests',
    'approval_audit_log',
];

/**
 * Create a comprehensive backup of all database tables
 */
export async function createBackup(kind: string = 'full', note: string | null = null): Promise<BackupData> {
    const backupData: BackupData = {
        metadata: {
            backup_id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            kind,
            note,
            version: '1.0',
        },
        tables: {},
        table_counts: {},
    };

    for (const table of TABLES_TO_BACKUP) {
        try {
            const { data, error, count } = await supabase
                .from(table)
                .select('*')
                .order('created_at', { ascending: true, nullsFirst: false });

            if (error) {
                console.error(`Error backing up table ${table}:`, error);
                backupData.tables[table] = [];
                backupData.table_counts[table] = 0;
                continue;
            }

            backupData.tables[table] = data || [];
            backupData.table_counts[table] = count || 0;
        } catch (err) {
            console.error(`Exception backing up table ${table}:`, err);
            backupData.tables[table] = [];
            backupData.table_counts[table] = 0;
        }
    }

    return backupData;
}

/**
 * Restore database from backup data
 * Note: This is a simplified restore - for production use, consider more sophisticated logic
 */
export async function restoreBackup(backupData: BackupData): Promise<{
    success: boolean;
    message: string;
    restored_tables: Record<string, number>;
    errors: string[];
}> {
    const result = {
        success: true,
        message: 'Restore completed successfully',
        restored_tables: {} as Record<string, number>,
        errors: [] as string[],
    };

    for (const [tableName, rows] of Object.entries(backupData.tables)) {
        if (!TABLES_TO_BACKUP.includes(tableName)) {
            continue;
        }

        try {
            // Skip certain tables to prevent conflicts
            if (tableName === 'profiles' || tableName === 'backup_jobs') {
                result.restored_tables[tableName] = 0;
                continue;
            }

            // Delete existing data
            const { error: deleteError } = await supabase
                .from(tableName)
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');

            if (deleteError) {
                console.error(`Error deleting from ${tableName}:`, deleteError);
                result.errors.push(`Failed to clear ${tableName}: ${deleteError.message}`);
                continue;
            }

            // Insert new data
            if (rows && rows.length > 0) {
                const { error: insertError } = await supabase
                    .from(tableName)
                    .insert(rows);

                if (insertError) {
                    console.error(`Error inserting into ${tableName}:`, insertError);
                    result.errors.push(`Failed to restore ${tableName}: ${insertError.message}`);
                    result.restored_tables[tableName] = 0;
                } else {
                    result.restored_tables[tableName] = rows.length;
                }
            } else {
                result.restored_tables[tableName] = 0;
            }
        } catch (err) {
            console.error(`Exception restoring table ${tableName}:`, err);
            result.errors.push(`Exception restoring ${tableName}: ${err instanceof Error ? err.message : String(err)}`);
            result.restored_tables[tableName] = 0;
        }
    }

    if (result.errors.length > 0) {
        result.success = false;
        result.message = `Restore completed with ${result.errors.length} errors`;
    }

    return result;
}

/**
 * Download backup data as JSON file
 */
export function downloadBackup(backupData: BackupData, filename?: string): void {
    const timestamp = new Date(backupData.metadata.timestamp)
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, -5);
    const defaultFilename = `optisched_backup_${timestamp}.json`;
    const finalFilename = filename || defaultFilename;

    const json = JSON.stringify(backupData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Read backup file from user input
 */
export function readBackupFile(file: File): Promise<BackupData> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                resolve(data as BackupData);
            } catch {
                reject(new Error('Invalid backup file format'));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

/**
 * Validate backup data structure
 */
export function validateBackupData(data: unknown): data is BackupData {
    if (!data || typeof data !== 'object') return false;
    if (!(data instanceof Object)) return false;
    const obj = data as Record<string, unknown>;
    if (!obj.metadata || typeof obj.metadata !== 'object') return false;
    if (!obj.tables || typeof obj.tables !== 'object') return false;
    if (!obj.table_counts || typeof obj.table_counts !== 'object') return false;
    const metadata = obj.metadata as Record<string, unknown>;
    if (!metadata.backup_id || !metadata.timestamp) return false;
    return true;
}
