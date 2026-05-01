import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ADMIN_ROLES } from '../../types/database';
import type { DayOfWeek, ScheduleStatus } from '../../types/database';
import { ArrowLeft, GraduationCap, MapPin, Search, Users, Lock, Scissors, Merge, MoreVertical, X, History } from 'lucide-react';
import '../admin/Dashboard.css';
import ScheduleVersionHistory from './ScheduleVersionHistory';

type Category = 'sections' | 'teachers' | 'rooms';

interface ScheduleRow {
    id: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    status: string;
    semester: string;
    academic_year: string;
    subject: { name: string; code: string } | null;
    teacher: { id: string; profile: { full_name: string } | null } | null;
    room: { id: string; name: string; building: string | null } | null;
    section: { id: string; name: string; program: string | null } | null;
}

interface Entity {
    id: string;
    label: string;
    sub?: string;
    details?: string[];
    match: (s: ScheduleRow) => boolean;
}

const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const START_HOUR = 7;
const END_HOUR = 19;
const SLOT_MINUTES = 30;
const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;

const EVENT_COLORS = ['c-navy', 'c-core', 'c-bright', 'c-ice'] as const;

const timeToMinutes = (t: string) => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
};

const slotIndex = (t: string) => {
    const mins = timeToMinutes(t) - START_HOUR * 60;
    return Math.max(0, Math.min(TOTAL_SLOTS, Math.round(mins / SLOT_MINUTES)));
};

const formatTime = (t: string) => {
    if (!t) return '';
    const timeFormat = localStorage.getItem('optisched-time-format') || '24h';
    const [h, m] = t.split(':').map(Number);
    if (timeFormat === '12h') {
        const period = h >= 12 ? 'PM' : 'AM';
        const hour = h % 12 || 12;
        return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
    }
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const colorForKey = (key: string) => {
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
    return EVENT_COLORS[Math.abs(h) % EVENT_COLORS.length];
};

const CATEGORY_META: { key: Category; label: string; icon: React.ComponentType<{ size?: number }>; empty: string }[] = [
    { key: 'sections', label: 'Sections', icon: GraduationCap, empty: 'No sections found.' },
    { key: 'teachers', label: 'Teachers', icon: Users, empty: 'No teachers found.' },
    { key: 'rooms', label: 'Rooms', icon: MapPin, empty: 'No rooms found.' },
];

type StatusFilter = 'published' | 'all' | 'draft' | 'submitted';
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'published', label: 'Published' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'draft',     label: 'Drafts' },
    { key: 'all',       label: 'All' },
];

const ScheduleManagement: React.FC = () => {
    const { role, roles } = useAuth();
    const allRoles = roles.length > 0 ? roles : (role ? [role] : []);
    const isAdmin = allRoles.some(r => ADMIN_ROLES.includes(r));
    const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState<Category>('sections');
    const [selected, setSelected] = useState<Entity | null>(null);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('published');
    const [sections, setSections] = useState<{ id: string; name: string; program: string | null; year_level: number | null }[]>([]);
    const [teachers, setTeachers] = useState<{ id: string; full_name: string }[]>([]);
    const [rooms, setRooms] = useState<{ id: string; name: string; building: string | null; type: string | null; capacity: number | null; floor: number | null }[]>([]);

    // Fetch data on mount and when manually refreshed
    const fetchData = useCallback(async () => {
        setLoading(true);
        
        // Use RPC functions to bypass RLS join issues
        const [schedRes, secRes, tchRes, roomRes] = await Promise.all([
            supabase.rpc('get_schedules_with_details'),
            supabase.from('sections').select('id, name, program, year_level').order('program').order('year_level').order('name'),
            supabase.rpc('get_teachers_with_profiles'),
            supabase.from('rooms').select('id, name, building, type, capacity, floor').order('name'),
        ]);
        
        if (schedRes.error) console.error('Schedules error:', schedRes.error);
        if (tchRes.error) console.error('Teachers error:', tchRes.error);
        if (secRes.error) console.error('Sections error:', secRes.error);
        if (roomRes.error) console.error('Rooms error:', roomRes.error);
        
        // Map RPC response to ScheduleRow format
        const schedulesData = (schedRes.data as unknown as Array<{
            id: string;
            teacher_id: string;
            subject_id: string;
            room_id: string;
            section_id: string;
            day_of_week: string;
            start_time: string;
            end_time: string;
            status: string;
            semester: string;
            academic_year: string;
            subject_name: string;
            subject_code: string;
            teacher_name: string;
            room_name: string;
            room_building: string;
            section_name: string;
            section_program: string;
        }>) || [];
        
        setSchedules(schedulesData.map(s => ({
            id: s.id,
            day_of_week: s.day_of_week as DayOfWeek,
            start_time: s.start_time,
            end_time: s.end_time,
            status: s.status as ScheduleStatus,
            semester: s.semester,
            academic_year: s.academic_year,
            subject: { name: s.subject_name, code: s.subject_code },
            teacher: { id: s.teacher_id, profile: { full_name: s.teacher_name } },
            room: { id: s.room_id, name: s.room_name, building: s.room_building },
            section: { id: s.section_id, name: s.section_name, program: s.section_program },
        })));
        
        setSections((secRes.data as unknown as typeof sections) || []);
        setTeachers(
            ((tchRes.data as unknown as { id: string; full_name: string }[]) || [])
                .map(t => ({ id: t.id, full_name: t.full_name || 'Unnamed' }))
        );
        setRooms((roomRes.data as unknown as typeof rooms) || []);
        setLoading(false);
    }, []);

    // React Compiler warning: This is a known false positive.
    // Pattern: useCallback with empty deps + useEffect on mount is the standard data fetching pattern.
    // The warning can be safely ignored - the code is correct and will not cause cascading renders.
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const entities: Entity[] = useMemo(() => {
        if (category === 'sections') {
            return sections.map(s => ({
                id: s.id,
                label: s.name,
                sub: [s.program, s.year_level ? `Year ${s.year_level}` : null].filter(Boolean).join(' · '),
                match: (sc: ScheduleRow) => sc.section?.id === s.id,
            }));
        }
        if (category === 'teachers') {
            return teachers.map(t => ({
                id: t.id,
                label: t.full_name,
                sub: 'Faculty',
                match: (sc: ScheduleRow) => sc.teacher?.id === t.id,
            }));
        }
        return rooms.map(r => ({
            id: r.id,
            label: r.name,
            sub: `${r.type || 'General'} · Floor ${r.floor ?? 'N/A'} · Capacity ${r.capacity ?? 'N/A'}`,
            details: [
                `Type: ${r.type || 'General'}`,
                `Floor: ${r.floor ?? 'N/A'}`,
                `Capacity: ${r.capacity ?? 'N/A'}`,
            ],
            match: (sc: ScheduleRow) => sc.room?.id === r.id,
        }));
    }, [category, sections, teachers, rooms]);

    const filteredEntities = useMemo(() => {
        if (!search) return entities;
        const q = search.toLowerCase();
        return entities.filter(e => e.label.toLowerCase().includes(q) || (e.sub || '').toLowerCase().includes(q));
    }, [entities, search]);

    const entityCounts = useMemo(() => ({
        sections: sections.length,
        teachers: teachers.length,
        rooms: rooms.length,
    }), [sections, teachers, rooms]);

    const selectCategory = (c: Category) => {
        setCategory(c);
        setSelected(null);
        setSearch('');
    };

    const visibleSchedules = useMemo(() => {
        if (statusFilter === 'all') return schedules;
        return schedules.filter(s => {
            const status = (s.status || 'draft').toLowerCase();
            // Normalize status values to match filter keys
            // 'approved' maps to 'published', everything else maps as-is
            const normalizedStatus = status === 'approved' ? 'published' : status;
            return normalizedStatus === statusFilter;
        });
    }, [schedules, statusFilter]);

    // Count visible schedules (unique entity + semester + academic_year)
    const visibleScheduleCount = useMemo(() => {
        const scheduleMap = new Map<string, boolean>();
        visibleSchedules.forEach(s => {
            let entityId = '';
            if (category === 'sections') entityId = s.section?.id || '';
            else if (category === 'teachers') entityId = s.teacher?.id || '';
            else if (category === 'rooms') entityId = s.room?.id || '';
            
            if (!entityId) return;
            
            const key = `${entityId}|${s.semester}|${s.academic_year}`;
            scheduleMap.set(key, true);
        });
        return scheduleMap.size;
    }, [visibleSchedules, category]);

    // Count total schedules (unique entity + semester + academic_year)
    const totalScheduleCount = useMemo(() => {
        const scheduleMap = new Map<string, boolean>();
        schedules.forEach(s => {
            let entityId = '';
            if (category === 'sections') entityId = s.section?.id || '';
            else if (category === 'teachers') entityId = s.teacher?.id || '';
            else if (category === 'rooms') entityId = s.room?.id || '';
            
            if (!entityId) return;
            
            const key = `${entityId}|${s.semester}|${s.academic_year}`;
            scheduleMap.set(key, true);
        });
        return scheduleMap.size;
    }, [schedules, category]);

    // Count unique schedules (entity + semester + academic_year) per entity
    const getScheduleCount = (entityId: string, entityType: Category) => {
        const entitySchedules = schedules.filter(s => {
            if (entityType === 'sections') return s.section?.id === entityId;
            if (entityType === 'teachers') return s.teacher?.id === entityId;
            if (entityType === 'rooms') return s.room?.id === entityId;
            return false;
        });
        
        // Count unique (semester, academic_year) combinations
        const uniqueSchedules = new Set(
            entitySchedules.map(s => `${s.semester}|${s.academic_year}`)
        );
        return uniqueSchedules.size;
    };

    const selectedSchedules = useMemo(() => {
        if (!selected) return [] as ScheduleRow[];
        // When an entity is selected, show all sessions for that entity (ignore status filter)
        return schedules.filter(selected.match);
    }, [schedules, selected]);

    // Count unique schedules (entity + semester + academic_year) by status
    const statusCounts = useMemo(() => {
        // Group sessions by (entity_id, semester, academic_year) and track their status
        const scheduleMap = new Map<string, string>();

        schedules.forEach(s => {
            // Determine the entity ID based on current category
            let entityId = '';
            if (category === 'sections') entityId = s.section?.id || '';
            else if (category === 'teachers') entityId = s.teacher?.id || '';
            else if (category === 'rooms') entityId = s.room?.id || '';

            if (!entityId) return;

            const key = `${entityId}|${s.semester}|${s.academic_year}`;
            // Normalize 'approved' to 'published'
            let status = (s.status || 'draft').toLowerCase();
            if (status === 'approved') status = 'published';

            // If this schedule already has a status, keep the most significant one
            // published > submitted > draft
            const existing = scheduleMap.get(key);
            if (!existing || (status === 'published' && existing !== 'published') ||
                (status === 'submitted' && existing === 'draft')) {
                scheduleMap.set(key, status);
            }
        });

        const counts: Record<string, number> = { all: scheduleMap.size, published: 0, submitted: 0, draft: 0 };
        scheduleMap.forEach(status => {
            if (status in counts) counts[status]++;
        });

        return counts;
    }, [schedules, category]);

    if (!isAdmin) {
        return (
            <div className="dashboard fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
                <Lock size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                <h2 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Access Denied</h2>
                <p style={{ color: 'var(--text-muted)' }}>Schedule Management is only available to administrators.</p>
            </div>
        );
    }

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">Schedule Management</h1>
                    <p className="dashboard-subtitle">
                        {selected
                            ? `Weekly schedule for ${selected.label}`
                            : `Browse by category · ${visibleScheduleCount} of ${totalScheduleCount} schedules`}
                    </p>
                </div>
            </div>

            {!selected && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }} role="radiogroup" aria-label="Status filter">
                    {STATUS_FILTERS.map(f => (
                        <button
                            key={f.key}
                            type="button"
                            role="radio"
                            aria-checked={statusFilter === f.key}
                            className={`sg-chip ${statusFilter === f.key ? 'sg-chip-active' : ''}`}
                            onClick={() => setStatusFilter(f.key)}
                        >
                            {f.label}
                            <span className="sg-chip-sub">{statusCounts[f.key] ?? 0}</span>
                        </button>
                    ))}
                </div>
            )}

            {!selected && (
                <div className="sm-tabs" role="tablist" aria-label="Schedule category">
                    {CATEGORY_META.map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={category === key}
                            className={`sm-tab ${category === key ? 'sm-tab-active' : ''}`}
                            onClick={() => selectCategory(key)}
                        >
                            <Icon size={15} />
                            {label}
                            <span className="sm-tab-count">{entityCounts[key]}</span>
                        </button>
                    ))}
                </div>
            )}

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : selected ? (
                <ScheduleDetail
                    entity={selected}
                    schedules={selectedSchedules}
                    onBack={() => setSelected(null)}
                    onUpdate={() => {
                        fetchData();
                    }}
                />
            ) : (
                <>
                    <div style={{ position: 'relative', maxWidth: 400, marginBottom: 16 }}>
                        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            className="input"
                            style={{ paddingLeft: 40 }}
                            placeholder={`Search ${category}...`}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {filteredEntities.length === 0 ? (
                        <div className="sm-cal-empty">
                            {CATEGORY_META.find(c => c.key === category)?.empty}
                        </div>
                    ) : (
                        <div className="sm-entity-grid">
                            {filteredEntities.map(e => {
                                const count = getScheduleCount(e.id, category);
                                return (
                                    <button
                                        key={e.id}
                                        type="button"
                                        className="sm-entity-card"
                                        onClick={() => setSelected(e)}
                                    >
                                        <div className="sm-entity-title">{e.label}</div>
                                        {e.details ? (
                                            <div className="sm-entity-sub">
                                                {e.details.map((detail, idx) => (
                                                    <div key={idx}>{detail}</div>
                                                ))}
                                            </div>
                                        ) : (
                                            e.sub && <div className="sm-entity-sub">{e.sub}</div>
                                        )}
                                        <div className="sm-entity-meta">
                                            <span className="sm-entity-meta-dot" />
                                            {count} {count === 1 ? 'schedule' : 'schedules'}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

interface ScheduleDetailProps {
    entity: Entity;
    schedules: ScheduleRow[];
    onBack: () => void;
    onUpdate?: () => void;
}

const ScheduleDetail: React.FC<ScheduleDetailProps> = ({ entity, schedules, onBack, onUpdate }) => {
    const { role, roles } = useAuth();
    const allRoles = roles.length > 0 ? roles : (role ? [role] : []);
    const canEdit = allRoles.some(r => ADMIN_ROLES.includes(r));

    const [draggedEvent, setDraggedEvent] = useState<{ event: typeof events[0]; originalDay: number; originalStart: number } | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<typeof events[0] | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
    const [splitModal, setSplitModal] = useState(false);
    const [splitCount, setSplitCount] = useState(2);
    const [showVersionHistory, setShowVersionHistory] = useState(false);

    const events = schedules.map(s => {
        const dayIdx = dayOrder.indexOf(s.day_of_week);
        const start = slotIndex(s.start_time);
        const end = slotIndex(s.end_time);
        return { s, dayIdx, start, span: Math.max(1, end - start) };
    }).filter(e => e.dayIdx >= 0);

    const handleDragStart = (e: React.DragEvent, event: typeof events[0]) => {
        if (!canEdit) return;
        e.dataTransfer.effectAllowed = 'move';
        setDraggedEvent({ event, originalDay: event.dayIdx, originalStart: event.start });
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (!canEdit) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent, targetDay: number, targetSlot: number) => {
        if (!canEdit || !draggedEvent) return;
        e.preventDefault();

        const { event, originalDay, originalStart } = draggedEvent;
        const dayOffset = targetDay - originalDay;
        const slotOffset = targetSlot - originalStart;

        if (dayOffset === 0 && slotOffset === 0) {
            setDraggedEvent(null);
            return;
        }

        const newStartMinutes = timeToMinutes(event.s.start_time) + (dayOffset * 24 * 60) + (slotOffset * SLOT_MINUTES);
        const newEndMinutes = timeToMinutes(event.s.end_time) + (dayOffset * 24 * 60) + (slotOffset * SLOT_MINUTES);

        const newStartHour = Math.floor(newStartMinutes / 60);
        const newStartMin = newStartMinutes % 60;
        const newEndHour = Math.floor(newEndMinutes / 60);
        const newEndMin = newEndMinutes % 60;

        const newStartTime = `${newStartHour.toString().padStart(2, '0')}:${newStartMin.toString().padStart(2, '0')}`;
        const newEndTime = `${newEndHour.toString().padStart(2, '0')}:${newEndMin.toString().padStart(2, '0')}`;
        const newDayOfWeek = dayOrder[targetDay % dayOrder.length];

        try {
            await supabase.from('schedules').update({
                day_of_week: newDayOfWeek,
                start_time: newStartTime,
                end_time: newEndTime,
            }).eq('id', event.s.id);
            onUpdate?.();
        } catch (err) {
            console.error('Error moving session:', err);
            alert('Failed to move session');
        }

        setDraggedEvent(null);
    };

    const handleContextMenu = (e: React.MouseEvent, event: typeof events[0]) => {
        if (!canEdit) return;
        e.preventDefault();
        setSelectedEvent(event);
        setMenuPosition({ x: e.clientX, y: e.clientY });
        setShowMenu(true);
    };

    const handleSplit = async () => {
        if (!selectedEvent || splitCount < 2) return;

        const totalMinutes = timeToMinutes(selectedEvent.s.end_time) - timeToMinutes(selectedEvent.s.start_time);
        const segmentMinutes = totalMinutes / splitCount;

        try {
            await supabase.from('schedules').delete().eq('id', selectedEvent.s.id);

            for (let i = 0; i < splitCount; i++) {
                const startMinutes = timeToMinutes(selectedEvent.s.start_time) + (i * segmentMinutes);
                const endMinutes = startMinutes + segmentMinutes;
                const startHour = Math.floor(startMinutes / 60);
                const startMin = Math.round(startMinutes % 60);
                const endHour = Math.floor(endMinutes / 60);
                const endMin = Math.round(endMinutes % 60);

                await supabase.from('schedules').insert({
                    day_of_week: selectedEvent.s.day_of_week,
                    start_time: `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`,
                    end_time: `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`,
                    status: selectedEvent.s.status,
                    semester: selectedEvent.s.semester,
                    academic_year: selectedEvent.s.academic_year,
                    teacher_id: selectedEvent.s.teacher ? selectedEvent.s.teacher.id : null,
                    room_id: selectedEvent.s.room ? selectedEvent.s.room.id : null,
                    section_id: selectedEvent.s.section ? selectedEvent.s.section.id : null,
                });
            }

            onUpdate?.();
            setSplitModal(false);
            setShowMenu(false);
        } catch (err) {
            console.error('Error splitting session:', err);
            alert('Failed to split session');
        }
    };

    const handleCombine = async () => {
        if (!selectedEvent) return;

        const sameDayEvents = events.filter(
            e => e.dayIdx === selectedEvent.dayIdx && e.s.id !== selectedEvent.s.id
        );

        if (sameDayEvents.length === 0) {
            alert('No other events on the same day to combine with');
            return;
        }

        const allEvents = [selectedEvent, ...sameDayEvents].sort((a, b) => a.start - b.start);
        const lastEvent = allEvents[allEvents.length - 1];

        try {
            for (const e of allEvents) {
                if (e.s.id !== selectedEvent.s.id) {
                    await supabase.from('schedules').delete().eq('id', e.s.id);
                }
            }

            await supabase.from('schedules').update({
                end_time: lastEvent.s.end_time,
            }).eq('id', selectedEvent.s.id);

            onUpdate?.();
            setShowMenu(false);
        } catch (err) {
            console.error('Error combining schedules:', err);
            alert('Failed to combine schedules');
        }
    };

    const handleClickOutside = () => {
        setShowMenu(false);
        setMenuPosition(null);
    };

    useEffect(() => {
        if (showMenu) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [showMenu]);

    return (
        <div>
            <button type="button" className="sm-back" onClick={onBack}>
                <ArrowLeft size={14} /> Back
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                        {entity.label}
                    </div>
                    {entity.details ? (
                        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.6 }}>
                            {entity.details.map((detail, idx) => (
                                <div key={idx}>{detail}</div>
                            ))}
                        </div>
                    ) : (
                        entity.sub && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{entity.sub}</div>
                    )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {schedules.length} {schedules.length === 1 ? 'session' : 'sessions'} this week
                </div>
            </div>

            {schedules.length === 0 ? (
                <div className="sm-calendar"><div className="sm-cal-empty">No scheduled sessions.</div></div>
            ) : (
                <div className="sm-calendar">
                    <div
                        className="sm-cal-grid"
                        style={{ gridTemplateRows: `auto repeat(${TOTAL_SLOTS}, 22px)` }}
                    >
                        {/* Header row */}
                        <div className="sm-cal-head" style={{ gridColumn: 1, gridRow: 1 }} />
                        {SHORT_DAYS.map((d, i) => (
                            <div key={d} className="sm-cal-head" style={{ gridColumn: i + 2, gridRow: 1 }}>{d}</div>
                        ))}

                        {/* Time labels (every hour) */}
                        {Array.from({ length: TOTAL_SLOTS }).map((_, slot) => {
                            const hour = START_HOUR + Math.floor(slot / 2);
                            const isHour = slot % 2 === 0;
                            const timeStr = `${hour.toString().padStart(2, '0')}:00`;
                            return (
                                <div
                                    key={`time-${slot}`}
                                    className="sm-cal-time"
                                    style={{ gridColumn: 1, gridRow: slot + 2 }}
                                >
                                    {isHour ? formatTime(timeStr) : ''}
                                </div>
                            );
                        })}

                        {/* Empty day cells (background grid) */}
                        {Array.from({ length: TOTAL_SLOTS }).flatMap((_, slot) =>
                            dayOrder.map((day, di) => (
                                <div
                                    key={`bg-${day}-${slot}`}
                                    className="sm-cal-cell sm-cal-slot"
                                    style={{ gridColumn: di + 2, gridRow: slot + 2 }}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, di, slot)}
                                />
                            ))
                        )}

                        {/* Events overlaid with explicit grid placement */}
                        {events.map(ev => (
                            <div
                                key={ev.s.id}
                                className="sm-cal-cell"
                                style={{
                                    gridColumn: ev.dayIdx + 2,
                                    gridRow: `${ev.start + 2} / span ${ev.span}`,
                                }}
                            >
                                <div
                                    className={`sm-cal-event ${colorForKey(ev.s.subject?.code || ev.s.id)} ${canEdit ? 'sm-cal-event-draggable' : ''}`}
                                    title={`${ev.s.subject?.name || ''} · ${formatTime(ev.s.start_time)}–${formatTime(ev.s.end_time)}`}
                                    draggable={canEdit}
                                    onDragStart={(e) => handleDragStart(e, ev)}
                                    onContextMenu={(e) => handleContextMenu(e, ev)}
                                >
                                    <div className="sm-cal-event-title">
                                        {ev.s.subject?.code || ev.s.subject?.name || 'Session'}
                                    </div>
                                    <div className="sm-cal-event-sub">
                                        {ev.s.room?.name || ev.s.teacher?.profile?.full_name || ev.s.section?.name || ''}
                                    </div>
                                    <div className="sm-cal-event-time">
                                        {formatTime(ev.s.start_time)}–{formatTime(ev.s.end_time)}
                                    </div>
                                    {canEdit && (
                                        <div className="sm-cal-event-edit-hint">
                                            <MoreVertical size={12} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Context Menu */}
                        {showMenu && menuPosition && selectedEvent && (
                            <div
                                className="sm-context-menu"
                                style={{ position: 'fixed', left: menuPosition.x, top: menuPosition.y, zIndex: 1000 }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    className="sm-context-menu-item"
                                    onClick={() => {
                                        setShowVersionHistory(true);
                                        setShowMenu(false);
                                    }}
                                >
                                    <History size={14} />
                                    View History
                                </button>
                                {canEdit && (
                                    <>
                                        <button
                                            className="sm-context-menu-item"
                                            onClick={() => {
                                                setSplitModal(true);
                                                setShowMenu(false);
                                            }}
                                        >
                                            <Scissors size={14} />
                                            Split Session
                                        </button>
                                        <button
                                            className="sm-context-menu-item"
                                            onClick={handleCombine}
                                        >
                                            <Merge size={14} />
                                            Combine Sessions
                                        </button>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Split Modal */}
                        {splitModal && (
                            <div className="modal-overlay" onClick={() => setSplitModal(false)}>
                                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Split Session</h2>
                                        <button
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                                            onClick={() => setSplitModal(false)}
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <div className="modal-form">
                                        <label>Number of sessions</label>
                                        <input
                                            type="number"
                                            min="2"
                                            max="10"
                                            value={splitCount}
                                            onChange={(e) => setSplitCount(Math.max(2, Math.min(10, parseInt(e.target.value) || 2)))}
                                            className="input"
                                        />
                                        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 8 }}>
                                            This will split the session into {splitCount} equal parts.
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => setSplitModal(false)}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleSplit}
                                        >
                                            Split
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Version History Modal */}
                        {showVersionHistory && selectedEvent && (
                            <div className="modal-overlay" onClick={() => setShowVersionHistory(false)}>
                                <div className="modal-content" style={{ maxWidth: 900, maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Version History</h2>
                                        <button
                                            className="btn btn-ghost"
                                            style={{ padding: 4 }}
                                            onClick={() => setShowVersionHistory(false)}
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                    <ScheduleVersionHistory 
                                        scheduleId={selectedEvent.s.id} 
                                        scheduleName={`${selectedEvent.s.subject?.code || 'Schedule'} - ${selectedEvent.s.day_of_week}`}
                                        onBack={() => setShowVersionHistory(false)} 
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScheduleManagement;

/* Context Menu and Draggable Styles */
const styles = `
.sm-cal-event-draggable {
    cursor: grab;
    transition: box-shadow 0.15s ease;
}

.sm-cal-event-draggable:active {
    cursor: grabbing;
}

.sm-cal-event-draggable:hover {
    box-shadow: 0 2px 8px rgba(73, 136, 196, 0.3);
}

.sm-cal-event-edit-hint {
    position: absolute;
    top: 4px;
    right: 4px;
    opacity: 0;
    transition: opacity 0.15s ease;
}

.sm-cal-event-draggable:hover .sm-cal-event-edit-hint {
    opacity: 1;
}

.sm-context-menu {
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    padding: 4px;
    min-width: 160px;
    z-index: 1000;
}

.sm-context-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: none;
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.1s ease;
    text-align: left;
    font-family: var(--font-sans);
}

.sm-context-menu-item:hover {
    background: var(--bg-hover);
}

.sm-context-menu-item:first-child {
    margin-top: 0;
}

.sm-context-menu-item:last-child {
    margin-bottom: 0;
}
`;

if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}
