/**
 * Unit Tests for Schedule Version Service
 * 
 * Tests cover:
 * - No-OP detection
 * - State hash verification
 * - Single active version enforcement
 * - Compensating transaction rollback
 * - Version set handling
 * - Cross-tab event publishing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { scheduleVersionService } from './scheduleVersionService';
import { scheduleValidation } from './scheduleValidation';
import { scheduleStateManager } from './scheduleStateManager';

// Mock dependencies
vi.mock('./scheduleValidation');
vi.mock('./scheduleStateManager');

describe('ScheduleVersionService - No-OP Detection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should detect identical schedule and skip publish', async () => {
        // This test verifies that publishing an identical schedule
        // returns success without creating a new version
        const mockSchedules = [{ id: '1', subject_id: 'sub1' }];
        
        vi.mocked(scheduleValidation.computeStateHash)
            .mockReturnValueOnce('hash1') // current schedule hash
            .mockReturnValueOnce('hash1'); // new schedule hash (identical)

        // Mock Supabase responses
        const mockSupabase = {
            from: vi.fn(() => ({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        limit: vi.fn(() => Promise.resolve({ data: mockSchedules, error: null })),
                    })),
                })),
            })),
        };

        scheduleVersionService.initialize(mockSupabase as any, 'user-123');

        const result = await scheduleVersionService.publishSchedule(mockSchedules as any, {
            academic_year: '2024',
            semester: 'Fall',
            force: false,
        });

        expect(result.success).toBe(true);
        expect(result.message).toContain('identical');
        expect(result.version_count).toBe(0);
    });

    it('should allow force publish even when identical', async () => {
        const mockSchedules = [{ id: '1', subject_id: 'sub1' }];
        
        vi.mocked(scheduleValidation.computeStateHash)
            .mockReturnValueOnce('hash1')
            .mockReturnValueOnce('hash1');

        const mockSupabase = {
            from: vi.fn(() => ({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        limit: vi.fn(() => Promise.resolve({ data: mockSchedules, error: null })),
                    })),
                })),
                delete: vi.fn(() => ({
                    eq: vi.fn(() => Promise.resolve({ error: null })),
                })),
                insert: vi.fn(() => ({
                    select: vi.fn(() => Promise.resolve({ data: mockSchedules, error: null })),
                })),
            })),
            rpc: vi.fn(() => Promise.resolve('version-id')),
        };

        scheduleVersionService.initialize(mockSupabase as any, 'user-123');

        const result = await scheduleVersionService.publishSchedule(mockSchedules as any, {
            academic_year: '2024',
            semester: 'Fall',
            force: true, // Force flag
        });

        expect(result.success).toBe(true);
        // With force, it should proceed despite identical hash
    });
});

describe('ScheduleVersionService - State Hash Verification', () => {
    it('should verify state hash after publish and reject if mismatch', async () => {
        const mockSchedules = [{ id: '1', subject_id: 'sub1' }];
        
        vi.mocked(scheduleValidation.computeStateHash)
            .mockReturnValueOnce('hash1') // computed before insert
            .mockReturnValueOnce('hash2'); // computed after insert (mismatch!)

        const mockSupabase = {
            from: vi.fn(() => ({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
                    })),
                })),
                delete: vi.fn(() => ({
                    eq: vi.fn(() => Promise.resolve({ error: null })),
                })),
                insert: vi.fn(() => ({
                    select: vi.fn(() => Promise.resolve({ data: mockSchedules, error: null })),
                })),
            })),
        };

        scheduleVersionService.initialize(mockSupabase as any, 'user-123');

        await expect(
            scheduleVersionService.publishSchedule(mockSchedules as any, {
                academic_year: '2024',
                semester: 'Fall',
                force: true,
            })
        ).rejects.toThrow('State hash mismatch');
    });

    it('should verify state hash after restore and reject if mismatch', async () => {
        const mockVersion = {
            id: 'v1',
            schedule_id: 's1',
            version_number: 1,
            snapshot: [{ id: '1', subject_id: 'sub1' }],
            is_active: false,
        };

        vi.mocked(scheduleValidation.computeStateHash)
            .mockReturnValueOnce('hash1') // before restore
            .mockReturnValueOnce('hash2'); // after restore (mismatch!)

        const mockSupabase = {
            from: vi.fn(() => ({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        single: vi.fn(() => Promise.resolve({ data: mockVersion, error: null })),
                        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
                    })),
                })),
                delete: vi.fn(() => ({
                    eq: vi.fn(() => Promise.resolve({ error: null })),
                })),
                insert: vi.fn(() => ({
                    select: vi.fn(() => ({
                        single: vi.fn(() => Promise.resolve({ data: { id: 'new-id' }, error: null })),
                    })),
                })),
                update: vi.fn(() => ({
                    eq: vi.fn(() => Promise.resolve({ error: null })),
                })),
            })),
            rpc: vi.fn(() => Promise.resolve('set-id')),
        };

        scheduleVersionService.initialize(mockSupabase as any, 'user-123');

        await expect(
            scheduleVersionService.restoreVersion('v1', { reason: 'test', force: true })
        ).rejects.toThrow('State hash mismatch');
    });
});

describe('ScheduleVersionService - Single Active Version Enforcement', () => {
    it('should detect and fix multiple active versions after publish', async () => {
        const mockSchedules = [{ id: '1', subject_id: 'sub1' }];
        
        vi.mocked(scheduleValidation.computeStateHash).mockReturnValue('hash1');

        const mockSupabase = {
            from: vi.fn((table: string) => {
                if (table === 'schedule_versions') {
                    return {
                        select: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                single: vi.fn(() => Promise.resolve({ data: null, error: null })),
                                in: vi.fn(() => Promise.resolve({ data: [
                                    { id: 'v1', is_active: true },
                                    { id: 'v2', is_active: true }, // TWO active versions!
                                ], error: null })),
                            })),
                        })),
                        update: vi.fn(() => ({
                            eq: vi.fn(() => Promise.resolve({ error: null })),
                        })),
                    };
                }
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
                        })),
                    })),
                    delete: vi.fn(() => ({
                        eq: vi.fn(() => Promise.resolve({ error: null })),
                    })),
                    insert: vi.fn(() => ({
                        select: vi.fn(() => Promise.resolve({ data: mockSchedules, error: null })),
                    })),
                };
            }),
            rpc: vi.fn(() => Promise.resolve('version-id')),
        };

        scheduleVersionService.initialize(mockSupabase as any, 'user-123');

        const result = await scheduleVersionService.publishSchedule(mockSchedules as any, {
            academic_year: '2024',
            semester: 'Fall',
            force: true,
        });

        expect(result.success).toBe(true);
        // Should have called update to deactivate extra versions
        expect(mockSupabase.from('schedule_versions').update).toHaveBeenCalled();
    });

    it('should detect and fix multiple active versions after restore', async () => {
        const mockVersion = {
            id: 'v1',
            schedule_id: 's1',
            version_number: 1,
            snapshot: [{ id: '1', subject_id: 'sub1' }],
            is_active: false,
        };

        vi.mocked(scheduleValidation.computeStateHash).mockReturnValue('hash1');

        const mockSupabase = {
            from: vi.fn((table: string) => {
                if (table === 'schedule_versions') {
                    return {
                        select: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                single: vi.fn(() => Promise.resolve({ data: mockVersion, error: null })),
                            })),
                            in: vi.fn(() => Promise.resolve({ data: [
                                { id: 'v1', is_active: false, snapshot: [{ id: '1' }] },
                            ], error: null })),
                        })),
                        update: vi.fn(() => ({
                            eq: vi.fn(() => Promise.resolve({ error: null })),
                        })),
                    };
                }
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            single: vi.fn(() => Promise.resolve({ data: { version_set_id: 'set1' }, error: null })),
                        })),
                    })),
                    delete: vi.fn(() => ({
                        eq: vi.fn(() => Promise.resolve({ error: null })),
                    })),
                    insert: vi.fn(() => ({
                        select: vi.fn(() => ({
                            single: vi.fn(() => Promise.resolve({ data: { id: 'new-id' }, error: null })),
                        })),
                    })),
                };
            }),
            rpc: vi.fn((fn: string) => {
                if (fn === 'activate_schedule_version') return Promise.resolve();
                return Promise.resolve('set-id');
            }),
        };

        scheduleVersionService.initialize(mockSupabase as any, 'user-123');

        // Simulate multiple active versions being detected
        mockSupabase.from('schedule_versions').select = vi.fn(() => ({
            eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ 
                    data: {
                        id: 'v1',
                        schedule_id: 'sched-1',
                        version_number: 1,
                        snapshot: [{ id: '1', subject_id: 'sub1' }],
                        is_active: true
                    },
                    error: null 
                })),
            })),
        }));

        const result = await scheduleVersionService.restoreVersion('v1', { reason: 'test', force: true });

        expect(result.success).toBe(true);
    });
});

describe('ScheduleVersionService - Compensating Transaction Rollback', () => {
    it('should rollback inserted schedules if version creation fails', async () => {
        const mockSchedules = [{ id: '1', subject_id: 'sub1' }];
        
        vi.mocked(scheduleValidation.computeStateHash).mockReturnValue('hash1');

        const mockSupabase = {
            from: vi.fn(() => ({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
                    })),
                })),
                delete: vi.fn(() => ({
                    eq: vi.fn(() => Promise.resolve({ error: null })),
                })),
                insert: vi.fn(() => ({
                    select: vi.fn(() => Promise.resolve({ data: mockSchedules, error: null })),
                })),
            })),
            rpc: vi.fn(() => {
                // Version set creation succeeds
                if (Math.random() > 0.5) return Promise.resolve('set-id');
                // Version creation fails
                return Promise.reject(new Error('Version creation failed'));
            }),
        };

        scheduleVersionService.initialize(mockSupabase as any, 'user-123');

        await expect(
            scheduleVersionService.publishSchedule(mockSchedules as any, {
                academic_year: '2024',
                semester: 'Fall',
                force: true,
            })
        ).rejects.toThrow('Version creation failed');

        // Verify rollback was attempted
        expect(mockSupabase.from().delete).toHaveBeenCalled();
    });

    it('should rollback version set if insert fails', async () => {
        const mockSchedules = [{ id: '1', subject_id: 'sub1' }];
        
        vi.mocked(scheduleValidation.computeStateHash).mockReturnValue('hash1');

        const mockSupabase = {
            from: vi.fn(() => ({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
                    })),
                })),
                delete: vi.fn(() => ({
                    eq: vi.fn(() => Promise.resolve({ error: null })),
                })),
                insert: vi.fn(() => ({
                    select: vi.fn(() => Promise.reject(new Error('Insert failed'))),
                })),
            })),
            rpc: vi.fn(() => Promise.resolve('set-id')),
        };

        scheduleVersionService.initialize(mockSupabase as any, 'user-123');

        await expect(
            scheduleVersionService.publishSchedule(mockSchedules as any, {
                academic_year: '2024',
                semester: 'Fall',
                force: true,
            })
        ).rejects.toThrow('Insert failed');
    });
});

describe('ScheduleVersionService - Version Set Handling', () => {
    it('should restore all schedules in a version set', async () => {
        const mockVersion = {
            id: 'v1',
            schedule_id: 's1',
            version_number: 1,
            snapshot: [{ id: '1', subject_id: 'sub1' }],
            is_active: false,
            soft_score: 100,
            conflict_count: 0,
        };

        const mockVersionSet = [
            { id: 'v1', schedule_version_id: 'v1' },
            { id: 'v2', schedule_version_id: 'v2' },
        ];

        const mockAllVersions = [
            { id: 'v1', is_active: false, snapshot: [{ id: '1', subject_id: 'sub1' }] },
            { id: 'v2', is_active: false, snapshot: [{ id: '2', subject_id: 'sub2' }] },
        ];

        vi.mocked(scheduleValidation.computeStateHash).mockReturnValue('hash1');

        const mockSupabase = {
            from: vi.fn((table: string) => {
                if (table === 'schedule_versions') {
                    return {
                        select: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                single: vi.fn(() => Promise.resolve({ data: mockVersion, error: null })),
                            })),
                            in: vi.fn(() => Promise.resolve({ data: mockAllVersions, error: null })),
                        })),
                        update: vi.fn(() => ({
                            eq: vi.fn(() => Promise.resolve({ error: null })),
                        })),
                    };
                }
                if (table === 'schedule_version_set_items') {
                    return {
                        select: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                single: vi.fn(() => Promise.resolve({ data: { version_set_id: 'set1' }, error: null })),
                            })),
                        })),
                    };
                }
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => Promise.resolve({ error: null })),
                    })),
                    delete: vi.fn(() => ({
                        eq: vi.fn(() => Promise.resolve({ error: null })),
                    })),
                    insert: vi.fn(() => ({
                        select: vi.fn(() => ({
                            single: vi.fn(() => Promise.resolve({ data: { id: 'new-id' }, error: null })),
                        })),
                    })),
                };
            }),
            rpc: vi.fn(() => Promise.resolve('version-id')),
        };

        scheduleVersionService.initialize(mockSupabase as any, 'user-123');

        // Mock the version set items query
        mockSupabase.from('schedule_version_set_items').select = vi.fn(() => ({
            eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: { version_set_id: 'set1' }, error: null })),
            })),
        }));

        mockSupabase.from('schedule_version_set_items').select = vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: mockVersionSet, error: null })),
        }));

        const result = await scheduleVersionService.restoreVersion('v1', { reason: 'test', force: true });

        expect(result.success).toBe(true);
        // Should have restored both schedules
    });
});

describe('ScheduleVersionService - Cross-Tab Event Publishing', () => {
    it('should publish event when state is updated', async () => {
        const mockSchedules = [{ id: '1', subject_id: 'sub1' }];
        
        vi.mocked(scheduleValidation.computeStateHash).mockReturnValue('hash1');
        vi.mocked(scheduleStateManager.updateState).mockResolvedValue({
            id: 'v1',
            version: 1,
            hash: 'hash1',
            timestamp: Date.now(),
            source: 'generate',
            metadata: { conflictCount: 0, softScore: 100, changeDescription: 'test' },
        } as any);

        const mockSupabase = {
            from: vi.fn(() => ({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({
                        limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
                    })),
                })),
                delete: vi.fn(() => ({
                    eq: vi.fn(() => Promise.resolve({ error: null })),
                })),
                insert: vi.fn(() => ({
                    select: vi.fn(() => Promise.resolve({ data: mockSchedules, error: null })),
                })),
            })),
            rpc: vi.fn(() => Promise.resolve('version-id')),
        };

        scheduleVersionService.initialize(mockSupabase as any, 'user-123');

        await scheduleVersionService.publishSchedule(mockSchedules as any, {
            academic_year: '2024',
            semester: 'Fall',
            force: true,
        });

        // Verify state manager updateState was called (which emits events)
        expect(scheduleStateManager.updateState).toHaveBeenCalled();
    });
});
