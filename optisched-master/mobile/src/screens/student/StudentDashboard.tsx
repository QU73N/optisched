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
import { useSchedules, useAnnouncements } from '../../hooks/useSupabase';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useCustomEvents } from '../../hooks/useCustomEvents';
import { cacheData, getCachedData } from '../../utils/localCache';
import { AnimatedPressable } from '../../components/AnimatedPressable';

const StudentDashboard: React.FC = () => {
    const greeting = getGreeting();
    const { profile, refreshProfile } = useAuth();
    const navigation = useNavigation<any>();

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

    // Fetch all published schedules for today, then filter by section client-side
    const { schedules: rawSchedules, loading } = useSchedules({
        dayOfWeek: scheduleDayName,
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

    const subjectColorList = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];
    const [showAnnouncements, setShowAnnouncements] = useState(false);
    const [currentTime, setCurrentTime] = useState(() => new Date());

    // Real-time clock: update every 30 seconds for progress
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    const priorityConfig: Record<string, { color: string; bg: string; icon: string; label: string }> = {
        urgent: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: 'error', label: 'URGENT' },
        important: { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', icon: 'warning', label: 'IMPORTANT' },
        normal: { color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', icon: 'info', label: 'INFO' }
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
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>{greeting}</Text>
                    <Text style={styles.userName}>{firstName}</Text>
                </View>
                <View style={styles.headerActions}>
                    <AnimatedPressable style={styles.notifBtn} onPress={() => setShowAnnouncements(true)}>
                        <MaterialIcons name="notifications" size={24} color={Colors.white} />
                        {announcements.length > 0 && <View style={styles.notifDot} />}
                    </AnimatedPressable>
                </View>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Current Class Card */}
                {loading ? (
                    <View style={[styles.currentCard, { alignItems: 'center', paddingVertical: 40 }]}>
                        <ActivityIndicator size="large" color="#60a5fa" />
                        <Text style={{ color: '#93c5fd', marginTop: 12 }}>⌛ Loading schedule...</Text>
                    </View>
                ) : currentClass ? (
                    <View style={styles.currentCard}>
                        <View style={styles.currentBadgeRow}>
                            <View style={styles.liveBadge}>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveText}>🔴 Happening Now</Text>
                            </View>
                        </View>
                        <Text style={styles.currentSubject} numberOfLines={2}>{currentClass.subject}</Text>
                        <Text style={styles.currentSection}>{profile?.section || ''}</Text>

                        <View style={styles.currentDetailsCol}>
                            <View style={styles.currentDetail}>
                                <MaterialIcons name="meeting-room" size={16} color="#bfdbfe" />
                                <Text style={styles.currentDetailText} numberOfLines={1}>{currentClass.room}</Text>
                            </View>
                            <View style={styles.currentDetail}>
                                <MaterialIcons name="person" size={16} color="#bfdbfe" />
                                <Text style={styles.currentDetailText} numberOfLines={1}>{currentClass.instructor}</Text>
                            </View>
                            <View style={styles.currentDetail}>
                                <MaterialIcons name="schedule" size={16} color="#bfdbfe" />
                                <Text style={styles.currentDetailText} numberOfLines={1}>{currentClass.time}</Text>
                            </View>
                        </View>

                        {/* Real-time Progress Bar */}
                        <View style={styles.progressSection}>
                            <View style={styles.progressRow}>
                                <Text style={styles.progressText}>In progress</Text>
                                <Text style={styles.progressText}>{currentClass.progress}%</Text>
                            </View>
                            <View style={styles.progressBar}>
                                <View style={[styles.progressFill, { width: `${currentClass.progress}%` }]} />
                            </View>
                        </View>
                    </View>
                ) : (
                    <View style={[styles.currentCard, { alignItems: 'center', paddingVertical: 30 }]}>
                        <MaterialIcons name="event-available" size={40} color="#60a5fa" />
                        <Text style={styles.currentSubject}>
                            {isOffDay ? 'No classes today' : todaySchedule.length > 0 ? 'No class right now' : 'No classes today'}
                        </Text>
                        <Text style={styles.currentSection}>
                            {isOffDay
                                ? `${todaySchedule.length} classes tomorrow`
                                : todaySchedule.length > 0
                                    ? `${todaySchedule.filter(s => s.status === 'upcoming').length} upcoming classes`
                                    : 'Enjoy your day off!'}
                        </Text>
                    </View>
                )}

                {/* Quick Links */}
                <View style={styles.quickLinksRow}>
                    <AnimatedPressable style={styles.quickLink} onPress={() => setShowAnnouncements(true)}>
                        <View style={[styles.quickLinkIcon, { backgroundColor: 'rgba(251,146,60,0.15)' }]}>
                            <MaterialIcons name="campaign" size={24} color="#fb923c" />
                        </View>
                        <Text style={styles.quickLinkTitle}>Announcements</Text>
                        {announcements.length > 0 && (
                            <View style={styles.quickLinkBadge}>
                                <Text style={styles.quickLinkBadgeText}>{announcements.length} new</Text>
                            </View>
                        )}
                    </AnimatedPressable>
                    <AnimatedPressable style={styles.quickLink} onPress={() => navigation.navigate('Schedule')}>
                        <View style={[styles.quickLinkIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                            <MaterialIcons name="calendar-month" size={24} color="#60a5fa" />
                        </View>
                        <Text style={styles.quickLinkTitle}>Full Schedule</Text>
                        <Text style={styles.quickLinkSub}>View all days</Text>
                    </AnimatedPressable>
                </View>

                {/* Today's Timeline */}
                <View style={styles.timelineSection}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{scheduleLabel}</Text>
                        <AnimatedPressable onPress={() => navigation.navigate('Schedule')}><Text style={styles.viewAll}>View All</Text></AnimatedPressable>
                    </View>

                    {todaySchedule.map((item, index) => (
                        <View key={item.id} style={styles.timelineItem}>
                            {/* Timeline line */}
                            <View style={styles.timelineLine}>
                                <View style={[
                                    styles.timelineDot,
                                    item.status === 'current' && styles.timelineDotActive,
                                    item.status === 'done' && styles.timelineDotDone,
                                ]} />
                                {index < todaySchedule.length - 1 && (
                                    <View style={[styles.timelineConnector, item.status === 'done' && styles.timelineConnectorDone]} />
                                )}
                            </View>
                            <View style={[styles.timelineCard, item.status === 'current' && styles.timelineCardActive]}>
                                <View style={styles.timelineCardTop}>
                                    <View>
                                        <Text style={[styles.timelineSubject, item.status === 'done' && styles.timelineSubjectDone]}>{item.subject}</Text>
                                        <Text style={styles.timelineInstructor}>{item.instructor}</Text>
                                    </View>
                                    {item.status === 'current' && (
                                        <View style={styles.currentDotBadge}>
                                            <View style={styles.currentDotInner} />
                                        </View>
                                    )}
                                </View>
                                <View style={styles.timelineCardBottom}>
                                    <View style={styles.timelineDetail}>
                                        <MaterialIcons name="meeting-room" size={12} color={Colors.slate500} />
                                        <Text style={styles.timelineDetailText}>{item.room}</Text>
                                    </View>
                                    <View style={styles.timelineDetail}>
                                        <MaterialIcons name="schedule" size={12} color={Colors.slate500} />
                                        <Text style={styles.timelineDetailText}>{item.time}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Upcoming Events */}
                {upcomingEvents.length > 0 && (
                    <>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Upcoming Events</Text>
                        </View>
                        <View style={{ gap: 8, marginBottom: 8 }}>
                            {upcomingEvents.map(evt => {
                                const isToday = evt.event_date === todayStr;
                                const dateLabel = isToday ? 'Today' : new Date(evt.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                return (
                                    <View key={evt.id} style={{ backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)', borderLeftWidth: 4, borderLeftColor: isToday ? '#10b981' : '#3b82f6' }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                            <Text style={{ color: '#34d399', fontSize: 14, fontWeight: '700' }}>{evt.title}</Text>
                                            <Text style={{ color: isToday ? '#34d399' : '#60a5fa', fontSize: 11, fontWeight: '600' }}>{dateLabel}</Text>
                                        </View>
                                        {evt.description && <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{evt.description}</Text>}
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
                    <Text style={styles.sectionTitle}>Recent Announcements</Text>
                    <AnimatedPressable onPress={() => setShowAnnouncements(true)}><Text style={styles.viewAll}>View All</Text></AnimatedPressable>
                </View>
                {announcements.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 24, backgroundColor: '#1a1d24', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(51,65,85,0.5)' }}>
                        <MaterialIcons name="campaign" size={32} color={Colors.slate600} />
                        <Text style={{ color: Colors.slate400, marginTop: 8 }}>No announcements yet</Text>
                    </View>
                ) : (
                    <View style={{ gap: 8 }}>
                        {announcements.slice(0, 3).map((ann: any) => {
                            const pc = priorityConfig[ann.priority] || priorityConfig.normal;
                            return (
                                <View key={ann.id} style={{ backgroundColor: '#1a1d24', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(51,65,85,0.5)', borderLeftWidth: 4, borderLeftColor: pc.color }}>
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
                        <View style={{ flex: 1, backgroundColor: '#0f1115', marginTop: 40, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#1a1d24' }}>
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
                                            <View key={ann.id} style={{ backgroundColor: '#1a1d24', borderRadius: 16, padding: 18, marginTop: 12, borderWidth: 1, borderColor: 'rgba(51,65,85,0.5)', borderLeftWidth: 4, borderLeftColor: pc.color }}>
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
    container: { flex: 1, backgroundColor: '#0f1115' },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16
    },
    greeting: { fontSize: 14, color: Colors.textSecondaryDark },
    userName: { fontSize: 22, fontWeight: '700', color: Colors.white },
    headerActions: { flexDirection: 'row', gap: 8 },
    notifBtn: { padding: 8, backgroundColor: '#1e293b', borderRadius: 999, position: 'relative' },
    notifDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
    scrollView: { flex: 1, paddingHorizontal: 20 },

    // Current Card
    currentCard: {
        backgroundColor: '#1e3a5f', borderRadius: 20, padding: 20, marginBottom: 24,
        borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)'
    },
    currentBadgeRow: { marginBottom: 8 },
    liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
    liveText: { color: '#86efac', fontSize: 12, fontWeight: '600' },
    currentSubject: { fontSize: 22, fontWeight: '700', color: Colors.white, marginBottom: 4 },
    currentSection: { fontSize: 14, color: '#93c5fd', marginBottom: 16 },
    currentDetailsCol: { gap: 8, marginBottom: 16 },
    currentDetail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    currentDetailText: { fontSize: 13, color: '#bfdbfe', flex: 1 },
    progressSection: { marginTop: 4 },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    progressBar: { height: 6, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#60a5fa', borderRadius: 3 },
    progressText: { fontSize: 11, color: '#93c5fd' },

    // Quick Links
    quickLinksRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
    quickLink: {
        flex: 1, backgroundColor: '#1a1d24', borderRadius: 16, padding: 16,
        borderWidth: 1, borderColor: 'rgba(51,65,85,0.5)'
    },
    quickLinkIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    quickLinkTitle: { fontSize: 14, fontWeight: '600', color: Colors.white },
    quickLinkSub: { fontSize: 12, color: Colors.slate400, marginTop: 2 },
    quickLinkBadge: { backgroundColor: 'rgba(251,146,60,0.15)', alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
    quickLinkBadgeText: { color: '#fb923c', fontSize: 11, fontWeight: '600' },

    // Timeline
    timelineSection: {},
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimaryDark },
    viewAll: { color: Colors.primary, fontSize: 14, fontWeight: '500' },

    timelineItem: { flexDirection: 'row', gap: 12, marginBottom: 4 },
    timelineLine: { width: 24, alignItems: 'center' },
    timelineDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: Colors.slate500, backgroundColor: 'transparent', zIndex: 1, marginTop: 16 },
    timelineDotActive: { borderColor: '#3b82f6', backgroundColor: '#3b82f6' },
    timelineDotDone: { borderColor: '#10b981', backgroundColor: '#10b981' },
    timelineConnector: { width: 2, flex: 1, backgroundColor: Colors.slate700, marginTop: 4 },
    timelineConnectorDone: { backgroundColor: '#10b981' },

    timelineCard: {
        flex: 1, backgroundColor: '#1a1d24', borderRadius: 12, padding: 16,
        borderWidth: 1, borderColor: 'rgba(51,65,85,0.5)', marginBottom: 8
    },
    timelineCardActive: { borderColor: 'rgba(59,130,246,0.3)' },
    timelineCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    timelineSubject: { fontSize: 14, fontWeight: '600', color: Colors.white },
    timelineSubjectDone: { color: Colors.slate400 },
    timelineInstructor: { fontSize: 12, color: Colors.slate400, marginTop: 2 },
    currentDotBadge: { width: 12, height: 12, borderRadius: 6, backgroundColor: 'rgba(59,130,246,0.3)', justifyContent: 'center', alignItems: 'center' },
    currentDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3b82f6' },
    timelineCardBottom: { flexDirection: 'row', gap: 16 },
    timelineDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    timelineDetailText: { fontSize: 11, color: Colors.slate500 }
});

export default StudentDashboard;
