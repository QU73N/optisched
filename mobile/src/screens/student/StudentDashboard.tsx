import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    ActivityIndicator, Modal
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import { getGreeting, formatTime } from '../../utils/helpers';
import { useAnnouncements } from '../../hooks/useSupabase';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCustomEvents } from '../../hooks/useCustomEvents';
import { cacheData, getCachedData } from '../../utils/localCache';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { useTheme } from '../../contexts/ThemeContext';
import { StaggeredView } from '../../components/StaggeredView';

const StudentDashboard: React.FC = () => {
    const greeting = getGreeting();
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
    const scheduleLabel = isOffDay ? "Tomorrow's Schedule" : "Today's Schedule";

    // Fetch schedules using section_id lookup (same pattern as web)
    const [schedules, setSchedules] = useState<any[]>([]);
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
                const filtered = (rpcData || [])
                    .filter((s: any) => 
                        s.status === 'published' &&
                        (s.section_name || '').toLowerCase() === normalizedSection &&
                        s.day_of_week === scheduleDayName
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

                console.log('[StudentDashboard] Fetched', filtered.length, 'schedules for section', sectionName, 'on', scheduleDayName);
                setSchedules(filtered);
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
    }, [mySection, profile?.section, scheduleDayName]);

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

    const todayStr = new Date().toISOString().split('T')[0];
    const { events: upcomingEvents } = useCustomEvents(undefined, true);

    const subjectColorList = ['#4988C4', '#3FAF73', '#8b5cf6', '#E6A23C', '#ec4899', '#06b6d4'];
    const [showAnnouncements, setShowAnnouncements] = useState(false);
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

    const todaySchedule = useMemo(() => {
        if (schedules.length === 0) return [];
        const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

        return schedules.map((s, i) => {
            const [startH, startM] = (s.start_time || '00:00').split(':').map(Number);
            const [endH, endM] = (s.end_time || '00:00').split(':').map(Number);
            const startMin = startH * 60 + startM;
            const endMin = endH * 60 + endM;

            // On off-days (Sunday), everything is upcoming since classes aren't happening today
            let status: 'done' | 'current' | 'upcoming' = 'upcoming';
            let progress = 0;
            if (!isOffDay) {
                if (currentMinutes >= endMin) {
                    status = 'done';
                    progress = 100;
                } else if (currentMinutes >= startMin && currentMinutes < endMin) {
                    status = 'current';
                    const elapsed = currentMinutes - startMin;
                    const total = endMin - startMin;
                    progress = total > 0 ? Math.round((elapsed / total) * 100) : 0;
                }
            }

            const formatTime = (h: number, m: number) => {
                const ampm = h >= 12 ? 'PM' : 'AM';
                const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
                return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
            };

            return {
                id: s.id,
                subject: s.subject?.name || 'Unknown',
                room: s.room?.name || '',
                time: `${formatTime(startH, startM)} - ${formatTime(endH, endM)}`,
                instructor: s.teacher?.profile?.full_name || '',
                status,
                progress,
                color: subjectColorList[i % subjectColorList.length]
            };
        });
    }, [schedules, currentTime, isOffDay]);

    const currentClass = todaySchedule.find(s => s.status === 'current');
    const firstName = profile?.full_name?.split(' ')[0] || profile?.full_name?.split(',')[0] || 'Student';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={[styles.greeting, { color: colors.textSecondary }]}>{greeting}</Text>
                    <Text style={[styles.userName, { color: colors.textPrimary }]}>{firstName}</Text>
                </View>
                <View style={styles.headerActions}>
                    <AnimatedPressable style={[styles.notifBtn, { backgroundColor: colors.surface }]} onPress={() => setShowAnnouncements(true)}>
                        <MaterialIcons name="notifications" size={24} color={colors.textPrimary} />
                        {announcements.length > 0 && <View style={styles.notifDot} />}
                    </AnimatedPressable>
                </View>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Current Class Card */}
                {loading ? (
                    <View style={[styles.currentCard, { alignItems: 'center', paddingVertical: 40, backgroundColor: colors.elevated }]}>
                        <ActivityIndicator size="large" color={colors.accentPrimary} />
                        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>⌛ Loading schedule...</Text>
                    </View>
                ) : currentClass ? (
                    <View style={[styles.currentCard, { backgroundColor: colors.elevated }]}>
                        <View style={styles.currentBadgeRow}>
                            <View style={styles.liveBadge}>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveText}>🔴 Happening Now</Text>
                            </View>
                        </View>
                        <Text style={[styles.currentSubject, { color: colors.textPrimary }]} numberOfLines={2}>{currentClass.subject}</Text>
                        <Text style={[styles.currentSection, { color: colors.accentPrimary }]}>{profile?.section || ''}</Text>

                        <View style={styles.currentDetailsCol}>
                            <View style={styles.currentDetail}>
                                <MaterialIcons name="meeting-room" size={16} color={colors.accentPrimary} />
                                <Text style={[styles.currentDetailText, { color: colors.textSecondary }]} numberOfLines={1}>{currentClass.room}</Text>
                            </View>
                            <View style={styles.currentDetail}>
                                <MaterialIcons name="person" size={16} color={colors.accentPrimary} />
                                <Text style={[styles.currentDetailText, { color: colors.textSecondary }]} numberOfLines={1}>{currentClass.instructor}</Text>
                            </View>
                            <View style={styles.currentDetail}>
                                <MaterialIcons name="schedule" size={16} color={colors.accentPrimary} />
                                <Text style={[styles.currentDetailText, { color: colors.textSecondary }]} numberOfLines={1}>{currentClass.time}</Text>
                            </View>
                        </View>

                        {/* Real-time Progress Bar */}
                        <View style={styles.progressSection}>
                            <View style={styles.progressRow}>
                                <Text style={[styles.progressText, { color: colors.textSecondary }]}>In progress</Text>
                                <Text style={[styles.progressText, { color: colors.textSecondary }]}>{currentClass.progress}%</Text>
                            </View>
                            <View style={styles.progressBar}>
                                <View style={[styles.progressFill, { width: `${currentClass.progress}%` }]} />
                            </View>
                        </View>
                    </View>
                ) : (
                    <View style={[styles.currentCard, { alignItems: 'center', paddingVertical: 30, backgroundColor: colors.elevated }]}>
                        <MaterialIcons name="event-available" size={40} color={colors.accentPrimary} />
                        <Text style={[styles.currentSubject, { color: colors.textPrimary }]}>
                            {isOffDay ? 'No classes today' : todaySchedule.length > 0 ? 'No class right now' : 'No classes today'}
                        </Text>
                        <Text style={[styles.currentSection, { color: colors.textSecondary }]}>
                            {isOffDay
                                ? `${todaySchedule.length} classes tomorrow`
                                : todaySchedule.length > 0
                                    ? `${todaySchedule.filter(s => s.status === 'upcoming').length} upcoming classes`
                                    : 'Enjoy your day off!'}
                        </Text>
                    </View>
                )}

                {/* Quick Links */}
                <StaggeredView delay={80}>
                <View style={styles.quickLinksRow}>
                    <AnimatedPressable style={[styles.quickLink, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowAnnouncements(true)}>
                        <View style={[styles.quickLinkIcon, { backgroundColor: 'rgba(251,146,60,0.15)' }]}>
                            <MaterialIcons name="campaign" size={24} color="#fb923c" />
                        </View>
                        <Text style={[styles.quickLinkTitle, { color: colors.textPrimary }]}>Announcements</Text>
                        {announcements.length > 0 && (
                            <View style={styles.quickLinkBadge}>
                                <Text style={styles.quickLinkBadgeText}>{announcements.length} new</Text>
                            </View>
                        )}
                    </AnimatedPressable>
                    <AnimatedPressable style={[styles.quickLink, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => navigation.navigate('Schedule')}>
                        <View style={[styles.quickLinkIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                            <MaterialIcons name="calendar-month" size={24} color="#4988C4" />
                        </View>
                        <Text style={[styles.quickLinkTitle, { color: colors.textPrimary }]}>Full Schedule</Text>
                        <Text style={[styles.quickLinkSub, { color: colors.textMuted }]}>View all days</Text>
                    </AnimatedPressable>
                </View>
                </StaggeredView>

                {/* Today's Timeline */}
                <StaggeredView delay={140}>
                <View style={styles.timelineSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{scheduleLabel}</Text>
                        <AnimatedPressable onPress={() => navigation.navigate('Schedule')}><Text style={[styles.viewAll, { color: colors.accentPrimary }]}>View All</Text></AnimatedPressable>
                    </View>

                    {todaySchedule.map((item, index) => (
                        <View key={item.id} style={styles.timelineItem}>
                            {/* Timeline line */}
                            <View style={styles.timelineLine}>
                                <View style={[
                                    styles.timelineDot,
                                    { borderColor: colors.textMuted },
                                    item.status === 'current' && styles.timelineDotActive,
                                    item.status === 'done' && styles.timelineDotDone,
                                ]} />
                                {index < todaySchedule.length - 1 && (
                                    <View style={[styles.timelineConnector, { backgroundColor: colors.border }, item.status === 'done' && styles.timelineConnectorDone]} />
                                )}
                            </View>
                            <View style={[styles.timelineCard, { backgroundColor: colors.surface, borderColor: colors.border }, item.status === 'current' && styles.timelineCardActive]}>
                                <View style={styles.timelineCardTop}>
                                    <View>
                                        <Text style={[styles.timelineSubject, { color: colors.textPrimary }, item.status === 'done' && { color: colors.textMuted }]}>{item.subject}</Text>
                                        <Text style={[styles.timelineInstructor, { color: colors.textMuted }]}>{item.instructor}</Text>
                                    </View>
                                    {item.status === 'current' && (
                                        <View style={styles.currentDotBadge}>
                                            <View style={styles.currentDotInner} />
                                        </View>
                                    )}
                                </View>
                                <View style={styles.timelineCardBottom}>
                                    <View style={styles.timelineDetail}>
                                        <MaterialIcons name="meeting-room" size={12} color={colors.textMuted} />
                                        <Text style={[styles.timelineDetailText, { color: colors.textMuted }]}>{item.room}</Text>
                                    </View>
                                    <View style={styles.timelineDetail}>
                                        <MaterialIcons name="schedule" size={12} color={colors.textMuted} />
                                        <Text style={[styles.timelineDetailText, { color: colors.textMuted }]}>{item.time}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
                </StaggeredView>

                {/* Upcoming Events */}
                {upcomingEvents.length > 0 && (
                    <>
                        <View style={styles.sectionHeader}>
                            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Upcoming Events</Text>
                        </View>
                        <View style={{ gap: 8, marginBottom: 8 }}>
                            {upcomingEvents.map(evt => {
                                const isToday = evt.event_date === todayStr;
                                const dateLabel = isToday ? 'Today' : new Date(evt.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                return (
                                    <View key={evt.id} style={{ backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', borderLeftWidth: 4, borderLeftColor: isToday ? '#3FAF73' : '#4988C4' }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                            <Text style={{ color: '#34d399', fontSize: 14, fontWeight: '700' }}>{evt.title}</Text>
                                            <Text style={{ color: isToday ? '#34d399' : '#4988C4', fontSize: 11, fontWeight: '600' }}>{dateLabel}</Text>
                                        </View>
                                        {evt.description && <Text style={{ color: '#A9B4C2', fontSize: 12, marginTop: 2 }}>{evt.description}</Text>}
                                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
                                            {evt.start_time && <Text style={{ color: '#64748b', fontSize: 11 }}>{formatTime(evt.start_time)}{evt.end_time ? ` - ${formatTime(evt.end_time)}` : ''}</Text>}
                                            <Text style={{ color: '#64748b', fontSize: 11 }}>By {evt.creator_name}</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </>
                )}

                {/* Recent Announcements */}
                <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent Announcements</Text>
                    <AnimatedPressable onPress={() => setShowAnnouncements(true)}><Text style={[styles.viewAll, { color: colors.accentPrimary }]}>View All</Text></AnimatedPressable>
                </View>
                {announcements.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 24, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border }}>
                        <MaterialIcons name="campaign" size={32} color={colors.textMuted} />
                        <Text style={{ color: colors.textMuted, marginTop: 8 }}>No announcements yet</Text>
                    </View>
                ) : (
                    <View style={{ gap: 8 }}>
                        {announcements.slice(0, 3).map((ann: any) => {
                            const pc = priorityConfig[ann.priority] || priorityConfig.normal;
                            return (
                                <View key={ann.id} style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: pc.color }}>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.white, marginBottom: 2 }} numberOfLines={1}>{ann.title}</Text>
                                    <Text style={{ fontSize: 12, color: Colors.slate400, marginBottom: 4 }} numberOfLines={2}>{ann.content}</Text>
                                    <Text style={{ fontSize: 11, color: Colors.slate600 }}>{ann.created_at ? new Date(ann.created_at).toLocaleDateString() : ''}</Text>
                                </View>
                            );
                        })}
                    </View>
                )}

                <View style={{ height: 32 }} />
            </ScrollView>

            {/* Announcements Modal */}
            <Modal visible={showAnnouncements} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }}>
                    <SafeAreaView style={{ flex: 1 }}>
                        <View style={{ flex: 1, backgroundColor: colors.background, marginTop: 40, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.surface }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(251,146,60,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                        <MaterialIcons name="campaign" size={20} color="#fb923c" />
                                    </View>
                                    <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.white }}>Announcements</Text>
                                </View>
                                <AnimatedPressable onPress={() => setShowAnnouncements(false)} style={{ padding: 4 }}>
                                    <MaterialIcons name="close" size={24} color={Colors.slate400} />
                                </AnimatedPressable>
                            </View>
                            <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
                                {announcements.length === 0 ? (
                                    <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                                        <MaterialIcons name="notifications-none" size={56} color={Colors.slate600} />
                                        <Text style={{ color: Colors.slate400, fontSize: 16, fontWeight: '500', marginTop: 12 }}>No announcements yet</Text>
                                        <Text style={{ color: Colors.slate600, fontSize: 13, marginTop: 4 }}>Check back later for updates</Text>
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
                                                    <Text style={{ color: Colors.slate600, fontSize: 11 }}>{new Date(ann.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                                                </View>
                                                <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.white, marginBottom: 6 }}>{ann.title}</Text>
                                                <Text style={{ fontSize: 14, color: Colors.slate400, lineHeight: 20 }}>{ann.content}</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(51,65,85,0.4)' }}>
                                                    <MaterialIcons name="person" size={14} color={Colors.slate500} />
                                                    <Text style={{ color: Colors.slate500, fontSize: 12 }}>{ann.author_name}</Text>
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
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16
    },
    greeting: { fontSize: 14 },
    userName: { fontSize: 22, fontWeight: '700' },
    headerActions: { flexDirection: 'row', gap: 8 },
    notifBtn: { padding: 8, borderRadius: 999, position: 'relative' },
    notifDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#E05D5D' },
    scrollView: { flex: 1, paddingHorizontal: 20 },

    // Current Card
    currentCard: {
        borderRadius: 20, padding: 20, marginBottom: 24,
        borderWidth: 1, borderColor: 'rgba(73,136,196,0.3)'
    },
    currentBadgeRow: { marginBottom: 8 },
    liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
    liveText: { color: '#86efac', fontSize: 12, fontWeight: '600' },
    currentSubject: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
    currentSection: { fontSize: 14, marginBottom: 16 },
    currentDetailsCol: { gap: 8, marginBottom: 16 },
    currentDetail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    currentDetailText: { fontSize: 13, flex: 1 },
    progressSection: { marginTop: 4 },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    progressBar: { height: 6, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#4988C4', borderRadius: 3 },
    progressText: { fontSize: 11 },

    // Quick Links
    quickLinksRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    quickLink: {
        flex: 1, borderRadius: 16, padding: 16,
        borderWidth: 1
    },
    quickLinkIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    quickLinkTitle: { fontSize: 14, fontWeight: '600' },
    quickLinkSub: { fontSize: 12, marginTop: 2 },
    quickLinkBadge: { backgroundColor: 'rgba(251,146,60,0.15)', alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
    quickLinkBadgeText: { color: '#fb923c', fontSize: 11, fontWeight: '600' },

    // Timeline
    timelineSection: {},
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '700' },
    viewAll: { fontSize: 14, fontWeight: '500' },

    timelineItem: { flexDirection: 'row', gap: 12, marginBottom: 4 },
    timelineLine: { width: 24, alignItems: 'center' },
    timelineDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, backgroundColor: 'transparent', zIndex: 1, marginTop: 16 },
    timelineDotActive: { borderColor: '#4988C4', backgroundColor: '#4988C4' },
    timelineDotDone: { borderColor: '#3FAF73', backgroundColor: '#3FAF73' },
    timelineConnector: { width: 2, flex: 1, marginTop: 4 },
    timelineConnectorDone: { backgroundColor: '#3FAF73' },

    timelineCard: {
        flex: 1, borderRadius: 12, padding: 16,
        borderWidth: 1, marginBottom: 8
    },
    timelineCardActive: { borderColor: 'rgba(73,136,196,0.3)' },
    timelineCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    timelineSubject: { fontSize: 14, fontWeight: '600' },
    timelineSubjectDone: {},
    timelineInstructor: { fontSize: 12, marginTop: 2 },
    currentDotBadge: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(73,136,196,0.3)', justifyContent: 'center', alignItems: 'center' },
    currentDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4988C4' },
    timelineCardBottom: { flexDirection: 'row', gap: 16 },
    timelineDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    timelineDetailText: { fontSize: 11 }
});

export default StudentDashboard;
