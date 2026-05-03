import { supabase } from '../lib/supabase';

let cachedSchoolTz: string | null = null;

async function getSchoolTimezone(): Promise<string> {
    if (cachedSchoolTz) return cachedSchoolTz;
    try {
        const { data } = await supabase
            .from('system_rules')
            .select('value')
            .eq('key', 'school_timezone')
            .maybeSingle();
        if (data && typeof data.value === 'string') {
            cachedSchoolTz = data.value;
            return data.value;
        }
    } catch {
        // Fall back to UTC if query fails
    }
    return 'UTC';
}

export async function formatInSchoolTz(date: Date | string, options?: Intl.DateTimeFormatOptions): Promise<string> {
    const tz = await getSchoolTimezone();
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...options,
    });
}

export async function formatDateInSchoolTz(date: Date | string): Promise<string> {
    return formatInSchoolTz(date, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

export async function formatTimeInSchoolTz(date: Date | string): Promise<string> {
    return formatInSchoolTz(date, {
        hour: '2-digit',
        minute: '2-digit',
    });
}
