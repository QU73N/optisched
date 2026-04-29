import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../config/supabase';

export interface CustomEvent {
    id: string;
    title: string;
    description: string | null;
    event_date: string; // YYYY-MM-DD
    start_time: string | null;
    end_time: string | null;
    room: string | null;
    created_by: string;
    creator_name: string | null;
    creator_role: string | null;
    created_at: string;
}

/**
 * Hook for custom events — supports filtering by date or fetching upcoming events.
 * @param filterDate - if set, only fetch events for this specific date (YYYY-MM-DD)
 * @param upcoming - if true, fetch events from today onward (next 14 days), ordered by date
 */
export function useCustomEvents(filterDate?: string, upcoming?: boolean) {
    const [events, setEvents] = useState<CustomEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const fetchFnRef = useRef<() => Promise<void>>();

    const fetchEvents = useCallback(async () => {
        try {
            let query = supabase.from('custom_events').select('*').order('event_date', { ascending: true }).order('start_time', { ascending: true });

            if (filterDate) {
                query = query.eq('event_date', filterDate);
            } else if (upcoming) {
                const today = new Date().toISOString().split('T')[0];
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + 14);
                const future = futureDate.toISOString().split('T')[0];
                query = query.gte('event_date', today).lte('event_date', future);
            }

            const { data, error } = await query;
            if (!error && data) setEvents(data);
        } catch (err) {
            console.log('[Events] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [filterDate, upcoming]);

    // Update the ref whenever fetchEvents changes
    useEffect(() => {
        fetchFnRef.current = fetchEvents;
    }, [fetchEvents]);

    // Fetch on mount and when filters change
    useEffect(() => {
        fetchEvents();
    }, [filterDate, upcoming, fetchEvents]);

    // Real-time subscription - keep stable, call latest fetchEvents via ref
    useEffect(() => {
        const channelId = `custom_events_${Math.random().toString(36).slice(2, 9)}`;
        const channel = supabase
            .channel(channelId)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_events' }, () => {
                if (fetchFnRef.current) {
                    fetchFnRef.current();
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const createEvent = async (event: {
        title: string;
        description?: string;
        event_date: string;
        start_time?: string;
        end_time?: string;
        room?: string;
        created_by: string;
        creator_name: string;
        creator_role: string;
    }) => {
        const { error } = await supabase.from('custom_events').insert(event);
        if (error) throw error;
        fetchEvents();
    };

    const deleteEvent = async (id: string) => {
        const { error } = await supabase.from('custom_events').delete().eq('id', id);
        if (error) throw error;
        fetchEvents();
    };

    return { events, loading, createEvent, deleteEvent, refetch: fetchEvents };
}
