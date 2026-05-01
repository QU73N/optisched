import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    ActivityIndicator, Dimensions, Modal
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { AnimatedPressable } from '../../components/AnimatedPressable';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HOUR_HEIGHT = 72;
const START_HOUR = 7;
const END_HOUR = 21;
const TOTAL_HOURS = END_HOUR - START_HOUR;

const COLORS = [
    { bg: 'rgba(73,136,196,0.18)', border: '#4988C4', text: '#BDE8F5', solid: '#4988C4' },
    { bg: 'rgba(63,175,115,0.18)', border: '#3FAF73', text: '#6ee7b7', solid: '#3FAF73' },
    { bg: 'rgba(139,92,246,0.18)', border: '#8b5cf6', text: '#c4b5fd', solid: '#8b5cf6' },
    { bg: 'rgba(230,162,60,0.18)', border: '#E6A23C', text: '#fcd34d', solid: '#E6A23C' },
    { bg: 'rgba(236,72,153,0.18)', border: '#ec4899', text: '#f9a8d4', solid: '#ec4899' },
    { bg: 'rgba(6,182,212,0.18)', border: '#06b6d4', text: '#67e8f9', solid: '#06b6d4' },
    { bg: 'rgba(224,93,93,0.18)', border: '#E05D5D', text: '#fca5a5', solid: '#E05D5D' },
    { bg: 'rgba(34,211,238,0.18)', border: '#22d3ee', text: '#a5f3fc', solid: '#22d3ee' },
];

const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
    const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState(() => {
        const d = new Date().getDay();
        return d === 0 ? 0 : d - 1; // Mon=0, Tue=1, ..., Sat=5
    });
    const [selectedItem, setSelectedItem] = useState<typeof scheduleItems[0] | null>(null);

    // Fetch teacher schedules using profile_id → teacher_id (same as web)
    useEffect(() => {
        if (!profile?.id) return;

        const fetchSchedules = async () => {
            try {
                setLoading(true);
                // Step 1: Get teacher_id from profile_id
                const { data: teacher } = await supabase
                    .from('teachers')
                    .select('id')
                    .eq('profile_id', profile.id)
                    .single();

                if (!teacher) {
                    console.log('[TeacherSchedule] Teacher record not found for profile:', profile.id);
                    setLoading(false);
                    return;
                }

                // Step 2: Fetch all schedules for this teacher
                const { data, error } = await supabase
                    .from('schedules')
                    .select('id, day_of_week, start_time, end_time, subject:subjects(name, code), room:rooms(name, building), section:sections(name, program)')
                    .eq('teacher_id', teacher.id)
                    .eq('status', 'published')
                    .order('start_time', { ascending: true });

                if (error) {
                    console.error('[TeacherSchedule] Fetch error:', error);
                } else {
                    console.log('[TeacherSchedule] Fetched', data?.length || 0, 'schedules');
                    setSchedules((data as any[] || []).map((d: any) => ({
                        id: d.id,
                        day_of_week: d.day_of_week,
                        start_time: d.start_time,
                        end_time: d.end_time,
                        subject: Array.isArray(d.subject) ? d.subject[0] : d.subject,
                        room: Array.isArray(d.room) ? d.room[0] : d.room,
                        section: Array.isArray(d.section) ? d.section[0] : d.section,
                    })));
                }
            } catch (err) {
                console.error('[TeacherSchedule] Exception:', err);
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

    // Group by selected day
    const daySchedules = useMemo(() =>
        schedules
            .filter(s => s.day_of_week === dayOrder[selectedDay])
            .sort((a, b) => a.start_time.localeCompare(b.start_time)),
        [schedules, selectedDay]
    );

    // Count per day for badges
    const dayCounts = useMemo(() =>
        dayOrder.map(day => schedules.filter(s => s.day_of_week === day).length),
        [schedules]
    );

    const scheduleItems = useMemo(() =>
        daySchedules.map((s, i) => ({
            id: s.id,
            subject: (s.subject as any)?.name || 'Subject',
            code: (s.subject as any)?.code || '',
            room: (s.room as any)?.name || '',
            section: (s.section as any)?.name || '',
            startTime: s.start_time || '08:00',
            endTime: s.end_time || '09:00',
            color: COLORS[i % COLORS.length],
        })),
        [daySchedules]
    );

    const currentDayIdx = new Date().getDay();
    const isToday = currentDayIdx > 0 && currentDayIdx < 7 && selectedDay === currentDayIdx - 1;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const CONTENT_WIDTH = SCREEN_WIDTH - 56 - 20;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>My Schedule</Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            {schedules.length} classes this semester
                        </Text>
                    </View>
                    <View style={[styles.totalBadge, { backgroundColor: colors.isDark ? 'rgba(73,136,196,0.12)' : 'rgba(28,77,141,0.08)' }]}>
                        <Text style={[styles.totalNum, { color: colors.accentPrimary }]}>{schedules.length}</Text>
                        <Text style={[styles.totalLabel, { color: colors.accentPrimary }]}>total</Text>
                    </View>
                </View>

                {/* Day selector */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayStrip} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
                    {dayShort.map((day, index) => {
                        const isActive = selectedDay === index;
                        const count = dayCounts[index];
                        return (
                            <AnimatedPressable
                                key={day}
                                style={[
                                    styles.dayChip,
                                    { borderColor: isActive ? colors.accentPrimary : colors.border,
                                      backgroundColor: isActive ? (colors.isDark ? 'rgba(73,136,196,0.12)' : 'rgba(28,77,141,0.08)') : 'transparent' }
                                ]}
                                onPress={() => setSelectedDay(index)}
                            >
                                <Text style={[styles.dayChipText, { color: isActive ? colors.accentPrimary : colors.textSecondary }]}>{day}</Text>
                                {count > 0 && (
                                    <Text style={[styles.dayChipCount, { color: colors.textMuted }]}>{count}</Text>
                                )}
                            </AnimatedPressable>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Content */}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <View style={{ paddingTop: 80, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={colors.accentPrimary} />
                        <Text style={{ color: colors.textMuted, marginTop: 12 }}>Loading schedule...</Text>
                    </View>
                ) : scheduleItems.length === 0 ? (
                    <View style={{ paddingTop: 80, alignItems: 'center' }}>
                        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.isDark ? 'rgba(73,136,196,0.1)' : 'rgba(28,77,141,0.06)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                            <MaterialIcons name="event-available" size={40} color={colors.accentPrimary} />
                        </View>
                        <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 4 }}>No Classes</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 14 }}>No classes on {dayOrder[selectedDay]}</Text>
                    </View>
                ) : (
                    <View style={styles.timelineContainer}>
                        {/* Time axis */}
                        {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
                            const hour = START_HOUR + i;
                            const ampm = hour >= 12 ? 'PM' : 'AM';
                            const hr = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                            return (
                                <View key={i} style={[styles.timeRow, { top: i * HOUR_HEIGHT + 14 }]}>
                                    <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>{hr} {ampm}</Text>
                                    <View style={[styles.timeLine, { backgroundColor: colors.isDark ? 'rgba(51,65,85,0.6)' : 'rgba(0,0,0,0.06)' }]} />
                                </View>
                            );
                        })}

                        {/* Current time indicator */}
                        {isToday && currentMinutes >= START_HOUR * 60 && currentMinutes <= END_HOUR * 60 && (
                            <View style={[styles.nowLine, { top: ((currentMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT + 14 }]}>
                                <View style={styles.nowDot} />
                                <View style={styles.nowLineBar} />
                            </View>
                        )}

                        {/* Schedule blocks */}
                        {scheduleItems.map(item => {
                            const startMin = timeToMinutes(item.startTime) - START_HOUR * 60;
                            const endMin = timeToMinutes(item.endTime) - START_HOUR * 60;
                            const top = (startMin / 60) * HOUR_HEIGHT + 14;
                            const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT - 4, 56);
                            const isPast = isToday && timeToMinutes(item.endTime) < currentMinutes;
                            return (
                                <AnimatedPressable
                                    key={item.id}
                                    activeOpacity={0.8}
                                    onPress={() => setSelectedItem(item)}
                                    style={[styles.schedBlock, {
                                        top, height,
                                        backgroundColor: item.color.bg,
                                        borderLeftColor: item.color.border,
                                        opacity: isPast ? 0.5 : 1,
                                    }]}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.blockSubject, { color: item.color.text }]} numberOfLines={1}>{item.code} — {item.subject}</Text>
                                        </View>
                                        <View style={[styles.timeBadge, { backgroundColor: item.color.solid + '25' }]}>
                                            <Text style={{ fontSize: 9, fontWeight: '700', color: item.color.text }}>{formatTime(item.startTime)}</Text>
                                        </View>
                                    </View>
                                    {height > 55 && (
                                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                                            <View style={styles.meta}><MaterialIcons name="schedule" size={10} color={colors.textMuted} /><Text style={[styles.metaText, { color: colors.textMuted }]}>{formatTime(item.startTime)}-{formatTime(item.endTime)}</Text></View>
                                            <View style={styles.meta}><MaterialIcons name="meeting-room" size={10} color={colors.textMuted} /><Text style={[styles.metaText, { color: colors.textMuted }]}>{item.room}</Text></View>
                                        </View>
                                    )}
                                    {height > 75 && (
                                        <View style={[styles.meta, { marginTop: 2 }]}><MaterialIcons name="group" size={10} color={colors.textMuted} /><Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>{item.section}</Text></View>
                                    )}
                                </AnimatedPressable>
                            );
                        })}
                        <View style={{ height: TOTAL_HOURS * HOUR_HEIGHT + 80 }} />
                    </View>
                )}
            </ScrollView>

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
                                    {[
                                        { icon: 'schedule', label: 'TIME', value: `${formatTime(selectedItem.startTime)} — ${formatTime(selectedItem.endTime)}`, iconBg: 'rgba(99,102,241,0.12)', iconColor: '#818cf8' },
                                        { icon: 'meeting-room', label: 'ROOM', value: selectedItem.room || 'Not assigned', iconBg: 'rgba(63,175,115,0.12)', iconColor: '#34d399' },
                                        { icon: 'group', label: 'SECTION', value: selectedItem.section || 'Not assigned', iconBg: 'rgba(236,72,153,0.12)', iconColor: '#ec4899' },
                                        { icon: 'calendar-today', label: 'DAY', value: dayOrder[selectedDay], iconBg: 'rgba(230,162,60,0.12)', iconColor: '#E6A23C' },
                                    ].map((detail, i) => (
                                        <React.Fragment key={detail.label}>
                                            {i > 0 && <View style={{ height: 1, backgroundColor: colors.border }} />}
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: detail.iconBg, justifyContent: 'center', alignItems: 'center' }}>
                                                    <MaterialIcons name={detail.icon as any} size={18} color={detail.iconColor} />
                                                </View>
                                                <View>
                                                    <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', letterSpacing: 1 }}>{detail.label}</Text>
                                                    <Text style={{ fontSize: 15, color: colors.textPrimary, fontWeight: '600' }}>{detail.value}</Text>
                                                </View>
                                            </View>
                                        </React.Fragment>
                                    ))}
                                </View>
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
    header: { borderBottomWidth: 1 },
    headerTop: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4,
    },
    title: { fontSize: 22, fontWeight: '800' },
    subtitle: { fontSize: 13, marginTop: 2 },
    totalBadge: {
        borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8,
        alignItems: 'center', borderWidth: 1, borderColor: 'rgba(73,136,196,0.2)',
    },
    totalNum: { fontSize: 20, fontWeight: '800' },
    totalLabel: { fontSize: 10, fontWeight: '600' },

    dayStrip: { paddingVertical: 12 },
    dayChip: {
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
        borderWidth: 1, alignItems: 'center',
    },
    dayChipText: { fontSize: 13, fontWeight: '600' },
    dayChipCount: { fontSize: 10, marginTop: 2 },

    // Timeline
    timelineContainer: { paddingLeft: 56, paddingRight: 20, position: 'relative', paddingTop: 28, height: TOTAL_HOURS * HOUR_HEIGHT + 56 },
    timeRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', height: 20, overflow: 'visible' as any },
    timeLabel: { width: 48, textAlign: 'right', fontSize: 11, fontWeight: '600', paddingRight: 8 },
    timeLine: { flex: 1, height: 1 },
    nowLine: { position: 'absolute', left: 48, right: 0, flexDirection: 'row', alignItems: 'center', zIndex: 10 },
    nowDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E05D5D' },
    nowLineBar: { flex: 1, height: 2, backgroundColor: '#E05D5D' },

    schedBlock: {
        position: 'absolute', left: 56, right: 20, borderRadius: 12, borderLeftWidth: 3,
        paddingHorizontal: 12, paddingVertical: 10, overflow: 'hidden',
    },
    blockSubject: { fontSize: 14, fontWeight: '700' },
    timeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 11 },
});

export default TeacherSchedule;
