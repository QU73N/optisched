import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { useTheme } from '../../contexts/ThemeContext';
import TeacherAdminChat from './TeacherAdminChat';
import TeacherToTeacherChat from './TeacherToTeacherChat';

const TeacherChatHub: React.FC = () => {
    const [tab, setTab] = useState<'admin' | 'teachers'>('admin');
    const { colors } = useTheme();

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Tab Switcher */}
            <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
                <View style={[styles.tabRow, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
                    <Pressable
                        style={[styles.tabBtn, { backgroundColor: colors.elevated }, tab === 'admin' && [styles.tabActive, { backgroundColor: colors.accentPrimary }]]}
                        onPress={() => setTab('admin')}
                    >
                        <Text style={[styles.tabText, { color: colors.textMuted }, tab === 'admin' && styles.tabTextActive]}>Admin Chat</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.tabBtn, { backgroundColor: colors.elevated }, tab === 'teachers' && [styles.tabActive, { backgroundColor: colors.accentPrimary }]]}
                        onPress={() => setTab('teachers')}
                    >
                        <Text style={[styles.tabText, { color: colors.textMuted }, tab === 'teachers' && styles.tabTextActive]}>Teachers</Text>
                    </Pressable>
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
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabActive: {
        // backgroundColor overridden inline with accentPrimary
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
    },
    tabTextActive: {
        color: Colors.white,
    },
});

export default TeacherChatHub;
