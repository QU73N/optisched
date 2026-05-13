import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

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

        const channel = supabase
            .channel(`realtime-${tableName}-${Math.random().toString(36).slice(2, 8)}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: tableName,
            }, () => {
                fetchData();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchData, tableName]);

    return { data, loading, error, refetch: fetchData };
}

// ============ Schedules ============

export function useSchedules(filters?: {
    teacherId?: string;
    sectionId?: string;
    dayOfWeek?: string;
    status?: string;
    isActive?: boolean;
}) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSchedules = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Use RPC function to bypass RLS join issues
            const query = supabase.rpc('get_schedules_with_details');

            const { data: result, error: fetchError } = await query;
            if (fetchError) throw fetchError;

            // Map RPC response to expected format
            const mappedData = (result || []).map((s: any) => ({
                id: s.id,
                teacher_id: s.teacher_id,
                subject_id: s.subject_id,
                room_id: s.room_id,
                section_id: s.section_id,
                day_of_week: s.day_of_week,
                start_time: s.start_time,
                end_time: s.end_time,
                status: s.status,
                is_active: s.is_active ?? true, // Default to true if not present
                semester: s.semester,
                academic_year: s.academic_year,
                subject: { name: s.subject_name, code: s.subject_code },
                teacher: { id: s.teacher_id, profile: { full_name: s.teacher_name } },
                room: { id: s.room_id, name: s.room_name, building: s.room_building },
                section: { id: s.section_id, name: s.section_name, program: s.section_program },
            }));

            // Apply filters on client side since RPC doesn't support them
            let filteredData = mappedData;
            if (filters?.teacherId) {
                filteredData = filteredData.filter((s: any) => s.teacher_id === filters.teacherId);
            }
            if (filters?.sectionId) {
                filteredData = filteredData.filter((s: any) => s.section_id === filters.sectionId);
            }
            if (filters?.dayOfWeek) {
                filteredData = filteredData.filter((s: any) => s.day_of_week === filters.dayOfWeek);
            }
            if (filters?.status) {
                filteredData = filteredData.filter((s: any) => s.status === filters.status);
            }
            if (filters?.isActive !== undefined) {
                filteredData = filteredData.filter((s: any) => s.is_active === filters.isActive);
            }

            setData(filteredData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [filters?.teacherId, filters?.sectionId, filters?.dayOfWeek, filters?.status, filters?.isActive]);

    useEffect(() => {
        fetchSchedules();

        const channel = supabase
            .channel('schedules_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
                fetchSchedules();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchSchedules]);

    return { schedules: data, loading, error, refetch: fetchSchedules };
}

// ============ Teachers ============

export function useTeachers() {
    // Use RPC function to bypass RLS and join issues
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTeachers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Use RPC function
            const { data: result, error: fetchError } = await supabase.rpc('get_teachers_with_profiles');
            if (fetchError) throw fetchError;

            // Map RPC response to expected format with nested profile
            const mappedData = (result || []).map((t: any) => ({
                id: t.id,
                profile_id: t.profile_id,
                department: t.department,
                employment_type: t.employment_type,
                max_hours: t.max_hours,
                current_load_percentage: t.current_load_percentage,
                is_active: t.is_active,
                weight: t.weight,
                priority_note: t.priority_note,
                is_public: t.is_public,
                profile: {  // Nested profile object for compatibility
                    id: t.profile_id,
                    full_name: t.full_name,
                    email: t.email
                }
            }));

            setData(mappedData);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setError(message);
            console.error('Error fetching teachers:', message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTeachers();

        const channel = supabase
            .channel(`realtime-teachers-${Math.random().toString(36).slice(2, 8)}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'teachers'
            }, () => {
                fetchTeachers();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchTeachers]);

    const updateTeacher = async (teacherId: string, updates: any) => {
        const { error: err } = await supabase.from('teachers').update(updates).eq('id', teacherId);
        if (err) throw err;
        await fetchTeachers();
    };

    return { teachers: data, loading, error, refetch: fetchTeachers, updateTeacher };
}

// ============ Rooms ============

export function useRooms() {
    const { data, loading, error, refetch } = useFetch<any>('rooms');

    const createRoom = async (room: any) => {
        const { error: err } = await supabase.from('rooms').insert(room);
        if (err) throw err;
        await refetch();
    };

    const updateRoom = async (id: string, updates: any) => {
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
    const { data, loading, error, refetch } = useFetch<any>('subjects');

    const createSubject = async (subject: any) => {
        const { error: err } = await supabase.from('subjects').insert(subject);
        if (err) throw err;
        await refetch();
    };

    const updateSubject = async (id: string, updates: any) => {
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
    const { data, loading, error, refetch } = useFetch<any>('sections');

    const createSection = async (section: any) => {
        const { error: err } = await supabase.from('sections').insert(section);
        if (err) throw err;
        await refetch();
    };

    const updateSection = async (id: string, updates: any) => {
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
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTasks = useCallback(async () => {
        try {
            setLoading(true);
            let query = supabase.from('admin_tasks').select('*').order('created_at', { ascending: false });
            if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter);
            const { data, error: fetchError } = await query;
            if (fetchError) throw fetchError;
            setTasks(data || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => { fetchTasks(); }, [fetchTasks]);

    const updateTask = async (taskId: string, updates: any) => {
        const { error: updateError } = await supabase.from('admin_tasks').update(updates).eq('id', taskId);
        if (!updateError) fetchTasks();
        return updateError;
    };

    const createTask = async (task: { title: string; description: string; priority: string; status?: string; progress?: number }) => {
        const { error: insertError } = await supabase.from('admin_tasks').insert({
            ...task, status: task.status || 'pending', progress: task.progress || 0,
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
    const [conflicts, setConflicts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchConflicts = useCallback(async () => {
        try {
            setLoading(true);
            let query = supabase.from('conflicts').select('*').order('created_at', { ascending: false });
            if (!showResolved) query = query.eq('is_resolved', false);
            const { data, error: fetchError } = await query;
            if (fetchError) throw fetchError;
            setConflicts(data || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [showResolved]);

    useEffect(() => { fetchConflicts(); }, [fetchConflicts]);

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
    const [preferences, setPreferences] = useState<any | null>(null);
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
                .maybeSingle();
            if (fetchError) throw fetchError;
            setPreferences(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [teacherId]);

    useEffect(() => { fetchPreferences(); }, [fetchPreferences]);

    const updatePreferences = async (updates: any) => {
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
                setAnnouncements([]);
            } else {
                setAnnouncements(data || []);
            }
        } catch (err) {
            console.error('[Announcements] Error:', err);
            setAnnouncements([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAnnouncements();

        const channel = supabase
            .channel('announcements_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => {
                fetchAnnouncements();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchAnnouncements]);

    const createAnnouncement = async (title: string, content: string, authorId: string, authorName: string, priority: string = 'normal', targetSection?: string) => {
        const insertData: any = { title, content, author_id: authorId, author_name: authorName, priority };
        if (targetSection) insertData.target_section = targetSection;
        const { data, error } = await supabase.from('announcements').insert(insertData).select().maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Failed to create announcement');
        await fetchAnnouncements();
        return data;
    };

    const updateAnnouncement = async (id: string, updates: { title?: string; content?: string; priority?: string }) => {
        const { error } = await supabase.from('announcements').update(updates).eq('id', id);
        if (error) throw error;
        await fetchAnnouncements();
    };

    const deleteAnnouncement = async (id: string) => {
        const { error } = await supabase.from('announcements').delete().eq('id', id);
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
            let query = supabase.from('schedule_change_requests').select('*').order('created_at', { ascending: false });
            if (filterStatus) query = query.eq('status', filterStatus);

            const { data, error } = await query;
            if (error) {
                console.log('[ChangeRequests] Table not ready:', error.message);
                setRequests([]);
            } else {
                setRequests(data || []);
            }
        } catch (err) {
            console.error('[ChangeRequests] Error:', err);
            setRequests([]);
        } finally {
            setLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    const fetchRef = useRef(fetchRequests);
    fetchRef.current = fetchRequests;

    useEffect(() => {
        const channel = supabase
            .channel(`sched-req-rt-${filterStatus || 'all'}-${Math.random().toString(36).slice(2, 8)}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_change_requests' }, () => {
                fetchRef.current();
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [filterStatus]);

    const submitRequest = async (req: Omit<ScheduleChangeRequest, 'id' | 'status' | 'created_at' | 'admin_notes'>) => {
        const { error } = await supabase.from('schedule_change_requests').insert({ ...req, status: 'pending' });
        if (error) throw error;
        await fetchRequests();
    };

    const updateRequestStatus = async (id: string, status: string, adminNotes?: string) => {
        const { error } = await supabase.from('schedule_change_requests').update({ status, admin_notes: adminNotes }).eq('id', id);
        if (error) throw error;
        await fetchRequests();
    };

    const deleteRequest = async (id: string) => {
        const { error } = await supabase.from('schedule_change_requests').delete().eq('id', id);
        if (error) throw error;
        await fetchRequests();
    };

    return { requests, loading, refetch: fetchRequests, submitRequest, updateRequestStatus, deleteRequest };
}

// ============ Dashboard Stats ============

export function useAdminDashboardStats() {
    const [stats, setStats] = useState({
        totalSchedules: 0,
        publishedSchedules: 0,
        totalConflicts: 0,
        resolvedConflicts: 0,
        conflictFreeRate: 100,
        teacherCount: 0,
        roomCount: 0,
        sectionCount: 0,
    });
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        try {
            const [teachers, rooms, sections, schedulesRes, conflictsRes] = await Promise.all([
                supabase.from('teachers').select('id', { count: 'exact' }),
                supabase.from('rooms').select('id', { count: 'exact' }),
                supabase.from('sections').select('id', { count: 'exact' }),
                supabase.from('schedules').select('*').eq('status', 'published').eq('is_active', true),
                supabase.from('conflicts').select('id, is_resolved'),
            ]);

            const totalSchedules = schedulesRes.data?.length || 0;
            const totalConflicts = conflictsRes.data?.filter((c: any) => !c.is_resolved).length || 0;
            const resolvedConflicts = conflictsRes.data?.filter((c: any) => c.is_resolved).length || 0;
            const conflictFreeRate = totalSchedules > 0 ? Math.max(0, Math.round(((totalSchedules - totalConflicts) / totalSchedules) * 100)) : 100;

            setStats({
                totalSchedules,
                publishedSchedules: totalSchedules,
                totalConflicts,
                resolvedConflicts,
                conflictFreeRate,
                teacherCount: teachers.data?.length || 0,
                roomCount: rooms.data?.length || 0,
                sectionCount: sections.data?.length || 0,
            });
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        // Defer fetchStats to avoid synchronous setState in effect
        const timer = setTimeout(() => fetchStats(), 0);

        const tables = ['schedules', 'conflicts', 'teachers', 'rooms', 'sections'];
        const channels = tables.map(table =>
            supabase
                .channel(`stats-${table}-${Math.random().toString(36).slice(2, 8)}`)
                .on('postgres_changes', { event: '*', schema: 'public', table }, () => fetchStats())
                .subscribe()
        );

        return () => {
            clearTimeout(timer);
            channels.forEach(ch => supabase.removeChannel(ch));
        };
    }, [fetchStats]);

    return { stats, loading, refetch: fetchStats };
}
