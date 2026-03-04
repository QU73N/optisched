import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import {
    View, Text, ScrollView, StyleSheet, StatusBar,
    Modal, TextInput, Alert, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import { useAdminDashboardStats, useAnnouncements, useScheduleChangeRequests, useRooms, useSections } from '../../hooks/useSupabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../config/supabase';
import ManualScheduleEditor from './ManualScheduleEditor';
import AdminScheduleTask from './AdminScheduleTask';
import AdminDataManagement from './AdminDataManagement';
import AdminManageUsers from './AdminManageUsers';
import { useCustomEvents } from '../../hooks/useCustomEvents';
import { useToast } from '../../components/CustomToast';
import { AnimatedPressable } from '../../components/AnimatedPressable';

const AdminDashboard: React.FC = () => {
    const { stats, loading } = useAdminDashboardStats();
    const { profile } = useAuth();
    const { colors } = useTheme();
    const { announcements, createAnnouncement, updateAnnouncement, deleteAnnouncement } = useAnnouncements();
    const { requests, updateRequestStatus } = useScheduleChangeRequests('pending');
    const navigation = useNavigation<any>();

    // Announcement modal
    const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
    const [annTitle, setAnnTitle] = useState('');
    const [annContent, setAnnContent] = useState('');
    const [annPriority, setAnnPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
    const [annSection, setAnnSection] = useState('All Sections');
    const [posting, setPosting] = useState(false);
    const { sections } = useSections();

    // Edit announcement state
    const [editingAnn, setEditingAnn] = useState<{ id: string; title: string; content: string; priority: string } | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [editPriority, setEditPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
    const [updating, setUpdating] = useState(false);

    // Quick actions modals
    const [showQuickActions, setShowQuickActions] = useState(false);
    const [quickScreen, setQuickScreen] = useState<'tasks' | 'data' | 'users' | 'alerts' | null>(null);

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
    const { showToast } = useToast();
    const { rooms } = useRooms();

    // Teacher messages
    const [teacherMessages, setTeacherMessages] = useState<any[]>([]);
    const [replyTo, setReplyTo] = useState<any | null>(null);
    const [replyText, setReplyText] = useState('');
    const [showConvoModal, setShowConvoModal] = useState(false);
    const [convoMessages, setConvoMessages] = useState<any[]>([]);
    const [sendingReply, setSendingReply] = useState(false);
    const fetchMessages = async () => {
        try {
            const { data } = await supabase.from('admin_messages').select('*').order('created_at', { ascending: false }).limit(20);
            setTeacherMessages(data || []);
        } catch { /* table may not exist */ }
    };
    React.useEffect(() => { fetchMessages(); }, []);

    const openConversation = async (msg: any) => {
        setReplyTo(msg);
        setShowConvoModal(true);
        // Fetch all messages between admin and this teacher
        try {
            const { data } = await supabase.from('admin_messages').select('*')
                .or(`sender_id.eq.${msg.sender_id},recipient_id.eq.${msg.sender_id}`)
                .order('created_at', { ascending: true });
            setConvoMessages(data || []);
            // Mark as read
            await supabase.from('admin_messages').update({ status: 'read' })
                .eq('sender_id', msg.sender_id).eq('status', 'unread');
            fetchMessages();
        } catch { setConvoMessages([msg]); }
    };

    const handleSendReply = async () => {
        if (!replyText.trim() || !replyTo) return;
        setSendingReply(true);
        try {
            await supabase.from('admin_messages').insert({
                sender_id: profile?.id,
                sender_name: profile?.full_name || 'Admin',
                recipient_id: replyTo.sender_id,
                message: replyText.trim(),
                status: 'sent',
                direction: 'admin_to_teacher',
            });
            setReplyText('');
            // Refresh conversation
            const { data } = await supabase.from('admin_messages').select('*')
                .or(`sender_id.eq.${replyTo.sender_id},recipient_id.eq.${replyTo.sender_id}`)
                .order('created_at', { ascending: true });
            setConvoMessages(data || []);
            fetchMessages();
        } catch { Alert.alert('Error', 'Failed to send reply.'); }
        finally { setSendingReply(false); }
    };

    const conflictFreePercent = stats.totalSchedules > 0
        ? Math.round(((stats.totalSchedules - (stats.totalConflicts - stats.resolvedConflicts)) / stats.totalSchedules) * 100)
        : 100;

    const handlePostAnnouncement = async () => {
        if (!annTitle.trim() || !annContent.trim()) {
            Alert.alert('Error', 'Please fill in both title and content.');
            return;
        }
        setPosting(true);
        try {
            const titlePrefix = annSection === 'All Sections' ? '[All Sections]' : `[${annSection}]`;
            await createAnnouncement(`${titlePrefix} ${annTitle.trim()}`, annContent.trim(), profile?.id || '', profile?.full_name || 'Admin', annPriority, annSection);
            Alert.alert('Success', 'Announcement posted! Students and teachers will see it.');
            setShowAnnouncementModal(false);
            setAnnTitle('');
            setAnnContent('');
            setAnnPriority('normal');
            setAnnSection('All Sections');
        } catch (err) {
            Alert.alert('Error', 'Failed to post announcement. Make sure the announcements table exists in Supabase.');
        } finally {
            setPosting(false);
        }
    };

    const openEditModal = (ann: any) => {
        setEditingAnn(ann);
        setEditTitle(ann.title);
        setEditContent(ann.content);
        setEditPriority(ann.priority || 'normal');
        setShowEditModal(true);
    };

    const handleUpdateAnnouncement = async () => {
        if (!editingAnn || !editTitle.trim() || !editContent.trim()) {
            Alert.alert('Error', 'Title and content are required.');
            return;
        }
        setUpdating(true);
        try {
            await updateAnnouncement(editingAnn.id, {
                title: editTitle.trim(),
                content: editContent.trim(),
                priority: editPriority
            });
            Alert.alert('Updated', 'Announcement has been updated.');
            setShowEditModal(false);
            setEditingAnn(null);
        } catch (err) {
            Alert.alert('Error', 'Failed to update announcement.');
        } finally {
            setUpdating(false);
        }
    };

    const handleDeleteAnnouncement = (id: string, title: string) => {
        Alert.alert('Delete Announcement', `Are you sure you want to delete "${title}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteAnnouncement(id);
                        Alert.alert('Deleted', 'Announcement has been removed.');
                    } catch { Alert.alert('Error', 'Failed to delete.'); }
                }
            },
        ]);
    };

    const handleApproveReject = (id: string, action: 'approved' | 'rejected') => {
        Alert.alert(
            action === 'approved' ? 'Approve Request' : 'Reject Request',
            `Are you sure you want to ${action === 'approved' ? 'approve' : 'reject'} this schedule change?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: action === 'approved' ? 'Approve' : 'Reject',
                    style: action === 'rejected' ? 'destructive' : 'default',
                    onPress: async () => {
                        try {
                            await updateRequestStatus(id, action);
                            Alert.alert('Done', `Request has been ${action}.`);
                        } catch { Alert.alert('Error', 'Failed to update request.'); }
                    }
                },
            ]
        );
    };

    const priorityColors: Record<string, string> = {
        normal: '#60a5fa',
        important: '#fbbf24',
        urgent: '#ef4444'
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={colors.isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerLabel}>ADMIN PANEL</Text>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Dashboard</Text>
                </View>
                <AnimatedPressable style={styles.notifBtn} onPress={() => setShowAnnouncementModal(true)}>
                    <MaterialIcons name="campaign" size={24} color="#fb923c" />
                </AnimatedPressable>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Semester Hero Card */}
                <View style={styles.heroCard}>
                    <View style={styles.heroGlow} />
                    <View style={styles.heroContent}>
                        <View style={styles.heroLabelRow}>
                            <View style={styles.heroBadge}>
                                <Text style={styles.heroBadgeText}>📊 Schedule Overview</Text>
                            </View>
                        </View>
                        <Text style={styles.heroTitle}>🏫 Current Schedule</Text>
                        <Text style={styles.heroSubtitle}>STI College Meycauayan</Text>
                        <View style={styles.heroStats}>
                            <View>
                                <Text style={styles.heroStatLabel}>Overall Status</Text>
                                <View style={styles.heroStatRow}>
                                    <MaterialIcons name="check-circle" size={16} color="#86efac" />
                                    <Text style={styles.heroStatValue}>Published</Text>
                                </View>
                            </View>
                            <View style={styles.heroStatRight}>
                                <Text style={styles.heroPercentage}>{conflictFreePercent}%</Text>
                                <Text style={styles.heroStatLabel}>Conflict Free</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.quickActionsRow}>
                    <AnimatedPressable style={styles.quickAction} onPress={() => setShowAnnouncementModal(true)}>
                        <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(251,146,60,0.15)' }]}>
                            <MaterialIcons name="campaign" size={20} color="#fb923c" />
                        </View>
                        <Text style={styles.quickActionText} numberOfLines={1}>📢 Announce</Text>
                    </AnimatedPressable>
                    <AnimatedPressable style={styles.quickAction} onPress={() => navigation.navigate('AI')}>
                        <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
                            <MaterialIcons name="smart-toy" size={20} color="#818cf8" />
                        </View>
                        <Text style={styles.quickActionText} numberOfLines={1}>AI Schedule</Text>
                    </AnimatedPressable>
                    <AnimatedPressable style={styles.quickAction} onPress={() => setShowEventModal(true)}>
                        <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
                            <MaterialIcons name="event" size={20} color="#34d399" />
                        </View>
                        <Text style={styles.quickActionText} numberOfLines={1}>Add Event</Text>
                    </AnimatedPressable>
                </View>

                {/* Upcoming Events */}
                {upcomingEvents.length > 0 && (
                    <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#94a3b8', letterSpacing: 1.5, marginBottom: 8 }}>📆 UPCOMING EVENTS</Text>
                        {upcomingEvents.map((evt: any) => {
                            const isToday = evt.event_date === todayStr;
                            const dateLabel = isToday ? 'Today' : new Date(evt.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            return (
                                <View key={evt.id} style={{ backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' }}>
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
                    </View>
                )}

                {/* More Quick Actions */}
                <AnimatedPressable
                    style={{ marginBottom: 20 }}
                    onPress={() => setShowQuickActions(!showQuickActions)}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1e293b', borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: '#334155' }}>
                        <MaterialIcons name={showQuickActions ? 'expand-less' : 'expand-more'} size={18} color={Colors.slate400} />
                        <Text style={{ color: Colors.slate400, fontSize: 12, fontWeight: '600' }}>{showQuickActions ? 'Hide' : 'More'} Quick Actions</Text>
                    </View>
                </AnimatedPressable>
                {showQuickActions && (
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
                        {[
                            { icon: 'calendar-month', color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', label: 'Schedule', screen: 'tasks' },
                            { icon: 'library-books', color: '#34d399', bg: 'rgba(16,185,129,0.12)', label: 'Data Mgmt', screen: 'data' },
                            { icon: 'people', color: '#c084fc', bg: 'rgba(168,85,247,0.12)', label: 'Manage Users', screen: 'users' },
                            { icon: 'warning', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Alerts', screen: 'alerts' },
                        ].map((item, i) => (
                            <AnimatedPressable key={i}
                                style={{ flex: 1, minWidth: '30%', alignItems: 'center', gap: 6, backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 14, borderWidth: 1, borderColor: '#334155' }}
                                onPress={() => {
                                    setShowQuickActions(false);
                                    if (item.screen) setQuickScreen(item.screen as 'tasks' | 'data' | 'users' | 'alerts');
                                }}
                            >
                                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: item.bg, justifyContent: 'center', alignItems: 'center' }}>
                                    <MaterialIcons name={item.icon as any} size={18} color={item.color} />
                                </View>
                                <Text style={{ color: Colors.slate300, fontSize: 11, fontWeight: '600' }}>{item.label}</Text>
                            </AnimatedPressable>
                        ))}
                    </View>
                )}

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <View style={[styles.statCard, styles.glassCard]}>
                        <View style={styles.statCardHeader}>
                            <View style={[styles.statIconBg, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                                <MaterialIcons name="meeting-room" size={22} color="#34d399" />
                            </View>
                        </View>
                        <Text style={styles.statValue}>{stats.conflictFreeRate}%</Text>
                        <Text style={styles.statLabel}>Conflict-Free</Text>
                    </View>
                    <View style={[styles.statCard, styles.glassCard]}>
                        <View style={styles.statCardHeader}>
                            <View style={[styles.statIconBg, { backgroundColor: 'rgba(251,146,60,0.1)' }]}>
                                <MaterialIcons name="people" size={22} color="#fb923c" />
                            </View>
                        </View>
                        <Text style={styles.statValue}>{stats.teacherCount}</Text>
                        <Text style={styles.statLabel}>Total Faculty</Text>
                    </View>
                </View>

                {/* Pending Schedule Requests */}
                {requests.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>📨 Pending Schedule Requests ({requests.length})</Text>
                        {requests.map(req => (
                            <View key={req.id} style={styles.requestCard}>
                                <View style={styles.requestHeader}>
                                    <Text style={styles.requestTeacher}>{req.teacher_name}</Text>
                                    <View style={[styles.requestBadge, { backgroundColor: 'rgba(251,191,36,0.15)' }]}>
                                        <Text style={{ color: '#fbbf24', fontSize: 10, fontWeight: '600' }}>PENDING</Text>
                                    </View>
                                </View>
                                <Text style={styles.requestReason}>{req.reason}</Text>
                                {req.proposed_day && (
                                    <Text style={styles.requestProposed}>Proposed: {req.proposed_day} {req.proposed_time}</Text>
                                )}
                                <View style={styles.requestActions}>
                                    <AnimatedPressable style={styles.approveBtn} onPress={() => handleApproveReject(req.id, 'approved')}>
                                        <MaterialIcons name="check" size={16} color="#10b981" />
                                        <Text style={styles.approveBtnText}>Approve</Text>
                                    </AnimatedPressable>
                                    <AnimatedPressable style={styles.rejectBtn} onPress={() => handleApproveReject(req.id, 'rejected')}>
                                        <MaterialIcons name="close" size={16} color="#ef4444" />
                                        <Text style={styles.rejectBtnText}>Reject</Text>
                                    </AnimatedPressable>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Recent Announcements */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionLabel}>📢 Recent Announcements</Text>
                        <AnimatedPressable onPress={() => setShowAnnouncementModal(true)}>
                            <Text style={styles.viewAllText}>+ New</Text>
                        </AnimatedPressable>
                    </View>
                    {announcements.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <MaterialIcons name="campaign" size={32} color={Colors.slate600} />
                            <Text style={{ color: Colors.slate500, marginTop: 8 }}>💭 No announcements yet</Text>
                        </View>
                    ) : (
                        announcements.slice(0, 5).map(ann => (
                            <View key={ann.id} style={styles.announcementCard}>
                                <View style={[styles.annDot, { backgroundColor: priorityColors[ann.priority] || '#60a5fa' }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.annTitle}>{ann.title}</Text>
                                    <Text style={styles.annContent} numberOfLines={2}>{ann.content}</Text>
                                    <Text style={styles.annMeta}>{ann.author_name} • {new Date(ann.created_at).toLocaleDateString()}</Text>
                                </View>
                                <View style={styles.annActions}>
                                    <AnimatedPressable
                                        style={styles.annActionBtn}
                                        onPress={() => openEditModal(ann)}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <MaterialIcons name="edit" size={16} color={Colors.slate400} />
                                    </AnimatedPressable>
                                    <AnimatedPressable
                                        style={styles.annActionBtn}
                                        onPress={() => handleDeleteAnnouncement(ann.id, ann.title)}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <MaterialIcons name="delete-outline" size={16} color="#ef4444" />
                                    </AnimatedPressable>
                                </View>
                            </View>
                        ))
                    )}
                </View>

                {/* Teacher Messages */}
                {teacherMessages.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionLabel}>Teacher Messages ({teacherMessages.length})</Text>
                            <AnimatedPressable onPress={fetchMessages}>
                                <Text style={styles.viewAllText}>Refresh</Text>
                            </AnimatedPressable>
                        </View>
                        {teacherMessages.slice(0, 5).map(msg => (
                            <AnimatedPressable key={msg.id} onPress={() => openConversation(msg)} activeOpacity={0.7}
                                style={{ backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: msg.status === 'unread' ? 'rgba(59,130,246,0.3)' : '#334155' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(16,185,129,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                            <MaterialIcons name="person" size={14} color="#34d399" />
                                        </View>
                                        <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.white }}>{msg.sender_name || 'Teacher'}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        {msg.status === 'unread' && (
                                            <View style={{ backgroundColor: 'rgba(59,130,246,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                <Text style={{ fontSize: 9, fontWeight: '700', color: '#60a5fa' }}>NEW</Text>
                                            </View>
                                        )}
                                        <MaterialIcons name="reply" size={16} color={Colors.slate500} />
                                    </View>
                                </View>
                                <Text style={{ fontSize: 13, color: Colors.slate300, lineHeight: 19 }}>{msg.message}</Text>
                                <Text style={{ fontSize: 10, color: Colors.slate600, marginTop: 6 }}>{msg.created_at ? new Date(msg.created_at).toLocaleString() : ''}</Text>
                            </AnimatedPressable>
                        ))}
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Create Announcement Modal */}
            <Modal visible={showAnnouncementModal} animationType="fade" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 20 }}>
                    <View style={{ backgroundColor: '#1e293b', borderRadius: 20, overflow: 'hidden', maxHeight: '80%' }}>
                        {/* Fixed Header */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#334155' }}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.white }}>Post Announcement</Text>
                            <AnimatedPressable onPress={() => setShowAnnouncementModal(false)} style={{ padding: 4 }}>
                                <MaterialIcons name="close" size={22} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>

                        {/* Scrollable Body */}
                        <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5, marginTop: 16, marginBottom: 6 }}>TITLE</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={annTitle} onChangeText={setAnnTitle}
                                placeholder="Announcement title" placeholderTextColor="#6b7280"
                            />

                            <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5, marginTop: 14, marginBottom: 6 }}>MESSAGE</Text>
                            <TextInput
                                style={[styles.modalInput, { minHeight: 80, maxHeight: 120, textAlignVertical: 'top', paddingTop: 12 }]}
                                value={annContent} onChangeText={setAnnContent}
                                placeholder="Write your announcement..." placeholderTextColor="#6b7280"
                                multiline
                            />

                            <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5, marginTop: 14, marginBottom: 6 }}>PRIORITY</Text>
                            <View style={styles.priorityRow}>
                                {(['normal', 'important', 'urgent'] as const).map(p => (
                                    <AnimatedPressable key={p} onPress={() => setAnnPriority(p)}
                                        style={[styles.priorityChip, annPriority === p && { borderColor: priorityColors[p], backgroundColor: `${priorityColors[p]}15` }]}>
                                        <Text style={[styles.priorityText, annPriority === p && { color: priorityColors[p] }]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
                                    </AnimatedPressable>
                                ))}
                            </View>

                            <Text style={{ fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5, marginTop: 14, marginBottom: 6 }}>TARGET SECTION</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 40 }}>
                                <AnimatedPressable onPress={() => setAnnSection('All Sections')} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 8, backgroundColor: annSection === 'All Sections' ? Colors.primary : '#0f172a', borderWidth: 1, borderColor: annSection === 'All Sections' ? Colors.primary : '#334155' }}>
                                    <Text style={{ color: annSection === 'All Sections' ? '#fff' : '#94a3b8', fontSize: 12, fontWeight: '600' }}>All Sections</Text>
                                </AnimatedPressable>
                                {sections.map(s => (
                                    <AnimatedPressable key={s.id} onPress={() => setAnnSection(s.name)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 8, backgroundColor: annSection === s.name ? Colors.primary : '#0f172a', borderWidth: 1, borderColor: annSection === s.name ? Colors.primary : '#334155' }}>
                                        <Text style={{ color: annSection === s.name ? '#fff' : '#94a3b8', fontSize: 12, fontWeight: '600' }}>{s.name}</Text>
                                    </AnimatedPressable>
                                ))}
                            </ScrollView>
                            <View style={{ height: 8 }} />
                        </ScrollView>

                        {/* Fixed Footer Button */}
                        <View style={{ paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#334155' }}>
                            <AnimatedPressable
                                style={{ backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                                onPress={handlePostAnnouncement} disabled={posting}
                            >
                                {posting ? <ActivityIndicator color={Colors.white} /> : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <MaterialIcons name="campaign" size={18} color={Colors.white} />
                                        <Text style={{ color: Colors.white, fontSize: 14, fontWeight: '600' }}>Post Announcement</Text>
                                    </View>
                                )}
                            </AnimatedPressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Edit Announcement Modal */}
            <Modal visible={showEditModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Announcement</Text>
                            <AnimatedPressable onPress={() => { setShowEditModal(false); setEditingAnn(null); }}>
                                <MaterialIcons name="close" size={24} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>

                        <Text style={styles.fieldLabel}>TITLE</Text>
                        <TextInput style={styles.modalInput} value={editTitle} onChangeText={setEditTitle}
                            placeholder="Announcement title" placeholderTextColor="#6b7280" />

                        <Text style={styles.fieldLabel}>MESSAGE</Text>
                        <TextInput style={[styles.modalInput, { height: 100, textAlignVertical: 'top' }]}
                            value={editContent} onChangeText={setEditContent}
                            placeholder="Write your announcement..." placeholderTextColor="#6b7280"
                            multiline numberOfLines={4} />

                        <Text style={styles.fieldLabel}>PRIORITY</Text>
                        <View style={styles.priorityRow}>
                            {(['normal', 'important', 'urgent'] as const).map(p => (
                                <AnimatedPressable key={p} onPress={() => setEditPriority(p)}
                                    style={[styles.priorityChip, editPriority === p && { borderColor: priorityColors[p], backgroundColor: `${priorityColors[p]}15` }]}>
                                    <Text style={[styles.priorityText, editPriority === p && { color: priorityColors[p] }]}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
                                </AnimatedPressable>
                            ))}
                        </View>

                        <AnimatedPressable style={[styles.modalBtn, { backgroundColor: '#f59e0b' }]} onPress={handleUpdateAnnouncement} disabled={updating}>
                            {updating ? <ActivityIndicator color={Colors.white} /> : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <MaterialIcons name="save" size={18} color={Colors.white} />
                                    <Text style={styles.modalBtnText}>Save Changes</Text>
                                </View>
                            )}
                        </AnimatedPressable>
                    </View>
                </View>
            </Modal>

            {/* Quick Screen Modal */}
            <Modal visible={quickScreen !== null} animationType="slide">
                <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
                    <AnimatedPressable
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}
                        onPress={() => setQuickScreen(null)}
                    >
                        <MaterialIcons name="arrow-back" size={22} color={Colors.white} />
                        <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.white }}>
                            {quickScreen === 'tasks' ? 'Schedule Tasks' : quickScreen === 'data' ? 'Data Management' : quickScreen === 'alerts' ? 'Alerts' : 'Manage Users'}
                        </Text>
                    </AnimatedPressable>
                    {quickScreen === 'tasks' && <ManualScheduleEditor />}
                    {quickScreen === 'data' && <AdminDataManagement />}
                    {quickScreen === 'users' && <AdminManageUsers />}
                    {quickScreen === 'alerts' && <AdminScheduleTask />}
                </SafeAreaView>
            </Modal>

            {/* Conversation Modal */}
            <Modal visible={showConvoModal} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)' }}>
                    <View style={{ flex: 1, marginTop: 60, backgroundColor: '#0f172a', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }}>
                        {/* Convo Header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(16,185,129,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                                    <MaterialIcons name="person" size={18} color="#34d399" />
                                </View>
                                <View>
                                    <Text style={{ fontSize: 15, fontWeight: '700', color: Colors.white }}>{replyTo?.sender_name || 'Teacher'}</Text>
                                    <Text style={{ fontSize: 11, color: Colors.slate400 }}>Conversation</Text>
                                </View>
                            </View>
                            <AnimatedPressable onPress={() => { setShowConvoModal(false); setReplyTo(null); }} style={{ padding: 4 }}>
                                <MaterialIcons name="close" size={22} color={Colors.slate400} />
                            </AnimatedPressable>
                        </View>

                        {/* Messages */}
                        <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingVertical: 16 }} showsVerticalScrollIndicator={false}>
                            {convoMessages.map((m, i) => {
                                const isAdmin = m.direction === 'admin_to_teacher' || m.sender_id === profile?.id;
                                return (
                                    <View key={m.id || i} style={{ alignSelf: isAdmin ? 'flex-end' : 'flex-start', maxWidth: '80%', marginBottom: 10 }}>
                                        <View style={{ backgroundColor: isAdmin ? Colors.primary : '#1e293b', borderRadius: 16, padding: 12, borderBottomRightRadius: isAdmin ? 4 : 16, borderBottomLeftRadius: isAdmin ? 16 : 4 }}>
                                            <Text style={{ fontSize: 13, color: Colors.white, lineHeight: 19 }}>{m.message}</Text>
                                        </View>
                                        <Text style={{ fontSize: 9, color: Colors.slate600, marginTop: 3, textAlign: isAdmin ? 'right' : 'left' }}>
                                            {m.sender_name || (isAdmin ? 'You' : 'Teacher')} • {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </Text>
                                    </View>
                                );
                            })}
                        </ScrollView>

                        {/* Reply Input */}
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#1e293b', backgroundColor: '#141925' }}>
                            <TextInput
                                style={{ flex: 1, backgroundColor: '#1e293b', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: Colors.white, fontSize: 14, maxHeight: 80, borderWidth: 1, borderColor: '#334155' }}
                                placeholder="Type a reply..." placeholderTextColor="#64748b"
                                value={replyText} onChangeText={setReplyText} multiline
                            />
                            <AnimatedPressable
                                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: replyText.trim() ? Colors.primary : '#334155', justifyContent: 'center', alignItems: 'center' }}
                                onPress={handleSendReply} disabled={!replyText.trim() || sendingReply}
                            >
                                {sendingReply ? <ActivityIndicator size="small" color={Colors.white} /> : <MaterialIcons name="send" size={18} color={Colors.white} />}
                            </AnimatedPressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Create Event Modal */}
            <Modal visible={showEventModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Create Event</Text>
                            <AnimatedPressable onPress={() => setShowEventModal(false)}>
                                <MaterialIcons name="close" size={24} color="#94a3b8" />
                            </AnimatedPressable>
                        </View>

                        <Text style={styles.fieldLabel}>TITLE *</Text>
                        <TextInput style={styles.modalInput} value={eventTitle} onChangeText={setEventTitle}
                            placeholder="e.g. School Assembly" placeholderTextColor="#6b7280" />

                        <Text style={styles.fieldLabel}>DESCRIPTION</Text>
                        <TextInput style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]} value={eventDesc} onChangeText={setEventDesc}
                            placeholder="Optional details..." placeholderTextColor="#6b7280" multiline />

                        <Text style={styles.fieldLabel}>DATE * (YYYY-MM-DD)</Text>
                        <TextInput style={styles.modalInput} value={eventDate} onChangeText={setEventDate}
                            placeholder="2026-03-05" placeholderTextColor="#6b7280" />

                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.fieldLabel}>START TIME</Text>
                                <TextInput style={styles.modalInput} value={eventStartTime} onChangeText={setEventStartTime}
                                    placeholder="08:00" placeholderTextColor="#6b7280" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.fieldLabel}>END TIME</Text>
                                <TextInput style={styles.modalInput} value={eventEndTime} onChangeText={setEventEndTime}
                                    placeholder="10:00" placeholderTextColor="#6b7280" />
                            </View>
                        </View>

                        <Text style={styles.fieldLabel}>ROOM</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, maxHeight: 40 }}>
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
                            style={[styles.modalBtn, { backgroundColor: '#10b981', marginTop: 20 }]}
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
                                        creator_name: profile?.full_name || 'Admin',
                                        creator_role: 'admin',
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
                                <Text style={styles.modalBtnText}>Create Event</Text>
                            )}
                        </AnimatedPressable>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 24, paddingVertical: 16
    },
    headerLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondaryDark, letterSpacing: 1.5 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: Colors.white },
    notifBtn: { padding: 8, borderRadius: 999, backgroundColor: '#1e293b', position: 'relative' },
    notifDot: {
        position: 'absolute', top: 6, right: 6, width: 8, height: 8,
        borderRadius: 4, backgroundColor: Colors.error, borderWidth: 1, borderColor: '#1e293b'
    },
    scrollView: { flex: 1, paddingHorizontal: 24 },

    heroCard: { borderRadius: 24, padding: 24, marginBottom: 24, overflow: 'hidden', position: 'relative', backgroundColor: '#3b6cf6' },
    heroGlow: { position: 'absolute', right: -24, top: -24, width: 128, height: 128, borderRadius: 64, backgroundColor: 'rgba(255,255,255,0.1)' },
    heroContent: { position: 'relative', zIndex: 1 },
    heroLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    heroBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    heroBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '500' },
    heroTitle: { fontSize: 20, fontWeight: '700', color: Colors.white, marginBottom: 4 },
    heroSubtitle: { fontSize: 14, color: '#bfdbfe', marginBottom: 24 },
    heroStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    heroStatRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    heroStatLabel: { fontSize: 12, color: '#bfdbfe', marginBottom: 4 },
    heroStatValue: { fontSize: 16, fontWeight: '600', color: Colors.white },
    heroStatRight: { alignItems: 'flex-end' },
    heroPercentage: { fontSize: 30, fontWeight: '700', color: Colors.white },

    quickActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    quickAction: {
        flex: 1, alignItems: 'center', gap: 6,
        backgroundColor: '#1e293b', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 4,
        borderWidth: 1, borderColor: '#334155'
    },
    quickActionIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    quickActionText: { fontSize: 11, fontWeight: '600', color: Colors.white, textAlign: 'center' },

    statsGrid: { flexDirection: 'row', gap: 16, marginBottom: 24 },
    statCard: { flex: 1, padding: 16, borderRadius: 16, height: 120, justifyContent: 'space-between' },
    glassCard: { backgroundColor: 'rgba(30,41,59,0.7)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    statCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    statIconBg: { padding: 8, borderRadius: 8 },
    statValue: { fontSize: 24, fontWeight: '700', color: Colors.white },
    statLabel: { fontSize: 12, color: Colors.textSecondaryDark },

    section: { marginBottom: 24 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
    sectionLabel: { fontSize: 14, fontWeight: '600', color: Colors.textSecondaryDark, marginBottom: 12 },
    viewAllText: { fontSize: 12, color: '#818cf8', fontWeight: '600' },

    requestCard: {
        backgroundColor: '#1e293b', borderRadius: 14, padding: 16, marginBottom: 8,
        borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)'
    },
    requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    requestTeacher: { fontSize: 14, fontWeight: '600', color: Colors.white },
    requestBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    requestReason: { fontSize: 13, color: Colors.slate400, marginBottom: 4 },
    requestProposed: { fontSize: 12, color: '#60a5fa', marginBottom: 10 },
    requestActions: { flexDirection: 'row', gap: 8 },
    approveBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.1)',
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8
    },
    approveBtnText: { color: '#10b981', fontSize: 13, fontWeight: '600' },
    rejectBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.1)',
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8
    },
    rejectBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },

    announcementCard: {
        flexDirection: 'row', gap: 12, backgroundColor: '#1e293b', borderRadius: 12,
        padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#334155', overflow: 'hidden'
    },
    annDot: { width: 4, borderRadius: 2 },
    annTitle: { fontSize: 14, fontWeight: '600', color: Colors.white, marginBottom: 2, flexShrink: 1 },
    annContent: { fontSize: 12, color: Colors.slate400, marginBottom: 4, flexShrink: 1 },
    annMeta: { fontSize: 11, color: Colors.slate600 },
    annActions: { justifyContent: 'center', gap: 8 },
    annActionBtn: {
        width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center', alignItems: 'center'
    },

    emptyCard: {
        alignItems: 'center', paddingVertical: 24, backgroundColor: '#1e293b',
        borderRadius: 14, borderWidth: 1, borderColor: '#334155'
    },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
    fieldLabel: { fontSize: 10, fontWeight: '600', color: Colors.slate400, letterSpacing: 1.5, marginBottom: 6, marginTop: 12 },
    modalInput: {
        backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155',
        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
        color: Colors.white, fontSize: 14
    },
    priorityRow: { flexDirection: 'row', gap: 8 },
    priorityChip: {
        flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10,
        borderWidth: 1, borderColor: '#334155'
    },
    priorityText: { fontSize: 13, fontWeight: '500', color: Colors.slate400 },
    modalBtn: {
        backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16,
        alignItems: 'center', marginTop: 20
    },
    modalBtnText: { color: Colors.white, fontSize: 15, fontWeight: '600' }
});

export default AdminDashboard;
