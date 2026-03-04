import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Send, Users, Search, ArrowLeft } from 'lucide-react';
import '../admin/Dashboard.css';

interface Message {
    id: string;
    sender_id: string;
    sender_name: string;
    message: string;
    direction: string;
    created_at: string;
    is_read: boolean;
}

interface Thread {
    senderId: string;
    senderName: string;
    lastMessage: string;
    lastTime: string;
    unread: number;
}

const CommunicationHub: React.FC = () => {
    const { profile } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [threads, setThreads] = useState<Thread[]>([]);
    const [selectedThread, setSelectedThread] = useState<string | null>(null);
    const [newMessage, setNewMessage] = useState('');
    const [search, setSearch] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isAdmin = ['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'].includes(profile?.role || '');

    useEffect(() => {
        fetchMessages();

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

    const fetchMessages = async () => {
        const { data } = await supabase
            .from('admin_messages')
            .select('*')
            .order('created_at', { ascending: true });

        if (data) {
            setMessages(data);
            buildThreads(data);
        }
    };

    const buildThreads = (msgs: Message[]) => {
        const threadMap = new Map<string, Thread>();
        msgs.forEach(m => {
            const key = isAdmin ? m.sender_id : 'admin';
            const displayName = isAdmin ? m.sender_name : 'Admin';
            const existing = threadMap.get(key);
            const isUnread = isAdmin
                ? m.direction === 'teacher_to_admin' && !m.is_read
                : m.direction === 'admin_to_teacher' && !m.is_read && m.sender_id !== profile?.id;

            threadMap.set(key, {
                senderId: key,
                senderName: existing?.senderName || displayName,
                lastMessage: m.message,
                lastTime: m.created_at,
                unread: (existing?.unread || 0) + (isUnread ? 1 : 0),
            });
        });
        setThreads(Array.from(threadMap.values()).sort((a, b) => b.lastTime.localeCompare(a.lastTime)));
    };

    const getThreadMessages = () => {
        if (!selectedThread) return [];
        if (isAdmin) {
            return messages.filter(m => m.sender_id === selectedThread ||
                (m.direction === 'admin_to_teacher' && m.sender_id === profile?.id));
        }
        return messages.filter(m =>
            m.sender_id === profile?.id ||
            m.direction === 'admin_to_teacher'
        );
    };

    const handleSend = async () => {
        if (!newMessage.trim() || sending) return;
        setSending(true);
        try {
            await supabase.from('admin_messages').insert({
                sender_id: profile?.id,
                sender_name: profile?.full_name || (isAdmin ? 'Admin' : 'Teacher'),
                message: newMessage.trim(),
                direction: isAdmin ? 'admin_to_teacher' : 'teacher_to_admin',
            });
            setNewMessage('');
            fetchMessages();
        } catch (err) {
            console.error(err);
        } finally {
            setSending(false);
        }
    };

    const filteredThreads = threads.filter(t =>
        t.senderName.toLowerCase().includes(search.toLowerCase())
    );

    const selectedThreadName = threads.find(t => t.senderId === selectedThread)?.senderName || '';
    const threadMsgs = getThreadMessages();

    return (
        <div className="dashboard fade-in" style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="dashboard-header" style={{ flexShrink: 0 }}>
                <div>
                    <h1 className="dashboard-title">Messages</h1>
                    <p className="dashboard-subtitle">
                        {isAdmin ? `${threads.length} conversations` : 'Contact administration'}
                    </p>
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden', minHeight: 0 }}>
                {/* Thread List */}
                <div className="card" style={{
                    width: selectedThread ? 280 : '100%',
                    maxWidth: 360,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    flexShrink: 0,
                    transition: 'width 200ms ease',
                }}>
                    {/* Search */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input className="input" placeholder="Search conversations..." value={search} onChange={e => setSearch(e.target.value)}
                                style={{ paddingLeft: 36, fontSize: 13, padding: '8px 12px 8px 36px' }} />
                        </div>
                    </div>

                    {/* Thread Items */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {filteredThreads.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                <Users size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                                <p style={{ fontSize: 13 }}>No conversations yet</p>
                            </div>
                        ) : filteredThreads.map(t => (
                            <div key={t.senderId}
                                onClick={() => setSelectedThread(t.senderId)}
                                style={{
                                    padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                                    background: selectedThread === t.senderId ? 'var(--bg-secondary)' : 'transparent',
                                    transition: 'background 150ms ease',
                                }}
                                onMouseEnter={e => { if (selectedThread !== t.senderId) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                onMouseLeave={e => { if (selectedThread !== t.senderId) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{t.senderName}</span>
                                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                        {new Date(t.lastTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                                        {t.lastMessage}
                                    </span>
                                    {t.unread > 0 && (
                                        <span style={{
                                            background: 'var(--accent-primary)', color: '#fff', fontSize: 10, fontWeight: 700,
                                            width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        }}>{t.unread}</span>
                                    )}
                                </div>
                            </div>
                        ))}
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
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>
                                {selectedThreadName.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedThreadName}</span>
                        </div>

                        {/* Messages */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {threadMsgs.map(m => {
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
                            <p style={{ fontSize: 16 }}>Select a conversation to start messaging</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommunicationHub;
