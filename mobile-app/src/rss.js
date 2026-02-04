
const FEEDS = [
    { name: 'ESPN', url: 'https://www.espn.com/espn/rss/news', category: 'sports' },
    { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml', category: 'sports' },
    { name: 'Sky Sports', url: 'https://www.skysports.com/rss/12040', category: 'sports' },
    { name: 'Variety', url: 'https://variety.com/feed/', category: 'entertainment' },
    { name: 'The Hollywood Reporter', url: 'https://www.hollywoodreporter.com/feed/', category: 'entertainment' },
    { name: 'Deadline', url: 'https://deadline.com/feed/', category: 'entertainment' },
    { name: 'Harvard Business Review', url: 'https://hbr.org/feed', category: 'business' },
    { name: 'Entrepreneur', url: 'https://www.entrepreneur.com/latest.rss', category: 'business' },
    { name: 'Fortune', url: 'https://fortune.com/feed/', category: 'business' },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'technology' },
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'technology' },
    { name: 'Hacker News', url: 'https://hnrss.org/frontpage', category: 'technology' },
    { name: 'EdSurge', url: 'https://www.edsurge.com/articles_rss', category: 'education' },
    { name: 'Open Culture', url: 'https://www.openculture.com/feed', category: 'education' },
    { name: 'Lifehacker', url: 'https://lifehacker.com/rss', category: 'other' },
    { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml', category: 'other' }
];

let cachedArticles = [];
let lastFetchTime = 0;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

const stripHtml = (html) => {
    return html.replace(/<[^>]*>?/gm, '').trim();
};

const extractDomain = (url) => {
    try {
        const domain = url.split('/')[2].replace('www.', '');
        return domain;
    } catch {
        return url;
    }
};

export const rssService = {
    getCachedArticles() {
        return cachedArticles;
    },

    async fetchArticles(force = false) {
        // Return cache if valid and not forcing
        if (!force && cachedArticles.length > 0 && (Date.now() - lastFetchTime < CACHE_DURATION)) {
            return cachedArticles;
        }

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        try {
            const fetchPromises = FEEDS.map(async (feed) => {
                try {
                    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}&count=10`;
                    const response = await fetch(apiUrl);
                    if (!response.ok) return [];
                    const data = await response.json();

                    if (data.status === 'ok' && data.items) {
                        return data.items.map(item => {
                            const pubDate = new Date(item.pubDate || item.pub_date || item.created);
                            if (pubDate >= sevenDaysAgo) {
                                return {
                                    id: item.guid || item.link,
                                    title: item.title,
                                    url: item.link,
                                    description: stripHtml(item.description || item.content || '').substring(0, 160),
                                    source: feed.name,
                                    category: feed.category,
                                    pubDate: pubDate,
                                    domain: extractDomain(item.link)
                                };
                            }
                            return null;
                        }).filter(Boolean);
                    }
                    return [];
                } catch (e) {
                    return [];
                }
            });

            const results = await Promise.all(fetchPromises);
            let allArticles = [];
            results.forEach(res => allArticles.push(...res));

            // Sort by date and remove duplicates
            allArticles.sort((a, b) => b.pubDate - a.pubDate);
            const seen = new Set();
            const uniqueArticles = allArticles.filter(a => {
                if (seen.has(a.url)) return false;
                seen.add(a.url);
                return true;
            });

            cachedArticles = uniqueArticles;
            lastFetchTime = Date.now();
            return uniqueArticles;
        } catch (err) {
            console.error('RSS Fetch Error:', err);
            return cachedArticles; // Return stale cache on error
        }
    }
};
