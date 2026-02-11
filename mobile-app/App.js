import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, AppState } from 'react-native';
import { api } from './src/api';
import { rssService } from './src/rss';
import { setSharedToken } from './src/sharedStorage';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import AddLinkScreen from './src/screens/AddLinkScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import RecommendedReadingScreen from './src/screens/RecommendedReadingScreen';
import { COLORS } from './src/constants';

const Stack = createNativeStackNavigator();

export default function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuth();

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

    const checkAuth = async () => {
        try {
            const token = await SecureStore.getItemAsync('authToken');
            if (token) {
                setSharedToken(token);
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
