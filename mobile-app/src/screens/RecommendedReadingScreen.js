import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, Alert, SafeAreaView, ScrollView, RefreshControl } from 'react-native';
import { COLORS } from '../constants';
import { Ionicons } from '@expo/vector-icons';
import { rssService } from '../rss';
import { api } from '../api';

const CATEGORIES = ['all', 'sports', 'entertainment', 'business', 'technology', 'education', 'other'];

export default function RecommendedReadingScreen({ navigation }) {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeCategory, setActiveCategory] = useState('all');
    const [curatedItems, setCuratedItems] = useState(new Set());

    const loadArticles = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else {
            // If we have cached articles, show them immediately without loading spinner
            const cached = rssService.getCachedArticles();
            if (cached.length > 0) {
                setArticles(cached);
                setLoading(false);
                // Return early if not refreshing, allowing background update if needed? 
                // Since we prefetch on app start, cache should be enough.
                if (!isRefresh) return;
            } else {
                setLoading(true);
            }
        }

        try {
            const fetchedArticles = await rssService.fetchArticles(isRefresh);
            setArticles(fetchedArticles);
        } catch (err) {
            Alert.alert('Error', 'Failed to load articles');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadArticles();
    }, [loadArticles]);

    const handleSaveArticle = async (article) => {
        if (curatedItems.has(article.id)) return;

        const result = await api.createLink({
            url: article.url,
            title: article.title,
            category: article.category.charAt(0).toUpperCase() + article.category.slice(1)
        });

        if (result.success) {
            setCuratedItems(prev => new Set(prev).add(article.id));
        } else {
            Alert.alert('Error', result.error || 'Failed to curate article');
        }
    };

    const filteredArticles = activeCategory === 'all'
        ? articles
        : articles.filter(a => a.category === activeCategory);

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.sourceBadge, { backgroundColor: COLORS.primaryLight }]}>
                    <Text style={[styles.sourceText, { color: COLORS.primary }]}>{item.source}</Text>
                </View>
                <Text style={styles.dateText}>{item.pubDate.toLocaleDateString()}</Text>
            </View>
            <TouchableOpacity onPress={() => Linking.openURL(item.url)} activeOpacity={0.7}>
                <Text style={styles.articleTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.articleDesc} numberOfLines={2}>{item.description}...</Text>
            </TouchableOpacity>
            <View style={styles.cardFooter}>
                <Text style={styles.domainText}>{item.domain}</Text>
                <TouchableOpacity
                    style={[styles.curateBtn, curatedItems.has(item.id) && styles.curateBtnActive]}
                    onPress={() => handleSaveArticle(item)}
                    activeOpacity={0.7}
                    disabled={curatedItems.has(item.id)}
                >
                    {curatedItems.has(item.id) ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="checkmark" size={14} color="#fff" />
                            <Text style={styles.curateText}>Curated</Text>
                        </View>
                    ) : (
                        <Text style={styles.curateText}>Curate</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>Recommended Reading</Text>
                    <Text style={styles.headerSubtitle}>Trending articles from the past 7 days</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.filterContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                    {CATEGORIES.map(cat => (
                        <TouchableOpacity
                            key={cat}
                            style={[styles.filterBtn, activeCategory === cat && styles.filterBtnActive]}
                            onPress={() => setActiveCategory(cat)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.filterText, activeCategory === cat && styles.filterTextActive]}>
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Fetching trending articles...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredArticles}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => loadArticles(true)} colors={[COLORS.primary]} />
                    }
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Text style={styles.emptyText}>No articles found.</Text>
                        </View>
                    }
                />
            )}
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
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    recIcon: {
        width: 24,
        height: 24,
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    recIconText: {
        color: '#fff',
        fontSize: 8,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
        textAlign: 'center',
    },
    headerSubtitle: {
        fontSize: 11,
        color: COLORS.textTertiary,
        marginTop: 2,
        textAlign: 'center',
    },
    backBtn: {
        padding: 8,
    },
    filterContainer: {
        backgroundColor: '#fff',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    filterScroll: {
        paddingHorizontal: 16,
        gap: 6,
    },
    filterBtn: {
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 20,
        backgroundColor: '#f3f4f6',
    },
    filterBtnActive: {
        backgroundColor: COLORS.primary,
    },
    filterText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    filterTextActive: {
        color: '#fff',
    },
    list: {
        padding: 16,
        gap: 16,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        height: 220, // Uniform height
        justifyContent: 'space-between',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sourceBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    sourceText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    dateText: {
        fontSize: 10,
        color: COLORS.textTertiary,
    },
    articleTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.textPrimary,
        lineHeight: 20,
        marginBottom: 6,
    },
    articleDesc: {
        fontSize: 13,
        color: COLORS.textSecondary,
        lineHeight: 18,
        marginBottom: 8,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
    },
    domainText: {
        fontSize: 12,
        color: COLORS.textTertiary,
    },
    curateBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 80,
    },
    curateBtnActive: {
        backgroundColor: '#10B981', // Green color
    },
    curateText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#fff',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    emptyText: {
        fontSize: 14,
        color: COLORS.textTertiary,
    }
});
