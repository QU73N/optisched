import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
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
                    height: 80,
                    paddingBottom: 16,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: colors.isDark ? '#9da6b9' : Colors.slate400,
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '500',
                },
            }}
        >
            <Tab.Screen
                name="Home"
                component={StudentDashboard}
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
                        <MaterialIcons name="calendar-today" size={size} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="OptiBot"
                component={OptiBotChat}
                options={{
                    tabBarIcon: ({ color, size }) => (
                        <MaterialIcons name="smart-toy" size={size} color={color} />
                    ),
                    tabBarLabel: 'AI Chat',
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

export default StudentTabs;
