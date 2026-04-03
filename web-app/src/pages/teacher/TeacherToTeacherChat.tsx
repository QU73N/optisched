import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Send, Search, User, ArrowLeft } from 'lucide-react';

interface ChatMessage {
    id: string;
    sender_id: string;
    sender_name: string;
    receiver_id: string;
    message: string;
    created_at: string;
}

const TeacherToTeacherChat: React.FC = () => {
    const { profile } = useAuth();
    const [teachers, setTeachers] = useState<any[]>([]);
    const [selectedTeacher, setSelectedTeacher] = useState<any | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch all teachers
    useEffect(() => {
        const fetchTeachers = async () => {
            const { data } = await supabase.from('profiles').select('id, full_name, role').eq('role', 'teacher');
            if (data) setTeachers(data.filter(t => t.id !== profile?.id));
        };
        if (profile?.id) fetchTeachers();
    }, [profile]);

    // Fetch messages for selected conversation
    useEffect(() => {
        if (!selectedTeacher || !profile?.id) return;

        const fetchMessages = async () => {
            const { data } = await supabase
                .from('teacher_messages')
                .select('*')
                .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${selectedTeacher.id}),and(sender_id.eq.${selectedTeacher.id},receiver_id.eq.${profile.id})`)
                .order('created_at', { ascending: true });
            if (data) setMessages(data);
        };

        fetchMessages();

        // Real-time
        const channel = supabase
            .channel(`teacher-chat-${profile.id}-${selectedTeacher.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'teacher_messages' }, payload => {
                const msg = payload.new as ChatMessage;
                if (
                    (msg.sender_id === profile.id && msg.receiver_id === selectedTeacher.id) ||
                    (msg.sender_id === selectedTeacher.id && msg.receiver_id === profile.id)
                ) {
                    setMessages(prev => [...prev, msg]);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [selectedTeacher, profile]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !profile?.id || !selectedTeacher) return;
        setSending(true);
        try {
            await supabase.from('teacher_messages').insert({
                sender_id: profile.id,
                sender_name: profile.full_name || 'Teacher',
                receiver_id: selectedTeacher.id,
                message: newMessage.trim()
            });
            setNewMessage('');
        } catch (err: any) {
            window.alert('Failed to send: ' + err.message);
        } finally { setSending(false); }
    };

    const filtered = teachers.filter(t => t.full_name?.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="t2t-chat">
            <div className="t2t-layout">
                {/* Contacts */}
                <div className={`t2t-sidebar glass-panel ${selectedTeacher ? 'mobile-hide' : ''}`}>
                    <div className="t2t-sidebar-header">
                        <h3>Colleagues</h3>
                    </div>
                    <div className="t2t-search">
                        <Search size={16} />
                        <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>
                    <div className="t2t-contacts">
                        {filtered.length === 0 ? (
                            <div className="text-center p-4 text-muted">No colleagues found</div>
                        ) : filtered.map(t => (
                            <button key={t.id} className={`t2t-contact ${selectedTeacher?.id === t.id ? 'active' : ''}`} onClick={() => setSelectedTeacher(t)}>
                                <div className="t2t-avatar">{t.full_name?.charAt(0) || 'T'}</div>
                                <span>{t.full_name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Chat Area */}
                <div className={`t2t-main glass-panel ${!selectedTeacher ? 'mobile-hide' : ''}`}>
                    {!selectedTeacher ? (
                        <div className="t2t-empty"><User size={48} /><h3>Select a Colleague</h3><p>Choose a teacher from the list to start chatting</p></div>
                    ) : (
                        <>
                            <div className="t2t-chat-header">
                                <button className="t2t-back" onClick={() => setSelectedTeacher(null)}><ArrowLeft size={18} /></button>
                                <div className="t2t-avatar sm">{selectedTeacher.full_name?.charAt(0)}</div>
                                <h4>{selectedTeacher.full_name}</h4>
                            </div>
                            <div className="t2t-messages">
                                {messages.length === 0 ? (
                                    <div className="t2t-empty sm"><p>Start a conversation</p></div>
                                ) : messages.map((msg, idx) => {
                                    const isMe = msg.sender_id === profile?.id;
                                    return (
                                        <div key={msg.id || idx} className={`t2t-msg ${isMe ? 'mine' : 'theirs'}`}>
                                            {!isMe && <div className="t2t-msg-avatar">{msg.sender_name?.charAt(0)}</div>}
                                            <div className="t2t-bubble">
                                                <p>{msg.message}</p>
                                                <span className="t2t-time">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={messagesEndRef} />
                            </div>
                            <form className="t2t-input" onSubmit={handleSend}>
                                <input type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." disabled={sending} />
                                <button type="submit" disabled={!newMessage.trim() || sending}><Send size={18} /></button>
                            </form>
                        </>
                    )}
                </div>
            </div>

            <style>{`
                .t2t-chat { height: calc(100vh - 140px); }
                .t2t-layout { display: flex; gap: 1rem; height: 100%; }

                .t2t-sidebar { width: 300px; display: flex; flex-direction: column; overflow: hidden; }
                .t2t-sidebar-header { padding: 1.25rem; border-bottom: 1px solid var(--border-light); }
                .t2t-search { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-light); color: var(--text-muted); }
                .t2t-search input { flex: 1; background: none; border: none; color: white; outline: none; }
                .t2t-contacts { flex: 1; overflow-y: auto; }
                .t2t-contact { display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 1.25rem; width: 100%; text-align: left; background: none; border: none; border-bottom: 1px solid rgba(255,255,255,0.02); color: white; cursor: pointer; transition: background 0.2s; border-left: 3px solid transparent; }
                .t2t-contact:hover { background: rgba(255,255,255,0.02); }
                .t2t-contact.active { background: rgba(59,130,246,0.1); border-left-color: var(--brand-primary); }
                .t2t-avatar { width: 36px; height: 36px; border-radius: 50%; background: rgba(139,92,246,0.2); color: #a78bfa; display: flex; align-items: center; justify-content: center; font-weight: 600; flex-shrink: 0; }
                .t2t-avatar.sm { width: 32px; height: 32px; font-size: 0.85rem; }

                .t2t-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
                .t2t-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted); gap: 0.75rem; }
                .t2t-empty.sm { padding: 2rem; }
                .t2t-empty h3 { color: white; }

                .t2t-chat-header { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-light); }
                .t2t-chat-header h4 { font-weight: 600; }
                .t2t-back { background: none; border: none; color: var(--text-muted); cursor: pointer; display: none; }

                .t2t-messages { flex: 1; overflow-y: auto; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
                .t2t-msg { display: flex; gap: 0.5rem; max-width: 75%; align-items: flex-end; }
                .t2t-msg.mine { align-self: flex-end; flex-direction: row-reverse; }
                .t2t-msg.theirs { align-self: flex-start; }
                .t2t-msg-avatar { width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); flex-shrink: 0; }
                .t2t-bubble { padding: 0.75rem 1rem; border-radius: 1rem; border-bottom-left-radius: 0.25rem; background: rgba(30,41,59,0.8); border: 1px solid var(--border-light); }
                .t2t-msg.mine .t2t-bubble { background: var(--brand-primary); border-color: var(--brand-primary); color: white; border-bottom-left-radius: 1rem; border-bottom-right-radius: 0.25rem; }
                .t2t-bubble p { font-size: 0.9rem; margin: 0; line-height: 1.4; }
                .t2t-time { font-size: 0.65rem; color: rgba(255,255,255,0.4); display: block; text-align: right; margin-top: 4px; }
                .t2t-msg.mine .t2t-time { color: rgba(255,255,255,0.6); }

                .t2t-input { display: flex; gap: 0.75rem; padding: 1rem 1.25rem; border-top: 1px solid var(--border-light); }
                .t2t-input input { flex: 1; padding: 0.75rem 1rem; background: rgba(255,255,255,0.05); border: 1px solid var(--border-light); border-radius: 24px; color: white; outline: none; }
                .t2t-input input:focus { border-color: var(--brand-primary); }
                .t2t-input button { width: 42px; height: 42px; border-radius: 50%; background: var(--brand-primary); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; }
                .t2t-input button:disabled { opacity: 0.4; cursor: not-allowed; }

                .text-muted { color: var(--text-muted); }

                @media (max-width: 768px) {
                    .mobile-hide { display: none !important; }
                    .t2t-sidebar { width: 100%; }
                    .t2t-back { display: block !important; }
                }
            `}</style>
        </div>
    );
};

export default TeacherToTeacherChat;
