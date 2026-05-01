import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    ActivityIndicator, Dimensions, Modal, Pressable
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useSchedules } from '../../hooks/useSupabase';
import { supabase } from '../../config/supabase';
import { useRealtimeSchedules } from '../../hooks/useRealtime';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useCustomEvents } from '../../hooks/useCustomEvents';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

const SCREEN_WIDTH = Dimensions.get('window').width;
const HOUR_HEIGHT = 72;
const START_HOUR = 7;
const END_HOUR = 18;
const TOTAL_HOURS = END_HOUR - START_HOUR;

// Colors mapped dynamically inside the component

const ScheduleView: React.FC = () => {
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysFull = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const [now, setNow] = useState(() => new Date());
    const currentDayIdx = now.getDay();
    const defaultSelected = currentDayIdx > 0 && currentDayIdx < 7 ? currentDayIdx - 1 : 0;
    const [selectedDay, setSelectedDay] = useState(defaultSelected);
    const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');
    const [selectedItem, setSelectedItem] = useState<typeof scheduleItems[0] | null>(null);
    const [weekOffset, setWeekOffset] = useState(0);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [pickerMonthOffset, setPickerMonthOffset] = useState(0);
    const { colors } = useTheme();
    const scheduleRef = useRef<View>(null);

    const exportSchedule = async () => {
        try {
            if (!scheduleRef.current) return;
            const uri = await captureRef(scheduleRef.current, {
                format: 'png',
                quality: 1,
            });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            }
        } catch (e) {
            console.error('Export failed', e);
        }
    };

    // Refresh "now" every minute to keep dates current
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
        // On Sunday (0), show the UPCOMING week (next Monday = +1)
        // On Mon-Sat, show the current week
        const mondayOffset = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + mondayOffset + (weekOffset * 7));
        return Array.from({ length: 6 }, (_, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            return { date: d.getDate(), month: d.toLocaleString('default', { month: 'short' }) };
        });
    };
    const dates = getWeekDates();
    const currentMonth = (() => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;
        const monday = new Date(today);
        monday.setDate(today.getDate() + mondayOffset + (weekOffset * 7));
        return monday.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    })();

    // Compute selected date for event fetching
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
    const { profile, refreshProfile } = useAuth();
    const userRole = profile?.role || 'student';

    // Force fresh profile on mount — ensures section data is up to date
    useEffect(() => {
        refreshProfile();
    }, []);

    // Fetch ALL published schedules for the selected day (no server-side section filter)
    const { schedules: rawSchedules, loading, refetch } = useSchedules({
        dayOfWeek: daysFull[selectedDay],
        status: 'published',
    });
    useRealtimeSchedules(refetch);

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
            const sec = data?.section || null;
            console.log('[ScheduleView] Fresh section from DB:', sec);
            setMySection(sec);
        })();
    }, []);

    // Role-based section filtering (client-side for reliability)
    const schedules = useMemo(() => {
        if (userRole === 'admin') return rawSchedules; // Admins see all

        if (userRole === 'teacher' && profile?.full_name) {
            return rawSchedules.filter(s => {
                const teacherName = s.teacher?.profile?.full_name || '';
                return teacherName.toLowerCase() === profile.full_name!.toLowerCase();
            });
        }

        // Students: use directly-fetched section
        const sectionToUse = mySection || profile?.section;
        if (!sectionToUse) {
            console.log('[ScheduleView] No section found (neither fresh DB nor cached) — showing nothing');
            return [];
        }

        const normalize = (str: string) => str.toLowerCase().trim().replace(/[-\s]+/g, '');
        const normalizedMySection = normalize(sectionToUse);

        const filtered = rawSchedules.filter(s => {
            const scheduleSectionName = s.section?.name || '';
            return normalize(scheduleSectionName) === normalizedMySection;
        });

        console.log('[ScheduleView] Section filter:', {
            sectionSource: mySection ? 'DB' : 'AuthContext',
            section: sectionToUse,
            normalized: normalizedMySection,
            total: rawSchedules.length,
            matched: filtered.length,
            scheduleSections: rawSchedules.map(s => s.section?.name || `(null, id:${s.section_id})`),
        });

        return filtered;
    }, [rawSchedules, userRole, profile?.full_name, profile?.section, mySection]);

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
        const SCHEDULE_COLORS = [
            { bg: colors.isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)', border: '#818cf8', text: colors.isDark ? '#a5b4fc' : '#4338ca', solid: '#6366f1' },
            { bg: colors.isDark ? 'rgba(236,72,153,0.12)' : 'rgba(236,72,153,0.08)', border: '#ec4899', text: colors.isDark ? '#f9a8d4' : '#be185d', solid: '#ec4899' },
            { bg: colors.isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)', border: '#34d399', text: colors.isDark ? '#6ee7b7' : '#047857', solid: '#3FAF73' },
            { bg: colors.isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)', border: '#E6A23C', text: colors.isDark ? '#fcd34d' : '#b45309', solid: '#E6A23C' },
            { bg: colors.isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)', border: '#4988C4', text: colors.isDark ? '#BDE8F5' : '#1d4ed8', solid: '#4988C4' },
            { bg: colors.isDark ? 'rgba(168,85,247,0.12)' : 'rgba(168,85,247,0.08)', border: '#a855f7', text: colors.isDark ? '#c4b5fd' : '#7e22ce', solid: '#a855f7' },
            { bg: colors.isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)', border: '#E05D5D', text: colors.isDark ? '#fca5a5' : '#b91c1c', solid: '#E05D5D' },
            { bg: colors.isDark ? 'rgba(20,184,166,0.12)' : 'rgba(20,184,166,0.08)', border: '#14b8a6', text: colors.isDark ? '#5eead4' : '#0f766e', solid: '#14b8a6' },
        ];

        return schedules.map((s, i) => ({
            id: s.id,
            subject: s.subject?.name || 'Subject',
            code: s.subject?.code || '',
            section: s.section?.name || '',
            room: s.room?.name || '',
            instructor: s.teacher?.profile?.full_name || '',
            startTime: s.start_time || '08:00',
            endTime: s.end_time || '09:00',
            color: SCHEDULE_COLORS[i % SCHEDULE_COLORS.length]
        }));
    }, [schedules, colors.isDark]);

    // Compute overlap columns for timeline blocks
    const layoutItems = useMemo(() => {
        const sorted = [...scheduleItems].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
        const columns: typeof sorted[] = [];
        const itemCol = new Map<string, { col: number; total: number }>();

        sorted.forEach(item => {
            const startA = timeToMinutes(item.startTime);
            const endA = timeToMinutes(item.endTime);
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

        // For each item, find how many columns overlap with it at its time
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

    // Count classes by time period
    const morningCount = scheduleItems.filter(s => timeToMinutes(s.startTime) < 720).length;
    const afternoonCount = scheduleItems.filter(s => timeToMinutes(s.startTime) >= 720).length;

    const isToday = currentDayIdx > 0 && currentDayIdx < 7 && selectedDay === currentDayIdx - 1;

    // colors already extracted above where useTheme was placed originally, but I moved useTheme to top. Wait, let me make sure.

    const CONTENT_WIDTH = SCREEN_WIDTH - 56 - 20 - 48; // reserve 48px for event indicators

    const renderDatePicker = () => {
        const firstDay = new Date(now.getFullYear(), now.getMonth() + pickerMonthOffset, 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + pickerMonthOffset + 1, 0);
        const startingDayOfWeek = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        const days = [];
        for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
        for (let i = 1; i <= daysInMonth; i++) days.push(i);

        const monthName = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        return (
            <Modal visible={showDatePicker} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <View style={{ width: '100%', maxWidth: 360, backgroundColor: colors.elevated, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <AnimatedPressable onPress={() => setPickerMonthOffset(o => o - 1)} style={{ padding: 8 }}>
                                <MaterialIcons name="chevron-left" size={24} color={colors.textPrimary} />
                            </AnimatedPressable>
                            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>{monthName}</Text>
                            <AnimatedPressable onPress={() => setPickerMonthOffset(o => o + 1)} style={{ padding: 8 }}>
                                <MaterialIcons name="chevron-right" size={24} color={colors.textPrimary} />
                            </AnimatedPressable>
                        </View>

                        <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                                <Text key={d} style={{ flex: 1, textAlign: 'center', color: colors.textMuted, fontSize: 13, fontWeight: '600' }}>{d}</Text>
                            ))}
                        </View>

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                            {days.map((d, i) => (
                                <View key={i} style={{ width: '14.28%', aspectRatio: 1, padding: 2 }}>
                                    {d && (
                                        <AnimatedPressable
                                            style={{ flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: 'rgba(99,102,241,0.05)' }}
                                            onPress={() => {
                                                const selectedDate = new Date(firstDay.getFullYear(), firstDay.getMonth(), d);

                                                // Calculate weeks difference
                                                // First, find the "Monday" of the selected date's week
                                                const selDayOfWeek = selectedDate.getDay();
                                                const selMondayOffset = selDayOfWeek === 0 ? 1 : 1 - selDayOfWeek;
                                                const selMonday = new Date(selectedDate);
                                                selMonday.setDate(selectedDate.getDate() + selMondayOffset);
                                                selMonday.setHours(0, 0, 0, 0);

                                                const currDayOfWeek = now.getDay();
                                                const currMondayOffset = currDayOfWeek === 0 ? 1 : 1 - currDayOfWeek;
                                                const currMonday = new Date(now);
                                                currMonday.setDate(now.getDate() + currMondayOffset);
                                                currMonday.setHours(0, 0, 0, 0);

                                                const diffTime = selMonday.getTime() - currMonday.getTime();
                                                const diffWeeks = Math.round(diffTime / (1000 * 60 * 60 * 24 * 7));

                                                setWeekOffset(diffWeeks);

                                                // In OptiSched, 0=Mon, 5=Sat. If they click Sunday (0), we snap to Monday.
                                                let targetDay = selDayOfWeek === 0 ? 0 : selDayOfWeek - 1;
                                                setSelectedDay(targetDay);

                                                setShowDatePicker(false);
                                                // reset for next time they open
                                                setTimeout(() => setPickerMonthOffset(0), 300);
                                            }}
                                        >
                                            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500' }}>{d}</Text>
                                        </AnimatedPressable>
                                    )}
                                </View>
                            ))}
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
                            <AnimatedPressable onPress={() => { setShowDatePicker(false); setPickerMonthOffset(0); }} style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }}>
                                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                            </AnimatedPressable>
                        </View>
                    </View>
                </View>
            </Modal>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <View style={styles.headerTop}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>My Schedule</Text>
                        <Text style={[styles.headerSub, { color: colors.textMuted }]} numberOfLines={1}>{currentMonth} • {daysFull[selectedDay]}{isToday ? ' • Today' : ''}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <AnimatedPressable onPress={exportSchedule} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.borderSubtle }}>
                            <MaterialIcons name="share" size={18} color={colors.textSecondary} />
                        </AnimatedPressable>
                        <AnimatedPressable onPress={() => setViewMode(v => v === 'timeline' ? 'list' : 'timeline')} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.borderSubtle }}>
                            <MaterialIcons name={viewMode === 'timeline' ? 'view-list' : 'view-agenda'} size={18} color={colors.textSecondary} />
                        </AnimatedPressable>
                    </View>
                </View>

                {/* Week Navigation */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 }}>
                    <AnimatedPressable onPress={() => setShowDatePicker(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1, borderColor: colors.borderSubtle }}>
                        <MaterialIcons name="calendar-month" size={16} color={colors.accentPrimary} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textPrimary }}>Select Date</Text>
                    </AnimatedPressable>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <AnimatedPressable onPress={() => setWeekOffset(w => w - 1)} style={{ padding: 4, backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: 8 }}>
                            <MaterialIcons name="chevron-left" size={20} color="#818cf8" />
                        </AnimatedPressable>
                        {weekOffset !== 0 && (
                            <AnimatedPressable onPress={() => setWeekOffset(0)} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: 8 }}>
                                <Text style={{ color: '#818cf8', fontSize: 11, fontWeight: '700' }}>Today</Text>
                            </AnimatedPressable>
                        )}
                        <AnimatedPressable onPress={() => setWeekOffset(w => w + 1)} style={{ padding: 4, backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: 8 }}>
                            <MaterialIcons name="chevron-right" size={20} color="#818cf8" />
                        </AnimatedPressable>
                    </View>
                </View>

                <View style={styles.calendarStrip}>
                    {daysOfWeek.map((day, index) => {
                        const isActive = selectedDay === index;
                        const isTodayItem = currentDayIdx > 0 && currentDayIdx < 7 && index === currentDayIdx - 1;
                        return (
                            <Pressable
                                key={day}
                                style={[styles.calendarDay, isActive && styles.calendarDayActive]}
                                onPress={() => setSelectedDay(index)}
                            >
                                <Text style={[styles.calendarDayLabel, { color: colors.textMuted }, isActive && styles.calendarDayLabelActive]}>{day}</Text>
                                <Text style={[styles.calendarDate, { color: colors.textSecondary }, isActive && styles.calendarDateActive]}>{dates[index].date}</Text>
                                {isTodayItem && !isActive && <View style={styles.todayDot} />}
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            <View style={styles.summaryRow}>
                <View style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                    <MaterialIcons name="wb-sunny" size={14} color="#fbbf24" />
                    <Text style={[styles.summaryText, { color: colors.textSecondary }]}>{morningCount} AM</Text>
                </View>
                <View style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                    <MaterialIcons name="nights-stay" size={14} color="#818cf8" />
                    <Text style={[styles.summaryText, { color: colors.textSecondary }]}>{afternoonCount} PM</Text>
                </View>
                <View style={[styles.summaryChip, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                    <MaterialIcons name="school" size={14} color="#34d399" />
                    <Text style={[styles.summaryText, { color: colors.textSecondary }]}>{scheduleItems.length} Total</Text>
                </View>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                <View ref={scheduleRef} collapsable={false} style={{ flex: 1, backgroundColor: colors.background, paddingBottom: 24 }}>
                {loading ? (
                    <View style={{ paddingTop: 80, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 14 }}>Loading schedule...</Text>
                    </View>
                ) : scheduleItems.length === 0 ? (
                    <View style={{ paddingTop: 80, alignItems: 'center' }}>
                        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(99,102,241,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                            <MaterialIcons name="event-available" size={36} color="#818cf8" />
                        </View>
                        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '600', marginBottom: 4 }}>No Classes</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 14 }}>You're free on {daysFull[selectedDay]}!</Text>
                    </View>
                ) : viewMode === 'timeline' ? (
                    <View style={styles.timelineContainer}>
                        {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
                            const hour = START_HOUR + i;
                            const ampm = hour >= 12 ? 'PM' : 'AM';
                            const hr = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                            return (
                                <View key={i} style={[styles.timeRow, { top: i * HOUR_HEIGHT + 14 }]}>
                                    <Text style={[styles.timeLabel, { color: colors.textSecondary }]}>{hr} {ampm}</Text>
                                    <View style={styles.timeLine} />
                                </View>
                            );
                        })}

                        {layoutItems.items.map(item => {
                            const startMin = timeToMinutes(item.startTime) - START_HOUR * 60;
                            const endMin = timeToMinutes(item.endTime) - START_HOUR * 60;
                            const top = (startMin / 60) * HOUR_HEIGHT + 14;
                            const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT - 4, 56);
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
                                    style={[styles.timeBlock, {
                                        top, height,
                                        left: leftOffset,
                                        width: colWidth - 4,
                                        right: undefined,
                                        backgroundColor: colors.surface,
                                        borderColor: colors.borderSubtle,
                                        borderWidth: 1,
                                        borderLeftWidth: 3,
                                        borderLeftColor: item.color.solid
                                    }]}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.blockSubject, { color: colors.textPrimary }]} numberOfLines={1}>{item.subject}</Text>
                                            <Text style={[styles.blockCode, { color: colors.textSecondary }]} numberOfLines={1}>{item.code}{item.section ? ` • ${item.section}` : ''}</Text>
                                        </View>
                                        {totalCols <= 2 && (
                                            <View style={[styles.timeBadge, { backgroundColor: item.color.solid + '15' }]}>
                                                <Text style={{ fontSize: 9, fontWeight: '700', color: item.color.solid }}>{formatTime(item.startTime)}</Text>
                                            </View>
                                        )}
                                    </View>
                                    {height > 55 && (
                                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                                            <View style={styles.blockMeta}><MaterialIcons name="schedule" size={10} color={colors.textMuted} /><Text style={[styles.blockMetaText, { color: colors.textSecondary }]}>{formatTime(item.startTime)}-{formatTime(item.endTime)}</Text></View>
                                            <View style={styles.blockMeta}><MaterialIcons name="meeting-room" size={10} color={colors.textMuted} /><Text style={[styles.blockMetaText, { color: colors.textSecondary }]}>{item.room}</Text></View>
                                        </View>
                                    )}
                                    {height > 75 && (
                                        <View style={[styles.blockMeta, { marginTop: 2 }]}><MaterialIcons name="person" size={10} color={colors.textMuted} /><Text style={[styles.blockMetaText, { color: colors.textSecondary }]} numberOfLines={1}>{item.instructor}</Text></View>
                                    )}
                                </AnimatedPressable>
                            );
                        })}

                        {dayEvents.filter(e => e.start_time && e.end_time).map(evt => {
                            const startMin = timeToMinutes(evt.start_time!) - START_HOUR * 60;
                            const endMin = timeToMinutes(evt.end_time!) - START_HOUR * 60;
                            if (startMin < 0 || endMin < 0) return null;
                            const top = (startMin / 60) * HOUR_HEIGHT + 14;
                            const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT - 4, 40);
                            return (
                                <View key={`evt-${evt.id}`} style={{
                                    position: 'absolute',
                                    top, height,
                                    left: 56,
                                    right: 0,
                                    backgroundColor: 'rgba(16,185,129,0.12)',
                                    borderLeftWidth: 3,
                                    borderLeftColor: '#3FAF73',
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: 'rgba(16,185,129,0.25)',
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    zIndex: 2,
                                    overflow: 'hidden',
                                }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: '#34d399', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{evt.title}</Text>
                                            {evt.description ? <Text style={{ color: '#6ee7b7', fontSize: 10, marginTop: 2 }} numberOfLines={1}>{evt.description}</Text> : null}
                                        </View>
                                        <View style={{ backgroundColor: 'rgba(16,185,129,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                            <Text style={{ color: '#34d399', fontSize: 8, fontWeight: '800', letterSpacing: 0.5 }}>EVENT</Text>
                                        </View>
                                    </View>
                                    {height > 50 && (
                                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                                <MaterialIcons name="schedule" size={10} color="#6ee7b799" />
                                                <Text style={{ fontSize: 10, color: '#6ee7b799' }}>{evt.start_time?.slice(0, 5)} - {evt.end_time?.slice(0, 5)}</Text>
                                            </View>
                                            {evt.room ? (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                                    <MaterialIcons name="meeting-room" size={10} color="#6ee7b799" />
                                                    <Text style={{ fontSize: 10, color: '#6ee7b799' }}>{evt.room}</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                        <View style={{ height: TOTAL_HOURS * HOUR_HEIGHT + 80 }} />
                    </View>
                ) : (
                    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
                        {scheduleItems
                            .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
                            .map((item, i) => (
                                <AnimatedPressable key={item.id} activeOpacity={0.8} onPress={() => setSelectedItem(item)} style={[styles.listCard, { borderLeftColor: item.color.border, backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 }}>{item.subject}</Text>
                                            <Text style={{ fontSize: 12, color: colors.textMuted }}>{item.code} • {item.section}</Text>
                                        </View>
                                        <View style={[styles.orderBadge, { backgroundColor: item.color.bg }]}>
                                            <Text style={{ fontSize: 12, fontWeight: '800', color: item.color.text }}>{i + 1}</Text>
                                        </View>
                                    </View>
                                    <View style={[styles.listCardDivider, { backgroundColor: colors.borderSubtle }]} />
                                    <View style={{ flexDirection: 'row', gap: 16 }}>
                                        <View style={styles.blockMeta}><MaterialIcons name="schedule" size={13} color={item.color.solid} /><Text style={styles.listMetaText}>{formatTime(item.startTime)} - {formatTime(item.endTime)}</Text></View>
                                        <View style={styles.blockMeta}><MaterialIcons name="meeting-room" size={13} color={item.color.solid} /><Text style={styles.listMetaText}>{item.room}</Text></View>
                                    </View>
                                    <View style={[styles.blockMeta, { marginTop: 4 }]}><MaterialIcons name="person" size={13} color={item.color.solid} /><Text style={styles.listMetaText}>{item.instructor}</Text></View>
                                </AnimatedPressable>
                            ))}
                        <View style={{ height: 100 }} />
                    </View>
                )}
                </View>
            </ScrollView>

            <Modal visible={!!selectedItem} transparent animationType="fade" onRequestClose={() => setSelectedItem(null)}>
                <AnimatedPressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }} activeOpacity={1} onPress={() => setSelectedItem(null)}>
                    <AnimatedPressable activeOpacity={1} style={{ backgroundColor: colors.elevated, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: colors.border }}>
                        {selectedItem && (
                            <>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 }}>{selectedItem.subject}</Text>
                                        <Text style={{ fontSize: 14, color: colors.textMuted }}>{selectedItem.code}{selectedItem.section ? ` • ${selectedItem.section}` : ''}</Text>
                                    </View>
                                    <AnimatedPressable onPress={() => setSelectedItem(null)} style={{ padding: 4 }}>
                                        <MaterialIcons name="close" size={22} color={colors.textMuted} />
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
                                            <MaterialIcons name="person" size={18} color="#ec4899" />
                                        </View>
                                        <View>
                                            <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', letterSpacing: 1 }}>INSTRUCTOR</Text>
                                            <Text style={{ fontSize: 15, color: colors.textPrimary, fontWeight: '600' }}>{selectedItem.instructor || 'Not assigned'}</Text>
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
                            </>
                        )}
                    </AnimatedPressable>
                </AnimatedPressable>
            </Modal>
            {renderDatePicker()}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { borderBottomWidth: 1 },
    headerTop: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4
    },
    headerTitle: { fontSize: 22, fontWeight: '800' },
    headerSub: { fontSize: 13, marginTop: 2 },
    viewToggle: {
        width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
        borderWidth: 1
    },
    viewToggleActive: { borderColor: '#818cf8', backgroundColor: 'rgba(99,102,241,0.1)' },

    calendarStrip: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 12, gap: 4 },
    calendarDay: {
        flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14,
        backgroundColor: 'transparent'
    },
    calendarDayActive: {
        backgroundColor: Colors.primary,
        shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 4
    },
    calendarDayLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
    calendarDayLabelActive: { color: '#BDE8F5' },
    calendarDate: { fontSize: 18, fontWeight: '700' },
    calendarDateActive: { color: '#ffffff' },
    todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primary, marginTop: 4 },

    summaryRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
    summaryChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
        borderWidth: 1
    },
    summaryText: { fontSize: 12, fontWeight: '600' },

    // Timeline
    timelineContainer: { paddingLeft: 56, paddingRight: 20, position: 'relative', paddingTop: 28, height: TOTAL_HOURS * HOUR_HEIGHT + 56 },
    timeRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', height: 20, overflow: 'visible' as any },
    timeLabel: { width: 48, textAlign: 'right', fontSize: 11, fontWeight: '600', paddingRight: 8 },
    timeLine: { flex: 1, height: 1, backgroundColor: 'rgba(51,65,85,0.3)' },
    timeBlock: {
        position: 'absolute', left: 56, right: 0, borderRadius: 12, borderLeftWidth: 3,
        paddingHorizontal: 12, paddingVertical: 10, overflow: 'hidden'
    },
    blockSubject: { fontSize: 14, fontWeight: '700' },
    blockCode: { fontSize: 11, marginTop: 1 },
    timeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    blockMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    blockMetaText: { fontSize: 11 },

    // List
    listCard: {
        borderRadius: 16, padding: 16, marginBottom: 10,
        borderLeftWidth: 4, borderWidth: 1
    },
    listCardDivider: { height: 1, marginVertical: 10 },
    listMetaText: { fontSize: 12, fontWeight: '500' },
    orderBadge: {
        width: 30, height: 30, borderRadius: 10, justifyContent: 'center', alignItems: 'center'
    }
});

export default ScheduleView;
