import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Send, Users, Search, ArrowLeft, MessageSquare } from 'lucide-react';
import '../admin/Dashboard.css';

interface Message {
    id: string;
    sender_id: string;
    sender_name: string;
    message: string;
    direction: string;
    created_at: string;
    is_read: boolean;
    recipient_id?: string;
}

interface Thread {
    senderId: string;
    senderName: string;
    lastMessage: string;
    lastTime: string;
    unread: number;
    avatarUrl?: string;
}

interface TeacherProfile {
    id: string;
    full_name: string;
    avatar_url?: string;
    role: string;
}

const CommunicationHub: React.FC = () => {
    const { profile, roles } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [threads, setThreads] = useState<Thread[]>([]);
    const [allTeachers, setAllTeachers] = useState<TeacherProfile[]>([]);
    const [selectedThread, setSelectedThread] = useState<string | null>(null);
    const [selectedRecipientName, setSelectedRecipientName] = useState('');
    const [newMessage, setNewMessage] = useState('');
    const [search, setSearch] = useState('');
    const [sending, setSending] = useState(false);
    const [sidebarTab, setSidebarTab] = useState<'conversations' | 'teachers'>('conversations');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isAdmin = ['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'].some(r => roles.includes(r as 'admin' | 'power_admin' | 'system_admin' | 'schedule_admin' | 'schedule_manager'));

    const fetchAllTeachers = useCallback(async () => {
        try {
            if (!isAdmin) {
                // Teachers can only chat with admins
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, avatar_url, full_name, role')
                    .in('role', ['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager']);

                if (error) {
                    console.error('Error fetching admins:', error);
                    return;
                }

                if (data) {
                    setAllTeachers(data);
                }
            } else {
                // Admins can chat with all teachers
                const { data, error } = await supabase
                    .from('teachers')
                    .select('id, avatar_url, full_name, role')
                    .eq('is_public', true);

                if (error) {
                    console.error('Error fetching teachers:', error);
                    return;
                }

                if (data) {
                    // Filter out the current user
                    setAllTeachers(data.filter(t => t.id !== profile?.id));
                }
            }
        } catch (err) {
            console.error('Exception in fetchAllTeachers:', err);
        }
    }, [isAdmin, profile?.id]);

    const fetchMessages = useCallback(async () => {
        try {
            let query = supabase
                .from('admin_messages')
                .select('*')
                .order('created_at', { ascending: true });

            // If teacher, only get their own messages
            if (!isAdmin) {
                query = query.or(`sender_id.eq.${profile?.id},recipient_id.eq.${profile?.id}`);
            } else {
                // If admin, only get messages sent to ALL admins (null), or specific to them, or sent by them
                query = query.or(`recipient_id.is.null,recipient_id.eq.${profile?.id},sender_id.eq.${profile?.id}`);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching messages:', error);
                return;
            }

            if (data) {
                setMessages(data);
                await buildThreads(data);
            }
        } catch (err) {
            console.error('Exception in fetchMessages:', err);
        }
    }, [isAdmin, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        fetchMessages();
        fetchAllTeachers();

        // Prevent body scrolling when CommunicationHub is mounted
        document.body.style.overflow = 'hidden';

        // Lock layout content area for fixed full-height messaging UI
        const mainContent = document.querySelector('.main-content') as HTMLElement | null;
        const previousMainOverflowY = mainContent?.style.overflowY || '';
        const previousMainOverflowX = mainContent?.style.overflowX || '';

        if (mainContent) {
            mainContent.scrollTo({ top: 0 });
            mainContent.style.overflowY = 'hidden';
            mainContent.style.overflowX = 'hidden';
        }

        // Real-time subscription for instant message updates
        const channel = supabase
            .channel('comm-hub-messages')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_messages' }, () => {
                fetchMessages();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            // Restore body scrolling when unmounted
            document.body.style.overflow = '';
            if (mainContent) {
                mainContent.style.overflowY = previousMainOverflowY;
                mainContent.style.overflowX = previousMainOverflowX;
            }
        };
    }, [profile, fetchMessages, fetchAllTeachers]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, selectedThread]);

    const buildThreads = async (msgs: Message[]) => {
        const threadMap = new Map<string, Thread>();
        msgs.forEach(m => {
            // Determine the "other person" in the conversation
            let otherPersonId: string;
            let otherPersonName: string;

            if (m.sender_id === profile?.id) {
                // I sent it - the thread is with the recipient
                otherPersonId = m.recipient_id || 'system_admin_placeholder';
                otherPersonName = m.recipient_id ? '' : 'System Admin (Legacy)'; // we'll resolve names below
            } else {
                // Someone sent it to me
                otherPersonId = m.sender_id;
                otherPersonName = m.sender_name;
            }

            const existing = threadMap.get(otherPersonId);
            const isUnread = m.sender_id !== profile?.id && !m.is_read;

            threadMap.set(otherPersonId, {
                senderId: otherPersonId,
                senderName: existing?.senderName || otherPersonName || otherPersonId,
                lastMessage: m.message,
                lastTime: m.created_at,
                unread: (existing?.unread || 0) + (isUnread ? 1 : 0),
            });
        });

        // Fetch avatars & resolve names
        const threadsList = Array.from(threadMap.values());
        const senderIds = threadsList.map(t => t.senderId).filter(id => 
            id !== 'admin' && 
            id !== 'system_admin_placeholder' &&
            id !== null &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        );
        if (senderIds.length > 0) {
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('id, avatar_url, full_name')
                .in('id', senderIds);

            if (profileError) {
                console.error('Error fetching profiles:', profileError);
            }

            if (profiles) {
                profiles.forEach(p => {
                    const t = threadMap.get(p.id);
                    if (t) {
                        t.avatarUrl = p.avatar_url;
                        if (!t.senderName || t.senderName === p.id) {
                            t.senderName = p.full_name || t.senderName;
                        }
                    }
                });
            }
        }

        setThreads(Array.from(threadMap.values()).sort((a, b) => b.lastTime.localeCompare(a.lastTime)));
    };

    const getThreadMessages = () => {
        if (!selectedThread) return [];
        return messages.filter(m => {
            const actualSender = m.sender_id;
            const actualRecipient = m.recipient_id || 'system_admin_placeholder';

            return (actualSender === selectedThread && (m.recipient_id === profile?.id || !m.recipient_id)) ||
                (m.sender_id === profile?.id && actualRecipient === selectedThread) ||
                // Fallback for old direction-based messages
                (isAdmin && m.sender_id === selectedThread) ||
                (isAdmin && m.sender_id === profile?.id && m.direction === 'admin_to_teacher');
        });
    };

    const handleSend = async () => {
        if (!newMessage.trim() || sending || !selectedThread) return;
        setSending(true);
        try {
            const { error } = await supabase.from('admin_messages').insert({
                sender_id: profile?.id,
                sender_name: profile?.full_name || (isAdmin ? 'Admin' : 'Teacher'),
                message: newMessage.trim(),
                direction: isAdmin ? 'admin_to_teacher' : 'teacher_to_admin',
                recipient_id: selectedThread !== 'admin' ? selectedThread : undefined,
            });

            if (error) {
                console.error('Error sending message:', error);
                return;
            }

            setNewMessage('');
            fetchMessages();
        } catch (err) {
            console.error('Exception in handleSend:', err);
        } finally {
            setSending(false);
        }
    };

    const startChatWith = (teacher: TeacherProfile) => {
        setSelectedThread(teacher.id);
        setSelectedRecipientName(teacher.full_name);
    };

    const markMessagesAsRead = useCallback(async (threadId: string) => {
        try {
            // Mark all unread messages from this thread as read
            const unreadMessages = messages.filter(m =>
                m.sender_id === threadId &&
                m.recipient_id === profile?.id &&
                !m.is_read
            );

            if (unreadMessages.length > 0) {
                const ids = unreadMessages.map(m => m.id);
                const { error } = await supabase
                    .from('admin_messages')
                    .update({ is_read: true })
                    .in('id', ids);

                if (error) {
                    console.error('Error marking messages as read:', error);
                    return;
                }

                // Update local state immediately so unread counter clears
                const updated = messages.map(m =>
                    ids.includes(m.id) ? { ...m, is_read: true } : m
                );
                setMessages(updated);
                await buildThreads(updated);
            }
        } catch (err) {
            console.error('Exception in markMessagesAsRead:', err);
        }
    }, [messages, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Mark messages as read when a thread is selected
    useEffect(() => {
        if (selectedThread) {
            markMessagesAsRead(selectedThread);
        }
    }, [selectedThread, markMessagesAsRead]);

    const filteredThreads = threads.filter(t =>
        t.senderName.toLowerCase().includes(search.toLowerCase())
    );

    const filteredTeachers = allTeachers.filter(t =>
        t.full_name?.toLowerCase().includes(search.toLowerCase())
    );

    // When searching in conversations tab, also show matching teachers without existing conversations
    const searchResults = sidebarTab === 'conversations' && search.trim()
        ? [
            ...filteredThreads.map(t => ({ type: 'thread' as const, data: t })),
            ...filteredTeachers
                .filter(t => !threads.find(thread => thread.senderId === t.id))
                .map(t => ({ type: 'teacher' as const, data: t }))
        ]
        : [];

    const resolvedThreadName = selectedRecipientName || threads.find(t => t.senderId === selectedThread)?.senderName || allTeachers.find(t => t.id === selectedThread)?.full_name || '';
    const threadMsgs = getThreadMessages();

    return (
        <div className="dashboard fade-in" style={{ height: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)', minHeight: 0 }}>
            {/* Header */}
            <div style={{
                flexShrink: 0,
                padding: '24px 32px 20px 32px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-primary)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h1 style={{ 
                            fontSize: '28px', 
                            fontWeight: 700, 
                            color: 'var(--text-primary)',
                            margin: 0,
                            letterSpacing: '-0.5px'
                        }}>Messages</h1>
                        <p style={{
                            fontSize: '14px',
                            color: 'var(--text-muted)',
                            margin: '4px 0 0 0',
                            fontWeight: 500
                        }}>
                            {isAdmin ? `${threads.length} conversations • ${allTeachers.length} teachers` : `Chat with admin`}
                        </p>
                    </div>
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden', minHeight: 0 }}>
                {/* Thread List / Teacher Directory */}
                <div style={{
                    width: 360,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    flexShrink: 0,
                    transition: 'none',
                    borderRight: '1px solid var(--border-subtle)',
                    background: 'var(--bg-primary)'
                }}>
                    {/* Tab Switcher */}
                    <div style={{
                        display: 'flex',
                        padding: '12px 16px',
                        gap: 6,
                        borderBottom: '1px solid var(--border-subtle)',
                        flexShrink: 0,
                        background: 'var(--bg-primary)'
                    }}>
                        <button
                            onClick={() => setSidebarTab('conversations')}
                            style={{
                                flex: 1, 
                                padding: '10px 0', 
                                borderRadius: 10, 
                                border: 'none', 
                                cursor: 'pointer',
                                background: sidebarTab === 'conversations' ? 'var(--accent-primary)' : 'transparent',
                                color: sidebarTab === 'conversations' ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                                transition: 'all 200ms ease',
                                fontSize: '13px',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6
                            }}
                        >
                            <MessageSquare size={15} />
                            Chats
                        </button>
                        <button
                            onClick={() => setSidebarTab('teachers')}
                            style={{
                                flex: 1,
                                padding: '10px 0',
                                borderRadius: 10,
                                border: 'none',
                                cursor: 'pointer',
                                background: sidebarTab === 'teachers' ? 'var(--accent-primary)' : 'transparent',
                                color: sidebarTab === 'teachers' ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                                transition: 'all 200ms ease',
                                fontSize: '13px',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6
                            }}
                        >
                            <Users size={15} />
                            {isAdmin ? 'Teachers' : 'Admins'}
                        </button>
                    </div>

                    {/* Search */}
                    <div style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-subtle)',
                        flexShrink: 0,
                        background: 'var(--bg-primary)'
                    }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={15} style={{ 
                                position: 'absolute', 
                                left: 14, 
                                top: '50%', 
                                transform: 'translateY(-50%)', 
                                color: 'var(--text-muted)',
                                strokeWidth: 2
                            }} />
                            <input
                                className="input"
                                placeholder={sidebarTab === 'conversations' ? "Search conversations..." : (isAdmin ? "Search teachers..." : "Search admins...")}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{
                                    paddingLeft: 40,
                                    padding: '10px 12px 10px 40px',
                                    borderRadius: 10,
                                    fontSize: '14px',
                                    border: '1px solid var(--border-default)',
                                    background: 'var(--bg-primary)'
                                }}
                            />
                        </div>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
                        {sidebarTab === 'conversations' ? (
                            /* Conversations Tab */
                            searchResults.length > 0 ? (
                                /* Search Results - show both threads and teachers */
                                searchResults.map((result) => {
                                    if (result.type === 'thread') {
                                        const t = result.data;
                                        return (
                                            <div key={`thread-${t.senderId}`}
                                                onClick={() => { setSelectedThread(t.senderId); setSelectedRecipientName(t.senderName); }}
                                                style={{
                                                    padding: '16px 20px',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid var(--border-subtle)',
                                                    background: selectedThread === t.senderId ? 'var(--bg-secondary)' : 'transparent',
                                                    transition: 'all 150ms ease',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 14,
                                                    position: 'relative'
                                                }}
                                                onMouseEnter={e => {
                                                    if (selectedThread !== t.senderId)
                                                        e.currentTarget.style.background = 'var(--bg-hover)';
                                                }}
                                                onMouseLeave={e => {
                                                    if (selectedThread !== t.senderId)
                                                        e.currentTarget.style.background = 'transparent';
                                                }}
                                            >
                                                <div style={{
                                                    width: 48,
                                                    height: 48,
                                                    borderRadius: '50%',
                                                    background: 'linear-gradient(135deg, var(--brand-core), var(--brand-bright))',
                                                    color: 'var(--text-on-accent)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 700,
                                                    flexShrink: 0,
                                                    overflow: 'hidden',
                                                    fontSize: '18px',
                                                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.2)'
                                                }}>
                                                    {t.avatarUrl ? (
                                                        <img src={t.avatarUrl} alt={t.senderName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        t.senderName.charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                        <span style={{
                                                            fontSize: '15px',
                                                            fontWeight: 600,
                                                            color: 'var(--text-primary)'
                                                        }}>{t.senderName}</span>
                                                        <span style={{
                                                            fontSize: '12px',
                                                            color: 'var(--text-muted)',
                                                            flexShrink: 0,
                                                            marginLeft: 12,
                                                            fontWeight: 500
                                                        }}>
                                                            {new Date(t.lastTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{
                                                            fontSize: '13px',
                                                            color: 'var(--text-muted)',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                            flex: 1
                                                        }}>
                                                            {t.lastMessage}
                                                        </span>
                                                        {t.unread > 0 && (
                                                            <span style={{
                                                                background: 'var(--accent-primary)',
                                                                color: 'var(--text-on-accent)',
                                                                fontWeight: 700,
                                                                minWidth: 22,
                                                                height: 22,
                                                                borderRadius: '50%',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                flexShrink: 0,
                                                                marginLeft: 12,
                                                                fontSize: '12px',
                                                                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
                                                            }}>{t.unread}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {selectedThread === t.senderId && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: 0,
                                                        top: 0,
                                                        bottom: 0,
                                                        width: 3,
                                                        background: 'var(--accent-primary)',
                                                        borderRadius: '0 2px 2px 0'
                                                    }} />
                                                )}
                                            </div>
                                        );
                                    } else {
                                        const t = result.data;
                                        const isAdminRole = ['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'].includes(t.role);
                                        return (
                                            <div key={`teacher-${t.id}`}
                                                onClick={() => startChatWith(t)}
                                                style={{
                                                    padding: '16px 20px',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid var(--border-subtle)',
                                                    background: selectedThread === t.id ? 'var(--bg-secondary)' : 'transparent',
                                                    transition: 'all 150ms ease',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 14,
                                                    position: 'relative'
                                                }}
                                                onMouseEnter={e => {
                                                    if (selectedThread !== t.id)
                                                        e.currentTarget.style.background = 'var(--bg-hover)';
                                                }}
                                                onMouseLeave={e => {
                                                    if (selectedThread !== t.id)
                                                        e.currentTarget.style.background = 'transparent';
                                                }}
                                            >
                                                <div style={{
                                                    width: 48,
                                                    height: 48,
                                                    borderRadius: '50%',
                                                    background: isAdminRole
                                                        ? 'linear-gradient(135deg, var(--accent-error), var(--accent-error-hover))'
                                                        : 'linear-gradient(135deg, var(--brand-core), var(--brand-bright))',
                                                    color: 'var(--text-on-accent)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 700,
                                                    flexShrink: 0,
                                                    overflow: 'hidden',
                                                    fontSize: '18px',
                                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                                                }}>
                                                    {t.avatar_url ? (
                                                        <img src={t.avatar_url} alt={t.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        t.full_name?.charAt(0)?.toUpperCase() || '?'
                                                    )}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                        <span style={{
                                                            fontSize: '15px',
                                                            fontWeight: 600,
                                                            color: 'var(--text-primary)'
                                                        }}>{t.full_name}</span>
                                                        {isAdminRole && (
                                                            <span style={{
                                                                fontSize: '10px',
                                                                fontWeight: 700,
                                                                background: 'var(--accent-error-subtle)',
                                                                color: 'var(--accent-error)',
                                                                padding: '3px 8px',
                                                                borderRadius: 6,
                                                                letterSpacing: 0.5,
                                                            }}>ADMIN</span>
                                                        )}
                                                    </div>
                                                    <span style={{
                                                        fontSize: '13px',
                                                        color: 'var(--accent-primary)',
                                                        fontWeight: 500
                                                    }}>
                                                        Start new conversation
                                                    </span>
                                                </div>
                                                {selectedThread === t.id && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        left: 0,
                                                        top: 0,
                                                        bottom: 0,
                                                        width: 3,
                                                        background: 'var(--accent-primary)',
                                                        borderRadius: '0 2px 2px 0'
                                                    }} />
                                                )}
                                            </div>
                                        );
                                    }
                                })
                            ) : filteredThreads.length === 0 && !search.trim() ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '60px 20px',
                                    color: 'var(--text-muted)'
                                }}>
                                    <div style={{
                                        width: 64,
                                        height: 64,
                                        borderRadius: '50%',
                                        background: 'var(--bg-secondary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 20px'
                                    }}>
                                        <MessageSquare size={28} style={{ opacity: 0.4 }} />
                                    </div>
                                    <p style={{
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        color: 'var(--text-primary)',
                                        margin: '0 0 8px 0'
                                    }}>No conversations yet</p>
                                    <p style={{
                                        fontSize: '13px',
                                        margin: 0
                                    }}>Go to "{isAdmin ? 'Teachers' : 'Admins'}" to start a chat</p>
                                </div>
                            ) : searchResults.length === 0 && search.trim() ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '60px 20px',
                                    color: 'var(--text-muted)'
                                }}>
                                    <div style={{
                                        width: 64,
                                        height: 64,
                                        borderRadius: '50%',
                                        background: 'var(--bg-secondary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 20px'
                                    }}>
                                        <Search size={28} style={{ opacity: 0.4 }} />
                                    </div>
                                    <p style={{
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        color: 'var(--text-primary)',
                                        margin: '0 0 8px 0'
                                    }}>No results found</p>
                                    <p style={{
                                        fontSize: '13px',
                                        margin: 0
                                    }}>Try a different search term</p>
                                </div>
                            ) : filteredThreads.map(t => (
                                <div key={t.senderId}
                                    onClick={() => { setSelectedThread(t.senderId); setSelectedRecipientName(t.senderName); }}
                                    style={{
                                        padding: '16px 20px',
                                        cursor: 'pointer',
                                        borderBottom: '1px solid var(--border-subtle)',
                                        background: selectedThread === t.senderId ? 'var(--bg-secondary)' : 'transparent',
                                        transition: 'all 150ms ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 14,
                                        position: 'relative'
                                    }}
                                    onMouseEnter={e => {
                                        if (selectedThread !== t.senderId)
                                            e.currentTarget.style.background = 'var(--bg-hover)';
                                    }}
                                    onMouseLeave={e => {
                                        if (selectedThread !== t.senderId)
                                            e.currentTarget.style.background = 'transparent';
                                    }}
                                >
                                    <div style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, var(--brand-core), var(--brand-bright))',
                                        color: 'var(--text-on-accent)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 700,
                                        flexShrink: 0,
                                        overflow: 'hidden',
                                        fontSize: '18px',
                                        boxShadow: '0 2px 8px rgba(99, 102, 241, 0.2)'
                                    }}>
                                        {t.avatarUrl ? (
                                            <img src={t.avatarUrl} alt={t.senderName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            t.senderName.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                            <span style={{
                                                fontSize: '15px',
                                                fontWeight: 600,
                                                color: 'var(--text-primary)'
                                            }}>{t.senderName}</span>
                                            <span style={{
                                                fontSize: '12px',
                                                color: 'var(--text-muted)',
                                                flexShrink: 0,
                                                marginLeft: 12,
                                                fontWeight: 500
                                            }}>
                                                {new Date(t.lastTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{
                                                fontSize: '13px',
                                                color: 'var(--text-muted)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                flex: 1
                                            }}>
                                                {t.lastMessage}
                                            </span>
                                            {t.unread > 0 && (
                                                <span style={{
                                                    background: 'var(--accent-primary)',
                                                    color: 'var(--text-on-accent)',
                                                    fontWeight: 700,
                                                    minWidth: 22,
                                                    height: 22,
                                                    borderRadius: '50%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0,
                                                    marginLeft: 12,
                                                    fontSize: '12px',
                                                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
                                                }}>{t.unread}</span>
                                            )}
                                        </div>
                                    </div>
                                    {selectedThread === t.senderId && (
                                        <div style={{
                                            position: 'absolute',
                                            left: 0,
                                            top: 0,
                                            bottom: 0,
                                            width: 3,
                                            background: 'var(--accent-primary)',
                                            borderRadius: '0 2px 2px 0'
                                        }} />
                                    )}
                                </div>
                            ))
                        ) : (
                            /* Teachers Tab */
                            filteredTeachers.length === 0 ? (
                                <div style={{ 
                                    textAlign: 'center', 
                                    padding: '60px 20px', 
                                    color: 'var(--text-muted)' 
                                }}>
                                    <div style={{
                                        width: 64,
                                        height: 64,
                                        borderRadius: '50%',
                                        background: 'var(--bg-secondary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 20px'
                                    }}>
                                        <Users size={28} style={{ opacity: 0.4 }} />
                                    </div>
                                    <p style={{ 
                                        fontSize: '16px', 
                                        fontWeight: 600,
                                        color: 'var(--text-primary)',
                                        margin: '0 0 8px 0'
                                    }}>{isAdmin ? 'No teachers found' : 'No admins found'}</p>
                                </div>
                            ) : filteredTeachers.map(teacher => {
                                const existingThread = threads.find(t => t.senderId === teacher.id);
                                const isAdminRole = ['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'].includes(teacher.role);
                                return (
                                    <div key={teacher.id}
                                        onClick={() => startChatWith(teacher)}
                                        style={{
                                            padding: '16px 20px', 
                                            cursor: 'pointer', 
                                            borderBottom: '1px solid var(--border-subtle)',
                                            background: selectedThread === teacher.id ? 'var(--bg-secondary)' : 'transparent',
                                            transition: 'all 150ms ease',
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: 14,
                                            position: 'relative'
                                        }}
                                        onMouseEnter={e => { 
                                            if (selectedThread !== teacher.id) 
                                                e.currentTarget.style.background = 'var(--bg-hover)'; 
                                        }}
                                        onMouseLeave={e => { 
                                            if (selectedThread !== teacher.id) 
                                                e.currentTarget.style.background = 'transparent'; 
                                        }}
                                    >
                                        <div style={{
                                            width: 48, 
                                            height: 48, 
                                            borderRadius: '50%',
                                            background: isAdminRole 
                                                ? 'linear-gradient(135deg, var(--accent-error), var(--accent-error-hover))' 
                                                : 'linear-gradient(135deg, var(--brand-core), var(--brand-bright))',
                                            color: 'var(--text-on-accent)',
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center',
                                            fontWeight: 700, 
                                            flexShrink: 0, 
                                            overflow: 'hidden',
                                            fontSize: '18px',
                                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                                        }}>
                                            {teacher.avatar_url ? (
                                                <img src={teacher.avatar_url} alt={teacher.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                teacher.full_name?.charAt(0)?.toUpperCase() || '?'
                                            )}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                <span style={{ 
                                                    fontSize: '15px', 
                                                    fontWeight: 600,
                                                    color: 'var(--text-primary)' 
                                                }}>{teacher.full_name}</span>
                                                {isAdminRole && (
                                                    <span style={{
                                                        fontSize: '10px', 
                                                        fontWeight: 700,
                                                        background: 'var(--accent-error-subtle)', 
                                                        color: 'var(--accent-error)',
                                                        padding: '3px 8px', 
                                                        borderRadius: 6, 
                                                        letterSpacing: 0.5,
                                                    }}>ADMIN</span>
                                                )}
                                            </div>
                                            <span style={{ 
                                                fontSize: '13px', 
                                                color: 'var(--text-muted)' 
                                            }}>
                                                {existingThread ? `Last: ${existingThread.lastMessage.slice(0, 35)}...` : 'No messages yet - tap to start'}
                                            </span>
                                        </div>
                                        <MessageSquare size={18} style={{ 
                                            color: 'var(--text-muted)', 
                                            flexShrink: 0,
                                            strokeWidth: 2
                                        }} />
                                        {selectedThread === teacher.id && (
                                            <div style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 0,
                                                bottom: 0,
                                                width: 3,
                                                background: 'var(--accent-primary)',
                                                borderRadius: '0 2px 2px 0'
                                            }} />
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                {selectedThread ? (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        background: 'var(--bg-primary)'
                    }}>
                        {/* Chat Header */}
                        <div style={{
                            padding: '16px 24px',
                            borderBottom: '1px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            flexShrink: 0,
                            background: 'var(--bg-primary)',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                        }}>
                            <button 
                                onClick={() => setSelectedThread(null)}
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 10,
                                    border: '1px solid var(--border-default)',
                                    background: 'var(--bg-primary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 150ms ease',
                                    color: 'var(--text-secondary)'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = 'var(--bg-hover)';
                                    e.currentTarget.style.borderColor = 'var(--border-default)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = 'var(--bg-primary)';
                                    e.currentTarget.style.borderColor = 'var(--border-default)';
                                }}
                            >
                                <ArrowLeft size={18} strokeWidth={2} />
                            </button>
                            <div style={{
                                width: 44, 
                                height: 44, 
                                borderRadius: '50%', 
                                background: 'linear-gradient(135deg, var(--brand-core), var(--brand-bright))', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                color: 'var(--text-on-accent)',
                                overflow: 'hidden',
                                flexShrink: 0,
                                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)',
                                fontSize: '18px',
                                fontWeight: 700
                            }}>
                                {(() => {
                                    const thr = threads.find(t => t.senderId === selectedThread);
                                    const teacher = allTeachers.find(t => t.id === selectedThread);
                                    const avatar = thr?.avatarUrl || teacher?.avatar_url;
                                    if (avatar) return <img src={avatar} alt={`Avatar for ${resolvedThreadName}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                                    return resolvedThreadName.charAt(0).toUpperCase();
                                })()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ 
                                    fontSize: '16px', 
                                    fontWeight: 700,
                                    color: 'var(--text-primary)',
                                    display: 'block'
                                }}>{resolvedThreadName}</span>
                                <span style={{ 
                                    fontSize: '12px',
                                    color: 'var(--text-muted)',
                                    fontWeight: 500
                                }}>
                                    {threadMsgs.length} messages
                                </span>
                            </div>
                        </div>

                        {/* Messages */}
                        <div style={{ 
                            flex: 1, 
                            overflowY: 'auto', 
                            padding: '24px', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: 16,
                            background: 'var(--bg-primary)'
                        }}>
                            {threadMsgs.length === 0 ? (
                                <div style={{ 
                                    textAlign: 'center', 
                                    padding: '80px 20px', 
                                    color: 'var(--text-muted)' 
                                }}>
                                    <div style={{
                                        width: 72,
                                        height: 72,
                                        borderRadius: '50%',
                                        background: 'var(--bg-secondary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto 24px'
                                    }}>
                                        <MessageSquare size={32} style={{ opacity: 0.3 }} />
                                    </div>
                                    <p style={{ 
                                        fontSize: '18px', 
                                        fontWeight: 600,
                                        color: 'var(--text-primary)',
                                        margin: '0 0 8px 0'
                                    }}>No messages yet</p>
                                    <p style={{ 
                                        fontSize: '14px',
                                        margin: 0
                                    }}>Start the conversation by sending a message below</p>
                                </div>
                            ) : threadMsgs.map(m => {
                                const isMine = m.sender_id === profile?.id;
                                return (
                                    <div key={m.id} style={{
                                        maxWidth: '75%', 
                                        alignSelf: isMine ? 'flex-end' : 'flex-start',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: isMine ? 'flex-end' : 'flex-start'
                                    }}>
                                        <div style={{
                                            padding: '14px 18px', 
                                            borderRadius: 18, 
                                            lineHeight: 1.6,
                                            background: isMine 
                                                ? 'linear-gradient(135deg, var(--brand-core), var(--brand-bright))' 
                                                : 'var(--bg-surface)',
                                            color: isMine ? 'var(--text-on-accent)' : 'var(--text-primary)',
                                            borderBottomRightRadius: isMine ? 4 : 18,
                                            borderBottomLeftRadius: isMine ? 18 : 4,
                                            fontSize: '15px',
                                            fontWeight: 500,
                                            boxShadow: isMine 
                                                ? '0 2px 8px rgba(99, 102, 241, 0.25)' 
                                                : '0 1px 3px rgba(0, 0, 0, 0.1)',
                                            border: isMine ? 'none' : '1px solid var(--border-subtle)'
                                        }}>
                                            {!isMine && (
                                                <div style={{ 
                                                    fontSize: '12px', 
                                                    fontWeight: 700, 
                                                    color: isMine ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)', 
                                                    marginBottom: 8,
                                                    letterSpacing: 0.3
                                                }}>{m.sender_name}</div>
                                            )}
                                            {m.message}
                                        </div>
                                        <div style={{ 
                                            fontSize: '11px', 
                                            color: 'var(--text-muted)', 
                                            marginTop: 6, 
                                            fontWeight: 500,
                                            letterSpacing: 0.3
                                        }}>
                                            {new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div style={{
                            padding: '20px 24px',
                            borderTop: '1px solid var(--border-subtle)',
                            display: 'flex',
                            gap: 12,
                            flexShrink: 0,
                            background: 'var(--bg-primary)'
                        }}>
                            <div style={{ 
                                flex: 1, 
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center'
                            }}>
                                <input 
                                    className="input" 
                                    placeholder="Type a message..."
                                    value={newMessage} 
                                    onChange={e => setNewMessage(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                    style={{ 
                                        flex: 1,
                                        padding: '14px 16px',
                                        paddingRight: 50,
                                        borderRadius: 24,
                                        fontSize: '15px',
                                        border: '1px solid var(--border-default)',
                                        background: 'var(--bg-primary)',
                                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                                    }} 
                                />
                            </div>
                            <button 
                                onClick={handleSend} 
                                disabled={!newMessage.trim() || sending}
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '50%',
                                    border: 'none',
                                    background: newMessage.trim() 
                                        ? 'linear-gradient(135deg, var(--brand-core), var(--brand-bright))' 
                                        : 'var(--bg-secondary)',
                                    color: newMessage.trim() ? 'var(--text-on-accent)' : 'var(--text-muted)',
                                    cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 200ms ease',
                                    boxShadow: newMessage.trim() 
                                        ? '0 4px 12px rgba(99, 102, 241, 0.3)' 
                                        : 'none',
                                    flexShrink: 0
                                }}
                                onMouseEnter={e => {
                                    if (newMessage.trim()) {
                                        e.currentTarget.style.transform = 'scale(1.05)';
                                    }
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                }}
                            >
                                <Send size={18} strokeWidth={2.5} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--bg-primary)',
                        minHeight: 0
                    }}>
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            <div style={{
                                width: 96,
                                height: 96,
                                borderRadius: '50%',
                                background: 'var(--bg-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 28px'
                            }}>
                                <Users size={42} style={{ opacity: 0.3 }} />
                            </div>
                            <p style={{
                                fontSize: '24px',
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                margin: '0 0 12px 0'
                            }}>Select a conversation</p>
                            <p style={{
                                fontSize: '15px',
                                margin: 0,
                                maxWidth: 400,
                                lineHeight: 1.6
                            }}>Choose from existing chats or browse "{isAdmin ? 'Teachers' : 'Admins'}" to start a new conversation</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommunicationHub;

