import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    ActivityIndicator, Dimensions, Modal
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useSchedules } from '../../hooks/useSupabase';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useCustomEvents } from '../../hooks/useCustomEvents';
import { AnimatedPressable } from '../../components/AnimatedPressable';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HOUR_HEIGHT = 72;
const START_HOUR = 7;
const END_HOUR = 18;
const TOTAL_HOURS = END_HOUR - START_HOUR;

const COLORS = [
    { bg: 'rgba(59,130,246,0.18)', border: '#3b82f6', text: '#93c5fd', solid: '#3b82f6' },
    { bg: 'rgba(16,185,129,0.18)', border: '#10b981', text: '#6ee7b7', solid: '#10b981' },
    { bg: 'rgba(139,92,246,0.18)', border: '#8b5cf6', text: '#c4b5fd', solid: '#8b5cf6' },
    { bg: 'rgba(245,158,11,0.18)', border: '#f59e0b', text: '#fcd34d', solid: '#f59e0b' },
    { bg: 'rgba(236,72,153,0.18)', border: '#ec4899', text: '#f9a8d4', solid: '#ec4899' },
    { bg: 'rgba(6,182,212,0.18)', border: '#06b6d4', text: '#67e8f9', solid: '#06b6d4' },
    { bg: 'rgba(239,68,68,0.18)', border: '#ef4444', text: '#fca5a5', solid: '#ef4444' },
    { bg: 'rgba(34,211,238,0.18)', border: '#22d3ee', text: '#a5f3fc', solid: '#22d3ee' },
];

const StudentSchedule: React.FC = () => {
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysFull = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const [now, setNow] = useState(() => new Date());
    const currentDayIdx = now.getDay();
    const defaultSelected = currentDayIdx > 0 && currentDayIdx < 7 ? currentDayIdx - 1 : 0;
    const [selectedDay, setSelectedDay] = useState(defaultSelected);
    const { profile, refreshProfile } = useAuth();
    const [selectedItem, setSelectedItem] = useState<typeof scheduleItems[0] | null>(null);
    const [weekOffset, setWeekOffset] = useState(0);

    // Force fresh profile on mount
    useEffect(() => { refreshProfile(); }, []);

    // Refresh "now" every time the screen comes into focus
    useEffect(() => {
        const interval = setInterval(() => {
            const fresh = new Date();
            if (fresh.getDate() !== now.getDate()) setNow(fresh);
        }, 60000); // check every minute
        return () => clearInterval(interval);
    }, [now]);

    const getWeekDates = () => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        // On Sunday (0), show the UPCOMING week (next Monday = +1)
        // On Mon-Sat, show the current week
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

    // Compute selected date as YYYY-MM-DD for event fetching
    const selectedDateStr = useMemo(() => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + mondayOffset + (weekOffset * 7));
        const sel = new Date(monday);
        sel.setDate(monday.getDate() + selectedDay);
        return sel.toISOString().split('T')[0];
    }, [selectedDay, weekOffset]);

    const { events: dayEvents } = useCustomEvents(selectedDateStr);
    const currentMonth = (() => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + mondayOffset + (weekOffset * 7));
        return monday.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    })();

    // Direct DB query for student's section — bypasses AuthContext cache
    const [mySection, setMySection] = useState<string | null>(null);
    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) return;
            const { data } = await supabase
                .from('profiles')
                .select('section')
                .eq('id', session.user.id)
                .single();
            console.log('[StudentSchedule] Fresh section from DB:', data?.section);
            setMySection(data?.section || null);
        })();
    }, []);

    // Fetch all published schedules for the selected day, then filter client-side
    const { schedules: rawSchedules, loading } = useSchedules({
        dayOfWeek: daysFull[selectedDay],
        status: 'published',
    });

    // Direct section name comparison using fresh DB section
    const schedules = useMemo(() => {
        const sectionToUse = mySection || profile?.section;
        if (!sectionToUse) return [];
        const normalize = (str: string) => str.toLowerCase().trim().replace(/[-\s]+/g, '');
        const normalizedSection = normalize(sectionToUse);
        return rawSchedules.filter(s => {
            const scheduleSectionName = s.section?.name || '';
            return normalize(scheduleSectionName) === normalizedSection;
        });
    }, [rawSchedules, profile?.section, mySection]);

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

    const scheduleItems = useMemo(() => {
        return schedules.map((s, i) => ({
            id: s.id,
            subject: s.subject?.name || 'Subject',
            code: s.subject?.code || '',
            room: s.room?.name || '',
            instructor: s.teacher?.profile?.full_name || '',
            startTime: s.start_time || '08:00',
            endTime: s.end_time || '09:00',
            color: COLORS[i % COLORS.length]
        }));
    }, [schedules]);

    // Compute overlap columns for timeline blocks
    const layoutItems = useMemo(() => {
        const sorted = [...scheduleItems].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        const columns: typeof sorted[] = [];
        const itemCol = new Map<string, { col: number; total: number }>();

        sorted.forEach(item => {
            const startA = timeToMinutes(item.startTime);
            let placed = false;
            for (let c = 0; c < columns.length; c++) {
                const lastInCol = columns[c][columns[c].length - 1];
                if (timeToMinutes(lastInCol.endTime) <= startA) {
                    columns[c].push(item);
                    itemCol.set(item.id, { col: c, total: 0 });
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                columns.push([item]);
                itemCol.set(item.id, { col: columns.length - 1, total: 0 });
            }
        });

        sorted.forEach(item => {
            const startA = timeToMinutes(item.startTime);
            const endA = timeToMinutes(item.endTime);
            let maxCols = 1;
            sorted.forEach(other => {
                if (other.id === item.id) return;
                const startB = timeToMinutes(other.startTime);
                const endB = timeToMinutes(other.endTime);
                if (startA < endB && endA > startB) maxCols++;
            });
            const entry = itemCol.get(item.id)!;
            entry.total = Math.max(maxCols, columns.length);
        });

        return { items: sorted, colMap: itemCol, totalCols: columns.length };
    }, [scheduleItems]);

    const isToday = currentDayIdx > 0 && currentDayIdx < 7 && selectedDay === currentDayIdx - 1;

    // Find next class
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const nextClass = isToday
        ? scheduleItems.find(s => timeToMinutes(s.startTime) > currentMinutes)
        : null;

    const { colors } = useTheme();
    const CONTENT_WIDTH = SCREEN_WIDTH - 56 - 20 - 48; // reserve 48px for event indicators

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <View>
                        <Text style={styles.greeting}>My Schedule</Text>
                        <Text style={styles.headerSub}>{currentMonth}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <AnimatedPressable onPress={() => setWeekOffset(w => w - 1)} style={{ padding: 6, backgroundColor: 'rgba(59,130,246,0.15)', borderRadius: 8 }}>
                            <MaterialIcons name="chevron-left" size={20} color="#60a5fa" />
                        </AnimatedPressable>
                        {weekOffset !== 0 && (
                            <AnimatedPressable onPress={() => setWeekOffset(0)} style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(59,130,246,0.15)', borderRadius: 8 }}>
                                <Text style={{ color: '#60a5fa', fontSize: 12, fontWeight: '600' }}>Today</Text>
                            </AnimatedPressable>
                        )}
                        <AnimatedPressable onPress={() => setWeekOffset(w => w + 1)} style={{ padding: 6, backgroundColor: 'rgba(59,130,246,0.15)', borderRadius: 8 }}>
                            <MaterialIcons name="chevron-right" size={20} color="#60a5fa" />
                        </AnimatedPressable>
                    </View>
                    <View style={styles.classCountBadge}>
                        <Text style={styles.classCountNum}>{scheduleItems.length}</Text>
                        <Text style={styles.classCountLabel}>classes</Text>
                    </View>
                </View>

                {/* Calendar strip */}
                <View style={styles.calendarStrip}>
                    {daysOfWeek.map((day, index) => {
                        const isActive = selectedDay === index;
                        const isTodayItem = currentDayIdx > 0 && currentDayIdx < 7 && index === currentDayIdx - 1;
                        return (
                            <AnimatedPressable
                                key={day}
                                style={[styles.calDay, isActive && styles.calDayActive]}
                                onPress={() => setSelectedDay(index)}
                            >
                                <Text style={[styles.calDayLabel, isActive && styles.calDayLabelActive]}>{day}</Text>
                                <View style={[styles.calDateCircle, isActive && styles.calDateCircleActive]}>
                                    <Text style={[styles.calDate, isActive && styles.calDateActive]}>{weekDates[index]}</Text>
                                </View>
                                {isTodayItem && !isActive && <View style={styles.todayMarker} />}
                            </AnimatedPressable>
                        );
                    })}
                </View>
            </View>

            {/* Next class banner */}
            {nextClass && (
                <View style={styles.nextClassBanner}>
                    <View style={styles.nextClassDot} />
                    <Text style={styles.nextClassLabel}>Next Up:</Text>
                    <Text style={styles.nextClassName} numberOfLines={1}>{nextClass.subject}</Text>
                    <Text style={styles.nextClassTime}>{formatTime(nextClass.startTime)}</Text>
                </View>
            )}

            {/* Content */}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <View style={{ paddingTop: 80, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={{ color: Colors.slate400, marginTop: 12 }}>Loading...</Text>
                    </View>
                ) : scheduleItems.length === 0 ? (
                    <View style={{ paddingTop: 80, alignItems: 'center' }}>
                        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(59,130,246,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                            <MaterialIcons name="beach-access" size={40} color="#60a5fa" />
                        </View>
                        <Text style={{ color: Colors.white, fontSize: 20, fontWeight: '700', marginBottom: 4 }}>Free Day!</Text>
                        <Text style={{ color: Colors.slate500, fontSize: 14 }}>No classes on {daysFull[selectedDay]}</Text>
                    </View>
                ) : (
                    <View style={styles.timelineContainer}>
                        {/* Time axis lines */}
                        {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
                            const hour = START_HOUR + i;
                            const ampm = hour >= 12 ? 'PM' : 'AM';
                            const hr = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                            return (
                                <View key={i} style={[styles.timeRow, { top: i * HOUR_HEIGHT + 14 }]}>
                                    <Text style={styles.timeLabel}>{hr} {ampm}</Text>
                                    <View style={styles.timeLine} />
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

                        {/* Schedule blocks — with overlap detection */}
                        {layoutItems.items.map(item => {
                            const startMin = timeToMinutes(item.startTime) - START_HOUR * 60;
                            const endMin = timeToMinutes(item.endTime) - START_HOUR * 60;
                            const top = (startMin / 60) * HOUR_HEIGHT + 14;
                            const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT - 4, 56);
                            const isPast = isToday && timeToMinutes(item.endTime) < currentMinutes;
                            const colInfo = layoutItems.colMap.get(item.id);
                            const col = colInfo?.col || 0;
                            const totalCols = colInfo?.total || 1;
                            const colWidth = CONTENT_WIDTH / totalCols;
                            const leftOffset = 56 + col * colWidth;
                            return (
                                <AnimatedPressable
                                    key={item.id}
                                    activeOpacity={0.8}
                                    onPress={() => setSelectedItem(item)}
                                    style={[styles.schedBlock, {
                                        top, height,
                                        left: leftOffset,
                                        width: colWidth - 4,
                                        right: undefined,
                                        backgroundColor: item.color.bg,
                                        borderLeftColor: item.color.border,
                                        opacity: isPast ? 0.5 : 1
                                    }]}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.blockSubject, { color: item.color.text }]} numberOfLines={1}>{item.subject}</Text>
                                            <Text style={styles.blockCode} numberOfLines={1}>{item.code}</Text>
                                        </View>
                                        {totalCols <= 2 && (
                                            <View style={[styles.timeBadge, { backgroundColor: item.color.solid + '25' }]}>
                                                <Text style={{ fontSize: 9, fontWeight: '700', color: item.color.text }}>{formatTime(item.startTime)}</Text>
                                            </View>
                                        )}
                                    </View>
                                    {height > 55 && (
                                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                                            <View style={styles.meta}><MaterialIcons name="schedule" size={10} color={Colors.slate500} /><Text style={styles.metaText}>{formatTime(item.startTime)}-{formatTime(item.endTime)}</Text></View>
                                            <View style={styles.meta}><MaterialIcons name="meeting-room" size={10} color={Colors.slate500} /><Text style={styles.metaText}>{item.room}</Text></View>
                                        </View>
                                    )}
                                    {height > 75 && (
                                        <View style={[styles.meta, { marginTop: 2 }]}><MaterialIcons name="person" size={10} color={Colors.slate500} /><Text style={styles.metaText} numberOfLines={1}>{item.instructor}</Text></View>
                                    )}
                                </AnimatedPressable>
                            );
                        })}

                        {/* Custom event indicators — right-edge markers */}
                        {dayEvents.filter(e => e.start_time && e.end_time).map(evt => {
                            const startMin = timeToMinutes(evt.start_time!) - START_HOUR * 60;
                            const endMin = timeToMinutes(evt.end_time!) - START_HOUR * 60;
                            if (startMin < 0 || endMin < 0) return null;
                            const top = (startMin / 60) * HOUR_HEIGHT + 14;
                            const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT - 4, 24);
                            return (
                                <View key={`evt-${evt.id}`} style={{
                                    position: 'absolute',
                                    top, height,
                                    right: 6,
                                    width: 38,
                                    backgroundColor: 'rgba(16,185,129,0.2)',
                                    borderLeftWidth: 2,
                                    borderLeftColor: '#10b981',
                                    borderRadius: 4,
                                    paddingHorizontal: 3,
                                    paddingVertical: 2,
                                    zIndex: 5,
                                    overflow: 'hidden',
                                }}>
                                    <Text style={{ color: '#34d399', fontSize: 7, fontWeight: '700' }} numberOfLines={2}>{evt.title}</Text>
                                </View>
                            );
                        })}
                        <View style={{ height: TOTAL_HOURS * HOUR_HEIGHT + 80 }} />
                    </View>
                )}
            </ScrollView>

            {/* Detail Modal */}
            <Modal visible={!!selectedItem} transparent animationType="fade" onRequestClose={() => setSelectedItem(null)}>
                <AnimatedPressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }} activeOpacity={1} onPress={() => setSelectedItem(null)}>
                    <AnimatedPressable activeOpacity={1} style={{ backgroundColor: '#1e293b', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#334155' }}>
                        {selectedItem && (
                            <>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.white, marginBottom: 4 }}>{selectedItem.subject}</Text>
                                        <Text style={{ fontSize: 14, color: Colors.slate400 }}>{selectedItem.code}</Text>
                                    </View>
                                    <AnimatedPressable onPress={() => setSelectedItem(null)} style={{ padding: 4 }}>
                                        <MaterialIcons name="close" size={22} color={Colors.slate400} />
                                    </AnimatedPressable>
                                </View>

                                <View style={{ backgroundColor: '#0f172a', borderRadius: 14, padding: 16, gap: 14 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(99,102,241,0.12)', justifyContent: 'center', alignItems: 'center' }}>
                                            <MaterialIcons name="schedule" size={18} color="#818cf8" />
                                        </View>
                                        <View>
                                            <Text style={{ fontSize: 11, color: Colors.slate500, fontWeight: '600', letterSpacing: 1 }}>TIME</Text>
                                            <Text style={{ fontSize: 15, color: Colors.white, fontWeight: '600' }}>{formatTime(selectedItem.startTime)} — {formatTime(selectedItem.endTime)}</Text>
                                        </View>
                                    </View>
                                    <View style={{ height: 1, backgroundColor: '#1e293b' }} />
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.12)', justifyContent: 'center', alignItems: 'center' }}>
                                            <MaterialIcons name="meeting-room" size={18} color="#34d399" />
                                        </View>
                                        <View>
                                            <Text style={{ fontSize: 11, color: Colors.slate500, fontWeight: '600', letterSpacing: 1 }}>ROOM</Text>
                                            <Text style={{ fontSize: 15, color: Colors.white, fontWeight: '600' }}>{selectedItem.room || 'Not assigned'}</Text>
                                        </View>
                                    </View>
                                    <View style={{ height: 1, backgroundColor: '#1e293b' }} />
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(236,72,153,0.12)', justifyContent: 'center', alignItems: 'center' }}>
                                            <MaterialIcons name="person" size={18} color="#ec4899" />
                                        </View>
                                        <View>
                                            <Text style={{ fontSize: 11, color: Colors.slate500, fontWeight: '600', letterSpacing: 1 }}>INSTRUCTOR</Text>
                                            <Text style={{ fontSize: 15, color: Colors.white, fontWeight: '600' }}>{selectedItem.instructor || 'Not assigned'}</Text>
                                        </View>
                                    </View>
                                    <View style={{ height: 1, backgroundColor: '#1e293b' }} />
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(245,158,11,0.12)', justifyContent: 'center', alignItems: 'center' }}>
                                            <MaterialIcons name="calendar-today" size={18} color="#f59e0b" />
                                        </View>
                                        <View>
                                            <Text style={{ fontSize: 11, color: Colors.slate500, fontWeight: '600', letterSpacing: 1 }}>DAY</Text>
                                            <Text style={{ fontSize: 15, color: Colors.white, fontWeight: '600' }}>{daysFull[selectedDay]}</Text>
                                        </View>
                                    </View>
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
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: { backgroundColor: '#0f172a', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    headerTop: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4
    },
    greeting: { fontSize: 22, fontWeight: '800', color: Colors.white },
    headerSub: { fontSize: 13, color: Colors.slate400, marginTop: 2 },
    classCountBadge: {
        backgroundColor: 'rgba(59,130,246,0.12)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8,
        alignItems: 'center', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)'
    },
    classCountNum: { fontSize: 20, fontWeight: '800', color: '#60a5fa' },
    classCountLabel: { fontSize: 10, color: '#60a5fa', fontWeight: '600' },

    calendarStrip: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12, gap: 4 },
    calDay: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 16 },
    calDayActive: {
        backgroundColor: 'rgba(59,130,246,0.12)'
    },
    calDayLabel: { fontSize: 11, color: Colors.slate500, fontWeight: '600', marginBottom: 6 },
    calDayLabelActive: { color: '#93c5fd' },
    calDateCircle: {
        width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center'
    },
    calDateCircleActive: { backgroundColor: Colors.primary },
    calDate: { fontSize: 16, fontWeight: '700', color: Colors.slate300 },
    calDateActive: { color: Colors.white },
    todayMarker: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#3b82f6', marginTop: 4 },

    nextClassBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginHorizontal: 20, marginTop: 8, marginBottom: 4,
        backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)'
    },
    nextClassDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
    nextClassLabel: { fontSize: 12, color: '#34d399', fontWeight: '600' },
    nextClassName: { flex: 1, fontSize: 13, color: Colors.white, fontWeight: '600' },
    nextClassTime: { fontSize: 12, color: '#6ee7b7', fontWeight: '700' },

    // Timeline
    timelineContainer: { paddingLeft: 56, paddingRight: 20, position: 'relative', paddingTop: 28, height: TOTAL_HOURS * HOUR_HEIGHT + 56 },
    timeRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', height: 20, overflow: 'visible' as any },
    timeLabel: { width: 48, textAlign: 'right', fontSize: 11, color: '#94a3b8', fontWeight: '600', paddingRight: 8 },
    timeLine: { flex: 1, height: 1, backgroundColor: 'rgba(51,65,85,0.6)' },
    nowLine: { position: 'absolute', left: 48, right: 0, flexDirection: 'row', alignItems: 'center', zIndex: 10 },
    nowDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' },
    nowLineBar: { flex: 1, height: 2, backgroundColor: '#ef4444' },

    schedBlock: {
        position: 'absolute', left: 56, right: 0, borderRadius: 12, borderLeftWidth: 3,
        paddingHorizontal: 12, paddingVertical: 10, overflow: 'hidden'
    },
    blockSubject: { fontSize: 14, fontWeight: '700' },
    blockCode: { fontSize: 11, color: Colors.slate500, marginTop: 1 },
    timeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 11, color: Colors.slate500 }
});

export default StudentSchedule;
