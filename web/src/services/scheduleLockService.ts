import { supabase } from '../lib/supabase';

export async function lockSchedule(scheduleId: string, reason?: string): Promise<boolean> {
    console.log('[scheduleLockService] LOCK SCHEDULE START:', { scheduleId, reason });
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
        console.error('[scheduleLockService] LOCK: User not authenticated');
        throw new Error('User not authenticated');
    }

    console.log('[scheduleLockService] LOCK: Calling lock_schedule RPC');
    const { data, error } = await supabase.rpc('lock_schedule', {
        p_schedule_id: scheduleId,
        p_locked_by: user.id,
        p_reason: reason || null
    });
    if (error) {
        console.error('[scheduleLockService] LOCK: RPC failed:', error);
        throw error;
    }
    console.log('[scheduleLockService] LOCK: Result:', data);
    return data || false;
}

export async function unlockSchedule(scheduleId: string): Promise<boolean> {
    console.log('[scheduleLockService] UNLOCK SCHEDULE START:', { scheduleId });
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
        console.error('[scheduleLockService] UNLOCK: User not authenticated');
        throw new Error('User not authenticated');
    }

    console.log('[scheduleLockService] UNLOCK: Calling unlock_schedule RPC');
    const { data, error } = await supabase.rpc('unlock_schedule', {
        p_schedule_id: scheduleId,
        p_unlocked_by: user.id
    });
    if (error) {
        console.error('[scheduleLockService] UNLOCK: RPC failed:', error);
        throw error;
    }
    console.log('[scheduleLockService] UNLOCK: Result:', data);
    return data || false;
}

export async function canModifySchedule(scheduleId: string): Promise<boolean> {
    console.log('[scheduleLockService] CAN MODIFY SCHEDULE START:', { scheduleId });
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
        console.error('[scheduleLockService] CAN MODIFY: User not authenticated');
        throw new Error('User not authenticated');
    }

    console.log('[scheduleLockService] CAN MODIFY: Calling can_modify_schedule RPC');
    const { data, error } = await supabase.rpc('can_modify_schedule', {
        p_schedule_id: scheduleId,
        p_user_id: user.id
    });
    if (error) {
        console.error('[scheduleLockService] CAN MODIFY: RPC failed:', error);
        throw error;
    }
    console.log('[scheduleLockService] CAN MODIFY: Result:', data);
    return data || false;
}

export async function lockSemesterSchedules(
    academicYear: string,
    semester: string,
    reason?: string
): Promise<number> {
    console.log('[scheduleLockService] LOCK SEMESTER START:', { academicYear, semester, reason });
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
        console.error('[scheduleLockService] LOCK SEMESTER: User not authenticated');
        throw new Error('User not authenticated');
    }

    console.log('[scheduleLockService] LOCK SEMESTER: Calling lock_semester_schedules RPC');
    const { data, error } = await supabase.rpc('lock_semester_schedules', {
        p_academic_year: academicYear,
        p_semester: semester,
        p_locked_by: user.id,
        p_reason: reason || null
    });
    if (error) {
        console.error('[scheduleLockService] LOCK SEMESTER: RPC failed:', error);
        throw error;
    }
    console.log('[scheduleLockService] LOCK SEMESTER: Locked count:', data);
    return data || 0;
}

export async function unlockSemesterSchedules(
    academicYear: string,
    semester: string
): Promise<number> {
    console.log('[scheduleLockService] UNLOCK SEMESTER START:', { academicYear, semester });
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
        console.error('[scheduleLockService] UNLOCK SEMESTER: User not authenticated');
        throw new Error('User not authenticated');
    }

    console.log('[scheduleLockService] UNLOCK SEMESTER: Calling unlock_semester_schedules RPC');
    const { data, error } = await supabase.rpc('unlock_semester_schedules', {
        p_academic_year: academicYear,
        p_semester: semester,
        p_unlocked_by: user.id
    });
    if (error) {
        console.error('[scheduleLockService] UNLOCK SEMESTER: RPC failed:', error);
        throw error;
    }
    console.log('[scheduleLockService] UNLOCK SEMESTER: Unlocked count:', data);
    return data || 0;
}

export async function getLockedSchedules(academicYear?: string, semester?: string) {
    console.log('[scheduleLockService] GET LOCKED SCHEDULES START:', { academicYear, semester });
    let query = supabase
        .from('schedules')
        .select(`
            *,
            teacher:teachers(id, profile_id:profiles(full_name, email)),
            room:rooms(name, building, capacity),
            section:sections(name, program, year_level),
            locked_by_user:profiles(full_name, email)
        `)
        .eq('is_locked', true)
        .order('locked_at', { ascending: false });

    if (academicYear) query = query.eq('academic_year', academicYear);
    if (semester) query = query.eq('semester', semester);

    const { data, error } = await query;
    if (error) {
        console.error('[scheduleLockService] GET LOCKED: Query failed:', error);
        throw error;
    }
    console.log('[scheduleLockService] GET LOCKED: Result count:', data?.length || 0);
    return data;
}
