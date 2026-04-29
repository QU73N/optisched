import { supabase } from '../lib/supabase';

export interface DetectedConflict {
    id: string;
    type: 'room_conflict' | 'teacher_overlap' | 'capacity_exceeded' | 'unassigned';
    severity: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    scheduleAId: string | null;
    scheduleBId: string | null;
    createdAt: string;
}

const timeRangesOverlap = (s1: string | null, e1: string | null, s2: string | null, e2: string | null): boolean => {
    if (!s1 || !e1 || !s2 || !e2) return false;
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    return toMin(s1) < toMin(e2) && toMin(s2) < toMin(e1);
};

/**
 * Real-time conflict detection system.
 * Checks for overlapping schedules, capacity issues, and unassigned slots.
 */
export const detectConflicts = (schedules: any[]): DetectedConflict[] => {
    const conflicts: DetectedConflict[] = [];
    let conflictId = 0;

    for (let i = 0; i < schedules.length; i++) {
        for (let j = i + 1; j < schedules.length; j++) {
            const a = schedules[i];
            const b = schedules[j];

            if (a.day_of_week !== b.day_of_week) continue;
            if (!timeRangesOverlap(a.start_time, a.end_time, b.start_time, b.end_time)) continue;

            // Room conflict
            if (a.room_id === b.room_id) {
                conflicts.push({
                    id: `conflict-${conflictId++}`,
                    type: 'room_conflict',
                    severity: 'high',
                    title: `Room Conflict: ${a.room?.name || a.room_id}`,
                    description: `Double booking at ${a.start_time} on ${a.day_of_week}. ${a.subject?.name || ''} and ${b.subject?.name || ''} assigned to same room.`,
                    scheduleAId: a.id,
                    scheduleBId: b.id,
                    createdAt: new Date().toISOString(),
                });
            }

            // Teacher overlap
            if (a.teacher_id === b.teacher_id) {
                conflicts.push({
                    id: `conflict-${conflictId++}`,
                    type: 'teacher_overlap',
                    severity: 'high',
                    title: `Teacher Overlap`,
                    description: `${a.teacher?.profile?.full_name || a.teacher?.full_name || 'Teacher'} assigned to two classes at ${a.start_time} on ${a.day_of_week}.`,
                    scheduleAId: a.id,
                    scheduleBId: b.id,
                    createdAt: new Date().toISOString(),
                });
            }
        }
    }

    // Capacity issues
    for (const schedule of schedules) {
        if (schedule.room && schedule.section) {
            if ((schedule.section.student_count || 0) > (schedule.room.capacity || 0) && schedule.room.capacity > 0) {
                conflicts.push({
                    id: `conflict-${conflictId++}`,
                    type: 'capacity_exceeded',
                    severity: 'medium',
                    title: `Capacity Warning: ${schedule.room.name}`,
                    description: `${schedule.section.name} has ${schedule.section.student_count} students but ${schedule.room.name} only holds ${schedule.room.capacity}.`,
                    scheduleAId: schedule.id,
                    scheduleBId: null,
                    createdAt: new Date().toISOString(),
                });
            }
        }
    }

    // Unassigned
    for (const schedule of schedules) {
        if (!schedule.room_id || !schedule.teacher_id) {
            conflicts.push({
                id: `conflict-${conflictId++}`,
                type: 'unassigned',
                severity: 'low',
                title: 'Unassigned Schedule Entry',
                description: `${schedule.subject?.name || 'Subject'} on ${schedule.day_of_week} is missing ${!schedule.room_id ? 'a room' : 'a teacher'} assignment.`,
                scheduleAId: schedule.id,
                scheduleBId: null,
                createdAt: new Date().toISOString(),
            });
        }
    }

    return conflicts;
};

/**
 * Subscribe to real-time schedule changes and trigger conflict detection
 */
export const subscribeToConflicts = (
    onConflictsDetected: (conflicts: DetectedConflict[]) => void
) => {
    const subscription = supabase
        .channel('schedule-changes-conflicts')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'schedules' },
            async () => {
                const { data } = await supabase
                    .from('schedules')
                    .select('*, subject:subjects(*), teacher:teachers(*, profile:profiles(*)), room:rooms(*), section:sections(*)')
                    .eq('status', 'published');

                if (data) {
                    const conflicts = detectConflicts(data);
                    onConflictsDetected(conflicts);
                }
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(subscription);
    };
};

export default { detectConflicts, subscribeToConflicts };
