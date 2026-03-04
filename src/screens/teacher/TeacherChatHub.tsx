import React, { useState } from 'react';
import { View,  Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { useTheme } from '../../contexts/ThemeContext';
import TeacherAdminChat from './TeacherAdminChat';
import TeacherToTeacherChat from './TeacherToTeacherChat';
import { AnimatedPressable } from '../../components/AnimatedPressable';

const TeacherChatHub: React.FC = () => {
    const [tab, setTab] = useState<'admin' | 'teachers'>('admin');
    const { colors } = useTheme();

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Tab Switcher */}
            <SafeAreaView edges={['top']} style={{ backgroundColor: '#0f172a' }}>
                <View style={styles.tabRow}>
                    <AnimatedPressable
                        style={[styles.tabBtn, tab === 'admin' && styles.tabActive]}
                        onPress={() => setTab('admin')}
                    >
                        <Text style={[styles.tabText, tab === 'admin' && styles.tabTextActive]}>Admin Chat</Text>
                    </AnimatedPressable>
                    <AnimatedPressable
                        style={[styles.tabBtn, tab === 'teachers' && styles.tabActive]}
                        onPress={() => setTab('teachers')}
                    >
                        <Text style={[styles.tabText, tab === 'teachers' && styles.tabTextActive]}>Teachers</Text>
                    </AnimatedPressable>
                </View>
            </SafeAreaView>

            {/* Content */}
            {tab === 'admin' ? <TeacherAdminChat /> : <TeacherToTeacherChat />}
        </View>
    );
};

const styles = StyleSheet.create({
    tabRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b',
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#1e293b',
    },
    tabActive: {
        backgroundColor: '#6366f1',
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.slate400,
    },
    tabTextActive: {
        color: Colors.white,
    },
});

export default TeacherChatHub;
