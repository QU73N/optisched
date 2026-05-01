import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../config/supabase';
import { supabaseAdmin } from '../config/supabase';

const QUEUE_KEY = '@optisched_offline_messages';

export interface QueuedMessage {
    id: string;
    table: 'admin_messages' | 'teacher_messages';
    payload: Record<string, any>;
    timestamp: number;
}

// Get all queued messages
export async function getQueuedMessages(): Promise<QueuedMessage[]> {
    try {
        const json = await AsyncStorage.getItem(QUEUE_KEY);
        return json ? JSON.parse(json) : [];
    } catch {
        return [];
    }
}

// Save a message to the offline queue
export async function queueMessage(table: 'admin_messages' | 'teacher_messages', payload: Record<string, any>): Promise<void> {
    const queue = await getQueuedMessages();
    const msg: QueuedMessage = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        table,
        payload,
        timestamp: Date.now(),
    };
    queue.push(msg);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    console.log('[OfflineQueue] Message queued:', msg.id);
}

// Remove a message from the queue after successful send
async function removeFromQueue(id: string): Promise<void> {
    const queue = await getQueuedMessages();
    const updated = queue.filter(m => m.id !== id);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

// Try to send all queued messages
export async function flushQueue(): Promise<number> {
    const queue = await getQueuedMessages();
    if (queue.length === 0) return 0;

    console.log(`[OfflineQueue] Flushing ${queue.length} queued messages...`);
    let sent = 0;

    for (const msg of queue) {
        try {
            const client = supabaseAdmin || supabase;
            const { error } = await client.from(msg.table).insert(msg.payload);
            if (error) {
                console.log('[OfflineQueue] Failed to send:', msg.id, error.message);
                continue; // Leave in queue, try again later
            }
            await removeFromQueue(msg.id);
            sent++;
            console.log('[OfflineQueue] Sent queued message:', msg.id);
        } catch (err) {
            console.log('[OfflineQueue] Error sending:', msg.id, err);
        }
    }

    console.log(`[OfflineQueue] Flushed ${sent}/${queue.length} messages`);
    return sent;
}

// Smart send: try online first, queue if offline
export async function smartSend(
    table: 'admin_messages' | 'teacher_messages',
    payload: Record<string, any>
): Promise<{ sent: boolean; queued: boolean; error?: string }> {
    const netState = await NetInfo.fetch();

    if (netState.isConnected) {
        // Online — try direct insert
        try {
            const client = supabaseAdmin || supabase;
            const { error } = await client.from(table).insert(payload);
            if (error) {
                // Insert failed, maybe connection dropped — queue it
                await queueMessage(table, payload);
                return { sent: false, queued: true, error: error.message };
            }
            return { sent: true, queued: false };
        } catch (err: any) {
            // Network error during insert — queue it
            await queueMessage(table, payload);
            return { sent: false, queued: true, error: err?.message };
        }
    } else {
        // Offline — queue immediately
        await queueMessage(table, payload);
        return { sent: false, queued: true };
    }
}

// Check network status
export async function isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return !!state.isConnected;
}

// Start background listener that flushes queue when coming online
let unsubscribe: (() => void) | null = null;

export function startOfflineSync(): void {
    if (unsubscribe) return; // Already started

    unsubscribe = NetInfo.addEventListener(state => {
        if (state.isConnected) {
            console.log('[OfflineQueue] Network connected, flushing queue...');
            flushQueue();
        }
    });

    console.log('[OfflineQueue] Background sync started');
}

export function stopOfflineSync(): void {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
        console.log('[OfflineQueue] Background sync stopped');
    }
}
