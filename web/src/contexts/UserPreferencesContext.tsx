import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { loadUserPreferences, saveUserPreferences, applyPreferencesToDOM, type UserPreferences } from '../lib/userPreferences';

interface UserPreferencesContextType {
    preferences: Omit<UserPreferences, 'user_id' | 'updated_at' | 'created_at'>;
    updatePreferences: (updates: Partial<Omit<UserPreferences, 'user_id' | 'updated_at' | 'created_at'>>) => Promise<void>;
    loading: boolean;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
    const { profile } = useAuth();
    const [preferences, setPreferences] = useState<Omit<UserPreferences, 'user_id' | 'updated_at' | 'created_at'>>({
        theme: 'light',
        time_format: '24h',
        landing_animations: true,
        dashboard_animations: false,
        email_notifications: true,
        schedule_notifications: true,
        announcement_notifications: true,
    });
    const [loading, setLoading] = useState(true);
    const initializedRef = useRef(false);

    useEffect(() => {
        if (!profile?.id || initializedRef.current) {
            return;
        }

        initializedRef.current = true;
        loadUserPreferences(profile.id).then((prefs) => {
            setPreferences(prefs);
            applyPreferencesToDOM(prefs);
            setLoading(false);
        }).catch((err) => {
            console.error('Failed to load user preferences:', err);
            setLoading(false);
        });
    }, [profile?.id]);

    const updatePreferences = async (updates: Partial<Omit<UserPreferences, 'user_id' | 'updated_at' | 'created_at'>>) => {
        if (!profile?.id) return;

        const newPreferences = { ...preferences, ...updates };
        setPreferences(newPreferences);
        applyPreferencesToDOM(newPreferences);

        try {
            await saveUserPreferences(profile.id, updates);
        } catch (err) {
            console.error('Failed to save user preferences:', err);
            // Revert on error
            setPreferences(preferences);
            applyPreferencesToDOM(preferences);
            throw err;
        }
    };

    return (
        <UserPreferencesContext.Provider value={{ preferences, updatePreferences, loading }}>
            {children}
        </UserPreferencesContext.Provider>
    );
}

export function useUserPreferences() {
    const context = useContext(UserPreferencesContext);
    if (!context) {
        throw new Error('useUserPreferences must be used within UserPreferencesProvider');
    }
    return context;
}
