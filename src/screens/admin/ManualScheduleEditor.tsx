import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView,  StyleSheet,
    Alert, Modal, TextInput, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { supabase } from '../../config/supabase';
import { AnimatedPressable } from '../../components/AnimatedPressable';

interface ScheduleEntry {
    id: string;
    subject_id: string;
    teacher_id: string;
    room_id: string;
    section_id: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    status: string;
    // Joined data
    subject_name?: string;
    teacher_name?: string;
    room_name?: string;
    section_name?: string;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ManualScheduleEditor: React.FC = () => {
    const [schedules, setSchedules] = useState<ScheduleEntry[]>([]);
    const [teachers, setTeachers] = useState<any[]>([]);
    const [rooms, setRooms] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTeacher, setSelectedTeacher] = useState<string | null>(null);

    // Edit modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<ScheduleEntry | null>(null);
    const [editDay, setEditDay] = useState('Monday');
    const [editStart, setEditStart] = useState('');
    const [editEnd, setEditEnd] = useState('');
    const [editRoom, setEditRoom] = useState('');
    const [editSubject, setEditSubject] = useState('');
    const [editSection, setEditSection] = useState('');
    const [saving, setSaving] = useState(false);

    // Add modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [addDay, setAddDay] = useState('Monday');
    const [addStart, setAddStart] = useState('07:00');
    const [addEnd, setAddEnd] = useState('08:00');
    const [addRoom, setAddRoom] = useState('');
    const [addSubject, setAddSubject] = useState('');
    const [addSection, setAddSection] = useState('');
    const [adding, setAdding] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [schedRes, teacherRes, roomRes, subjectRes, sectionRes] = await Promise.all([
            supabase.from('schedules').select('*'),
            supabase.from('teachers').select('*, profile:profiles(*)'),
            supabase.from('rooms').select('*'),
            supabase.from('subjects').select('*'),
            supabase.from('sections').select('*'),
        ]);

        const t = teacherRes.data || [];
        const r = roomRes.data || [];
        const s = subjectRes.data || [];
        const sec = sectionRes.data || [];

        setTeachers(t);
        setRooms(r);
        setSubjects(s);
        setSections(sec);

        // Enrich schedules with joined names
        const enriched = (schedRes.data || []).map((sch: any) => ({
            ...sch,
            teacher_name: t.find((x: any) => x.id === sch.teacher_id)?.profile?.full_name || 'Unknown',
            room_name: r.find((x: any) => x.id === sch.room_id)?.name || sch.room_id,
            subject_name: s.find((x: any) => x.id === sch.subject_id)?.name || sch.subject_id,
            section_name: sec.find((x: any) => x.id === sch.section_id)?.name || sch.section_id,
        }));
        setSchedules(enriched);
        if (t.length > 0 && !selectedTeacher) setSelectedTeacher(t[0].id);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
        const ch = supabase
            .channel('manual-schedule-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => fetchData())
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [fetchData]);

    const filtered = schedules.filter(s => s.teacher_id === selectedTeacher);
    const groupedByDay: Record<string, ScheduleEntry[]> = {};
    DAYS.forEach(d => { groupedByDay[d] = filtered.filter(s => s.day_of_week === d).sort((a, b) => a.start_time.localeCompare(b.start_time)); });

    const openEdit = (sch: ScheduleEntry) => {
        setEditingSchedule(sch);
        setEditDay(sch.day_of_week);
        setEditStart(sch.start_time);
        setEditEnd(sch.end_time);
        setEditRoom(sch.room_id);
        setEditSubject(sch.subject_id);
        setEditSection(sch.section_id);
        setShowEditModal(true);
    };

    const handleSave = async () => {
        if (!editingSchedule) return;
        setSaving(true);
        const { error } = await supabase.from('schedules').update({
            day_of_week: editDay,
            start_time: editStart,
            end_time: editEnd,
            room_id: editRoom,
            subject_id: editSubject,
            section_id: editSection,
        }).eq('id', editingSchedule.id);
        setSaving(false);
        if (error) { Alert.alert('Error', error.message); return; }
        setShowEditModal(false);
        fetchData();
    };

    const handleDelete = (sch: ScheduleEntry) => {
        Alert.alert('Delete Schedule', `Remove ${sch.subject_name} on ${sch.day_of_week}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    await supabase.from('schedules').delete().eq('id', sch.id);
                    fetchData();
                }
            },
        ]);
    };

    const handleAdd = async () => {
        if (!selectedTeacher || !addSubject || !addRoom || !addSection) {
            Alert.alert('Error', 'Please fill all fields.'); return;
        }
        setAdding(true);
        const { error } = await supabase.from('schedules').insert({
            teacher_id: selectedTeacher,
            subject_id: addSubject,
            room_id: addRoom,
            section_id: addSection,
            day_of_week: addDay,
            start_time: addStart,
            end_time: addEnd,
            status: 'published',
        });
        setAdding(false);
        if (error) { Alert.alert('Error', error.message); return; }
        setShowAddModal(false);
        fetchData();
    };

    const formatTime = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        const suffix = h >= 12 ? 'PM' : 'AM';
        return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${m.toString().padStart(2, '0')} ${suffix}`;
    };

    if (loading) return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
            <ActivityIndicator size="large" color={Colors.primary} />
        </View>
    );

    return (
        <ScrollView style={{ flex: 1, backgroundColor: '#0f172a' }} contentContainerStyle={{ padding: 16 }}>
            {/* Teacher Picker */}
            <Text style={s.label}>SELECT TEACHER</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {teachers.map(t => (
                    <AnimatedPressable key={t.id}
                        style={[s.teacherChip, selectedTeacher === t.id && s.teacherChipActive]}
                        onPress={() => setSelectedTeacher(t.id)}
                    >
                        <MaterialIcons name="person" size={14} color={selectedTeacher === t.id ? Colors.white : '#94a3b8'} />
                        <Text style={[s.teacherChipText, selectedTeacher === t.id && { color: Colors.white }]} numberOfLines={1}>
                            {t.profile?.full_name || t.id}
                        </Text>
                    </AnimatedPressable>
                ))}
            </ScrollView>

            {/* Add Schedule Button */}
            <AnimatedPressable style={s.addBtn} onPress={() => {
                setAddDay('Monday'); setAddStart('07:00'); setAddEnd('08:00');
                setAddRoom(rooms[0]?.id || ''); setAddSubject(subjects[0]?.id || ''); setAddSection(sections[0]?.id || '');
                setShowAddModal(true);
            }}>
                <MaterialIcons name="add" size={18} color={Colors.white} />
                <Text style={{ color: Colors.white, fontSize: 13, fontWeight: '600' }}>Add Schedule Entry</Text>
            </AnimatedPressable>

            {teachers.length === 0 && (
                <View style={s.emptyState}>
                    <MaterialIcons name="person-off" size={40} color={Colors.slate600} />
                    <Text style={{ color: Colors.slate400, marginTop: 8, textAlign: 'center' }}>No teachers found. Create teacher accounts first.</Text>
                </View>
            )}

            {selectedTeacher && filtered.length === 0 && teachers.length > 0 && (
                <View style={s.emptyState}>
                    <MaterialIcons name="event-busy" size={40} color={Colors.slate600} />
                    <Text style={{ color: Colors.slate400, marginTop: 8, textAlign: 'center' }}>No schedule entries for this teacher yet.</Text>
                </View>
            )}

            {/* Day-grouped schedule cards */}
            {DAYS.map(day => {
                const daySchedules = groupedByDay[day];
                if (!daySchedules || daySchedules.length === 0) return null;
                return (
                    <View key={day} style={{ marginBottom: 16 }}>
                        <Text style={s.dayHeader}>{day}</Text>
                        {daySchedules.map(sch => (
                            <View key={sch.id} style={s.schedCard}>
                                <View style={s.schedTime}>
                                    <Text style={s.timeText}>{formatTime(sch.start_time)}</Text>
                                    <Text style={{ color: '#475569', fontSize: 10 }}>to</Text>
                                    <Text style={s.timeText}>{formatTime(sch.end_time)}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.schedSubject} numberOfLines={1}>{sch.subject_name}</Text>
                                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                            <MaterialIcons name="meeting-room" size={12} color="#94a3b8" />
                                            <Text style={s.schedMeta} numberOfLines={1}>{sch.room_name}</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                            <MaterialIcons name="groups" size={12} color="#94a3b8" />
                                            <Text style={s.schedMeta} numberOfLines={1}>{sch.section_name}</Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                    <AnimatedPressable style={s.iconBtn} onPress={() => openEdit(sch)}>
                                        <MaterialIcons name="edit" size={16} color="#60a5fa" />
                                    </AnimatedPressable>
                                    <AnimatedPressable style={s.iconBtn} onPress={() => handleDelete(sch)}>
                                        <MaterialIcons name="delete" size={16} color="#ef4444" />
                                    </AnimatedPressable>
                                </View>
                            </View>
                        ))}
                    </View>
                );
            })}

            {/* Edit Modal */}
            <Modal visible={showEditModal} animationType="slide" transparent>
                <View style={s.modalOverlay}>
                    <View style={s.modalContent}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Edit Schedule</Text>
                            <AnimatedPressable onPress={() => setShowEditModal(false)}>
                                <MaterialIcons name="close" size={22} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>
                        <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
                            <Text style={s.fieldLabel}>DAY</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                                {DAYS.map(d => (
                                    <AnimatedPressable key={d} onPress={() => setEditDay(d)}
                                        style={[s.dayChip, editDay === d && s.dayChipActive]}>
                                        <Text style={[s.dayChipText, editDay === d && { color: Colors.white }]}>{d.slice(0, 3)}</Text>
                                    </AnimatedPressable>
                                ))}
                            </ScrollView>

                            <Text style={s.fieldLabel}>START TIME</Text>
                            <TextInput style={s.input} value={editStart} onChangeText={setEditStart} placeholder="07:00" placeholderTextColor="#6b7280" />
                            <Text style={s.fieldLabel}>END TIME</Text>
                            <TextInput style={s.input} value={editEnd} onChangeText={setEditEnd} placeholder="08:00" placeholderTextColor="#6b7280" />

                            <Text style={s.fieldLabel}>ROOM</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                                {rooms.map((r: any) => (
                                    <AnimatedPressable key={r.id} onPress={() => setEditRoom(r.id)}
                                        style={[s.dayChip, editRoom === r.id && s.dayChipActive]}>
                                        <Text style={[s.dayChipText, editRoom === r.id && { color: Colors.white }]}>{r.name}</Text>
                                    </AnimatedPressable>
                                ))}
                            </ScrollView>

                            <Text style={s.fieldLabel}>SUBJECT</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                                {subjects.map((sub: any) => (
                                    <AnimatedPressable key={sub.id} onPress={() => setEditSubject(sub.id)}
                                        style={[s.dayChip, editSubject === sub.id && s.dayChipActive]}>
                                        <Text style={[s.dayChipText, editSubject === sub.id && { color: Colors.white }]} numberOfLines={1}>{sub.name}</Text>
                                    </AnimatedPressable>
                                ))}
                            </ScrollView>

                            <Text style={s.fieldLabel}>SECTION</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                                {sections.map((sec: any) => (
                                    <AnimatedPressable key={sec.id} onPress={() => setEditSection(sec.id)}
                                        style={[s.dayChip, editSection === sec.id && s.dayChipActive]}>
                                        <Text style={[s.dayChipText, editSection === sec.id && { color: Colors.white }]}>{sec.name}</Text>
                                    </AnimatedPressable>
                                ))}
                            </ScrollView>
                        </ScrollView>

                        <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
                            <AnimatedPressable style={s.saveBtn} onPress={handleSave} disabled={saving}>
                                {saving ? <ActivityIndicator color={Colors.white} /> : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <MaterialIcons name="save" size={18} color={Colors.white} />
                                        <Text style={{ color: Colors.white, fontSize: 14, fontWeight: '600' }}>Save Changes</Text>
                                    </View>
                                )}
                            </AnimatedPressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Add Modal */}
            <Modal visible={showAddModal} animationType="slide" transparent>
                <View style={s.modalOverlay}>
                    <View style={s.modalContent}>
                        <View style={s.modalHeader}>
                            <Text style={s.modalTitle}>Add Schedule Entry</Text>
                            <AnimatedPressable onPress={() => setShowAddModal(false)}>
                                <MaterialIcons name="close" size={22} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>
                        <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
                            <Text style={s.fieldLabel}>DAY</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                                {DAYS.map(d => (
                                    <AnimatedPressable key={d} onPress={() => setAddDay(d)}
                                        style={[s.dayChip, addDay === d && s.dayChipActive]}>
                                        <Text style={[s.dayChipText, addDay === d && { color: Colors.white }]}>{d.slice(0, 3)}</Text>
                                    </AnimatedPressable>
                                ))}
                            </ScrollView>

                            <Text style={s.fieldLabel}>START TIME</Text>
                            <TextInput style={s.input} value={addStart} onChangeText={setAddStart} placeholder="07:00" placeholderTextColor="#6b7280" />
                            <Text style={s.fieldLabel}>END TIME</Text>
                            <TextInput style={s.input} value={addEnd} onChangeText={setAddEnd} placeholder="08:00" placeholderTextColor="#6b7280" />

                            <Text style={s.fieldLabel}>ROOM</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                                {rooms.map((r: any) => (
                                    <AnimatedPressable key={r.id} onPress={() => setAddRoom(r.id)}
                                        style={[s.dayChip, addRoom === r.id && s.dayChipActive]}>
                                        <Text style={[s.dayChipText, addRoom === r.id && { color: Colors.white }]}>{r.name}</Text>
                                    </AnimatedPressable>
                                ))}
                            </ScrollView>

                            <Text style={s.fieldLabel}>SUBJECT</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                                {subjects.map((sub: any) => (
                                    <AnimatedPressable key={sub.id} onPress={() => setAddSubject(sub.id)}
                                        style={[s.dayChip, addSubject === sub.id && s.dayChipActive]}>
                                        <Text style={[s.dayChipText, addSubject === sub.id && { color: Colors.white }]} numberOfLines={1}>{sub.name}</Text>
                                    </AnimatedPressable>
                                ))}
                            </ScrollView>

                            <Text style={s.fieldLabel}>SECTION</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                                {sections.map((sec: any) => (
                                    <AnimatedPressable key={sec.id} onPress={() => setAddSection(sec.id)}
                                        style={[s.dayChip, addSection === sec.id && s.dayChipActive]}>
                                        <Text style={[s.dayChipText, addSection === sec.id && { color: Colors.white }]}>{sec.name}</Text>
                                    </AnimatedPressable>
                                ))}
                            </ScrollView>
                        </ScrollView>

                        <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
                            <AnimatedPressable style={[s.saveBtn, { backgroundColor: '#10b981' }]} onPress={handleAdd} disabled={adding}>
                                {adding ? <ActivityIndicator color={Colors.white} /> : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <MaterialIcons name="add" size={18} color={Colors.white} />
                                        <Text style={{ color: Colors.white, fontSize: 14, fontWeight: '600' }}>Add Entry</Text>
                                    </View>
                                )}
                            </AnimatedPressable>
                        </View>
                    </View>
                </View>
            </Modal>

            <View style={{ height: 60 }} />
        </ScrollView>
    );
};

const s = StyleSheet.create({
    label: { fontSize: 10, fontWeight: '700', color: Colors.slate400, letterSpacing: 1.5, marginBottom: 8 },
    teacherChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', marginRight: 8,
    },
    teacherChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    teacherChipText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
    addBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center',
        backgroundColor: 'rgba(99,102,241,0.15)', borderRadius: 12, paddingVertical: 12,
        borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)', marginBottom: 20,
    },
    emptyState: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#1e293b', borderRadius: 16, marginBottom: 16 },
    dayHeader: { fontSize: 14, fontWeight: '700', color: '#818cf8', marginBottom: 8, letterSpacing: 0.5 },
    schedCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 8,
        borderWidth: 1, borderColor: '#334155',
    },
    schedTime: {
        alignItems: 'center', backgroundColor: 'rgba(99,102,241,0.1)',
        borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, minWidth: 68,
    },
    timeText: { fontSize: 11, fontWeight: '700', color: '#818cf8' },
    schedSubject: { fontSize: 14, fontWeight: '600', color: Colors.white },
    schedMeta: { fontSize: 11, color: '#94a3b8' },
    iconBtn: {
        width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center', alignItems: 'center',
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#334155',
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },
    fieldLabel: { fontSize: 10, fontWeight: '700', color: Colors.slate400, letterSpacing: 1.5, marginTop: 12, marginBottom: 6 },
    input: {
        backgroundColor: '#0f172a', borderRadius: 10, padding: 12, color: Colors.white,
        fontSize: 14, borderWidth: 1, borderColor: '#334155', marginBottom: 12,
    },
    dayChip: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', marginRight: 8,
    },
    dayChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    dayChipText: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
    saveBtn: {
        backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    },
});

export default ManualScheduleEditor;
