import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Linking, Alert, RefreshControl, TextInput, ScrollView, Animated, PanResponder, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../constants';
import { api } from '../api';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

const CATEGORIES = ['All', 'Sports', 'Entertainment', 'Business', 'Technology', 'Education', 'Other'];
const TABS = [
    { id: 'all', label: 'All', icon: 'grid-outline' },
    { id: 'unread', label: 'To Read', icon: 'bookmark-outline' },
    { id: 'read', label: 'Read', icon: 'checkmark-done-outline' },
    { id: 'favorites', label: 'Favorites', icon: 'star-outline' }
];

export default function HomeScreen({ navigation, setIsAuthenticated }) {
    const [links, setLinks] = useState([]);
    const [activeTab, setActiveTab] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [username, setUsername] = useState('User');

    const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
    const FAB_SIZE = 56;
    const BOUND_X = SCREEN_WIDTH - FAB_SIZE;
    const BOUND_Y = SCREEN_HEIGHT - FAB_SIZE - 80; // Safer bottom bound

    // Rec: Right side, ~250px from top (below categories)
    const initialRecX = SCREEN_WIDTH - 20 - FAB_SIZE;
    const initialRecY = 250;

    // Add: Right side, below Rec
    const initialAddX = SCREEN_WIDTH - 20 - FAB_SIZE;
    const initialAddY = 250 + FAB_SIZE + 20;

    const panRec = useRef(new Animated.ValueXY({ x: initialRecX, y: initialRecY })).current;
    const panAdd = useRef(new Animated.ValueXY({ x: initialAddX, y: initialAddY })).current;

    // We need to track current values for collision logic since Animated.Value is asynchronous/native
    const currRec = useRef({ x: initialRecX, y: initialRecY });
    const currAdd = useRef({ x: initialAddX, y: initialAddY });

    // Dynamic top boundary to avoid overlapping the header/logout button
    const insets = useSafeAreaInsets();
    const topBoundRef = useRef(insets.top + 60);

    useEffect(() => {
        // Update top bound when insets change
        topBoundRef.current = insets.top + 60;
    }, [insets.top]);

    useEffect(() => {
        const idRec = panRec.addListener((val) => currRec.current = val);
        const idAdd = panAdd.addListener((val) => currAdd.current = val);
        return () => {
            panRec.removeListener(idRec);
            panAdd.removeListener(idAdd);
        };
    }, []);

    const createPanResponder = (animValue, currPosRef, otherPosRef) => PanResponder.create({
        onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
            return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
        },
        onPanResponderGrant: () => {
            animValue.setOffset({
                x: animValue.x._value,
                y: animValue.y._value
            });
            animValue.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event(
            [null, { dx: animValue.x, dy: animValue.y }],
            { useNativeDriver: false }
        ),
        onPanResponderRelease: (e, gestureState) => {
            animValue.flattenOffset();

            // Current position after drag
            let destX = currPosRef.current.x;
            let destY = currPosRef.current.y;

            // ⚡ MOMENTUM: Add a bit of "throw" based on velocity
            destX += gestureState.vx * 15;
            destY += gestureState.vy * 15;

            // Get dynamic top boundary
            const minTop = topBoundRef.current;
            const EDGE_PADDING = 20; // Consistent padding from all edges

            let bounced = false;

            // 1. Wall Bouncing (Constraint)
            if (destX < EDGE_PADDING) { destX = EDGE_PADDING; bounced = true; }
            if (destX > BOUND_X - EDGE_PADDING) { destX = BOUND_X - EDGE_PADDING; bounced = true; }
            if (destY < minTop) { destY = minTop; bounced = true; } // Top Bound (Header + Padding implicit)
            if (destY > BOUND_Y - EDGE_PADDING) { destY = BOUND_Y - EDGE_PADDING; bounced = true; }

            // 2. Collision Bouncing
            const otherX = otherPosRef.current.x;
            const otherY = otherPosRef.current.y;

            // Distance between centers
            const dist = Math.sqrt(Math.pow(destX - otherX, 2) + Math.pow(destY - otherY, 2));

            if (dist < FAB_SIZE) {
                // Collision! Bounce away more aggressively
                const angle = Math.atan2(destY - otherY, destX - otherX);
                const targetDist = FAB_SIZE + 25;

                destX = otherX + Math.cos(angle) * targetDist;
                destY = otherY + Math.sin(angle) * targetDist;
                bounced = true;

                // Re-apply wall constraints via clamping
                destX = Math.max(EDGE_PADDING, Math.min(destX, BOUND_X - EDGE_PADDING));
                destY = Math.max(minTop, Math.min(destY, BOUND_Y - EDGE_PADDING));
            }

            Animated.spring(animValue, {
                toValue: { x: destX, y: destY },
                useNativeDriver: true,
                bounciness: 20, // Very bouncy, but valid
                speed: 20       // Fast and snappy
            }).start();
        }
    });

    const panResponderRec = useRef(createPanResponder(panRec, currRec, currAdd)).current;
    const panResponderAdd = useRef(createPanResponder(panAdd, currAdd, currRec)).current;

    const loadLinks = async () => {
        setRefreshing(true);
        const result = await api.getLinks();
        setRefreshing(false);
        if (result.success) {
            setLinks(result.links || []);
        }

        // Try to get username for the title
        try {
            const storedUsername = await SecureStore.getItemAsync('username');
            if (storedUsername) {
                setUsername(storedUsername);
            } else {
                // Fallback: Parse token if username is missing from store
                const token = await SecureStore.getItemAsync('authToken');
                if (token) {
                    // Manual base64 decode for React Native (token is a simple b64 encoded JSON)
                    const base64 = token.includes('.') ? token.split('.')[1] : token;
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
                    let str = String(base64).replace(/=+$/, '');
                    let out = '';
                    for (let bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++);
                        ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
                            bc++ % 4) ? out += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
                    ) {
                        buffer = chars.indexOf(buffer);
                    }
                    const tokenData = JSON.parse(out);
                    if (tokenData && tokenData.username) {
                        setUsername(tokenData.username);
                        // Save it for next time
                        await SecureStore.setItemAsync('username', tokenData.username);
                    }
                }
            }
        } catch (e) {
            console.log('Error decoding token:', e);
        }
    };

    const handleLogout = () => {
        Alert.alert(
            "Logout",
            "Are you sure you want to sign out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        await api.logout();
                        setIsAuthenticated(false);
                    }
                }
            ]
        );
    };

    useFocusEffect(
        useCallback(() => {
            loadLinks();
        }, [])
    );

    useEffect(() => {
        // Run once on mount to ensure username is set even before first focus/refresh
        const fetchUsername = async () => {
            const stored = await SecureStore.getItemAsync('username');
            if (stored) setUsername(stored);
        };
        fetchUsername();
    }, []);

    const filteredLinks = useMemo(() => {
        let filtered = [...links];

        if (activeTab === 'unread') {
            filtered = filtered.filter(l => !l.isRead || l.isRead === 0);
        } else if (activeTab === 'read') {
            filtered = filtered.filter(l => l.isRead === 1);
        } else if (activeTab === 'favorites') {
            filtered = filtered.filter(l => l.isFavorite === 1);
        }

        if (selectedCategory !== 'All') {
            filtered = filtered.filter(l => l.category === selectedCategory);
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(l =>
                (l.title && l.title.toLowerCase().includes(query)) ||
                (l.url && l.url.toLowerCase().includes(query))
            );
        }

        return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, [links, activeTab, selectedCategory, searchQuery]);

    const handleOpenLink = (url) => {
        Linking.openURL(url).catch(err => Alert.alert("Couldn't load page", err.message));
    };

    const handleToggleFavorite = async (link) => {
        const newStatus = !link.isFavorite;
        setLinks(prev => prev.map(l => l.id === link.id ? { ...l, isFavorite: newStatus ? 1 : 0 } : l));
        await api.toggleFavorite(link.id, newStatus);
    };

    const handleMarkRead = async (link) => {
        const isRead = !link.isRead;
        setLinks(prev => prev.map(l => l.id === link.id ? { ...l, isRead: isRead ? 1 : 0 } : l));
        await api.markRead(link.id, isRead);
    };

    const handleDelete = async (link) => {
        setLinks(prev => prev.filter(l => l.id !== link.id));
        await api.deleteLink(link.id);
    };

    const renderItem = useCallback(({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => handleOpenLink(item.url)}
            activeOpacity={0.7}
        >
            <View style={styles.cardHeader}>
                <View style={[styles.badge, styles[`badge${item.category}`]]}>
                    <Text style={[styles.badgeText, styles[`badgeText${item.category}`]]}>
                        {item.category?.toUpperCase() || 'GENERAL'}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => handleToggleFavorite(item)}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name={item.isFavorite ? "star" : "star-outline"}
                        size={20}
                        color={item.isFavorite ? "#FBBF24" : COLORS.textTertiary}
                    />
                </TouchableOpacity>
            </View>

            <Text style={styles.linkTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.linkUrl} numberOfLines={1}>{item.domain || item.url}</Text>

            <View style={styles.cardFooter}>
                <TouchableOpacity
                    onPress={() => handleMarkRead(item)}
                    style={styles.readBtn}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name={item.isRead ? "checkmark-circle" : "ellipse-outline"}
                        size={18}
                        color={item.isRead ? COLORS.primary : COLORS.textSecondary}
                    />
                    <Text style={[styles.readText, item.isRead && styles.readTextActive]}>
                        {item.isRead ? 'Read' : 'Mark as read'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    activeOpacity={0.7}
                >
                    <Ionicons name="trash-outline" size={18} color={COLORS.textTertiary} />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    ), [links, styles]);



    return (
        <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
            {/* Main content in SafeArea */}
            <SafeAreaView style={styles.container}>
                {/* Top Branding Header */}
                <View style={styles.topHeader}>
                    <View style={styles.logoContainer}>
                        <View style={styles.logoIcon}>
                            <Text style={styles.logoIconText}>K</Text>
                        </View>
                        <Text style={styles.logoText}>kurate</Text>
                    </View>
                    <TouchableOpacity
                        onPress={handleLogout}
                        style={styles.logoutBtn}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="log-out-outline" size={22} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Content Title */}
                <View style={styles.titleSection}>
                    <Text style={styles.mainTitle}>{username}'s curated list</Text>
                </View>

                {/* Filter Section */}
                <View style={styles.filterSection}>
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={18} color={COLORS.textTertiary} style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search through your curated list..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor={COLORS.textTertiary}
                            autoComplete="off"
                        />
                    </View>

                    {/* Collections Label */}
                    <Text style={styles.sectionLabel}>COLLECTIONS</Text>
                    <View style={styles.segmentedControl}>
                        {TABS.map(tab => (
                            <TouchableOpacity
                                key={tab.id}
                                style={[styles.segment, activeTab === tab.id && styles.segmentActive]}
                                onPress={() => setActiveTab(tab.id)}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={tab.icon}
                                    size={16}
                                    color={activeTab === tab.id ? COLORS.primary : COLORS.textSecondary}
                                />
                                <Text style={[styles.segmentText, activeTab === tab.id && styles.segmentTextActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Categories Label */}
                    <Text style={styles.sectionLabel}>CATEGORIES</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.categoryScroll}
                        style={styles.categoryWrapper}
                    >
                        {CATEGORIES.map(cat => (
                            <TouchableOpacity
                                key={cat}
                                style={[styles.categoryTab, selectedCategory === cat && styles.categoryTabActive]}
                                onPress={() => setSelectedCategory(cat)}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.categoryTabText, selectedCategory === cat && styles.categoryTabTextActive]}>
                                    {cat}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <FlatList
                    data={filteredLinks}
                    renderItem={renderItem}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.list}
                    numColumns={2}
                    columnWrapperStyle={styles.columnWrapper}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadLinks} />}
                    ListHeaderComponent={
                        <View style={styles.listHeader}>
                        </View>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="leaf-outline" size={48} color={COLORS.textTertiary} style={{ marginBottom: 12 }} />
                            <Text style={styles.emptyText}>No links found in this collection</Text>
                        </View>
                    }
                />
            </SafeAreaView>

            {/* FABs in Absolute Overlay - rendered LAST */}
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                <Animated.View
                    style={[
                        styles.fab,
                        {
                            transform: [{ translateX: panRec.x }, { translateY: panRec.y }],
                            opacity: 1
                        }
                    ]}
                    {...panResponderRec.panHandlers}
                >
                    <TouchableOpacity
                        style={styles.fabTouchArea}
                        onPress={() => navigation.navigate('RecommendedReading')}
                    >
                        <Text style={styles.recFabText}>Rec</Text>
                    </TouchableOpacity>
                </Animated.View>

                <Animated.View
                    style={[
                        styles.fab,
                        {
                            transform: [{ translateX: panAdd.x }, { translateY: panAdd.y }],
                            opacity: 1
                        }
                    ]}
                    {...panResponderAdd.panHandlers}
                >
                    <TouchableOpacity
                        style={styles.fabTouchArea}
                        onPress={() => navigation.navigate('AddLink')}
                    >
                        <Ionicons name="add" size={30} color="#fff" />
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bg,
    },
    topHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 8,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
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
    logoutBtn: {
        padding: 4,
    },
    titleSection: {
        paddingHorizontal: 20,
        paddingBottom: 4,
    },
    mainTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    sectionLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#000',
        letterSpacing: 1,
        marginHorizontal: 20,
        marginBottom: 4,
    },
    filterSection: {
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        paddingTop: 4,
        paddingBottom: 12,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        marginHorizontal: 20,
        paddingHorizontal: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        height: 34,
        fontSize: 13,
        color: COLORS.textPrimary,
    },
    segmentedControl: {
        flexDirection: 'row',
        marginHorizontal: 20,
        backgroundColor: '#F1F5F9',
        borderRadius: 10,
        padding: 2,
        marginBottom: 8,
    },
    segment: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 5,
        borderRadius: 8,
        gap: 4,
    },
    segmentActive: {
        backgroundColor: '#fff',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    segmentText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    segmentTextActive: {
        color: COLORS.primary,
    },
    categoryWrapper: {
        paddingLeft: 20,
    },
    categoryScroll: {
        paddingRight: 40,
        gap: 8,
    },
    categoryTab: {
        paddingHorizontal: 14,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#fff',
    },
    categoryTabActive: {
        backgroundColor: COLORS.primaryLight,
        borderColor: COLORS.primary,
    },
    categoryTabText: {
        fontSize: 11,
        fontWeight: '500',
        color: COLORS.textSecondary,
    },
    categoryTabTextActive: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    list: {
        paddingHorizontal: 8,
        paddingTop: 16,
        paddingBottom: 100,
    },
    listHeader: {
        paddingHorizontal: 8,
        marginBottom: 16,
    },
    recommendedCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    recommendedTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: 6,
    },
    recommendedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    recIcon: {
        width: 32,
        height: 32,
        backgroundColor: COLORS.primary,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    recIconText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    fab: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 9999, // Max zIndex
        backgroundColor: COLORS.primary, // Ensure this color is opaque (e.g. #2563EB)
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5, // Darker shadow for contrast
        shadowRadius: 8,
        elevation: 10,
    },
    fabTouchArea: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    recFabText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    exploreBtn: {
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
    },
    exploreBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    introSection: {
        paddingHorizontal: 12,
        marginBottom: 24,
    },
    introHeader: {
        fontSize: 28,
        fontWeight: '700',
        color: COLORS.textPrimary,
        lineHeight: 34,
        marginBottom: 16,
    },
    introSub: {
        fontSize: 14,
        color: COLORS.textSecondary,
        lineHeight: 22,
    },
    columnWrapper: {
        justifyContent: 'space-between',
        paddingHorizontal: 8,
    },
    card: {
        backgroundColor: '#fff',
        width: '48%',
        borderRadius: 14,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#ECECEC',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: '#F3F4F6',
    },
    badgeText: {
        fontSize: 9,
        fontWeight: '700',
    },
    badgeBusiness: { backgroundColor: '#FFEDD5' },
    badgeTextBusiness: { color: '#9A3412' },
    badgeTechnology: { backgroundColor: '#DBEAFE' },
    badgeTextTechnology: { color: '#1E40AF' },
    badgeSports: { backgroundColor: '#DCFCE7' },
    badgeTextSports: { color: '#166534' },
    badgeEducation: { backgroundColor: '#E0E7FF' },
    badgeTextEducation: { color: '#3730A3' },
    badgeEntertainment: { backgroundColor: '#FCE7F3' },
    badgeTextEntertainment: { color: '#9D174D' },

    linkTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
        lineHeight: 18,
        marginBottom: 4,
        height: 36,
    },
    linkUrl: {
        fontSize: 11,
        color: COLORS.textTertiary,
        marginBottom: 12,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    readBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    readText: {
        fontSize: 11,
        fontWeight: '500',
        color: COLORS.textSecondary,
    },
    readTextActive: {
        color: COLORS.primary,
    },

    emptyState: {
        padding: 60,
        alignItems: 'center',
    },
    emptyText: {
        color: COLORS.textTertiary,
        fontSize: 14,
        textAlign: 'center',
    }
});
