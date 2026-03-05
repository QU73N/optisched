import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    TextInput, ActivityIndicator, Alert, FlatList, Modal, Image
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase, supabaseAdmin } from '../../config/supabase';
import { smartSend } from '../../utils/offlineQueue';
import { AnimatedPressable } from '../../components/AnimatedPressable';

interface Message {
    id: string;
    sender_id: string;
    sender_name: string;
    recipient_id?: string;
    message: string;
    direction: 'teacher_to_admin' | 'admin_to_teacher';
    created_at: string;
}

interface ResetRequest {
    id: string;
    email: string;
    user_id?: string;
    status: string;
    requested_at: string;
}

interface Conversation {
    teacherId: string;
    teacherName: string;
    lastMessage: string;
    lastTime: string;
    unread: number;
    avatar_url?: string | null;
}

const AdminChatInbox: React.FC = () => {
    const { profile } = useAuth();
    const { colors } = useTheme();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedTeacher, setSelectedTeacher] = useState<{ id: string; name: string } | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [resetRequests, setResetRequests] = useState<ResetRequest[]>([]);
    const scrollRef = useRef<ScrollView>(null);
    const [activeTab, setActiveTab] = useState<'chats' | 'resets'>('chats');
    const [allTeachers, setAllTeachers] = useState<Array<{ id: string; name: string; avatar_url?: string | null }>>([]);

    // Fetch all teacher profiles
    const fetchAllTeachers = async () => {
        try {
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .eq('role', 'teacher');
            if (data) setAllTeachers(data.map((p: any) => ({ id: p.id, name: p.full_name || 'Teacher', avatar_url: p.avatar_url })));
        } catch { /* ignore */ }
    };

    // Fetch all messages and group by teacher
    const fetchConversations = async () => {
        try {
            const { data } = await supabase
                .from('admin_messages')
                .select('*')
                .order('created_at', { ascending: false });

            if (data) {
                const grouped: Record<string, Conversation> = {};
                for (const msg of data as Message[]) {
                    const teacherId = msg.direction === 'teacher_to_admin' ? msg.sender_id : (msg.recipient_id || '');
                    const teacherName = msg.direction === 'teacher_to_admin' ? msg.sender_name : 'Teacher';
                    if (!teacherId) continue;
                    if (!grouped[teacherId]) {
                        grouped[teacherId] = {
                            teacherId, teacherName,
                            lastMessage: msg.message,
                            lastTime: msg.created_at,
                            unread: msg.direction === 'teacher_to_admin' ? 1 : 0,
                        };
                    } else {
                        if (msg.direction === 'teacher_to_admin') grouped[teacherId].unread++;
                    }
                }
                setConversations(Object.values(grouped));
            }
        } catch { /* ignore */ }
        setLoading(false);
    };

    const fetchResetRequests = async () => {
        try {
            const { data } = await supabase
                .from('password_reset_requests')
                .select('*')
                .eq('status', 'pending')
                .order('requested_at', { ascending: false });
            setResetRequests((data || []) as ResetRequest[]);
        } catch { /* ignore */ }
    };

    useEffect(() => {
        fetchConversations();
        fetchResetRequests();
        fetchAllTeachers();

        // Subscribe to real-time changes
        const msgChannel = supabase
            .channel('admin-inbox-messages')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_messages' }, () => {
                fetchConversations();
            })
            .subscribe();

        const resetChannel = supabase
            .channel('admin-inbox-resets')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'password_reset_requests' }, () => {
                fetchResetRequests();
            })
            .subscribe();

        return () => { supabase.removeChannel(msgChannel); supabase.removeChannel(resetChannel); };
    }, []);

    // Open a conversation
    const openConversation = async (teacherId: string, teacherName: string) => {
        setSelectedTeacher({ id: teacherId, name: teacherName });
        try {
            const { data } = await supabase
                .from('admin_messages')
                .select('*')
                .or(`sender_id.eq.${teacherId},recipient_id.eq.${teacherId}`)
                .order('created_at', { ascending: true });
            setMessages((data || []) as Message[]);
        } catch { /* ignore */ }
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    };

    // Real-time messages in open conversation
    useEffect(() => {
        if (!selectedTeacher) return;

        // Fetch immediately
        const fetchChat = async () => {
            const { data } = await supabase
                .from('admin_messages')
                .select('*')
                .or(`sender_id.eq.${selectedTeacher.id},recipient_id.eq.${selectedTeacher.id}`)
                .order('created_at', { ascending: true });
            if (data) setMessages(data as Message[]);
        };
        fetchChat();

        const channel = supabase
            .channel('admin-chat-' + selectedTeacher.id)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_messages' }, () => {
                fetchChat();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [selectedTeacher?.id]);

    const handleSend = async () => {
        if (!input.trim() || !profile?.id || !selectedTeacher) return;
        setSending(true);
        try {
            const payload = {
                sender_id: profile.id,
                sender_name: profile.full_name || 'Admin',
                recipient_id: selectedTeacher.id,
                message: input.trim(),
                direction: 'admin_to_teacher' as const,
            };
            const result = await smartSend('admin_messages', payload);
            setInput('');
            if (result.sent) {
                // Refresh messages
                const { data } = await supabase
                    .from('admin_messages')
                    .select('*')
                    .or(`sender_id.eq.${selectedTeacher.id},recipient_id.eq.${selectedTeacher.id}`)
                    .order('created_at', { ascending: true });
                if (data) setMessages(data as Message[]);
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
            } else if (result.queued) {
                Alert.alert('Offline', 'Message saved! It will be sent when you\'re back online.');
            }
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to send');
        }
        setSending(false);
    };

    const handleApproveReset = async (req: ResetRequest) => {
        Alert.alert(
            'Approve Reset',
            `Reset password for ${req.email}?\nNew password will be: surname + last 6 digits of their ID.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Approve & Reset',
                    onPress: async () => {
                        try {
                            // Find the user by email
                            const { data: userData } = await supabase
                                .from('profiles')
                                .select('id, full_name')
                                .eq('email', req.email)
                                .single();

                            if (!userData) {
                                Alert.alert('Error', 'User not found');
                                return;
                            }

                            // Generate password: surname + ID from email
                            // Email pattern: surname.ID@domain → extract surname and ID
                            const emailLocal = req.email.split('@')[0] || ''; // e.g. "morgado.399541"
                            const emailParts = emailLocal.split('.');
                            const surname = emailParts[0]?.toLowerCase() || (userData.full_name || '').split(' ').pop()?.toLowerCase() || 'user';
                            const idFromEmail = emailParts[1] || userData.id.slice(-6); // e.g. "399541"
                            const newPassword = `${surname}.${idFromEmail}`;

                            // Reset password via admin API
                            if (supabaseAdmin) {
                                const { error } = await supabaseAdmin.auth.admin.updateUserById(userData.id, {
                                    password: newPassword,
                                });
                                if (error) throw error;
                            } else {
                                throw new Error('Service key not configured');
                            }

                            // Mark request as resolved
                            await supabase.from('password_reset_requests').update({
                                status: 'approved',
                                resolved_at: new Date().toISOString(),
                                resolved_by: profile?.id,
                            }).eq('id', req.id);

                            fetchResetRequests();
                            Alert.alert('Done', `Password reset to: ${newPassword}\nPlease inform the user.`);
                        } catch (err: any) {
                            Alert.alert('Error', err?.message || 'Failed to reset password');
                        }
                    },
                },
            ]
        );
    };

    const handleDenyReset = async (req: ResetRequest) => {
        await supabase.from('password_reset_requests').update({
            status: 'denied',
            resolved_at: new Date().toISOString(),
            resolved_by: profile?.id,
        }).eq('id', req.id);
        fetchResetRequests();
        Alert.alert('Denied', 'Password reset request has been denied.');
    };

    // Chat view (inside a conversation)
    if (selectedTeacher) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Chat Header */}
                <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                    <AnimatedPressable onPress={() => { setSelectedTeacher(null); fetchConversations(); }} style={styles.backBtn}>
                        <MaterialIcons name="arrow-back" size={20} color={colors.textPrimary} />
                    </AnimatedPressable>
                    <View style={styles.headerAvatar}>
                        <MaterialIcons name="person" size={20} color="#818cf8" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>{selectedTeacher.name}</Text>
                        <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Teacher</Text>
                    </View>
                    <AnimatedPressable onPress={() => {
                        Alert.alert('Delete Conversation', `Delete all messages with ${selectedTeacher.name}?`, [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Delete', style: 'destructive', onPress: async () => {
                                    const { error } = await (supabaseAdmin || supabase).from('admin_messages').delete().or(`sender_id.eq.${selectedTeacher.id},recipient_id.eq.${selectedTeacher.id}`);
                                    if (error) { Alert.alert('Error', error.message); return; }
                                    setMessages([]);
                                    setSelectedTeacher(null);
                                    fetchConversations();
                                    Alert.alert('Done', 'Conversation deleted.');
                                }
                            },
                        ]);
                    }} style={styles.backBtn}>
                        <MaterialIcons name="delete-outline" size={20} color="#ef4444" />
                    </AnimatedPressable>
                </View>

                {/* Messages */}
                <ScrollView ref={scrollRef} style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingVertical: 16 }} showsVerticalScrollIndicator={false}>
                    {messages.map((msg, i) => {
                        const isAdmin = msg.direction === 'admin_to_teacher';
                        return (
                            <View key={msg.id || i} style={{ alignSelf: isAdmin ? 'flex-end' : 'flex-start', maxWidth: '80%', marginBottom: 10 }}>
                                <View style={[styles.bubble, isAdmin ? styles.bubbleAdmin : styles.bubbleTeacher]}>
                                    <Text style={[styles.bubbleText, { color: Colors.white }]}>{msg.message}</Text>
                                </View>
                                <Text style={[styles.bubbleMeta, { textAlign: isAdmin ? 'right' : 'left' }]}>
                                    {isAdmin ? 'You' : msg.sender_name} • {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </Text>
                            </View>
                        );
                    })}
                </ScrollView>

                {/* Input */}
                <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                    <TextInput
                        style={[styles.textInput, { backgroundColor: colors.isDark ? '#1e293b' : '#f1f5f9', color: colors.textPrimary, borderColor: colors.border }]}
                        placeholder="Reply..." placeholderTextColor={colors.textSecondary}
                        value={input} onChangeText={setInput} multiline maxLength={500}
                    />
                    <AnimatedPressable
                        style={[styles.sendBtn, { backgroundColor: input.trim() ? Colors.primary : '#334155' }]}
                        onPress={handleSend} disabled={!input.trim() || sending}
                    >
                        {sending ? <ActivityIndicator size="small" color={Colors.white} /> : <MaterialIcons name="send" size={18} color={Colors.white} />}
                    </AnimatedPressable>
                </View>
            </SafeAreaView>
        );
    }

    // Inbox view
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <View style={styles.headerAvatar}>
                    <MaterialIcons name="forum" size={22} color="#818cf8" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Messages</Text>
                    <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Teacher conversations & requests</Text>
                </View>
                {resetRequests.length > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{resetRequests.length}</Text>
                    </View>
                )}
            </View>

            {/* Tabs */}
            <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
                <AnimatedPressable style={[styles.tab, activeTab === 'chats' && styles.tabActive]} onPress={() => setActiveTab('chats')}>
                    <MaterialIcons name="chat" size={16} color={activeTab === 'chats' ? Colors.primary : colors.textSecondary} />
                    <Text style={[styles.tabText, activeTab === 'chats' && styles.tabTextActive]}>Chats</Text>
                </AnimatedPressable>
                <AnimatedPressable style={[styles.tab, activeTab === 'resets' && styles.tabActive]} onPress={() => setActiveTab('resets')}>
                    <MaterialIcons name="lock-reset" size={16} color={activeTab === 'resets' ? Colors.primary : colors.textSecondary} />
                    <Text style={[styles.tabText, activeTab === 'resets' && styles.tabTextActive]}>Password Resets</Text>
                    {resetRequests.length > 0 && (
                        <View style={[styles.badge, { marginLeft: 6, width: 18, height: 18 }]}><Text style={[styles.badgeText, { fontSize: 10 }]}>{resetRequests.length}</Text></View>
                    )}
                </AnimatedPressable>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : activeTab === 'chats' ? (
                /* Chats Tab */
                <View style={{ flex: 1 }}>
                    {/* Teacher List - Always visible */}
                    {allTeachers.length > 0 && (
                        <View style={{ paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600', paddingHorizontal: 16, marginBottom: 8, letterSpacing: 1 }}>TEACHERS</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
                                {allTeachers.map(t => (
                                    <AnimatedPressable key={t.id} style={{ alignItems: 'center', marginHorizontal: 6, width: 60 }}
                                        onPress={() => openConversation(t.id, t.name)}>
                                        {t.avatar_url ? (
                                            <Image source={{ uri: t.avatar_url }} style={{ width: 48, height: 48, borderRadius: 24 }} />
                                        ) : (
                                            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(99,102,241,0.12)', justifyContent: 'center', alignItems: 'center' }}>
                                                <Text style={{ fontSize: 18, fontWeight: '700', color: '#818cf8' }}>{t.name.charAt(0).toUpperCase()}</Text>
                                            </View>
                                        )}
                                        <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 4, textAlign: 'center' }} numberOfLines={1}>{t.name.split(' ')[0]}</Text>
                                    </AnimatedPressable>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Conversations */}
                    {conversations.length === 0 ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
                            <View style={styles.emptyIcon}>
                                <MaterialIcons name="chat-bubble-outline" size={48} color="#475569" />
                            </View>
                            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 16 }}>No Messages</Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
                                Tap a teacher above to start a conversation.
                            </Text>
                        </View>
                    ) : (
                        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                            {conversations.map(conv => (
                                <AnimatedPressable
                                    key={conv.teacherId}
                                    style={[styles.convRow, { borderBottomColor: colors.border }]}
                                    onPress={() => openConversation(conv.teacherId, conv.teacherName)}
                                >
                                    <View style={[styles.convAvatar, { backgroundColor: 'rgba(99,102,241,0.12)' }]}>
                                        {(() => {
                                            const t = allTeachers.find(t => t.id === conv.teacherId);
                                            if (t?.avatar_url) return <Image source={{ uri: t.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22 }} />;
                                            return <Text style={{ fontSize: 18, fontWeight: '700', color: '#818cf8' }}>{conv.teacherName.charAt(0).toUpperCase()}</Text>;
                                        })()}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.convName, { color: colors.textPrimary }]}>{conv.teacherName}</Text>
                                        <Text style={[styles.convPreview, { color: colors.textSecondary }]} numberOfLines={1}>{conv.lastMessage}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.convTime}>
                                            {conv.lastTime ? new Date(conv.lastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </Text>
                                        {conv.unread > 0 && (
                                            <View style={styles.badge}>
                                                <Text style={styles.badgeText}>{conv.unread}</Text>
                                            </View>
                                        )}
                                    </View>
                                </AnimatedPressable>
                            ))}
                        </ScrollView>
                    )}
                </View>) : (
                /* Reset Requests Tab */
                resetRequests.length === 0 ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
                        <View style={styles.emptyIcon}>
                            <MaterialIcons name="check-circle" size={48} color="#34d399" />
                        </View>
                        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 16 }}>All Clear</Text>
                        <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
                            No pending password reset requests.
                        </Text>
                    </View>
                ) : (
                    <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
                        {resetRequests.map(req => (
                            <View key={req.id} style={[styles.resetCard, { borderColor: colors.border }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(245,158,11,0.12)', justifyContent: 'center', alignItems: 'center' }}>
                                        <MaterialIcons name="lock-open" size={20} color="#f59e0b" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>{req.email}</Text>
                                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                                            {req.requested_at ? new Date(req.requested_at).toLocaleString() : 'Just now'}
                                        </Text>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#f59e0b' }}>Pending</Text>
                                    </View>
                                </View>
                                <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>
                                    Password will reset to: <Text style={{ color: '#34d399', fontWeight: '600' }}>surname.ID (from email)</Text>
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <AnimatedPressable style={styles.approveBtn} onPress={() => handleApproveReset(req)}>
                                        <MaterialIcons name="check" size={16} color={Colors.white} />
                                        <Text style={{ color: Colors.white, fontWeight: '600', fontSize: 13 }}>Approve</Text>
                                    </AnimatedPressable>
                                    <AnimatedPressable style={styles.denyBtn} onPress={() => handleDenyReset(req)}>
                                        <MaterialIcons name="close" size={16} color="#ef4444" />
                                        <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 13 }}>Deny</Text>
                                    </AnimatedPressable>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                )
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1
    },
    headerAvatar: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(59,130,246,0.12)',
        justifyContent: 'center', alignItems: 'center'
    },
    headerTitle: { fontSize: 17, fontWeight: '700' },
    headerSub: { fontSize: 12, marginTop: 1 },
    backBtn: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)', marginRight: 4 },
    tabRow: {
        flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 16
    },
    tab: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent'
    },
    tabActive: { borderBottomColor: Colors.primary },
    tabText: { fontSize: 13, fontWeight: '500', color: '#64748b' },
    tabTextActive: { color: Colors.primary, fontWeight: '600' },
    emptyIcon: {
        width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(99,102,241,0.08)',
        justifyContent: 'center', alignItems: 'center'
    },
    convRow: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1
    },
    convAvatar: {
        width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center'
    },
    convName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
    convPreview: { fontSize: 13 },
    convTime: { fontSize: 11, color: '#64748b', marginBottom: 4 },
    badge: {
        backgroundColor: Colors.primary, borderRadius: 10,
        width: 22, height: 22, justifyContent: 'center', alignItems: 'center'
    },
    badgeText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
    bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleAdmin: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
    bubbleTeacher: { backgroundColor: '#334155', borderBottomLeftRadius: 4 },
    bubbleText: { fontSize: 14, lineHeight: 20 },
    bubbleMeta: { fontSize: 10, color: '#64748b', marginTop: 3 },
    inputBar: {
        flexDirection: 'row', alignItems: 'flex-end', gap: 8,
        paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1
    },
    textInput: {
        flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
        fontSize: 14, maxHeight: 80, borderWidth: 1
    },
    sendBtn: {
        width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center'
    },
    resetCard: {
        backgroundColor: '#1e293b', borderRadius: 16, padding: 16,
        borderWidth: 1, marginBottom: 12
    },
    statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
    approveBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: '#10b981', borderRadius: 10, paddingVertical: 10
    },
    denyBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
        backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, paddingVertical: 10,
        borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)'
    },
});

export default AdminChatInbox;
