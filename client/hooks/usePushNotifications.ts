import { useState, useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Define types for safety
export interface PushNotificationState {
    expoPushToken?: string;
    notification?: any;
    lastResponse?: any;
}

export const usePushNotifications = (): PushNotificationState => {
    const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
    const [notification, setNotification] = useState<any | undefined>();
    const [lastResponse, setLastResponse] = useState<any | undefined>();

    const notificationListener = useRef<any>(null);
    const responseListener = useRef<any>(null);

    // Safely load modules
    let Notifications: any;
    let Device: any;
    try {
        Notifications = require('expo-notifications');
        Device = require('expo-device');
    } catch (e) {
        console.warn('Expo Notifications or Device module not found. Push notifications will not work.');
    }

    // Set handler immediately if module exists
    useEffect(() => {
        if (Notifications) {
            try {
                Notifications.setNotificationHandler({
                    handleNotification: async () => ({
                        shouldShowAlert: true,
                        shouldPlaySound: true,
                        shouldSetBadge: true,
                        shouldShowBanner: true,
                        shouldShowList: true,
                        priority: Notifications.AndroidNotificationPriority.MAX,
                    }),
                });
            } catch (e) {
                console.warn("Failed to set notification handler", e);
            }
        }
    }, []);

    async function registerForPushNotificationsAsync() {
        if (!Notifications || !Device) return;

        let token;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('klassin-alerts-v2', {
                name: 'Klassin Alerts',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#4F46E5',
                lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
                bypassDnd: true,
                sound: 'default',
                enableVibrate: true,
                showBadge: true,
            });
        }

        let isDevice = false;
        try {
            isDevice = Device.isDevice;
        } catch (e) {
            // ignore
        }

        if (isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                // alert('Failed to get push token for push notification!');
                return;
            }
            try {
                // Constants.expoConfig.extra.eas.projectId is the standard location for managed workflow
                // Constants.easConfig.projectId is for bare workflow or sometimes managed
                const projectId =
                    Constants?.expoConfig?.extra?.eas?.projectId ?? 
                    Constants?.easConfig?.projectId ?? 
                    "7cc11cd9-774d-4dda-988a-aba00c125c58";
                
                token = (await Notifications.getExpoPushTokenAsync({ 
                    projectId 
                })).data;
            } catch (e: any) {
                // Suppress 500 errors from Expo, which often happen in dev/simulator if not logged in
                if (!e?.message?.includes('500')) {
                    console.warn("Failed to get push token:", e);
                }
                token = undefined;
            }
        }

        return token;
    }

    useEffect(() => {
        if (!Notifications) return;

        registerForPushNotificationsAsync().then(token => setExpoPushToken(token));

        notificationListener.current = Notifications.addNotificationReceivedListener((notification: any) => {
            setNotification(notification);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener((response: any) => {
            setLastResponse(response);
        });

        return () => {
            if (notificationListener.current && Notifications) {
                try {
                    // Check if remove exists (older versions) or use .remove()
                    if (notificationListener.current.remove) {
                        notificationListener.current.remove();
                    } else {
                        Notifications.removeNotificationSubscription(notificationListener.current);
                    }
                } catch (e) { }
            }
            if (responseListener.current && Notifications) {
                try {
                    if (responseListener.current.remove) {
                        responseListener.current.remove();
                    } else {
                        Notifications.removeNotificationSubscription(responseListener.current);
                    }
                } catch (e) { }
            }
        };
    }, []);

    return {
        expoPushToken,
        notification,
        lastResponse,
    };
};
