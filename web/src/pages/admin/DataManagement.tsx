import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { hasAnyRole } from '../../types/database';
import { BookOpen, MapPin, Plus, Trash2, X, Loader2, Layers, Lock, Edit, Folder, Database, ChevronUp, ChevronDown } from 'lucide-react';
import '../admin/Dashboard.css';

type Tab = 'rooms' | 'subjects' | 'sections';

type RoomFacilityType = 'general_classroom' | 'computer_lab' | 'physics_lab' | 'chemistry_lab' | 'pe_hall' | 'science_lab' | 'art_room' | 'music_room' | 'library' | 'auditorium' | 'other';

interface Room {
    id: string;
    name: string;
    building: string;
    floor: number;
    type: string; // 'common' or 'special'
    room_facility_type?: RoomFacilityType; // Informational facility type
    capacity: number;
    is_available: boolean;
    weight: number;
    priority_note: string | null;
    owner_id: string | null;
    is_public: boolean;
    shared_with: string[];
    // Generation-specific fields
    is_special_room?: boolean;
    compatible_subject_ids?: string[]; // IDs of subjects that can be taught in this room
    equipment_availability?: string[];
    movement_cost?: number;
}

interface Subject {
    id: string;
    code: string;
    name: string;
    units: number;
    type: string; // 'common' or 'special'
    program: string;
    year_level: number;
    duration_hours: number;
    teacher_id?: string | null;
    weight: number;
    priority_note: string | null;
    owner_id: string | null;
    is_public: boolean;
    shared_with: string[];
    // Generation-specific fields
    required_weekly_hours?: number | null;
    optional_monthly_hours?: number | null;
    session_duration_preference?: number;
    teacher_eligibility_pool?: (string | null)[];
    compatible_room_ids?: string[]; // IDs of rooms that can accommodate this subject
    priority_level?: 'high' | 'normal' | 'low';
    requires_special_room?: boolean;
    preferred_time_window?: 'early' | 'mid' | 'late' | null;
}

interface Section {
    id: string;
    name: string;
    program: string;
    year_level: number;
    student_count: number;
    parent_id: string | null;
    weight: number;
    path: string;
    node_type: 'group' | 'section';
    is_active: boolean;
    description: string | null;
    metadata: Record<string, unknown>;
    sort_order: number;
    load_category?: 'heavy' | 'normal' | 'light';
    owner_id: string | null;
    is_public: boolean;
    shared_with: string[];
    // Generation-specific fields
    hierarchy_path?: string;
    hierarchy_weight?: number;
    priority_weight?: number;
}

const DataManagement: React.FC = () => {
    const { role, roles } = useAuth();
    const allRoles = roles.length > 0 ? roles : (role ? [role] : []);
    const canEdit = hasAnyRole(allRoles, ['admin', 'schedule_manager', 'schedule_admin', 'power_admin', 'system_admin']);
    const [tab, setTab] = useState<Tab>('rooms');
    const [rooms, setRooms] = useState<Room[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [sections, setSections] = useState<Section[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortColumn, setSortColumn] = useState<string>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const defaultSortColumn = useMemo(() => tab === 'rooms' ? 'name' : tab === 'subjects' ? 'code' : 'name', [tab]);

    // Add modals
    const [showAddRoom, setShowAddRoom] = useState(false);
    const [showAddSubject, setShowAddSubject] = useState(false);
    const [showAddSection, setShowAddSection] = useState(false);
    const [saving, setSaving] = useState(false);

    // Edit modals
    const [showEditRoom, setShowEditRoom] = useState(false);
    const [showEditSubject, setShowEditSubject] = useState(false);
    const [showEditSection, setShowEditSection] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form state
    const [newRoom, setNewRoom] = useState({ name: '', capacity: 40, type: 'common', room_facility_type: 'general_classroom' as RoomFacilityType, building: '', floor: 1, weight: 50, priority_note: '', owner_id: null as string | null, is_public: false, shared_with: [] as string[], is_special_room: false, movement_cost: 50, compatible_subject_ids: [] as string[] });
    const [newSubject, setNewSubject] = useState({ code: '', name: '', units: 3, type: 'common', duration_hours: 1, program: '', year_level: 1, teacher_id: null as string | null, weight: 50, priority_note: '', owner_id: null as string | null, is_public: false, shared_with: [] as string[], required_weekly_hours: null as number | null, optional_monthly_hours: null as number | null, session_duration_preference: 60, priority_level: 'normal' as 'high' | 'normal' | 'low', requires_special_room: false, preferred_time_window: null as 'early' | 'mid' | 'late' | null, compatible_room_ids: [] as string[] });
    const [newSection, setNewSection] = useState({ name: '', program: '', year_level: 1, student_count: 30, parent_id: null as string | null, weight: 50, node_type: 'section' as 'group' | 'section', description: '', sort_order: 0, load_category: 'normal' as 'heavy' | 'normal' | 'light', owner_id: null as string | null, is_public: false, shared_with: [] as string[], hierarchy_path: '', hierarchy_weight: 50, priority_weight: 50 });
    const [editRoom, setEditRoom] = useState({ name: '', capacity: 40, type: 'common', room_facility_type: 'general_classroom' as RoomFacilityType, building: '', floor: 1, weight: 50, priority_note: '', owner_id: null as string | null, is_public: false, shared_with: [] as string[], is_special_room: false, movement_cost: 50, compatible_subject_ids: [] as string[] });
    const [editSubject, setEditSubject] = useState({ code: '', name: '', units: 3, type: 'common', duration_hours: 1, program: '', year_level: 1, teacher_id: null as string | null, weight: 50, priority_note: '', owner_id: null as string | null, is_public: false, shared_with: [] as string[], required_weekly_hours: null as number | null, optional_monthly_hours: null as number | null, session_duration_preference: 60, priority_level: 'normal' as 'high' | 'normal' | 'low', requires_special_room: false, preferred_time_window: null as 'early' | 'mid' | 'late' | null, compatible_room_ids: [] as string[] });
    const [editSection, setEditSection] = useState({ name: '', program: '', year_level: 1, student_count: 30, parent_id: null as string | null, weight: 50, node_type: 'section' as 'group' | 'section', description: '', sort_order: 0, load_category: 'normal' as 'heavy' | 'normal' | 'light', owner_id: null as string | null, is_public: false, shared_with: [] as string[], hierarchy_path: '', hierarchy_weight: 50, priority_weight: 50 });

    const fetchAll = async () => {
        setLoading(true);
        const [r, s, sec] = await Promise.all([
            supabase.from('rooms').select('*').order('name'),
            supabase.from('subjects').select('*').order('code'),
            supabase.from('sections').select('*').order('program').order('year_level').order('name'),
        ]);
        setRooms(r.data || []);
        setSubjects(s.data || []);
        setSections(sec.data || []);
        setLoading(false);
    };

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            if (!isMounted) return;
            await fetchAll();
        };
        fetchData();
        return () => { isMounted = false; };
    }, []);

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const getSortedRooms = () => {
        return [...rooms].sort((a, b) => {
            let aValue: string | number;
            let bValue: string | number;
            const column = sortColumn || defaultSortColumn;

            switch (column) {
                case 'name':
                    aValue = a.name?.toLowerCase() || '';
                    bValue = b.name?.toLowerCase() || '';
                    break;
                case 'building':
                    aValue = a.building?.toLowerCase() || '';
                    bValue = b.building?.toLowerCase() || '';
                    break;
                case 'floor':
                    aValue = a.floor || 0;
                    bValue = b.floor || 0;
                    break;
                case 'type':
                    aValue = a.type?.toLowerCase() || '';
                    bValue = b.type?.toLowerCase() || '';
                    break;
                case 'capacity':
                    aValue = a.capacity || 0;
                    bValue = b.capacity || 0;
                    break;
                default:
                    aValue = a.name?.toLowerCase() || '';
                    bValue = b.name?.toLowerCase() || '';
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const getSortedSubjects = () => {
        return [...subjects].sort((a, b) => {
            let aValue: string | number;
            let bValue: string | number;
            const column = sortColumn || defaultSortColumn;

            switch (column) {
                case 'code':
                    aValue = a.code?.toLowerCase() || '';
                    bValue = b.code?.toLowerCase() || '';
                    break;
                case 'name':
                    aValue = a.name?.toLowerCase() || '';
                    bValue = b.name?.toLowerCase() || '';
                    break;
                case 'units':
                    aValue = a.units || 0;
                    bValue = b.units || 0;
                    break;
                case 'type':
                    aValue = a.type?.toLowerCase() || '';
                    bValue = b.type?.toLowerCase() || '';
                    break;
                case 'program':
                    aValue = a.program?.toLowerCase() || '';
                    bValue = b.program?.toLowerCase() || '';
                    break;
                case 'year_level':
                    aValue = a.year_level || 0;
                    bValue = b.year_level || 0;
                    break;
                default:
                    aValue = a.code?.toLowerCase() || '';
                    bValue = b.code?.toLowerCase() || '';
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const getSortedSections = () => {
        return [...sections].sort((a, b) => {
            let aValue: string | number;
            let bValue: string | number;
            const column = sortColumn || defaultSortColumn;

            switch (column) {
                case 'name':
                    aValue = a.name?.toLowerCase() || '';
                    bValue = b.name?.toLowerCase() || '';
                    break;
                case 'type':
                    aValue = a.node_type?.toLowerCase() || '';
                    bValue = b.node_type?.toLowerCase() || '';
                    break;
                case 'program':
                    aValue = a.program?.toLowerCase() || '';
                    bValue = b.program?.toLowerCase() || '';
                    break;
                case 'year_level':
                    aValue = a.year_level || 0;
                    bValue = b.year_level || 0;
                    break;
                case 'student_count':
                    aValue = a.student_count || 0;
                    bValue = b.student_count || 0;
                    break;
                case 'weight':
                    aValue = a.weight || 0;
                    bValue = b.weight || 0;
                    break;
                default:
                    aValue = a.name?.toLowerCase() || '';
                    bValue = b.name?.toLowerCase() || '';
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const handleAddRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation: Special rooms must have at least one compatible subject
        if (newRoom.type === 'special' && newRoom.compatible_subject_ids.length === 0) {
            alert('Special rooms must have at least one compatible subject selected.');
            return;
        }
        
        setSaving(true);
        const { data: room } = await supabase.from('rooms').insert({
            name: newRoom.name,
            capacity: newRoom.capacity,
            type: newRoom.type,
            room_facility_type: newRoom.room_facility_type,
            building: newRoom.building,
            floor: newRoom.floor,
            weight: newRoom.weight,
            priority_note: newRoom.priority_note,
            owner_id: newRoom.owner_id,
            is_public: newRoom.is_public,
            shared_with: newRoom.shared_with,
            is_special_room: newRoom.is_special_room,
            movement_cost: newRoom.movement_cost,
        }).select().single();

        // Sync subject compatibility if room is special
        if (room && room.type === 'special' && newRoom.compatible_subject_ids.length > 0) {
            const subjectRelations = newRoom.compatible_subject_ids.map(subjectId => ({
                subject_id: subjectId,
                room_id: room.id,
                priority: 1
            }));
            await supabase.from('subject_rooms').insert(subjectRelations);
        }

        setShowAddRoom(false);
        setNewRoom({ name: '', capacity: 40, type: 'common', room_facility_type: 'general_classroom', building: '', floor: 1, weight: 50, priority_note: '', owner_id: null, is_public: false, shared_with: [], is_special_room: false, movement_cost: 50, compatible_subject_ids: [] });
        setSaving(false);
        fetchAll();
    };

    const handleAddSubject = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation: Special subjects must have at least one compatible room
        if (newSubject.type === 'special' && newSubject.compatible_room_ids.length === 0) {
            alert('Special subjects must have at least one compatible room selected.');
            return;
        }
        
        setSaving(true);
        const { data: subject } = await supabase.from('subjects').insert({
            code: newSubject.code,
            name: newSubject.name,
            units: newSubject.units,
            type: newSubject.type,
            duration_hours: newSubject.duration_hours,
            program: newSubject.program,
            year_level: newSubject.year_level,
            teacher_id: newSubject.teacher_id,
            weight: newSubject.weight,
            priority_note: newSubject.priority_note,
            owner_id: newSubject.owner_id,
            is_public: newSubject.is_public,
            shared_with: newSubject.shared_with,
            required_weekly_hours: newSubject.required_weekly_hours,
            optional_monthly_hours: newSubject.optional_monthly_hours,
            session_duration_preference: newSubject.session_duration_preference,
            priority_level: newSubject.priority_level,
            requires_special_room: newSubject.requires_special_room,
            preferred_time_window: newSubject.preferred_time_window,
        }).select().single();

        // Sync room compatibility if subject is special
        if (subject && subject.type === 'special' && newSubject.compatible_room_ids.length > 0) {
            const roomRelations = newSubject.compatible_room_ids.map(roomId => ({
                subject_id: subject.id,
                room_id: roomId,
                priority: 1
            }));
            await supabase.from('subject_rooms').insert(roomRelations);
        }

        setShowAddSubject(false);
        setNewSubject({ code: '', name: '', units: 3, type: 'common', duration_hours: 1, program: '', year_level: 1, teacher_id: null, weight: 50, priority_note: '', owner_id: null, is_public: false, shared_with: [], required_weekly_hours: null, optional_monthly_hours: null, session_duration_preference: 60, priority_level: 'normal', requires_special_room: false, preferred_time_window: null, compatible_room_ids: [] });
        setSaving(false);
        fetchAll();
    };

    const handleAddSection = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        await supabase.from('sections').insert(newSection);
        setShowAddSection(false);
        setNewSection({ name: '', program: '', year_level: 1, student_count: 30, parent_id: null, weight: 50, node_type: 'section', description: '', sort_order: 0, load_category: 'normal', owner_id: null, is_public: false, shared_with: [], hierarchy_path: '', hierarchy_weight: 50, priority_weight: 50 });
        setSaving(false);
        fetchAll();
    };

    const handleDelete = async (table: string, id: string, label: string) => {
        if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
        
        try {
            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) {
                console.error('Delete error:', error);
                alert(`Failed to delete: ${error.message}`);
                return;
            }
            await fetchAll();
        } catch (err: unknown) {
            console.error('Delete exception:', err);
            const message = err instanceof Error ? err.message : String(err);
            alert(`Failed to delete: ${message}`);
        }
    };

    const openEditRoom = async (room: Room) => {
        // Fetch compatible subjects for this room
        const { data: relations } = await supabase
            .from('subject_rooms')
            .select('subject_id')
            .eq('room_id', room.id);
        
        const compatibleSubjectIds = relations?.map(r => r.subject_id) || [];

        setEditRoom({ 
            name: room.name, 
            capacity: room.capacity, 
            type: room.type, 
            room_facility_type: room.room_facility_type || 'general_classroom', 
            building: room.building, 
            floor: room.floor, 
            weight: room.weight, 
            priority_note: room.priority_note || '', 
            owner_id: room.owner_id, 
            is_public: room.is_public, 
            shared_with: room.shared_with, 
            is_special_room: room.is_special_room || false, 
            movement_cost: room.movement_cost || 50,
            compatible_subject_ids: compatibleSubjectIds
        });
        setEditingId(room.id);
        setShowEditRoom(true);
    };

    const openEditSubject = async (subject: Subject) => {
        // Fetch compatible rooms for this subject
        const { data: relations } = await supabase
            .from('subject_rooms')
            .select('room_id')
            .eq('subject_id', subject.id);
        
        const compatibleRoomIds = relations?.map(r => r.room_id) || [];

        setEditSubject({
            code: subject.code,
            name: subject.name,
            units: subject.units,
            type: subject.type,
            duration_hours: subject.duration_hours,
            program: subject.program,
            year_level: subject.year_level,
            teacher_id: subject.teacher_id || null,
            weight: subject.weight,
            priority_note: subject.priority_note || '',
            owner_id: subject.owner_id,
            is_public: subject.is_public,
            shared_with: subject.shared_with,
            required_weekly_hours: subject.required_weekly_hours || null,
            optional_monthly_hours: subject.optional_monthly_hours || null,
            session_duration_preference: subject.session_duration_preference || 60,
            priority_level: subject.priority_level || 'normal',
            requires_special_room: subject.requires_special_room || false,
            preferred_time_window: subject.preferred_time_window || null,
            compatible_room_ids: compatibleRoomIds
        });
        setEditingId(subject.id);
        setShowEditSubject(true);
    };

    const openEditSection = (section: Section) => {
        setEditSection({ name: section.name, program: section.program, year_level: section.year_level, student_count: section.student_count, parent_id: section.parent_id, weight: section.weight, node_type: section.node_type, description: section.description || '', sort_order: section.sort_order, load_category: section.load_category || 'normal', owner_id: section.owner_id, is_public: section.is_public, shared_with: section.shared_with, hierarchy_path: section.hierarchy_path || '', hierarchy_weight: section.hierarchy_weight || 50, priority_weight: section.priority_weight || 50 });
        setEditingId(section.id);
        setShowEditSection(true);
    };

    const handleEditRoom = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation: Special rooms must have at least one compatible subject
        if (editRoom.type === 'special' && editRoom.compatible_subject_ids.length === 0) {
            alert('Special rooms must have at least one compatible subject selected.');
            return;
        }
        
        setSaving(true);
        
        try {
            // Update room
            const { error: updateError } = await supabase.from('rooms').update({
                name: editRoom.name,
                capacity: editRoom.capacity,
                type: editRoom.type,
                room_facility_type: editRoom.room_facility_type,
                building: editRoom.building,
                floor: editRoom.floor,
                weight: editRoom.weight,
                priority_note: editRoom.priority_note,
                owner_id: editRoom.owner_id,
                is_public: editRoom.is_public,
                shared_with: editRoom.shared_with,
                is_special_room: editRoom.is_special_room,
                movement_cost: editRoom.movement_cost,
            }).eq('id', editingId);

            if (updateError) {
                console.error('Update room error:', updateError);
                alert(`Failed to update room: ${updateError.message}`);
                setSaving(false);
                return;
            }

            // Sync subject compatibility - delete old and insert new
            const { error: deleteError } = await supabase.from('subject_rooms').delete().eq('room_id', editingId);
            if (deleteError) {
                console.error('Delete subject_rooms error:', deleteError);
                alert(`Failed to update room compatibility: ${deleteError.message}`);
                setSaving(false);
                return;
            }
            
            if (editRoom.type === 'special' && editRoom.compatible_subject_ids.length > 0) {
                const subjectRelations = editRoom.compatible_subject_ids.map(subjectId => ({
                    subject_id: subjectId,
                    room_id: editingId,
                    priority: 1
                }));
                const { error: insertError } = await supabase.from('subject_rooms').insert(subjectRelations);
                if (insertError) {
                    console.error('Insert subject_rooms error:', insertError);
                    alert(`Failed to update room compatibility: ${insertError.message}`);
                    setSaving(false);
                    return;
                }
            }

            setShowEditRoom(false);
            setEditRoom({ name: '', capacity: 40, type: 'common', room_facility_type: 'general_classroom', building: '', floor: 1, weight: 50, priority_note: '', owner_id: null, is_public: false, shared_with: [], is_special_room: false, movement_cost: 50, compatible_subject_ids: [] });
            setEditingId(null);
            setSaving(false);
            await fetchAll();
        } catch (err: unknown) {
            console.error('Edit room exception:', err);
            const message = err instanceof Error ? err.message : String(err);
            alert(`Failed to update room: ${message}`);
            setSaving(false);
        }
    };

    const handleEditSubject = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation: Special subjects must have at least one compatible room
        if (editSubject.type === 'special' && editSubject.compatible_room_ids.length === 0) {
            alert('Special subjects must have at least one compatible room selected.');
            return;
        }
        
        setSaving(true);

        try {
            // Update subject
            const { error: updateError } = await supabase.from('subjects').update({
                code: editSubject.code,
                name: editSubject.name,
                units: editSubject.units,
                type: editSubject.type,
                duration_hours: editSubject.duration_hours,
                program: editSubject.program,
                year_level: editSubject.year_level,
                teacher_id: editSubject.teacher_id,
                weight: editSubject.weight,
                priority_note: editSubject.priority_note,
                owner_id: editSubject.owner_id,
                is_public: editSubject.is_public,
                shared_with: editSubject.shared_with,
                required_weekly_hours: editSubject.required_weekly_hours,
                optional_monthly_hours: editSubject.optional_monthly_hours,
                session_duration_preference: editSubject.session_duration_preference,
                priority_level: editSubject.priority_level,
                requires_special_room: editSubject.requires_special_room,
                preferred_time_window: editSubject.preferred_time_window,
            }).eq('id', editingId);

            if (updateError) {
                console.error('Update subject error:', updateError);
                alert(`Failed to update subject: ${updateError.message}`);
                setSaving(false);
                return;
            }

            // Sync room compatibility - delete old and insert new
            const { error: deleteError } = await supabase.from('subject_rooms').delete().eq('subject_id', editingId);
            if (deleteError) {
                console.error('Delete subject_rooms error:', deleteError);
                alert(`Failed to update subject compatibility: ${deleteError.message}`);
                setSaving(false);
                return;
            }
            
            if (editSubject.type === 'special' && editSubject.compatible_room_ids.length > 0) {
                const roomRelations = editSubject.compatible_room_ids.map(roomId => ({
                    subject_id: editingId,
                    room_id: roomId,
                    priority: 1
                }));
                const { error: insertError } = await supabase.from('subject_rooms').insert(roomRelations);
                if (insertError) {
                    console.error('Insert subject_rooms error:', insertError);
                    alert(`Failed to update subject compatibility: ${insertError.message}`);
                    setSaving(false);
                    return;
                }
            }

            setShowEditSubject(false);
            setEditSubject({ code: '', name: '', units: 3, type: 'common', duration_hours: 1, program: '', year_level: 1, teacher_id: null, weight: 50, priority_note: '', owner_id: null, is_public: false, shared_with: [], required_weekly_hours: null, optional_monthly_hours: null, session_duration_preference: 60, priority_level: 'normal', requires_special_room: false, preferred_time_window: null, compatible_room_ids: [] });
            setEditingId(null);
            setSaving(false);
            await fetchAll();
        } catch (err: unknown) {
            console.error('Edit subject exception:', err);
            const message = err instanceof Error ? err.message : String(err);
            alert(`Failed to update subject: ${message}`);
            setSaving(false);
        }
    };

    const handleEditSection = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        
        try {
            const { error } = await supabase.from('sections').update(editSection).eq('id', editingId);
            if (error) {
                console.error('Update section error:', error);
                alert(`Failed to update section: ${error.message}`);
                setSaving(false);
                return;
            }
            setShowEditSection(false);
            setEditSection({ name: '', program: '', year_level: 1, student_count: 30, parent_id: null, weight: 50, node_type: 'section', description: '', sort_order: 0, load_category: 'normal', owner_id: null, is_public: false, shared_with: [], hierarchy_path: '', hierarchy_weight: 50, priority_weight: 50 });
            setEditingId(null);
            setSaving(false);
            await fetchAll();
        } catch (err: unknown) {
            console.error('Edit section exception:', err);
            const message = err instanceof Error ? err.message : String(err);
            alert(`Failed to update section: ${message}`);
            setSaving(false);
        }
    };

    const tabs: { key: Tab; label: string; icon: React.ElementType; count: number }[] = [
        { key: 'rooms', label: 'Rooms', icon: MapPin, count: rooms.length },
        { key: 'subjects', label: 'Subjects', icon: BookOpen, count: subjects.length },
        { key: 'sections', label: 'Sections', icon: Layers, count: sections.length },
    ];

    const getAddAction = () => {
        if (tab === 'rooms') return () => setShowAddRoom(true);
        if (tab === 'subjects') return () => setShowAddSubject(true);
        if (tab === 'sections') return () => setShowAddSection(true);
        return () => {};
    };

    const handleTabChange = (newTab: Tab) => {
        setTab(newTab);
        setSortColumn(newTab === 'rooms' ? 'name' : newTab === 'subjects' ? 'code' : 'name');
        setSortDirection('asc');
    };

    return (
        <div className="dashboard fade-in">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title"><Database size={20} /> Data Management</h1>
                    <p className="dashboard-subtitle">
                        {canEdit ? 'Manage rooms, subjects, and sections' : 'View rooms, subjects, and sections'}
                    </p>
                </div>
                {canEdit && (
                    <button className="btn btn-primary" onClick={getAddAction()}>
                        <Plus size={16} />
                        Add {tab === 'rooms' ? 'Room' : tab === 'subjects' ? 'Subject' : 'Section'}
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: 4, border: '1px solid var(--border-default)' }}>
                {tabs.map(t => (
                    <button key={t.key}
                        className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ flex: 1, borderRadius: 'var(--radius-sm)' }}
                        onClick={() => handleTabChange(t.key)}
                    >
                        <t.icon size={16} />
                        {t.label} ({t.count})
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>
            ) : (
                <>
                    {/* Rooms Table */}
                    {tab === 'rooms' && (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>
                                            <button onClick={() => handleSort('name')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                                                Name
                                                {sortColumn === 'name' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </button>
                                        </th>
                                        <th>
                                            <button onClick={() => handleSort('building')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                                                Building
                                                {sortColumn === 'building' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </button>
                                        </th>
                                        <th>
                                            <button onClick={() => handleSort('floor')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                                                Floor
                                                {sortColumn === 'floor' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </button>
                                        </th>
                                        <th>
                                            <button onClick={() => handleSort('type')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                                                Type
                                                {sortColumn === 'type' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </button>
                                        </th>
                                        <th>
                                            <button onClick={() => handleSort('capacity')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                                                Capacity
                                                {sortColumn === 'capacity' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </button>
                                        </th>
                                        <th>Status</th>
                                        <th style={{ width: 60 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getSortedRooms().map(r => (
                                        <tr key={r.id}>
                                            <td style={{ fontWeight: 600 }}>{r.name}</td>
                                            <td>{r.building}</td>
                                            <td>{r.floor}</td>
                                            <td><span className="badge" style={{ background: 'var(--accent-primary-subtle)', color: 'var(--accent-primary)' }}>{r.type?.charAt(0).toUpperCase() + r.type?.slice(1).toLowerCase()}</span></td>
                                            <td>{r.capacity}</td>
                                            <td><span className="badge" style={{ background: r.is_available ? 'var(--accent-success-subtle)' : 'var(--accent-error-subtle)', color: r.is_available ? 'var(--accent-success)' : 'var(--accent-error)' }}>{r.is_available ? 'AVAILABLE' : 'UNAVAILABLE'}</span></td>
                                            <td>
                                                {canEdit ? (
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => openEditRoom(r)}><Edit size={15} style={{ color: 'var(--text-secondary)' }} /></button>
                                                        <button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => handleDelete('rooms', r.id, r.name)}><Trash2 size={15} style={{ color: 'var(--accent-error)' }} /></button>
                                                    </div>
                                                ) : (
                                                    <Lock size={15} style={{ color: 'var(--text-muted)' }} />
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {getSortedRooms().length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No rooms added yet.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Subjects Table */}
                    {tab === 'subjects' && (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>
                                            <button onClick={() => handleSort('code')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                                                Code
                                                {sortColumn === 'code' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </button>
                                        </th>
                                        <th>
                                            <button onClick={() => handleSort('name')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                                                Name
                                                {sortColumn === 'name' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </button>
                                        </th>
                                        <th>
                                            <button onClick={() => handleSort('units')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                                                Units
                                                {sortColumn === 'units' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </button>
                                        </th>
                                        <th>
                                            <button onClick={() => handleSort('type')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                                                Type
                                                {sortColumn === 'type' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </button>
                                        </th>
                                        <th>
                                            <button onClick={() => handleSort('program')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                                                Program
                                                {sortColumn === 'program' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </button>
                                        </th>
                                        <th>
                                            <button onClick={() => handleSort('year_level')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                                                Year
                                                {sortColumn === 'year_level' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </button>
                                        </th>
                                        <th>Hours</th>
                                        <th style={{ width: 60 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getSortedSubjects().map(s => (
                                        <tr key={s.id}>
                                            <td style={{ fontWeight: 600 }}>{s.code}</td>
                                            <td>{s.name}</td>
                                            <td>{s.units}</td>
                                            <td><span className="badge" style={{ background: s.type === 'special' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)', color: s.type === 'special' ? '#fbbf24' : '#60a5fa' }}>{s.type?.charAt(0).toUpperCase() + s.type?.slice(1).toLowerCase()}</span></td>
                                            <td>{s.program}</td>
                                            <td>{s.year_level}</td>
                                            <td>{s.duration_hours}h</td>
                                            <td>
                                                {canEdit ? (
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => openEditSubject(s)}><Edit size={15} style={{ color: 'var(--text-secondary)' }} /></button>
                                                        <button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => handleDelete('subjects', s.id, s.code)}><Trash2 size={15} style={{ color: 'var(--accent-error)' }} /></button>
                                                    </div>
                                                ) : (
                                                    <Lock size={15} style={{ color: 'var(--text-muted)' }} />
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {getSortedSubjects().length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No subjects added yet.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Sections Table */}
                    {tab === 'sections' && (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>
                                            <button onClick={() => handleSort('name')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                                                Name
                                                {sortColumn === 'name' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </button>
                                        </th>
                                        <th>
                                            <button onClick={() => handleSort('type')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                                                Type
                                                {sortColumn === 'type' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </button>
                                        </th>
                                        <th>Parent</th>
                                        <th>
                                            <button onClick={() => handleSort('program')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                                                Program
                                                {sortColumn === 'program' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </button>
                                        </th>
                                        <th>
                                            <button onClick={() => handleSort('year_level')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                                                Year Level
                                                {sortColumn === 'year_level' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </button>
                                        </th>
                                        <th>
                                            <button onClick={() => handleSort('student_count')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                                                Students
                                                {sortColumn === 'student_count' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </button>
                                        </th>
                                        <th>
                                            <button onClick={() => handleSort('weight')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit' }}>
                                                Weight
                                                {sortColumn === 'weight' && (sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                                            </button>
                                        </th>
                                        <th style={{ width: 60 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {getSortedSections().map(s => {
                                        const parent = sections.find(p => p.id === s.parent_id);
                                        return (
                                            <tr key={s.id}>
                                                <td style={{ fontWeight: 600 }}>
                                                    {s.node_type === 'group' && <Folder size={14} style={{ marginRight: 6, color: '#818cf8' }} />}
                                                    {s.name}
                                                </td>
                                                <td><span className="badge" style={{ background: s.node_type === 'group' ? 'rgba(139,92,246,0.15)' : 'rgba(16,185,129,0.15)', color: s.node_type === 'group' ? '#a78bfa' : '#34d399' }}>{s.node_type?.toUpperCase()}</span></td>
                                                <td>{parent ? parent.name : '-'}</td>
                                                <td>{s.program || '-'}</td>
                                                <td>{s.year_level >= 11 ? `Grade ${s.year_level}` : `Year ${s.year_level}`}</td>
                                                <td>{s.student_count || '-'}</td>
                                                <td>{s.weight}</td>
                                                <td>
                                                    {canEdit ? (
                                                        <div style={{ display: 'flex', gap: 4 }}>
                                                            <button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => openEditSection(s)}><Edit size={15} style={{ color: 'var(--text-secondary)' }} /></button>
                                                            <button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => handleDelete('sections', s.id, s.name)}><Trash2 size={15} style={{ color: 'var(--accent-error)' }} /></button>
                                                        </div>
                                                    ) : (
                                                        <Lock size={15} style={{ color: 'var(--text-muted)' }} />
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {getSortedSections().length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No sections added yet.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* Add Room Modal */}
            {showAddRoom && (
                <div className="modal-overlay" onClick={() => setShowAddRoom(false)}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Add Room</h2><button className="btn btn-ghost" onClick={() => setShowAddRoom(false)}><X size={20} /></button></div>
                        <form onSubmit={handleAddRoom} className="modal-form-grid">
                            <div className="field"><label className="field-label">Room Name</label><input className="input" required placeholder="e.g. Lab 201" value={newRoom.name} onChange={e => setNewRoom(p => ({ ...p, name: e.target.value }))} /></div>
                            <div className="field"><label className="field-label">Building</label><input className="input" required placeholder="e.g. Main Building" value={newRoom.building} onChange={e => setNewRoom(p => ({ ...p, building: e.target.value }))} /></div>
                            <div className="field"><label className="field-label">Floor</label><input className="input" type="number" min={1} value={newRoom.floor} onChange={e => setNewRoom(p => ({ ...p, floor: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">Capacity</label><input className="input" type="number" min={1} value={newRoom.capacity} onChange={e => setNewRoom(p => ({ ...p, capacity: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">Room Type</label>
                                <select className="input" value={newRoom.type} onChange={e => setNewRoom(p => ({ ...p, type: e.target.value }))}>
                                    <option value="common">Common (can teach any subject)</option>
                                    <option value="special">Special (selected subjects only)</option>
                                </select>
                            </div>
                            <div className="field"><label className="field-label">Facility Type</label>
                                <select className="input" value={newRoom.room_facility_type} onChange={e => setNewRoom(p => ({ ...p, room_facility_type: e.target.value as RoomFacilityType }))}>
                                    <option value="general_classroom">General Classroom</option>
                                    <option value="computer_lab">Computer Lab</option>
                                    <option value="physics_lab">Physics Lab</option>
                                    <option value="chemistry_lab">Chemistry Lab</option>
                                    <option value="pe_hall">PE Hall</option>
                                    <option value="science_lab">Science Lab</option>
                                    <option value="art_room">Art Room</option>
                                    <option value="music_room">Music Room</option>
                                    <option value="library">Library</option>
                                    <option value="auditorium">Auditorium</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="field"><label className="field-label">Movement Cost (0-100)</label><input className="input" type="number" min={0} max={100} value={newRoom.movement_cost} onChange={e => setNewRoom(p => ({ ...p, movement_cost: parseInt(e.target.value) }))} placeholder="Cost of moving to/from this room" /></div>
                            {newRoom.type === 'special' && (
                                <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field-label">Compatible Subjects (Ctrl+Click to select multiple)</label>
                                    <select className="input" multiple size={3} value={newRoom.compatible_subject_ids} onChange={e => {
                                        const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
                                        setNewRoom(p => ({ ...p, compatible_subject_ids: selected }));
                                    }}>
                                        {subjects.map(s => (
                                            <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field-label">Priority Note</label><textarea className="input" rows={2} value={newRoom.priority_note} onChange={e => setNewRoom(p => ({ ...p, priority_note: e.target.value }))} placeholder="Optional priority reason..." /></div>
                            <button type="submit" className="btn btn-primary" style={{ gridColumn: '1 / -1', marginTop: 8 }} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Add Room'}</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Subject Modal */}
            {showAddSubject && (
                <div className="modal-overlay" onClick={() => setShowAddSubject(false)}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Add Subject</h2><button className="btn btn-ghost" onClick={() => setShowAddSubject(false)}><X size={20} /></button></div>
                        <form onSubmit={handleAddSubject} className="modal-form-grid">
                            <div className="field"><label className="field-label">Code</label><input className="input" required placeholder="e.g. CS101" value={newSubject.code} onChange={e => setNewSubject(p => ({ ...p, code: e.target.value }))} /></div>
                            <div className="field"><label className="field-label">Name</label><input className="input" required placeholder="Introduction to Computing" value={newSubject.name} onChange={e => setNewSubject(p => ({ ...p, name: e.target.value }))} /></div>
                            <div className="field"><label className="field-label">Units</label><input className="input" type="number" min={1} max={6} value={newSubject.units} onChange={e => setNewSubject(p => ({ ...p, units: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">Hours</label><input className="input" type="number" min={1} max={6} value={newSubject.duration_hours} onChange={e => setNewSubject(p => ({ ...p, duration_hours: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">Type</label><select className="input" value={newSubject.type} onChange={e => setNewSubject(p => ({ ...p, type: e.target.value }))}><option value="common">Common (can be taught anywhere)</option><option value="special">Special (needs specific rooms)</option></select></div>
                            <div className="field"><label className="field-label">Program</label><input className="input" required placeholder="e.g. BSIT" value={newSubject.program} onChange={e => setNewSubject(p => ({ ...p, program: e.target.value }))} /></div>
                            <div className="field"><label className="field-label">Year Level</label><input className="input" type="number" min={1} max={12} value={newSubject.year_level} onChange={e => setNewSubject(p => ({ ...p, year_level: parseInt(e.target.value) }))} /></div>
                            {newSubject.type === 'special' && (
                                <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field-label">Compatible Rooms (Ctrl+Click to select multiple)</label>
                                    <select className="input" multiple size={3} value={newSubject.compatible_room_ids} onChange={e => {
                                        const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
                                        setNewSubject(p => ({ ...p, compatible_room_ids: selected }));
                                    }}>
                                        {rooms.filter(r => r.type === 'special').map(r => (
                                            <option key={r.id} value={r.id}>{r.name} ({r.building})</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="field"><label className="field-label">Weight (0-100)</label><input className="input" type="number" min={0} max={100} value={newSubject.weight} onChange={e => setNewSubject(p => ({ ...p, weight: parseInt(e.target.value) }))} /></div>
                            <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field-label">Priority Note</label><textarea className="input" rows={2} value={newSubject.priority_note} onChange={e => setNewSubject(p => ({ ...p, priority_note: e.target.value }))} placeholder="Optional priority reason..." /></div>

                            {/* Generation-specific fields */}
                            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-default)', paddingTop: 16, marginTop: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>SCHEDULING CONFIGURATION</div>
                            </div>

                            <div className="field"><label className="field-label">Required Weekly Hours</label><input className="input" type="number" min={1} max={40} value={newSubject.required_weekly_hours || ''} onChange={e => setNewSubject(p => ({ ...p, required_weekly_hours: e.target.value ? parseInt(e.target.value) : null }))} placeholder="Optional" /></div>
                            <div className="field"><label className="field-label">Optional Monthly Hours</label><input className="input" type="number" min={0} max={20} value={newSubject.optional_monthly_hours || ''} onChange={e => setNewSubject(p => ({ ...p, optional_monthly_hours: e.target.value ? parseInt(e.target.value) : null }))} placeholder="Optional" /></div>
                            <div className="field"><label className="field-label">Session Duration (min)</label><input className="input" type="number" min={15} max={180} step={15} value={newSubject.session_duration_preference} onChange={e => setNewSubject(p => ({ ...p, session_duration_preference: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">Priority Level</label>
                                <select className="input" value={newSubject.priority_level} onChange={e => setNewSubject(p => ({ ...p, priority_level: e.target.value as 'high' | 'normal' | 'low' }))}>
                                    <option value="low">Low</option>
                                    <option value="normal">Normal</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                            <div className="field"><label className="field-label">Preferred Time Window</label>
                                <select className="input" value={newSubject.preferred_time_window || ''} onChange={e => setNewSubject(p => ({ ...p, preferred_time_window: e.target.value as 'early' | 'mid' | 'late' | null || null }))}>
                                    <option value="">No preference</option>
                                    <option value="early">Morning (7am-12pm)</option>
                                    <option value="mid">Afternoon (12pm-5pm)</option>
                                    <option value="late">Evening (5pm-9pm)</option>
                                </select>
                            </div>
                            <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                                <input type="checkbox" checked={newSubject.requires_special_room} onChange={e => setNewSubject(p => ({ ...p, requires_special_room: e.target.checked }))} />
                                <label style={{ color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}>Requires Special Room (lab, studio, etc.)</label>
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ gridColumn: '1 / -1', marginTop: 8 }} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Add Subject'}</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Section Modal */}
            {showAddSection && (
                <div className="modal-overlay" onClick={() => setShowAddSection(false)}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Add Section</h2><button className="btn btn-ghost" onClick={() => setShowAddSection(false)}><X size={20} /></button></div>
                        <form onSubmit={handleAddSection} className="modal-form-grid">
                            <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field-label">Section Name</label><input className="input" required placeholder="e.g. BSIT-1A" value={newSection.name} onChange={e => setNewSection(p => ({ ...p, name: e.target.value }))} /></div>
                            <div className="field"><label className="field-label">Program</label><input className="input" required placeholder="e.g. BSIT" value={newSection.program} onChange={e => setNewSection(p => ({ ...p, program: e.target.value }))} /></div>
                            <div className="field"><label className="field-label">Year Level</label><input className="input" type="number" min={1} max={12} value={newSection.year_level} onChange={e => setNewSection(p => ({ ...p, year_level: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">Student Count</label><input className="input" type="number" min={1} value={newSection.student_count} onChange={e => setNewSection(p => ({ ...p, student_count: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">Node Type</label>
                                <select className="input" value={newSection.node_type} onChange={e => setNewSection(p => ({ ...p, node_type: e.target.value as 'group' | 'section' }))}>
                                    <option value="section">Section (actual student group)</option>
                                    <option value="group">Group (folder for organization)</option>
                                </select>
                            </div>
                            <div className="field"><label className="field-label">Parent Section</label>
                                <select className="input" value={newSection.parent_id || ''} onChange={e => setNewSection(p => ({ ...p, parent_id: e.target.value || null }))}>
                                    <option value="">None (root level)</option>
                                    {sections.filter(s => s.node_type === 'group' || s.node_type === 'section').map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.node_type})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="field"><label className="field-label">Load Category</label>
                                <select className="input" value={newSection.load_category} onChange={e => setNewSection(p => ({ ...p, load_category: e.target.value as 'heavy' | 'normal' | 'light' }))}>
                                    <option value="heavy">Heavy (many difficult subjects)</option>
                                    <option value="normal">Normal (balanced)</option>
                                    <option value="light">Light (fewer/easier subjects)</option>
                                </select>
                            </div>
                            <div className="field"><label className="field-label">Weight (0-100)</label><input className="input" type="number" min={0} max={100} value={newSection.weight} onChange={e => setNewSection(p => ({ ...p, weight: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">Sort Order</label><input className="input" type="number" min={0} value={newSection.sort_order} onChange={e => setNewSection(p => ({ ...p, sort_order: parseInt(e.target.value) }))} /></div>
                            <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field-label">Description</label><textarea className="input" rows={2} value={newSection.description} onChange={e => setNewSection(p => ({ ...p, description: e.target.value }))} placeholder="Optional description..." /></div>

                            {/* Generation-specific fields */}
                            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-default)', paddingTop: 16, marginTop: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>SCHEDULING CONFIGURATION</div>
                            </div>

                            <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field-label">Hierarchy Path</label><input className="input" value={newSection.hierarchy_path} onChange={e => setNewSection(p => ({ ...p, hierarchy_path: e.target.value }))} placeholder="e.g. /BSIT/Year1/SectionA" /></div>
                            <div className="field"><label className="field-label">Hierarchy Weight (0-100)</label><input className="input" type="number" min={0} max={100} value={newSection.hierarchy_weight} onChange={e => setNewSection(p => ({ ...p, hierarchy_weight: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">Priority Weight (0-100)</label><input className="input" type="number" min={0} max={100} value={newSection.priority_weight} onChange={e => setNewSection(p => ({ ...p, priority_weight: parseInt(e.target.value) }))} /></div>

                            <button type="submit" className="btn btn-primary" style={{ gridColumn: '1 / -1', marginTop: 8 }} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Add Section'}</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Room Modal */}
            {showEditRoom && (
                <div className="modal-overlay" onClick={() => setShowEditRoom(false)}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Edit Room</h2><button className="btn btn-ghost" onClick={() => setShowEditRoom(false)}><X size={20} /></button></div>
                        <form onSubmit={handleEditRoom} className="modal-form-grid">
                            <div className="field"><label className="field-label">Room Name</label><input className="input" required placeholder="e.g. Lab 201" value={editRoom.name} onChange={e => setEditRoom(p => ({ ...p, name: e.target.value }))} /></div>
                            <div className="field"><label className="field-label">Building</label><input className="input" required placeholder="e.g. Main Building" value={editRoom.building} onChange={e => setEditRoom(p => ({ ...p, building: e.target.value }))} /></div>
                            <div className="field"><label className="field-label">Floor</label><input className="input" type="number" min={1} value={editRoom.floor} onChange={e => setEditRoom(p => ({ ...p, floor: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">Capacity</label><input className="input" type="number" min={1} value={editRoom.capacity} onChange={e => setEditRoom(p => ({ ...p, capacity: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">Room Type</label>
                                <select className="input" value={editRoom.type} onChange={e => setEditRoom(p => ({ ...p, type: e.target.value }))}>
                                    <option value="common">Common (can teach any subject)</option>
                                    <option value="special">Special (selected subjects only)</option>
                                </select>
                            </div>
                            <div className="field"><label className="field-label">Facility Type</label>
                                <select className="input" value={editRoom.room_facility_type} onChange={e => setEditRoom(p => ({ ...p, room_facility_type: e.target.value as RoomFacilityType }))}>
                                    <option value="general_classroom">General Classroom</option>
                                    <option value="computer_lab">Computer Lab</option>
                                    <option value="physics_lab">Physics Lab</option>
                                    <option value="chemistry_lab">Chemistry Lab</option>
                                    <option value="pe_hall">PE Hall</option>
                                    <option value="science_lab">Science Lab</option>
                                    <option value="art_room">Art Room</option>
                                    <option value="music_room">Music Room</option>
                                    <option value="library">Library</option>
                                    <option value="auditorium">Auditorium</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="field"><label className="field-label">Movement Cost (0-100)</label><input className="input" type="number" min={0} max={100} value={editRoom.movement_cost} onChange={e => setEditRoom(p => ({ ...p, movement_cost: parseInt(e.target.value) }))} placeholder="Cost of moving to/from this room" /></div>
                            {editRoom.type === 'special' && (
                                <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field-label">Compatible Subjects (Ctrl+Click to select multiple)</label>
                                    <select className="input" multiple size={3} value={editRoom.compatible_subject_ids} onChange={e => {
                                        const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
                                        setEditRoom(p => ({ ...p, compatible_subject_ids: selected }));
                                    }}>
                                        {subjects.map(s => (
                                            <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field-label">Priority Note</label><textarea className="input" rows={2} value={editRoom.priority_note} onChange={e => setEditRoom(p => ({ ...p, priority_note: e.target.value }))} placeholder="Optional priority reason..." /></div>
                            <button type="submit" className="btn btn-primary" style={{ gridColumn: '1 / -1', marginTop: 8 }} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Save Changes'}</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Subject Modal */}
            {showEditSubject && (
                <div className="modal-overlay" onClick={() => setShowEditSubject(false)}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Edit Subject</h2><button className="btn btn-ghost" onClick={() => setShowEditSubject(false)}><X size={20} /></button></div>
                        <form onSubmit={handleEditSubject} className="modal-form-grid">
                            <div className="field"><label className="field-label">Code</label><input className="input" required placeholder="e.g. CS101" value={editSubject.code} onChange={e => setEditSubject(p => ({ ...p, code: e.target.value }))} /></div>
                            <div className="field"><label className="field-label">Name</label><input className="input" required placeholder="Introduction to Computing" value={editSubject.name} onChange={e => setEditSubject(p => ({ ...p, name: e.target.value }))} /></div>
                            <div className="field"><label className="field-label">Units</label><input className="input" type="number" min={1} max={6} value={editSubject.units} onChange={e => setEditSubject(p => ({ ...p, units: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">Hours</label><input className="input" type="number" min={1} max={6} value={editSubject.duration_hours} onChange={e => setEditSubject(p => ({ ...p, duration_hours: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">Type</label><select className="input" value={editSubject.type} onChange={e => setEditSubject(p => ({ ...p, type: e.target.value }))}><option value="common">Common (can be taught anywhere)</option><option value="special">Special (needs specific rooms)</option></select></div>
                            <div className="field"><label className="field-label">Program</label><input className="input" required placeholder="e.g. BSIT" value={editSubject.program} onChange={e => setEditSubject(p => ({ ...p, program: e.target.value }))} /></div>
                            <div className="field"><label className="field-label">Year Level</label><input className="input" type="number" min={1} max={12} value={editSubject.year_level} onChange={e => setEditSubject(p => ({ ...p, year_level: parseInt(e.target.value) }))} /></div>
                            {editSubject.type === 'special' && (
                                <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field-label">Compatible Rooms (Ctrl+Click to select multiple)</label>
                                    <select className="input" multiple size={3} value={editSubject.compatible_room_ids} onChange={e => {
                                        const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
                                        setEditSubject(p => ({ ...p, compatible_room_ids: selected }));
                                    }}>
                                        {rooms.filter(r => r.type === 'special').map(r => (
                                            <option key={r.id} value={r.id}>{r.name} ({r.building})</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="field"><label className="field-label">Weight (0-100)</label><input className="input" type="number" min={0} max={100} value={editSubject.weight} onChange={e => setEditSubject(p => ({ ...p, weight: parseInt(e.target.value) }))} /></div>
                            <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field-label">Priority Note</label><textarea className="input" rows={2} value={editSubject.priority_note} onChange={e => setEditSubject(p => ({ ...p, priority_note: e.target.value }))} placeholder="Optional priority reason..." /></div>

                            {/* Generation-specific fields */}
                            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-default)', paddingTop: 16, marginTop: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>SCHEDULING CONFIGURATION</div>
                            </div>

                            <div className="field"><label className="field-label">Required Weekly Hours</label><input className="input" type="number" min={1} max={40} value={editSubject.required_weekly_hours || ''} onChange={e => setEditSubject(p => ({ ...p, required_weekly_hours: e.target.value ? parseInt(e.target.value) : null }))} placeholder="Optional" /></div>
                            <div className="field"><label className="field-label">Optional Monthly Hours</label><input className="input" type="number" min={0} max={20} value={editSubject.optional_monthly_hours || ''} onChange={e => setEditSubject(p => ({ ...p, optional_monthly_hours: e.target.value ? parseInt(e.target.value) : null }))} placeholder="Optional" /></div>
                            <div className="field"><label className="field-label">Session Duration (min)</label><input className="input" type="number" min={15} max={180} step={15} value={editSubject.session_duration_preference} onChange={e => setEditSubject(p => ({ ...p, session_duration_preference: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">Priority Level</label>
                                <select className="input" value={editSubject.priority_level} onChange={e => setEditSubject(p => ({ ...p, priority_level: e.target.value as 'high' | 'normal' | 'low' }))}>
                                    <option value="low">Low</option>
                                    <option value="normal">Normal</option>
                                    <option value="high">High</option>
                                </select>
                            </div>
                            <div className="field"><label className="field-label">Preferred Time Window</label>
                                <select className="input" value={editSubject.preferred_time_window || ''} onChange={e => setEditSubject(p => ({ ...p, preferred_time_window: e.target.value as 'early' | 'mid' | 'late' | null || null }))}>
                                    <option value="">No preference</option>
                                    <option value="early">Morning (7am-12pm)</option>
                                    <option value="mid">Afternoon (12pm-5pm)</option>
                                    <option value="late">Evening (5pm-9pm)</option>
                                </select>
                            </div>
                            <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                                <input type="checkbox" checked={editSubject.requires_special_room} onChange={e => setEditSubject(p => ({ ...p, requires_special_room: e.target.checked }))} />
                                <label style={{ color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}>Requires Special Room (lab, studio, etc.)</label>
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ gridColumn: '1 / -1', marginTop: 8 }} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Save Changes'}</button>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Section Modal */}
            {showEditSection && (
                <div className="modal-overlay" onClick={() => setShowEditSection(false)}>
                    <div className="modal-content slide-up" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Edit Section</h2><button className="btn btn-ghost" onClick={() => setShowEditSection(false)}><X size={20} /></button></div>
                        <form onSubmit={handleEditSection} className="modal-form-grid">
                            <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field-label">Section Name</label><input className="input" required placeholder="e.g. BSIT-1A" value={editSection.name} onChange={e => setEditSection(p => ({ ...p, name: e.target.value }))} /></div>
                            <div className="field"><label className="field-label">Program</label><input className="input" required placeholder="e.g. BSIT" value={editSection.program} onChange={e => setEditSection(p => ({ ...p, program: e.target.value }))} /></div>
                            <div className="field"><label className="field-label">Year Level</label><input className="input" type="number" min={1} max={12} value={editSection.year_level} onChange={e => setEditSection(p => ({ ...p, year_level: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">Student Count</label><input className="input" type="number" min={1} value={editSection.student_count} onChange={e => setEditSection(p => ({ ...p, student_count: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">Node Type</label>
                                <select className="input" value={editSection.node_type} onChange={e => setEditSection(p => ({ ...p, node_type: e.target.value as 'group' | 'section' }))}>
                                    <option value="section">Section (actual student group)</option>
                                    <option value="group">Group (folder for organization)</option>
                                </select>
                            </div>
                            <div className="field"><label className="field-label">Parent Section</label>
                                <select className="input" value={editSection.parent_id || ''} onChange={e => setEditSection(p => ({ ...p, parent_id: e.target.value || null }))}>
                                    <option value="">None (root level)</option>
                                    {sections.filter(s => s.id !== editingId && (s.node_type === 'group' || s.node_type === 'section')).map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.node_type})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="field"><label className="field-label">Load Category</label>
                                <select className="input" value={editSection.load_category} onChange={e => setEditSection(p => ({ ...p, load_category: e.target.value as 'heavy' | 'normal' | 'light' }))}>
                                    <option value="heavy">Heavy (many difficult subjects)</option>
                                    <option value="normal">Normal (balanced)</option>
                                    <option value="light">Light (fewer/easier subjects)</option>
                                </select>
                            </div>
                            <div className="field"><label className="field-label">Weight (0-100)</label><input className="input" type="number" min={0} max={100} value={editSection.weight} onChange={e => setEditSection(p => ({ ...p, weight: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">Sort Order</label><input className="input" type="number" min={0} value={editSection.sort_order} onChange={e => setEditSection(p => ({ ...p, sort_order: parseInt(e.target.value) }))} /></div>
                            <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field-label">Description</label><textarea className="input" rows={2} value={editSection.description} onChange={e => setEditSection(p => ({ ...p, description: e.target.value }))} placeholder="Optional description..." /></div>

                            {/* Generation-specific fields */}
                            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border-default)', paddingTop: 16, marginTop: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>SCHEDULING CONFIGURATION</div>
                            </div>

                            <div className="field" style={{ gridColumn: '1 / -1' }}><label className="field-label">Hierarchy Path</label><input className="input" value={editSection.hierarchy_path} onChange={e => setEditSection(p => ({ ...p, hierarchy_path: e.target.value }))} placeholder="e.g. /BSIT/Year1/SectionA" /></div>
                            <div className="field"><label className="field-label">Hierarchy Weight (0-100)</label><input className="input" type="number" min={0} max={100} value={editSection.hierarchy_weight} onChange={e => setEditSection(p => ({ ...p, hierarchy_weight: parseInt(e.target.value) }))} /></div>
                            <div className="field"><label className="field-label">Priority Weight (0-100)</label><input className="input" type="number" min={0} max={100} value={editSection.priority_weight} onChange={e => setEditSection(p => ({ ...p, priority_weight: parseInt(e.target.value) }))} /></div>

                            <button type="submit" className="btn btn-primary" style={{ gridColumn: '1 / -1', marginTop: 8 }} disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : 'Save Changes'}</button>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 24px; }
                .modal-content { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-xl); padding: 28px; width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; }
                .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                .modal-header h2 { font-size: 20px; font-weight: 700; color: var(--text-primary); }
                .modal-form { display: flex; flex-direction: column; gap: 16px; }
                .modal-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                .field { display: flex; flex-direction: column; gap: 6px; }
                .field-label { font-size: 10px; font-weight: 600; color: var(--text-muted); letter-spacing: 1.5px; padding-left: 2px; }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};

export default DataManagement;
