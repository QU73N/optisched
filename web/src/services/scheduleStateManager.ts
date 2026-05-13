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

export interface InMemoryScheduleVersion {
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
    version: InMemoryScheduleVersion;
    lastModified: number;
    source: 'generate' | 'conflicts' | 'manual';
}

export interface StateChangeEvent {
    type: 'schedule_updated' | 'version_created' | 'cache_invalidated';
    version: InMemoryScheduleVersion;
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
        console.log('[scheduleStateManager] INITIALIZE START');
        this.supabase = supabase;
        console.log('[scheduleStateManager] INITIALIZED');
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
    ): Promise<InMemoryScheduleVersion> {
        console.log('[scheduleStateManager] UPDATE STATE START:', {
            scheduleCount: schedules.length,
            source,
            conflictCount: metadata.conflictCount,
            softScore: metadata.softScore,
            description: metadata.changeDescription
        });
        
        const hash = this.computeHash(schedules);
        const now = Date.now();
        
        // Create new version
        const version: InMemoryScheduleVersion = {
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
        
        console.log('[scheduleStateManager] STATE UPDATED:', {
            version: version.version,
            versionId: version.id,
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
        const state = this.currentState;
        console.log('[scheduleStateManager] GET CURRENT STATE:', {
            hasState: !!state,
            version: state?.version.version || 0,
            source: state?.source,
            scheduleCount: state?.schedules.length || 0
        });
        return state;
    }
    
    /**
     * Get the current schedules
     */
    getSchedules(): Schedule[] {
        const schedules = this.currentState?.schedules || [];
        console.log('[scheduleStateManager] GET SCHEDULES:', { count: schedules.length });
        return schedules;
    }
    
    /**
     * Get the current version
     */
    getVersion(): InMemoryScheduleVersion | null {
        return this.currentState?.version || null;
    }
    
    /**
     * Check if state has changed since a given version
     */
    hasChangedSince(version: InMemoryScheduleVersion): boolean {
        if (!this.currentState) return false;
        const changed = this.currentState.version.version > version.version;
        console.log('[scheduleStateManager] HAS CHANGED SINCE:', {
            compareVersion: version.version,
            currentVersion: this.currentState.version.version,
            changed
        });
        return changed;
    }
    
    /**
     * Invalidate all caches related to schedule state
     * This should be called whenever the schedule is modified
     */
    invalidateCache(): void {
        console.log('[scheduleStateManager] INVALIDATE CACHE START');
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
        console.log('[scheduleStateManager] CACHE INVALIDATED');
    }
    
    /**
     * Register a listener for state change events
     */
    subscribe(listener: StateChangeListener): () => void {
        this.listeners.add(listener);
        console.log('[scheduleStateManager] LISTENER REGISTERED:', { totalListeners: this.listeners.size });
        
        // Return unsubscribe function
        return () => {
            this.listeners.delete(listener);
            console.log('[scheduleStateManager] LISTENER UNREGISTERED:', { totalListeners: this.listeners.size });
        };
    }
    
    /**
     * Emit a state change event to all listeners
     */
    private emit(event: StateChangeEvent): void {
        console.log('[scheduleStateManager] EMIT EVENT START:', {
            type: event.type,
            version: event.version.version,
            source: event.source,
            listenerCount: this.listeners.size
        });
        this.listeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('[scheduleStateManager] LISTENER ERROR:', error);
            }
        });
        console.log('[scheduleStateManager] EMIT EVENT COMPLETED');
    }
    
    /**
     * Fetch and set the latest committed schedule from database
     * This ensures the state manager is in sync with the database
     */
    async syncWithDatabase(): Promise<void> {
        console.log('[scheduleStateManager] SYNC WITH DATABASE START');
        if (!this.supabase) {
            console.warn('[scheduleStateManager] SYNC: Supabase not initialized');
            return;
        }
        
        const { data: schedules, error } = await this.supabase
            .from('schedules')
            .select('*')
            .in('status', ['published', 'draft']);
        
        if (error) {
            console.error('[scheduleStateManager] SYNC: Database error:', error);
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
            
            console.log('[scheduleStateManager] SYNC COMPLETED:', { scheduleCount: schedules.length });
        }
    }
    
    /**
     * Verify state consistency
     * Compares local state hash with database state hash
     */
    async verifyConsistency(): Promise<boolean> {
        console.log('[scheduleStateManager] VERIFY CONSISTENCY START');
        if (!this.supabase || !this.currentState) {
            console.warn('[scheduleStateManager] VERIFY: Cannot verify - missing supabase or current state');
            return false;
        }
        
        const { data: dbSchedules, error } = await this.supabase
            .from('schedules')
            .select('*')
            .in('status', ['published', 'draft']);
        
        if (error) {
            console.error('[scheduleStateManager] VERIFY: Database error:', error);
            return false;
        }
        
        if (dbSchedules) {
            const dbHash = this.computeHash(dbSchedules);
            const localHash = this.currentState.version.hash;
            
            const consistent = dbHash === localHash;
            console.log('[scheduleStateManager] VERIFY RESULT:', {
                consistent,
                dbHash,
                localHash,
                dbScheduleCount: dbSchedules.length,
                localScheduleCount: this.currentState.schedules.length
            });
            
            return consistent;
        }
        
        return false;
    }
    
    /**
     * Reset the state manager (for testing or logout)
     */
    reset(): void {
        console.log('[scheduleStateManager] RESET START');
        this.currentState = null;
        this.listeners.clear();
        console.log('[scheduleStateManager] RESET COMPLETED');
    }
}

// ---------------------------------------------------------------------------
// Export singleton instance
// ---------------------------------------------------------------------------

export const scheduleStateManager = ScheduleStateManager.getInstance();
