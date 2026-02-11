import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants';
import { api } from '../api';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

export default function ProfileScreen({ navigation, setIsAuthenticated }) {
    const [username, setUsername] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        const loadUsername = async () => {
            const stored = await SecureStore.getItemAsync('username');
            if (stored) setUsername(stored);
        };
        loadUsername();
    }, []);

    const handleUpdateUsername = async () => {
        const trimmed = username.trim();
        if (!trimmed || trimmed.length < 3) {
            Alert.alert('Error', 'Username must be at least 3 characters.');
            return;
        }

        setSaving(true);
        const result = await api.updateUsername(trimmed);
        setSaving(false);

        if (result.success) {
            setUsername(result.user.username);
            Alert.alert('Success', 'Username updated!');
        } else {
            Alert.alert('Error', result.error || 'Failed to update username.');
        }
    };

    const handleResetPassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all password fields.');
            return;
        }
        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'New passwords do not match.');
            return;
        }
        if (newPassword.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters.');
            return;
        }

        setResetting(true);
        const result = await api.resetPassword(username, currentPassword, newPassword);
        setResetting(false);

        if (result.success) {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            Alert.alert('Success', 'Password updated!');
        } else {
            Alert.alert('Error', result.error || 'Failed to reset password.');
        }
    };

    const handleDeleteAccount = () => {
        if (!showDeleteConfirm) {
            setShowDeleteConfirm(true);
            return;
        }
        if (!deletePassword) {
            Alert.alert('Error', 'Please enter your password to confirm deletion.');
            return;
        }
        Alert.alert(
            'Delete Account',
            'This will permanently delete all your data. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Forever',
                    style: 'destructive',
                    onPress: async () => {
                        setDeleting(true);
                        const result = await api.deleteAccount(deletePassword);
                        setDeleting(false);
                        if (result.success) {
                            setIsAuthenticated(false);
                        } else {
                            Alert.alert('Error', result.error || 'Failed to delete account.');
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile Settings</Text>
                <View style={{ width: 24 }} />
            </View>

            <KeyboardAvoidingView
                behavior="padding"
                style={{ flex: 1 }}
            >
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Username Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Username</Text>
                        <TextInput
                            style={styles.input}
                            value={username}
                            onChangeText={setUsername}
                            placeholder="New username"
                            placeholderTextColor={COLORS.textTertiary}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <View style={styles.btnRow}>
                            <TouchableOpacity
                                style={[styles.actionBtn, saving && styles.actionBtnDisabled]}
                                onPress={handleUpdateUsername}
                                disabled={saving}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.actionBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Reset Password Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Reset Password</Text>
                        <TextInput
                            style={styles.input}
                            value={currentPassword}
                            onChangeText={setCurrentPassword}
                            placeholder="Current password"
                            placeholderTextColor={COLORS.textTertiary}
                            secureTextEntry
                        />
                        <TextInput
                            style={styles.input}
                            value={newPassword}
                            onChangeText={setNewPassword}
                            placeholder="New password (min 6 chars)"
                            placeholderTextColor={COLORS.textTertiary}
                            secureTextEntry
                        />
                        <TextInput
                            style={styles.input}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Confirm new password"
                            placeholderTextColor={COLORS.textTertiary}
                            secureTextEntry
                        />
                        <View style={styles.btnRow}>
                            <TouchableOpacity
                                style={[styles.actionBtn, resetting && styles.actionBtnDisabled]}
                                onPress={handleResetPassword}
                                disabled={resetting}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.actionBtnText}>{resetting ? 'Resetting...' : 'Reset'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Delete Account Section */}
                    <View style={[styles.section, styles.lastSection]}>
                        <Text style={styles.sectionTitle}>Delete Account</Text>
                        <Text style={styles.dangerText}>
                            Permanently delete your account and all your data. This action cannot be undone.
                        </Text>
                        {showDeleteConfirm && (
                            <TextInput
                                style={styles.input}
                                value={deletePassword}
                                onChangeText={setDeletePassword}
                                placeholder="Enter your password to confirm"
                                placeholderTextColor={COLORS.textTertiary}
                                secureTextEntry
                            />
                        )}
                        <View style={styles.btnRow}>
                            <TouchableOpacity
                                style={[styles.actionBtn, deleting && styles.actionBtnDisabled]}
                                onPress={handleDeleteAccount}
                                disabled={deleting}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.actionBtnText}>
                                    {deleting ? 'Deleting...' : 'Delete'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={{ height: 40 }} />
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.white,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    section: {
        marginBottom: 14,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    lastSection: {
        borderBottomWidth: 0,
        marginBottom: 0,
        paddingBottom: 0,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 10,
    },
    input: {
        backgroundColor: '#FAFAFA',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        color: COLORS.textPrimary,
        marginBottom: 8,
    },
    btnRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 4,
    },
    actionBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 24,
        paddingVertical: 8,
        borderRadius: 8,
    },
    actionBtnDisabled: {
        opacity: 0.6,
    },
    actionBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    dangerText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        lineHeight: 19,
        marginBottom: 12,
    },
});
