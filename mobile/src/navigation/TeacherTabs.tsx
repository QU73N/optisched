import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';

import TeacherDashboard from '../screens/teacher/TeacherDashboard';
import TeacherChatHub from '../screens/teacher/TeacherChatHub';
import TeacherSchedule from '../screens/teacher/TeacherSchedule';
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
                    height: Platform.OS === 'web' ? 70 : 80,
                    paddingBottom: Platform.OS === 'web' ? 8 : 16,
                    paddingTop: 12,
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
                tabBarActiveTintColor: colors.accentPrimary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarLabelStyle: {
                    fontSize: Platform.OS === 'web' ? 12 : 11,
                    fontWeight: '600',
                    fontFamily: Platform.OS === 'web' ? 'Lexend' : undefined,
                },
                tabBarIconStyle: {
                    marginBottom: 4,
                },
            }}
        >
            <Tab.Screen
                name="Home"
                component={TeacherDashboard}
                options={{
                    tabBarIcon: ({ color, size, focused }) => (
                        <MaterialIcons 
                            name="home" 
                            size={focused ? size + 2 : size} 
                            color={color} 
                        />
                    ),
                }}
            />
            <Tab.Screen
                name="Schedule"
                component={TeacherSchedule}
                options={{
                    tabBarIcon: ({ color, size, focused }) => (
                        <MaterialIcons 
                            name="calendar-month" 
                            size={focused ? size + 2 : size} 
                            color={color} 
                        />
                    ),
                }}
            />
            <Tab.Screen
                name="AI"
                component={OptiBotChat}
                options={{
                    tabBarIcon: ({ color, size, focused }) => (
                        <MaterialIcons 
                            name="smart-toy" 
                            size={focused ? size + 2 : size} 
                            color={color} 
                        />
                    ),
                    tabBarLabel: 'OptiBot',
                }}
            />
            <Tab.Screen
                name="Messages"
                component={TeacherChatHub}
                options={{
                    tabBarIcon: ({ color, size, focused }) => (
                        <MaterialIcons 
                            name="chat" 
                            size={focused ? size + 2 : size} 
                            color={color} 
                        />
                    ),
                    tabBarLabel: 'Messages',
                }}
            />
            <Tab.Screen
                name="Profile"
                component={AppSettings}
                options={{
                    tabBarIcon: ({ color, size, focused }) => (
                        <MaterialIcons 
                            name="person" 
                            size={focused ? size + 2 : size} 
                            color={color} 
                        />
                    ),
                }}
            />
        </Tab.Navigator>
    );
};

export default TeacherTabs;
