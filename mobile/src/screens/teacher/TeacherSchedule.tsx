import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    ActivityIndicator, Dimensions, Modal, Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

const SCREEN_WIDTH = Dimensions.get('window').width;

const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const daysFull = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CARD_COLORS = [
    { border: '#4988C4', bg: 'rgba(59,130,246,0.08)', text: '#60a5fa' },
    { border: '#3FAF73', bg: 'rgba(16,185,129,0.08)', text: '#34d399' },
    { border: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', text: '#a78bfa' },
    { border: '#E6A23C', bg: 'rgba(245,158,11,0.08)', text: '#fbbf24' },
    { border: '#ec4899', bg: 'rgba(236,72,153,0.08)', text: '#f472b6' },
    { border: '#06b6d4', bg: 'rgba(6,182,212,0.08)', text: '#22d3ee' },
];

interface ScheduleItem {
    id: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    subject: { name: string; code: string } | null;
    room: { name: string; building?: string } | null;
    section: { name: string; program?: string } | null;
}

const TeacherSchedule: React.FC = () => {
    const { profile } = useAuth();
    const { colors } = useTheme();
    const [now, setNow] = useState(() => new Date());
    const currentDayIdx = now.getDay();
    const defaultSelected = currentDayIdx > 0 && currentDayIdx < 7 ? currentDayIdx - 1 : 0;
    const [selectedDay, setSelectedDay] = useState(defaultSelected);
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [weekOffset, setWeekOffset] = useState(0);
    const [showDatePicker, setShowDatePicker] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            const fresh = new Date();
            if (fresh.getDate() !== now.getDate()) setNow(fresh);
        }, 60000);
        return () => clearInterval(interval);
    }, [now]);

    const getWeekDates = () => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + mondayOffset + (weekOffset * 7));
        return Array.from({ length: 6 }, (_, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            return d.getDate();
        });
    };
    const weekDates = getWeekDates();

    const currentMonth = (() => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + mondayOffset + (weekOffset * 7));
        return monday.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    })();

    const [allSchedules, setAllSchedules] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!profile?.id) return;

        const fetchSchedules = async () => {
            try {
                setLoading(true);
                const { data: teacher } = await supabase
                    .from('teachers')
                    .select('id')
                    .eq('profile_id', profile.id)
                    .single();

                if (!teacher) {
                    setAllSchedules([]);
                    setLoading(false);
                    return;
                }

                const { data, error } = await supabase
                    .from('schedules')
                    .select('id, day_of_week, start_time, end_time, subject:subjects(name, code), room:rooms(name, building), section:sections(name, program)')
                    .eq('teacher_id', teacher.id)
                    .eq('status', 'published');

                if (error) {
                    console.error('[TeacherSchedule] Fetch error:', error);
                    setAllSchedules([]);
                } else {
                    setAllSchedules(data as any[] || []);
                }
            } catch (err) {
                console.error('[TeacherSchedule] Exception:', err);
                setAllSchedules([]);
            } finally {
                setLoading(false);
            }
        };

        fetchSchedules();

        const channel = supabase
            .channel('teacher_schedule_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
                fetchSchedules();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [profile?.id]);

    const formatTime = (t: string | null) => {
        if (!t) return '';
        const [h, m] = t.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
        return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    const timeToMinutes = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    const schedules = useMemo(() =>
        allSchedules.filter(s => s.day_of_week === daysFull[selectedDay])
            .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')),
        [allSchedules, selectedDay]
    );

    const scheduleItems = useMemo(() => {
        return schedules.map((s, i) => ({
            id: s.id,
            index: i + 1,
            subject: s.subject?.name || 'Subject',
            code: s.subject?.code || '',
            room: s.room?.name || 'Not assigned',
            section: s.section?.name || 'Not assigned',
            startTime: s.start_time || '08:00',
            endTime: s.end_time || '09:00',
        }));
    }, [schedules]);

    const isToday = currentDayIdx > 0 && currentDayIdx < 7 && selectedDay === currentDayIdx - 1;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const scheduleRef = useRef<View>(null);

    const exportSchedule = async () => {
        try {
            if (!scheduleRef.current) return;
            const uri = await captureRef(scheduleRef.current, {
                format: 'png',
                quality: 1,
            });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'image/png',
                });
            } else {
                Alert.alert('Export', 'Sharing is not available on this device.');
            }
        } catch (e) {
            console.error('[TeacherSchedule] Export failed:', e);
            Alert.alert('Export Failed', 'Could not export schedule. Please try again.');
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={[styles.greeting, { color: colors.textPrimary }]}>My Schedule</Text>
                        <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{currentMonth} • {daysOfWeek[selectedDay]} • Today</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <AnimatedPressable onPress={exportSchedule} style={{ padding: 8, backgroundColor: colors.isDark ? 'rgba(73,136,196,0.15)' : 'rgba(28,77,141,0.08)', borderRadius: 8 }}>
                            <MaterialIcons name="share" size={20} color={colors.accentPrimary} />
                        </AnimatedPressable>
                        <AnimatedPressable onPress={() => {}} style={{ padding: 8, backgroundColor: colors.isDark ? 'rgba(73,136,196,0.15)' : 'rgba(28,77,141,0.08)', borderRadius: 8 }}>
                            <MaterialIcons name="menu" size={20} color={colors.accentPrimary} />
                        </AnimatedPressable>
                    </View>
                </View>

                {/* Select Date Button */}
                <AnimatedPressable onPress={() => setShowDatePicker(true)} style={[styles.selectDateBtn, { borderColor: colors.border, backgroundColor: colors.isDark ? 'rgba(73,136,196,0.1)' : 'rgba(28,77,141,0.05)' }]}>
                    <MaterialIcons name="calendar-month" size={18} color={colors.accentPrimary} />
                    <Text style={{ color: colors.accentPrimary, fontWeight: '600', marginLeft: 6 }}>Select Date</Text>
                </AnimatedPressable>

                {/* Calendar strip */}
                <View style={styles.calendarStrip}>
                    {daysOfWeek.map((day, index) => {
                        const isActive = selectedDay === index;
                        const isTodayItem = currentDayIdx > 0 && currentDayIdx < 7 && index === currentDayIdx - 1;
                        return (
                            <AnimatedPressable
                                key={day}
                                style={[
                                    styles.calDay,
                                    { backgroundColor: colors.isDark ? 'rgba(73,136,196,0.08)' : 'rgba(28,77,141,0.05)' },
                                    isActive && { backgroundColor: colors.accentPrimary }
                                ]}
                                onPress={() => setSelectedDay(index)}
                            >
                                <Text style={[styles.calDayLabel, { color: isActive ? '#fff' : colors.textMuted }]}>{day}</Text>
                                <Text style={[styles.calDate, { color: isActive ? '#fff' : colors.textPrimary }]}>{weekDates[index]}</Text>
                                {isTodayItem && !isActive && <View style={[styles.todayMarker, { backgroundColor: colors.accentPrimary }]} />}
                            </AnimatedPressable>
                        );
                    })}
                </View>

                {/* Stats pills */}
                <View style={styles.statsPills}>
                    <View style={[styles.statPill, { backgroundColor: colors.isDark ? 'rgba(73,136,196,0.12)' : 'rgba(28,77,141,0.08)' }]}>
                        <MaterialIcons name="wb-sunny" size={16} color={colors.accentPrimary} />
                        <Text style={[styles.statText, { color: colors.accentPrimary }]}>2 AM</Text>
                    </View>
                    <View style={[styles.statPill, { backgroundColor: colors.isDark ? 'rgba(73,136,196,0.12)' : 'rgba(28,77,141,0.08)' }]}>
                        <MaterialIcons name="nights-stay" size={16} color={colors.accentPrimary} />
                        <Text style={[styles.statText, { color: colors.accentPrimary }]}>1 PM</Text>
                    </View>
                    <View style={[styles.statPill, { backgroundColor: colors.isDark ? 'rgba(73,136,196,0.12)' : 'rgba(28,77,141,0.08)' }]}>
                        <MaterialIcons name="check-circle" size={16} color={colors.accentPrimary} />
                        <Text style={[styles.statText, { color: colors.accentPrimary }]}>{scheduleItems.length} Total</Text>
                    </View>
                </View>
            </View>

            {/* Content */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <View style={{ paddingTop: 80, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={colors.accentPrimary} />
                        <Text style={{ color: colors.textMuted, marginTop: 12 }}>Loading...</Text>
                    </View>
                ) : scheduleItems.length === 0 ? (
                    <View style={{ paddingTop: 80, alignItems: 'center' }}>
                        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.isDark ? 'rgba(73,136,196,0.1)' : 'rgba(28,77,141,0.06)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                            <MaterialIcons name="beach-access" size={40} color={colors.accentPrimary} />
                        </View>
                        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 4 }}>Free Day!</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 14 }}>No classes on {daysFull[selectedDay]}</Text>
                    </View>
                ) : (
                    <View style={{ padding: 16 }} ref={scheduleRef} collapsable={false}>
                        {scheduleItems.map((item, idx) => {
                            const cardColor = CARD_COLORS[idx % CARD_COLORS.length];
                            const startMin = timeToMinutes(item.startTime);
                            const endMin = timeToMinutes(item.endTime);
                            const isOngoing = isToday && currentMinutes >= startMin && currentMinutes < endMin;
                            const isDone = isToday && currentMinutes >= endMin;
                            return (
                                <AnimatedPressable
                                    key={item.id}
                                    onPress={() => setSelectedItem(item)}
                                    style={[
                                        styles.scheduleCard,
                                        {
                                            backgroundColor: isOngoing ? cardColor.bg : colors.surface,
                                            borderColor: isOngoing ? cardColor.border : colors.border,
                                            borderLeftColor: cardColor.border,
                                            borderLeftWidth: 4,
                                            opacity: isDone ? 0.6 : 1,
                                        }
                                    ]}
                                >
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <Text style={[styles.cardTitle, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>{item.subject}</Text>
                                            {isOngoing && (
                                                <View style={{ backgroundColor: cardColor.border + '25', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 }}>
                                                    <Text style={{ fontSize: 10, fontWeight: '700', color: cardColor.border }}>NOW</Text>
                                                </View>
                                            )}
                                            {isDone && (
                                                <View style={{ backgroundColor: 'rgba(148,163,184,0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 }}>
                                                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textMuted }}>DONE</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={[styles.cardCode, { color: cardColor.text }]}>{item.code} • {item.section}</Text>
                                        <View style={{ marginTop: 10, gap: 6 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <MaterialIcons name="schedule" size={13} color={colors.textMuted} />
                                                <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{formatTime(item.startTime)} – {formatTime(item.endTime)}</Text>
                                                <MaterialIcons name="meeting-room" size={13} color={colors.textMuted} />
                                                <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{item.room}</Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <MaterialIcons name="group" size={13} color={colors.textMuted} />
                                                <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{item.section}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={[styles.indexBadge, { backgroundColor: cardColor.border + '20' }]}>
                                        <Text style={[styles.indexText, { color: cardColor.border }]}>{item.index}</Text>
                                    </View>
                                </AnimatedPressable>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {/* Date Picker Modal */}
            <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
                <AnimatedPressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }} activeOpacity={1} onPress={() => setShowDatePicker(false)}>
                    <AnimatedPressable activeOpacity={1} style={{ backgroundColor: colors.elevated, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <AnimatedPressable onPress={() => setWeekOffset(w => w - 1)} style={{ padding: 8 }}>
                                <MaterialIcons name="chevron-left" size={24} color={colors.accentPrimary} />
                            </AnimatedPressable>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>{currentMonth}</Text>
                            <AnimatedPressable onPress={() => setWeekOffset(w => w + 1)} style={{ padding: 8 }}>
                                <MaterialIcons name="chevron-right" size={24} color={colors.accentPrimary} />
                            </AnimatedPressable>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 }}>
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                <Text key={d} style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, width: 40, textAlign: 'center' }}>{d}</Text>
                            ))}
                        </View>
                        <View style={{ gap: 12 }}>
                            {Array.from({ length: 5 }).map((_, week) => (
                                <View key={week} style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                                    {Array.from({ length: 7 }).map((_, day) => {
                                        const dateNum = week * 7 + day - 2;
                                        return (
                                            <AnimatedPressable
                                                key={`${week}-${day}`}
                                                style={{
                                                    width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
                                                    backgroundColor: dateNum === selectedDay + 4 ? colors.accentPrimary : 'transparent'
                                                }}
                                                onPress={() => { setSelectedDay(dateNum - 4); setShowDatePicker(false); }}
                                            >
                                                <Text style={{ color: dateNum === selectedDay + 4 ? '#fff' : colors.textPrimary, fontWeight: '600' }}>
                                                    {dateNum > 0 ? dateNum : ''}
                                                </Text>
                                            </AnimatedPressable>
                                        );
                                    })}
                                </View>
                            ))}
                        </View>
                        <AnimatedPressable onPress={() => setShowDatePicker(false)} style={{ marginTop: 16, paddingVertical: 12, alignItems: 'center' }}>
                            <Text style={{ color: colors.accentPrimary, fontWeight: '600' }}>Cancel</Text>
                        </AnimatedPressable>
                    </AnimatedPressable>
                </AnimatedPressable>
            </Modal>

            {/* Detail Modal */}
            <Modal visible={!!selectedItem} transparent animationType="fade" onRequestClose={() => setSelectedItem(null)}>
                <AnimatedPressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }} activeOpacity={1} onPress={() => setSelectedItem(null)}>
                    <AnimatedPressable activeOpacity={1} style={{ backgroundColor: colors.elevated, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border }}>
                        {selectedItem && (
                            <>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 }}>{selectedItem.subject}</Text>
                                        <Text style={{ fontSize: 14, color: colors.textSecondary }}>{selectedItem.code}</Text>
                                    </View>
                                    <AnimatedPressable onPress={() => setSelectedItem(null)} style={{ padding: 4 }}>
                                        <MaterialIcons name="close" size={22} color={colors.textSecondary} />
                                    </AnimatedPressable>
                                </View>

                                <View style={{ backgroundColor: colors.inset, borderRadius: 14, padding: 16, gap: 14 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(99,102,241,0.12)', justifyContent: 'center', alignItems: 'center' }}>
                                            <MaterialIcons name="schedule" size={18} color="#818cf8" />
                                        </View>
                                        <View>
                                            <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', letterSpacing: 1 }}>TIME</Text>
                                            <Text style={{ fontSize: 15, color: colors.textPrimary, fontWeight: '600' }}>{formatTime(selectedItem.startTime)} — {formatTime(selectedItem.endTime)}</Text>
                                        </View>
                                    </View>
                                    <View style={{ height: 1, backgroundColor: colors.border }} />
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.12)', justifyContent: 'center', alignItems: 'center' }}>
                                            <MaterialIcons name="meeting-room" size={18} color="#34d399" />
                                        </View>
                                        <View>
                                            <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', letterSpacing: 1 }}>ROOM</Text>
                                            <Text style={{ fontSize: 15, color: colors.textPrimary, fontWeight: '600' }}>{selectedItem.room || 'Not assigned'}</Text>
                                        </View>
                                    </View>
                                    <View style={{ height: 1, backgroundColor: colors.border }} />
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(236,72,153,0.12)', justifyContent: 'center', alignItems: 'center' }}>
                                            <MaterialIcons name="group" size={18} color="#ec4899" />
                                        </View>
                                        <View>
                                            <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', letterSpacing: 1 }}>SECTION</Text>
                                            <Text style={{ fontSize: 15, color: colors.textPrimary, fontWeight: '600' }}>{selectedItem.section || 'Not assigned'}</Text>
                                        </View>
                                    </View>
                                    <View style={{ height: 1, backgroundColor: colors.border }} />
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(245,158,11,0.12)', justifyContent: 'center', alignItems: 'center' }}>
                                            <MaterialIcons name="calendar-today" size={18} color="#E6A23C" />
                                        </View>
                                        <View>
                                            <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', letterSpacing: 1 }}>DAY</Text>
                                            <Text style={{ fontSize: 15, color: colors.textPrimary, fontWeight: '600' }}>{daysFull[selectedDay]}</Text>
                                        </View>
                                    </View>
                                </View>

                                <AnimatedPressable onPress={exportSchedule} style={{ marginTop: 16, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: colors.isDark ? 'rgba(73,136,196,0.15)' : 'rgba(28,77,141,0.08)', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <MaterialIcons name="share" size={18} color={colors.accentPrimary} />
                                    <Text style={{ color: colors.accentPrimary, fontWeight: '600' }}>Export Schedule</Text>
                                </AnimatedPressable>
                            </>
                        )}
                    </AnimatedPressable>
                </AnimatedPressable>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { borderBottomWidth: 1, paddingBottom: 12 },
    headerTop: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
        paddingHorizontal: 20, paddingTop: 16, marginBottom: 12
    },
    greeting: { fontSize: 22, fontWeight: '800' },
    headerSub: { fontSize: 12, marginTop: 2 },
    
    selectDateBtn: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingVertical: 8,
        marginHorizontal: 20, marginBottom: 12,
        borderRadius: 8, borderWidth: 1,
        width: 145, alignSelf: 'flex-start'
    },

    calendarStrip: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 6 },
    calDay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, minHeight: 70 },
    calDayActive: {},
    calDayLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4, textAlign: 'center', color: '#A9B4C2' },
    calDate: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
    todayMarker: { width: 5, height: 5, borderRadius: 2.5, marginTop: 6 },

    statsPills: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
    statPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
    statText: { fontSize: 12, fontWeight: '600' },

    scheduleCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        marginBottom: 12, paddingHorizontal: 16, paddingVertical: 14,
        borderRadius: 12, borderWidth: 1
    },
    cardTitle: { fontSize: 16, fontWeight: '700' },
    cardCode: { fontSize: 12, marginTop: 2 },
    cardMeta: { fontSize: 12 },
    indexBadge: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    indexText: { fontSize: 14, fontWeight: '700' }
});

export default TeacherSchedule;
