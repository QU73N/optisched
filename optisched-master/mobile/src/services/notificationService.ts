import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// Lazily load expo-notifications only if NOT in Expo Go.
// Expo Go SDK 53 completely removed the native remote push module,
// so a static top-level import crashes the JS bundle instantly.
let NotificationsModule: any = null;

const getNotifications = () => {
    if (NotificationsModule) return NotificationsModule;

    const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    if (isExpoGo) {
        return null;
    }

    try {
        NotificationsModule = require('expo-notifications');
        // Configure how notifications behave when the app is in the foreground
        NotificationsModule.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
                shouldShowBanner: true,
                shouldShowList: true,
            }),
        });
        return NotificationsModule;
    } catch (e) {
        console.warn('[Notifications] Failed to require expo-notifications', e);
        return null;
    }
}

export class NotificationService {
    static async requestPermissionsAsync() {
        if (!Device.isDevice) {
            console.log('[Notifications] Must use physical device for Push Notifications');
            return false;
        }

        const Notifications = getNotifications();
        if (!Notifications) {
            console.log('[Notifications] Running in Expo Go. Push notifications will be mocked/disabled to prevent crashes.');
            return false;
        }

        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('[Notifications] Failed to get push token for push notification!');
                return false;
            }

            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('default', {
                    name: 'default',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#135bec',
                });
            }

            return true;
        } catch (error) {
            console.log('[Notifications] Error requesting permissions:', error);
            return false;
        }
    }

    /**
     * Triggers an immediate local push notification
     */
    static async notify(title: string, body: string, data?: any) {
        const Notifications = getNotifications();
        if (!Notifications) {
            console.log('[Notifications] Mock notify in Expo Go/Simulator:', title, body);
            return;
        }

        // Only trigger if we have permission
        try {
            const { status } = await Notifications.getPermissionsAsync();
            if (status !== 'granted') return;

            await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data,
                    sound: true,
                },
                trigger: null, // null means fire immediately
            });
        } catch (error) {
            console.log('[Notifications] Silently failing push notification:', error);
        }
    }
}
