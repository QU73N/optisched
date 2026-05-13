import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

import TeacherDashboard from '../screens/teacher/TeacherDashboard';
import TeacherChatHub from '../screens/teacher/TeacherChatHub';
import TeacherSchedule from '../screens/teacher/TeacherSchedule';
import OptiBotChat from '../screens/shared/OptiBotChat';
import AppSettings from '../screens/shared/AppSettings';

export type TeacherTabParamList = {
    Home: undefined;
    Schedule: undefined;
    AI: undefined;
    Messages: undefined;
    Profile: undefined;
};

const Tab = createBottomTabNavigator<TeacherTabParamList>();

const TAB_COLORS: Record<string, string> = {
    Home: '#4988C4',
    Schedule: '#10b981',
    AI: '#f59e0b',
    Messages: '#06b6d4',
    Profile: '#8b5cf6',
};

const TeacherTabs: React.FC = () => {
    const { colors } = useTheme();
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.border,
                    borderTopWidth: 1,
                    height: Platform.OS === 'web' ? 64 : 72,
                    paddingBottom: Platform.OS === 'web' ? 8 : 12,
                    paddingTop: 8,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 16,
                    elevation: 8,
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                },
                tabBarActiveTintColor: TAB_COLORS[route.name] || colors.accentPrimary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarLabelStyle: {
                    fontSize: Platform.OS === 'web' ? 12 : 11,
                    fontWeight: '600',
                    fontFamily: Platform.OS === 'web' ? 'Lexend' : undefined,
                },
                tabBarIconStyle: {
                    marginBottom: 2,
                },
            })}
        >
            <Tab.Screen
                name="Home"
                component={TeacherDashboard}
                options={{
                    tabBarIcon: ({ color, size, focused }) => (
                        <MaterialIcons name="home" size={focused ? size + 2 : size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Schedule"
                component={TeacherSchedule}
                options={{
                    tabBarIcon: ({ color, size, focused }) => (
                        <MaterialIcons name="calendar-month" size={focused ? size + 2 : size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="AI"
                component={OptiBotChat}
                options={{
                    tabBarIcon: ({ color, size, focused }) => (
                        <MaterialIcons name="smart-toy" size={focused ? size + 2 : size} color={color} />
                    ),
                    tabBarLabel: 'OptiBot',
                }}
            />
            <Tab.Screen
                name="Messages"
                component={TeacherChatHub}
                options={{
                    tabBarIcon: ({ color, size, focused }) => (
                        <MaterialIcons name="chat" size={focused ? size + 2 : size} color={color} />
                    ),
                    tabBarLabel: 'Messages',
                }}
            />
            <Tab.Screen
                name="Profile"
                component={AppSettings}
                options={{
                    tabBarIcon: ({ color, size, focused }) => (
                        <MaterialIcons name="person" size={focused ? size + 2 : size} color={color} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
};

export default TeacherTabs;
