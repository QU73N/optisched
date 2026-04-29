import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

import { Send, Wand2, Loader2, RotateCcw } from 'lucide-react';
import { sendToOptiBot } from '../../services/optibotService';
import type { GeminiMessage } from '../../services/optibotService';

interface ChatMessage {
    id: string;
    content: string;
    isBot: boolean;
    timestamp: Date;
}

const OptiBotPage: React.FC = () => {
    const { profile } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '1', isBot: true, timestamp: new Date(),
            content: "Hi! I'm OptiSched AI, your dedicated scheduling assistant for STI College Meycauayan.\n\nI can help you with:\n- Viewing and managing schedules\n- Finding and resolving conflicts\n- Room availability and status\n- Faculty load management\n\nHow can I assist you today?"
        },
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const conversationHistoryRef = useRef<GeminiMessage[]>([]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, isTyping]);

    const role = profile?.role || 'student';
    const quickActions = role === 'admin' ? [
        { label: 'Find Conflicts', query: 'Are there any scheduling conflicts right now?' },
        { label: 'Room Status', query: 'Show me the available rooms and their status' },
        { label: 'Faculty Load', query: 'Show the faculty load summary for all teachers' },
        { label: "Today's Schedule", query: 'What classes are happening today?' },
    ] : [
        { label: 'Next Class', query: 'When is my next class?' },
        { label: 'Next Break', query: 'When is my next break or free period?' },
        { label: "Today's Schedule", query: 'Show me my complete schedule for today' },
        { label: 'This Week', query: 'Show my full schedule for this week' },
    ];

    const sendMessage = async (text: string) => {
        if (!text.trim() || isTyping) return;
        const userMsg: ChatMessage = { id: Date.now().toString(), isBot: false, content: text.trim(), timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        try {
            const aiResponse = await sendToOptiBot(text.trim(), conversationHistoryRef.current, {
                full_name: profile?.full_name ?? undefined,
                role: profile?.role ?? undefined,
                email: profile?.email ?? undefined,
            });
            conversationHistoryRef.current.push(
                { role: 'user', parts: [{ text: text.trim() }] },
                { role: 'model', parts: [{ text: aiResponse }] }
            );
            if (conversationHistoryRef.current.length > 20) {
                conversationHistoryRef.current = conversationHistoryRef.current.slice(-20);
            }
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), isBot: true, content: aiResponse, timestamp: new Date() }]);
        } catch {
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), isBot: true, content: 'Sorry, I encountered an error. Please try again.', timestamp: new Date() }]);
        } finally {
            setIsTyping(false);
        }
    };

    const resetChat = () => {
        setMessages([messages[0]]);
        conversationHistoryRef.current = [];
    };

    const renderMarkdown = (text: string) => {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/^### (.*)$/gm, '<h4>$1</h4>')
            .replace(/^## (.*)$/gm, '<h3>$1</h3>')
            .replace(/^# (.*)$/gm, '<h2>$1</h2>')
            .replace(/^[-•*] (.*)$/gm, '<li>$1</li>')
            .replace(/\n/g, '<br/>');
    };

    return (
        <div className="optibot-page">
            <div className="optibot-container glass-panel">
                {/* Header */}
                <div className="optibot-header">
                    <div className="optibot-header-info">
                        <div className="optibot-avatar"><Wand2 size={22} /></div>
                        <div>
                            <h3>OptiBot</h3>
                            <div className="optibot-status">
                                <span className="online-dot" />
                                <span>Powered by Gemini AI</span>
                            </div>
                        </div>
                    </div>
                    <button className="reset-btn" onClick={resetChat} title="Reset conversation">
                        <RotateCcw size={16} />
                    </button>
                </div>

                {/* Messages */}
                <div className="optibot-messages" ref={scrollRef}>
                    {messages.map(msg => (
                        <div key={msg.id} className={`optibot-msg ${msg.isBot ? 'bot' : 'user'}`}>
                            {msg.isBot && <div className="optibot-msg-avatar"><Wand2 size={14} /></div>}
                            <div className="optibot-msg-bubble">
                                {msg.isBot ? (
                                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                                ) : (
                                    <span>{msg.content}</span>
                                )}
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="optibot-msg bot">
                            <div className="optibot-msg-avatar"><Wand2 size={14} /></div>
                            <div className="optibot-msg-bubble typing"><Loader2 size={14} className="spin" /> OptiBot is thinking...</div>
                        </div>
                    )}
                </div>

                {/* Quick Actions */}
                {messages.length <= 2 && !isTyping && (
                    <div className="optibot-quick-actions">
                        <span className="quick-label">QUICK ACTIONS</span>
                        <div className="quick-grid">
                            {quickActions.map((a, i) => (
                                <button key={i} className="quick-btn" onClick={() => sendMessage(a.query)}>{a.label}</button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input */}
                <form className="optibot-input" onSubmit={e => { e.preventDefault(); sendMessage(input); }}>
                    <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask OptiBot anything..." disabled={isTyping} />
                    <button type="submit" disabled={!input.trim() || isTyping}><Send size={18} /></button>
                </form>
            </div>

            <style>{`
                .optibot-page { height: calc(100vh - 140px); }
                .optibot-container { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
                .optibot-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-default); }
                .optibot-header-info { display: flex; align-items: center; gap: 0.75rem; }
                .optibot-avatar { width: 44px; height: 44px; border-radius: 14px; background: linear-gradient(135deg, #8b5cf6, #6366f1); display: flex; align-items: center; justify-content: center; color: white; }
                .optibot-header h3 { font-size: 1.1rem; }
                .optibot-status { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; color: var(--text-muted); }
                .online-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; }
                .reset-btn { background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 8px; padding: 8px; color: var(--text-muted); cursor: pointer; }
                .reset-btn:hover { color: var(--text-primary); background: var(--bg-hover); }
                .optibot-messages { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
                .optibot-msg { display: flex; gap: 0.75rem; max-width: 85%; }
                .optibot-msg.user { align-self: flex-end; flex-direction: row-reverse; }
                .optibot-msg.bot { align-self: flex-start; }
                .optibot-msg-avatar { width: 28px; height: 28px; border-radius: 10px; background: rgba(129,140,248,0.15); display: flex; align-items: center; justify-content: center; color: #818cf8; flex-shrink: 0; margin-top: 4px; }
                .optibot-msg-bubble { padding: 0.875rem 1.25rem; border-radius: 1rem; font-size: 0.9rem; line-height: 1.6; }
                .optibot-msg.user .optibot-msg-bubble { background: var(--accent-primary); color: white; border-bottom-right-radius: 4px; }
                .optibot-msg.bot .optibot-msg-bubble { background: var(--bg-surface); border: 1px solid var(--border-default); border-bottom-left-radius: 4px; }
                .optibot-msg-bubble code { background: rgba(99,102,241,0.15); color: var(--accent-primary-hover); padding: 1px 6px; border-radius: 4px; font-size: 0.85em; }
                .optibot-msg-bubble h2, .optibot-msg-bubble h3, .optibot-msg-bubble h4 { color: var(--accent-primary-hover); margin: 8px 0 4px; }
                .optibot-msg-bubble li { margin-left: 1rem; }
                .optibot-msg-bubble strong { color: var(--accent-primary-hover); }
                .optibot-msg-bubble.typing { display: flex; align-items: center; gap: 0.5rem; color: var(--accent-primary-hover); font-style: italic; font-size: 0.85rem; }
                .optibot-quick-actions { padding: 0 1.5rem 0.75rem; }
                .quick-label { font-size: 0.65rem; font-weight: 600; color: var(--text-muted); letter-spacing: 1px; display: block; margin-bottom: 0.5rem; }
                .quick-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; }
                .quick-btn { padding: 0.5rem 1rem; border-radius: 12px; border: 1px solid var(--border-default); background: var(--bg-surface); color: var(--text-secondary); font-size: 0.8rem; cursor: pointer; transition: all 0.2s; }
                .quick-btn:hover { background: rgba(139,92,246,0.1); border-color: #8b5cf6; color: var(--accent-primary-hover); }
                .optibot-input { display: flex; gap: 0.75rem; padding: 1rem 1.5rem; border-top: 1px solid var(--border-default); }
                .optibot-input input { flex: 1; padding: 0.875rem 1.25rem; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 24px; color: var(--text-primary); font-size: 0.95rem; outline: none; font-family: var(--font-family); }
                .optibot-input input:focus { border-color: #8b5cf6; }
                .optibot-input button { width: 46px; height: 46px; border-radius: 50%; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; }
                .optibot-input button:disabled { opacity: 0.4; cursor: not-allowed; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};

export default OptiBotPage;
