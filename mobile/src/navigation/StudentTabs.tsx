import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { Colors } from '../constants/colors';
import { useTheme } from '../contexts/ThemeContext';

import StudentDashboard from '../screens/student/StudentDashboard';
import ScheduleView from '../screens/shared/ScheduleView';
import OptiBotChat from '../screens/shared/OptiBotChat';
import AppSettings from '../screens/shared/AppSettings';

export type StudentTabParamList = {
    Home: undefined;
    Schedule: undefined;
    OptiBot: undefined;
    Profile: undefined;
};

const Tab = createBottomTabNavigator<StudentTabParamList>();

const StudentTabs: React.FC = () => {
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
                component={StudentDashboard}
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
                component={ScheduleView}
                options={{
                    tabBarIcon: ({ color, size, focused }) => (
                        <MaterialIcons 
                            name="calendar-today" 
                            size={focused ? size + 2 : size} 
                            color={color} 
                        />
                    ),
                }}
            />
            <Tab.Screen
                name="OptiBot"
                component={OptiBotChat}
                options={{
                    tabBarIcon: ({ color, size, focused }) => (
                        <MaterialIcons 
                            name="smart-toy" 
                            size={focused ? size + 2 : size} 
                            color={color} 
                        />
                    ),
                    tabBarLabel: 'AI Chat',
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

export default StudentTabs;
