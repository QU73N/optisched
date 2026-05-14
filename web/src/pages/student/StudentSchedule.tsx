import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { CalendarDays, Clock, MapPin, List, LayoutGrid, CalendarRange, Download } from 'lucide-react';
import { toCsv, downloadCsv } from '../../utils/csv';
import '../admin/Dashboard.css';

interface ScheduleItem {
    id: string; day_of_week: string; start_time: string; end_time: string;
    subject: { name: string; code: string } | null;
    room: { name: string; building: string } | null;
    teacher: { profile: { full_name: string } | null } | null;
}

const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const START_HOUR = 7;
const END_HOUR = 19;
const SLOT_MINUTES = 30;
const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;
const EVENT_COLORS = ['c-navy', 'c-core', 'c-bright', 'c-ice'] as const;

const slotFromTime = (t: string): number => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    const mins = (h * 60 + m) - START_HOUR * 60;
    return Math.max(0, Math.min(TOTAL_SLOTS, Math.round(mins / SLOT_MINUTES)));
};

const colorForKey = (key: string): string => {
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
    return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length];
};

const StudentSchedule: React.FC = () => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
    const [studentSectionId, setStudentSectionId] = useState<string | null>(null);
    const [studentSectionName, setStudentSectionName] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'timeline' | 'grid' | 'table'>('timeline');

    const fetchSchedules = useCallback(async () => {
        if (!studentSectionId) {
            setLoading(false);
            return;
        }
        try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_schedules_with_details');
            if (rpcError) { console.error('[StudentSchedule] RPC error:', rpcError); setLoading(false); return; }
            // Filter to this student's section + published + active
            const filtered = (rpcData || [])
                .filter((s: any) => s.status === 'published' && s.is_active === true && s.section_id === studentSectionId)
                .map((s: any) => ({
                    id: s.id,
                    day_of_week: s.day_of_week,
                    start_time: s.start_time,
                    end_time: s.end_time,
                    subject: { name: s.subject_name, code: s.subject_code },
                    room: { name: s.room_name, building: s.room_building },
                    teacher: { profile: { full_name: s.teacher_name } },
                }));
            setSchedules(filtered);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }, [studentSectionId]);

    const fetchStudentSection = useCallback(async () => {
        try {
            // Fix: Use a simpler query without !inner join to avoid 406 error
            const { data: studentData, error: studentError } = await supabase
                .from('students')
                .select('section_id')
                .eq('profile_id', profile?.id)
                .eq('is_active', true)
                .single();

            if (studentError) {
                console.error('[StudentSchedule] Failed to fetch student section:', studentError);
                setLoading(false);
                return;
            }

            if (studentData) {
                setStudentSectionId(studentData.section_id);
                // Fetch section name separately
                const { data: sectionData } = await supabase
                    .from('sections')
                    .select('name')
                    .eq('id', studentData.section_id)
                    .single();
                setStudentSectionName(sectionData?.name || null);
            } else {
                console.warn('[StudentSchedule] No student record found for profile');
                setLoading(false);
            }
        } catch (err) {
            console.error('[StudentSchedule] Error fetching student section:', err);
            setLoading(false);
        }
    }, [profile?.id]);

    useEffect(() => {
        if (profile) {
            fetchStudentSection();
        } else {
            setLoading(false);
        }
    }, [profile, fetchStudentSection]);

    useEffect(() => {
        if (studentSectionId) {
            fetchSchedules();
        }
    }, [studentSectionId, fetchSchedules]);

    // Real-time subscription for schedule changes
    useEffect(() => {
        if (!studentSectionId) return;

        const channel = supabase
            .channel('student-schedules-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
                fetchSchedules();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [studentSectionId, fetchSchedules]);

    const sorted = useMemo(() => [...schedules].sort((a, b) => {
        const dd = dayOrder.indexOf(a.day_of_week) - dayOrder.indexOf(b.day_of_week);
        return dd !== 0 ? dd : a.start_time.localeCompare(b.start_time);
    }), [schedules]);

    const groupedByDay = useMemo(() => dayOrder.reduce((acc: Record<string, ScheduleItem[]>, day) => {
        acc[day] = sorted.filter(s => s.day_of_week === day);
        return acc;
    }, {} as Record<string, ScheduleItem[]>), [sorted]);

    const formatTime12 = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
    };

    const exportCSV = () => {
        const csv = toCsv(
            ['Day', 'Start', 'End', 'Code', 'Subject', 'Room', 'Teacher'],
            sorted.map(s => [
                s.day_of_week,
                s.start_time?.slice(0, 5),
                s.end_time?.slice(0, 5),
                (s.subject as any)?.code || '',
                (s.subject as any)?.name || '',
                (s.room as any)?.name || '',
                (s.teacher as any)?.profile?.full_name || 'TBA',
            ]),
        );
        downloadCsv(`schedule_${profile?.section || 'student'}`, csv);
    };

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">My Schedule</h1>
                    <p className="dashboard-subtitle">{profile?.program && studentSectionName ? `${profile.program} - Section ${studentSectionName}` : 'Class schedule'}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button className="btn btn-secondary btn-sm" onClick={exportCSV} disabled={schedules.length === 0}>
                        <Download size={14} /> Export
                    </button>
                    <div style={{ display: 'flex', gap: 2, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: 3, border: '1px solid var(--border-default)' }}>
                        {[{ key: 'timeline', icon: <CalendarRange size={14} /> }, { key: 'grid', icon: <LayoutGrid size={14} /> }, { key: 'table', icon: <List size={14} /> }].map(v => (
                            <button key={v.key} className={`btn ${viewMode === v.key ? 'btn-primary' : 'btn-ghost'} btn-xs`} onClick={() => setViewMode(v.key as any)}>{v.icon}</button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : schedules.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 60 }}>
                    <CalendarDays size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 16px' }} />
                    <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>No Schedule Yet</h3>
                    <p style={{ color: 'var(--text-muted)' }}>{profile?.section ? 'Schedule not published for your section yet.' : 'Section not assigned. Contact admin.'}</p>
                </div>
            ) : viewMode === 'timeline' ? (
                <div className="sm-calendar">
                    <div
                        className="sm-cal-grid"
                        style={{ gridTemplateRows: `auto repeat(${TOTAL_SLOTS}, 22px)` }}
                    >
                        {/* Header row */}
                        <div className="sm-cal-head" style={{ gridColumn: 1, gridRow: 1 }} />
                        {DAY_LABELS.map((d, i) => (
                            <div key={d} className="sm-cal-head" style={{ gridColumn: i + 2, gridRow: 1 }}>{d}</div>
                        ))}

                        {/* Time labels (every hour) */}
                        {Array.from({ length: TOTAL_SLOTS }).map((_, slot) => {
                            const mins = START_HOUR * 60 + slot * SLOT_MINUTES;
                            const h = Math.floor(mins / 60);
                            const m = mins % 60;
                            const isHour = m === 0;
                            return (
                                <div
                                    key={`time-${slot}`}
                                    className="sm-cal-time"
                                    style={{ gridColumn: 1, gridRow: slot + 2 }}
                                >
                                    {isHour ? formatTime12(`${h}:00`).replace(':00 ', ' ') : ''}
                                </div>
                            );
                        })}

                        {/* Background grid cells */}
                        {Array.from({ length: TOTAL_SLOTS }).flatMap((_, slot) =>
                            dayOrder.map((day, di) => (
                                <div
                                    key={`bg-${day}-${slot}`}
                                    className="sm-cal-cell sm-cal-slot"
                                    style={{ gridColumn: di + 2, gridRow: slot + 2 }}
                                />
                            ))
                        )}

                        {/* Events */}
                        {sorted.map(s => {
                            const dayIdx = dayOrder.indexOf(s.day_of_week);
                            if (dayIdx < 0) return null;
                            const startSlot = slotFromTime(s.start_time);
                            const endSlot = slotFromTime(s.end_time);
                            const span = Math.max(1, endSlot - startSlot);
                            const subject = (s.subject as any);
                            const room = (s.room as any);
                            const teacher = (s.teacher as any);
                            const colorClass = colorForKey(subject?.code || subject?.name || s.id);
                            const getFontSize = () => {
                                if (span <= 1) return '10px';
                                if (span <= 2) return '11px';
                                return '12px';
                            };
                            return (
                                <div
                                    key={s.id}
                                    className="sm-cal-cell"
                                    style={{
                                        gridColumn: dayIdx + 2,
                                        gridRow: `${startSlot + 2} / span ${span}`,
                                        padding: 0,
                                    }}
                                >
                                    <div
                                        className={`sm-cal-event ${colorClass}`}
                                        title={`${subject?.name || ''}\n${teacher?.profile?.full_name || 'TBA'} - ${room?.name || 'TBA'}\n${formatTime12(s.start_time)} - ${formatTime12(s.end_time)}`}
                                        style={{ fontSize: getFontSize() }}
                                    >
                                        <div className="sm-cal-event-title" style={{ fontSize: getFontSize(), fontWeight: span <= 1 ? 600 : 500 }}>
                                            {subject?.code || subject?.name || 'Class'}
                                        </div>
                                        {span > 1 && (
                                            <>
                                                <div className="sm-cal-event-sub" style={{ fontSize: getFontSize() }}>
                                                    {teacher?.profile?.full_name || 'TBA'} · {room?.name || 'TBA'}
                                                </div>
                                                <div className="sm-cal-event-time" style={{ fontSize: getFontSize() }}>
                                                    {formatTime12(s.start_time)} – {formatTime12(s.end_time)}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : viewMode === 'grid' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                    {dayOrder.filter(d => groupedByDay[d]?.length > 0).map(day => (
                        <div key={day} className="card" style={{ padding: 16 }}>
                            <h4 className="text-md font-bold" style={{ marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border-default)' }}>{day}</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {groupedByDay[day].map(s => (
                                    <div key={s.id} style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: 10, borderLeft: '3px solid var(--accent-success)' }}>
                                        <div className="font-semibold text-base">{(s.subject as any)?.code}</div>
                                        <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: 2 }}><Clock size={10} style={{ marginRight: 4 }} />{s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)}</div>
                                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}><MapPin size={10} style={{ marginRight: 4 }} />{(s.room as any)?.name}</div>
                                        <div className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{(s.teacher as any)?.profile?.full_name || 'TBA'}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="card">
                    <div className="table-container">
                        <table>
                            <thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th></tr></thead>
                            <tbody>
                                {sorted.map(s => (
                                    <tr key={s.id}>
                                        <td className="font-semibold">{s.day_of_week}</td>
                                        <td><Clock size={14} style={{ color: 'var(--text-muted)', marginRight: 4 }} />{s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)}</td>
                                        <td><strong>{(s.subject as any)?.code}</strong><br /><span className="text-sm" style={{ color: 'var(--text-muted)' }}>{(s.subject as any)?.name}</span></td>
                                        <td>{(s.teacher as any)?.profile?.full_name || 'TBA'}</td>
                                        <td><MapPin size={14} style={{ color: 'var(--text-muted)', marginRight: 4 }} />{(s.room as any)?.name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentSchedule;
