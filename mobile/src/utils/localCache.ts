import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@optisched_cache_';

// Save data to local cache
export async function cacheData(key: string, data: any): Promise<void> {
    try {
        const cacheEntry = {
            data,
            timestamp: Date.now(),
        };
        await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheEntry));
    } catch (err) {
        console.log('[Cache] Error saving:', key, err);
    }
}

// Load data from local cache
export async function getCachedData<T>(key: string): Promise<{ data: T | null; timestamp: number | null }> {
    try {
        const json = await AsyncStorage.getItem(CACHE_PREFIX + key);
        if (!json) return { data: null, timestamp: null };
        const entry = JSON.parse(json);
        return { data: entry.data as T, timestamp: entry.timestamp };
    } catch {
        return { data: null, timestamp: null };
    }
}

// Remove cached data
export async function clearCache(key?: string): Promise<void> {
    try {
        if (key) {
            await AsyncStorage.removeItem(CACHE_PREFIX + key);
        } else {
            const allKeys = await AsyncStorage.getAllKeys();
            const cacheKeys = allKeys.filter(k => k.startsWith(CACHE_PREFIX));
            if (cacheKeys.length > 0) {
                await AsyncStorage.multiRemove(cacheKeys as string[]);
            }
        }
    } catch {
        // ignore
    }
}
