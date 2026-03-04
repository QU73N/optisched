import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    Alert, Modal, TextInput, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useSubjects, useRooms, useSections, useTeachers } from '../../hooks/useSupabase';
import { AnimatedPressable } from '../../components/AnimatedPressable';

type TabName = 'subjects' | 'rooms' | 'sections';

const AdminDataManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabName>('subjects');
    const { subjects, loading: subLoading, createSubject, updateSubject, deleteSubject } = useSubjects();
    const { rooms, loading: roomLoading, createRoom, updateRoom, deleteRoom } = useRooms();
    const { sections, loading: secLoading, createSection, updateSection, deleteSection } = useSections();
    const { teachers } = useTeachers();

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<any>(null);
    const [saving, setSaving] = useState(false);

    // Subject fields
    const [subCode, setSubCode] = useState('');
    const [subName, setSubName] = useState('');
    const [subUnits, setSubUnits] = useState('3');
    const [subType, setSubType] = useState<'lecture' | 'laboratory'>('lecture');
    const [subDuration, setSubDuration] = useState('3');
    const [subProgram, setSubProgram] = useState('');
    const [subYear, setSubYear] = useState('1');
    const [subLab, setSubLab] = useState(false);
    const [subTeacherId, setSubTeacherId] = useState('');

    // Room fields
    const [roomName, setRoomName] = useState('');
    const [roomCapacity, setRoomCapacity] = useState('40');
    const [roomType, setRoomType] = useState<'lecture' | 'laboratory' | 'computer_lab' | 'gymnasium'>('lecture');
    const [roomBuilding, setRoomBuilding] = useState('');
    const [roomFloor, setRoomFloor] = useState('1');

    // Section fields
    const [secName, setSecName] = useState('');
    const [secProgram, setSecProgram] = useState('');
    const [secYear, setSecYear] = useState('1');
    const [secCount, setSecCount] = useState('30');

    const tabs: { key: TabName; label: string; icon: string; count: number }[] = [
        { key: 'subjects', label: '📚 Subjects', icon: 'menu-book', count: subjects.length },
        { key: 'rooms', label: '🏫 Rooms', icon: 'meeting-room', count: rooms.length },
        { key: 'sections', label: '👥 Sections', icon: 'groups', count: sections.length },
    ];

    const resetFields = () => {
        setSubCode(''); setSubName(''); setSubUnits('3'); setSubType('lecture'); setSubDuration('3'); setSubProgram(''); setSubYear('1'); setSubLab(false); setSubTeacherId('');
        setRoomName(''); setRoomCapacity('40'); setRoomType('lecture'); setRoomBuilding(''); setRoomFloor('1');
        setSecName(''); setSecProgram(''); setSecYear('1'); setSecCount('30');
    };

    const openAdd = () => { setEditing(null); resetFields(); setShowModal(true); };

    const openEdit = (item: any) => {
        setEditing(item);
        if (activeTab === 'subjects') {
            setSubCode(item.code || ''); setSubName(item.name || ''); setSubUnits(String(item.units || 3));
            setSubType(item.type || 'lecture'); setSubDuration(String(item.duration_hours || 3));
            setSubProgram(item.program || ''); setSubYear(String(item.year_level || 1)); setSubLab(item.requires_lab || false);
            setSubTeacherId(item.teacher_id || '');
        } else if (activeTab === 'rooms') {
            setRoomName(item.name || ''); setRoomCapacity(String(item.capacity || 40));
            setRoomType(item.type || 'lecture'); setRoomBuilding(item.building || ''); setRoomFloor(String(item.floor || 1));
        } else {
            setSecName(item.name || ''); setSecProgram(item.program || '');
            setSecYear(String(item.year_level || 1)); setSecCount(String(item.student_count || 30));
        }
        setShowModal(true);
    };

    const handleDelete = (id: string, name: string) => {
        Alert.alert('Delete', `Delete "${name}"? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        if (activeTab === 'subjects') await deleteSubject(id);
                        else if (activeTab === 'rooms') await deleteRoom(id);
                        else await deleteSection(id);
                        Alert.alert('Deleted', `"${name}" removed.`);
                    } catch (err: any) {
                        Alert.alert('Error', err?.message || 'Failed to delete. It may be referenced by other records.');
                    }
                }
            },
        ]);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (activeTab === 'subjects') {
                if (!subCode.trim() || !subName.trim()) throw new Error('Code and name are required.');
                const data = {
                    code: subCode.trim(), name: subName.trim(), units: parseInt(subUnits) || 3,
                    type: (subLab ? 'laboratory' : 'lecture') as 'lecture' | 'laboratory', duration_hours: parseInt(subDuration) || 3,
                    program: subProgram.trim(), year_level: parseInt(subYear) || 1, requires_lab: subLab,
                    teacher_id: subTeacherId || null
                };
                if (editing) await updateSubject(editing.id, data);
                else await createSubject(data as any);
            } else if (activeTab === 'rooms') {
                if (!roomName.trim()) throw new Error('Room name is required.');
                const data = {
                    name: roomName.trim(), capacity: parseInt(roomCapacity) || 40,
                    type: roomType, building: roomBuilding.trim(), floor: parseInt(roomFloor) || 1,
                    equipment: [], is_available: true
                };
                if (editing) await updateRoom(editing.id, data);
                else await createRoom(data as any);
            } else {
                if (!secName.trim()) throw new Error('Section name is required.');
                const data = {
                    name: secName.trim(), program: secProgram.trim(),
                    year_level: parseInt(secYear) || 1, student_count: parseInt(secCount) || 30
                };
                if (editing) await updateSection(editing.id, data);
                else await createSection(data as any);
            }
            Alert.alert('Success', editing ? 'Updated successfully.' : 'Created successfully.');
            setShowModal(false);
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    const isLoading = activeTab === 'subjects' ? subLoading : activeTab === 'rooms' ? roomLoading : secLoading;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Data Management</Text>
                <AnimatedPressable onPress={openAdd}>
                    <MaterialIcons name="add-circle" size={28} color={Colors.primary} />
                </AnimatedPressable>
            </View>

            {/* Tabs */}
            <View style={styles.tabRow}>
                {tabs.map(t => (
                    <AnimatedPressable key={t.key} style={[styles.tab, activeTab === t.key && styles.tabActive]}
                        onPress={() => setActiveTab(t.key)}>
                        <MaterialIcons name={t.icon as any} size={18} color={activeTab === t.key ? Colors.white : Colors.slate500} />
                        <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
                        <View style={[styles.tabBadge, activeTab === t.key && styles.tabBadgeActive]}>
                            <Text style={[styles.tabBadgeText, activeTab === t.key && { color: Colors.primary }]}>{t.count}</Text>
                        </View>
                    </AnimatedPressable>
                ))}
            </View>

            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {isLoading ? (
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                ) : (
                    <>
                        {/* Subjects */}
                        {activeTab === 'subjects' && subjects.map(s => (
                            <View key={s.id} style={styles.itemCard}>
                                <View style={styles.itemLeft}>
                                    <View style={[styles.itemIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
                                        <MaterialIcons name="menu-book" size={20} color="#60a5fa" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.itemTitle}>{s.name}</Text>
                                        <Text style={styles.itemSub}>{s.code} • {s.units} units • {s.duration_hours || 3}h{s.requires_lab ? ' (Lab)' : ''}</Text>
                                        <Text style={styles.itemMeta}>{s.program} — Year {s.year_level}</Text>
                                        {(s as any).teacher_id && (
                                            <Text style={[styles.itemMeta, { color: '#34d399' }]}>{teachers.find(t => t.id === (s as any).teacher_id)?.profile?.full_name || 'Assigned'}</Text>
                                        )}
                                    </View>
                                </View>
                                <View style={styles.itemActions}>
                                    <AnimatedPressable onPress={() => openEdit(s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                        <MaterialIcons name="edit" size={18} color={Colors.slate400} />
                                    </AnimatedPressable>
                                    <AnimatedPressable onPress={() => handleDelete(s.id, s.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                        <MaterialIcons name="delete-outline" size={18} color="#ef4444" />
                                    </AnimatedPressable>
                                </View>
                            </View>
                        ))}

                        {/* Rooms */}
                        {activeTab === 'rooms' && rooms.map(r => (
                            <View key={r.id} style={styles.itemCard}>
                                <View style={styles.itemLeft}>
                                    <View style={[styles.itemIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                                        <MaterialIcons name="meeting-room" size={20} color="#34d399" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.itemTitle}>{r.name}</Text>
                                        <Text style={styles.itemSub}>{r.building} • Floor {r.floor} • {r.type}</Text>
                                        <Text style={styles.itemMeta}>Capacity: {r.capacity} • {r.is_available ? 'Available' : 'Unavailable'}</Text>
                                    </View>
                                </View>
                                <View style={styles.itemActions}>
                                    <AnimatedPressable onPress={() => openEdit(r)}><MaterialIcons name="edit" size={18} color={Colors.slate400} /></AnimatedPressable>
                                    <AnimatedPressable onPress={() => handleDelete(r.id, r.name)}><MaterialIcons name="delete-outline" size={18} color="#ef4444" /></AnimatedPressable>
                                </View>
                            </View>
                        ))}

                        {/* Sections */}
                        {activeTab === 'sections' && sections.map(s => (
                            <View key={s.id} style={styles.itemCard}>
                                <View style={styles.itemLeft}>
                                    <View style={[styles.itemIcon, { backgroundColor: 'rgba(168,85,247,0.12)' }]}>
                                        <MaterialIcons name="groups" size={20} color="#c084fc" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.itemTitle}>{s.name}</Text>
                                        <Text style={styles.itemSub}>{s.program} — Year {s.year_level}</Text>
                                        <Text style={styles.itemMeta}>{s.student_count} students</Text>
                                    </View>
                                </View>
                                <View style={styles.itemActions}>
                                    <AnimatedPressable onPress={() => openEdit(s)}><MaterialIcons name="edit" size={18} color={Colors.slate400} /></AnimatedPressable>
                                    <AnimatedPressable onPress={() => handleDelete(s.id, s.name)}><MaterialIcons name="delete-outline" size={18} color="#ef4444" /></AnimatedPressable>
                                </View>
                            </View>
                        ))}

                        {((activeTab === 'subjects' && subjects.length === 0) ||
                            (activeTab === 'rooms' && rooms.length === 0) ||
                            (activeTab === 'sections' && sections.length === 0)) && (
                                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                                    <MaterialIcons name="inbox" size={48} color={Colors.slate600} />
                                    <Text style={{ color: Colors.slate500, marginTop: 12 }}>📭 No {activeTab} yet</Text>
                                    <AnimatedPressable onPress={openAdd} style={{ marginTop: 12, backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}>
                                        <Text style={{ color: Colors.white, fontWeight: '600' }}>Add {activeTab === 'subjects' ? 'Subject' : activeTab === 'rooms' ? 'Room' : 'Section'}</Text>
                                    </AnimatedPressable>
                                </View>
                            )}
                    </>
                )}
                <View style={{ height: 32 }} />
            </ScrollView>

            {/* Add/Edit Modal */}
            <Modal visible={showModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editing ? 'Edit' : 'Add'} {activeTab === 'subjects' ? 'Subject' : activeTab === 'rooms' ? 'Room' : 'Section'}
                            </Text>
                            <AnimatedPressable onPress={() => setShowModal(false)}>
                                <MaterialIcons name="close" size={24} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
                            {activeTab === 'subjects' && (
                                <>
                                    <Text style={styles.fieldLabel}>SUBJECT CODE</Text>
                                    <TextInput style={styles.input} value={subCode} onChangeText={setSubCode} placeholder="e.g. CS101" placeholderTextColor="#6b7280" />
                                    <Text style={styles.fieldLabel}>SUBJECT NAME</Text>
                                    <TextInput style={styles.input} value={subName} onChangeText={setSubName} placeholder="e.g. Introduction to Computing" placeholderTextColor="#6b7280" />
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.fieldLabel}>UNITS</Text>
                                            <TextInput style={styles.input} value={subUnits} onChangeText={setSubUnits} keyboardType="numeric" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.fieldLabel}>HOURS</Text>
                                            <TextInput style={styles.input} value={subDuration} onChangeText={setSubDuration} keyboardType="numeric" />
                                        </View>
                                    </View>
                                    <Text style={styles.fieldLabel}>PROGRAM / SECTION</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            {sections.map(sec => (
                                                <AnimatedPressable
                                                    key={sec.id}
                                                    onPress={() => setSubProgram(sec.program ? `${sec.program} - ${sec.name}` : sec.name)}
                                                    style={[styles.chip, subProgram === (sec.program ? `${sec.program} - ${sec.name}` : sec.name) && styles.chipActive]}
                                                >
                                                    <Text style={[styles.chipText, subProgram === (sec.program ? `${sec.program} - ${sec.name}` : sec.name) && styles.chipTextActive]} numberOfLines={1}>
                                                        {sec.program ? `${sec.program} - ${sec.name}` : sec.name}
                                                    </Text>
                                                </AnimatedPressable>
                                            ))}
                                            {sections.length === 0 && (
                                                <Text style={{ color: '#64748b', fontSize: 12, paddingVertical: 8 }}>No sections yet. Create sections first.</Text>
                                            )}
                                        </View>
                                    </ScrollView>
                                    <Text style={styles.fieldLabel}>YEAR LEVEL</Text>
                                    <TextInput style={styles.input} value={subYear} onChangeText={setSubYear} keyboardType="numeric" />

                                    <Text style={styles.fieldLabel}>ASSIGNED TEACHER</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            <AnimatedPressable
                                                onPress={() => setSubTeacherId('')}
                                                style={[styles.chip, !subTeacherId && styles.chipActive]}
                                            >
                                                <Text style={[styles.chipText, !subTeacherId && styles.chipTextActive]}>None</Text>
                                            </AnimatedPressable>
                                            {teachers.map(t => (
                                                <AnimatedPressable
                                                    key={t.id}
                                                    onPress={() => setSubTeacherId(t.id)}
                                                    style={[styles.chip, subTeacherId === t.id && styles.chipActive]}
                                                >
                                                    <Text style={[styles.chipText, subTeacherId === t.id && styles.chipTextActive]} numberOfLines={1}>
                                                        {t.profile?.full_name || 'Teacher'}
                                                    </Text>
                                                </AnimatedPressable>
                                            ))}
                                        </View>
                                    </ScrollView>
                                </>
                            )}

                            {activeTab === 'rooms' && (
                                <>
                                    <Text style={styles.fieldLabel}>ROOM NAME</Text>
                                    <TextInput style={styles.input} value={roomName} onChangeText={setRoomName} placeholder="e.g. Lab 204" placeholderTextColor="#6b7280" />
                                    <Text style={styles.fieldLabel}>BUILDING</Text>
                                    <TextInput style={styles.input} value={roomBuilding} onChangeText={setRoomBuilding} placeholder="e.g. Main Building" placeholderTextColor="#6b7280" />
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.fieldLabel}>CAPACITY</Text>
                                            <TextInput style={styles.input} value={roomCapacity} onChangeText={setRoomCapacity} keyboardType="numeric" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.fieldLabel}>FLOOR</Text>
                                            <TextInput style={styles.input} value={roomFloor} onChangeText={setRoomFloor} keyboardType="numeric" />
                                        </View>
                                    </View>
                                    <Text style={styles.fieldLabel}>TYPE</Text>
                                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                                        {(['lecture', 'laboratory', 'computer_lab', 'gymnasium'] as const).map(t => (
                                            <AnimatedPressable key={t} onPress={() => setRoomType(t)}
                                                style={[styles.chip, roomType === t && styles.chipActive]}>
                                                <Text style={[styles.chipText, roomType === t && styles.chipTextActive]}>
                                                    {t.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                </Text>
                                            </AnimatedPressable>
                                        ))}
                                    </View>
                                </>
                            )}

                            {activeTab === 'sections' && (
                                <>
                                    <Text style={styles.fieldLabel}>SECTION NAME</Text>
                                    <TextInput style={styles.input} value={secName} onChangeText={setSecName} placeholder="e.g. BSIT 3A" placeholderTextColor="#6b7280" />
                                    <Text style={styles.fieldLabel}>PROGRAM</Text>
                                    <TextInput style={styles.input} value={secProgram} onChangeText={setSecProgram} placeholder="e.g. BSIT" placeholderTextColor="#6b7280" />
                                    <View style={{ flexDirection: 'row', gap: 12 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.fieldLabel}>YEAR LEVEL</Text>
                                            <TextInput style={styles.input} value={secYear} onChangeText={setSecYear} keyboardType="numeric" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.fieldLabel}>STUDENT COUNT</Text>
                                            <TextInput style={styles.input} value={secCount} onChangeText={setSecCount} keyboardType="numeric" />
                                        </View>
                                    </View>
                                </>
                            )}
                        </ScrollView>

                        <AnimatedPressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                            {saving ? <ActivityIndicator color={Colors.white} /> : (
                                <Text style={styles.saveBtnText}>{editing ? 'Save Changes' : 'Create'}</Text>
                            )}
                        </AnimatedPressable>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundDark },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12
    },
    headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimaryDark },
    tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
    tab: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.surfaceDark,
        borderWidth: 1, borderColor: Colors.borderDark
    },
    tabActive: { backgroundColor: Colors.primary, borderColor: 'transparent' },
    tabText: { fontSize: 12, fontWeight: '600', color: Colors.slate500 },
    tabTextActive: { color: Colors.white },
    tabBadge: { backgroundColor: Colors.slate700, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
    tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
    tabBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.slate400 },
    list: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
    itemCard: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceDark,
        borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.borderDark
    },
    itemLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    itemIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    itemTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimaryDark },
    itemSub: { fontSize: 12, color: Colors.slate400, marginTop: 2 },
    itemMeta: { fontSize: 11, color: Colors.slate600, marginTop: 2 },
    itemActions: { flexDirection: 'row', gap: 12 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
    fieldLabel: { fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5, marginBottom: 6, marginTop: 12 },
    input: {
        backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 12, color: Colors.white, fontSize: 14
    },
    chip: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
        borderWidth: 1, borderColor: '#334155', marginBottom: 4
    },
    chipActive: { borderColor: Colors.primary, backgroundColor: 'rgba(59,130,246,0.1)' },
    chipText: { fontSize: 12, fontWeight: '500', color: Colors.slate400 },
    chipTextActive: { color: Colors.white },
    saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
    saveBtnText: { color: Colors.white, fontSize: 15, fontWeight: '600' }
});

export default AdminDataManagement;
