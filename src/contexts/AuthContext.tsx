import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '../config/supabase';
import { cacheData, getCachedData } from '../utils/localCache';
import { Profile, UserRole } from '../types/database';
import { Session } from '@supabase/supabase-js';

interface AuthState {
    session: Session | null;
    profile: Profile | null;
    role: UserRole | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AuthState>({
        session: null,
        profile: null,
        role: null,
        isLoading: true,
        isAuthenticated: false,
    });

    const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
        try {
            console.log('[Auth] Fetching profile for user:', userId);
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('[Auth] Error fetching profile:', error.message);
                // If profile not found in DB or offline network error, attempt to load from local cache
                const cachedProfile = await getCachedData<Profile>(`profile_${userId}`);
                if (cachedProfile.data) {
                    console.log('[Auth] Loaded profile from offline cache');
                    return cachedProfile.data;
                }
                return null;
            }
            console.log('[Auth] Profile found:', data?.role, data?.full_name, '| section:', data?.section, '| program:', data?.program, '| year_level:', data?.year_level);
            
            // Cache the fresh profile for future offline use
            await cacheData(`profile_${userId}`, data);
            
            return data as Profile;
        } catch (err) {
            console.error('[Auth] Profile fetch exception:', err);
            // Attempt cache fallback on exception
            const cachedProfile = await getCachedData<Profile>(`profile_${userId}`);
            if (cachedProfile.data) {
                console.log('[Auth] Loaded profile from offline cache due to exception');
                return cachedProfile.data;
            }
            return null;
        }
    }, []);

    const refreshProfile = useCallback(async () => {
        if (state.session?.user?.id) {
            const profile = await fetchProfile(state.session.user.id);
            if (profile) {
                setState(prev => ({
                    ...prev,
                    profile,
                    role: profile.role,
                }));
            }
        }
    }, [state.session, fetchProfile]);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            console.log('[Auth] Initial session:', session ? 'exists' : 'none');
            if (session?.user?.id) {
                fetchProfile(session.user.id).then(profile => {
                    const role = profile?.role || (session.user.user_metadata?.role as UserRole) || null;
                    console.log('[Auth] Setting authenticated state, role:', role);
                    setState({
                        session,
                        profile,
                        role,
                        isLoading: false,
                        isAuthenticated: true,
                    });
                });
            } else {
                setState(prev => ({ ...prev, isLoading: false }));
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('[Auth] Auth state change:', event);
                if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user?.id) {
                    const profile = await fetchProfile(session.user.id);
                    // Fallback: get role from user_metadata if profile doesn't exist yet
                    const role = profile?.role || (session.user.user_metadata?.role as UserRole) || null;
                    console.log('[Auth] Setting state after', event, '- role:', role);
                    setState({
                        session,
                        profile,
                        role,
                        isLoading: false,
                        isAuthenticated: true,
                    });
                } else if (event === 'SIGNED_OUT') {
                    setState({
                        session: null,
                        profile: null,
                        role: null,
                        isLoading: false,
                        isAuthenticated: false,
                    });
                }
            }
        );

        return () => subscription.unsubscribe();
    }, [fetchProfile]);

    // Realtime profile listener — update profile when admin changes section etc.
    useEffect(() => {
        if (!state.session?.user?.id) return;
        const userId = state.session.user.id;

        const profileChannel = supabase
            .channel(`profile_realtime_${userId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${userId}`,
            }, async (payload) => {
                console.log('[Auth] Profile updated via realtime:', payload.new);
                const updatedProfile = payload.new as Profile;
                setState(prev => ({
                    ...prev,
                    profile: updatedProfile,
                    role: updatedProfile.role,
                }));
            })
            .subscribe();

        return () => { supabase.removeChannel(profileChannel); };
    }, [state.session?.user?.id]);

    const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
        try {
            setState(prev => ({ ...prev, isLoading: true }));
            console.log('[Auth] Attempting sign in for:', email);
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) {
                console.error('[Auth] Sign in error:', error.message);
                setState(prev => ({ ...prev, isLoading: false }));
                return { error: error.message };
            }

            console.log('[Auth] Sign in successful, user:', data.user?.id);

            // Directly set authenticated state without waiting for onAuthStateChange
            if (data.session && data.user) {
                const profile = await fetchProfile(data.user.id);
                const role = profile?.role || (data.user.user_metadata?.role as UserRole) || 'student';
                console.log('[Auth] Direct state update - role:', role);
                setState({
                    session: data.session,
                    profile,
                    role,
                    isLoading: false,
                    isAuthenticated: true,
                });
            }

            return { error: null };
        } catch (err) {
            console.error('[Auth] Sign in exception:', err);
            setState(prev => ({ ...prev, isLoading: false }));
            return { error: 'An unexpected error occurred' };
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setState({
            session: null,
            profile: null,
            role: null,
            isLoading: false,
            isAuthenticated: false,
        });
    };

    return (
        <AuthContext.Provider value={{ ...state, signIn, signOut, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;
