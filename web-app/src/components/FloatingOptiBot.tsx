import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Send, Bot } from 'lucide-react';
import { sendToOptiBot } from '../services/optibotService';
import type { GeminiMessage } from '../services/optibotService';
import './FloatingOptiBot.css';

interface ChatMsg { role: 'user' | 'bot'; text: string; }

const FloatingOptiBot: React.FC = () => {
    const { profile } = useAuth();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMsg[]>([
        { role: 'bot', text: 'Hi! I\'m OptiBot, your AI scheduling assistant. How can I help you today?' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const historyRef = useRef<GeminiMessage[]>([]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, isTyping]);

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || isTyping) return;

        setMessages(prev => [...prev, { role: 'user', text }]);
        setInput('');
        setIsTyping(true);

        try {
            const reply = await sendToOptiBot(text, historyRef.current, {
                full_name: profile?.full_name,
                role: profile?.role,
                email: profile?.email,
            });

            historyRef.current.push(
                { role: 'user', parts: [{ text }] },
                { role: 'model', parts: [{ text: reply }] }
            );

            if (historyRef.current.length > 20) {
                historyRef.current = historyRef.current.slice(-20);
            }

            setMessages(prev => [...prev, { role: 'bot', text: reply }]);
        } catch {
            setMessages(prev => [...prev, { role: 'bot', text: 'Connection error. Please try again.' }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <>
            {open && (
                <div className="optibot-panel">
                    <div className="optibot-panel-header">
                        <div className="optibot-panel-header-icon">
                            <Bot size={22} />
                        </div>
                        <div className="optibot-panel-header-info">
                            <h3>OptiBot AI</h3>
                            <span>● Online - Powered by Gemini</span>
                        </div>
                    </div>

                    <div className="optibot-panel-messages" ref={scrollRef}>
                        {messages.map((msg, i) => (
                            <div key={i} className={`optibot-msg ${msg.role === 'bot' ? 'optibot-msg-bot' : 'optibot-msg-user'}`}>
                                {msg.text}
                            </div>
                        ))}
                        {isTyping && <div className="optibot-typing">OptiBot is thinking...</div>}
                    </div>

                    <div className="optibot-panel-input">
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendMessage()}
                            placeholder="Ask OptiBot anything..."
                            disabled={isTyping}
                        />
                        <button onClick={sendMessage} disabled={!input.trim() || isTyping}>
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            )}

            <button className="floating-optibot-btn" onClick={() => setOpen(!open)} title="OptiBot AI">
                {open ? (
                    <span className="close-icon">✕</span>
                ) : (
                    <Bot size={28} color="#a5b4fc" />
                )}
            </button>
        </>
    );
};

export default FloatingOptiBot;
