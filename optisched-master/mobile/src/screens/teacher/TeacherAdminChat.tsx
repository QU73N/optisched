import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, ScrollView,  StyleSheet,
    TextInput, ActivityIndicator, Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../config/supabase';
import { smartSend } from '../../utils/offlineQueue';
import { AnimatedPressable } from '../../components/AnimatedPressable';

interface Message {
    id: string;
    sender_id: string;
    sender_name: string;
    message: string;
    direction: 'teacher_to_admin' | 'admin_to_teacher';
    created_at: string;
}

const TeacherAdminChat: React.FC = () => {
    const { profile } = useAuth();
    const { colors } = useTheme();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<ScrollView>(null);

    const fetchMessages = async () => {
        if (!profile?.id) return;
        try {
            const { data } = await supabase
                .from('admin_messages')
                .select('*')
                .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
                .order('created_at', { ascending: true });
            setMessages((data || []) as Message[]);
        } catch { /* ignore */ }
        setLoading(false);
    };

    useEffect(() => {
        fetchMessages();

        // Subscribe to real-time changes on admin_messages
        const channel = supabase
            .channel('teacher-chat-' + profile?.id)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'admin_messages',
            }, () => {
                // Refetch messages on any insert/update/delete
                fetchMessages();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [profile?.id]);

    useEffect(() => {
        // Scroll to bottom when messages change
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }, [messages.length]);

    const handleSend = async () => {
        if (!input.trim() || !profile?.id) return;
        setSending(true);
        try {
            const payload = {
                sender_id: profile.id,
                sender_name: profile.full_name || 'Teacher',
                message: input.trim(),
                direction: 'teacher_to_admin' as const,
            };
            const result = await smartSend('admin_messages', payload);
            setInput('');
            if (result.sent) {
                await fetchMessages();
            } else if (result.queued) {
                Alert.alert('Offline', 'Message saved! It will be sent when you\'re back online.');
            }
        } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to send message');
        }
        setSending(false);
    };

    const isMyMessage = (msg: Message) => msg.sender_id === profile?.id || msg.direction === 'teacher_to_admin';

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <View style={styles.headerAvatar}>
                    <MaterialIcons name="admin-panel-settings" size={22} color="#60a5fa" />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Admin Chat</Text>
                    <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Message the administrator</Text>
                </View>
                <AnimatedPressable onPress={fetchMessages} style={styles.refreshBtn}>
                    <MaterialIcons name="refresh" size={20} color={colors.textSecondary} />
                </AnimatedPressable>
                <AnimatedPressable onPress={() => {
                    Alert.alert('Reset Conversation', 'Delete all messages? This cannot be undone.', [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Delete All', style: 'destructive', onPress: async () => {
                                if (!profile?.id) return;
                                await supabase.from('admin_messages').delete().or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`);
                                setMessages([]);
                                Alert.alert('Done', 'Conversation has been reset.');
                            }
                        },
                    ]);
                }} style={styles.refreshBtn}>
                    <MaterialIcons name="delete-outline" size={20} color="#ef4444" />
                </AnimatedPressable>
            </View>

            {/* Messages */}
            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Loading messages...</Text>
                </View>
            ) : messages.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
                    <View style={styles.emptyIcon}>
                        <MaterialIcons name="chat-bubble-outline" size={48} color="#475569" />
                    </View>
                    <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 16 }}>No Messages Yet</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
                        Send a message to the admin about scheduling, room issues, or any concerns.
                    </Text>
                </View>
            ) : (
                <ScrollView ref={scrollRef} style={{ flex: 1, paddingHorizontal: 16 }} contentContainerStyle={{ paddingVertical: 16 }} showsVerticalScrollIndicator={false}>
                    {messages.map((msg, i) => {
                        const mine = isMyMessage(msg);
                        return (
                            <View key={msg.id || i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', marginBottom: 10 }}>
                                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                                    <Text style={[styles.bubbleText, { color: Colors.white }]}>{msg.message}</Text>
                                </View>
                                <Text style={[styles.bubbleMeta, { textAlign: mine ? 'right' : 'left' }]}>
                                    {mine ? 'You' : (msg.sender_name || 'Admin')} • {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </Text>
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            {/* Quick prompts for empty state */}
            {messages.length === 0 && !loading && (
                <View style={styles.quickRow}>
                    {['Schedule concern', 'Room issue', 'General inquiry'].map(q => (
                        <AnimatedPressable key={q} style={styles.quickChip} onPress={() => setInput(q)}>
                            <Text style={styles.quickChipText}>{q}</Text>
                        </AnimatedPressable>
                    ))}
                </View>
            )}

            {/* Input */}
            <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                <TextInput
                    style={[styles.textInput, { backgroundColor: colors.isDark ? '#1e293b' : '#f1f5f9', color: colors.textPrimary, borderColor: colors.border }]}
                    placeholder="Type a message..." placeholderTextColor={colors.textSecondary}
                    value={input} onChangeText={setInput} multiline maxLength={500}
                />
                <AnimatedPressable
                    style={[styles.sendBtn, { backgroundColor: input.trim() ? Colors.primary : '#334155' }]}
                    onPress={handleSend} disabled={!input.trim() || sending}
                >
                    {sending ? <ActivityIndicator size="small" color={Colors.white} /> : <MaterialIcons name="send" size={18} color={Colors.white} />}
                </AnimatedPressable>
            </View>
        </View>
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
    refreshBtn: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
    emptyIcon: {
        width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(99,102,241,0.08)',
        justifyContent: 'center', alignItems: 'center'
    },
    bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '100%' },
    bubbleMine: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
    bubbleTheirs: { backgroundColor: '#334155', borderBottomLeftRadius: 4 },
    bubbleText: { fontSize: 14, lineHeight: 20 },
    bubbleMeta: { fontSize: 10, color: '#64748b', marginTop: 3 },
    quickRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12, flexWrap: 'wrap' },
    quickChip: {
        backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
        borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)'
    },
    quickChipText: { color: '#a5b4fc', fontSize: 13, fontWeight: '500' },
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
});

export default TeacherAdminChat;
