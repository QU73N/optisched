import { supabase } from '../lib/supabase';
import type { InstitutionBreak } from '../types/database';

export async function getBreaks(
    academicYear?: string,
    semester?: string
): Promise<InstitutionBreak[]> {
    let query = supabase
        .from('institution_breaks')
        .select('*')
        .order('day_of_week')
        .order('start_time');

    if (academicYear) {
        query = query.eq('academic_year', academicYear);
    }
    if (semester) {
        query = query.eq('semester', semester);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

export async function getBreaksForDay(
    day: string,
    academicYear?: string,
    semester?: string
): Promise<InstitutionBreak[]> {
    const { data, error } = await supabase.rpc('get_breaks_for_day', {
        p_day: day,
        p_academic_year: academicYear || null,
        p_semester: semester || null
    });
    if (error) throw error;
    return data || [];
}

export async function isBreakTime(
    day: string,
    time: string,
    academicYear?: string,
    semester?: string
): Promise<boolean> {
    const { data, error } = await supabase.rpc('is_break_time', {
        p_day: day,
        p_time: time,
        p_academic_year: academicYear || null,
        p_semester: semester || null
    });
    if (error) throw error;
    return data || false;
}

export async function checkBreakConflict(
    day: string,
    startTime: string,
    endTime: string,
    academicYear?: string,
    semester?: string
): Promise<boolean> {
    const { data, error } = await supabase.rpc('check_break_conflict', {
        p_day: day,
        p_start_time: startTime,
        p_end_time: endTime,
        p_academic_year: academicYear || null,
        p_semester: semester || null
    });
    if (error) throw error;
    return data || false;
}

export async function createBreak(breakData: Omit<InstitutionBreak, 'id' | 'created_at' | 'updated_at'>): Promise<InstitutionBreak> {
    const { data, error } = await supabase
        .from('institution_breaks')
        .insert(breakData)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateBreak(id: string, breakData: Partial<Omit<InstitutionBreak, 'id' | 'created_at'>>): Promise<InstitutionBreak> {
    const { data, error } = await supabase
        .from('institution_breaks')
        .update({ ...breakData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteBreak(id: string): Promise<void> {
    const { error } = await supabase
        .from('institution_breaks')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

export async function toggleBreakActive(id: string, isActive: boolean): Promise<InstitutionBreak> {
    return updateBreak(id, { is_active: isActive });
}
