import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useRef } from 'react';
import {
    View, Text, ScrollView, StyleSheet,
    TextInput, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { ChatMessage } from '../../types/database';
import { sendToGemini, GeminiMessage } from '../../services/optibotService';
import { useAuth } from '../../contexts/AuthContext';
import { AnimatedPressable } from '../../components/AnimatedPressable';

const OptiBotChat: React.FC = () => {
    const { profile } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '1', user_id: 'bot', is_bot: true, metadata: null, created_at: new Date().toISOString(),
            content: "Hi! I'm OptiSched AI, your dedicated scheduling assistant for STI College Meycauayan.\n\nI can help you with:\n- 📅 Viewing and managing schedules\n- 🔍 Finding and resolving conflicts\n- 🏫 Room availability and status\n- 👨‍🏫 Faculty load management\n\nHow can I assist you today?"
        },
    ]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);
    const conversationHistoryRef = useRef<GeminiMessage[]>([]);

    // Simple markdown renderer for bot messages
    const renderMarkdown = (text: string) => {
        const lines = text.split('\n');
        return lines.map((line, lineIdx) => {
            // Headers
            if (line.startsWith('### ')) {
                return <Text key={lineIdx} style={{ fontSize: 14, fontWeight: '700', color: '#c4b5fd', marginTop: 8, marginBottom: 4 }}>{line.slice(4)}{'\n'}</Text>;
            }
            if (line.startsWith('## ')) {
                return <Text key={lineIdx} style={{ fontSize: 15, fontWeight: '700', color: '#a78bfa', marginTop: 8, marginBottom: 4 }}>{line.slice(3)}{'\n'}</Text>;
            }
            if (line.startsWith('# ')) {
                return <Text key={lineIdx} style={{ fontSize: 16, fontWeight: '700', color: '#818cf8', marginTop: 8, marginBottom: 4 }}>{line.slice(2)}{'\n'}</Text>;
            }
            // Bullet points
            if (line.match(/^[\s]*[-•*]\s/)) {
                const content = line.replace(/^[\s]*[-•*]\s/, '');
                return <Text key={lineIdx} style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 21 }}>  •  {renderInline(content)}{'\n'}</Text>;
            }
            // Regular line with inline formatting
            return <Text key={lineIdx} style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 21 }}>{renderInline(line)}{lineIdx < lines.length - 1 ? '\n' : ''}</Text>;
        });
    };

    const renderInline = (text: string): (string | React.ReactElement)[] => {
        const parts: (string | React.ReactElement)[] = [];
        // Match **bold** and *italic*
        const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
        let lastIndex = 0;
        let match;
        let key = 0;
        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }
            if (match[2]) { // **bold**
                parts.push(<Text key={key++} style={{ fontWeight: '700', color: '#c4b5fd' }}>{match[2]}</Text>);
            } else if (match[3]) { // *italic*
                parts.push(<Text key={key++} style={{ fontStyle: 'italic', color: '#93c5fd' }}>{match[3]}</Text>);
            } else if (match[4]) { // `code`
                parts.push(<Text key={key++} style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: 'rgba(99,102,241,0.15)', color: '#a5b4fc', paddingHorizontal: 4, borderRadius: 4, fontSize: 13 }}>{match[4]}</Text>);
            }
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex));
        }
        return parts.length > 0 ? parts : [text];
    };

    const role = profile?.role || 'student';
    const quickActions = role === 'admin' ? [
        { label: 'Find Conflicts', query: 'Are there any scheduling conflicts right now?' },
        { label: 'Room Status', query: 'Show me the available rooms and their status' },
        { label: 'Faculty Load', query: 'Show the faculty load summary for all teachers' },
        { label: 'Today\'s Schedule', query: 'What classes are happening today?' },
    ] : [
        { label: 'Next Class', query: 'When is my next class?' },
        { label: 'Next Break', query: 'When is my next break or free period?' },
        { label: 'Today\'s Schedule', query: 'Show me my complete schedule for today' },
        { label: 'This Week', query: 'Show my full schedule for this week' },
    ];

    const sendMessage = async (text: string) => {
        if (!text.trim() || isTyping) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            user_id: profile?.id || 'user',
            is_bot: false,
            content: text.trim(),
            metadata: null,
            created_at: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsTyping(true);

        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            // Send to Gemini with conversation history
            const aiResponse = await sendToGemini(text.trim(), conversationHistoryRef.current, {
                full_name: profile?.full_name ?? undefined,
                role: profile?.role ?? undefined,
                email: profile?.email ?? undefined,
                program: profile?.program ?? undefined,
                section: profile?.section ?? undefined,
                year_level: profile?.year_level != null ? String(profile.year_level) : undefined
            });

            // Update conversation history
            conversationHistoryRef.current.push(
                { role: 'user', parts: [{ text: text.trim() }] },
                { role: 'model', parts: [{ text: aiResponse }] }
            );

            // Keep history manageable (last 10 exchanges)
            if (conversationHistoryRef.current.length > 20) {
                conversationHistoryRef.current = conversationHistoryRef.current.slice(-20);
            }

            const botMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                user_id: 'bot',
                is_bot: true,
                content: aiResponse,
                metadata: null,
                created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                user_id: 'bot',
                is_bot: true,
                content: '❌ Sorry, I encountered an error. Please try again.',
                metadata: null,
                created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsTyping(false);
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 200);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerInfo}>
                    <View style={styles.botAvatarSmall}>
                        <MaterialIcons name="smart-toy" size={20} color="#818cf8" />
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>OptiBot</Text>
                        <View style={styles.onlineRow}>
                            <View style={styles.onlineDot} />
                            <Text style={styles.onlineText}>Powered by Gemini AI</Text>
                        </View>
                    </View>
                </View>
                <AnimatedPressable onPress={() => {
                    setMessages([messages[0]]);
                    conversationHistoryRef.current = [];
                }}>
                    <MaterialIcons name="refresh" size={24} color={Colors.slate400} />
                </AnimatedPressable>
            </View>

            {/* Messages */}
            <ScrollView
                ref={scrollViewRef}
                style={styles.messagesArea}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
            >
                {messages.map(msg => (
                    <View
                        key={msg.id}
                        style={[styles.messageBubble, msg.is_bot ? styles.botBubble : styles.userBubble]}
                    >
                        {msg.is_bot && (
                            <View style={styles.botAvatar}>
                                <MaterialIcons name="smart-toy" size={16} color="#818cf8" />
                            </View>
                        )}
                        <View style={[styles.bubbleContent, msg.is_bot ? styles.botContent : styles.userContent]}>
                            {msg.is_bot ? (
                                <Text style={[styles.messageText, styles.botText]}>
                                    {renderMarkdown(msg.content)}
                                </Text>
                            ) : (
                                <Text style={[styles.messageText, styles.userText]}>
                                    {msg.content}
                                </Text>
                            )}
                        </View>
                    </View>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                    <View style={[styles.messageBubble, styles.botBubble]}>
                        <View style={styles.botAvatar}>
                            <MaterialIcons name="smart-toy" size={16} color="#818cf8" />
                        </View>
                        <View style={[styles.bubbleContent, styles.botContent]}>
                            <View style={styles.typingRow}>
                                <ActivityIndicator size="small" color="#818cf8" />
                                <Text style={styles.typingText}>OptiBot is thinking...</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Quick Actions (show when few messages) */}
                {messages.length <= 2 && !isTyping && (
                    <View style={styles.quickActionsSection}>
                        <Text style={styles.quickActionsLabel}>QUICK ACTIONS</Text>
                        <View style={styles.quickActionsGrid}>
                            {quickActions.map((action, index) => (
                                <AnimatedPressable
                                    key={index}
                                    style={styles.quickActionBtn}
                                    onPress={() => sendMessage(action.query)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.quickActionText}>{action.label}</Text>
                                </AnimatedPressable>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Input Area */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={88}
            >
                <View style={styles.inputArea}>
                    <View style={styles.inputRow}>
                        <TextInput
                            style={styles.input}
                            placeholder="Ask OptiBot anything..."
                            placeholderTextColor={Colors.slate500}
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                            maxLength={500}
                            editable={!isTyping}
                        />
                        <AnimatedPressable
                            style={[styles.sendBtn, (!inputText.trim() || isTyping) && styles.sendBtnDisabled]}
                            onPress={() => sendMessage(inputText)}
                            disabled={!inputText.trim() || isTyping}
                        >
                            <MaterialIcons name="send" size={20} color={inputText.trim() && !isTyping ? Colors.white : Colors.slate600} />
                        </AnimatedPressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0a0f1a' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        backgroundColor: '#141925', borderBottomWidth: 1, borderBottomColor: Colors.borderDark
    },
    backBtn: { padding: 4 },
    headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 12 },
    botAvatarSmall: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(129,140,248,0.15)', justifyContent: 'center', alignItems: 'center'
    },
    headerTitle: { fontSize: 16, fontWeight: '700', color: Colors.white },
    onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
    onlineText: { fontSize: 11, color: Colors.slate400 },

    messagesArea: { flex: 1 },
    messagesContent: { paddingHorizontal: 16, paddingVertical: 16, gap: 16 },

    messageBubble: { flexDirection: 'row', gap: 8 },
    botBubble: { alignSelf: 'flex-start', maxWidth: '85%' },
    userBubble: { alignSelf: 'flex-end', maxWidth: '80%', flexDirection: 'row-reverse' },
    botAvatar: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: 'rgba(129,140,248,0.15)', justifyContent: 'center', alignItems: 'center',
        marginTop: 4
    },
    bubbleContent: { borderRadius: 16, padding: 14, maxWidth: '100%' },
    botContent: { backgroundColor: '#1e293b', borderBottomLeftRadius: 4 },
    userContent: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
    messageText: { fontSize: 14, lineHeight: 21 },
    botText: { color: '#e2e8f0' },
    userText: { color: Colors.white },

    typingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    typingText: { color: '#818cf8', fontSize: 13, fontStyle: 'italic' },

    quickActionsSection: { marginTop: 8 },
    quickActionsLabel: {
        fontSize: 11, fontWeight: '600', color: Colors.slate500,
        letterSpacing: 1, marginBottom: 8
    },
    quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    quickActionBtn: {
        borderWidth: 1, borderColor: Colors.borderDark, backgroundColor: 'rgba(30,41,59,0.5)',
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8
    },
    quickActionText: { fontSize: 13, color: Colors.textPrimaryDark, fontWeight: '500' },

    inputArea: {
        backgroundColor: '#141925', paddingHorizontal: 16, paddingVertical: 12,
        borderTopWidth: 1, borderTopColor: Colors.borderDark
    },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    input: {
        flex: 1, backgroundColor: '#1e293b', borderRadius: 24,
        paddingHorizontal: 16, paddingVertical: 10, color: Colors.white,
        fontSize: 14, maxHeight: 100, borderWidth: 1, borderColor: Colors.borderDark
    },
    sendBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center'
    },
    sendBtnDisabled: { backgroundColor: Colors.slate700 }
});

export default OptiBotChat;
