import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../config/supabase';
import { supabaseAdmin } from '../config/supabase';
import { detectConflicts } from '../services/conflictDetector';
import { cacheData, getCachedData } from '../utils/localCache';
import {
    Schedule, Teacher, Room, Subject, Section,
    AdminTask, Conflict, Profile, TeacherPreference,
} from '../types/database';

// ============ Generic fetch hook ============

interface UseFetchResult<T> {
    data: T[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

function useFetch<T>(
    tableName: string,
    query?: string,
    deps: unknown[] = []
): UseFetchResult<T> {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const selectQuery = query || '*';
            const { data: result, error: fetchError } = await supabase
                .from(tableName)
                .select(selectQuery);

            if (fetchError) throw fetchError;
            setData((result as T[]) || []);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message);
            console.error(`Error fetching ${tableName}: `, message);
        } finally {
            setLoading(false);
        }
    }, [tableName, query, ...deps]);

    useEffect(() => {
        fetchData();

        // Subscribe to real-time changes on this table
        const channel = supabase
            .channel(`realtime - ${tableName} -${Math.random().toString(36).slice(2, 8)} `)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: tableName,
            }, () => {
                fetchData();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchData]);

    return { data, loading, error, refetch: fetchData };
}

// ============ Schedules ============

export function useSchedules(filters?: {
    teacherId?: string;
    sectionId?: string;
    dayOfWeek?: string;
    status?: string;
}) {
    const [data, setData] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cacheKey = `schedules_${filters?.teacherId || ''}_${filters?.sectionId || ''}_${filters?.dayOfWeek || ''}_${filters?.status || ''} `;

    const fetchSchedules = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            let query = supabase
                .from('schedules')
                .select(`
    *,
    subject: subjects(*),
        teacher: teachers(*, profile: profiles(*)),
            room: rooms(*),
                section: sections(*)
        `)
                .order('start_time', { ascending: true });

            if (filters?.teacherId) query = query.eq('teacher_id', filters.teacherId);
            if (filters?.sectionId) query = query.eq('section_id', filters.sectionId);
            if (filters?.dayOfWeek) query = query.eq('day_of_week', filters.dayOfWeek);
            if (filters?.status) query = query.eq('status', filters.status);

            const { data: result, error: fetchError } = await query;
            if (fetchError) throw fetchError;
            const schedules = (result as Schedule[]) || [];
            setData(schedules);
            // Cache for offline use
            cacheData(cacheKey, schedules);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            // If fetch fails (offline), load from cache
            const cached = await getCachedData<Schedule[]>(cacheKey);
            if (cached.data) {
                setData(cached.data);
                setError(null);
            }
        } finally {
            setLoading(false);
        }
    }, [filters?.teacherId, filters?.sectionId, filters?.dayOfWeek, filters?.status]);

    // Load cached data immediately on mount, then fetch fresh + subscribe to realtime
    useEffect(() => {
        (async () => {
            const cached = await getCachedData<Schedule[]>(cacheKey);
            if (cached.data && cached.data.length > 0) {
                setData(cached.data);
                setLoading(false);
            }
            fetchSchedules();
        })();

        // Request notification permissions gracefully on mount
        try {
            const { NotificationService } = require('../services/notificationService');
            NotificationService.requestPermissionsAsync();
        } catch (e) {
            console.log('[useSupabase] Skipped requesting local notification perm:', e);
        }

        // Realtime subscription for schedule changes
        const channel = supabase
            .channel('schedules_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, (payload) => {
                // Determine if this change affects the current loaded data
                const shouldNotify = () => {
                    const rec = (payload.new as any) || (payload.old as any);
                    if (!rec) return false;
                    if (filters?.teacherId && rec.teacher_id !== filters.teacherId) return false;
                    if (filters?.sectionId && rec.section_id !== filters.sectionId) return false;
                    return true;
                };

                if (shouldNotify()) {
                    try {
                        const { NotificationService } = require('../services/notificationService');
                        if (payload.eventType === 'INSERT') {
                            NotificationService.notify('New Schedule Added', 'A new class has been added to your timetable.');
                        } else if (payload.eventType === 'UPDATE') {
                            NotificationService.notify('Schedule Updated', 'One of your classes was just modified.');
                        }
                    } catch (e) {
                        // ignore if lazy require fails in mock mode
                    }
                }

                fetchSchedules();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchSchedules]);

    return { schedules: data, loading, error, refetch: fetchSchedules };
}

// ============ Teachers ============

export function useTeachers() {
    const { data, loading, error, refetch } = useFetch<Teacher>(
        'teachers',
        '*, profile:profiles(*)'
    );

    const updateTeacher = async (teacherId: string, updates: Partial<Teacher>) => {
        const { error: err } = await supabase.from('teachers').update(updates).eq('id', teacherId);
        if (err) throw err;
        await refetch();
    };

    return { teachers: data, loading, error, refetch, updateTeacher };
}

// ============ Rooms ============

export function useRooms() {
    const { data, loading, error, refetch } = useFetch<Room>('rooms');

    const createRoom = async (room: Omit<Room, 'id' | 'created_at'>) => {
        const { error: err } = await supabase.from('rooms').insert(room);
        if (err) throw err;
        await refetch();
    };

    const updateRoom = async (id: string, updates: Partial<Room>) => {
        const { error: err } = await supabase.from('rooms').update(updates).eq('id', id);
        if (err) throw err;
        await refetch();
    };

    const deleteRoom = async (id: string) => {
        const { error: err } = await supabase.from('rooms').delete().eq('id', id);
        if (err) throw err;
        await refetch();
    };

    return { rooms: data, loading, error, refetch, createRoom, updateRoom, deleteRoom };
}

// ============ Subjects ============

export function useSubjects() {
    const { data, loading, error, refetch } = useFetch<Subject>('subjects');

    const createSubject = async (subject: Omit<Subject, 'id' | 'created_at'>) => {
        const { error: err } = await supabase.from('subjects').insert(subject);
        if (err) throw err;
        await refetch();
    };

    const updateSubject = async (id: string, updates: Partial<Subject>) => {
        const { error: err } = await supabase.from('subjects').update(updates).eq('id', id);
        if (err) throw err;
        await refetch();
    };

    const deleteSubject = async (id: string) => {
        const { error: err } = await supabase.from('subjects').delete().eq('id', id);
        if (err) throw err;
        await refetch();
    };

    return { subjects: data, loading, error, refetch, createSubject, updateSubject, deleteSubject };
}

// ============ Sections ============

export function useSections() {
    const { data, loading, error, refetch } = useFetch<Section>('sections');

    const createSection = async (section: Omit<Section, 'id' | 'created_at'>) => {
        const { error: err } = await supabase.from('sections').insert(section);
        if (err) throw err;
        await refetch();
    };

    const updateSection = async (id: string, updates: Partial<Section>) => {
        const { error: err } = await supabase.from('sections').update(updates).eq('id', id);
        if (err) throw err;
        await refetch();
    };

    const deleteSection = async (id: string) => {
        const { error: err } = await supabase.from('sections').delete().eq('id', id);
        if (err) throw err;
        await refetch();
    };

    return { sections: data, loading, error, refetch, createSection, updateSection, deleteSection };
}

// ============ Admin Tasks ============

export function useAdminTasks(statusFilter?: string) {
    const [tasks, setTasks] = useState<AdminTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTasks = useCallback(async () => {
        try {
            setLoading(true);
            let query = supabase.from('admin_tasks').select('*').order('created_at', { ascending: false });
            if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter);
            const { data, error: fetchError } = await query;
            if (fetchError) throw fetchError;
            setTasks((data as AdminTask[]) || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    const updateTask = async (taskId: string, updates: Partial<AdminTask>) => {
        const { error: updateError } = await supabase
            .from('admin_tasks')
            .update(updates)
            .eq('id', taskId);
        if (!updateError) fetchTasks();
        return updateError;
    };

    const createTask = async (task: { title: string; description: string; priority: string; status?: string; progress?: number }) => {
        const { error: insertError } = await supabase.from('admin_tasks').insert({
            ...task,
            status: task.status || 'pending',
            progress: task.progress || 0,
        });
        if (insertError) throw insertError;
        await fetchTasks();
    };

    const deleteTask = async (taskId: string) => {
        const { error: deleteError } = await supabase.from('admin_tasks').delete().eq('id', taskId);
        if (deleteError) throw deleteError;
        await fetchTasks();
    };

    return { tasks, loading, error, refetch: fetchTasks, updateTask, createTask, deleteTask };
}

// ============ Conflicts ============

export function useConflicts(showResolved = false) {
    const [conflicts, setConflicts] = useState<Conflict[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchConflicts = useCallback(async () => {
        try {
            setLoading(true);
            let query = supabase.from('conflicts').select('*').order('created_at', { ascending: false });
            if (!showResolved) query = query.eq('is_resolved', false);
            const { data, error: fetchError } = await query;
            if (fetchError) throw fetchError;
            setConflicts((data as Conflict[]) || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [showResolved]);

    useEffect(() => {
        fetchConflicts();
    }, [fetchConflicts]);

    const resolveConflict = async (conflictId: string, resolvedBy: string) => {
        const { error: updateError } = await supabase
            .from('conflicts')
            .update({ is_resolved: true, resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
            .eq('id', conflictId);
        if (!updateError) fetchConflicts();
        return updateError;
    };

    return { conflicts, loading, error, refetch: fetchConflicts, resolveConflict };
}

// ============ Teacher Preferences ============

export function useTeacherPreferences(teacherId?: string) {
    const [preferences, setPreferences] = useState<TeacherPreference | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPreferences = useCallback(async () => {
        if (!teacherId) { setLoading(false); return; }
        try {
            setLoading(true);
            const { data, error: fetchError } = await supabase
                .from('teacher_preferences')
                .select('*')
                .eq('teacher_id', teacherId)
                .single();
            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
            setPreferences(data as TeacherPreference | null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [teacherId]);

    useEffect(() => {
        fetchPreferences();
    }, [fetchPreferences]);

    const updatePreferences = async (updates: Partial<TeacherPreference>) => {
        if (!teacherId) return;
        const { error: updateError } = await supabase
            .from('teacher_preferences')
            .upsert({ teacher_id: teacherId, ...updates, last_updated: new Date().toISOString() })
            .eq('teacher_id', teacherId);
        if (!updateError) fetchPreferences();
        return updateError;
    };

    return { preferences, loading, error, refetch: fetchPreferences, updatePreferences };
}

// ============ Profile ============

export function useProfile(userId?: string) {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) { setLoading(false); return; }
        const fetch = async () => {
            setLoading(true);
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            setProfile(data as Profile | null);
            setLoading(false);
        };
        fetch();
    }, [userId]);

    return { profile, loading };
}

// ============ Dashboard Stats (computed) ============

export function useAdminDashboardStats() {
    const [stats, setStats] = useState({
        totalSchedules: 0,
        publishedSchedules: 0,
        totalConflicts: 0,
        resolvedConflicts: 0,
        conflictFreeRate: 100,
        teacherCount: 0,
    });
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        const [teachers, rooms, schedulesRes] = await Promise.all([
            supabase.from('teachers').select('id', { count: 'exact' }),
            supabase.from('rooms').select('id', { count: 'exact' }),
            supabase.from('schedules')
                .select('*, subject:subjects(*), teacher:teachers(*, profile:profiles(*)), room:rooms(*), section:sections(*)')
                .eq('status', 'published'), // Only evaluate published schedules for dashboard health
        ]);

        const totalSchedules = schedulesRes.data?.length || 0;
        const publishedSchedules = totalSchedules; // all are published based on query
        const totalRooms = rooms.data?.length || 0;

        // Calculate accurate conflicts using the in-memory engine
        const detectedConflicts = schedulesRes.data ? detectConflicts(schedulesRes.data as any) : [];
        const totalConflicts = detectedConflicts.length;
        const resolvedConflicts = 0; // The engine strictly flags active conflicts

        // Conflict-free rate = (total schedules - schedules involved in conflicts) / total schedules
        // First determine how many unique schedules are causing conflicts
        const conflictingScheduleIds = new Set<string>();
        detectedConflicts.forEach(c => {
            if (c.scheduleAId) conflictingScheduleIds.add(c.scheduleAId);
            if (c.scheduleBId) conflictingScheduleIds.add(c.scheduleBId);
        });

        const schedulesWithConflicts = conflictingScheduleIds.size;
        const conflictFreeRate = totalSchedules > 0
            ? Math.max(0, Math.round(((totalSchedules - schedulesWithConflicts) / totalSchedules) * 100))
            : 100;

        setStats({
            totalSchedules,
            publishedSchedules,
            totalConflicts,
            resolvedConflicts,
            conflictFreeRate,
            teacherCount: teachers.data?.length || 0,
        });
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchStats();

        // Real-time updates for stats
        const tables = ['schedules', 'conflicts', 'teachers', 'rooms'];
        const channels = tables.map(table =>
            supabase
                .channel(`stats - ${table} -${Math.random().toString(36).slice(2, 8)} `)
                .on('postgres_changes', { event: '*', schema: 'public', table }, () => fetchStats())
                .subscribe()
        );

        return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
    }, [fetchStats]);

    return { stats, loading };
}

// ============ Announcements ============

export interface Announcement {
    id: string;
    title: string;
    content: string;
    author_id: string;
    author_name: string;
    priority: 'normal' | 'important' | 'urgent';
    target_section?: string;
    created_at: string;
}

export function useAnnouncements() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAnnouncements = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.log('[Announcements] Table not ready:', error.message);
                // Load from cache if fetch fails
                const cached = await getCachedData<Announcement[]>('announcements');
                if (cached.data) {
                    setAnnouncements(cached.data);
                } else {
                    setAnnouncements([]);
                }
            } else {
                setAnnouncements(data || []);
                // Cache for offline use
                cacheData('announcements', data || []);
            }
        } catch (err) {
            console.error('[Announcements] Error:', err);
            // If network error, load from cache
            const cached = await getCachedData<Announcement[]>('announcements');
            if (cached.data) {
                setAnnouncements(cached.data);
            } else {
                setAnnouncements([]);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    // Load cached data immediately, then fetch fresh
    useEffect(() => {
        (async () => {
            const cached = await getCachedData<Announcement[]>('announcements');
            if (cached.data && cached.data.length > 0) {
                setAnnouncements(cached.data);
                setLoading(false);
            }
            fetchAnnouncements();
        })();
    }, [fetchAnnouncements]);

    // Real-time subscription for announcements
    useEffect(() => {
        // Realtime subscription for announcements
        const channel = supabase
            .channel('announcements_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, (payload) => {
                const rec = (payload.new as any);
                if (payload.eventType === 'INSERT' && rec) {
                    try {
                        const { NotificationService } = require('../services/notificationService');
                        NotificationService.notify('New Announcement', rec.title || 'Check the dashboard for details.');
                    } catch (e) {
                        // silently ignore missing mock notification
                    }
                }
                fetchAnnouncements();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchAnnouncements]);

    const createAnnouncement = async (title: string, content: string, authorId: string, authorName: string, priority: string = 'normal', targetSection?: string) => {
        const insertData: any = {
            title,
            content,
            author_id: authorId,
            author_name: authorName,
            priority,
        };
        // Store target_section if the column exists
        if (targetSection) insertData.target_section = targetSection;
        const { data, error } = await supabase.from('announcements').insert(insertData).select().single();

        if (error) throw error;
        await fetchAnnouncements();
        return data;
    };

    const updateAnnouncement = async (id: string, updates: { title?: string; content?: string; priority?: string }) => {
        const client = supabaseAdmin || supabase;
        const { error } = await client.from('announcements').update(updates).eq('id', id);
        if (error) throw error;
        await fetchAnnouncements();
    };

    const deleteAnnouncement = async (id: string) => {
        const client = supabaseAdmin || supabase;
        const { error } = await client.from('announcements').delete().eq('id', id);
        if (error) throw error;
        await fetchAnnouncements();
    };

    return { announcements, loading, refetch: fetchAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement };
}

// ============ Schedule Change Requests ============

export interface ScheduleChangeRequest {
    id: string;
    teacher_id: string;
    teacher_name: string;
    schedule_id?: string | null;
    request_type: 'reschedule' | 'cancel' | 'swap';
    reason: string;
    proposed_day?: string;
    proposed_time?: string;
    status: 'pending' | 'approved' | 'rejected';
    admin_notes?: string;
    created_at: string;
}

export function useScheduleChangeRequests(filterStatus?: string) {
    const [requests, setRequests] = useState<ScheduleChangeRequest[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRequests = useCallback(async () => {
        try {
            setLoading(true);
            const client = supabaseAdmin || supabase;
            let query = client.from('schedule_change_requests').select('*').order('created_at', { ascending: false });
            if (filterStatus) query = query.eq('status', filterStatus);

            const { data, error } = await query;
            if (error) {
                console.log('[ChangeRequests] Table not ready:', error.message);
                setRequests([]);
            } else {
                setRequests(data || []);
            }
        } catch (err) {
            setRequests([]);
        } finally {
            setLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    // Real-time subscription — use a ref so we don't re-subscribe on fetchRequests changes
    const fetchRef = useRef(fetchRequests);
    fetchRef.current = fetchRequests;

    useEffect(() => {
        const channelName = `sched - req - rt - ${filterStatus || 'all'} -${Math.random().toString(36).slice(2, 8)} `;
        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_change_requests' }, (_payload) => {
                console.log('[ChangeRequests] Real-time event received, refetching...');
                fetchRef.current();
            })
            .subscribe((status) => {
                console.log('[ChangeRequests] Subscription status:', status);
            });
        return () => { supabase.removeChannel(channel); };
    }, [filterStatus]);

    const submitRequest = async (req: Omit<ScheduleChangeRequest, 'id' | 'status' | 'created_at' | 'admin_notes'>) => {
        const { error } = await supabase.from('schedule_change_requests').insert({ ...req, status: 'pending' });
        if (error) throw error;
        await fetchRequests();
    };

    const updateRequestStatus = async (id: string, status: string, adminNotes?: string) => {
        const client = supabaseAdmin || supabase;
        const { error } = await client.from('schedule_change_requests').update({ status, admin_notes: adminNotes }).eq('id', id);
        if (error) throw error;
        await fetchRequests();
    };

    const deleteRequest = async (id: string) => {
        const client = supabaseAdmin || supabase;
        const { error } = await client.from('schedule_change_requests').delete().eq('id', id);
        if (error) throw error;
        await fetchRequests();
    };

    return { requests, loading, refetch: fetchRequests, submitRequest, updateRequestStatus, deleteRequest };
}
