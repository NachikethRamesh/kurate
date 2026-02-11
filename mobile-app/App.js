import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { api } from './src/api';
import { rssService } from './src/rss';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import AddLinkScreen from './src/screens/AddLinkScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import RecommendedReadingScreen from './src/screens/RecommendedReadingScreen';
import { COLORS } from './src/constants';

const Stack = createNativeStackNavigator();

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuth();
        registerForPushNotificationsAsync();
        scheduleDailyReminder();

        // Check auth and refresh RSS whenever app comes to foreground
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active') {
                checkAuth();
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    const registerForPushNotificationsAsync = async () => {
        if (!Device.isDevice) return;

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return;
        }

        if (Platform.OS === 'android') {
            Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }
    };

    const scheduleDailyReminder = async () => {
        // Cancel first to avoid duplicates
        await Notifications.cancelAllScheduledNotificationsAsync();

        await Notifications.scheduleNotificationAsync({
            content: {
                title: "kurate",
                body: "Here's your top pick of the day. Read more on kurate",
            },
            trigger: {
                hour: 9,
                minute: 5,
                repeats: true,
            },
        });
    };

    const checkAuth = async () => {
        try {
            const token = await SecureStore.getItemAsync('authToken');
            if (token) {
                // Optimistically show App while validating in background
                setIsAuthenticated(true);

                // Run validation and prefetch in parallel
                Promise.all([
                    api.getLinks(), // Validate session
                    rssService.fetchArticles() // Pre-load articles for low latency
                ]).then(async ([linksResult]) => {
                    if (!linksResult.success && linksResult.error && linksResult.error.includes('401')) {
                        // If specifically unauthorized, log out
                        console.log('Session expired, logging out');
                        await api.logout();
                        setIsAuthenticated(false);
                    }
                });
            } else {
                setIsAuthenticated(false);
            }
        } catch (e) {
            console.log('Auth check error:', e);
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg }}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <>
            <StatusBar style="dark" />
            <NavigationContainer>
                <Stack.Navigator
                    screenOptions={{
                        headerShown: false,
                        animation: 'fade_from_bottom',
                    }}
                >
                    {!isAuthenticated ? (
                        <>
                            <Stack.Screen name="Login">
                                {props => <LoginScreen {...props} setIsAuthenticated={setIsAuthenticated} />}
                            </Stack.Screen>
                            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
                        </>
                    ) : (
                        <>
                            <Stack.Screen name="Home">
                                {props => <HomeScreen {...props} setIsAuthenticated={setIsAuthenticated} />}
                            </Stack.Screen>
                            <Stack.Screen name="AddLink" component={AddLinkScreen} />
                            <Stack.Screen name="RecommendedReading" component={RecommendedReadingScreen} />
                        </>
                    )}
                </Stack.Navigator>
            </NavigationContainer>
        </>
    );
}
