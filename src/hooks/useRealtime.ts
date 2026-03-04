import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

/**
 * Subscribe to real-time changes on a Supabase table.
 * Automatically cleans up subscription on unmount.
 */
export function useRealtime(
    tableName: string,
    onEvent: (payload: {
        eventType: PostgresChangeEvent;
        new: Record<string, unknown>;
        old: Record<string, unknown>;
    }) => void,
    event: PostgresChangeEvent = '*'
) {
    const channelRef = useRef<RealtimeChannel | null>(null);

    useEffect(() => {
        const channel = supabase
            .channel(`realtime-${tableName}`)
            .on(
                'postgres_changes',
                { event, schema: 'public', table: tableName },
                (payload) => {
                    onEvent({
                        eventType: payload.eventType as PostgresChangeEvent,
                        new: payload.new as Record<string, unknown>,
                        old: payload.old as Record<string, unknown>,
                    });
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [tableName, event]);

    return channelRef;
}

/**
 * Subscribe to schedule changes and auto-refetch.
 */
export function useRealtimeSchedules(refetch: () => Promise<void>) {
    useRealtime('schedules', () => {
        refetch();
    });
}

/**
 * Subscribe to conflict changes and auto-refetch.
 */
export function useRealtimeConflicts(refetch: () => Promise<void>) {
    useRealtime('conflicts', () => {
        refetch();
    });
}

/**
 * Subscribe to admin task changes and auto-refetch.
 */
export function useRealtimeTasks(refetch: () => Promise<void>) {
    useRealtime('admin_tasks', () => {
        refetch();
    });
}
