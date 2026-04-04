import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile, UserRole } from '../types/database';
import { getAllRoles } from '../types/database';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    role: UserRole | null;
    roles: UserRole[];
    isLoading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [role, setRole] = useState<UserRole | null>(null);
    const [roles, setRoles] = useState<UserRole[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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
    }, []);

    const fetchProfile = async (userId: string, authUser?: User) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            if (error) throw error;
            setProfile(data as Profile);

            const primaryRole = (data.role as UserRole) || 'student';
            setRole(primaryRole);

            // Read additional_roles from auth user_metadata
            const additionalRoles = authUser?.user_metadata?.additional_roles as string[] | undefined;
            const allRoles = getAllRoles(primaryRole, additionalRoles);
            setRoles(allRoles);
        } catch (err) {
            console.error('Error fetching profile:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) return { error: error.message };
            return { error: null };
        } catch (err: any) {
            return { error: err?.message || 'An error occurred' };
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setProfile(null); setRole(null); setRoles([]);
    };

    return (
        <AuthContext.Provider value={{ session, user, profile, role, roles, isLoading, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
