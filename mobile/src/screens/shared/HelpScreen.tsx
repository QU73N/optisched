import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

interface HelpSection {
    id: string;
    title: string;
    icon: keyof typeof MaterialIcons.glyphMap;
    iconColor: string;
    items: { q: string; a: string }[];
}

const SECTIONS: HelpSection[] = [
    {
        id: 'getting-started',
        title: 'Getting Started',
        icon: 'rocket-launch',
        iconColor: '#4988C4',
        items: [
            {
                q: 'What is OptiSched?',
                a: 'OptiSched is a comprehensive academic scheduling system for STI College Meycauayan. It manages class schedules, teacher assignments, room allocations, and student enrollments using intelligent automation.',
            },
            {
                q: 'How do I log in?',
                a: 'Use your institutional email (e.g. surname.123456@meycauayan.sti.edu.ph) and the password provided by your administrator.',
            },
            {
                q: 'How do I navigate the app?',
                a: 'Use the bottom tab bar to switch between Home, Schedule, AI Chat, Help, and Profile. Each tab has a unique color to help you identify it quickly.',
            },
        ],
    },
    {
        id: 'schedule',
        title: 'Viewing Your Schedule',
        icon: 'calendar-today',
        iconColor: '#10b981',
        items: [
            {
                q: 'Where can I see my schedule?',
                a: 'Tap the "Schedule" tab to view your weekly class schedule. You can see room assignments, time slots, and teacher/subject details.',
            },
            {
                q: 'Can I change my schedule?',
                a: 'Students cannot edit schedules directly. Teachers can submit change requests through their dashboard. Contact your administrator for any scheduling concerns.',
            },
            {
                q: 'What do the colors mean?',
                a: 'Each subject is assigned a unique color to make it easy to distinguish between classes in the calendar view.',
            },
        ],
    },
    {
        id: 'optibot',
        title: 'OptiBot AI Assistant',
        icon: 'smart-toy',
        iconColor: '#f59e0b',
        items: [
            {
                q: 'What is OptiBot?',
                a: 'OptiBot is your AI-powered scheduling assistant. It can answer questions about your schedule, provide academic information, and help with common queries.',
            },
            {
                q: 'What can I ask OptiBot?',
                a: 'You can ask about your next class, today\'s schedule, room locations, teacher information, and general academic questions.',
            },
            {
                q: 'Is OptiBot available offline?',
                a: 'OptiBot requires an internet connection to function. Make sure you have a stable connection when using it.',
            },
        ],
    },
    {
        id: 'account',
        title: 'Account & Settings',
        icon: 'settings',
        iconColor: '#8b5cf6',
        items: [
            {
                q: 'How do I change my password?',
                a: 'Go to Profile > Request Password Reset. Your request will be sent to the administrator, who will set a new password for you.',
            },
            {
                q: 'How do I switch between dark and light mode?',
                a: 'Go to Profile > Appearance to toggle between light and dark themes.',
            },
            {
                q: 'Who do I contact for help?',
                a: 'For technical issues, contact the administrator through the app or visit the Office of the Registrar at STI College Meycauayan.',
            },
        ],
    },
    {
        id: 'troubleshooting',
        title: 'Troubleshooting',
        icon: 'build',
        iconColor: '#ef4444',
        items: [
            {
                q: 'My schedule is not showing',
                a: 'Make sure you have an active internet connection. Pull down to refresh. If the issue persists, your section may not have an approved schedule yet — contact your administrator.',
            },
            {
                q: 'I can\'t log in',
                a: 'Double-check your email and password. If you forgot your password, use the "Forgot Password" option on the login screen to request a reset from the admin.',
            },
            {
                q: 'The app is running slowly',
                a: 'Try closing and reopening the app. Make sure your device has a stable internet connection. Clear the app cache if needed.',
            },
        ],
    },
];

const HelpScreen: React.FC = () => {
    const { colors } = useTheme();
    const { role } = useAuth();
    const [expandedSection, setExpandedSection] = useState<string | null>('getting-started');
    const [expandedItem, setExpandedItem] = useState<string | null>(null);

    const toggleSection = (id: string) => {
        setExpandedSection(expandedSection === id ? null : id);
        setExpandedItem(null);
    };

    const toggleItem = (key: string) => {
        setExpandedItem(expandedItem === key ? null : key);
    };

    const isDark = colors.isDark;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <View style={styles.headerIcon}>
                    <MaterialIcons name="help-outline" size={24} color="#06b6d4" />
                </View>
                <View>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Help Center</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                        {role === 'teacher' ? 'Teacher Guide' : 'Student Guide'}
                    </Text>
                </View>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Quick info card */}
                <View style={[styles.infoCard, {
                    backgroundColor: isDark ? 'rgba(73,136,196,0.08)' : 'rgba(28,77,141,0.04)',
                    borderColor: isDark ? 'rgba(73,136,196,0.15)' : 'rgba(28,77,141,0.1)',
                }]}>
                    <MaterialIcons name="info-outline" size={18} color="#4988C4" />
                    <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                        Tap any section below to expand it. Tap a question to see the answer.
                    </Text>
                </View>

                {/* Sections */}
                {SECTIONS.map((section) => (
                    <View key={section.id} style={[styles.section, {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                    }]}>
                        {/* Section header */}
                        <TouchableOpacity
                            style={styles.sectionHeader}
                            onPress={() => toggleSection(section.id)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.sectionIcon, { backgroundColor: section.iconColor + '15' }]}>
                                <MaterialIcons name={section.icon} size={20} color={section.iconColor} />
                            </View>
                            <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
                            <MaterialIcons
                                name={expandedSection === section.id ? 'expand-less' : 'expand-more'}
                                size={22}
                                color={colors.textMuted}
                            />
                        </TouchableOpacity>

                        {/* Section items */}
                        {expandedSection === section.id && (
                            <View style={[styles.sectionBody, { borderTopColor: colors.border }]}>
                                {section.items.map((item, idx) => {
                                    const key = `${section.id}-${idx}`;
                                    const isOpen = expandedItem === key;
                                    return (
                                        <View key={key}>
                                            <TouchableOpacity
                                                style={[styles.questionRow, idx > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
                                                onPress={() => toggleItem(key)}
                                                activeOpacity={0.7}
                                            >
                                                <MaterialIcons
                                                    name={isOpen ? 'remove-circle-outline' : 'add-circle-outline'}
                                                    size={18}
                                                    color={section.iconColor}
                                                />
                                                <Text style={[styles.question, { color: colors.text }]}>{item.q}</Text>
                                            </TouchableOpacity>
                                            {isOpen && (
                                                <View style={[styles.answerBox, {
                                                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                                                }]}>
                                                    <Text style={[styles.answer, { color: colors.textSecondary }]}>{item.a}</Text>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                ))}

                {/* Contact card */}
                <View style={[styles.contactCard, {
                    backgroundColor: isDark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.04)',
                    borderColor: isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)',
                }]}>
                    <MaterialIcons name="support-agent" size={28} color="#8b5cf6" />
                    <Text style={[styles.contactTitle, { color: colors.text }]}>Still need help?</Text>
                    <Text style={[styles.contactText, { color: colors.textSecondary }]}>
                        Contact the Office of the Registrar at STI College Meycauayan or message an administrator through the app.
                    </Text>
                </View>

                {/* Bottom spacing for tab bar */}
                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 20,
        paddingVertical: 18,
        borderBottomWidth: 1,
    },
    headerIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: 'rgba(6,182,212,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.3,
    },
    headerSubtitle: {
        fontSize: 13,
        marginTop: 2,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        gap: 12,
    },
    infoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
    },
    section: {
        borderRadius: 14,
        borderWidth: 1,
        overflow: 'hidden',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
    },
    sectionIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
    },
    sectionBody: {
        borderTopWidth: 1,
    },
    questionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    question: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
    },
    answerBox: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        paddingLeft: 44,
    },
    answer: {
        fontSize: 13,
        lineHeight: 20,
    },
    contactCard: {
        alignItems: 'center',
        padding: 24,
        borderRadius: 14,
        borderWidth: 1,
        gap: 8,
        marginTop: 4,
    },
    contactTitle: {
        fontSize: 16,
        fontWeight: '700',
    },
    contactText: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 20,
    },
});

export default HelpScreen;
