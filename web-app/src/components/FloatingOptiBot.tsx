import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Send } from 'lucide-react';
import './FloatingOptiBot.css';

const GEMINI_API_KEY = 'AIzaSyD3EnaaPrcEfmYIwNWIHeB-BoXWQlYxvp8';
const GROQ_API_KEY = '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';
const OPENROUTER_API_KEY = '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';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GEMINI_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];

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
    const historyRef = useRef<{ role: string; parts: { text: string }[] }[]>([]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [messages, isTyping]);

    const systemText = `You are OptiBot, the AI scheduling assistant for OptiSched (STI College Meycauayan). Help with schedules, conflicts, rooms, teachers, and school operations. Be concise and helpful. The user is ${profile?.full_name || 'a user'} (${profile?.role || 'user'}).`;

    const callGemini = async (text: string): Promise<string | null> => {
        const body = {
            contents: [...historyRef.current, { role: 'user', parts: [{ text }] }],
            systemInstruction: { parts: [{ text: systemText }] }
        };

        for (const model of GEMINI_MODELS) {
            try {
                const url = `${GEMINI_BASE}/${model}:generateContent?key=${GEMINI_API_KEY}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (!res.ok) continue;
                const data = await res.json();
                const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (reply) return reply;
            } catch { continue; }
        }
        return null;
    };

    const callGroq = async (text: string): Promise<string | null> => {
        try {
            const msgs = historyRef.current.map(h => ({
                role: h.role === 'model' ? 'assistant' : 'user',
                content: h.parts[0].text,
            }));
            const res = await fetch(GROQ_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_API_KEY}` },
                body: JSON.stringify({
                    model: 'llama-3.3-70b-versatile',
                    messages: [{ role: 'system', content: systemText }, ...msgs, { role: 'user', content: text }],
                    max_tokens: 1024,
                }),
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data?.choices?.[0]?.message?.content || null;
        } catch { return null; }
    };

    const callOpenRouter = async (text: string): Promise<string | null> => {
        try {
            const msgs = historyRef.current.map(h => ({
                role: h.role === 'model' ? 'assistant' : 'user',
                content: h.parts[0].text,
            }));
            const res = await fetch(OPENROUTER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': window.location.origin,
                },
                body: JSON.stringify({
                    model: 'meta-llama/llama-3.3-70b-instruct',
                    messages: [{ role: 'system', content: systemText }, ...msgs, { role: 'user', content: text }],
                    max_tokens: 1024,
                }),
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data?.choices?.[0]?.message?.content || null;
        } catch { return null; }
    };

    const getReply = async (text: string): Promise<string> => {
        // Try providers in order: Gemini → Groq → OpenRouter
        const geminiReply = await callGemini(text);
        if (geminiReply) return geminiReply;

        const groqReply = await callGroq(text);
        if (groqReply) return groqReply;

        const openRouterReply = await callOpenRouter(text);
        if (openRouterReply) return openRouterReply;

        return 'Sorry, all AI services are temporarily unavailable. Please try again in a moment.';
    };

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || isTyping) return;

        setMessages(prev => [...prev, { role: 'user', text }]);
        setInput('');
        setIsTyping(true);

        try {
            const reply = await getReply(text);

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
                            <img src="/logo.png" alt="OptiBot" />
                        </div>
                        <div className="optibot-panel-header-info">
                            <h3>OptiBot AI</h3>
                            <span>● Online — Powered by Gemini</span>
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
                    <img src="/logo.png" alt="OptiBot" />
                )}
            </button>
        </>
    );
};

export default FloatingOptiBot;
