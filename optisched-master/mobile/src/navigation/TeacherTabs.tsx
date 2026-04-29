import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';

import TeacherDashboard from '../screens/teacher/TeacherDashboard';
import TeacherChatHub from '../screens/teacher/TeacherChatHub';
import ScheduleView from '../screens/shared/ScheduleView';
import AppSettings from '../screens/shared/AppSettings';
import OptiBotChat from '../screens/shared/OptiBotChat';

export type TeacherTabParamList = {
    Home: undefined;
    Schedule: undefined;
    AI: undefined;
    Messages: undefined;
    Profile: undefined;
};

const Tab = createBottomTabNavigator<TeacherTabParamList>();

const TeacherTabs: React.FC = () => {
    const { colors } = useTheme();
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.border,
                    borderTopWidth: 1,
                    height: 80,
                    paddingBottom: 16,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: colors.isDark ? Colors.slate500 : Colors.slate400,
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '500',
                },
            }}
        >
            <Tab.Screen
                name="Home"
                component={TeacherDashboard}
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <MaterialIcons name="home" size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Schedule"
                component={ScheduleView}
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <MaterialIcons name="calendar-month" size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="AI"
                component={OptiBotChat}
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <MaterialIcons name="smart-toy" size={size} color={color} />
                    ),
                    tabBarLabel: 'OptiBot',
                }}
            />
            <Tab.Screen
                name="Messages"
                component={TeacherChatHub}
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <MaterialIcons name="chat" size={size} color={color} />
                    ),
                    tabBarLabel: 'Messages',
                }}
            />
            <Tab.Screen
                name="Profile"
                component={AppSettings}
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <MaterialIcons name="person" size={size} color={color} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
};

export default TeacherTabs;
