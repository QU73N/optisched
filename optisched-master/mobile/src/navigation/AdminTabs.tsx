import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';

import AdminDashboard from '../screens/admin/AdminDashboard';
import AIScheduleChat from '../screens/admin/AIScheduleChat';
import FacultyHub from '../screens/admin/FacultyHub';
import AdminChatInbox from '../screens/admin/AdminChatInbox';
import AppSettings from '../screens/shared/AppSettings';

export type AdminTabParamList = {
    Dashboard: undefined;
    AI: undefined;
    Faculty: undefined;
    Messages: undefined;
    Profile: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();

const AdminTabs: React.FC = () => {
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
                name="Dashboard"
                component={AdminDashboard}
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <MaterialIcons name="dashboard" size={size} color={color} />
                    ),
                    tabBarLabel: 'Home',
                }}
            />
            <Tab.Screen
                name="AI"
                component={AIScheduleChat}
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <MaterialIcons name="smart-toy" size={size} color={color} />
                    ),
                    tabBarLabel: 'AI Schedule',
                }}
            />
            <Tab.Screen
                name="Faculty"
                component={FacultyHub}
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <MaterialIcons name="group" size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Messages"
                component={AdminChatInbox}
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <MaterialIcons name="chat" size={size} color={color} />
                    ),
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

export default AdminTabs;
