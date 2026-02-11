import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from 'react-native';
import { close, useShareIntentContext } from 'expo-share-extension';
import { getSharedToken } from '../sharedStorage';
import { COLORS, API_URL, CATEGORIES } from '../constants';

export default function ShareExtensionScreen() {
    const { shareIntent } = useShareIntentContext();

    const [token, setToken] = useState(undefined); // undefined = loading
    const [url, setUrl] = useState('');
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [saving, setSaving] = useState(false);
    const [fetchingMeta, setFetchingMeta] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // Load token on mount
    useEffect(() => {
        const t = getSharedToken();
        setToken(t);
    }, []);

    // Extract URL from share intent
    useEffect(() => {
        if (!shareIntent) return;
        const shared = shareIntent.url || shareIntent.text || '';
        // Try to extract a URL from the text
        const urlMatch = shared.match(/https?:\/\/[^\s]+/);
        if (urlMatch) {
            setUrl(urlMatch[0]);
        } else {
            setUrl(shared);
        }
    }, [shareIntent]);

    // Auto-fetch title when URL is set
    useEffect(() => {
        if (!url || !url.startsWith('http')) return;
        let cancelled = false;
        setFetchingMeta(true);
        fetch(`${API_URL}/meta?url=${encodeURIComponent(url)}`)
            .then(r => r.json())
            .then(data => {
                if (!cancelled && data.title) setTitle(data.title);
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setFetchingMeta(false);
            });
        return () => { cancelled = true; };
    }, [url]);

    const handleSave = async () => {
        if (!url) return;
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/links`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url,
                    title: title || url,
                    category: category || 'Other',
                }),
            });
            const data = await res.json();
            if (data.success) {
                setSuccess(true);
                setTimeout(() => close(), 800);
            } else {
                setError(data.error || 'Failed to save');
                setSaving(false);
            }
        } catch (e) {
            setError('Network error — check your connection');
            setSaving(false);
        }
    };

    // Loading state
    if (token === undefined) {
        return (
            <View style={styles.container}>
                <View style={styles.card}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            </View>
        );
    }

    // Not signed in
    if (!token) {
        return (
            <View style={styles.container}>
                <View style={styles.card}>
                    <Text allowFontScaling={false} style={styles.logo}>kurate</Text>
                    <Text allowFontScaling={false} style={styles.signInMsg}>
                        Please open the Kurate app and sign in first.
                    </Text>
                    <TouchableOpacity style={styles.closeBtn} onPress={() => close()} activeOpacity={0.8}>
                        <Text allowFontScaling={false} style={styles.closeBtnText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // Success state
    if (success) {
        return (
            <View style={styles.container}>
                <View style={styles.card}>
                    <Text allowFontScaling={false} style={styles.checkmark}>✓</Text>
                    <Text allowFontScaling={false} style={styles.successText}>Curated!</Text>
                </View>
            </View>
        );
    }

    // Form state
    return (
        <View style={styles.container}>
            <View style={styles.card}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => close()} activeOpacity={0.7}>
                        <Text allowFontScaling={false} style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <Text allowFontScaling={false} style={styles.logo}>kurate</Text>
                    <View style={{ width: 50 }} />
                </View>

                {/* URL field */}
                <Text allowFontScaling={false} style={styles.label}>LINK</Text>
                <TextInput
                    allowFontScaling={false}
                    style={styles.input}
                    value={url}
                    onChangeText={setUrl}
                    placeholder="https://..."
                    placeholderTextColor={COLORS.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                />

                {/* Title field */}
                <Text allowFontScaling={false} style={styles.label}>TITLE</Text>
                <View style={styles.titleRow}>
                    <TextInput
                        allowFontScaling={false}
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Link title"
                        placeholderTextColor={COLORS.textTertiary}
                    />
                    {fetchingMeta && (
                        <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} />
                    )}
                </View>

                {/* Category pills */}
                <Text allowFontScaling={false} style={[styles.label, { marginTop: 16 }]}>CATEGORY</Text>
                <View style={styles.categoryGrid}>
                    {CATEGORIES.map(cat => (
                        <TouchableOpacity
                            key={cat}
                            style={[
                                styles.categoryBtn,
                                category === cat && styles.categoryBtnActive,
                            ]}
                            onPress={() => setCategory(cat)}
                            activeOpacity={0.7}
                        >
                            <Text
                                allowFontScaling={false}
                                style={[
                                    styles.categoryBtnText,
                                    category === cat && styles.categoryBtnTextActive,
                                ]}
                            >
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Error message */}
                {error && (
                    <Text allowFontScaling={false} style={styles.errorText}>{error}</Text>
                )}

                {/* Curate button */}
                <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                    activeOpacity={0.8}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text allowFontScaling={false} style={styles.saveBtnText}>Curate</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'transparent',
    },
    card: {
        backgroundColor: COLORS.bg,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    cancelText: {
        fontSize: 15,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    logo: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.primary,
        letterSpacing: -0.5,
    },
    signInMsg: {
        fontSize: 15,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginVertical: 24,
        lineHeight: 22,
    },
    closeBtn: {
        backgroundColor: COLORS.primary,
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    closeBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    checkmark: {
        fontSize: 48,
        color: COLORS.success,
        textAlign: 'center',
        marginBottom: 8,
    },
    successText: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.success,
        textAlign: 'center',
    },
    label: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.textPrimary,
        letterSpacing: 1,
        marginBottom: 8,
        marginLeft: 2,
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        color: COLORS.textPrimary,
        marginBottom: 12,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 20,
    },
    categoryBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: '#fff',
    },
    categoryBtnActive: {
        backgroundColor: COLORS.primaryLight,
        borderColor: COLORS.primary,
    },
    categoryBtnText: {
        fontSize: 13,
        fontWeight: '500',
        color: COLORS.textSecondary,
    },
    categoryBtnTextActive: {
        color: COLORS.primary,
    },
    errorText: {
        fontSize: 13,
        color: COLORS.error,
        marginBottom: 12,
        textAlign: 'center',
    },
    saveBtn: {
        backgroundColor: COLORS.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
