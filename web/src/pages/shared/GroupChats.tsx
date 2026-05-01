import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { logAudit } from '../../hooks/useActivityLogger';
import { Send, Users, Search, MessageSquare, Hash } from 'lucide-react';
import { type GroupChat, type GroupChatMessage, type Profile } from '../../types/database';
import '../admin/Dashboard.css';

interface GroupChatWithUnread extends GroupChat {
    unread_count: number;
    last_message: string | null;
    last_message_time: string | null;
}

const GroupChats: React.FC = () => {
    const { profile } = useAuth();
    const [groupChats, setGroupChats] = useState<GroupChatWithUnread[]>([]);
    const [selectedChat, setSelectedChat] = useState<GroupChat | null>(null);
    const [messages, setMessages] = useState<GroupChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fetchGroupChats = useCallback(async () => {
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

            const chatIds = memberData.map((m: { group_chat_id: string }) => m.group_chat_id);

            const { data: chatsData } = await supabase
                .from('group_chats')
                .select('*')
                .in('id', chatIds)
                .order('updated_at', { ascending: false });

            // Get unread counts and last messages for each chat
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
                            .select('message, created_at')
                            .eq('group_chat_id', chat.id)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .single()
                    ]);

                    return {
                        ...chat,
                        unread_count: unreadCount || 0,
                        last_message: lastMsg?.message || null,
                        last_message_time: lastMsg?.created_at || null,
                    };
                })
            );

            setGroupChats(chatsWithInfo);
        } catch (err) {
            console.error('[GroupChats] load failed', err);
        } finally {
            setLoading(false);
        }
    }, [profile?.id]);

    const fetchMessages = useCallback(async () => {
        if (!selectedChat) return;
        try {
            const { data } = await supabase
                .from('group_chat_messages')
                .select('*, sender:profiles(id, full_name, avatar_url)')
                .eq('group_chat_id', selectedChat.id)
                .order('created_at', { ascending: true });

            setMessages((data || []) as GroupChatMessage[]);

            // Mark messages as read
            await supabase
                .from('group_chat_messages')
                .update({ is_read: true })
                .eq('group_chat_id', selectedChat.id)
                .neq('sender_id', profile?.id);

            fetchGroupChats();
        } catch (err) {
            console.error('[GroupChats] fetch messages failed', err);
        }
    }, [selectedChat, profile?.id, fetchGroupChats]);

    useEffect(() => {
        fetchGroupChats();

        // Real-time subscription for group chat messages
        const channel = supabase
            .channel('group-chats-messages')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'group_chat_messages' }, () => {
                fetchMessages();
                fetchGroupChats();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchGroupChats, fetchMessages, profile]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (selectedChat) {
            fetchMessages();
        }
    }, [selectedChat, fetchMessages]);

    const sendMessage = async () => {
        if (!profile?.id || !selectedChat || !newMessage.trim()) return;
        setSending(true);
        try {
            const { error } = await supabase
                .from('group_chat_messages')
                .insert({
                    group_chat_id: selectedChat.id,
                    sender_id: profile.id,
                    message: newMessage.trim(),
                });

            if (error) throw error;

            setNewMessage('');
            await logAudit('group_chat.message.send', 'group_chat_messages', selectedChat.id, {
                message: newMessage.trim(),
            });
        } catch (err) {
            console.error('[GroupChats] send failed', err);
            alert('Failed to send message.');
        } finally {
            setSending(false);
        }
    };

    const getChatIcon = (type: string) => {
        switch (type) {
            case 'department': return <Hash size={16} />;
            case 'section': return <Users size={16} />;
            case 'schedule_managers': return <MessageSquare size={16} />;
            default: return <MessageSquare size={16} />;
        }
    };

    const formatTime = (dateString: string | null) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    if (loading) {
        return (
            <div className="dashboard">
                <div className="dash-loading-center">
                    <div className="spin" style={{ fontSize: 24 }}>⟳</div>
                    <div style={{ marginTop: 8 }}>Loading...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1 className="dashboard-title"><MessageSquare size={20} /> Group Chats</h1>
                <p className="dashboard-subtitle">
                    Communicate with your department, section, and fellow schedule managers.
                </p>
            </div>

            <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 180px)' }}>
                {/* Chat List */}
                <div style={{ flex: '0 0 320px', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: 12, borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
                            <Search size={14} style={{ color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search chats..."
                                style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, fontSize: 13 }}
                            />
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {groupChats.length === 0 ? (
                            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                                <MessageSquare size={32} style={{ marginBottom: 12 }} />
                                <div>No group chats available</div>
                            </div>
                        ) : (
                            groupChats.map(chat => (
                                <button
                                    key={chat.id}
                                    onClick={() => setSelectedChat(chat)}
                                    style={{
                                        width: '100%',
                                        padding: 12,
                                        borderBottom: '1px solid var(--border)',
                                        background: selectedChat?.id === chat.id ? 'var(--bg-hover)' : 'transparent',
                                        border: 'none',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                    }}
                                >
                                    <div style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        background: 'var(--accent-primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                    }}>
                                        {getChatIcon(chat.type)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                            <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {chat.name}
                                            </div>
                                            {chat.unread_count > 0 && (
                                                <div style={{
                                                    background: 'var(--accent-error)',
                                                    color: 'white',
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    padding: '2px 6px',
                                                    borderRadius: 10,
                                                    minWidth: 20,
                                                    textAlign: 'center',
                                                }}>
                                                    {chat.unread_count}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {chat.last_message || 'No messages yet'}
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Chat View */}
                <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {!selectedChat ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            <div style={{ textAlign: 'center' }}>
                                <MessageSquare size={48} style={{ marginBottom: 12 }} />
                                <div>Select a group chat to start messaging</div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Chat Header */}
                            <div style={{ padding: 16, borderBottom: '1px solid var(--border)', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    background: 'var(--accent-primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                }}>
                                    {getChatIcon(selectedChat.type)}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{selectedChat.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedChat.type.replace('_', ' ')}</div>
                                </div>
                            </div>

                            {/* Messages */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {messages.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40 }}>
                                        <div>No messages yet. Start the conversation!</div>
                                    </div>
                                ) : (
                                    messages.map(msg => (
                                        <div
                                            key={msg.id}
                                            style={{
                                                display: 'flex',
                                                gap: 8,
                                                alignSelf: msg.sender_id === profile?.id ? 'flex-end' : 'flex-start',
                                            }}
                                        >
                                            {msg.sender_id !== profile?.id && (
                                                <div style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: '50%',
                                                    background: 'var(--accent-info)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'white',
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                }}>
                                                    {(msg.sender as Profile)?.full_name?.charAt(0) || '?'}
                                                </div>
                                            )}
                                            <div style={{ maxWidth: '70%' }}>
                                                {msg.sender_id !== profile?.id && (
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                                                        {(msg.sender as Profile)?.full_name || 'Unknown'}
                                                    </div>
                                                )}
                                                <div style={{
                                                    padding: '10px 14px',
                                                    borderRadius: 12,
                                                    background: msg.sender_id === profile?.id ? 'var(--accent-primary)' : 'var(--bg-hover)',
                                                    color: msg.sender_id === profile?.id ? 'white' : 'var(--text)',
                                                    wordBreak: 'break-word',
                                                }}>
                                                    {msg.message}
                                                </div>
                                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                                                    {formatTime(msg.created_at)}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Message Input */}
                            <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 12 }}>
                                <input
                                    className="input"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                    placeholder="Type a message..."
                                    style={{ flex: 1 }}
                                />
                                <button
                                    className="btn btn-primary"
                                    onClick={sendMessage}
                                    disabled={sending || !newMessage.trim()}
                                >
                                    {sending ? <div className="spin" style={{ fontSize: 14 }}>⟳</div> : <Send size={14} />}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GroupChats;
