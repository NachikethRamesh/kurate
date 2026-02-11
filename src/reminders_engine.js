import { RSS_FEEDS } from './config.js';
import { getAllUsers, getUserCategoryStats, createReminder, getUnseenReminders, markReminderAsSeen } from './database.js';
import { validateToken } from './auth.js';
import { createResponse, createErrorResponse } from './constants.js';

/**
 * Reminder Engine: Aligns recommended articles with user's saved/favorited links.
 */
export async function runReminderEngine(db) {
    console.log('Starting Reminder Engine...');

    const users = await getAllUsers(db);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    // Fetch articles for all categories once to avoid repeated network calls
    const categoryArticles = new Map();
    const categories = [...new Set(RSS_FEEDS.map(f => f.category))];

    for (const category of categories) {
        const feeds = RSS_FEEDS.filter(f => f.category === category).slice(0, 3); // Max 3 feeds per category for efficiency
        const articles = [];

        for (const feed of feeds) {
            try {
                const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}&count=5`;
                const response = await fetch(apiUrl);
                const data = await response.json();

                if (data.status === 'ok' && data.items) {
                    articles.push(...data.items.map(item => ({
                        title: item.title,
                        url: item.link,
                        description: item.description?.substring(0, 200).replace(/<[^>]*>/g, '') || '',
                        source: feed.name,
                        category: feed.category
                    })));
                }
            } catch (e) {
                console.error(`Failed to fetch feed ${feed.url}:`, e);
            }
        }
        categoryArticles.set(category, articles);
    }

    // Process each user
    for (const user of users) {
        try {
            const stats = await getUserCategoryStats(db, user.id);
            let targetCategory = 'technology'; // Default

            if (stats.length > 0) {
                // Pick the top category or one of the top favorites
                targetCategory = stats[0].category.toLowerCase();
            } else {
                // For users with no links, pick popular tech or business
                targetCategory = Math.random() > 0.5 ? 'technology' : 'business';
            }

            const candidates = categoryArticles.get(targetCategory) || categoryArticles.get('technology') || [];

            if (candidates.length > 0) {
                // Pick a random article from candidates
                const selected = candidates[Math.floor(Math.random() * candidates.length)];

                await createReminder(db, user.id, {
                    title: selected.title,
                    url: selected.url,
                    description: selected.description,
                    source: selected.source,
                    category: selected.category
                });
            }
        } catch (err) {
            console.error(`Error processing user ${user.id}:`, err);
        }
    }

    return { success: true, processedUsers: users.length };
}

/**
 * Handle API request for fetching reminders
 */
export async function handleRemindersRequest(request, env) {
    const authHeader = request.headers.get('Authorization');
    const tokenData = validateToken(authHeader);

    if (!tokenData) {
        return createErrorResponse('Authorization required', 401);
    }

    const { userId } = tokenData;

    if (request.method === 'GET') {
        const reminders = await getUnseenReminders(env.DB, userId);
        return createResponse({ success: true, reminders });
    }

    if (request.method === 'POST') {
        const body = await request.json();
        const { id, action } = body;

        if (action === 'mark_seen' && id) {
            await markReminderAsSeen(env.DB, id);
            return createResponse({ success: true });
        }
    }

    return createErrorResponse('Method not allowed', 405);
}
