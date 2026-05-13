import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmDialog } from '../../components/states/ConfirmDialog';
import { supabase } from '../../lib/supabase';
import { scheduleVersionService } from '../../services/scheduleVersionService';
import { ADMIN_ROLES } from '../../types/database';
import type { DayOfWeek, ScheduleStatus } from '../../types/database';
import type { ScheduleEntry } from '../../components/ScheduleDragDrop';
import { ScheduleDragDrop } from '../../components/ScheduleDragDrop';

import { Users, GraduationCap, MapPin, Search, ArrowLeft, History, Download, Lock, CalendarDays, Scissors, Merge, X, Maximize, Minimize, CheckCircle, Send, Archive, RefreshCw } from 'lucide-react';

// Temporarily disabled audit logging - log_audit RPC function doesn't exist
// import { scheduleAudit, logAudit } from '../../services/auditService';
import '../admin/Dashboard.css';
import ScheduleVersionHistory from './ScheduleVersionHistory';

type Category = 'sections' | 'teachers' | 'rooms';

interface VersionSnapshot {
    id: string;
    subject_id: string;
    section_id: string;
    teacher_id: string;
    room_id: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    status: string;
    semester: string;
    academic_year: string;
    batch_id?: string;
}

interface ScheduleRow {
    id: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    status: string;
    semester: string;
    academic_year: string;
    subject: { 
        id?: string;
        name: string; 
        code: string;
        type?: 'common' | 'special';
        compatible_room_ids?: string[];
    } | null;
    teacher: { id: string; profile: { full_name: string } | null } | null;
    room: { 
        id: string; 
        name: string; 
        building: string | null;
        type?: 'common' | 'special';
        capacity?: number | null;
        compatible_subject_ids?: string[];
    } | null;
    section: { 
        id: string; 
        name: string; 
        program: string | null;
        student_count?: number;
    } | null;
    batch_id?: string;
}

interface Entity {
    id: string;
    label: string;
    sub?: string;
    details?: string[];
    match: (s: ScheduleRow) => boolean;
}

const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
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

// Always return 24-hour format for internal use (e.g., passing to ScheduleDragDrop)
const formatTime24Hour = (t: string) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
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

const ScheduleManagement: React.FC = () => {
    const { role, roles, user } = useAuth();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [searchParams] = useSearchParams();
    const versionId = searchParams.get('version');
    const allRoles = roles.length > 0 ? roles : (role ? [role] : []);
    
    // Confirmation dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', onConfirm: () => {} });
    const isAdmin = allRoles.some(r => ADMIN_ROLES.includes(r));
    const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState<Category>('sections');
    const [selected, setSelected] = useState<Entity | null>(null);
    const [search, setSearch] = useState('');
    const [sections, setSections] = useState<{ id: string; name: string; program: string | null; year_level: number | null; student_count?: number }[]>([]);
    const [teachers, setTeachers] = useState<{ id: string; full_name: string; department: string; is_active: boolean }[]>([]);
    const [rooms, setRooms] = useState<{ id: string; name: string; building: string | null; type: string | null; capacity: number | null; floor: number | null; compatible_subject_ids?: string[] }[]>([]);
    const [versionName, setVersionName] = useState<string | null>(null);
    const [versionStatus, setVersionStatus] = useState<{
        change_type: string;
        is_active: boolean;
        schedules_status: string;
        batch_id: string | null;
    } | null>(null);

    // Initialize scheduleVersionService
    useEffect(() => {
        if (user && supabase) {
            scheduleVersionService.initialize(supabase, user.id);
        }
    }, [user]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        
        if (versionId) {
            // Load schedules from specific version
            try {
                // Get version info
                const { data: version } = await supabase
                    .from('schedule_versions')
                    .select('*')
                    .eq('id', versionId)
                    .single();

                if (version) {
                    const formattedChangeType = version.change_type.charAt(0).toUpperCase() + version.change_type.slice(1);
                    setVersionName(`Version ${version.version_number} (${formattedChangeType})`);

                    // Load sections, teachers, rooms, and subjects for filtering
                    // Use RPC for rooms and subjects to bypass RLS issues
                    const [secRes, tchRes, roomRes, subRes] = await Promise.all([
                        supabase.from('sections').select('id, name, program, year_level, student_count').order('program').order('year_level').order('name'),
                        supabase.rpc('get_teachers_with_profiles'),
                        supabase.rpc('get_rooms_with_details'),
                        supabase.rpc('get_subjects_with_details'),
                    ]);

                    const loadedSections = (secRes.data as unknown as typeof sections) || [];
                    const loadedTeachers = ((tchRes.data as unknown as { id: string; full_name: string; department: string; is_active: boolean }[]) || [])
                        .map(t => ({ id: t.id, full_name: t.full_name || 'Unnamed', department: t.department || '', is_active: t.is_active ?? true }));
                    // Map RPC room data to Room interface
                    const loadedRooms = ((roomRes.data as unknown as Array<{
                        id: string;
                        name: string;
                        building: string;
                        type: string;
                        capacity: number;
                        floor: number;
                        subject_compatibility: unknown;
                        equipment: unknown;
                        is_available: boolean;
                        weight: number;
                        priority_note: string;
                        room_facility_type: string;
                        is_special_room: boolean;
                    }>) || []).map(r => ({
                        id: r.id,
                        name: r.name,
                        building: r.building,
                        type: r.type as 'common' | 'special',
                        capacity: r.capacity,
                        floor: r.floor,
                        is_available: r.is_available ?? true,
                        weight: r.weight,
                        priority_note: r.priority_note,
                        compatible_subject_ids: r.subject_compatibility ? (typeof r.subject_compatibility === 'string' ? JSON.parse(r.subject_compatibility) : r.subject_compatibility) : [],
                    }));
                    // Map RPC subject data to Subject interface
                    const loadedSubjects = ((subRes.data as unknown as Array<{
                        id: string;
                        name: string;
                        code: string;
                        type: string;
                        units: number;
                        duration_hours: number;
                        program: string;
                        year_level: number;
                        requires_lab: boolean;
                        teacher_id: string;
                        weight: number;
                        priority_note: string;
                        requires_special_room: boolean;
                    }>) || []).map(s => ({
                        id: s.id,
                        name: s.name,
                        code: s.code,
                        type: s.type as 'common' | 'special',
                        compatible_room_ids: [], // Not available in current schema
                    }));

                    setSections(loadedSections);
                    setTeachers(loadedTeachers);
                    setRooms(loadedRooms);

                    // Reconstruct schedules from snapshot with fallback to RPC data if IDs are missing
                    const snapshot = version.snapshot as VersionSnapshot[];
                    const schedulesFromVersion: ScheduleRow[] = [];

                    if (snapshot && Array.isArray(snapshot)) {
                        for (const sched of snapshot) {
                            // Find related entities to reconstruct objects
                            const subject = loadedSubjects.find(s => s.id === sched.subject_id);
                            const teacher = loadedTeachers.find(t => t.id === sched.teacher_id);
                            const room = loadedRooms.find(r => r.id === sched.room_id);
                            const section = loadedSections.find(s => s.id === sched.section_id);

                            schedulesFromVersion.push({
                                id: sched.id,
                                day_of_week: sched.day_of_week,
                                start_time: sched.start_time,
                                end_time: sched.end_time,
                                status: sched.status,
                                semester: sched.semester,
                                academic_year: sched.academic_year,
                                batch_id: sched.batch_id,
                                subject: subject ? {
                                    id: subject.id,
                                    name: subject.name,
                                    code: subject.code,
                                    type: subject.type as 'common' | 'special' | undefined,
                                    compatible_room_ids: subject.compatible_room_ids,
                                } : { id: sched.subject_id, name: 'Unknown Subject', code: '', type: undefined, compatible_room_ids: undefined },
                                teacher: teacher ? { id: teacher.id, profile: { full_name: teacher.full_name } } : { id: sched.teacher_id, profile: { full_name: 'Unknown Teacher' } },
                                room: room ? {
                                    id: room.id,
                                    name: room.name,
                                    building: room.building,
                                    type: room.type as 'common' | 'special' | undefined,
                                    capacity: room.capacity,
                                    compatible_subject_ids: room.compatible_subject_ids,
                                } : { id: sched.room_id, name: 'Unknown Room', building: '', type: undefined, capacity: undefined, compatible_subject_ids: undefined },
                                section: section ? {
                                    id: section.id,
                                    name: section.name,
                                    program: section.program,
                                    student_count: section.student_count,
                                } : { id: sched.section_id, name: 'Unknown Section', program: '', student_count: undefined },
                            });
                        }
                    }
                    setSchedules(schedulesFromVersion);
                    // Verify all schedules in the batch have the same status
                    const uniqueStatuses = new Set(schedulesFromVersion.map(s => s.status));
                    const consistentStatus = uniqueStatuses.size === 1 ? schedulesFromVersion[0]?.status : 'mixed';
                    setVersionStatus({
                        change_type: version.change_type,
                        is_active: version.is_active,
                        schedules_status: consistentStatus,
                        batch_id: schedulesFromVersion[0]?.batch_id || null,
                    });
                }
            } catch (error) {
                console.error('Error loading version:', error);
            }
        } else {
            // Load current schedules
            const [schedRes, secRes, tchRes, roomRes, subjRes] = await Promise.all([
                supabase.rpc('get_schedules_with_details'),
                supabase.from('sections').select('id, name, program, year_level, student_count').order('program').order('year_level').order('name'),
                supabase.rpc('get_teachers_with_profiles'),
                supabase.rpc('get_rooms_with_details'),
                supabase.rpc('get_subjects_with_details'),
            ]);
            
            if (schedRes.error) console.error('Schedules error:', schedRes.error);
            if (tchRes.error) console.error('Teachers error:', tchRes.error);
            if (secRes.error) console.error('Sections error:', secRes.error);
            if (roomRes.error) console.error('Rooms error:', roomRes.error);
            if (subjRes.error) console.error('Subjects error:', subjRes.error);
            
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

            // Map RPC room data to Room interface
            const loadedRooms = ((roomRes.data as unknown as Array<{
                id: string;
                name: string;
                building: string;
                type: string;
                capacity: number;
                floor: number;
                subject_compatibility: unknown;
                equipment: unknown;
                is_available: boolean;
                weight: number;
                priority_note: string;
                room_facility_type: string;
                is_special_room: boolean;
            }>) || []).map(r => ({
                id: r.id,
                name: r.name,
                building: r.building,
                type: r.type as 'common' | 'special',
                capacity: r.capacity,
                floor: r.floor,
                is_available: r.is_available ?? true,
                weight: r.weight,
                priority_note: r.priority_note,
                compatible_subject_ids: r.subject_compatibility ? (typeof r.subject_compatibility === 'string' ? JSON.parse(r.subject_compatibility) : r.subject_compatibility) : [],
            }));
            // Map RPC subject data to Subject interface
            const loadedSubjects = ((subjRes.data as unknown as Array<{
                id: string;
                name: string;
                code: string;
                type: string;
                units: number;
                duration_hours: number;
                program: string;
                year_level: number;
                requires_lab: boolean;
                teacher_id: string;
                weight: number;
                priority_note: string;
                requires_special_room: boolean;
            }>) || []).map(s => ({
                id: s.id,
                name: s.name,
                code: s.code,
                type: s.type as 'common' | 'special',
                compatible_room_ids: [], // Not available in current schema
            }));
            const loadedSections = (secRes.data as unknown as typeof sections) || [];

            setSchedules(schedulesData.map(s => {
                const subject = loadedSubjects.find(sub => sub.id === s.subject_id);
                const room = loadedRooms.find(r => r.id === s.room_id);
                const section = loadedSections.find(sec => sec.id === s.section_id);
                
                return {
                    id: s.id,
                    day_of_week: s.day_of_week as DayOfWeek,
                    start_time: s.start_time,
                    end_time: s.end_time,
                    status: s.status as ScheduleStatus,
                    semester: s.semester,
                    academic_year: s.academic_year,
                    subject: { 
                        id: subject?.id,
                        name: s.subject_name, 
                        code: s.subject_code,
                        type: subject?.type as 'common' | 'special' | undefined,
                        compatible_room_ids: subject?.compatible_room_ids,
                    },
                    teacher: { id: s.teacher_id, profile: { full_name: s.teacher_name } },
                    room: { 
                        id: s.room_id, 
                        name: s.room_name, 
                        building: s.room_building,
                        type: room?.type as 'common' | 'special' | undefined,
                        capacity: room?.capacity,
                        compatible_subject_ids: room?.compatible_subject_ids,
                    },
                    section: { 
                        id: s.section_id, 
                        name: s.section_name, 
                        program: s.section_program,
                        student_count: section?.student_count,
                    },
                };
            }));
            
            setSections((secRes.data as unknown as typeof sections) || []);
            setTeachers(
                ((tchRes.data as unknown as { id: string; full_name: string; department: string; is_active: boolean }[]) || [])
                    .map(t => ({ id: t.id, full_name: t.full_name || 'Unnamed', department: t.department || '', is_active: t.is_active ?? true }))
            );
            setRooms((roomRes.data as unknown as typeof rooms) || []);

            // Set versionStatus for current schedules to enable correct button display
            if (schedulesData.length > 0) {
                setVersionStatus({
                    change_type: 'published',
                    is_active: true,
                    schedules_status: schedulesData[0]?.status || 'published',
                    batch_id: null, // Current schedules don't have a batch_id
                });
            }
        }
        
        setLoading(false);
    }, [versionId]);

    // Fetch data on mount and when versionId changes
    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [versionId]);

    const canApprove = allRoles.some(r => ['admin', 'power_admin', 'schedule_admin'].includes(r));

    const handleSubmitVersion = async () => {
        if (!versionStatus?.batch_id) {
            console.warn('[SCHEDULE MGMT] Submit blocked: no batch_id (select a draft version)');
            showToast({ title: 'Select draft', message: 'Select a draft version to submit', type: 'warning' });
            return;
        }
        setConfirmDialog({
            open: true,
            title: 'Submit Draft',
            message: 'Submit this draft for approval?',
            onConfirm: async () => {
                try {
                    // Pre-check: ensure batch has active schedules
                    const { data: activeSchedules, error: activeErr } = await supabase
                        .from('schedules')
                        .select('id')
                        .eq('batch_id', versionStatus.batch_id)
                        .eq('is_active', true);
                    if (activeErr) {
                        console.warn('[SCHEDULE MGMT] Unable to verify schedules before submit', activeErr.message);
                    }
                    if (!activeSchedules || activeSchedules.length === 0) {
                        showToast({ title: 'No schedules', message: 'This draft has no active schedules. Save as draft first, then submit.', type: 'warning' });
                        return;
                    }

                    const res = await scheduleVersionService.submitSchedule(versionStatus!.batch_id!, { changeReason: 'Submitted from schedule management' });
                    if (!res.success) throw new Error(res.message);
                    showToast({ title: 'Submitted', type: 'success' });
                    if (res.active_version_id) {
                        navigate(`/admin/schedules?version=${res.active_version_id}`, { replace: true });
                    } else {
                        fetchData();
                    }
                } catch (err: unknown) {
                    console.error(err);
                    showToast({ title: 'Failed to submit', message: err instanceof Error ? err.message : String(err), type: 'error' });
                }
            }
        });
    };

    const handleApprovePublishVersion = async () => {
        if (!versionStatus?.batch_id) return;
        
        // Proceed directly with approval
        await performApprovePublish();
    };

    const performApprovePublish = async () => {
        if (!versionStatus?.batch_id) return;
        
        try {
            let res = await (scheduleVersionService as any).approveSchedule(versionStatus.batch_id, { changeReason: 'Approved from schedule management' }); // eslint-disable-line @typescript-eslint/no-explicit-any
            if (!res.success) throw new Error(res.message);
            res = await (scheduleVersionService as any).publishApprovedSchedule(versionStatus.batch_id, { changeReason: 'Published from schedule management' }); // eslint-disable-line @typescript-eslint/no-explicit-any
            if (!res.success) throw new Error(res.message);
            showToast({ title: 'Approved and published', type: 'success' });
            if (res.active_version_id) {
                navigate(`/admin/schedules?version=${res.active_version_id}`, { replace: true });
            } else {
                fetchData();
            }
        } catch (err: unknown) {
            console.error(err);
            showToast({ title: 'Failed to approve', message: err instanceof Error ? err.message : String(err), type: 'error' });
        }
    };

    const handlePublishPreviousVersion = async () => {
        if (!schedules.length) return;
        setConfirmDialog({
            open: true,
            title: 'Restore Previous Version',
            message: 'Restore and publish this previous version? This will overwrite the current active schedule.',
            onConfirm: async () => {
                try {
                    // To get accurate subject_id, we should fetch from db or use the existing ones if we stored them.
                    // Oh wait, ScheduleRow doesn't store subject_id. Let me check if we can fetch it.
                    // A simpler way: we have `versionId`! We can just fetch the raw snapshot from `schedule_versions`!
                    const { data: v } = await supabase.from('schedule_versions').select('snapshot').eq('id', versionId).single();
                    if (!v || !v.snapshot) throw new Error('Could not find version snapshot');
                    
                    const rawSchedules = Array.isArray(v.snapshot) ? v.snapshot : [v.snapshot];
                    const mappedSchedules = rawSchedules.map((s: VersionSnapshot) => ({
                        id: crypto.randomUUID(),
                        subject_id: s.subject_id,
                        teacher_id: s.teacher_id,
                        room_id: s.room_id,
                        section_id: s.section_id,
                        day_of_week: s.day_of_week,
                        start_time: s.start_time,
                        end_time: s.end_time,
                        status: 'published',
                        is_active: true,
                        semester: s.semester,
                        academic_year: s.academic_year,
                        created_by: user?.id,
                    }));

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const res = await scheduleVersionService.publishSchedule(mappedSchedules as unknown as any[], {
                        academic_year: mappedSchedules[0]?.academic_year || '2025-2026',
                        semester: mappedSchedules[0]?.semester || '1st Semester',
                        changeReason: 'Restored from previous version',
                        force: true, // Auto overwrite
                    });
                    
                    if (!res.success) throw new Error(res.message);
                    showToast({ title: 'Restored', type: 'success' });
                    navigate('/admin/schedules');
                } catch (err: unknown) {
                    console.error(err);
                    showToast({ title: 'Failed to restore', message: err instanceof Error ? err.message : String(err), type: 'error' });
                }
            }
        });
    };

    const handleArchiveVersion = async () => {
        if (!versionId || !versionStatus?.batch_id) return;

        setConfirmDialog({
            open: true,
            title: 'Archive Version',
            message: 'Are you sure you want to archive this version? It will be moved to archived status and can be recovered later.',
            onConfirm: async () => {
                try {
                    // Archive the schedules associated with this version by setting status to 'archived'
                    const { error: updateError } = await supabase
                        .from('schedules')
                        .update({ status: 'archived' })
                        .eq('batch_id', versionStatus.batch_id);

                    if (updateError) throw updateError;

                    // Also deactivate the version
                    const { error: versionError } = await supabase
                        .from('schedule_versions')
                        .update({ is_active: false })
                        .eq('id', versionId);

                    if (versionError) throw versionError;

                    // Navigate back to current schedules
                    navigate('/admin/schedules');
                } catch (err: unknown) {
                    console.error('Failed to archive version:', err);
                    showToast({ title: 'Failed to archive', message: err instanceof Error ? err.message : String(err), type: 'error' });
                }
            }
        });
    };

    const handleRecoverVersion = async () => {
        if (!versionId || !versionStatus?.batch_id) return;

        setConfirmDialog({
            open: true,
            title: 'Recover Version',
            message: 'Are you sure you want to recover this version? It will be restored as a draft.',
            onConfirm: async () => {
                try {
                    // Check for conflicts with existing active schedules
                    const { data: existingSchedules } = await supabase
                        .from('schedules')
                        .select('id, section_id, teacher_id, room_id, day_of_week, start_time, end_time')
                        .eq('status', 'published')
                        .eq('is_active', true)
                        .limit(10);

                    // Get schedules in the batch being recovered
                    const { data: batchSchedules } = await supabase
                        .from('schedules')
                        .select('id, section_id, teacher_id, room_id, day_of_week, start_time, end_time')
                        .eq('batch_id', versionStatus.batch_id);

                    if (existingSchedules && batchSchedules && existingSchedules.length > 0 && batchSchedules.length > 0) {
                        // Simple conflict check: same day/time for same teacher/room/section
                        const hasConflict = batchSchedules.some(batch => 
                            existingSchedules.some(existing =>
                                (batch.section_id === existing.section_id ||
                                 batch.teacher_id === existing.teacher_id ||
                                 batch.room_id === existing.room_id) &&
                                batch.day_of_week === existing.day_of_week &&
                                ((batch.start_time >= existing.start_time && batch.start_time < existing.end_time) ||
                                 (batch.end_time > existing.start_time && batch.end_time <= existing.end_time) ||
                                 (batch.start_time <= existing.start_time && batch.end_time >= existing.end_time))
                            )
                        );

                        if (hasConflict) {
                            setConfirmDialog({
                                open: true,
                                title: 'Conflict Warning',
                                message: 'Warning: Recovering this version may create conflicts with existing published schedules. Continue anyway?',
                                onConfirm: async () => {
                                    try {
                                        // Recover the schedules by setting status back to 'draft'
                                        const { error: updateError } = await supabase
                                            .from('schedules')
                                            .update({ status: 'draft' })
                                            .eq('batch_id', versionStatus.batch_id);

                                        if (updateError) throw updateError;

                                        // Activate the version
                                        const { error: versionError } = await supabase
                                            .from('schedule_versions')
                                            .update({ is_active: true })
                                            .eq('id', versionId);

                                        if (versionError) throw versionError;

                                        // Navigate back to current schedules
                                        navigate('/admin/schedules');
                                    } catch (err: unknown) {
                                        console.error('Failed to recover version:', err);
                                        showToast({ title: 'Failed to recover', message: err instanceof Error ? err.message : String(err), type: 'error' });
                                    }
                                }
                            });
                            return;
                        }
                    }

                    // Recover the schedules by setting status back to 'draft'
                    const { error: updateError } = await supabase
                        .from('schedules')
                        .update({ status: 'draft' })
                        .eq('batch_id', versionStatus.batch_id);

                    if (updateError) throw updateError;

                    // Activate the version
                    const { error: versionError } = await supabase
                        .from('schedule_versions')
                        .update({ is_active: true })
                        .eq('id', versionId);

                    if (versionError) throw versionError;

                    // Navigate back to current schedules
                    navigate('/admin/schedules');
                } catch (err: unknown) {
                    console.error('Failed to recover version:', err);
                    showToast({ title: 'Failed to recover', message: err instanceof Error ? err.message : String(err), type: 'error' });
                }
            }
        });
    };

    const handleUnpublishCurrentSchedule = async () => {
        setConfirmDialog({
            open: true,
            title: 'Unpublish Schedule',
            message: 'Are you sure you want to unpublish the current schedule? It will become a draft and students/teachers will not see it.',
            onConfirm: async () => {
                try {
                    // Update all published schedules to draft
                    const { error } = await supabase
                        .from('schedules')
                        .update({ status: 'draft' })
                        .eq('status', 'published');

                    if (error) throw error;

                    // Update versionStatus to reflect the change
                    setVersionStatus({
                        change_type: 'created',
                        is_active: false,
                        schedules_status: 'draft',
                        batch_id: null,
                    });

                    showToast({ title: 'Unpublished', type: 'success' });
                    fetchData();
                } catch (err: unknown) {
                    console.error('Failed to unpublish:', err);
                    showToast({ title: 'Failed to unpublish', message: err instanceof Error ? err.message : String(err), type: 'error' });
                }
            }
        });
    };

    const handleUnpublishVersion = async () => {
        if (!versionId) return;

        setConfirmDialog({
            open: true,
            title: 'Unpublish Version',
            message: 'Are you sure you want to unpublish this version? It will become a draft and students/teachers will not see it.',
            onConfirm: async () => {
                try {
                    // Get schedule IDs for this version
                    const { data: versionData } = await supabase
                        .from('schedule_versions')
                        .select('snapshot')
                        .eq('id', versionId)
                        .single();

                    if (!versionData?.snapshot) {
                        showToast({ title: 'No snapshot found', type: 'error' });
                        return;
                    }

                    const snapshot = Array.isArray(versionData.snapshot) ? versionData.snapshot : [versionData.snapshot];
                    const scheduleIds = snapshot.map((s: any) => s.id).filter(Boolean);

                    if (scheduleIds.length > 0) {
                        // Update schedules to draft
                        const { error } = await supabase
                            .from('schedules')
                            .update({ status: 'draft' })
                            .in('id', scheduleIds);

                        if (error) throw error;
                    }

                    showToast({ title: 'Version unpublished', type: 'success' });
                    navigate('/admin/schedules/versions');
                } catch (err: unknown) {
                    console.error('Failed to unpublish version:', err);
                    showToast({ title: 'Failed to unpublish', type: 'error' });
                }
            }
        });
    };

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
            sub: `${r.type ? r.type.charAt(0).toUpperCase() + r.type.slice(1) : 'General'} · Floor ${r.floor ?? 'N/A'} · Capacity ${r.capacity ?? 'N/A'}`,
            details: [
                `Type: ${r.type ? r.type.charAt(0).toUpperCase() + r.type.slice(1) : 'General'}`,
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

    // Count visible schedules (unique entity + semester + academic_year)
    const visibleScheduleCount = useMemo(() => {
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

    const selectedSchedules = useMemo(() => {
        if (!selected) return [] as ScheduleRow[];
        // When an entity is selected, show all sessions for that entity
        return schedules.filter(selected.match);
    }, [schedules, selected]);

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
                    <h1 className="dashboard-title"><CalendarDays size={20} /> Schedule Management</h1>
                    <p className="dashboard-subtitle">
                        {versionName ? (
                            <>Viewing version: <strong>{versionName}</strong></>
                        ) : selected ? (
                            `Weekly schedule for ${selected.label}`
                        ) : (
                            `Browse by category · ${visibleScheduleCount} of ${totalScheduleCount} schedules`
                        )}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {versionName ? (
                        <>
                            {versionStatus?.change_type === 'publish' && versionStatus?.is_active && (
                                <button onClick={handleUnpublishVersion} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <Download size={16} /> Unpublish
                                </button>
                            )}
                            {versionStatus?.change_type === 'publish' && !versionStatus?.is_active && (
                                <button onClick={handlePublishPreviousVersion} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <CheckCircle size={16} /> Publish
                                </button>
                            )}
                            {versionStatus?.schedules_status === 'submitted' && canApprove && (
                                <button onClick={handleApprovePublishVersion} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <CheckCircle size={16} /> Approve & Publish
                                </button>
                            )}
                            {versionStatus?.schedules_status === 'draft' && (
                                <button onClick={handleSubmitVersion} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <Send size={16} /> Submit
                                </button>
                            )}
                            {versionStatus?.schedules_status === 'archived' ? (
                                <button
                                    onClick={handleRecoverVersion}
                                    className="btn"
                                    style={{
                                        textDecoration: 'none',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        backgroundColor: 'var(--accent-success-10, rgba(75, 200, 75, 0.1))',
                                        border: '1px solid var(--accent-success)',
                                        color: 'var(--accent-success)',
                                    }}
                                >
                                    <RefreshCw size={16} /> Recover
                                </button>
                            ) : (
                                <button
                                    onClick={handleArchiveVersion}
                                    className="btn"
                                    style={{
                                        textDecoration: 'none',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        backgroundColor: 'var(--accent-error-10, rgba(200, 75, 75, 0.1))',
                                        border: '1px solid var(--accent-error)',
                                        color: 'var(--accent-error)',
                                    }}
                                >
                                    <Archive size={16} /> Archive
                                </button>
                            )}
                        </>
                    ) : (
                        // Current schedules (no versionId) - show unpublish if published
                        versionStatus?.schedules_status === 'published' && (
                            <button onClick={handleUnpublishCurrentSchedule} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <Download size={16} /> Unpublish
                            </button>
                        )
                    )}
                    <Link to="/admin/schedules/versions" className="btn btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <History size={16} /> View Versions
                    </Link>
                </div>
            </div>

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
                    rooms={rooms}
                    teachers={teachers}
                    sections={sections}
                    category={category}
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
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
            
            <ConfirmDialog
                open={confirmDialog.open}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog({ ...confirmDialog, open: false })}
                confirmVariant="danger"
            />
        </div>
    );
};

interface ScheduleDetailProps {
    entity: Entity;
    schedules: ScheduleRow[];
    onBack: () => void;
    onUpdate?: () => void;
    rooms: { id: string; name: string; building: string | null; type: string | null; capacity: number | null; floor: number | null; compatible_subject_ids?: string[] }[];
    teachers: { id: string; full_name: string; department: string; is_active: boolean }[];
    sections: { id: string; name: string; program: string | null; year_level: number | null; student_count?: number }[];
    category: Category;
}

const ScheduleDetail: React.FC<ScheduleDetailProps> = ({ entity, schedules, onBack, onUpdate, rooms, teachers, sections, category }) => {
    const { role, roles } = useAuth();
    const { showToast } = useToast();
    const allRoles = roles.length > 0 ? roles : (role ? [role] : []);
    const canEdit = allRoles.some(r => ADMIN_ROLES.includes(r));

    const [selectedEvent, setSelectedEvent] = useState<typeof events[0] | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
    const [splitModal, setSplitModal] = useState(false);
    const [splitCount, setSplitCount] = useState(2);
    const [showVersionHistory, setShowVersionHistory] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);

    const events = schedules.map(s => {
        const dayIdx = dayOrder.indexOf(s.day_of_week);
        const start = slotIndex(s.start_time);
        const end = slotIndex(s.end_time);
        return { s, dayIdx, start, span: Math.max(1, end - start) };
    }).filter(e => e.dayIdx >= 0);

    // Convert ScheduleRow to ScheduleEntry format for ScheduleDragDrop
    const scheduleEntries = useMemo(() => {
        return schedules.map(s => ({
            key: s.id,
            subjectId: s.subject?.id || 'unknown',
            sectionId: s.section?.id || 'unknown',
            teacherId: s.teacher?.id || 'unknown',
            roomId: s.room?.id || 'unknown',
            day: s.day_of_week,
            start: s.start_time,
            end: s.end_time,
            subjectName: s.subject?.name || 'Unknown',
            teacherName: s.teacher?.profile?.full_name || '',
            roomName: s.room?.name || '',
            sectionName: s.section?.name || '',
            subjectCode: s.subject?.code,
            // Hard constraint fields
            subjectType: s.subject?.type,
            roomType: s.room?.type,
            sectionSize: s.section?.student_count,
            capacity: s.room?.capacity,
            compatibleRoomIds: s.subject?.compatible_room_ids,
            compatibleSubjectIds: s.room?.compatible_subject_ids,
        }));
    }, [schedules]);

    const dragDropEvents = useMemo(() => {
        return scheduleEntries.map(entry => {
            const dayIdx = dayOrder.indexOf(entry.day);
            const start = slotIndex(entry.start);
            const end = slotIndex(entry.end);
            return { entry, dayIdx, start, span: Math.max(1, end - start) };
        }).filter(e => e.dayIdx >= 0);
    }, [scheduleEntries]);

    // Handle schedule update from drag-and-drop
    const handleScheduleUpdate = async (updatedEntry: ScheduleEntry) => {
        console.log('[ScheduleManagement] HANDLE SCHEDULE UPDATE START:', {
            updatedEntry: {
                key: updatedEntry.key,
                subjectName: updatedEntry.subjectName,
                day: updatedEntry.day,
                start: updatedEntry.start,
                end: updatedEntry.end,
                roomId: updatedEntry.roomId,
                roomName: updatedEntry.roomName,
                teacherId: updatedEntry.teacherId,
                teacherName: updatedEntry.teacherName,
                sectionId: updatedEntry.sectionId,
                sectionName: updatedEntry.sectionName
            }
        });

        try {
            const updateData: Record<string, string> = {};

            // Only include fields that have changed from the original entry
            const originalEntry = schedules.find(s => s.id === updatedEntry.key);

            console.log('[ScheduleManagement] ORIGINAL ENTRY LOOKUP:', {
                found: !!originalEntry,
                originalEntry: originalEntry ? {
                    id: originalEntry.id,
                    day_of_week: originalEntry.day_of_week,
                    start_time: originalEntry.start_time,
                    end_time: originalEntry.end_time,
                    teacher_id: originalEntry.teacher?.id,
                    room_id: originalEntry.room?.id,
                    section_id: originalEntry.section?.id
                } : null
            });

            if (!originalEntry) {
                console.error('[ScheduleManagement] ORIGINAL ENTRY NOT FOUND:', updatedEntry.key);
                return;
            }

            if (updatedEntry.day !== originalEntry.day_of_week) updateData.day_of_week = updatedEntry.day;
            if (updatedEntry.start !== originalEntry.start_time) updateData.start_time = updatedEntry.start;
            if (updatedEntry.end !== originalEntry.end_time) updateData.end_time = updatedEntry.end;
            if (updatedEntry.teacherId !== originalEntry.teacher?.id) updateData.teacher_id = updatedEntry.teacherId;
            if (updatedEntry.roomId !== originalEntry.room?.id) updateData.room_id = updatedEntry.roomId;
            if (updatedEntry.sectionId !== originalEntry.section?.id) updateData.section_id = updatedEntry.sectionId;

            console.log('[ScheduleManagement] UPDATE DATA BUILT:', updateData);

            if (Object.keys(updateData).length === 0) {
                console.warn('[ScheduleManagement] NO CHANGES DETECTED, ABORTING UPDATE');
                return;
            }

            console.log('[ScheduleManagement] CALLING SUPABASE UPDATE:', {
                table: 'schedules',
                id: updatedEntry.key,
                updateData
            });

            const { data, error } = await supabase.from('schedules').update(updateData).eq('id', updatedEntry.key).select();

            console.log('[ScheduleManagement] SUPABASE UPDATE RESULT:', {
                success: !error,
                error: error ? error.message : null,
                data: data
            });

            if (error) {
                console.error('[ScheduleManagement] SUPABASE UPDATE ERROR:', error);
                throw error;
            }

            console.log('[ScheduleManagement] CALLING onUpdate CALLBACK TO REFRESH DATA');
            onUpdate?.();
            console.log('[ScheduleManagement] HANDLE SCHEDULE UPDATE COMPLETED');
        } catch (err) {
            console.error('[ScheduleManagement] ERROR UPDATING SCHEDULE:', err);
            showToast({ title: 'Failed to update', type: 'error' });
        }
    };

    // Context menu handler for ScheduleDragDrop
    const handleContextMenu = (e: React.MouseEvent, entry: ScheduleEntry) => {
        if (!canEdit) return;
        e.preventDefault();
        
        // Find the corresponding event in the original events array
        const event = events.find(ev => ev.s.id === entry.key);
        if (event) {
            setSelectedEvent(event);
            setMenuPosition({ x: e.clientX, y: e.clientY });
            setShowMenu(true);
        }
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
            showToast({ title: 'Failed to split', type: 'error' });
        }
    };

    const handleCombine = async () => {
        if (!selectedEvent) return;

        const sameDayEvents = events.filter(
            e => e.dayIdx === selectedEvent.dayIdx && e.s.id !== selectedEvent.s.id
        );

        if (sameDayEvents.length === 0) {
            showToast({ title: 'No events', message: 'No other events on the same day to combine with', type: 'warning' });
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
            showToast({ title: 'Failed to combine', type: 'error' });
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
        <div style={isFullScreen ? { position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg-primary)', padding: 24, overflow: 'auto' } : {}}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                    <span>{schedules.length} {schedules.length === 1 ? 'session' : 'sessions'} this week</span>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setIsFullScreen(!isFullScreen)}
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        title={isFullScreen ? 'Exit full screen' : 'Full screen'}
                    >
                        {isFullScreen ? <Minimize size={14} /> : <Maximize size={14} />}
                    </button>
                </div>
            </div>

            {schedules.length === 0 ? (
                <div className="sm-calendar"><div className="sm-cal-empty">No scheduled sessions.</div></div>
            ) : (
                <div className="sm-calendar">
                    <ScheduleDragDrop
                        entries={scheduleEntries}
                        rooms={rooms.map(r => ({ 
                            id: r.id, 
                            name: r.name, 
                            building: r.building || '', 
                            type: r.type || '', 
                            capacity: r.capacity || 0, 
                            floor: r.floor || 0, 
                            is_available: true, 
                            weight: 0, 
                            priority_note: null 
                        }))}
                        teachers={teachers.map(t => ({ 
                            id: t.id, 
                            full_name: t.full_name,
                            department: t.department,
                            is_active: t.is_active
                        }))}
                        sections={sections as any[]} // eslint-disable-line @typescript-eslint/no-explicit-any
                        onUpdate={handleScheduleUpdate}
                        dayOrder={dayOrder}
                        START_HOUR={START_HOUR}
                        TOTAL_SLOTS={TOTAL_SLOTS}
                        formatTime={formatTime24Hour}
                        colorForKey={colorForKey}
                        viewMode={category === 'sections' ? 'section' : category === 'teachers' ? 'teacher' : 'room'}
                        events={dragDropEvents}
                        canEdit={canEdit}
                        onContextMenu={handleContextMenu}
                        timeFormat={(localStorage.getItem('optisched-time-format') as '12h' | '24h') || '24h'}
                    />

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
