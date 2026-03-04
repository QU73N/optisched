import React from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { Colors } from '../constants/colors';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import TeacherTabs from './TeacherTabs';
import StudentTabs from './StudentTabs';

// Shared stack screens
import OptiBotChat from '../screens/shared/OptiBotChat';
import ScheduleView from '../screens/shared/ScheduleView';
import AppSettings from '../screens/shared/AppSettings';

export type RootStackParamList = {
    Login: undefined;
    AdminWebOnly: undefined;
    TeacherTabs: undefined;
    StudentTabs: undefined;
    OptiBot: undefined;
    ScheduleView: undefined;
    AppSettings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const OptiSchedDarkTheme = {
    ...DarkTheme,
    colors: {
        ...DarkTheme.colors,
        background: Colors.backgroundDark,
        card: Colors.surfaceDark,
        text: Colors.textPrimaryDark,
        border: Colors.borderDark,
        primary: Colors.primary,
    },
};

// Screen shown to admin users
const AdminWebOnlyScreen = () => (
    <View style={styles.adminWebOnly}>
        <Text style={styles.adminWebOnlyIcon}>🌐</Text>
        <Text style={styles.adminWebOnlyTitle}>Web App Only</Text>
        <Text style={styles.adminWebOnlyText}>
            Admin features are only available on the web app.{'\n\n'}
            Please visit the OptiSched website to manage schedules, users, and settings.
        </Text>
    </View>
);

const AppNavigator: React.FC = () => {
    const { isAuthenticated, isLoading, role } = useAuth();

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <NavigationContainer theme={OptiSchedDarkTheme}>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    animation: 'slide_from_right',
                }}
            >
                {!isAuthenticated ? (
                    <Stack.Screen name="Login" component={LoginScreen} />
                ) : (
                    <>
                        {role === 'admin' && (
                            <Stack.Screen name="AdminWebOnly" component={AdminWebOnlyScreen} />
                        )}
                        {role === 'teacher' && (
                            <Stack.Screen name="TeacherTabs" component={TeacherTabs} />
                        )}
                        {role === 'student' && (
                            <Stack.Screen name="StudentTabs" component={StudentTabs} />
                        )}
                        {!role && (
                            <Stack.Screen name="StudentTabs" component={StudentTabs} />
                        )}
                        {/* Shared screens accessible from any role */}
                        <Stack.Screen name="OptiBot" component={OptiBotChat} />
                        <Stack.Screen name="ScheduleView" component={ScheduleView} />
                        <Stack.Screen name="AppSettings" component={AppSettings} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.backgroundDark,
    },
    adminWebOnly: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.backgroundDark,
        padding: 32,
    },
    adminWebOnlyIcon: {
        fontSize: 56,
        marginBottom: 16,
    },
    adminWebOnlyTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: Colors.textPrimaryDark,
        marginBottom: 12,
    },
    adminWebOnlyText: {
        fontSize: 15,
        color: Colors.textSecondaryDark,
        textAlign: 'center',
        lineHeight: 22,
    },
});

export default AppNavigator;
