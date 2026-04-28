import { supabase } from '../lib/supabase';

export async function lockSchedule(scheduleId: string, reason?: string): Promise<boolean> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.rpc('lock_schedule', {
        p_schedule_id: scheduleId,
        p_locked_by: user.id,
        p_reason: reason || null
    });
    if (error) throw error;
    return data || false;
}

export async function unlockSchedule(scheduleId: string): Promise<boolean> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.rpc('unlock_schedule', {
        p_schedule_id: scheduleId,
        p_unlocked_by: user.id
    });
    if (error) throw error;
    return data || false;
}

export async function canModifySchedule(scheduleId: string): Promise<boolean> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.rpc('can_modify_schedule', {
        p_schedule_id: scheduleId,
        p_user_id: user.id
    });
    if (error) throw error;
    return data || false;
}

export async function lockSemesterSchedules(
    academicYear: string,
    semester: string,
    reason?: string
): Promise<number> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.rpc('lock_semester_schedules', {
        p_academic_year: academicYear,
        p_semester: semester,
        p_locked_by: user.id,
        p_reason: reason || null
    });
    if (error) throw error;
    return data || 0;
}

export async function unlockSemesterSchedules(
    academicYear: string,
    semester: string
): Promise<number> {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase.rpc('unlock_semester_schedules', {
        p_academic_year: academicYear,
        p_semester: semester,
        p_unlocked_by: user.id
    });
    if (error) throw error;
    return data || 0;
}

export async function getLockedSchedules(academicYear?: string, semester?: string) {
    let query = supabase
        .from('schedules')
        .select(`
            *,
            teacher:teachers(id, profile:profiles(full_name, email)),
            room:rooms(name, building, capacity),
            section:sections(name, program, year_level),
            locked_by_user:profiles(full_name, email)
        `)
        .eq('is_locked', true)
        .order('locked_at', { ascending: false });

    if (academicYear) query = query.eq('academic_year', academicYear);
    if (semester) query = query.eq('semester', semester);

    const { data, error } = await query;
    if (error) throw error;
    return data;
}
