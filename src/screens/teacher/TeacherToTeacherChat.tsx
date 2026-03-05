import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    TextInput, ActivityIndicator, Image, FlatList, Alert
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../config/supabase';
import { smartSend } from '../../utils/offlineQueue';
import { AnimatedPressable } from '../../components/AnimatedPressable';

interface Teacher {
    id: string;
    profile_id: string;
    full_name: string;
    avatar_url?: string | null;
}

interface Message {
    id: string;
    sender_id: string;
    receiver_id: string;
    sender_name: string;
    message: string;
    created_at: string;
}

const TeacherToTeacherChat: React.FC = () => {
    const { profile } = useAuth();
    const { colors } = useTheme();
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<ScrollView>(null);

    // Fetch all teachers except self
    const fetchTeachers = async () => {
        try {
            const { data } = await supabase
                .from('teachers')
                .select('id, profile:profiles(id, full_name, avatar_url)')
                .eq('is_active', true);
            if (data) {
                const mapped = data
                    .map((t: any) => ({
                        id: t.id,
                        profile_id: t.profile?.id || '',
                        full_name: t.profile?.full_name || 'Teacher',
                        avatar_url: t.profile?.avatar_url || null,
                    }))
                    .filter((t: Teacher) => t.profile_id !== profile?.id);
                setTeachers(mapped);
            }
        } catch { /* ignore */ }
        setLoading(false);
    };

    // Fetch messages with selected teacher
    const fetchMessages = async (teacherProfileId: string) => {
        if (!profile?.id) return;
        try {
            const { data } = await supabase
                .from('teacher_messages')
                .select('*')
                .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${teacherProfileId}),and(sender_id.eq.${teacherProfileId},receiver_id.eq.${profile.id})`)
                .order('created_at', { ascending: true });
            setMessages((data || []) as Message[]);
        } catch { /* ignore */ }
    };

    useEffect(() => {
        fetchTeachers();
    }, []);

    // Real-time subscription for messages
    useEffect(() => {
        if (!selectedTeacher) return;

        fetchMessages(selectedTeacher.profile_id);

        const channel = supabase
            .channel('teacher-chat-' + selectedTeacher.profile_id)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'teacher_messages',
            }, () => {
                fetchMessages(selectedTeacher.profile_id);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [selectedTeacher?.profile_id]);

    useEffect(() => {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }, [messages.length]);

    const handleSend = async () => {
        if (!input.trim() || !profile?.id || !selectedTeacher) return;
        setSending(true);
        try {
            const payload = {
                sender_id: profile.id,
                receiver_id: selectedTeacher.id,
                sender_name: profile.full_name || 'Teacher',
                receiver_name: selectedTeacher.full_name,
                message: input.trim(),
            };
            const result = await smartSend('teacher_messages', payload);
            setInput('');
            if (result.queued && !result.sent) {
                Alert.alert('Offline', 'Message saved! It will be sent when you\'re back online.');
            }
        } catch { /* ignore */ }
        setSending(false);
    };

    const handleUnsend = (msgId: string) => {
        Alert.alert('Unsend Message', 'Remove this message?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Unsend', style: 'destructive', onPress: async () => {
                    await supabase.from('teacher_messages').delete().eq('id', msgId);
                }
            }
        ]);
    };

    const handleResetConversation = () => {
        if (!selectedTeacher || !profile?.id) return;
        Alert.alert('Reset Conversation', `Delete all messages with ${selectedTeacher.full_name}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Reset', style: 'destructive', onPress: async () => {
                    await supabase.from('teacher_messages').delete()
                        .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${selectedTeacher.profile_id}),and(sender_id.eq.${selectedTeacher.profile_id},receiver_id.eq.${profile.id})`);
                    setMessages([]);
                }
            }
        ]);
    };

    // Teacher list view
    if (!selectedTeacher) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Teacher Chat</Text>
                    <Text style={styles.headerSub}>Chat with your colleagues</Text>
                </View>
                {loading ? (
                    <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
                ) : teachers.length === 0 ? (
                    <View style={{ alignItems: 'center', marginTop: 60 }}>
                        <MaterialIcons name="group" size={60} color={Colors.slate600} />
                        <Text style={{ color: Colors.slate500, marginTop: 12, fontSize: 15 }}>No other teachers found</Text>
                    </View>
                ) : (
                    <FlatList
                        data={teachers}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}
                        renderItem={({ item }) => (
                            <AnimatedPressable
                                style={styles.teacherItem}
                                onPress={() => setSelectedTeacher(item)}
                            >
                                {item.avatar_url ? (
                                    <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                                ) : (
                                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                        <Text style={styles.avatarLetter}>{item.full_name.charAt(0).toUpperCase()}</Text>
                                    </View>
                                )}
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.teacherName}>{item.full_name}</Text>
                                    <Text style={styles.teacherSub}>Tap to start chatting</Text>
                                </View>
                                <MaterialIcons name="chevron-right" size={20} color={Colors.slate600} />
                            </AnimatedPressable>
                        )}
                    />
                )}
            </SafeAreaView>
        );
    }

    // Chat view
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.chatHeader}>
                <AnimatedPressable onPress={() => setSelectedTeacher(null)} style={{ marginRight: 12 }}>
                    <MaterialIcons name="arrow-back" size={24} color={Colors.white} />
                </AnimatedPressable>
                {selectedTeacher.avatar_url ? (
                    <Image source={{ uri: selectedTeacher.avatar_url }} style={[styles.avatar, { width: 36, height: 36 }]} />
                ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder, { width: 36, height: 36 }]}>
                        <Text style={[styles.avatarLetter, { fontSize: 16 }]}>{selectedTeacher.full_name.charAt(0).toUpperCase()}</Text>
                    </View>
                )}
                <Text style={styles.chatHeaderName}>{selectedTeacher.full_name}</Text>
                <AnimatedPressable onPress={handleResetConversation} style={{ marginLeft: 'auto', padding: 6 }}>
                    <MaterialIcons name="delete-sweep" size={22} color="#ef4444" />
                </AnimatedPressable>
            </View>

            <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 8 }}>
                {messages.length === 0 && (
                    <View style={{ alignItems: 'center', marginTop: 40 }}>
                        <MaterialIcons name="chat-bubble-outline" size={48} color={Colors.slate700} />
                        <Text style={{ color: Colors.slate500, marginTop: 8, fontSize: 13 }}>No messages yet. Say hello!</Text>
                    </View>
                )}
                {messages.map(msg => {
                    const isMe = msg.sender_id === profile?.id;
                    return (
                        <View key={msg.id} style={{ alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                            {!isMe && (
                                <Text style={{ fontSize: 10, color: Colors.slate500, marginBottom: 2 }}>{msg.sender_name}</Text>
                            )}
                            <AnimatedPressable
                                onLongPress={() => isMe && handleUnsend(msg.id)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                                    <Text style={{ color: Colors.white, fontSize: 14 }}>{msg.message}</Text>
                                </View>
                            </AnimatedPressable>
                            <Text style={{ fontSize: 9, color: Colors.slate600, marginTop: 2 }}>
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </View>
                    );
                })}
            </ScrollView>

            <View style={styles.inputRow}>
                <TextInput
                    style={styles.chatInput}
                    value={input}
                    onChangeText={setInput}
                    placeholder={`Message ${selectedTeacher.full_name}...`}
                    placeholderTextColor="#6b7280"
                    multiline
                />
                <AnimatedPressable
                    style={[styles.sendBtn, !input.trim() && { opacity: 0.4 }]}
                    onPress={handleSend}
                    disabled={sending || !input.trim()}
                >
                    {sending ? (
                        <ActivityIndicator color={Colors.white} size="small" />
                    ) : (
                        <MaterialIcons name="send" size={20} color={Colors.white} />
                    )}
                </AnimatedPressable>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundDark },
    header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    headerTitle: { fontSize: 24, fontWeight: '700', color: Colors.white },
    headerSub: { fontSize: 13, color: Colors.slate500, marginTop: 2 },
    teacherItem: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b',
        borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#334155'
    },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    avatarPlaceholder: { backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
    avatarLetter: { color: Colors.white, fontSize: 18, fontWeight: '700' },
    teacherName: { fontSize: 15, fontWeight: '600', color: Colors.white },
    teacherSub: { fontSize: 12, color: Colors.slate500, marginTop: 2 },
    chatHeader: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#1e293b', backgroundColor: '#0f172a'
    },
    chatHeaderName: { fontSize: 17, fontWeight: '600', color: Colors.white, marginLeft: 10 },
    bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
    bubbleMe: { backgroundColor: '#6366f1', borderBottomRightRadius: 4 },
    bubbleOther: { backgroundColor: '#334155', borderBottomLeftRadius: 4 },
    inputRow: {
        flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 8,
        borderTopWidth: 1, borderTopColor: '#1e293b', backgroundColor: '#0f172a'
    },
    chatInput: {
        flex: 1, backgroundColor: '#1e293b', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
        color: Colors.white, fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: '#334155'
    },
    sendBtn: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366f1',
        justifyContent: 'center', alignItems: 'center', marginLeft: 8
    },
});

export default TeacherToTeacherChat;
