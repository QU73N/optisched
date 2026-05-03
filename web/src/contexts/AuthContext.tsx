import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile, UserRole } from '../types/database';
import { getAllRoles } from '../types/database';
import { logActivity } from '../hooks/useActivityLogger';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    role: UserRole | null;
    roles: UserRole[];
    isLoading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
    switchRole: (role: UserRole) => void;
    refreshSession: () => Promise<void>;
    getRule: (ruleKey: string) => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [role, setRole] = useState<UserRole | null>(null);
    const [roles, setRoles] = useState<UserRole[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchProfile = useCallback(async (userId: string, authUser?: User) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();
            if (error) throw error;
            
            if (!data) {
                console.warn('Profile not found for user:', userId);
                setProfile(null);
                setRole(null);
                setRoles([]);
                setIsLoading(false);
                return;
            }
            
            setProfile(data as Profile);

            const primaryRole = (data.role as UserRole) || 'student';
            setRole(primaryRole);

            // Read additional_roles from auth app_metadata (admin-only, not user-writable)
            const additionalRoles = authUser?.app_metadata?.additional_roles as string[] | undefined;
            const allRoles = getAllRoles(primaryRole, additionalRoles);
            setRoles(allRoles);
        } catch (err) {
            console.error('Error fetching profile:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error) {
                console.warn('Session recovery failed:', error.message);
                supabase.auth.signOut();
                setSession(null); setUser(null); setProfile(null); setRole(null); setRoles([]);
                setIsLoading(false);
                return;
            }
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id, session.user);
            } else {
                setIsLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id, session.user);
            } else {
                setProfile(null); setRole(null); setRoles([]);
                setIsLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, [fetchProfile]);

    const signIn = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
        const start = performance.now();
        try {
            // Server-enforced login rate limit (Session 2 / C3).
            // 5 attempts per 5 minutes per email, regardless of UI.
            try {
                const { data: rl } = await supabase.rpc('rate_limit_login', { p_email: email });
                const result = rl as { allowed?: boolean; retry_after_seconds?: number } | null;
                if (result && result.allowed === false) {
                    const wait = result.retry_after_seconds ?? 60;
                    return { error: `Too many login attempts. Try again in ${wait}s.` };
                }
            } catch {
                // Rate-limit RPC unavailable (e.g. fresh DB without create_rate_limits.sql);
                // fail-open so login still works during rollout.
            }

            const { error } = await supabase.auth.signInWithPassword({ email, password });
            const ms = Math.round(performance.now() - start);
            if (error) {
                // Best-effort: log failure (will be a no-op pre-auth, but handles MFA edge cases)
                await logActivity({
                    actionType: 'login',
                    resource: 'auth',
                    success: false,
                    error: error.message,
                    durationMs: ms,
                    details: { email },
                });
                return { error: error.message };
            }
            await logActivity({
                actionType: 'login',
                resource: 'auth',
                success: true,
                durationMs: ms,
                details: { email },
            });
            return { error: null };
        } catch (err: unknown) {
            return { error: (err as Error)?.message || 'An error occurred' };
        }
    }, []);

    const signOut = useCallback(async () => {
        await logActivity({ actionType: 'logout', resource: 'auth' });
        await supabase.auth.signOut();
        setProfile(null); setRole(null); setRoles([]);
        localStorage.removeItem('optisched-selected-role');
    }, []);

    const switchRole = useCallback((newRole: UserRole) => {
        if (!roles.includes(newRole)) {
            console.warn('Cannot switch to role not in user roles:', newRole);
            return;
        }
        setRole(newRole);
        localStorage.setItem('optisched-selected-role', newRole);
        void logActivity({ actionType: 'role_switch', resource: 'auth', details: { from: role, to: newRole } });
    }, [roles, role]);

    const refreshSession = useCallback(async () => {
        const { error } = await supabase.auth.refreshSession();
        if (error) {
            console.error('Session refresh failed:', error);
            throw error;
        }
        // Session will be updated via onAuthStateChange listener
    }, []);

    const getRule = useCallback((ruleKey: string): string | null => {
        // Fetch system rule from database
        // This would typically be cached and updated periodically
        // For now, return null as a placeholder
        console.warn('getRule() not yet implemented - returning null for:', ruleKey);
        return null;
    }, []);

    // Restore selected role from localStorage on mount
    useEffect(() => {
        if (roles.length > 0) {
            const savedRole = localStorage.getItem('optisched-selected-role') as UserRole | null;
            if (savedRole && roles.includes(savedRole)) {
                setRole(savedRole);
            }
        }
    }, [roles]);

    const value = useMemo<AuthContextType>(
        () => ({ session, user, profile, role, roles, isLoading, signIn, signOut, switchRole, refreshSession, getRule }),
        [session, user, profile, role, roles, isLoading, signIn, signOut, switchRole, refreshSession, getRule],
    );

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
