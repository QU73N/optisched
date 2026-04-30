import { supabase } from './supabase';

export interface UserPreferences {
    user_id: string;
    theme: 'light' | 'dark';
    time_format: '12h' | '24h';
    landing_animations: boolean;
    dashboard_animations: boolean;
    email_notifications: boolean;
    schedule_notifications: boolean;
    announcement_notifications: boolean;
    updated_at: string;
    created_at: string;
}

const DEFAULT_PREFERENCES: Omit<UserPreferences, 'user_id' | 'updated_at' | 'created_at'> = {
    theme: 'light',
    time_format: '24h',
    landing_animations: true,
    dashboard_animations: false,
    email_notifications: true,
    schedule_notifications: true,
    announcement_notifications: true,
};

/**
 * Load user preferences from the database
 * Falls back to localStorage if database fetch fails (for backward compatibility)
 */
export async function loadUserPreferences(userId: string): Promise<Omit<UserPreferences, 'user_id' | 'updated_at' | 'created_at'>> {
    try {
        const { data, error } = await supabase
            .from('user_preferences')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) throw error;

        if (data) {
            return {
                theme: data.theme || DEFAULT_PREFERENCES.theme,
                time_format: data.time_format || DEFAULT_PREFERENCES.time_format,
                landing_animations: data.landing_animations ?? DEFAULT_PREFERENCES.landing_animations,
                dashboard_animations: data.dashboard_animations ?? DEFAULT_PREFERENCES.dashboard_animations,
                email_notifications: data.email_notifications ?? DEFAULT_PREFERENCES.email_notifications,
                schedule_notifications: data.schedule_notifications ?? DEFAULT_PREFERENCES.schedule_notifications,
                announcement_notifications: data.announcement_notifications ?? DEFAULT_PREFERENCES.announcement_notifications,
            };
        }
    } catch (err) {
        console.warn('Failed to load user preferences from database, falling back to localStorage:', err);
    }

    // Fallback to localStorage
    return {
        theme: (localStorage.getItem('optisched-theme') as 'light' | 'dark') || DEFAULT_PREFERENCES.theme,
        time_format: (localStorage.getItem('optisched-time-format') as '12h' | '24h') || DEFAULT_PREFERENCES.time_format,
        landing_animations: localStorage.getItem('optisched-landing-animations') !== 'false',
        dashboard_animations: localStorage.getItem('optisched-dashboard-animations') === 'true',
        email_notifications: localStorage.getItem('optisched-email-notifs') !== 'false',
        schedule_notifications: localStorage.getItem('optisched-schedule-notifs') !== 'false',
        announcement_notifications: localStorage.getItem('optisched-announcement-notifs') !== 'false',
    };
}

/**
 * Save user preferences to the database
 */
export async function saveUserPreferences(userId: string, preferences: Partial<Omit<UserPreferences, 'user_id' | 'updated_at' | 'created_at'>>): Promise<void> {
    try {
        const { error } = await supabase
            .from('user_preferences')
            .upsert({
                user_id: userId,
                ...preferences,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id',
            });

        if (error) throw error;
    } catch (err) {
        console.error('Failed to save user preferences to database:', err);
        throw err;
    }
}

/**
 * Apply preferences to DOM (for immediate effect)
 */
export function applyPreferencesToDOM(preferences: Omit<UserPreferences, 'user_id' | 'updated_at' | 'created_at'>): void {
    // Theme
    document.documentElement.setAttribute('data-theme', preferences.theme);
    localStorage.setItem('optisched-theme', preferences.theme);

    // Time format
    localStorage.setItem('optisched-time-format', preferences.time_format);

    // Animations
    document.documentElement.setAttribute('data-landing-animations', String(preferences.landing_animations));
    document.documentElement.setAttribute('data-dashboard-animations', String(preferences.dashboard_animations));
    localStorage.setItem('optisched-landing-animations', String(preferences.landing_animations));
    localStorage.setItem('optisched-dashboard-animations', String(preferences.dashboard_animations));

    // Notifications
    localStorage.setItem('optisched-email-notifs', String(preferences.email_notifications));
    localStorage.setItem('optisched-schedule-notifs', String(preferences.schedule_notifications));
    localStorage.setItem('optisched-announcement-notifs', String(preferences.announcement_notifications));
}
