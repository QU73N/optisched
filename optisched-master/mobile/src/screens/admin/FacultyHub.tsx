import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useMemo } from 'react';
import {
    View, Text, ScrollView,  StyleSheet,
    Alert, TextInput, Modal, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useTeachers, useSchedules } from '../../hooks/useSupabase';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { AnimatedPressable } from '../../components/AnimatedPressable';

interface FacultyMember {
    id: string; name: string; department: string; type: 'full-time' | 'part-time';
    load: number; maxHours: number; loadColor: string; statusColor: string; initials: string;
    isOverloaded: boolean; isActive: boolean; profileId: string;
}

const FacultyHub: React.FC = () => {
    const [activeFilter, setActiveFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const filters = ['All', 'Full-time', 'Part-time', 'Overloaded'];
    const { teachers, loading, updateTeacher } = useTeachers();
    const { schedules } = useSchedules({ status: 'published' });

    // View Schedule modal
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [selectedMember, setSelectedMember] = useState<FacultyMember | null>(null);

    // Adjust Load modal
    const [showLoadModal, setShowLoadModal] = useState(false);
    const [loadMaxHours, setLoadMaxHours] = useState('');
    const [saving, setSaving] = useState(false);

    // Action sheet
    const [showActionSheet, setShowActionSheet] = useState(false);
    const [actionMember, setActionMember] = useState<FacultyMember | null>(null);

    // Send message
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [sendingMsg, setSendingMsg] = useState(false);
    const { profile } = useAuth();

    const faculty: FacultyMember[] = useMemo(() => {
        const source = teachers.map(t => {
            const name = t.profile?.full_name || 'Unknown';
            const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2);
            const mySchedules = schedules.filter(s => s.teacher_id === t.id);
            let totalMinutes = 0;
            mySchedules.forEach(s => {
                if (s.start_time && s.end_time) {
                    const [h1, m1] = s.start_time.split(':').map(Number);
                    const [h2, m2] = s.end_time.split(':').map(Number);
                    totalMinutes += (h2 * 60 + m2) - (h1 * 60 + m1);
                }
            });
            const totalHours = totalMinutes / 60;
            const load = Math.round((totalHours / (t.max_hours || 1)) * 100);
            const isOverloaded = load > 100;
            const loadColor = isOverloaded ? '#ef4444' : load > 80 ? '#f59e0b' : '#10b981';
            return {
                id: t.id, name, department: t.department,
                type: t.employment_type as 'full-time' | 'part-time',
                load, maxHours: t.max_hours, loadColor, statusColor: t.is_active ? '#10b981' : '#94a3b8',
                initials, isOverloaded, isActive: t.is_active, profileId: t.profile_id
            };
        });

        let filtered = source;
        if (activeFilter === 'Full-time') filtered = source.filter(f => f.type === 'full-time');
        else if (activeFilter === 'Part-time') filtered = source.filter(f => f.type === 'part-time');
        else if (activeFilter === 'Overloaded') filtered = source.filter(f => f.isOverloaded);

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(f => f.name.toLowerCase().includes(q) || f.department.toLowerCase().includes(q));
        }
        return filtered;
    }, [teachers, activeFilter, searchQuery]);

    const totalFaculty = teachers.length;
    const avgLoad = faculty.length > 0 ? Math.round(faculty.reduce((sum, f) => sum + f.load, 0) / faculty.length) : 0;

    // Get teacher's schedule
    const teacherSchedule = useMemo(() => {
        if (!selectedMember) return [];
        return schedules.filter(s => s.teacher_id === selectedMember.id);
    }, [selectedMember, schedules]);

    // Group schedule by day
    const scheduleByDay = useMemo(() => {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const grouped: Record<string, typeof teacherSchedule> = {};
        days.forEach(d => {
            const daySchedules = teacherSchedule.filter(s => s.day_of_week === d);
            if (daySchedules.length > 0) {
                grouped[d] = daySchedules.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
            }
        });
        return grouped;
    }, [teacherSchedule]);

    const handleViewSchedule = (member: FacultyMember) => {
        setSelectedMember(member);
        setShowScheduleModal(true);
    };

    const handleAdjustLoad = (member: FacultyMember) => {
        setSelectedMember(member);
        setLoadMaxHours(String(member.maxHours));
        setShowLoadModal(true);
    };

    const handleSaveLoad = async () => {
        if (!selectedMember) return;
        const hours = parseInt(loadMaxHours);
        if (isNaN(hours) || hours < 1 || hours > 60) {
            Alert.alert('Invalid', 'Max hours must be between 1 and 60.');
            return;
        }
        setSaving(true);
        try {
            await updateTeacher(selectedMember.id, { max_hours: hours });
            Alert.alert('Updated', `${selectedMember.name}'s max hours updated to ${hours}.`);
            setShowLoadModal(false);
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to update.');
        } finally {
            setSaving(false);
        }
    };

    const handleSendMessage = async () => {
        if (!actionMember || !messageText.trim()) {
            Alert.alert('Error', 'Please type a message.');
            return;
        }
        setSendingMsg(true);
        try {
            await supabase.from('admin_messages').insert({
                sender_id: profile?.id || '',
                sender_name: profile?.full_name || 'Admin',
                recipient_id: actionMember.profileId,
                recipient_name: actionMember.name,
                message: messageText.trim(),
                status: 'unread'
            });
            Alert.alert('Sent!', `Message sent to ${actionMember.name}.`);
            setShowMessageModal(false);
            setMessageText('');
        } catch {
            Alert.alert('Error', 'Failed to send message.');
        } finally {
            setSendingMsg(false);
        }
    };

    const handleFacultyAction = (member: FacultyMember) => {
        setActionMember(member);
        setShowActionSheet(true);
    };

    const formatTime = (time: string | null) => {
        if (!time) return '--';
        const [h, m] = time.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
        return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <Text style={styles.headerTitle}>Faculty Hub</Text>
                    <View style={styles.headerActions}>
                        <AnimatedPressable style={styles.iconBtn} onPress={() => setShowSearch(!showSearch)}>
                            <MaterialIcons name={showSearch ? 'close' : 'search'} size={24} color={Colors.slate400} />
                        </AnimatedPressable>
                    </View>
                </View>

                {showSearch && (
                    <TextInput style={styles.searchInput} placeholder="Search faculty..." placeholderTextColor="#6b7280"
                        value={searchQuery} onChangeText={setSearchQuery} autoFocus />
                )}

                <View style={styles.statsRow}>
                    <View style={[styles.statBox, { backgroundColor: Colors.primaryAlpha10, borderColor: Colors.primaryAlpha20, borderWidth: 1 }]}>
                        <Text style={[styles.statLabel, { color: 'rgba(19,91,236,0.8)' }]}>Total Faculty</Text>
                        <Text style={[styles.statValue, { color: Colors.primary }]}>{totalFaculty}</Text>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: Colors.surfaceDark, borderColor: Colors.borderDark, borderWidth: 1 }]}>
                        <Text style={styles.statLabel}>Avg Load</Text>
                        <Text style={styles.statValue}>{avgLoad}%</Text>
                    </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                    {filters.map(f => (
                        <AnimatedPressable key={f} style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
                            onPress={() => setActiveFilter(f)}>
                            <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>{f}</Text>
                        </AnimatedPressable>
                    ))}
                </ScrollView>
            </View>

            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={{ color: Colors.slate400, marginTop: 12 }}>Loading faculty...</Text>
                    </View>
                ) : faculty.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                        <MaterialIcons name="person-off" size={48} color={Colors.slate600} />
                        <Text style={{ color: Colors.slate500, marginTop: 12 }}>No faculty found</Text>
                    </View>
                ) : faculty.map(member => (
                    <AnimatedPressable key={member.id} style={[styles.facultyCard, member.isOverloaded && styles.facultyCardOverloaded]}
                        activeOpacity={0.7} onPress={() => handleViewSchedule(member)}>
                        <View style={styles.cardTop}>
                            <View style={styles.cardTopLeft}>
                                <View style={styles.avatarContainer}>
                                    <View style={[styles.avatar, member.isOverloaded && styles.avatarOverloaded]}>
                                        <Text style={styles.avatarText}>{member.initials}</Text>
                                    </View>
                                    <View style={[styles.statusDot, { backgroundColor: member.statusColor }]} />
                                </View>
                                <View>
                                    <Text style={styles.facultyName}>{member.name}</Text>
                                    <Text style={styles.facultyDept}>{member.department}</Text>
                                    <View style={styles.badgeRow}>
                                        <View style={[styles.badge, member.type === 'part-time' ? styles.badgePurple : styles.badgeBlue]}>
                                            <Text style={[styles.badgeText, member.type === 'part-time' ? styles.badgeTextPurple : styles.badgeTextBlue]}>
                                                {member.type === 'full-time' ? 'FULL-TIME' : 'PART-TIME'}
                                            </Text>
                                        </View>
                                        {member.isOverloaded && (
                                            <View style={styles.badgeRed}>
                                                <MaterialIcons name="warning" size={10} color="#ef4444" />
                                                <Text style={styles.badgeTextRed}>Overload</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>
                            <AnimatedPressable onPress={() => handleFacultyAction(member)}>
                                <MaterialIcons name="more-vert" size={20} color={Colors.slate600} />
                            </AnimatedPressable>
                        </View>
                        <View style={styles.loadSection}>
                            <View style={styles.loadHeader}>
                                <Text style={styles.loadLabel}>Current Load ({member.maxHours}h max)</Text>
                                <Text style={[styles.loadValue, { color: member.loadColor }]}>{member.load}%</Text>
                            </View>
                            <View style={styles.loadBar}>
                                <View style={[styles.loadFill, { width: `${Math.min(member.load, 100)}%`, backgroundColor: member.loadColor }]} />
                            </View>
                        </View>
                    </AnimatedPressable>
                ))}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* View Schedule Modal */}
            <Modal visible={showScheduleModal} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }}>
                    <SafeAreaView style={{ flex: 1 }}>
                        <View style={{ flex: 1, backgroundColor: '#0f172a', marginTop: 40, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
                                <View>
                                    <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.white }}>{selectedMember?.name}</Text>
                                    <Text style={{ fontSize: 13, color: Colors.slate400, marginTop: 2 }}>{selectedMember?.department} • {teacherSchedule.length} classes</Text>
                                </View>
                                <AnimatedPressable onPress={() => setShowScheduleModal(false)} style={{ padding: 4 }}>
                                    <MaterialIcons name="close" size={24} color={Colors.slate400} />
                                </AnimatedPressable>
                            </View>
                            <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
                                {teacherSchedule.length === 0 ? (
                                    <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                                        <MaterialIcons name="event-busy" size={48} color={Colors.slate600} />
                                        <Text style={{ color: Colors.slate400, fontSize: 16, fontWeight: '500', marginTop: 12 }}>No classes assigned</Text>
                                    </View>
                                ) : (
                                    Object.entries(scheduleByDay).map(([day, daySchedules]) => (
                                        <View key={day} style={{ marginTop: 16 }}>
                                            <Text style={{ color: Colors.primary, fontSize: 13, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>{day.toUpperCase()}</Text>
                                            {daySchedules.map(s => (
                                                <View key={s.id} style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#334155' }}>
                                                    <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.white }}>{s.subject?.name || 'Subject'}</Text>
                                                    <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                            <MaterialIcons name="schedule" size={14} color={Colors.slate500} />
                                                            <Text style={{ color: Colors.slate400, fontSize: 12 }}>{formatTime(s.start_time)} - {formatTime(s.end_time)}</Text>
                                                        </View>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                            <MaterialIcons name="meeting-room" size={14} color={Colors.slate500} />
                                                            <Text style={{ color: Colors.slate400, fontSize: 12 }}>{s.room?.name || 'TBA'}</Text>
                                                        </View>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                            <MaterialIcons name="groups" size={14} color={Colors.slate500} />
                                                            <Text style={{ color: Colors.slate400, fontSize: 12 }}>{s.section?.name || 'Section'}</Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    ))
                                )}
                                <View style={{ height: 40 }} />
                            </ScrollView>
                        </View>
                    </SafeAreaView>
                </View>
            </Modal>

            {/* Adjust Load Modal */}
            <Modal visible={showLoadModal} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.white }}>Adjust Load</Text>
                            <AnimatedPressable onPress={() => setShowLoadModal(false)}>
                                <MaterialIcons name="close" size={24} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>
                        <Text style={{ color: Colors.slate400, fontSize: 13, marginBottom: 4 }}>{selectedMember?.name}</Text>
                        <Text style={{ color: Colors.slate500, fontSize: 12, marginBottom: 16 }}>Current load: {selectedMember?.load}%</Text>

                        <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5, marginBottom: 6 }}>MAX TEACHING HOURS</Text>
                        <TextInput
                            style={{ backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.white, fontSize: 16, fontWeight: '600' }}
                            value={loadMaxHours} onChangeText={setLoadMaxHours}
                            keyboardType="numeric" placeholder="e.g. 24" placeholderTextColor="#6b7280"
                        />
                        <Text style={{ color: Colors.slate600, fontSize: 11, marginTop: 4 }}>Standard: Full-time = 24h, Part-time = 12h</Text>

                        <AnimatedPressable
                            style={{ backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20, opacity: saving ? 0.6 : 1 }}
                            onPress={handleSaveLoad} disabled={saving}
                        >
                            {saving ? <ActivityIndicator color={Colors.white} /> : (
                                <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '600' }}>Save Changes</Text>
                            )}
                        </AnimatedPressable>
                    </View>
                </View>
            </Modal>

            {/* Action Sheet Modal */}
            <Modal visible={showActionSheet} animationType="fade" transparent>
                <AnimatedPressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={() => setShowActionSheet(false)}>
                    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                        <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, paddingBottom: 40 }}>
                            {/* Handle bar */}
                            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#475569', alignSelf: 'center', marginBottom: 16 }} />
                            {/* Header */}
                            <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                                <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.white }}>{actionMember?.name}</Text>
                                <Text style={{ fontSize: 13, color: Colors.slate400, marginTop: 2 }}>{actionMember?.department} • {actionMember?.type} • {actionMember?.load}% load</Text>
                            </View>
                            {/* Actions */}
                            {[
                                { icon: 'calendar-today', label: 'View Schedule', color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', action: () => { setShowActionSheet(false); if (actionMember) handleViewSchedule(actionMember); } },
                                { icon: 'tune', label: 'Adjust Load', color: '#34d399', bg: 'rgba(16,185,129,0.12)', action: () => { setShowActionSheet(false); if (actionMember) handleAdjustLoad(actionMember); } },
                                { icon: 'mail', label: 'Send Message', color: '#c084fc', bg: 'rgba(168,85,247,0.12)', action: () => { setShowActionSheet(false); setShowMessageModal(true); } },
                            ].map((item, i) => (
                                <AnimatedPressable key={i}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 }}
                                    onPress={item.action}
                                >
                                    <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: item.bg, justifyContent: 'center', alignItems: 'center' }}>
                                        <MaterialIcons name={item.icon as any} size={20} color={item.color} />
                                    </View>
                                    <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.white }}>{item.label}</Text>
                                    <View style={{ flex: 1 }} />
                                    <MaterialIcons name="chevron-right" size={20} color={Colors.slate600} />
                                </AnimatedPressable>
                            ))}
                            <AnimatedPressable
                                style={{ marginHorizontal: 20, marginTop: 12, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#334155', alignItems: 'center' }}
                                onPress={() => setShowActionSheet(false)}
                            >
                                <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.slate400 }}>Cancel</Text>
                            </AnimatedPressable>
                        </View>
                    </View>
                </AnimatedPressable>
            </Modal>

            {/* Send Message Modal */}
            <Modal visible={showMessageModal} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <View>
                                <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.white }}>Send Message</Text>
                                <Text style={{ fontSize: 13, color: Colors.slate400, marginTop: 2 }}>To: {actionMember?.name}</Text>
                            </View>
                            <AnimatedPressable onPress={() => { setShowMessageModal(false); setMessageText(''); }}>
                                <MaterialIcons name="close" size={24} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>

                        <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5, marginBottom: 6 }}>MESSAGE</Text>
                        <TextInput
                            style={{ backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, paddingTop: 12, color: Colors.white, fontSize: 14, minHeight: 100, textAlignVertical: 'top' }}
                            value={messageText} onChangeText={setMessageText}
                            placeholder="Type your message here..." placeholderTextColor="#6b7280"
                            multiline numberOfLines={4}
                        />

                        <AnimatedPressable
                            style={{ backgroundColor: '#8b5cf6', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20, opacity: sendingMsg ? 0.6 : 1 }}
                            onPress={handleSendMessage} disabled={sendingMsg}
                        >
                            {sendingMsg ? <ActivityIndicator color={Colors.white} /> : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <MaterialIcons name="send" size={18} color={Colors.white} />
                                    <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '600' }}>Send Message</Text>
                                </View>
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
    header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderDark },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimaryDark },
    headerActions: { flexDirection: 'row', gap: 4 },
    iconBtn: { padding: 8, borderRadius: 999 },
    searchInput: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: Colors.white, fontSize: 14, marginBottom: 12 },
    statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    statBox: { flex: 1, padding: 12, borderRadius: 12 },
    statLabel: { fontSize: 12, fontWeight: '500', color: Colors.slate400, marginBottom: 4 },
    statValue: { fontSize: 24, fontWeight: '700', color: Colors.textPrimaryDark },
    filterRow: { marginBottom: 8 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999, marginRight: 8, backgroundColor: Colors.surfaceDark, borderWidth: 1, borderColor: Colors.borderDark },
    filterChipActive: { backgroundColor: Colors.primary, borderColor: 'transparent' },
    filterChipText: { fontSize: 14, fontWeight: '500', color: Colors.slate400 },
    filterChipTextActive: { color: Colors.white },
    list: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
    facultyCard: { backgroundColor: Colors.surfaceDark, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.borderDark },
    facultyCardOverloaded: { borderColor: 'rgba(239,68,68,0.3)' },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
    cardTopLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    avatarContainer: { position: 'relative' },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.slate700, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.borderDark },
    avatarOverloaded: { backgroundColor: '#ef4444' },
    avatarText: { color: Colors.white, fontWeight: '700', fontSize: 16 },
    statusDot: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: Colors.surfaceDark },
    facultyName: { fontSize: 16, fontWeight: '600', color: Colors.textPrimaryDark },
    facultyDept: { fontSize: 12, color: Colors.slate400, marginTop: 2 },
    badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    badgeBlue: { backgroundColor: 'rgba(59,130,246,0.15)' },
    badgePurple: { backgroundColor: 'rgba(168,85,247,0.15)' },
    badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
    badgeTextBlue: { color: '#93c5fd' },
    badgeTextPurple: { color: '#d8b4fe' },
    badgeRed: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(239,68,68,0.15)' },
    badgeTextRed: { color: '#ef4444', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
    loadSection: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(51,65,85,0.5)' },
    loadHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    loadLabel: { fontSize: 12, fontWeight: '500', color: Colors.slate400 },
    loadValue: { fontSize: 14, fontWeight: '700' },
    loadBar: { height: 8, backgroundColor: Colors.slate700, borderRadius: 4, overflow: 'hidden' },
    loadFill: { height: '100%', borderRadius: 4 }
});

export default FacultyHub;
