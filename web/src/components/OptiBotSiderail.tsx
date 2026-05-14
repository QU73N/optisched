import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Send, Bot, Plus, Trash2, MessageSquare, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { sendToOptiBot } from '../services/optibotService';
import type { GeminiMessage } from '../services/optibotService';
import DOMPurify from 'dompurify';
import './OptiBotSiderail.css';

interface ChatMessage {
    id: string;
    content: string;
    isBot: boolean;
    timestamp: Date;
}

interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: Date;
    updatedAt: Date;
    isSaved: boolean;
}

const OptiBotSiderail: React.FC = () => {
    const { profile } = useAuth();
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isOnline, setIsOnline] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const conversationHistoryRef = useRef<GeminiMessage[]>([]);

    // Initialize with a default session
    useEffect(() => {
        const defaultSession: ChatSession = {
            id: Date.now().toString(),
            title: 'New Chat',
            messages: [
                {
                    id: '1',
                    isBot: true,
                    timestamp: new Date(),
                    content: "Hi! I'm OptiBot, your AI assistant. Ask me anything about OptiSched!"
                }
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
            isSaved: false
        };
        setSessions([defaultSession]);
        setCurrentSessionId(defaultSession.id);
        loadSessionsFromStorage();
    }, []);

    // Load sessions from localStorage
    const loadSessionsFromStorage = () => {
        try {
            const stored = localStorage.getItem('optibot-sessions');
            if (stored) {
                const parsed = JSON.parse(stored);
                setSessions(parsed);
                if (parsed.length > 0) {
                    setCurrentSessionId(parsed[0].id);
                }
            }
        } catch (error) {
            console.error('Failed to load sessions:', error);
        }
    };

    // Save sessions to localStorage
    const saveSessionsToStorage = (updatedSessions: ChatSession[]) => {
        try {
            localStorage.setItem('optibot-sessions', JSON.stringify(updatedSessions));
        } catch (error) {
            console.error('Failed to save sessions:', error);
        }
    };

    // Check OptiBot status
    useEffect(() => {
        const checkOptiBotStatus = async () => {
            const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
            const GEMINI_API_KEY_2 = import.meta.env.VITE_GEMINI_API_KEY_2 || '';
            const GEMINI_API_KEY_3 = import.meta.env.VITE_GEMINI_API_KEY_3 || '';
            const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
            const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';

            const hasValidKey = (GEMINI_API_KEY && !GEMINI_API_KEY.includes('YOUR_')) ||
                               (GEMINI_API_KEY_2 && !GEMINI_API_KEY_2.includes('YOUR_')) ||
                               (GEMINI_API_KEY_3 && !GEMINI_API_KEY_3.includes('YOUR_')) ||
                               (GROQ_API_KEY && !GROQ_API_KEY.includes('YOUR_')) ||
                               (OPENROUTER_API_KEY && !OPENROUTER_API_KEY.includes('YOUR_'));

            setIsOnline(hasValidKey);
        };

        checkOptiBotStatus();
        const interval = setInterval(checkOptiBotStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [sessions, currentSessionId, isTyping]);

    const currentSession = sessions.find(s => s.id === currentSessionId);

    const createNewSession = () => {
        const newSession: ChatSession = {
            id: Date.now().toString(),
            title: 'New Chat',
            messages: [
                {
                    id: '1',
                    isBot: true,
                    timestamp: new Date(),
                    content: "Hi! I'm OptiBot, your AI assistant. Ask me anything about OptiSched!"
                }
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
            isSaved: false
        };
        const updatedSessions = [newSession, ...sessions];
        setSessions(updatedSessions);
        setCurrentSessionId(newSession.id);
        conversationHistoryRef.current = [];
        saveSessionsToStorage(updatedSessions);
    };

    const deleteSession = (sessionId: string) => {
        const updatedSessions = sessions.filter(s => s.id !== sessionId);
        if (updatedSessions.length === 0) {
            createNewSession();
        } else {
            setSessions(updatedSessions);
            setCurrentSessionId(updatedSessions[0].id);
            saveSessionsToStorage(updatedSessions);
        }
    };

    const switchSession = (sessionId: string) => {
        setCurrentSessionId(sessionId);
        const session = sessions.find(s => s.id === sessionId);
        if (session) {
            // Rebuild conversation history from session messages
            conversationHistoryRef.current = session.messages
                .filter(m => !m.isBot)
                .map(m => ({ role: 'user' as const, parts: [{ text: m.content }] }));
        }
    };

    const saveSession = (sessionId: string) => {
        const updatedSessions = sessions.map(s => 
            s.id === sessionId ? { ...s, isSaved: true } : s
        );
        setSessions(updatedSessions);
        saveSessionsToStorage(updatedSessions);
    };

    const sendMessage = async (text: string) => {
        if (!text.trim() || isTyping || !currentSessionId) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            isBot: false,
            content: text.trim(),
            timestamp: new Date()
        };

        const updatedSessions = sessions.map(s => {
            if (s.id === currentSessionId) {
                const updatedMessages = [...s.messages, userMsg];
                // Auto-generate title from first user message
                const title = s.messages.length <= 1 ? text.trim().slice(0, 30) + (text.length > 30 ? '...' : '') : s.title;
                return {
                    ...s,
                    messages: updatedMessages,
                    title,
                    updatedAt: new Date()
                };
            }
            return s;
        });

        setSessions(updatedSessions);
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

            const botMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                isBot: true,
                content: aiResponse,
                timestamp: new Date()
            };

            const finalSessions = updatedSessions.map(s => {
                if (s.id === currentSessionId) {
                    return {
                        ...s,
                        messages: [...s.messages, botMsg],
                        updatedAt: new Date()
                    };
                }
                return s;
            });

            setSessions(finalSessions);
            saveSessionsToStorage(finalSessions);
        } catch {
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                isBot: true,
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date()
            };

            const errorSessions = updatedSessions.map(s => {
                if (s.id === currentSessionId) {
                    return {
                        ...s,
                        messages: [...s.messages, errorMsg],
                        updatedAt: new Date()
                    };
                }
                return s;
            });

            setSessions(errorSessions);
            saveSessionsToStorage(errorSessions);
        } finally {
            setIsTyping(false);
        }
    };

    const renderMarkdown = (text: string) => {
        const html = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/^### (.*)$/gm, '<h4>$1</h4>')
            .replace(/^## (.*)$/gm, '<h3>$1</h3>')
            .replace(/^# (.*)$/gm, '<h2>$1</h2>')
            .replace(/^[-•*] (.*)$/gm, '<li>$1</li>')
            .replace(/\n/g, '<br/>');
        return DOMPurify.sanitize(html);
    };

    return (
        <div className="optibot-siderail-wrapper">
            {/* Chat History Sidebar */}
            <div className={`optibot-chat-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
                <div className="optibot-chat-sidebar-header">
                    <button
                        className="optibot-toggle-sidebar"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        title={sidebarOpen ? 'Collapse' : 'Expand'}
                    >
                        {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                    </button>
                    {sidebarOpen && (
                        <>
                            <h4>Chats</h4>
                            <button
                                className="optibot-new-chat"
                                onClick={createNewSession}
                                title="New chat"
                            >
                                <Plus size={16} />
                            </button>
                        </>
                    )}
                </div>

                {sidebarOpen && (
                    <div className="optibot-chat-list">
                        {sessions.map(session => (
                            <div
                                key={session.id}
                                className={`optibot-chat-item ${session.id === currentSessionId ? 'active' : ''}`}
                                onClick={() => switchSession(session.id)}
                            >
                                <div className="optibot-chat-item-content">
                                    <MessageSquare size={14} />
                                    <span className="optibot-chat-title">{session.title}</span>
                                </div>
                                <div className="optibot-chat-item-actions">
                                    {!session.isSaved && profile && (
                                        <button
                                            className="optibot-save-chat"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                saveSession(session.id);
                                            }}
                                            title="Save chat"
                                        >
                                            <MessageSquare size={12} />
                                        </button>
                                    )}
                                    <button
                                        className="optibot-delete-chat"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteSession(session.id);
                                        }}
                                        title="Delete chat"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Chat Area */}
            <div className="optibot-siderail">
                <div className="optibot-siderail-header">
                    <div className="optibot-siderail-header-info">
                        <div className="optibot-avatar">
                            <Bot size={20} />
                        </div>
                        <div>
                            <h3>OptiBot</h3>
                            <div className="optibot-status">
                                <span className={`online-dot ${isOnline ? 'online' : 'offline'}`} />
                                <span>{isOnline ? 'Online' : 'Offline'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="optibot-siderail-messages" ref={scrollRef}>
                    {currentSession?.messages.map(msg => (
                        <div key={msg.id} className={`optibot-siderail-msg ${msg.isBot ? 'bot' : 'user'}`}>
                            {msg.isBot && <div className="optibot-siderail-msg-avatar"><Bot size={14} /></div>}
                            <div className="optibot-siderail-msg-bubble">
                                {msg.isBot ? (
                                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                                ) : (
                                    <span>{msg.content}</span>
                                )}
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                        <div className="optibot-siderail-msg bot">
                            <div className="optibot-siderail-msg-avatar"><Bot size={14} /></div>
                            <div className="optibot-siderail-msg-bubble typing">
                                <Loader2 size={14} className="spin" /> OptiBot is thinking...
                            </div>
                        </div>
                    )}
                </div>

                <form
                    className="optibot-siderail-input"
                    onSubmit={(e) => {
                        e.preventDefault();
                        sendMessage(input);
                    }}
                >
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask OptiBot..."
                        disabled={isTyping || !isOnline}
                    />
                    <button type="submit" disabled={!input.trim() || isTyping || !isOnline}>
                        <Send size={16} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default OptiBotSiderail;
