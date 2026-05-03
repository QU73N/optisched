/**
 * Schedule State Manager Tests
 * 
 * Tests for canonical state management, version tracking, and event-based communication
 * These tests ensure the state manager correctly maintains a single source of truth,
 * tracks versions with hash-based change detection, and publishes events correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { scheduleStateManager } from './scheduleStateManager';
import { createClient } from '@supabase/supabase-js';
import type { Schedule } from '../types/database';

// ---------------------------------------------------------------------------
// Test Data
// ---------------------------------------------------------------------------

const mockSchedules: Schedule[] = [
    {
        id: 'sched1',
        subject_id: 'subject1',
        teacher_id: 'teacher1',
        room_id: 'room1',
        section_id: 'section1',
        day_of_week: 'Monday',
        start_time: '09:00',
        end_time: '10:00',
        status: 'published',
        semester: '2024-1',
        academic_year: '2024',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'user1',
        submitted_at: null,
        approved_by: null,
        approved_at: null,
        rejected_by: null,
        rejected_at: null,
        rejection_reason: null,
        deleted_at: null,
        deleted_by: null,
        is_locked: false,
        locked_by: null,
        locked_at: null,
        lock_reason: null,
    },
    {
        id: 'sched2',
        subject_id: 'subject2',
        teacher_id: 'teacher2',
        room_id: 'room2',
        section_id: 'section2',
        day_of_week: 'Tuesday',
        start_time: '10:00',
        end_time: '11:00',
        status: 'published',
        semester: '2024-1',
        academic_year: '2024',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: 'user1',
        submitted_at: null,
        approved_by: null,
        approved_at: null,
        rejected_by: null,
        rejected_at: null,
        rejection_reason: null,
        deleted_at: null,
        deleted_by: null,
        is_locked: false,
        locked_by: null,
        locked_at: null,
        lock_reason: null,
    },
];

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('ScheduleStateManager', () => {
    let supabase: ReturnType<typeof createClient>;

    beforeEach(() => {
        // Reset state manager before each test
        scheduleStateManager.reset();
        
        // Create mock Supabase client
        supabase = createClient('https://test.supabase.co', 'test-key');
        scheduleStateManager.initialize(supabase);
    });

    afterEach(() => {
        scheduleStateManager.reset();
    });

    describe('Initialization', () => {
        it('should initialize with Supabase client', () => {
            scheduleStateManager.initialize(supabase);
            expect(scheduleStateManager.getCurrentState()).toBeNull();
        });

        it('should reset state', () => {
            scheduleStateManager.reset();
            expect(scheduleStateManager.getCurrentState()).toBeNull();
        });
    });

    describe('State Updates', () => {
        it('should update state and increment version', async () => {
            const version = await scheduleStateManager.updateState(
                mockSchedules,
                'generate',
                {
                    conflictCount: 0,
                    softScore: 100,
                    changeDescription: 'Test update',
                }
            );

            expect(version.version).toBe(1);
            expect(version.source).toBe('generate');
            expect(version.metadata.conflictCount).toBe(0);
            expect(version.metadata.softScore).toBe(100);
            expect(version.hash).toBeDefined();
        });

        it('should increment version on subsequent updates', async () => {
            await scheduleStateManager.updateState(
                mockSchedules,
                'generate',
                {
                    conflictCount: 0,
                    softScore: 100,
                    changeDescription: 'First update',
                }
            );

            const version2 = await scheduleStateManager.updateState(
                mockSchedules,
                'conflicts',
                {
                    conflictCount: 5,
                    softScore: 95,
                    changeDescription: 'Second update',
                }
            );

            expect(version2.version).toBe(2);
            expect(version2.source).toBe('conflicts');
        });

        it('should compute different hash for different schedules', async () => {
            const version1 = await scheduleStateManager.updateState(
                mockSchedules,
                'generate',
                {
                    conflictCount: 0,
                    softScore: 100,
                    changeDescription: 'First',
                }
            );

            const modifiedSchedules = [
                { ...mockSchedules[0], start_time: '11:00' },
                ...mockSchedules.slice(1),
            ];

            const version2 = await scheduleStateManager.updateState(
                modifiedSchedules,
                'generate',
                {
                    conflictCount: 0,
                    softScore: 100,
                    changeDescription: 'Second',
                }
            );

            expect(version1.hash).not.toBe(version2.hash);
        });

        it('should compute same hash for identical schedules', async () => {
            const version1 = await scheduleStateManager.updateState(
                mockSchedules,
                'generate',
                {
                    conflictCount: 0,
                    softScore: 100,
                    changeDescription: 'First',
                }
            );

            const version2 = await scheduleStateManager.updateState(
                mockSchedules,
                'generate',
                {
                    conflictCount: 0,
                    softScore: 100,
                    changeDescription: 'Second',
                }
            );

            expect(version1.hash).toBe(version2.hash);
        });
    });

    describe('State Queries', () => {
        it('should return current state after update', async () => {
            await scheduleStateManager.updateState(
                mockSchedules,
                'generate',
                {
                    conflictCount: 0,
                    softScore: 100,
                    changeDescription: 'Test',
                }
            );

            const state = scheduleStateManager.getCurrentState();
            expect(state).not.toBeNull();
            expect(state?.schedules).toEqual(mockSchedules);
            expect(state?.version.version).toBe(1);
        });

        it('should return current schedules', async () => {
            await scheduleStateManager.updateState(
                mockSchedules,
                'generate',
                {
                    conflictCount: 0,
                    softScore: 100,
                    changeDescription: 'Test',
                }
            );

            const schedules = scheduleStateManager.getSchedules();
            expect(schedules).toEqual(mockSchedules);
        });

        it('should return current version', async () => {
            const version = await scheduleStateManager.updateState(
                mockSchedules,
                'generate',
                {
                    conflictCount: 0,
                    softScore: 100,
                    changeDescription: 'Test',
                }
            );

            const currentVersion = scheduleStateManager.getVersion();
            expect(currentVersion).not.toBeNull();
            expect(currentVersion?.version).toBe(version.version);
            expect(currentVersion?.hash).toBe(version.hash);
        });

        it('should return null for version when no state exists', () => {
            const version = scheduleStateManager.getVersion();
            expect(version).toBeNull();
        });
    });

    describe('Change Detection', () => {
        it('should detect state has changed since given version', async () => {
            const version1 = await scheduleStateManager.updateState(
                mockSchedules,
                'generate',
                {
                    conflictCount: 0,
                    softScore: 100,
                    changeDescription: 'First',
                }
            );

            await scheduleStateManager.updateState(
                mockSchedules,
                'generate',
                {
                    conflictCount: 5,
                    softScore: 95,
                    changeDescription: 'Second',
                }
            );

            const hasChanged = scheduleStateManager.hasChangedSince(version1);
            expect(hasChanged).toBe(true);
        });

        it('should not detect change when state has not changed', async () => {
            const version1 = await scheduleStateManager.updateState(
                mockSchedules,
                'generate',
                {
                    conflictCount: 0,
                    softScore: 100,
                    changeDescription: 'First',
                }
            );

            const hasChanged = scheduleStateManager.hasChangedSince(version1);
            expect(hasChanged).toBe(false);
        });
    });

    describe('Event Publishing', () => {
        it('should publish event on state update', async () => {
            let receivedEvent: any = null;
            const unsubscribe = scheduleStateManager.subscribe((event) => {
                receivedEvent = event;
            });

            await scheduleStateManager.updateState(
                mockSchedules,
                'generate',
                {
                    conflictCount: 0,
                    softScore: 100,
                    changeDescription: 'Test',
                }
            );

            expect(receivedEvent).not.toBeNull();
            expect(receivedEvent.type).toBe('schedule_updated');
            expect(receivedEvent.source).toBe('generate');

            unsubscribe();
        });

        it('should notify all subscribers', async () => {
            const events1: any[] = [];
            const events2: any[] = [];

            const unsubscribe1 = scheduleStateManager.subscribe((event) => {
                events1.push(event);
            });

            const unsubscribe2 = scheduleStateManager.subscribe((event) => {
                events2.push(event);
            });

            await scheduleStateManager.updateState(
                mockSchedules,
                'generate',
                {
                    conflictCount: 0,
                    softScore: 100,
                    changeDescription: 'Test',
                }
            );

            expect(events1).toHaveLength(1);
            expect(events2).toHaveLength(1);

            unsubscribe1();
            unsubscribe2();
        });

        it('should unsubscribe correctly', async () => {
            const events: any[] = [];
            const unsubscribe = scheduleStateManager.subscribe((event) => {
                events.push(event);
            });

            unsubscribe();

            await scheduleStateManager.updateState(
                mockSchedules,
                'generate',
                {
                    conflictCount: 0,
                    softScore: 100,
                    changeDescription: 'Test',
                }
            );

            expect(events).toHaveLength(0);
        });
    });

    describe('Cache Invalidation', () => {
        it('should publish cache invalidated event', () => {
            let receivedEvent: any = null;
            const unsubscribe = scheduleStateManager.subscribe((event) => {
                receivedEvent = event;
            });

            scheduleStateManager.invalidateCache();

            expect(receivedEvent).not.toBeNull();
            expect(receivedEvent.type).toBe('cache_invalidated');

            unsubscribe();
        });
    });

    describe('Error Handling', () => {
        it('should handle listener errors gracefully', async () => {
            const badListener = () => {
                throw new Error('Listener error');
            };

            const goodListenerEvents: any[] = [];
            const goodListener = (event: any) => {
                goodListenerEvents.push(event);
            };

            scheduleStateManager.subscribe(badListener);
            scheduleStateManager.subscribe(goodListener);

            // This should not throw despite bad listener
            await scheduleStateManager.updateState(
                mockSchedules,
                'generate',
                {
                    conflictCount: 0,
                    softScore: 100,
                    changeDescription: 'Test',
                }
            );

            // Good listener should still receive event
            expect(goodListenerEvents).toHaveLength(1);
        });
    });

    describe('Consistency Verification', () => {
        it('should return false when Supabase not initialized', async () => {
            scheduleStateManager.reset(); // This removes Supabase client
            const consistent = await scheduleStateManager.verifyConsistency();
            expect(consistent).toBe(false);
        });

        it('should return false when no current state exists', async () => {
            const consistent = await scheduleStateManager.verifyConsistency();
            expect(consistent).toBe(false);
        });
    });
});
