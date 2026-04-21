import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, StyleSheet, Switch, Alert,
    Modal, TextInput, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { DayOfWeek } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import { useSubjects, useRooms } from '../../hooks/useSupabase';
import { supabase } from '../../config/supabase';
import { AnimatedPressable } from '../../components/AnimatedPressable';

const TeacherPreferences: React.FC = () => {
    const { profile } = useAuth();
    const teacherName = profile?.full_name || 'Teacher';
    const initials = teacherName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayAbbr: Record<string, string> = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat' };

    // Data hooks
    const { subjects } = useSubjects();
    const { rooms } = useRooms();

    // Teacher ID (from teachers table, not auth)
    const [teacherId, setTeacherId] = useState<string | null>(null);
    const [loadingPrefs, setLoadingPrefs] = useState(true);
    const [saving, setSaving] = useState(false);

    // Preference state
    const [selectedDays, setSelectedDays] = useState(new Set<string>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']));
    const [morningAvail, setMorningAvail] = useState(true);
    const [afternoonAvail, setAfternoonAvail] = useState(true);
    const [eveningAvail, setEveningAvail] = useState(false);
    const [preferredSubjectIds, setPreferredSubjectIds] = useState<string[]>([]);
    const [preferredRoomIds, setPreferredRoomIds] = useState<string[]>([]);
    const [notes, setNotes] = useState('');
    const [maxConsecutive, setMaxConsecutive] = useState(4);

    // Modals
    const [showSubjectPicker, setShowSubjectPicker] = useState(false);
    const [showRoomPicker, setShowRoomPicker] = useState(false);

    // Look up teacher ID from profile_id
    useEffect(() => {
        if (!profile?.id) return;
        (async () => {
            const { data } = await supabase
                .from('teachers')
                .select('id')
                .eq('profile_id', profile.id)
                .single();
            if (data) setTeacherId(data.id);
        })();
    }, [profile?.id]);

    // Load existing preferences
    useEffect(() => {
        if (!teacherId) { setLoadingPrefs(false); return; }
        (async () => {
            setLoadingPrefs(true);
            const { data, error } = await supabase
                .from('teacher_preferences')
                .select('*')
                .eq('teacher_id', teacherId)
                .single();

            if (data && !error) {
                if (data.preferred_days?.length > 0) setSelectedDays(new Set(data.preferred_days));
                setMorningAvail(data.morning_available ?? true);
                setAfternoonAvail(data.afternoon_available ?? true);
                setEveningAvail(data.evening_available ?? false);
                setPreferredSubjectIds(data.preferred_subjects || []);
                setPreferredRoomIds(data.preferred_rooms || []);
                setNotes(data.notes || '');
                setMaxConsecutive(data.max_consecutive_hours || 4);
            }
            setLoadingPrefs(false);
        })();
    }, [teacherId]);

    const toggleDay = (day: string) => {
        const newSet = new Set(selectedDays);
        if (newSet.has(day)) newSet.delete(day);
        else newSet.add(day);
        setSelectedDays(newSet);
    };

    const removeSubject = (subjectId: string) => {
        setPreferredSubjectIds(prev => prev.filter(id => id !== subjectId));
    };

    const addSubject = (subjectId: string) => {
        if (!preferredSubjectIds.includes(subjectId)) {
            setPreferredSubjectIds(prev => [...prev, subjectId]);
        }
    };

    const removeRoom = (roomId: string) => {
        setPreferredRoomIds(prev => prev.filter(id => id !== roomId));
    };

    const addRoom = (roomId: string) => {
        if (!preferredRoomIds.includes(roomId)) {
            setPreferredRoomIds(prev => [...prev, roomId]);
        }
    };

    const handleSave = async () => {
        if (!teacherId) {
            Alert.alert('Error', 'Teacher record not found. Please contact admin.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                teacher_id: teacherId,
                preferred_days: Array.from(selectedDays),
                morning_available: morningAvail,
                afternoon_available: afternoonAvail,
                evening_available: eveningAvail,
                preferred_subjects: preferredSubjectIds,
                preferred_rooms: preferredRoomIds,
                notes: notes.trim() || null,
                max_consecutive_hours: maxConsecutive,
                last_updated: new Date().toISOString()
            };

            const { error } = await supabase
                .from('teacher_preferences')
                .upsert(payload, { onConflict: 'teacher_id' });

            if (error) {
                Alert.alert('Error', error.message);
            } else {
                Alert.alert('Saved', 'Your preferences have been updated.');
            }
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to save preferences.');
        } finally {
            setSaving(false);
        }
    };

    // Helpers to resolve IDs to names
    const getSubjectName = (id: string) => subjects.find(s => s.id === id)?.name || 'Unknown';
    const getSubjectCode = (id: string) => subjects.find(s => s.id === id)?.code || '';
    const getRoomName = (id: string) => rooms.find(r => r.id === id)?.name || 'Unknown';

    // Available (not yet selected) items for pickers
    const availableSubjects = subjects.filter(s => !preferredSubjectIds.includes(s.id));
    const availableRooms = rooms.filter(r => !preferredRoomIds.includes(r.id));

    const timeSlots = [
        { label: 'Morning', sub: '7:00 AM - 12:00 PM', icon: 'wb-sunny' as const, value: morningAvail, setter: setMorningAvail, color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
        { label: 'Afternoon', sub: '12:00 PM - 5:00 PM', icon: 'wb-twilight' as const, value: afternoonAvail, setter: setAfternoonAvail, color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
        { label: 'Evening', sub: '5:00 PM - 9:00 PM', icon: 'nightlight-round' as const, value: eveningAvail, setter: setEveningAvail, color: '#818cf8', bg: 'rgba(129,140,248,0.1)' },
    ];

    if (loadingPrefs) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={{ color: Colors.slate400, marginTop: 12 }}>Loading preferences...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ width: 32 }} />
                <Text style={styles.headerTitle}>Preferences</Text>
                <AnimatedPressable onPress={handleSave} disabled={saving}>
                    {saving ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                        <Text style={styles.saveBtn}>Save</Text>
                    )}
                </AnimatedPressable>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Teacher Info */}
                <View style={styles.profileCard}>
                    <View style={styles.profileAvatar}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.profileName}>{teacherName}</Text>
                        <Text style={styles.profileDept}>{profile?.department || 'Department'}</Text>
                    </View>
                    {!teacherId && (
                        <View style={{ backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                            <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: '600' }}>No record</Text>
                        </View>
                    )}
                </View>

                {/* Working Days */}
                <Text style={styles.sectionLabel}>PREFERRED WORKING DAYS</Text>
                <View style={styles.daysGrid}>
                    {days.map(day => (
                        <AnimatedPressable
                            key={day}
                            style={[styles.dayChip, selectedDays.has(day) && styles.dayChipActive]}
                            onPress={() => toggleDay(day)}
                        >
                            <View style={styles.dayDot}>
                                {selectedDays.has(day) && <MaterialIcons name="check" size={14} color={Colors.primary} />}
                            </View>
                            <Text style={[styles.dayText, selectedDays.has(day) && styles.dayTextActive]}>
                                {dayAbbr[day]}
                            </Text>
                        </AnimatedPressable>
                    ))}
                </View>

                {/* Time Slots */}
                <Text style={styles.sectionLabel}>⏰ TIME SLOT AVAILABILITY</Text>
                <View style={styles.timeSlotsCard}>
                    {timeSlots.map((slot, index) => (
                        <View key={slot.label} style={[styles.timeSlotRow, index < timeSlots.length - 1 && styles.timeSlotBorder]}>
                            <View style={styles.timeSlotLeft}>
                                <View style={[styles.timeSlotIcon, { backgroundColor: slot.bg }]}>
                                    <MaterialIcons name={slot.icon} size={22} color={slot.color} />
                                </View>
                                <View>
                                    <Text style={styles.timeSlotLabel}>{slot.label}</Text>
                                    <Text style={styles.timeSlotSub}>{slot.sub}</Text>
                                </View>
                            </View>
                            <Switch
                                value={slot.value}
                                onValueChange={slot.setter}
                                trackColor={{ false: '#334155', true: Colors.primary }}
                                thumbColor={Colors.white}
                            />
                        </View>
                    ))}
                </View>

                {/* Preferred Subjects */}
                <Text style={styles.sectionLabel}>PREFERRED SUBJECTS</Text>
                <View style={styles.card}>
                    {preferredSubjectIds.length > 0 ? (
                        <View style={styles.prefTagsRow}>
                            {preferredSubjectIds.map(id => (
                                <AnimatedPressable key={id} style={styles.prefTag} onPress={() => removeSubject(id)}>
                                    <Text style={styles.prefTagText}>{getSubjectName(id)}</Text>
                                    <MaterialIcons name="close" size={14} color={Colors.slate400} />
                                </AnimatedPressable>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.emptyHint}>No preferred subjects selected</Text>
                    )}
                    <AnimatedPressable style={styles.addPrefBtn} onPress={() => setShowSubjectPicker(true)}>
                        <MaterialIcons name="add" size={16} color={Colors.primary} />
                        <Text style={styles.addPrefText}>Add Subject Preference</Text>
                    </AnimatedPressable>
                </View>

                {/* Preferred Rooms */}
                <Text style={styles.sectionLabel}>PREFERRED ROOMS</Text>
                <View style={styles.card}>
                    {preferredRoomIds.length > 0 ? (
                        <View style={styles.prefTagsRow}>
                            {preferredRoomIds.map(id => (
                                <AnimatedPressable key={id} style={styles.prefTag} onPress={() => removeRoom(id)}>
                                    <Text style={styles.prefTagText}>{getRoomName(id)}</Text>
                                    <MaterialIcons name="close" size={14} color={Colors.slate400} />
                                </AnimatedPressable>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.emptyHint}>No preferred rooms selected</Text>
                    )}
                    <AnimatedPressable style={styles.addPrefBtn} onPress={() => setShowRoomPicker(true)}>
                        <MaterialIcons name="add" size={16} color={Colors.primary} />
                        <Text style={styles.addPrefText}>Add Room Preference</Text>
                    </AnimatedPressable>
                </View>

                {/* Notes */}
                <Text style={styles.sectionLabel}>ADDITIONAL NOTES</Text>
                <View style={styles.card}>
                    <TextInput
                        style={styles.notesInput}
                        placeholder="Add any scheduling preferences or constraints..."
                        placeholderTextColor={Colors.slate500}
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                    />
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Subject Picker Modal */}
            <Modal visible={showSubjectPicker} animationType="slide" transparent>
                <View style={styles.pickerOverlay}>
                    <View style={styles.pickerContent}>
                        <View style={styles.pickerHeader}>
                            <Text style={styles.pickerTitle}>Add Subject</Text>
                            <AnimatedPressable onPress={() => setShowSubjectPicker(false)}>
                                <MaterialIcons name="close" size={24} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>
                        <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                            {availableSubjects.length === 0 ? (
                                <Text style={styles.pickerEmpty}>All subjects already added</Text>
                            ) : (
                                availableSubjects.map(s => (
                                    <AnimatedPressable
                                        key={s.id}
                                        style={styles.pickerItem}
                                        onPress={() => { addSubject(s.id); setShowSubjectPicker(false); }}
                                    >
                                        <View style={styles.pickerItemIcon}>
                                            <MaterialIcons name="book" size={20} color="#8b5cf6" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.pickerItemName}>{s.name}</Text>
                                            <Text style={styles.pickerItemSub}>{s.code} • {s.units} units • {s.type}</Text>
                                        </View>
                                        <MaterialIcons name="add-circle-outline" size={22} color={Colors.primary} />
                                    </AnimatedPressable>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Room Picker Modal */}
            <Modal visible={showRoomPicker} animationType="slide" transparent>
                <View style={styles.pickerOverlay}>
                    <View style={styles.pickerContent}>
                        <View style={styles.pickerHeader}>
                            <Text style={styles.pickerTitle}>Add Room</Text>
                            <AnimatedPressable onPress={() => setShowRoomPicker(false)}>
                                <MaterialIcons name="close" size={24} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>
                        <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                            {availableRooms.length === 0 ? (
                                <Text style={styles.pickerEmpty}>All rooms already added</Text>
                            ) : (
                                availableRooms.map(r => (
                                    <AnimatedPressable
                                        key={r.id}
                                        style={styles.pickerItem}
                                        onPress={() => { addRoom(r.id); setShowRoomPicker(false); }}
                                    >
                                        <View style={[styles.pickerItemIcon, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                                            <MaterialIcons name="meeting-room" size={20} color="#10b981" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.pickerItemName}>{r.name}</Text>
                                            <Text style={styles.pickerItemSub}>{r.building} • Floor {r.floor} • Cap: {r.capacity}</Text>
                                        </View>
                                        <MaterialIcons name="add-circle-outline" size={22} color={Colors.primary} />
                                    </AnimatedPressable>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundDark },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.borderDark
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.white },
    saveBtn: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
    scrollView: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },

    profileCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: Colors.surfaceDark, borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: Colors.borderDark, marginBottom: 24
    },
    profileAvatar: {
        width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary,
        justifyContent: 'center', alignItems: 'center'
    },
    avatarText: { color: Colors.white, fontWeight: '700', fontSize: 18 },
    profileName: { fontSize: 16, fontWeight: '700', color: Colors.white },
    profileDept: { fontSize: 12, color: Colors.textSecondaryDark },

    sectionLabel: {
        fontSize: 11, fontWeight: '600', color: Colors.textSecondaryDark,
        letterSpacing: 1.5, marginBottom: 12, paddingLeft: 4
    },

    daysGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24
    },
    dayChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: Colors.surfaceDark, borderRadius: 12, paddingHorizontal: 14,
        paddingVertical: 10, borderWidth: 1, borderColor: Colors.borderDark
    },
    dayChipActive: { borderColor: Colors.primary, backgroundColor: 'rgba(19,91,236,0.08)' },
    dayDot: {
        width: 20, height: 20, borderRadius: 4, borderWidth: 1,
        borderColor: Colors.borderDark, justifyContent: 'center', alignItems: 'center'
    },
    dayText: { fontSize: 14, fontWeight: '500', color: Colors.slate400 },
    dayTextActive: { color: Colors.white },

    timeSlotsCard: {
        backgroundColor: Colors.surfaceDark, borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: Colors.borderDark, marginBottom: 24
    },
    timeSlotRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
    timeSlotBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(51,65,85,0.5)' },
    timeSlotLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    timeSlotIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    timeSlotLabel: { fontSize: 14, fontWeight: '500', color: Colors.white },
    timeSlotSub: { fontSize: 12, color: Colors.textSecondaryDark, marginTop: 2 },

    card: {
        backgroundColor: Colors.surfaceDark, borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: Colors.borderDark, marginBottom: 24
    },
    prefTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    prefTag: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: Colors.slate700, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999
    },
    prefTagText: { fontSize: 13, color: Colors.textPrimaryDark },
    emptyHint: { fontSize: 13, color: Colors.slate500, marginBottom: 12, fontStyle: 'italic' },
    addPrefBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
        borderWidth: 1, borderColor: Colors.primaryAlpha20, borderRadius: 8,
        borderStyle: 'dashed', paddingHorizontal: 12, paddingVertical: 6
    },
    addPrefText: { color: Colors.primary, fontSize: 13, fontWeight: '500' },

    notesInput: {
        color: Colors.white, fontSize: 14, minHeight: 80
    },

    // Picker Modal
    pickerOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end'
    },
    pickerContent: {
        backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40
    },
    pickerHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16
    },
    pickerTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
    pickerEmpty: { color: Colors.slate400, fontSize: 14, textAlign: 'center', paddingVertical: 24 },
    pickerItem: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(51,65,85,0.3)'
    },
    pickerItemIcon: {
        width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(139,92,246,0.1)',
        justifyContent: 'center', alignItems: 'center'
    },
    pickerItemName: { fontSize: 14, fontWeight: '600', color: Colors.white },
    pickerItemSub: { fontSize: 12, color: Colors.slate400, marginTop: 2 }
});

export default TeacherPreferences;
