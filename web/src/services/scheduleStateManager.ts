/**
 * Schedule State Manager - Canonical State Synchronization Service
 * 
 * This service manages the canonical schedule state shared between Generate and Conflicts tabs.
 * It ensures:
 * - Single source of truth for schedule data
 * - Version tracking for all schedule changes
 * - Event-based communication between tabs
 * - Automatic cache invalidation
 * - State consistency verification
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Schedule } from '../types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScheduleVersion {
    id: string;
    version: number;
    scheduleId: string | null; // null if not yet saved
    hash: string; // State hash for change detection
    timestamp: number;
    source: 'generate' | 'conflicts' | 'manual';
    metadata: {
        conflictCount: number;
        softScore: number;
        changeDescription: string;
    };
}

export interface ScheduleState {
    schedules: Schedule[];
    version: ScheduleVersion;
    lastModified: number;
    source: 'generate' | 'conflicts' | 'manual';
}

export interface StateChangeEvent {
    type: 'schedule_updated' | 'version_created' | 'cache_invalidated';
    version: ScheduleVersion;
    source: 'generate' | 'conflicts' | 'manual';
    timestamp: number;
}

export type StateChangeListener = (event: StateChangeEvent) => void;

// ---------------------------------------------------------------------------
// State Manager Class
// ---------------------------------------------------------------------------

class ScheduleStateManager {
    private static instance: ScheduleStateManager;
    private currentState: ScheduleState | null = null;
    private listeners: Set<StateChangeListener> = new Set();
    private supabase: SupabaseClient | null = null;
    
    private constructor() {}
    
    static getInstance(): ScheduleStateManager {
        if (!ScheduleStateManager.instance) {
            ScheduleStateManager.instance = new ScheduleStateManager();
        }
        return ScheduleStateManager.instance;
    }
    
    /**
     * Initialize the state manager with Supabase client
     */
    initialize(supabase: SupabaseClient): void {
        this.supabase = supabase;
        console.log('[STATE MANAGER] Initialized');
    }
    
    /**
     * Compute a hash of schedule state for change detection
     */
    private computeHash(schedules: Schedule[]): string {
        const sorted = [...schedules].sort((a, b) => a.id.localeCompare(b.id));
        const stateStr = sorted.map(s => 
            `${s.id}|${s.teacher_id || ''}|${s.room_id || ''}|${s.section_id || ''}|${s.day_of_week}|${s.start_time}|${s.end_time}|${s.subject_id || ''}`
        ).join('||');
        
        let hash = 5381;
        for (let i = 0; i < stateStr.length; i++) {
            hash = ((hash << 5) + hash) + stateStr.charCodeAt(i);
        }
        return Math.abs(hash).toString(36);
    }
    
    /**
     * Update the canonical schedule state
     * This is the SINGLE point where schedule state is updated
     */
    async updateState(
        schedules: Schedule[],
        source: 'generate' | 'conflicts' | 'manual',
        metadata: {
            conflictCount: number;
            softScore: number;
            changeDescription: string;
        }
    ): Promise<ScheduleVersion> {
        const hash = this.computeHash(schedules);
        const now = Date.now();
        
        // Create new version
        const version: ScheduleVersion = {
            id: crypto.randomUUID(),
            version: this.currentState ? this.currentState.version.version + 1 : 1,
            scheduleId: null, // Will be set when persisted
            hash,
            timestamp: now,
            source,
            metadata,
        };
        
        // Update current state
        this.currentState = {
            schedules,
            version,
            lastModified: now,
            source,
        };
        
        console.log('[STATE MANAGER] State updated:', {
            version: version.version,
            source,
            hash,
            conflictCount: metadata.conflictCount,
            softScore: metadata.softScore,
            description: metadata.changeDescription,
        });
        
        // Emit event
        this.emit({
            type: 'schedule_updated',
            version,
            source,
            timestamp: now,
        });
        
        return version;
    }
    
    /**
     * Get the current canonical state
     */
    getCurrentState(): ScheduleState | null {
        return this.currentState;
    }
    
    /**
     * Get the current schedules
     */
    getSchedules(): Schedule[] {
        return this.currentState?.schedules || [];
    }
    
    /**
     * Get the current version
     */
    getVersion(): ScheduleVersion | null {
        return this.currentState?.version || null;
    }
    
    /**
     * Check if state has changed since a given version
     */
    hasChangedSince(version: ScheduleVersion): boolean {
        if (!this.currentState) return false;
        return this.currentState.version.version > version.version;
    }
    
    /**
     * Invalidate all caches related to schedule state
     * This should be called whenever the schedule is modified
     */
    invalidateCache(): void {
        console.log('[STATE MANAGER] Cache invalidated');
        this.emit({
            type: 'cache_invalidated',
            version: this.currentState?.version || {
                id: '',
                version: 0,
                scheduleId: null,
                hash: '',
                timestamp: Date.now(),
                source: 'manual',
                metadata: { conflictCount: 0, softScore: 0, changeDescription: '' },
            },
            source: this.currentState?.source || 'manual',
            timestamp: Date.now(),
        });
    }
    
    /**
     * Register a listener for state change events
     */
    subscribe(listener: StateChangeListener): () => void {
        this.listeners.add(listener);
        console.log('[STATE MANAGER] Listener registered, total:', this.listeners.size);
        
        // Return unsubscribe function
        return () => {
            this.listeners.delete(listener);
            console.log('[STATE MANAGER] Listener unsubscribed, total:', this.listeners.size);
        };
    }
    
    /**
     * Emit a state change event to all listeners
     */
    private emit(event: StateChangeEvent): void {
        console.log('[STATE MANAGER] Emitting event:', event.type, 'to', this.listeners.size, 'listeners');
        this.listeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('[STATE MANAGER] Error in listener:', error);
            }
        });
    }
    
    /**
     * Fetch and set the latest committed schedule from database
     * This ensures the state manager is in sync with the database
     */
    async syncWithDatabase(): Promise<void> {
        if (!this.supabase) {
            console.warn('[STATE MANAGER] Supabase not initialized, cannot sync with database');
            return;
        }
        
        console.log('[STATE MANAGER] Syncing with database...');
        
        const { data: schedules, error } = await this.supabase
            .from('schedules')
            .select('*')
            .in('status', ['published', 'draft']);
        
        if (error) {
            console.error('[STATE MANAGER] Error syncing with database:', error);
            return;
        }
        
        if (schedules) {
            await this.updateState(
                schedules,
                'manual',
                {
                    conflictCount: 0, // Will be updated by conflict scan
                    softScore: 0, // Will be updated by conflict scan
                    changeDescription: 'Synced from database',
                }
            );
            
            console.log('[STATE MANAGER] Synced', schedules.length, 'schedules from database');
        }
    }
    
    /**
     * Verify state consistency
     * Compares local state hash with database state hash
     */
    async verifyConsistency(): Promise<boolean> {
        if (!this.supabase || !this.currentState) {
            console.warn('[STATE MANAGER] Cannot verify consistency: missing supabase or current state');
            return false;
        }
        
        console.log('[STATE MANAGER] Verifying state consistency...');
        
        const { data: dbSchedules, error } = await this.supabase
            .from('schedules')
            .select('*')
            .in('status', ['published', 'draft']);
        
        if (error) {
            console.error('[STATE MANAGER] Error verifying consistency:', error);
            return false;
        }
        
        if (dbSchedules) {
            const dbHash = this.computeHash(dbSchedules);
            const localHash = this.currentState.version.hash;
            
            const consistent = dbHash === localHash;
            console.log('[STATE MANAGER] Consistency check:', consistent, 'DB hash:', dbHash, 'Local hash:', localHash);
            
            return consistent;
        }
        
        return false;
    }
    
    /**
     * Reset the state manager (for testing or logout)
     */
    reset(): void {
        this.currentState = null;
        this.listeners.clear();
        console.log('[STATE MANAGER] Reset');
    }
}

// ---------------------------------------------------------------------------
// Export singleton instance
// ---------------------------------------------------------------------------

export const scheduleStateManager = ScheduleStateManager.getInstance();
