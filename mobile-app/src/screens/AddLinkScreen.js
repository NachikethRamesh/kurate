import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, ScrollView } from 'react-native';
import { COLORS, CATEGORIES } from '../constants';
import { api } from '../api';
import { Ionicons } from '@expo/vector-icons';

export default function AddLinkScreen({ navigation }) {
    const [url, setUrl] = useState('');
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingMeta, setFetchingMeta] = useState(false);

    const handleFetchTitle = async () => {
        if (!url || !url.includes('://')) return;

        setFetchingMeta(true);
        try {
            const response = await fetch(`https://kurate.net/api/meta?url=${encodeURIComponent(url)}`);
            const data = await response.json();
            if (data.title) setTitle(data.title);
        } catch (e) {
            console.log('Meta fetch error:', e);
        } finally {
            setFetchingMeta(false);
        }
    };

    const handleSave = async () => {
        if (!url) {
            Alert.alert('Error', 'Please enter a URL');
            return;
        }

        setLoading(true);
        const result = await api.createLink({
            url,
            title: title || url,
            category: category || 'Other'
        });
        setLoading(false);

        if (result.success) {
            navigation.goBack();
        } else {
            Alert.alert('Error', result.error || 'Failed to save link');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add Link</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.card}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Link</Text>
                        <TextInput
                            style={styles.input}
                            value={url}
                            onChangeText={setUrl}
                            placeholder="https://..."
                            placeholderTextColor={COLORS.textTertiary}
                            onBlur={handleFetchTitle}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Title (Optional)</Text>
                        <View style={styles.titleInputRow}>
                            <TextInput
                                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                value={title}
                                onChangeText={setTitle}
                                placeholder="Link title"
                                placeholderTextColor={COLORS.textTertiary}
                            />
                            {fetchingMeta && <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />}
                        </View>
                    </View>

                    <Text style={styles.label}>Category</Text>
                    <View style={styles.categoryGrid}>
                        {CATEGORIES.map(cat => (
                            <TouchableOpacity
                                key={cat}
                                style={[
                                    styles.categoryBtn,
                                    category === cat && styles.categoryBtnActive
                                ]}
                                onPress={() => setCategory(cat)}
                                activeOpacity={0.7}
                            >
                                <Text style={[
                                    styles.categoryBtnText,
                                    category === cat && styles.categoryBtnTextActive
                                ]}>
                                    {cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity
                        style={styles.saveBtn}
                        onPress={handleSave}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveBtnText}>Curate</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.tipCard}>
                    <Ionicons name="information-circle-outline" size={20} color={COLORS.textSecondary} />
                    <Text style={styles.tipText}>
                        Tip: You can  use the kurate share option to save links directly from other apps.
                    </Text>
                </View>
            </ScrollView>
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    backBtn: {
        padding: 4,
    },
    content: {
        padding: 24,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: COLORS.border,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 4,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.textPrimary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 10,
        marginLeft: 2,
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 12,
        padding: 14,
        fontSize: 14,
        color: COLORS.textPrimary,
    },
    titleInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    loader: {
        marginLeft: 10,
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 32,
    },
    categoryBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
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
    saveBtn: {
        backgroundColor: COLORS.primary,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    tipCard: {
        marginTop: 32,
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.03)',
        padding: 16,
        borderRadius: 16,
        alignItems: 'flex-start',
        gap: 12,
    },
    tipText: {
        flex: 1,
        fontSize: 13,
        color: COLORS.textSecondary,
        lineHeight: 18,
    }
});
