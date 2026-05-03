/**
 * Schedule Logger - Comprehensive Logging Service for Generate/Conflicts Coordination
 * 
 * This service provides structured logging that makes the relationship between
 * the Generate tab and Conflicts tab visible and traceable.
 */

export interface LogEntry {
    timestamp: number;
    tab: 'generate' | 'conflicts' | 'system';
    level: 'info' | 'warn' | 'error' | 'debug';
    category: 'state' | 'conflict' | 'generation' | 'repair' | 'persistence' | 'rescan' | 'score' | 'progress';
    message: string;
    data?: {
        scheduleVersion?: number;
        scheduleHash?: string;
        conflictCountBefore?: number;
        conflictCountAfter?: number;
        softScoreBefore?: number;
        softScoreAfter?: number;
        changeDescription?: string;
        duration?: number;
        [key: string]: unknown;
    };
}

class ScheduleLogger {
    private logs: LogEntry[] = [];
    private maxLogs = 1000; // Keep last 1000 logs in memory
    
    /**
     * Log an entry with full context
     */
    log(entry: Omit<LogEntry, 'timestamp'>): void {
        const logEntry: LogEntry = {
            timestamp: Date.now(),
            ...entry,
        };
        
        // Add to memory logs
        this.logs.push(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        // Console output with prefix
        const prefix = `[${entry.tab.toUpperCase()}] [${entry.category.toUpperCase()}]`;
        const message = `${prefix} ${entry.message}`;
        
        switch (entry.level) {
            case 'error':
                console.error(message, entry.data || '');
                break;
            case 'warn':
                console.warn(message, entry.data || '');
                break;
            case 'debug':
                console.debug(message, entry.data || '');
                break;
            default:
                console.log(message, entry.data || '');
        }
    }
    
    /**
     * Generate tab specific logging
     */
    generate = {
        scheduleCreated: (version: number, hash: string, description: string) => {
            this.log({
                tab: 'generate',
                level: 'info',
                category: 'generation',
                message: 'Schedule created',
                data: { scheduleVersion: version, scheduleHash: hash, changeDescription: description },
            });
        },
        
        scheduleOptimized: (version: number, softScore: number, duration: number) => {
            this.log({
                tab: 'generate',
                level: 'info',
                category: 'generation',
                message: 'Schedule optimized',
                data: { scheduleVersion: version, softScoreBefore: softScore, duration },
            });
        },
        
        schedulePersisted: (version: number, scheduleId: string) => {
            this.log({
                tab: 'generate',
                level: 'info',
                category: 'persistence',
                message: 'Schedule persisted to database',
                data: { scheduleVersion: version, scheduleId },
            });
        },
        
        stateUpdated: (version: number, hash: string) => {
            this.log({
                tab: 'generate',
                level: 'debug',
                category: 'state',
                message: 'State updated in canonical state manager',
                data: { scheduleVersion: version, scheduleHash: hash },
            });
        },
        
        progress: (stage: string, progress: number) => {
            this.log({
                tab: 'generate',
                level: 'debug',
                category: 'progress',
                message: `Generation progress: ${stage} (${progress}%)`,
                data: { stage, progress },
            });
        },
    };
    
    /**
     * Conflicts tab specific logging
     */
    conflicts = {
        scanStarted: (version: number, hash: string) => {
            this.log({
                tab: 'conflicts',
                level: 'info',
                category: 'conflict',
                message: 'Deep conflict scan started',
                data: { scheduleVersion: version, scheduleHash: hash },
            });
        },
        
        scanCompleted: (version: number, conflictCount: number, softScore: number, duration: number) => {
            this.log({
                tab: 'conflicts',
                level: 'info',
                category: 'conflict',
                message: 'Deep conflict scan completed',
                data: { scheduleVersion: version, conflictCount: conflictCount, softScore, duration },
            });
        },
        
        fixApplied: (version: number, fixDescription: string, conflictCountBefore: number, conflictCountAfter: number) => {
            this.log({
                tab: 'conflicts',
                level: 'info',
                category: 'repair',
                message: `Fix applied: ${fixDescription}`,
                data: {
                    scheduleVersion: version,
                    changeDescription: fixDescription,
                    conflictCountBefore,
                    conflictCountAfter,
                },
            });
        },
        
        fixPersisted: (version: number, scheduleId: string) => {
            this.log({
                tab: 'conflicts',
                level: 'info',
                category: 'persistence',
                message: 'Fix persisted to database',
                data: { scheduleVersion: version, scheduleId },
            });
        },
        
        rescanStarted: (version: number, hash: string) => {
            this.log({
                tab: 'conflicts',
                level: 'info',
                category: 'rescan',
                message: 'Rescan started after fix',
                data: { scheduleVersion: version, scheduleHash: hash },
            });
        },
        
        rescanCompleted: (version: number, conflictCount: number, softScore: number, hash: string) => {
            this.log({
                tab: 'conflicts',
                level: 'info',
                category: 'rescan',
                message: 'Rescan completed',
                data: {
                    scheduleVersion: version,
                    conflictCount,
                    softScore,
                    scheduleHash: hash,
                },
            });
        },
        
        stateUpdated: (version: number, hash: string) => {
            this.log({
                tab: 'conflicts',
                level: 'debug',
                category: 'state',
                message: 'State updated in canonical state manager',
                data: { scheduleVersion: version, scheduleHash: hash },
            });
        },
        
        progress: (stage: string, progress: number) => {
            this.log({
                tab: 'conflicts',
                level: 'debug',
                category: 'progress',
                message: `Conflict repair progress: ${stage} (${progress}%)`,
                data: { stage, progress },
            });
        },
        
        loopDetected: (version: number, loopIteration: number) => {
            this.log({
                tab: 'conflicts',
                level: 'warn',
                category: 'repair',
                message: `Loop detected - state returned to iteration ${loopIteration}`,
                data: { scheduleVersion: version, loopIteration },
            });
        },
        
        noProgress: (version: number, reason: string) => {
            this.log({
                tab: 'conflicts',
                level: 'warn',
                category: 'repair',
                message: `No progress made: ${reason}`,
                data: { scheduleVersion: version, reason },
            });
        },
    };
    
    /**
     * System level logging
     */
    system = {
        cacheInvalidated: (source: 'generate' | 'conflicts') => {
            this.log({
                tab: 'system',
                level: 'info',
                category: 'state',
                message: `Cache invalidated by ${source} tab`,
                data: { source },
            });
        },
        
        stateSynced: (source: string, scheduleCount: number) => {
            this.log({
                tab: 'system',
                level: 'info',
                category: 'state',
                message: `State synced from ${source}`,
                data: { source, scheduleCount },
            });
        },
        
        consistencyVerified: (consistent: boolean, localHash: string, dbHash: string) => {
            this.log({
                tab: 'system',
                level: consistent ? 'info' : 'error',
                category: 'state',
                message: `State consistency check: ${consistent ? 'PASSED' : 'FAILED'}`,
                data: { consistent, localHash, dbHash },
            });
        },
        
        workflowStarted: (workflow: string) => {
            this.log({
                tab: 'system',
                level: 'info',
                category: 'progress',
                message: `Workflow started: ${workflow}`,
                data: { workflow },
            });
        },
        
        workflowCompleted: (workflow: string, duration: number, success: boolean) => {
            this.log({
                tab: 'system',
                level: success ? 'info' : 'error',
                category: 'progress',
                message: `Workflow ${success ? 'completed' : 'failed'}: ${workflow}`,
                data: { workflow, duration, success },
            });
        },
        
        error: (tab: 'generate' | 'conflicts' | 'system', category: 'state' | 'conflict' | 'generation' | 'repair' | 'persistence' | 'rescan' | 'score' | 'progress', message: string, error: unknown) => {
            this.log({
                tab,
                level: 'error',
                category,
                message,
                data: { error: error instanceof Error ? error.message : String(error) },
            });
        },
    };
    
    /**
     * Get all logs
     */
    getLogs(): LogEntry[] {
        return [...this.logs];
    }
    
    /**
     * Get logs filtered by tab
     */
    getLogsByTab(tab: 'generate' | 'conflicts' | 'system'): LogEntry[] {
        return this.logs.filter(log => log.tab === tab);
    }
    
    /**
     * Get logs filtered by category
     */
    getLogsByCategory(category: string): LogEntry[] {
        return this.logs.filter(log => log.category === category);
    }
    
    /**
     * Get logs since a timestamp
     */
    getLogsSince(timestamp: number): LogEntry[] {
        return this.logs.filter(log => log.timestamp >= timestamp);
    }
    
    /**
     * Clear all logs
     */
    clearLogs(): void {
        this.logs = [];
        console.log('[SCHEDULE LOGGER] Logs cleared');
    }
    
    /**
     * Export logs as JSON
     */
    exportLogs(): string {
        return JSON.stringify(this.logs, null, 2);
    }
}

// ---------------------------------------------------------------------------
// Export singleton instance
// ---------------------------------------------------------------------------

export const scheduleLogger = new ScheduleLogger();
