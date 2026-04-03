import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Send, Users, Search, ArrowLeft, MessageSquare, KeyRound } from 'lucide-react';
import PasswordResetManager from '../admin/PasswordResetManager';
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
    const { profile } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [threads, setThreads] = useState<Thread[]>([]);
    const [allTeachers, setAllTeachers] = useState<TeacherProfile[]>([]);
    const [selectedThread, setSelectedThread] = useState<string | null>(null);
    const [selectedRecipientName, setSelectedRecipientName] = useState('');
    const [newMessage, setNewMessage] = useState('');
    const [search, setSearch] = useState('');
    const [sending, setSending] = useState(false);
    const [sidebarTab, setSidebarTab] = useState<'conversations' | 'teachers' | 'resets'>('conversations');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isAdmin = ['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'].includes(profile?.role || '');

    useEffect(() => {
        fetchMessages();
        fetchAllTeachers();

        // Real-time subscription for instant message updates
        const channel = supabase
            .channel('comm-hub-messages')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_messages' }, () => {
                fetchMessages();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [profile]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, selectedThread]);

    const fetchAllTeachers = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, role')
            .in('role', ['teacher', 'admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'])
            .order('full_name', { ascending: true });

        if (data) {
            // Filter out the current user
            setAllTeachers(data.filter(t => t.id !== profile?.id));
        }
    };

    const fetchMessages = async () => {
        let query = supabase
            .from('admin_messages')
            .select('*')
            .order('created_at', { ascending: true });

        // If teacher, only get their own messages
        if (!['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'].includes(profile?.role || '')) {
            query = query.or(`sender_id.eq.${profile?.id},recipient_id.eq.${profile?.id}`);
        }

        const { data } = await query;

        if (data) {
            setMessages(data);
            await buildThreads(data);
        }
    };

    const buildThreads = async (msgs: Message[]) => {
        const threadMap = new Map<string, Thread>();
        msgs.forEach(m => {
            // Determine the "other person" in the conversation
            let otherPersonId: string;
            let otherPersonName: string;

            if (m.sender_id === profile?.id) {
                // I sent it - the thread is with the recipient
                otherPersonId = m.recipient_id || 'admin';
                otherPersonName = m.recipient_id ? '' : 'Admin'; // we'll resolve names below
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
        const senderIds = threadsList.map(t => t.senderId).filter(id => id !== 'admin');
        if (senderIds.length > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, avatar_url, full_name')
                .in('id', senderIds);

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
            return (m.sender_id === selectedThread && (m.recipient_id === profile?.id || !m.recipient_id)) ||
                (m.sender_id === profile?.id && m.recipient_id === selectedThread) ||
                // Fallback for old direction-based messages
                (isAdmin && m.sender_id === selectedThread) ||
                (isAdmin && m.sender_id === profile?.id && m.direction === 'admin_to_teacher');
        });
    };

    const handleSend = async () => {
        if (!newMessage.trim() || sending || !selectedThread) return;
        setSending(true);
        try {
            await supabase.from('admin_messages').insert({
                sender_id: profile?.id,
                sender_name: profile?.full_name || (isAdmin ? 'Admin' : 'Teacher'),
                message: newMessage.trim(),
                direction: isAdmin ? 'admin_to_teacher' : 'teacher_to_admin',
                recipient_id: selectedThread !== 'admin' ? selectedThread : undefined,
            });
            setNewMessage('');
            fetchMessages();
        } catch (err) {
            console.error(err);
        } finally {
            setSending(false);
        }
    };

    const startChatWith = (teacher: TeacherProfile) => {
        setSelectedThread(teacher.id);
        setSelectedRecipientName(teacher.full_name);
        setSidebarTab('conversations');
    };

    const filteredThreads = threads.filter(t =>
        t.senderName.toLowerCase().includes(search.toLowerCase())
    );

    const filteredTeachers = allTeachers.filter(t =>
        t.full_name?.toLowerCase().includes(search.toLowerCase())
    );

    const resolvedThreadName = selectedRecipientName || threads.find(t => t.senderId === selectedThread)?.senderName || allTeachers.find(t => t.id === selectedThread)?.full_name || '';
    const threadMsgs = getThreadMessages();

    return (
        <div className="dashboard fade-in" style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="dashboard-header" style={{ flexShrink: 0 }}>
                <div>
                    <h1 className="dashboard-title">Messages</h1>
                    <p className="dashboard-subtitle">
                        {isAdmin ? `${threads.length} conversations • ${allTeachers.length} teachers` : `Chat with admin & ${allTeachers.length} teachers`}
                    </p>
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden', minHeight: 0 }}>
                {/* Thread List / Teacher Directory */}
                <div className="card" style={{
                    width: selectedThread ? 300 : '100%',
                    maxWidth: 380,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    flexShrink: 0,
                    transition: 'width 200ms ease',
                }}>
                    {/* Tab Switcher */}
                    <div style={{ display: 'flex', padding: '8px 12px', gap: 4, borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
                        <button
                            onClick={() => setSidebarTab('conversations')}
                            style={{
                                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                                background: sidebarTab === 'conversations' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                color: sidebarTab === 'conversations' ? '#fff' : 'var(--text-secondary)',
                                fontWeight: 600, fontSize: 12, transition: 'all 150ms ease',
                            }}
                        >
                            <MessageSquare size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                            Chats
                        </button>
                        <button
                            onClick={() => setSidebarTab('teachers')}
                            style={{
                                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                                background: sidebarTab === 'teachers' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                color: sidebarTab === 'teachers' ? '#fff' : 'var(--text-secondary)',
                                fontWeight: 600, fontSize: 12, transition: 'all 150ms ease',
                            }}
                        >
                            <Users size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                            All Teachers
                        </button>
                        {isAdmin && (
                            <button
                                onClick={() => setSidebarTab('resets')}
                                style={{
                                    flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                                    background: sidebarTab === 'resets' ? '#f59e0b' : 'var(--bg-secondary)',
                                    color: sidebarTab === 'resets' ? '#fff' : 'var(--text-secondary)',
                                    fontWeight: 600, fontSize: 12, transition: 'all 150ms ease',
                                }}
                            >
                                <KeyRound size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                                Resets
                            </button>
                        )}
                    </div>

                    {/* Search */}
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input className="input" placeholder={sidebarTab === 'conversations' ? "Search conversations..." : "Search teachers..."} value={search} onChange={e => setSearch(e.target.value)}
                                style={{ paddingLeft: 36, fontSize: 13, padding: '8px 12px 8px 36px' }} />
                        </div>
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {sidebarTab === 'resets' && isAdmin ? (
                            <PasswordResetManager />
                        ) : sidebarTab === 'conversations' ? (
                            /* Conversations Tab */
                            filteredThreads.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                    <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                                    <p style={{ fontSize: 13 }}>No conversations yet</p>
                                    <p style={{ fontSize: 11, marginTop: 4 }}>Go to "All Teachers" to start a chat</p>
                                </div>
                            ) : filteredThreads.map(t => (
                                <div key={t.senderId}
                                    onClick={() => { setSelectedThread(t.senderId); setSelectedRecipientName(t.senderName); }}
                                    style={{
                                        padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                                        background: selectedThread === t.senderId ? 'var(--bg-secondary)' : 'transparent',
                                        transition: 'background 150ms ease',
                                        display: 'flex', alignItems: 'center', gap: 12,
                                    }}
                                    onMouseEnter={e => { if (selectedThread !== t.senderId) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                    onMouseLeave={e => { if (selectedThread !== t.senderId) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <div style={{
                                        width: 40, height: 40, borderRadius: '50%',
                                        background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 700, fontSize: 15, flexShrink: 0, overflow: 'hidden'
                                    }}>
                                        {t.avatarUrl ? (
                                            <img src={t.avatarUrl} alt={t.senderName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            t.senderName.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{t.senderName}</span>
                                            <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                                                {new Date(t.lastTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                                {t.lastMessage}
                                            </span>
                                            {t.unread > 0 && (
                                                <span style={{
                                                    background: 'var(--accent-primary)', color: '#fff', fontSize: 10, fontWeight: 700,
                                                    width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 8,
                                                }}>{t.unread}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            /* All Teachers Tab */
                            filteredTeachers.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                    <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                                    <p style={{ fontSize: 13 }}>No teachers found</p>
                                </div>
                            ) : filteredTeachers.map(teacher => {
                                const existingThread = threads.find(t => t.senderId === teacher.id);
                                const isAdminRole = ['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'].includes(teacher.role);
                                return (
                                    <div key={teacher.id}
                                        onClick={() => startChatWith(teacher)}
                                        style={{
                                            padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                                            background: selectedThread === teacher.id ? 'var(--bg-secondary)' : 'transparent',
                                            transition: 'background 150ms ease',
                                            display: 'flex', alignItems: 'center', gap: 12,
                                        }}
                                        onMouseEnter={e => { if (selectedThread !== teacher.id) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                        onMouseLeave={e => { if (selectedThread !== teacher.id) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <div style={{
                                            width: 40, height: 40, borderRadius: '50%',
                                            background: isAdminRole ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
                                            color: isAdminRole ? '#ef4444' : '#818cf8',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontWeight: 700, fontSize: 15, flexShrink: 0, overflow: 'hidden'
                                        }}>
                                            {teacher.avatar_url ? (
                                                <img src={teacher.avatar_url} alt={teacher.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                teacher.full_name?.charAt(0)?.toUpperCase() || '?'
                                            )}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{teacher.full_name}</span>
                                                {isAdminRole && (
                                                    <span style={{
                                                        fontSize: 9, fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                                                        padding: '2px 6px', borderRadius: 4, letterSpacing: 0.5,
                                                    }}>ADMIN</span>
                                                )}
                                            </div>
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {existingThread ? `Last: ${existingThread.lastMessage.slice(0, 30)}...` : 'No messages yet - tap to start'}
                                            </span>
                                        </div>
                                        <MessageSquare size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Chat Area */}
                {selectedThread ? (
                    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {/* Chat Header */}
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                            <button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => setSelectedThread(null)}>
                                <ArrowLeft size={18} />
                            </button>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, overflow: 'hidden' }}>
                                {(() => {
                                    const thr = threads.find(t => t.senderId === selectedThread);
                                    const teacher = allTeachers.find(t => t.id === selectedThread);
                                    const avatar = thr?.avatarUrl || teacher?.avatar_url;
                                    if (avatar) return <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                                    return resolvedThreadName.charAt(0).toUpperCase();
                                })()}
                            </div>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{resolvedThreadName}</span>
                        </div>

                        {/* Messages */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {threadMsgs.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                    <MessageSquare size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                                    <p style={{ fontSize: 14 }}>No messages yet</p>
                                    <p style={{ fontSize: 12, marginTop: 4 }}>Start the conversation by sending a message below</p>
                                </div>
                            ) : threadMsgs.map(m => {
                                const isMine = m.sender_id === profile?.id;
                                return (
                                    <div key={m.id} style={{
                                        maxWidth: '70%', alignSelf: isMine ? 'flex-end' : 'flex-start',
                                    }}>
                                        <div style={{
                                            padding: '10px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.5,
                                            background: isMine ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                                            color: isMine ? '#fff' : 'var(--text-primary)',
                                            borderBottomRightRadius: isMine ? 4 : 12,
                                            borderBottomLeftRadius: isMine ? 12 : 4,
                                        }}>
                                            {!isMine && <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>{m.sender_name}</div>}
                                            {m.message}
                                        </div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, textAlign: isMine ? 'right' : 'left' }}>
                                            {new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-default)', display: 'flex', gap: 8, flexShrink: 0 }}>
                            <input className="input" placeholder="Type a message..."
                                value={newMessage} onChange={e => setNewMessage(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                style={{ flex: 1 }} />
                            <button className="btn btn-primary" style={{ padding: '8px 16px' }} onClick={handleSend} disabled={!newMessage.trim() || sending}>
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Users size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                            <p style={{ fontSize: 16, fontWeight: 600 }}>Select a conversation</p>
                            <p style={{ fontSize: 13, marginTop: 4 }}>Choose from existing chats or browse "All Teachers" to start a new conversation</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommunicationHub;

