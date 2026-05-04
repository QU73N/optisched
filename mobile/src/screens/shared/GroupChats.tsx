import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    TextInput, ActivityIndicator, FlatList, Image, TouchableOpacity
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../config/supabase';
import { smartSend } from '../../utils/offlineQueue';

interface GroupChat {
    id: string;
    name: string;
    type: string;
    created_at: string;
    updated_at: string;
}

interface GroupChatMessage {
    id: string;
    group_chat_id: string;
    sender_id: string;
    message: string;
    created_at: string;
    is_read: boolean;
    sender?: {
        id: string;
        full_name: string;
        avatar_url?: string;
    };
}

interface GroupChatWithUnread extends GroupChat {
    unread_count: number;
    last_message: string | null;
}

const GroupChats: React.FC = () => {
    const { profile } = useAuth();
    const { colors } = useTheme();
    const [groupChats, setGroupChats] = useState<GroupChatWithUnread[]>([]);
    const [selectedChat, setSelectedChat] = useState<GroupChat | null>(null);
    const [messages, setMessages] = useState<GroupChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        fetchGroupChats();

        // Real-time subscription
        const channel = supabase
            .channel('mobile-group-chats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'group_chat_messages' }, () => {
                fetchMessages();
                fetchGroupChats();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [profile]);

    const fetchGroupChats = async () => {
        if (!profile?.id) return;
        try {
            const { data: memberData } = await supabase
                .from('group_chat_members')
                .select('group_chat_id')
                .eq('user_id', profile.id);

            if (!memberData || memberData.length === 0) {
                setGroupChats([]);
                setLoading(false);
                return;
            }

            const chatIds = memberData.map((m: any) => m.group_chat_id);

            const { data: chatsData } = await supabase
                .from('group_chats')
                .select('*')
                .in('id', chatIds)
                .order('updated_at', { ascending: false });

            // Get unread counts
            const chatsWithInfo = await Promise.all(
                (chatsData || []).map(async (chat: GroupChat) => {
                    const [{ count: unreadCount }, { data: lastMsg }] = await Promise.all([
                        supabase
                            .from('group_chat_messages')
                            .select('*', { count: 'exact', head: true })
                            .eq('group_chat_id', chat.id)
                            .eq('is_read', false)
                            .neq('sender_id', profile.id),
                        supabase
                            .from('group_chat_messages')
                            .select('message')
                            .eq('group_chat_id', chat.id)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .single()
                    ]);

                    return {
                        ...chat,
                        unread_count: unreadCount || 0,
                        last_message: lastMsg?.message || null,
                    };
                })
            );

            setGroupChats(chatsWithInfo);
        } catch (err) {
            console.error('[Mobile GroupChats] load failed', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async () => {
        if (!selectedChat) return;
        try {
            const { data } = await supabase
                .from('group_chat_messages')
                .select('*, sender:profiles(id, full_name, avatar_url)')
                .eq('group_chat_id', selectedChat.id)
                .order('created_at', { ascending: true });

            setMessages((data || []) as GroupChatMessage[]);

            // Mark as read
            await supabase
                .from('group_chat_messages')
                .update({ is_read: true })
                .eq('group_chat_id', selectedChat.id)
                .neq('sender_id', profile?.id);

            fetchGroupChats();
        } catch (err) {
            console.error('[Mobile GroupChats] fetch messages failed', err);
        }
    };

    useEffect(() => {
        if (selectedChat) {
            fetchMessages();
        }
    }, [selectedChat]);

    const sendMessage = async () => {
        if (!profile?.id || !selectedChat || !newMessage.trim()) return;
        setSending(true);
        try {
            await smartSend(
                'group_chat_messages',
                {
                    group_chat_id: selectedChat.id,
                    sender_id: profile.id,
                    message: newMessage.trim(),
                }
            );
            setNewMessage('');
        } catch (err) {
            console.error('[Mobile GroupChats] send failed', err);
        } finally {
            setSending(false);
        }
    };

    const getChatIcon = (type: string) => {
        switch (type) {
            case 'department': return 'tag';
            case 'section': return 'people';
            case 'schedule_managers': return 'forum';
            default: return 'forum';
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        return date.toLocaleDateString();
    };

    const renderChatItem = ({ item }: { item: GroupChatWithUnread }) => (
        <TouchableOpacity
            style={[styles.chatItem, { backgroundColor: colors.card }]}
            onPress={() => setSelectedChat(item)}
        >
            <View style={[styles.chatIcon, { backgroundColor: colors.accentPrimary }]}>
                <MaterialIcons name={getChatIcon(item.type) as any} size={24} color="white" />
            </View>
            <View style={styles.chatInfo}>
                <View style={styles.chatItemHeader}>
                    <Text style={[styles.chatName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {item.name}
                    </Text>
                    {item.unread_count > 0 && (
                        <View style={[styles.unreadBadge, { backgroundColor: Colors.error }]}>
                            <Text style={styles.unreadCount}>{item.unread_count}</Text>
                        </View>
                    )}
                </View>
                <Text style={[styles.lastMessage, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.last_message || 'No messages yet'}
                </Text>
            </View>
        </TouchableOpacity>
    );

    const renderMessage = ({ item }: { item: GroupChatMessage }) => {
        const isOwn = item.sender_id === profile?.id;
        return (
            <View style={[styles.messageRow, isOwn ? styles.ownMessage : styles.otherMessage]}>
                {!isOwn && (
                    <View style={[styles.avatar, { backgroundColor: Colors.info }]}>
                        <Text style={styles.avatarText}>
                            {item.sender?.full_name?.charAt(0) || '?'}
                        </Text>
                    </View>
                )}
                <View style={styles.messageContent}>
                    {!isOwn && (
                        <Text style={[styles.senderName, { color: colors.textSecondary }]}>
                            {item.sender?.full_name || 'Unknown'}
                        </Text>
                    )}
                    <View style={[
                        styles.messageBubble,
                        { backgroundColor: isOwn ? colors.accentPrimary : colors.background }
                    ]}>
                        <Text style={[styles.messageText, { color: isOwn ? 'white' : colors.textPrimary }]}>
                            {item.message}
                        </Text>
                    </View>
                    <Text style={[styles.messageTime, { color: colors.textSecondary }]}>
                        {formatTime(item.created_at)}
                    </Text>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.accentPrimary} />
            </SafeAreaView>
        );
    }

    if (selectedChat) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.chatHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={() => setSelectedChat(null)}>
                        <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <View style={[styles.chatHeaderIcon, { backgroundColor: colors.accentPrimary }]}>
                        <MaterialIcons name={getChatIcon(selectedChat.type) as any} size={20} color="white" />
                    </View>
                    <View style={styles.chatHeaderInfo}>
                        <Text style={[styles.chatHeaderName, { color: colors.textPrimary }]}>{selectedChat.name}</Text>
                        <Text style={[styles.chatHeaderType, { color: colors.textSecondary }]}>
                            {selectedChat.type.replace('_', ' ')}
                        </Text>
                    </View>
                </View>

                <ScrollView
                    ref={scrollViewRef as any}
                    style={styles.messagesList}
                    onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                >
                    {messages.length === 0 ? (
                        <View style={styles.emptyMessages}>
                            <MaterialIcons name="forum" size={48} color={colors.textSecondary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                No messages yet. Start the conversation!
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={messages}
                            renderItem={renderMessage}
                            keyExtractor={(item) => item.id}
                            scrollEnabled={false}
                        />
                    )}
                </ScrollView>

                <View style={[styles.inputContainer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
                    <TextInput
                        style={[styles.input, { backgroundColor: colors.background, color: colors.textPrimary }]}
                        value={newMessage}
                        onChangeText={setNewMessage}
                        placeholder="Type a message..."
                        placeholderTextColor={colors.textSecondary}
                        multiline
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, { backgroundColor: colors.accentPrimary }]}
                        onPress={sendMessage}
                        disabled={sending || !newMessage.trim()}
                    >
                        {sending ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <MaterialIcons name="send" size={24} color="white" />
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Group Chats</Text>
            </View>

            {groupChats.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <MaterialIcons name="forum" size={64} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No group chats available
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={groupChats}
                    renderItem={renderChatItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.chatList}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 16,
        borderBottomWidth: 1,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    chatList: {
        padding: 8,
    },
    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    chatIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    chatInfo: {
        flex: 1,
    },
    chatItemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    chatName: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    unreadBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 24,
        alignItems: 'center',
    },
    unreadCount: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    lastMessage: {
        fontSize: 14,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        textAlign: 'center',
    },
    chatHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    chatHeaderIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    chatHeaderInfo: {
        flex: 1,
    },
    chatHeaderName: {
        fontSize: 16,
        fontWeight: '600',
    },
    chatHeaderType: {
        fontSize: 12,
        marginTop: 2,
    },
    messagesList: {
        flex: 1,
        padding: 16,
    },
    emptyMessages: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 80,
    },
    messageRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    ownMessage: {
        justifyContent: 'flex-end',
    },
    otherMessage: {
        justifyContent: 'flex-start',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    avatarText: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
    messageContent: {
        maxWidth: '75%',
    },
    senderName: {
        fontSize: 12,
        marginBottom: 4,
    },
    messageBubble: {
        padding: 12,
        borderRadius: 12,
    },
    messageText: {
        fontSize: 14,
        lineHeight: 20,
    },
    messageTime: {
        fontSize: 11,
        marginTop: 4,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 12,
        borderTopWidth: 1,
    },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginRight: 8,
        maxHeight: 100,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default GroupChats;
