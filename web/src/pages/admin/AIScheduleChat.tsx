import React, { useState, useRef, useEffect } from 'react';
import { Send, Wand2, Loader2, BookOpen, Users, MapPin, Clock } from 'lucide-react';
import { sendToOptiBot } from '../../services/optibotService';
import { useSchedules, useTeachers, useRooms } from '../../hooks/useSupabase';

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    data?: any;
}

const AIScheduleChat: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'system', content: 'Hello! I\'m OptiBot, your AI scheduling assistant. I can help you:\n\n• **Generate** optimized schedules\n• **Analyze** conflicts and workloads\n• **Suggest** room and time assignments\n• **Answer** scheduling questions\n\nHow can I help you today?', timestamp: new Date() }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { schedules } = useSchedules({ status: 'published' });
    const { teachers } = useTeachers();
    const { rooms } = useRooms();

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg: ChatMessage = { role: 'user', content: input.trim(), timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const conversationHistory = messages.filter(m => m.role !== 'system').map(m => ({
                role: m.role as 'user' | 'model',
                parts: [{ text: m.content }]
            }));

            const response = await sendToOptiBot(input.trim(), conversationHistory);

            const assistantMsg: ChatMessage = {
                role: 'assistant',
                content: response || 'I apologize, but I couldn\'t process that request. Could you try rephrasing?',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (error: any) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Sorry, I encountered an error: ${error.message}\n\nPlease try again.`,
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const quickActions = [
        { label: 'Analyze workload distribution', icon: <Users size={14} /> },
        { label: 'Find room conflicts', icon: <MapPin size={14} /> },
        { label: 'Suggest schedule improvements', icon: <Wand2 size={14} /> },
        { label: 'Generate empty slot analysis', icon: <Clock size={14} /> },
    ];

    return (
        <div className="ai-chat-page">
            <div className="ai-chat-container glass-panel">
                {/* Header */}
                <div className="ai-chat-header">
                    <div className="ai-chat-header-info">
                        <div className="ai-avatar"><Wand2 size={20} /></div>
                        <div>
                            <h3>AI Schedule Assistant</h3>
                            <span className="text-muted">Powered by OptiBot</span>
                        </div>
                    </div>
                    <div className="data-badges">
                        <span className="data-badge"><BookOpen size={12} /> {schedules.length} schedules</span>
                        <span className="data-badge"><Users size={12} /> {teachers.length} teachers</span>
                        <span className="data-badge"><MapPin size={12} /> {rooms.length} rooms</span>
                    </div>
                </div>

                {/* Messages */}
                <div className="ai-messages">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`ai-msg ${msg.role}`}>
                            {msg.role === 'system' && <div className="ai-msg-avatar system"><Wand2 size={16} /></div>}
                            {msg.role === 'assistant' && <div className="ai-msg-avatar assistant"><Wand2 size={16} /></div>}
                            <div className="ai-msg-content">
                                <div className="ai-msg-bubble" dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>').replace(/• /g, '&bull; ') }} />
                                <span className="ai-msg-time">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="ai-msg assistant">
                            <div className="ai-msg-avatar assistant"><Wand2 size={16} /></div>
                            <div className="ai-msg-content"><div className="ai-msg-bubble typing"><Loader2 size={16} className="spin" /> Thinking...</div></div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Actions */}
                {messages.length <= 2 && (
                    <div className="ai-quick-actions">
                        {quickActions.map((action, idx) => (
                            <button key={idx} className="ai-quick-action" onClick={() => { setInput(action.label); }}>
                                {action.icon} {action.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input */}
                <form className="ai-input-form" onSubmit={handleSend}>
                    <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about schedules, conflicts, workloads..." disabled={isLoading} />
                    <button type="submit" disabled={!input.trim() || isLoading}><Send size={18} /></button>
                </form>
            </div>

            <style>{`
                .ai-chat-page { height: calc(100vh - 140px); }
                .ai-chat-container { display: flex; flex-direction: column; height: 100%; overflow: hidden; }

                .ai-chat-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-light); flex-wrap: wrap; gap: 0.75rem; }
                .ai-chat-header-info { display: flex; align-items: center; gap: 0.75rem; }
                .ai-avatar { width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #8b5cf6, #6366f1); display: flex; align-items: center; justify-content: center; color: white; }
                .ai-chat-header-info h3 { font-size: 1.1rem; }
                .data-badges { display: flex; gap: 0.5rem; }
                .data-badge { display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: rgba(255,255,255,0.05); border-radius: 12px; font-size: 0.7rem; color: var(--text-muted); }

                .ai-messages { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
                .ai-msg { display: flex; gap: 0.75rem; max-width: 80%; }
                .ai-msg.user { align-self: flex-end; flex-direction: row-reverse; }
                .ai-msg.system, .ai-msg.assistant { align-self: flex-start; }
                .ai-msg-avatar { width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .ai-msg-avatar.system { background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; }
                .ai-msg-avatar.assistant { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; }
                .ai-msg-content { max-width: 100%; }
                .ai-msg-bubble { padding: 0.875rem 1.25rem; border-radius: 1rem; font-size: 0.9rem; line-height: 1.5; }
                .ai-msg.user .ai-msg-bubble { background: var(--brand-primary); color: white; border-bottom-right-radius: 0.25rem; }
                .ai-msg.system .ai-msg-bubble, .ai-msg.assistant .ai-msg-bubble { background: rgba(30,41,59,0.8); border: 1px solid var(--border-light); border-bottom-left-radius: 0.25rem; }
                .ai-msg-bubble.typing { display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); }
                .ai-msg-time { font-size: 0.65rem; color: var(--text-muted); margin-top: 4px; display: block; }

                .ai-quick-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0 1.5rem 0.75rem; }
                .ai-quick-action { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 20px; border: 1px solid var(--border-light); background: transparent; color: var(--text-secondary); font-size: 0.8rem; cursor: pointer; transition: all 0.2s; }
                .ai-quick-action:hover { background: rgba(139,92,246,0.1); border-color: #8b5cf6; color: #a78bfa; }

                .ai-input-form { display: flex; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid var(--border-light); }
                .ai-input-form input { flex: 1; padding: 0.875rem 1.25rem; background: rgba(255,255,255,0.05); border: 1px solid var(--border-light); border-radius: 24px; color: white; font-size: 0.95rem; outline: none; }
                .ai-input-form input:focus { border-color: #8b5cf6; }
                .ai-input-form button { width: 46px; height: 46px; border-radius: 50%; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.2s; }
                .ai-input-form button:hover { transform: scale(1.05); }
                .ai-input-form button:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

                .text-muted { color: var(--text-muted); font-size: 0.8rem; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};

export default AIScheduleChat;
