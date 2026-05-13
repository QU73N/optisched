import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    ActivityIndicator, Modal
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import { formatTime } from '../../utils/helpers';
import { useAnnouncements } from '../../hooks/useSupabase';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCustomEvents } from '../../hooks/useCustomEvents';
import { getCachedData } from '../../utils/localCache';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { useTheme } from '../../contexts/ThemeContext';
import { StaggeredView } from '../../components/StaggeredView';
import { StatCard, SectionHeader, ClassCard, AnnouncementItem, EventItem } from '../../components/DashCard';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

const StudentDashboard: React.FC = () => {
    const { profile, refreshProfile } = useAuth();
    const navigation = useNavigation<any>();
    const { colors } = useTheme();

    // Force fresh profile on mount
    useEffect(() => { refreshProfile(); }, []);

    // Direct DB query for student's section — bypasses AuthContext cache
    const [mySection, setMySection] = useState<string | null>(null);
    useEffect(() => {
        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) return;
            const { data, error } = await supabase
                .from('profiles')
                .select('section')
                .eq('id', session.user.id)
                .single();

            if (error) {
                // Network error offline — attempt to load from AuthContext cache
                const cachedProfile = await getCachedData<any>(`profile_${session.user.id}`);
                if (cachedProfile.data?.section) {
                    console.log('[StudentDashboard] Loaded offline section:', cachedProfile.data.section);
                    setMySection(cachedProfile.data.section);
                }
                return;
            }

            console.log('[StudentDashboard] Fresh section from DB:', data?.section);
            setMySection(data?.section || null);
        })();
    }, []);

    // Determine today's day of week — on Sunday show Monday (next school day)
    const dayIndex = new Date().getDay();
    const isOffDay = dayIndex === 0; // Sunday
    const scheduleDayName = isOffDay ? 'Monday' : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex];
    const tomorrowDayIndex = (dayIndex + 1) % 7;
    const tomorrowDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][tomorrowDayIndex];

    // Fetch schedules using section_id lookup (same pattern as web)
    const [schedules, setSchedules] = useState<any[]>([]);
    const [tomorrowSchedules, setTomorrowSchedules] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSchedules = async () => {
            try {
                setLoading(true);
                const sectionName = mySection || profile?.section;
                console.log('[StudentDashboard] Section name from profile:', sectionName);
                if (!sectionName) { 
                    console.log('[StudentDashboard] No section name found — skipping fetch');
                    setLoading(false); 
                    return; 
                }

                // Use RPC function to bypass RLS (same as web dashboard)
                const { data: rpcData, error: rpcError } = await supabase.rpc('get_schedules_with_details');
                if (rpcError) {
                    console.error('[StudentDashboard] RPC error:', rpcError);
                    setLoading(false);
                    return;
                }

                // Filter client-side: section + day + published
                const normalizedSection = sectionName.toLowerCase();
                
                const processSchedules = (dayName: string) => (rpcData || [])
                    .filter((s: any) => 
                        s.status === 'published' &&
                        (s.section_name || '').toLowerCase() === normalizedSection &&
                        s.day_of_week === dayName
                    )
                    .map((s: any) => ({
                        id: s.id,
                        day_of_week: s.day_of_week,
                        start_time: s.start_time,
                        end_time: s.end_time,
                        status: s.status,
                        subject: { name: s.subject_name, code: s.subject_code },
                        teacher: { profile: { full_name: s.teacher_name } },
                        room: { name: s.room_name, building: s.room_building },
                        section: { name: s.section_name, program: s.section_program },
                    }))
                    .sort((a: any, b: any) => (a.start_time || '').localeCompare(b.start_time || ''));

                const filteredToday = processSchedules(scheduleDayName);
                const filteredTomorrow = processSchedules(tomorrowDayName);

                console.log('[StudentDashboard] Fetched', filteredToday.length, 'schedules for section', sectionName, 'on', scheduleDayName);
                setSchedules(filteredToday);
                setTomorrowSchedules(filteredTomorrow);
            } catch (err) {
                console.error('[StudentDashboard] Exception:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchSchedules();

        // Realtime subscription for schedule changes
        const channel = supabase
            .channel('student_dashboard_schedules')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
                fetchSchedules();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [mySection, profile?.section, scheduleDayName, tomorrowDayName]);

    const { announcements: allAnnouncements } = useAnnouncements();

    // Filter announcements for this student's section
    const announcements = useMemo(() => {
        if (!allAnnouncements) return [];
        const mySection = profile?.section?.toLowerCase().trim();
        return allAnnouncements.filter((a: any) => {
            // 1. Check target_section field (new reliable method)
            if (a.target_section) {
                const target = a.target_section.toLowerCase().trim();
                if (target === 'all sections') return true;
                if (!mySection) return true; // No section assigned to student, show all
                return target === mySection;
            }
            // 2. Fallback: parse title prefix for older announcements
            const title = a.title || '';
            if (title.startsWith('[All Sections]')) return true;
            if (!title.startsWith('[')) return true; // No section prefix = visible to all
            const sectionMatch = title.match(/^\[([^\]]+)\]/);
            if (sectionMatch && mySection) {
                return sectionMatch[1].toLowerCase().trim() === mySection;
            }
            return true;
        });
    }, [allAnnouncements, profile?.section]);

    const { events: upcomingEvents } = useCustomEvents(undefined, true);
    const [showAnnouncements, setShowAnnouncements] = useState(false);
    const todayRef = useRef<View>(null);

    const exportToday = async () => {
        try {
            if (!todayRef.current) return;
            const uri = await captureRef(todayRef.current, {
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
    const [currentTime, setCurrentTime] = useState(() => new Date());

    // Real-time clock: update every 30 seconds for progress
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    const priorityConfig: Record<string, { color: string; bg: string; icon: string; label: string }> = {
        urgent: { color: '#E05D5D', bg: 'rgba(239,68,68,0.12)', icon: 'error', label: 'URGENT' },
        important: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', icon: 'warning', label: 'IMPORTANT' },
        normal: { color: '#4988C4', bg: 'rgba(59,130,246,0.12)', icon: 'info', label: 'INFO' }
    };

    // Build today's schedule with status — matches web pattern
    const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
        finished: { bg: 'rgba(148,163,184,0.1)', text: '#94a3b8', label: 'Done' },
        ongoing: { bg: 'rgba(16,185,129,0.15)', text: '#10b981', label: 'Now' },
        upcoming: { bg: 'rgba(59,130,246,0.1)', text: '#60a5fa', label: 'Next' }
    };

    const subjectColorList = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

    const todaySchedule = useMemo(() => {
        if (schedules.length === 0) return [];
        const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

        return schedules.map((s, i) => {
            const [startH, startM] = (s.start_time || '00:00').split(':').map(Number);
            const [endH, endM] = (s.end_time || '00:00').split(':').map(Number);
            const startMin = startH * 60 + startM;
            const endMin = endH * 60 + endM;

            let status: 'finished' | 'ongoing' | 'upcoming' = 'upcoming';
            let progress = 0;
            if (!isOffDay) {
                if (currentMinutes >= endMin) {
                    status = 'finished';
                    progress = 100;
                } else if (currentMinutes >= startMin && currentMinutes < endMin) {
                    status = 'ongoing';
                    const elapsed = currentMinutes - startMin;
                    const total = endMin - startMin;
                    progress = total > 0 ? Math.round((elapsed / total) * 100) : 0;
                }
            }

            const fmt = (h: number, m: number) => {
                const ampm = h >= 12 ? 'PM' : 'AM';
                const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
                return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
            };

            return {
                id: s.id,
                subject: s.subject?.name || 'Unknown',
                teacher: s.teacher?.profile?.full_name || 'TBA',
                room: s.room?.name || 'TBA',
                time: `${fmt(startH, startM)} – ${fmt(endH, endM)}`,
                status, progress,
                color: subjectColorList[i % subjectColorList.length]
            };
        });
    }, [schedules, currentTime, isOffDay]);

    const ongoingClass = todaySchedule.find(s => s.status === 'ongoing');
    const nextClass = todaySchedule.find(s => s.status === 'upcoming');
    const firstName = profile?.full_name?.split(' ')[0] || profile?.full_name?.split(',')[0] || 'Student';
    const todayStr = new Date().toISOString().split('T')[0];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* ─── Greeting bar (matches web .dash-greeting) ─── */}
            <View style={[styles.greetingBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                    <View style={styles.greetingTitleRow}>
                        {ongoingClass && <View style={styles.liveDot} />}
                        <Text style={[styles.greetingTitle, { color: colors.textPrimary }]}>
                            {ongoingClass ? 'In Class Now' : `Welcome back, ${firstName}`}
                        </Text>
                    </View>
                    <Text style={[styles.greetingSub, { color: colors.textMuted }]}>
                        {ongoingClass
                            ? `${ongoingClass.subject} with ${ongoingClass.teacher} in ${ongoingClass.room}`
                            : nextClass
                                ? `Next class: ${nextClass.subject} at ${nextClass.time.split('–')[0].trim()}`
                                : profile?.section ? `Section ${profile.section}` : 'Your daily schedule overview'}
                    </Text>
                </View>
                <View style={[styles.dayBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.dayBadgeText, { color: colors.textSecondary }]}>
                        {isOffDay ? 'Tomorrow: Mon' : scheduleDayName.slice(0, 3)}
                    </Text>
                </View>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* ─── Single Hero Summary Card ─── */}
                <StaggeredView delay={60}>
                    <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.summaryRow}>
                            <View style={styles.summaryItem}>
                                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(59,130,246,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 6 }}>
                                    <MaterialIcons name="menu-book" size={18} color="#60a5fa" />
                                </View>
                                <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{loading ? '-' : todaySchedule.length}</Text>
                                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Classes Today</Text>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryItem}>
                                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 6 }}>
                                    <MaterialIcons name="schedule" size={18} color="#10b981" />
                                </View>
                                <Text style={[styles.summaryValue, { color: '#10b981' }]}>{loading ? '-' : todaySchedule.filter(s => s.status === 'ongoing').length}</Text>
                                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Ongoing Classes</Text>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryItem}>
                                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(245,158,11,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 6 }}>
                                    <MaterialIcons name="campaign" size={18} color="#f59e0b" />
                                </View>
                                <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{announcements.length}</Text>
                                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Alerts</Text>
                            </View>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryItem}>
                                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(167,139,250,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 6 }}>
                                    <MaterialIcons name="event" size={18} color="#a78bfa" />
                                </View>
                                <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{upcomingEvents.length}</Text>
                                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Events</Text>
                            </View>
                        </View>
                    </View>
                </StaggeredView>

                {/* ─── Announcements ─── */}
                <StaggeredView delay={120}>
                    <SectionHeader
                        title="Announcements"
                        icon="campaign"
                        count={announcements.length > 0 ? announcements.length : undefined}
                        rightElement={
                            <AnimatedPressable onPress={() => setShowAnnouncements(true)}>
                                <Text style={{ color: colors.accentPrimary, fontSize: 13, fontWeight: '500' }}>View All</Text>
                            </AnimatedPressable>
                        }
                    />
                    <View style={[styles.schedulePanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        {announcements.length === 0 ? (
                            <View style={[styles.panelEmpty, { paddingVertical: 24 }]}>
                                <MaterialIcons name="campaign" size={24} color={colors.textMuted} style={{ opacity: 0.35 }} />
                                <Text style={{ color: colors.textMuted, fontSize: 12.5, marginTop: 4 }}>No announcements</Text>
                            </View>
                        ) : announcements.slice(0, 3).map((ann: any) => (
                            <AnnouncementItem
                                key={ann.id}
                                title={ann.title}
                                content={ann.content}
                                meta={`${ann.author_name || ''} · ${ann.created_at ? new Date(ann.created_at).toLocaleDateString() : ''}`}
                                priority={ann.priority}
                            />
                        ))}
                    </View>
                </StaggeredView>

                {/* ─── Today's Schedule ─── */}
                <StaggeredView delay={180}>
                    <SectionHeader
                        title="Today's Schedule"
                        icon="event"
                        count={todaySchedule.length > 0 ? todaySchedule.length : undefined}
                        rightElement={
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <AnimatedPressable onPress={exportToday} style={{ padding: 6, backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: 8 }}>
                                    <MaterialIcons name="share" size={18} color={colors.accentPrimary} />
                                </AnimatedPressable>
                                <AnimatedPressable onPress={() => navigation.navigate('Schedule')}>
                                    <Text style={{ color: colors.accentPrimary, fontSize: 13, fontWeight: '500' }}>View All</Text>
                                </AnimatedPressable>
                            </View>
                        }
                    />
                    <View ref={todayRef} collapsable={false} style={[styles.schedulePanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        {loading ? (
                            <View style={styles.panelEmpty}>
                                <ActivityIndicator size="large" color={colors.accentPrimary} />
                            </View>
                        ) : todaySchedule.length === 0 ? (
                            <View style={styles.panelEmpty}>
                                <MaterialIcons name="event" size={36} color={colors.textMuted} style={{ opacity: 0.35 }} />
                                <Text style={{ color: colors.textMuted, fontSize: 12.5, marginTop: 4 }}>No classes scheduled today</Text>
                            </View>
                        ) : todaySchedule.map(item => {
                            const sty = statusStyles[item.status];
                            return (
                                <ClassCard
                                    key={item.id}
                                    subject={item.subject}
                                    color={item.color}
                                    statusLabel={sty.label}
                                    statusBg={sty.bg}
                                    statusText={sty.text}
                                    isOngoing={item.status === 'ongoing'}
                                    progress={item.progress}
                                    details={[
                                        { icon: 'person', text: item.teacher },
                                        { icon: 'place', text: item.room },
                                        { icon: 'schedule', text: item.time },
                                    ]}
                                />
                            );
                        })}
                    </View>
                </StaggeredView>

                {/* ─── Next Class and Next Break ─── */}
                <StaggeredView delay={240}>
                    <SectionHeader title="Up Next" icon="schedule" />
                    <View style={[styles.schedulePanel, { backgroundColor: colors.card, borderColor: colors.border, padding: 16, flexDirection: 'row', gap: 12 }]}>
                        <View style={{ flex: 1, backgroundColor: colors.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.borderSubtle }}>
                            <MaterialIcons name="class" size={18} color={colors.accentPrimary} style={{ marginBottom: 8 }} />
                            <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 2 }}>NEXT CLASS</Text>
                            <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: '700' }} numberOfLines={1}>
                                {nextClass ? nextClass.subject : 'None'}
                            </Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                                {nextClass ? nextClass.time.split('–')[0].trim() : 'You are free'}
                            </Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: colors.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.borderSubtle }}>
                            <MaterialIcons name="free-breakfast" size={18} color="#10b981" style={{ marginBottom: 8 }} />
                            <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 2 }}>NEXT BREAK</Text>
                            <Text style={{ fontSize: 14, color: colors.textPrimary, fontWeight: '700' }} numberOfLines={1}>
                                {ongoingClass ? ongoingClass.time.split('–')[1].trim() : nextClass ? 'Before ' + nextClass.time.split('–')[0].trim() : 'Free rest of day'}
                            </Text>
                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                                Time to recharge
                            </Text>
                        </View>
                    </View>
                </StaggeredView>

                {/* ─── Tomorrow's Classes ─── */}
                <StaggeredView delay={300}>
                    <SectionHeader title="Tomorrow's Classes" icon="event-note" count={tomorrowSchedules.length > 0 ? tomorrowSchedules.length : undefined} />
                    <View style={[styles.schedulePanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        {loading ? (
                            <View style={styles.panelEmpty}>
                                <ActivityIndicator size="large" color={colors.accentPrimary} />
                            </View>
                        ) : tomorrowSchedules.length === 0 ? (
                            <View style={styles.panelEmpty}>
                                <MaterialIcons name="free-breakfast" size={36} color={colors.textMuted} style={{ opacity: 0.35 }} />
                                <Text style={{ color: colors.textMuted, fontSize: 12.5, marginTop: 4 }}>No classes tomorrow</Text>
                            </View>
                        ) : tomorrowSchedules.slice(0, 4).map((item, index) => (
                            <View key={item.id} style={{ paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: index < Math.min(tomorrowSchedules.length, 4) - 1 ? 1 : 0, borderBottomColor: colors.borderSubtle }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <View style={{ flex: 1, paddingRight: 12 }}>
                                        <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14, marginBottom: 2 }}>{item.subject.name}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <MaterialIcons name="meeting-room" size={12} color={colors.textMuted} />
                                            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.room.name}</Text>
                                        </View>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>{formatTime(item.start_time)}</Text>
                                        <Text style={{ color: colors.textMuted, fontSize: 11 }}>{formatTime(item.end_time)}</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                </StaggeredView>

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* ─── Announcements Modal ─── */}
            <Modal visible={showAnnouncements} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }}>
                    <SafeAreaView style={{ flex: 1 }}>
                        <View style={{ flex: 1, backgroundColor: colors.background, marginTop: 40, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.surface }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(251,146,60,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                        <MaterialIcons name="campaign" size={20} color="#fb923c" />
                                    </View>
                                    <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary }}>Announcements</Text>
                                </View>
                                <AnimatedPressable onPress={() => setShowAnnouncements(false)} style={{ padding: 4 }}>
                                    <MaterialIcons name="close" size={24} color={colors.textMuted} />
                                </AnimatedPressable>
                            </View>
                            <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
                                {announcements.length === 0 ? (
                                    <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                                        <MaterialIcons name="notifications-none" size={56} color={colors.textMuted} />
                                        <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '500', marginTop: 12 }}>No announcements yet</Text>
                                        <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>Check back later for updates</Text>
                                    </View>
                                ) : (
                                    announcements.map(ann => {
                                        const pc = priorityConfig[ann.priority] || priorityConfig.normal;
                                        return (
                                            <View key={ann.id} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 18, marginTop: 12, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: pc.color }}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                        <View style={{ backgroundColor: pc.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                            <MaterialIcons name={pc.icon as any} size={12} color={pc.color} />
                                                            <Text style={{ color: pc.color, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>{pc.label}</Text>
                                                        </View>
                                                    </View>
                                                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>{new Date(ann.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                                                </View>
                                                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 }}>{ann.title}</Text>
                                                <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>{ann.content}</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                                                    <MaterialIcons name="person" size={14} color={colors.textMuted} />
                                                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>{ann.author_name}</Text>
                                                </View>
                                            </View>
                                        );
                                    })
                                )}
                                <View style={{ height: 40 }} />
                            </ScrollView>
                        </View>
                    </SafeAreaView>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },

    /* Greeting bar — matches web .dash-greeting */
    greetingBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        marginHorizontal: 20,
        marginTop: 16,
        marginBottom: 16,
        padding: 16,
        paddingHorizontal: 20,
        borderRadius: 14,
        borderWidth: 1,
    },
    greetingTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 2,
    },
    liveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#3FAF73',
    },
    greetingTitle: {
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    greetingSub: {
        fontSize: 13,
    },
    dayBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
    },
    dayBadgeText: {
        fontSize: 11.5,
        fontWeight: '600',
        letterSpacing: 0.2,
    },

    scrollView: { flex: 1, paddingHorizontal: 20 },

    statsGrid: {
        marginBottom: 20,
    },
    summaryCard: {
        paddingVertical: 20,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 20,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
    },
    summaryItem: {
        alignItems: 'center',
        flex: 1,
    },
    summaryValue: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 4,
    },
    summaryLabel: {
        fontSize: 11,
        fontWeight: '500',
    },
    summaryDivider: {
        width: 1,
        height: 32,
        backgroundColor: 'rgba(150,150,150,0.2)',
    },

    /* Schedule panel — matches web .dash-schedule-panel */
    schedulePanel: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 12,
        gap: 0,
        minHeight: 80,
        marginBottom: 24,
    },
    panelEmpty: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
    },
});

export default StudentDashboard;
