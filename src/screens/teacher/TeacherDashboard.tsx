import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    ActivityIndicator, Modal, TextInput, Alert, Pressable
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useSchedules, useScheduleChangeRequests, useAnnouncements, useSections } from '../../hooks/useSupabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getGreeting } from '../../utils/helpers';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { useCustomEvents } from '../../hooks/useCustomEvents';
import { useRooms } from '../../hooks/useSupabase';
import { useToast } from '../../components/CustomToast';
import { AnimatedPressable } from '../../components/AnimatedPressable';

const TeacherDashboard: React.FC = () => {
    const greeting = getGreeting();
    const { profile } = useAuth();
    const { colors } = useTheme();
    const navigation = useNavigation<any>();

    // Get today's day name — on Sunday show Monday (next school day)
    const dayIndex = new Date().getDay();
    const isOffDay = dayIndex === 0; // Sunday
    const scheduleDayName = isOffDay ? 'Monday' : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex];
    const { schedules: allSchedules, loading } = useSchedules({ dayOfWeek: scheduleDayName, status: 'published' });
    const { submitRequest, requests, deleteRequest } = useScheduleChangeRequests();
    const { announcements: allAnnouncements } = useAnnouncements();
    const { sections } = useSections();

    // Filter schedules: teachers only see their own classes
    const schedules = useMemo(() => {
        if (!profile?.full_name) return allSchedules;
        return allSchedules.filter(s => {
            const teacherName = s.teacher?.profile?.full_name || '';
            return teacherName.toLowerCase() === profile.full_name!.toLowerCase();
        });
    }, [allSchedules, profile?.full_name]);

    // Filter announcements: teachers see global + their assigned sections
    const announcements = useMemo(() => {
        if (!allAnnouncements) return [];
        // Get sections this teacher teaches (from their schedules)
        const teacherSectionIds = new Set<string>();
        const teacherSectionNames = new Set<string>();
        allSchedules.forEach(s => {
            const tName = s.teacher?.profile?.full_name || '';
            if (tName.toLowerCase() === (profile?.full_name || '').toLowerCase()) {
                if (s.section_id) teacherSectionIds.add(s.section_id);
                const secName = s.section?.name;
                if (secName) teacherSectionNames.add(secName.toLowerCase().trim());
            }
        });
        return allAnnouncements.filter((a: any) => {
            // Check target_section field first
            if (a.target_section) {
                const target = a.target_section.toLowerCase().trim();
                if (target === 'all sections') return true;
                return teacherSectionNames.has(target);
            }
            // Fallback: parse title prefix
            const title = a.title || '';
            if (title.startsWith('[All Sections]')) return true;
            if (!title.startsWith('[')) return true; // No prefix = global
            const match = title.match(/^\[([^\]]+)\]/);
            if (match) {
                return teacherSectionNames.has(match[1].toLowerCase().trim());
            }
            return true;
        });
    }, [allAnnouncements, allSchedules, profile?.full_name]);

    // Schedule change request modal
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedClassName, setSelectedClassName] = useState('');
    const [requestReason, setRequestReason] = useState('');
    const [requestType, setRequestType] = useState<'reschedule' | 'cancel' | 'swap'>('reschedule');
    const [submitting, setSubmitting] = useState(false);
    const [showAnnouncements, setShowAnnouncements] = useState(false);
    const [showQuickActions, setShowQuickActions] = useState(false);
    const [showReportRoom, setShowReportRoom] = useState(false);
    const [showMessageAdmin, setShowMessageAdmin] = useState(false);
    const [reportRoom, setReportRoom] = useState('');
    const [reportIssue, setReportIssue] = useState('');
    const [adminMessage, setAdminMessage] = useState('');
    const [sendingReport, setSendingReport] = useState(false);
    const [sendingMessage, setSendingMessage] = useState(false);

    // Teacher announcement
    const [showTeacherAnnounce, setShowTeacherAnnounce] = useState(false);
    const [annTitle, setAnnTitle] = useState('');
    const [annContent, setAnnContent] = useState('');
    const [annSection, setAnnSection] = useState('');
    const [sendingAnn, setSendingAnn] = useState(false);
    const [annExpiry, setAnnExpiry] = useState('never');
    const [editingAnn, setEditingAnn] = useState<any>(null);
    const [editAnnTitle, setEditAnnTitle] = useState('');
    const [editAnnContent, setEditAnnContent] = useState('');

    // Custom events
    const todayStr = new Date().toISOString().split('T')[0];
    const { events: upcomingEvents, createEvent, deleteEvent } = useCustomEvents(undefined, true);
    const [showEventModal, setShowEventModal] = useState(false);
    const [eventTitle, setEventTitle] = useState('');
    const [eventDesc, setEventDesc] = useState('');
    const [eventDate, setEventDate] = useState(todayStr);
    const [eventStartTime, setEventStartTime] = useState('');
    const [eventEndTime, setEventEndTime] = useState('');
    const [eventRoom, setEventRoom] = useState('');
    const [creatingEvent, setCreatingEvent] = useState(false);
    const { rooms } = useRooms();
    const { showToast } = useToast();

    const handleSubmitRequest = async () => {
        if (!requestReason.trim()) {
            Alert.alert('Error', 'Please provide a reason for the change.');
            return;
        }
        if (!profile?.id) {
            Alert.alert('Error', 'You must be logged in to submit a request.');
            return;
        }
        setSubmitting(true);
        try {
            // schedule_id is uuid type — only pass valid UUIDs, otherwise omit it
            const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedClassId);
            const requestData: any = {
                teacher_id: profile.id,
                teacher_name: profile.full_name || 'Teacher',
                request_type: requestType,
                reason: `${selectedClassName}: ${requestReason.trim()}`
            };
            // Only include schedule_id if it's a valid UUID referencing a real schedule
            if (isValidUUID) {
                requestData.schedule_id = selectedClassId;
            }
            await submitRequest(requestData);
            Alert.alert('Submitted!', 'Your request has been sent to the admin for approval.');
            setShowRequestModal(false);
            setRequestReason('');
        } catch (err: any) {
            const msg = err?.message || JSON.stringify(err);
            Alert.alert('Error', `Failed to submit: ${msg}`);
        } finally {
            setSubmitting(false);
        }
    };

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

    const subjectColorList = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

    // Build today's schedule with status
    const todaySchedule = useMemo(() => {
        const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

        // Filter schedules taught by this teacher
        const teacherSchedules = schedules.filter(s => {
            const teacherName = s.teacher?.profile?.full_name || '';
            return !profile?.full_name || teacherName.toLowerCase().includes(profile.full_name.split(',')[0].toLowerCase()) || teacherName.toLowerCase().includes(profile.full_name.split(' ')[0].toLowerCase());
        });

        return teacherSchedules.map((s, i) => {
            const [startH, startM] = (s.start_time || '00:00').split(':').map(Number);
            const [endH, endM] = (s.end_time || '00:00').split(':').map(Number);
            const startMin = startH * 60 + startM;
            const endMin = endH * 60 + endM;

            // On off-days (Sunday), everything is upcoming
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

            const formatTime = (h: number, m: number) => {
                const ampm = h >= 12 ? 'PM' : 'AM';
                const hr = h > 12 ? h - 12 : h === 0 ? 12 : h;
                return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
            };

            return {
                id: s.id,
                subject: s.subject?.name || 'Unknown',
                section: s.section?.name || '',
                room: s.room?.name || '',
                time: `${formatTime(startH, startM)} - ${formatTime(endH, endM)}`,
                status,
                progress,
                color: subjectColorList[i % subjectColorList.length]
            };
        });
    }, [schedules, profile, currentTime, isOffDay]);

    const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
        finished: { bg: 'rgba(148,163,184,0.1)', text: '#94a3b8', label: 'Finished' },
        ongoing: { bg: 'rgba(16,185,129,0.15)', text: '#10b981', label: 'Ongoing' },
        upcoming: { bg: 'rgba(59,130,246,0.1)', text: '#60a5fa', label: 'Upcoming' }
    };

    const teacherName = profile?.full_name || 'Teacher';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>{greeting}</Text>
                    <Text style={[styles.userName, { color: colors.textPrimary }]}>{teacherName}</Text>
                </View>
                <AnimatedPressable style={styles.notifBtn} onPress={() => setShowAnnouncements(true)}>
                    <MaterialIcons name="notifications" size={24} color={Colors.white} />
                    {announcements.length > 0 && <View style={styles.notifDot} />}
                </AnimatedPressable>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <MaterialIcons name="school" size={20} color="#60a5fa" />
                        <Text style={styles.statNumber}>{loading ? '...' : todaySchedule.length}</Text>
                        <Text style={styles.statLabel}>Classes Today</Text>
                    </View>
                    <View style={[styles.statBox, styles.statBoxBorder]}>
                        <MaterialIcons name="book" size={20} color="#a78bfa" />
                        <Text style={styles.statNumber}>{loading ? '...' : schedules.length}</Text>
                        <Text style={styles.statLabel}>Total Entries</Text>
                    </View>
                    <View style={styles.statBox}>
                        <MaterialIcons name="check-circle" size={20} color="#34d399" />
                        <Text style={styles.statNumber}>{todaySchedule.filter(s => s.status === 'finished').length}</Text>
                        <Text style={styles.statLabel}>Completed</Text>
                    </View>
                </View>

                {/* Today's Schedule */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Today's Classes</Text>
                    <Text style={styles.sectionDay}>{isOffDay ? 'Monday (Tomorrow)' : scheduleDayName}</Text>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 30 }} />
                ) : todaySchedule.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="event-available" size={48} color={Colors.slate600} />
                        <Text style={styles.emptyText}>No classes scheduled for today</Text>
                        <Text style={styles.emptySubtext}>Enjoy your day off!</Text>
                    </View>
                ) : (
                    todaySchedule.map(item => {
                        const sty = statusStyles[item.status];
                        return (
                            <AnimatedPressable key={item.id} style={styles.classCard} activeOpacity={0.7}
                                onLongPress={() => {
                                    setSelectedClassId(item.id);
                                    setSelectedClassName(item.subject);
                                    setShowRequestModal(true);
                                }}>
                                <View style={[styles.colorStripe, { backgroundColor: item.color }]} />
                                <View style={styles.cardContent}>
                                    <View style={styles.cardTop}>
                                        <Text style={styles.cardSubject}>{item.subject}</Text>
                                        <View style={[styles.statusBadge, { backgroundColor: sty.bg }]}>
                                            <Text style={[styles.statusText, { color: sty.text }]}>{sty.label}</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.cardSection}>{item.section}</Text>
                                    <View style={styles.cardDetails}>
                                        <View style={styles.cardDetail}>
                                            <MaterialIcons name="meeting-room" size={14} color={Colors.slate500} />
                                            <Text style={styles.cardDetailText}>{item.room}</Text>
                                        </View>
                                        <View style={styles.cardDetail}>
                                            <MaterialIcons name="schedule" size={14} color={Colors.slate500} />
                                            <Text style={styles.cardDetailText}>{item.time}</Text>
                                        </View>
                                    </View>
                                </View>
                            </AnimatedPressable>
                        );
                    })
                )}

                {/* Quick Actions */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginHorizontal: 20, marginBottom: 24 }}>
                    <AnimatedPressable
                        style={{ width: '48%', backgroundColor: '#1e293b', borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334155' }}
                        onPress={() => navigation.navigate('Messages')}
                    >
                        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(99,102,241,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                            <MaterialIcons name="chat" size={20} color="#818cf8" />
                        </View>
                        <Text style={{ color: '#e2e8f0', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>Message Admin</Text>
                    </AnimatedPressable>

                    <AnimatedPressable
                        style={{ width: '48%', backgroundColor: '#1e293b', borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334155' }}
                        onPress={() => {
                            if (todaySchedule.length > 0) {
                                setSelectedClassId(todaySchedule[0].id);
                                setSelectedClassName(todaySchedule[0].subject);
                                setShowRequestModal(true);
                            }
                        }}
                    >
                        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(59,130,246,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                            <MaterialIcons name="calendar-today" size={20} color="#60a5fa" />
                        </View>
                        <Text style={{ color: '#e2e8f0', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>My Schedule</Text>
                    </AnimatedPressable>

                    <AnimatedPressable
                        style={{ width: '48%', backgroundColor: '#1e293b', borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334155' }}
                        onPress={() => setShowReportRoom(true)}
                    >
                        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(245,158,11,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                            <MaterialIcons name="report-problem" size={20} color="#f59e0b" />
                        </View>
                        <Text style={{ color: '#e2e8f0', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>Report Issue</Text>
                    </AnimatedPressable>

                    <AnimatedPressable
                        style={{ width: '48%', backgroundColor: '#1e293b', borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334155' }}
                        onPress={() => setShowEventModal(true)}
                    >
                        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }}>
                            <MaterialIcons name="event" size={20} color="#34d399" />
                        </View>
                        <Text style={{ color: '#e2e8f0', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>Create Event</Text>
                    </AnimatedPressable>
                </View>

                {/* Upcoming Events */}
                {upcomingEvents.length > 0 && (
                    <>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Upcoming Events</Text>
                        </View>
                        {upcomingEvents.map((evt: any) => {
                            const isToday = evt.event_date === todayStr;
                            const dateLabel = isToday ? 'Today' : new Date(evt.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            return (
                                <View key={evt.id} style={{ marginHorizontal: 20, marginBottom: 8, backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                                <Text style={{ color: '#34d399', fontSize: 14, fontWeight: '700' }}>{evt.title}</Text>
                                                <Text style={{ color: isToday ? '#34d399' : '#60a5fa', fontSize: 10, fontWeight: '600', backgroundColor: isToday ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>{dateLabel}</Text>
                                            </View>
                                            {evt.description && <Text style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>{evt.description}</Text>}
                                            <Text style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>By {evt.creator_name} • {evt.creator_role}</Text>
                                        </View>
                                        {evt.created_by === profile?.id && (
                                            <AnimatedPressable onPress={() => {
                                                showToast({
                                                    type: 'warning', title: 'Delete Event?', message: `Remove "${evt.title}"?`, actions: [
                                                        { text: 'Cancel', style: 'cancel', onPress: () => { } },
                                                        { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteEvent(evt.id); showToast({ type: 'success', title: 'Event deleted' }); } catch { showToast({ type: 'error', title: 'Failed to delete' }); } } }
                                                    ]
                                                });
                                            }}>
                                                <MaterialIcons name="delete-outline" size={20} color="#ef4444" />
                                            </AnimatedPressable>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </>
                )}

                {/* My Requests Status */}
                {requests.filter(r => r.teacher_id === profile?.id).length > 0 && (
                    <>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>My Requests</Text>
                            <AnimatedPressable onPress={() => {
                                Alert.alert('Clear All Requests', 'Remove all your request history?', [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'Clear All', style: 'destructive', onPress: async () => {
                                            const myReqs = requests.filter(r => r.teacher_id === profile?.id);
                                            for (const r of myReqs) {
                                                await deleteRequest(r.id);
                                            }
                                        }
                                    }
                                ]);
                            }}>
                                <Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '600' }}>Clear All</Text>
                            </AnimatedPressable>
                        </View>
                        {requests.filter(r => r.teacher_id === profile?.id).slice(0, 5).map(req => {
                            const statusColors: Record<string, { bg: string; text: string; label: string }> = {
                                pending: { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', label: 'PENDING' },
                                approved: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e', label: 'APPROVED' },
                                rejected: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', label: 'REJECTED' },
                            };
                            const sc = statusColors[req.status] || statusColors.pending;
                            return (
                                <View key={req.id} style={{ backgroundColor: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#334155' }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.slate400, textTransform: 'uppercase' }}>{req.request_type}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <View style={{ backgroundColor: sc.bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 }}>
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: sc.text }}>{sc.label}</Text>
                                            </View>
                                            <AnimatedPressable onPress={() => {
                                                Alert.alert('Remove Request', 'Remove this request from history?', [
                                                    { text: 'Cancel', style: 'cancel' },
                                                    {
                                                        text: 'Remove', style: 'destructive', onPress: async () => {
                                                            await deleteRequest(req.id);
                                                        }
                                                    }
                                                ]);
                                            }}>
                                                <MaterialIcons name="close" size={16} color={Colors.slate500} />
                                            </AnimatedPressable>
                                        </View>
                                    </View>
                                    <Text style={{ fontSize: 13, color: Colors.white, marginBottom: 4 }} numberOfLines={2}>{req.reason}</Text>
                                    {req.admin_notes && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                            <MaterialIcons name="comment" size={12} color="#60a5fa" />
                                            <Text style={{ fontSize: 11, color: '#60a5fa', fontStyle: 'italic' }}>{req.admin_notes}</Text>
                                        </View>
                                    )}
                                    <Text style={{ fontSize: 10, color: Colors.slate600, marginTop: 4 }}>{new Date(req.created_at).toLocaleDateString()}</Text>
                                </View>
                            );
                        })}
                    </>
                )}

                {/* Recent Announcements */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Announcements</Text>
                </View>
                {announcements.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 24, marginHorizontal: 20, backgroundColor: '#1e293b', borderRadius: 14, borderWidth: 1, borderColor: '#334155' }}>
                        <MaterialIcons name="campaign" size={32} color={Colors.slate600} />
                        <Text style={{ color: Colors.slate400, marginTop: 8 }}>No announcements yet</Text>
                    </View>
                ) : (
                    <View style={{ paddingHorizontal: 20, gap: 8 }}>
                        {announcements.slice(0, 3).map((ann: any) => {
                            const dotColor = ann.priority === 'urgent' ? '#ef4444' : ann.priority === 'important' ? '#f59e0b' : '#22c55e';
                            return (
                                <View key={ann.id} style={{ flexDirection: 'row', gap: 12, backgroundColor: '#1e293b', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#334155' }}>
                                    <View style={{ width: 4, borderRadius: 2, backgroundColor: dotColor }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.white, marginBottom: 2 }} numberOfLines={1}>{ann.title}</Text>
                                        <Text style={{ fontSize: 12, color: Colors.slate400, marginBottom: 4 }} numberOfLines={2}>{ann.content}</Text>
                                        <Text style={{ fontSize: 11, color: Colors.slate600 }}>{ann.created_at ? new Date(ann.created_at).toLocaleDateString() : ''}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Schedule Change Request Modal */}
            <Modal visible={showRequestModal} animationType="slide" transparent>
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }} onPress={() => setShowRequestModal(false)}>
                    <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 }} onStartShouldSetResponder={() => true}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.white }}>Request Schedule Change</Text>
                            <AnimatedPressable onPress={() => setShowRequestModal(false)}>
                                <MaterialIcons name="close" size={24} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>
                        <Text style={{ color: Colors.slate400, marginBottom: 16 }}>For: {selectedClassName}</Text>

                        <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5, marginBottom: 6 }}>REQUEST TYPE</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                            {(['reschedule', 'cancel', 'swap'] as const).map(t => (
                                <Pressable key={t} onPress={() => setRequestType(t)}
                                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: requestType === t ? Colors.primary : '#334155', backgroundColor: requestType === t ? 'rgba(59,130,246,0.1)' : 'transparent' }}>
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: requestType === t ? Colors.primary : Colors.slate400 }}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                                </Pressable>
                            ))}
                        </View>

                        <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5, marginBottom: 6 }}>REASON</Text>
                        <TextInput style={{ backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.white, fontSize: 14, height: 80, textAlignVertical: 'top' }}
                            value={requestReason} onChangeText={setRequestReason}
                            placeholder="Explain why you need this change..." placeholderTextColor="#6b7280"
                            multiline numberOfLines={3} />

                        <AnimatedPressable style={{ backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20 }}
                            onPress={handleSubmitRequest} disabled={submitting}>
                            {submitting ? <ActivityIndicator color={Colors.white} /> : (
                                <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '600' }}>Submit to Admin</Text>
                            )}
                        </AnimatedPressable>
                    </View>
                </Pressable>
            </Modal>

            {/* Announcements Modal */}
            <Modal visible={showAnnouncements} animationType="slide" transparent>
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }} onPress={() => setShowAnnouncements(false)}>
                    <SafeAreaView style={{ flex: 1 }} pointerEvents="box-none">
                        <View style={{ flex: 1, backgroundColor: '#0f172a', marginTop: 40, borderTopLeftRadius: 24, borderTopRightRadius: 24 }} onStartShouldSetResponder={() => true}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
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
                                            <View key={ann.id} style={{ backgroundColor: '#1e293b', borderRadius: 16, padding: 18, marginTop: 12, borderWidth: 1, borderColor: '#334155', borderLeftWidth: 4, borderLeftColor: pc.color }}>
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
                </Pressable>
            </Modal>

            {/* Teacher FAB */}
            <AnimatedPressable style={styles.fab} activeOpacity={0.8}
                onPress={() => setShowQuickActions(true)}>
                <MaterialIcons name="add" size={28} color={Colors.white} />
            </AnimatedPressable>

            {/* Quick Actions Modal */}
            <Modal visible={showQuickActions} animationType="slide" transparent>
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }} onPress={() => setShowQuickActions(false)}>
                    <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 }} onStartShouldSetResponder={() => true}>
                        <View style={{ alignItems: 'center', marginBottom: 16 }}>
                            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#475569' }} />
                        </View>
                        <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.white, marginBottom: 16 }}>Quick Actions</Text>

                        <AnimatedPressable
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#334155' }}
                            onPress={() => { setShowQuickActions(false); setSelectedClassName('General'); setSelectedClassId('general'); setShowRequestModal(true); }}
                        >
                            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(59,130,246,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                                <MaterialIcons name="swap-horiz" size={24} color="#60a5fa" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.white }}>Request Schedule Change</Text>
                                <Text style={{ fontSize: 12, color: Colors.slate500, marginTop: 2 }}>Reschedule, cancel, or swap a class</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={20} color={Colors.slate600} />
                        </AnimatedPressable>

                        <AnimatedPressable
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#334155' }}
                            onPress={() => { setShowQuickActions(false); setShowMessageAdmin(true); }}
                        >
                            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(16,185,129,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                                <MaterialIcons name="chat" size={24} color="#34d399" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.white }}>Message Admin</Text>
                                <Text style={{ fontSize: 12, color: Colors.slate500, marginTop: 2 }}>Send a message to school admin</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={20} color={Colors.slate600} />
                        </AnimatedPressable>

                        <AnimatedPressable
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#334155' }}
                            onPress={() => { setShowQuickActions(false); setShowReportRoom(true); }}
                        >
                            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(245,158,11,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                                <MaterialIcons name="report-problem" size={24} color="#fbbf24" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.white }}>Report Room Issue</Text>
                                <Text style={{ fontSize: 12, color: Colors.slate500, marginTop: 2 }}>Report equipment or room problems</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={20} color={Colors.slate600} />
                        </AnimatedPressable>

                        <AnimatedPressable
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#334155' }}
                            onPress={() => { setShowQuickActions(false); setShowTeacherAnnounce(true); }}
                        >
                            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(59,130,246,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                                <MaterialIcons name="campaign" size={24} color="#60a5fa" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.white }}>Announce to Section</Text>
                                <Text style={{ fontSize: 12, color: Colors.slate500, marginTop: 2 }}>Post announcement for your students</Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={20} color={Colors.slate600} />
                        </AnimatedPressable>
                    </View>
                </Pressable>
            </Modal>

            {/* Report Room Issue Modal */}
            <Modal visible={showReportRoom} animationType="slide" transparent>
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }} onPress={() => setShowReportRoom(false)}>
                    <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 }} onStartShouldSetResponder={() => true}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(245,158,11,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                    <MaterialIcons name="report-problem" size={20} color="#fbbf24" />
                                </View>
                                <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.white }}>Report Room Issue</Text>
                            </View>
                            <AnimatedPressable onPress={() => setShowReportRoom(false)}>
                                <MaterialIcons name="close" size={24} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5, marginBottom: 6 }}>ROOM NAME</Text>
                        <TextInput
                            style={{ backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.white, fontSize: 14, marginBottom: 12 }}
                            value={reportRoom} onChangeText={setReportRoom}
                            placeholder="e.g. Lab 204, Room 305" placeholderTextColor="#6b7280"
                        />
                        <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5, marginBottom: 6 }}>ISSUE DESCRIPTION</Text>
                        <TextInput
                            style={{ backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.white, fontSize: 14, height: 100, textAlignVertical: 'top', marginBottom: 20 }}
                            value={reportIssue} onChangeText={setReportIssue}
                            placeholder="Describe the issue (e.g. broken projector, no AC, door lock issue)" placeholderTextColor="#6b7280" multiline
                        />
                        <AnimatedPressable
                            style={{ backgroundColor: '#f59e0b', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 16, opacity: sendingReport ? 0.6 : 1 }}
                            onPress={async () => {
                                if (!reportRoom.trim() || !reportIssue.trim()) { Alert.alert('Error', 'Please fill in both fields.'); return; }
                                setSendingReport(true);
                                try {
                                    // 1) Insert into room_issues table
                                    const { error } = await supabase.from('room_issues').insert({
                                        room_name: reportRoom.trim(),
                                        issue_description: reportIssue.trim(),
                                        reported_by: profile?.id,
                                        reporter_name: profile?.full_name || 'Teacher',
                                        status: 'open'
                                    });
                                    if (error) throw error;

                                    // 2) Also send as admin_messages so admin sees it in chat inbox
                                    await supabase.from('admin_messages').insert({
                                        sender_id: profile?.id,
                                        sender_name: profile?.full_name || 'Teacher',
                                        message: `Room Issue Report\n\nRoom: ${reportRoom.trim()}\nIssue: ${reportIssue.trim()}`,
                                        direction: 'teacher_to_admin'
                                    });

                                    Alert.alert('Report Submitted', `Room issue for "${reportRoom.trim()}" has been reported to the admin.`);
                                    setShowReportRoom(false); setReportRoom(''); setReportIssue('');
                                } catch (err: any) {
                                    Alert.alert('Error', err?.message || 'Failed to submit report. Please try again.');
                                } finally { setSendingReport(false); }
                            }} disabled={sendingReport}
                        >
                            {sendingReport ? <ActivityIndicator color={Colors.white} /> : (
                                <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '600' }}>Submit Report</Text>
                            )}
                        </AnimatedPressable>
                    </View>
                </Pressable>
            </Modal>

            {/* Message Admin Modal */}
            <Modal visible={showMessageAdmin} animationType="slide" transparent>
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }} onPress={() => setShowMessageAdmin(false)}>
                    <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 }} onStartShouldSetResponder={() => true}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                    <MaterialIcons name="chat" size={20} color="#34d399" />
                                </View>
                                <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.white }}>Message Admin</Text>
                            </View>
                            <AnimatedPressable onPress={() => setShowMessageAdmin(false)}>
                                <MaterialIcons name="close" size={24} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>
                        <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5, marginBottom: 6 }}>YOUR MESSAGE</Text>
                        <TextInput
                            style={{ backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.white, fontSize: 14, height: 120, textAlignVertical: 'top', marginBottom: 20 }}
                            value={adminMessage} onChangeText={setAdminMessage}
                            placeholder="Type your message for the admin (room concern, schedule question, etc.)" placeholderTextColor="#6b7280" multiline
                        />
                        <AnimatedPressable
                            style={{ backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 16, opacity: sendingMessage ? 0.6 : 1 }}
                            onPress={async () => {
                                if (!adminMessage.trim()) { Alert.alert('Error', 'Please enter a message.'); return; }
                                setSendingMessage(true);
                                try {
                                    const { error } = await supabase.from('admin_messages').insert({
                                        message: adminMessage.trim(),
                                        sender_id: profile?.id,
                                        sender_name: profile?.full_name || 'Teacher',
                                        direction: 'teacher_to_admin'
                                    });
                                    if (error) throw error;
                                    Alert.alert('Message Sent', 'Your message has been delivered to the admin.');
                                    setShowMessageAdmin(false); setAdminMessage('');
                                } catch (err: any) {
                                    Alert.alert('Error', err?.message || 'Failed to send message.');
                                } finally { setSendingMessage(false); }
                            }} disabled={sendingMessage}
                        >
                            {sendingMessage ? <ActivityIndicator color={Colors.white} /> : (
                                <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '600' }}>Send Message</Text>
                            )}
                        </AnimatedPressable>
                    </View>
                </Pressable>
            </Modal>
            {/* Teacher Announcement Modal */}
            <Modal visible={showTeacherAnnounce} animationType="slide" transparent>
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }} onPress={() => setShowTeacherAnnounce(false)}>
                    <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40, maxHeight: '90%' }} onStartShouldSetResponder={() => true}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                    <MaterialIcons name="campaign" size={20} color="#60a5fa" />
                                </View>
                                <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.white }}>Announce to Section</Text>
                            </View>
                            <AnimatedPressable onPress={() => setShowTeacherAnnounce(false)}>
                                <MaterialIcons name="close" size={24} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>

                        <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5, marginBottom: 6 }}>SELECT SECTION</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                            {sections.map((sec: any) => (
                                <AnimatedPressable key={sec.id} onPress={() => setAnnSection(sec.name)}
                                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: annSection === sec.name ? '#6366f1' : '#0f172a', borderWidth: 1, borderColor: annSection === sec.name ? '#6366f1' : '#334155', marginRight: 8 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: annSection === sec.name ? Colors.white : '#94a3b8' }}>{sec.name}</Text>
                                </AnimatedPressable>
                            ))}
                        </ScrollView>

                        <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5, marginBottom: 6 }}>TITLE</Text>
                        <TextInput
                            style={{ backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.white, fontSize: 14, marginBottom: 20 }}
                            value={annTitle} onChangeText={setAnnTitle}
                            placeholder="e.g. Class Cancelled, Room Change" placeholderTextColor="#6b7280"
                        />
                        <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5, marginBottom: 6 }}>MESSAGE</Text>
                        <TextInput
                            style={{ backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.white, fontSize: 14, height: 100, textAlignVertical: 'top', marginBottom: 20 }}
                            value={annContent} onChangeText={setAnnContent}
                            placeholder="Describe your announcement" placeholderTextColor="#6b7280" multiline
                        />
                        <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5, marginBottom: 6 }}>AUTO-EXPIRE AFTER</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
                            {[{ label: '1 Hour', val: '1h' }, { label: '6 Hours', val: '6h' }, { label: '12 Hours', val: '12h' }, { label: '1 Day', val: '1d' }, { label: '3 Days', val: '3d' }, { label: '7 Days', val: '7d' }, { label: 'Never', val: 'never' }].map(opt => (
                                <AnimatedPressable key={opt.val} onPress={() => setAnnExpiry(opt.val)}
                                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: annExpiry === opt.val ? '#f59e0b' : '#0f172a', borderWidth: 1, borderColor: annExpiry === opt.val ? '#f59e0b' : '#334155', marginRight: 8 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: annExpiry === opt.val ? '#0f172a' : '#94a3b8' }}>{opt.label}</Text>
                                </AnimatedPressable>
                            ))}
                        </ScrollView>
                        <AnimatedPressable
                            style={{ backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, opacity: sendingAnn ? 0.6 : 1 }}
                            onPress={async () => {
                                if (!annTitle.trim() || !annContent.trim() || !annSection) { Alert.alert('Error', 'Please fill in all fields and select a section.'); return; }
                                setSendingAnn(true);
                                try {
                                    const expiryMap: Record<string, number | null> = { '1h': 1, '6h': 6, '12h': 12, '1d': 24, '3d': 72, '7d': 168, 'never': null };
                                    const hours = expiryMap[annExpiry];
                                    const expiresAt = hours ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString() : null;
                                    const { error } = await supabase.from('announcements').insert({
                                        title: `[${annSection}] ${annTitle.trim()}`,
                                        content: annContent.trim(),
                                        priority: 'normal',
                                        author_name: profile?.full_name || 'Teacher',
                                        author_id: profile?.id,
                                        expires_at: expiresAt,
                                        target_section: annSection,
                                    });
                                    if (error) throw error;
                                    Alert.alert('Announced \u2705', `Your announcement for section "${annSection}" has been posted.${hours ? ` It will auto-expire in ${annExpiry}.` : ''}`);
                                    setShowTeacherAnnounce(false); setAnnTitle(''); setAnnContent(''); setAnnSection(''); setAnnExpiry('never');
                                } catch (err: any) {
                                    Alert.alert('Error', err?.message || 'Failed to post announcement.');
                                } finally { setSendingAnn(false); }
                            }} disabled={sendingAnn}
                        >
                            {sendingAnn ? <ActivityIndicator color={Colors.white} /> : (
                                <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '600' }}>Post Announcement</Text>
                            )}
                        </AnimatedPressable>

                        {/* My Announcements - Edit/Delete */}
                        {announcements.filter((a: any) => a.author_id === profile?.id).length > 0 && (
                            <View style={{ marginTop: 20 }}>
                                <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5, marginBottom: 8 }}>MY ANNOUNCEMENTS</Text>
                                {announcements.filter((a: any) => a.author_id === profile?.id).map((ann: any) => (
                                    <View key={ann.id} style={{ backgroundColor: '#0f172a', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#334155' }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <View style={{ flex: 1, marginRight: 8 }}>
                                                <Text style={{ color: Colors.white, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{ann.title}</Text>
                                                <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }} numberOfLines={2}>{ann.content}</Text>
                                                {ann.expires_at && <Text style={{ color: '#f59e0b', fontSize: 10, marginTop: 4 }}>Expires: {new Date(ann.expires_at).toLocaleString()}</Text>}
                                            </View>
                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                <AnimatedPressable onPress={() => {
                                                    setEditingAnn(ann);
                                                    setEditAnnTitle(ann.title);
                                                    setEditAnnContent(ann.content);
                                                }}>
                                                    <MaterialIcons name="edit" size={20} color="#60a5fa" />
                                                </AnimatedPressable>
                                                <AnimatedPressable onPress={() => {
                                                    Alert.alert('Delete Announcement', 'Are you sure?', [
                                                        { text: 'Cancel', style: 'cancel' },
                                                        {
                                                            text: 'Delete', style: 'destructive', onPress: async () => {
                                                                await supabase.from('announcements').delete().eq('id', ann.id);
                                                            }
                                                        }
                                                    ]);
                                                }}>
                                                    <MaterialIcons name="delete-outline" size={20} color="#ef4444" />
                                                </AnimatedPressable>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                </Pressable>
            </Modal>

            {/* Edit Announcement Modal */}
            <Modal visible={!!editingAnn} animationType="fade" transparent>
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 24 }} onPress={() => setEditingAnn(null)}>
                    <View style={{ backgroundColor: '#1e293b', borderRadius: 20, padding: 24 }} onStartShouldSetResponder={() => true}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.white }}>Edit Announcement</Text>
                            <AnimatedPressable onPress={() => setEditingAnn(null)}>
                                <MaterialIcons name="close" size={22} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>
                        <TextInput
                            style={{ backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.white, fontSize: 14, marginBottom: 12 }}
                            value={editAnnTitle} onChangeText={setEditAnnTitle}
                            placeholder="Title" placeholderTextColor="#6b7280" />
                        <TextInput
                            style={{ backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.white, fontSize: 14, height: 80, textAlignVertical: 'top', marginBottom: 16 }}
                            value={editAnnContent} onChangeText={setEditAnnContent}
                            placeholder="Content" placeholderTextColor="#6b7280" multiline />
                        <AnimatedPressable
                            style={{ backgroundColor: '#6366f1', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                            onPress={async () => {
                                if (!editingAnn) return;
                                try {
                                    await supabase.from('announcements').update({ title: editAnnTitle.trim(), content: editAnnContent.trim() }).eq('id', editingAnn.id);
                                    Alert.alert('Updated', 'Your announcement has been updated.');
                                    setEditingAnn(null);
                                } catch (err: any) {
                                    Alert.alert('Error', err?.message || 'Failed to update');
                                }
                            }}>
                            <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '600' }}>Save Changes</Text>
                        </AnimatedPressable>
                    </View>
                </Pressable>
            </Modal>

            {/* Create Event Modal */}
            <Modal visible={showEventModal} animationType="slide" transparent>
                <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }} onPress={() => setShowEventModal(false)}>
                    <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 }} onStartShouldSetResponder={() => true}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.white }}>Create Event</Text>
                            <AnimatedPressable onPress={() => setShowEventModal(false)}>
                                <MaterialIcons name="close" size={24} color="#94a3b8" />
                            </AnimatedPressable>
                        </View>

                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#94a3b8', letterSpacing: 1.5, marginBottom: 6 }}>TITLE *</Text>
                        <TextInput
                            style={{ backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.white, fontSize: 14, marginBottom: 12 }}
                            value={eventTitle} onChangeText={setEventTitle}
                            placeholder="e.g. School Assembly" placeholderTextColor="#6b7280"
                        />

                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#94a3b8', letterSpacing: 1.5, marginBottom: 6 }}>DESCRIPTION</Text>
                        <TextInput
                            style={{ backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.white, fontSize: 14, height: 70, textAlignVertical: 'top', marginBottom: 12 }}
                            value={eventDesc} onChangeText={setEventDesc}
                            placeholder="Optional details..." placeholderTextColor="#6b7280" multiline
                        />

                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#94a3b8', letterSpacing: 1.5, marginBottom: 6 }}>DATE * (YYYY-MM-DD)</Text>
                        <TextInput
                            style={{ backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.white, fontSize: 14, marginBottom: 12 }}
                            value={eventDate} onChangeText={setEventDate}
                            placeholder="2026-03-05" placeholderTextColor="#6b7280"
                        />

                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 10, fontWeight: '600', color: '#94a3b8', letterSpacing: 1.5, marginBottom: 6 }}>START TIME</Text>
                                <TextInput
                                    style={{ backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.white, fontSize: 14 }}
                                    value={eventStartTime} onChangeText={setEventStartTime}
                                    placeholder="08:00" placeholderTextColor="#6b7280"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 10, fontWeight: '600', color: '#94a3b8', letterSpacing: 1.5, marginBottom: 6 }}>END TIME</Text>
                                <TextInput
                                    style={{ backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: Colors.white, fontSize: 14 }}
                                    value={eventEndTime} onChangeText={setEventEndTime}
                                    placeholder="10:00" placeholderTextColor="#6b7280"
                                />
                            </View>
                        </View>

                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#94a3b8', letterSpacing: 1.5, marginBottom: 6 }}>ROOM</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, maxHeight: 40 }}>
                            <AnimatedPressable onPress={() => setEventRoom('')} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 8, backgroundColor: !eventRoom ? '#10b981' : '#0f172a', borderWidth: 1, borderColor: !eventRoom ? '#10b981' : '#334155' }}>
                                <Text style={{ color: !eventRoom ? '#fff' : '#94a3b8', fontSize: 12, fontWeight: '600' }}>None</Text>
                            </AnimatedPressable>
                            {rooms.map(r => (
                                <AnimatedPressable key={r.id} onPress={() => setEventRoom(r.name)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 8, backgroundColor: eventRoom === r.name ? '#10b981' : '#0f172a', borderWidth: 1, borderColor: eventRoom === r.name ? '#10b981' : '#334155' }}>
                                    <Text style={{ color: eventRoom === r.name ? '#fff' : '#94a3b8', fontSize: 12, fontWeight: '600' }}>{r.name}</Text>
                                </AnimatedPressable>
                            ))}
                        </ScrollView>

                        <AnimatedPressable
                            style={{ backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 16, alignItems: 'center' }}
                            onPress={async () => {
                                if (!eventTitle.trim() || !eventDate.trim()) {
                                    showToast({ type: 'error', title: 'Missing fields', message: 'Title and date are required.' });
                                    return;
                                }
                                setCreatingEvent(true);
                                try {
                                    await createEvent({
                                        title: eventTitle.trim(),
                                        description: eventDesc.trim() || undefined,
                                        event_date: eventDate.trim(),
                                        start_time: eventStartTime.trim() || undefined,
                                        end_time: eventEndTime.trim() || undefined,
                                        room: eventRoom || undefined,
                                        created_by: profile?.id || '',
                                        creator_name: profile?.full_name || 'Teacher',
                                        creator_role: 'teacher',
                                    });
                                    showToast({ type: 'success', title: 'Event Created!', message: `"${eventTitle}" scheduled for ${eventDate}` });
                                    setShowEventModal(false);
                                    setEventTitle(''); setEventDesc(''); setEventStartTime(''); setEventEndTime(''); setEventRoom('');
                                } catch (err: any) {
                                    showToast({ type: 'error', title: 'Failed to create event', message: err?.message || 'Please try again.' });
                                } finally { setCreatingEvent(false); }
                            }}
                            disabled={creatingEvent}
                        >
                            {creatingEvent ? <ActivityIndicator color={Colors.white} /> : (
                                <Text style={{ color: Colors.white, fontSize: 15, fontWeight: '600' }}>Create Event</Text>
                            )}
                        </AnimatedPressable>
                    </View>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, paddingVertical: 16
    },
    greeting: { fontSize: 14, color: Colors.slate400 },
    userName: { fontSize: 22, fontWeight: '700', color: Colors.white, marginTop: 2 },
    notifBtn: { position: 'relative', padding: 8 },
    notifDot: {
        position: 'absolute', top: 6, right: 6,
        width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444'
    },
    scrollView: { flex: 1, paddingHorizontal: 20 },

    statsRow: {
        flexDirection: 'row', backgroundColor: Colors.surfaceDark,
        borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderDark, marginBottom: 24
    },
    statBox: { flex: 1, alignItems: 'center', gap: 4 },
    statBoxBorder: {
        borderLeftWidth: 1, borderRightWidth: 1,
        borderColor: 'rgba(51,65,85,0.5)'
    },
    statNumber: { fontSize: 24, fontWeight: '700', color: Colors.white },
    statLabel: { fontSize: 11, color: Colors.slate400 },

    sectionHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14
    },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.white },
    sectionDay: { fontSize: 13, color: Colors.primary, fontWeight: '500' },

    emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
    emptyText: { fontSize: 16, color: Colors.slate400, fontWeight: '500' },
    emptySubtext: { fontSize: 13, color: Colors.slate600 },

    classCard: {
        flexDirection: 'row', backgroundColor: Colors.surfaceDark,
        borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.borderDark,
        overflow: 'hidden'
    },
    colorStripe: { width: 4 },
    cardContent: { flex: 1, padding: 14, gap: 6 },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardSubject: { fontSize: 15, fontWeight: '600', color: Colors.white },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    statusText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
    cardSection: { fontSize: 12, color: Colors.slate400 },
    cardDetails: { flexDirection: 'row', gap: 16, marginTop: 4 },
    cardDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    cardDetailText: { fontSize: 12, color: Colors.slate500 },
    fab: {
        position: 'absolute', bottom: 96, right: 20, width: 56, height: 56, borderRadius: 28,
        backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
        elevation: 8, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8
    }
});

export default TeacherDashboard;
