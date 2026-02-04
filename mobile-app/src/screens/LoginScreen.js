import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { COLORS } from '../constants';
import { api } from '../api';

export default function LoginScreen({ navigation, setIsAuthenticated }) {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAuth = async () => {
        if (!username || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        let result;

        if (isLogin) {
            result = await api.login(username, password);
        } else {
            result = await api.register(username, password);
        }

        setLoading(false);

        if (result.success) {
            setIsAuthenticated(true);
        } else {
            Alert.alert('Error', result.error || 'Authentication failed');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardView}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                    <View style={styles.content}>
                        <View style={styles.logoContainer}>
                            <View style={styles.logoIcon}>
                                <Text style={styles.logoIconText}>K</Text>
                            </View>
                            <Text style={styles.logoText}>kurate</Text>
                        </View>

                        <Text style={styles.title}>
                            Your personal library of ideas from across the web.{' '}

                        </Text>
                        <Text style={styles.title}><Text style={{ color: COLORS.primary }}>You are the curator.</Text></Text>

                        <View style={styles.marketingSection}>
                            <Text style={styles.marketingText}>
                                <Text style={{ fontWeight: '700', fontStyle: 'italic' }}>kurate</Text> is your personal library for collecting and organizing the best content from across the web.
                            </Text>
                            <Text style={styles.marketingText}>
                                Save articles, videos, and podcasts in one beautiful, simplified space.
                            </Text>
                        </View>

                        <View style={styles.form}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Username</Text>
                                <TextInput
                                    style={styles.input}
                                    value={username}
                                    onChangeText={setUsername}
                                    placeholder="Enter your username"
                                    placeholderTextColor={COLORS.textTertiary}
                                    autoCapitalize="none"
                                    autoComplete="off"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Password</Text>
                                <TextInput
                                    style={styles.input}
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="Enter your password"
                                    placeholderTextColor={COLORS.textTertiary}
                                    secureTextEntry
                                    autoComplete="off"
                                />
                            </View>

                            <TouchableOpacity
                                style={styles.button}
                                onPress={handleAuth}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.buttonText}>{isLogin ? 'Start Curating' : 'Join kurate'}</Text>
                                )}
                            </TouchableOpacity>

                            <View style={styles.footerLinks}>
                                <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.toggleContainer} activeOpacity={0.7}>
                                    <Text style={styles.toggleText}>
                                        {isLogin ? "Don't have an account? " : "Already have an account? "}
                                        <Text style={styles.toggleLink}>{isLogin ? 'Join kurate' : 'Sign In'}</Text>
                                    </Text>
                                </TouchableOpacity>

                                {isLogin && (
                                    <TouchableOpacity
                                        onPress={() => navigation.navigate('ResetPassword')}
                                        style={styles.forgotBtn}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.forgotText}>Forgot your password?</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContainer: {
        flexGrow: 1,
    },
    content: {
        flex: 1,
        padding: 32,
        paddingTop: 60,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 32,
    },
    logoIcon: {
        width: 24,
        height: 24,
        backgroundColor: '#000',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoIconText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    logoText: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary,
        letterSpacing: -0.5,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: COLORS.textPrimary,
        lineHeight: 32,
        marginBottom: 20,
    },
    marketingSection: {
        marginBottom: 32,
        gap: 16,
    },
    marketingText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        lineHeight: 20,
    },
    form: {
        width: '100%',
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.textPrimary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    button: {
        backgroundColor: COLORS.primary,
        padding: 18,
        borderRadius: 100,
        alignItems: 'center',
        marginTop: 10,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '700',
    },
    footerLinks: {
        marginTop: 24,
        alignItems: 'center',
        gap: 16,
    },
    toggleContainer: {
        alignItems: 'center',
    },
    toggleText: {
        color: COLORS.textSecondary,
        fontSize: 14,
    },
    toggleLink: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    forgotBtn: {
        paddingVertical: 4,
    },
    forgotText: {
        fontSize: 13,
        color: COLORS.textTertiary,
        fontWeight: '500',
    }
});
