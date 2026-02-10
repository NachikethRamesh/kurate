import { handleAuthLogin, handleAuthRegister, handlePasswordReset, handleAuthLogout, validateToken } from './auth.js';
import { handleLinks, handleMarkRead, handleToggleFavorite } from './links.js';
import { checkDatabaseHealth, trackEvent } from './database.js';
import { CORS_HEADERS, createResponse, createErrorResponse } from './constants.js';

async function handleHealth(request, env) {
    try {
        const dbHealth = await checkDatabaseHealth(env.DB);

        const responseData = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '2.0.0',
            environment: {
                hasDatabase: !!env.DB,
                hasJwtSecret: !!env.JWT_SECRET,
                nodeEnv: env.NODE_ENV || 'production'
            },
            database: dbHealth
        };

        return createResponse(responseData, 200);

    } catch (error) {
        return createErrorResponse(error.message, 500);
    }
}

function isMobile(request) {
    const ua = (request.headers.get('User-Agent') || '').toLowerCase();
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(ua);
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const mobile = isMobile(request);

        // Handle CORS preflight requests
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 200, headers: CORS_HEADERS });
        }

        // API Routes
        if (path === '/api/health') {
            return handleHealth(request, env);
        }

        if (path === '/api/auth/login') {
            return handleAuthLogin(request, env);
        }

        if (path === '/api/auth/register') {
            return handleAuthRegister(request, env);
        }

        if (path === '/api/auth/reset-password') {
            return handlePasswordReset(request, env);
        }

        if (path === '/api/auth/logout') {
            return handleAuthLogout(request, env);
        }

        if (path === '/api/links') {
            return handleLinks(request, env);
        }

        if (path === '/api/links/mark-read') {
            return handleMarkRead(request, env);
        }

        if (path === '/api/links/toggle-favorite') {
            return handleToggleFavorite(request, env);
        }

        if (path === '/api/meta') {
            const targetUrl = url.searchParams.get('url');
            if (!targetUrl) return createErrorResponse('Missing URL', 400);

            try {
                const response = await fetch(targetUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Kurate/1.0)' }
                });
                const html = await response.text();
                // Simple regex to extract title
                const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                // Decode HTML entities (basic) can be done on client side or via simple replace if needed, 
                // but usually the raw text is okay or browser handles it in input.
                const title = titleMatch ? titleMatch[1].trim() : '';
                return createResponse({ title });
            } catch (error) {
                console.error('Meta fetch error:', error);
                // Return empty title rather than error to avoid disrupting user
                return createResponse({ title: '' });
            }
        }

        // Metrics Endpoint (Obfuscated)
        if (path === '/api/system/sync' && request.method === 'POST') {
            try {
                // Parse session cookies manually to avoid dependency loops if using auth.js helpers not exported
                // Or assuming getSession is available. 
                // Index.js doesn't seem to have getSession imported.
                // I will just pass null for userId for now or need to parsing logic. 
                // Let's implement a simple cookie parser or just rely on client sending token if needed?
                // The plan said "Extracts userId from session".
                // I'll grab cookie header.
                const cookieHeader = request.headers.get('Cookie') || '';
                const cookies = {};
                cookieHeader.split(';').forEach(cookie => {
                    const [name, value] = cookie.trim().split('=');
                    if (name && value) cookies[name] = value;
                });

                // We need to resolve session. Since we don't have direct access to KV here easily without imports.
                // Actually `request` and `env` are passed. 
                // Let's just store simple metadata without UserID verification for now to avoid complexity, 
                // or try to import `getSession` from auth.js if exported?
                // `handleAuthLogin` is imported from `./auth.js`.
                // Let's look at `auth.js` exports? I haven't seen them.
                // Assuming I can just store it. I'll add a TODO or try to implement robustly later.
                // Better: The `trackEvent` function takes a `userId`. 
                // Let's try to match the existing pattern.
                // For now, I'll pass NULL for userId to ensure it works, as adding session parsing might break.
                // Wait, I can try to find session_id in cookie and look up in KV?
                // `const session = await env.KV.get(cookies.session_id, { type: 'json' });`

                let userId = null;
                if (cookies.session_id) {
                    const session = await env.KV.get(cookies.session_id, { type: 'json' });
                    if (session) userId = session.userId;
                }

                const data = await request.json();
                const { t, d } = data;

                if (t) {
                    await trackEvent(env.DB, userId, t, JSON.stringify(d || {}));
                }

                return new Response(JSON.stringify({ s: 1 }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), { status: 500 });
            }
        }

        // Landing page for root
        if (path === '/') {
            const html = mobile ? getMobileLandingHTML() : getLandingHTML();
            return new Response(html, {
                headers: { 'Content-Type': 'text/html' }
            });
        }

        // Redirect legacy auth routes to landing page
        if (path === '/login' || path === '/signup' || path === '/reset-password') {
            return Response.redirect(url.origin, 302);
        }

        // App routes - protected views
        if (path === '/app' || path === '/home' || path === '/dashboard') {
            const html = mobile ? getMobileIndexHTML() : getIndexHTML();
            return new Response(html, {
                headers: { 'Content-Type': 'text/html' }
            });
        }

        if (path === '/styles.css') {
            const css = mobile ? getMobileStylesCSS() : getStylesCSS();
            return new Response(css, {
                headers: { 'Content-Type': 'text/css' }
            });
        }

        if (path === '/app.js') {
            const js = mobile ? getMobileAppJS() : getAppJS();
            return new Response(js, {
                headers: { 'Content-Type': 'application/javascript' }
            });
        }

        // Try serving static assets via binding
        if (env.ASSETS) {
            const asset = await env.ASSETS.fetch(request);
            if (asset.status !== 404) {
                return asset;
            }
        }

        // Default fallback to index.html for SPA routing
        const fallbackHtml = mobile ? getMobileIndexHTML() : getIndexHTML();
        return new Response(fallbackHtml, {
            headers: { 'Content-Type': 'text/html' }
        });
    }
};

// Static file content functions
function getIndexHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover">
    <meta name="format-detection" content="telephone=no">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <title>kurate - for the curious</title>
    <meta name="description" content="Save and organize your links with kurate">
    <link rel="stylesheet" href="styles.css">
    <link rel="icon" type="image/png" href="/favicon.png?v=2">
    <script src="https://cdn.jsdelivr.net/npm/fuse.js@7.0.0"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital,wght@0,400;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body>
    <div id="mainApp" class="app">
        <!-- Header -->
        <header class="app-header">
            <div class="header-content">
                <a href="https://kurate.net" class="logo-container">
                    <div class="logo-circle-icon">K</div>
                    <span class="logo-text">kurate</span>
                </a>
                <div style="display:flex;align-items:center;gap:8px;">
                    <button id="logoutBtn" class="logout-btn">
                        Log out
                    </button>
                    <button id="hamburgerBtn" class="hamburger-btn" onclick="window.app.toggleDrawer()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        </header>

        <!-- Main Content Grid -->
        <div class="container">
            <div class="main-content">
                
                <!-- Left Sidebar: Navigation -->
                <aside class="sidebar-left">
                    <div class="nav-section">
                        <h3 class="nav-header">Collections</h3>
                        <nav class="nav-list" id="mainNav">
                            <button id="allTab" class="nav-item active">
                                <span class="nav-icon">
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                                </span>
                                All
                            </button>
                            <button id="unreadTab" class="nav-item">
                                <span class="nav-icon">
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                </span>
                                To be read
                            </button>
                            <button id="readTab" class="nav-item">
                                <span class="nav-icon">
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                </span>
                                Read
                            </button>
                            <button id="favoritesTab" class="nav-item">
                                <span class="nav-icon">
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                </span>
                                Favorites
                            </button>
                        </nav>
                    </div>

                    <div class="nav-section">
                        <h3 class="nav-header">Categories</h3>
                        <nav class="nav-list" id="categoryNav">
                            <!-- Populated by JS or static for now, JS toggles active class -->
                             <button class="nav-item category-item active" data-category="all">
                                All
                             </button>
                             <button class="nav-item category-item" data-category="Sports">Sports</button>
                             <button class="nav-item category-item" data-category="Entertainment">Entertainment</button>
                             <button class="nav-item category-item" data-category="Business">Business</button>
                             <button class="nav-item category-item" data-category="Technology">Technology</button>
                             <button class="nav-item category-item" data-category="Education">Education</button>
                             <button class="nav-item category-item" data-category="Other">Other</button>
                        </nav>
                    </div>
                </aside>

                <!-- Middle: Content Area -->
                <main class="content-mid">
                    <div class="content-header">
                        <h2 class="content-title" id="userGreeting">Curated List</h2>
                    </div>

                    <div class="search-container">
                        <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A8A29E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input type="text" id="searchInput" class="search-input" placeholder="Search through your curated list..." autocomplete="off">
                    </div>

                    <section class="links-container">
                        <div id="links" class="links-grid">
                            <div class="empty-state">
                                <div class="empty-description">Loading links...</div>
                            </div>
                        </div>
                    </section>
                </main>

                <!-- Right Sidebar: Add Link -->
                <aside class="sidebar-right">
                    <div class="sidebar-card">
                        <div class="sidebar-header">
                             <h2 class="sidebar-title-small">
                                 Add Link
                             </h2>
                        </div>
                        <form id="addLinkForm" class="add-link-form">
                            <div class="form-group">
                                <label for="linkUrl" class="form-label">Link</label>
                                <input type="url" id="linkUrl" class="form-input" placeholder="https://..." required autocomplete="off">
                            </div>
                            
                             <div class="form-group">
                                 <label class="form-label">Category</label>
                                 <div class="custom-select-wrapper">
                                     <input type="hidden" id="linkCategory" value="">
                                     <button type="button" class="custom-select-trigger" id="categoryTrigger">
                                         <span id="categoryText">Select Category</span>
                                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                             <path d="M6 9l6 6 6-6"/>
                                         </svg>
                                     </button>
                                     <div class="custom-options" id="categoryOptions">
                                         <div class="custom-option" data-value="Sports">Sports</div>
                                         <div class="custom-option" data-value="Entertainment">Entertainment</div>
                                         <div class="custom-option" data-value="Business">Business</div>
                                         <div class="custom-option" data-value="Technology">Technology</div>
                                         <div class="custom-option" data-value="Education">Education</div>
                                         <div class="custom-option" data-value="Other">Other</div>
                                     </div>
                                 </div>
                             </div>
                            
                            <button type="submit" id="addBtn" class="btn btn-primary btn-full">
                                Curate
                            </button>
                        </form>
                    </div>

                    <!-- Recommended Reading Section -->
                    <div class="sidebar-card recommended-card">
                        <div class="recommended-section">
                            <h3 class="sidebar-title-small recommended-sidebar-title">Recommended Reading</h3>
                            <p class="recommended-desc">Discover trending articles from across the web</p>
                            <button id="openRecommendedBtn" class="btn btn-primary">
                                Explore Articles
                            </button>
                        </div>
                    </div>
                </aside>

            </div>
        </div>
    </div>

    <!-- Drawer Backdrop (mobile sidebar) -->
    <div id="drawerBackdrop" class="drawer-backdrop" onclick="window.app.toggleDrawer()"></div>

    <!-- Mobile FAB: Add Link -->
    <button id="mobileFab" class="mobile-fab" onclick="window.app.toggleMobileAddLink()">+</button>

    <!-- Mobile Add Link Bottom Sheet -->
    <div id="mobileAddLinkModal" class="mobile-addlink-modal">
        <div class="mobile-addlink-backdrop" onclick="window.app.toggleMobileAddLink()"></div>
        <div class="mobile-addlink-content">
            <div class="mobile-addlink-header">
                <span class="mobile-addlink-title">Add Link</span>
                <button class="mobile-addlink-close" onclick="window.app.toggleMobileAddLink()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <form id="mobileAddLinkForm" class="add-link-form">
                <div class="form-group">
                    <label for="mobileLinkUrl" class="form-label">Link</label>
                    <input type="url" id="mobileLinkUrl" class="form-input" placeholder="https://..." required autocomplete="off">
                </div>
                <div class="form-group">
                    <label class="form-label">Category</label>
                    <div class="custom-select-wrapper">
                        <input type="hidden" id="mobileLinkCategory" value="">
                        <button type="button" class="custom-select-trigger" id="mobileCategoryTrigger">
                            <span id="mobileCategoryText">Select Category</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M6 9l6 6 6-6"/>
                            </svg>
                        </button>
                        <div class="custom-options" id="mobileCategoryOptions">
                            <div class="custom-option" data-value="Sports">Sports</div>
                            <div class="custom-option" data-value="Entertainment">Entertainment</div>
                            <div class="custom-option" data-value="Business">Business</div>
                            <div class="custom-option" data-value="Technology">Technology</div>
                            <div class="custom-option" data-value="Education">Education</div>
                            <div class="custom-option" data-value="Other">Other</div>
                        </div>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary btn-full">
                    Curate
                </button>
            </form>
        </div>
    </div>

    <!-- Recommended Reading Portal Modal -->
    <div id="recommendedModal" class="recommended-modal hidden">
        <div class="recommended-modal-backdrop" onclick="window.app.closeRecommendedPortal()"></div>
        <div class="recommended-modal-content">
            <div class="recommended-modal-header">
                <div class="recommended-modal-title-section">
                    <h2 class="recommended-modal-title">Recommended Reading</h2>
                    <p class="recommended-modal-subtitle">Trending articles from the past 7 days</p>
                </div>
                <button class="recommended-modal-close" onclick="window.app.closeRecommendedPortal()">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div class="recommended-modal-filters">
                <button class="recommended-filter active" data-source="all">All</button>
                <button class="recommended-filter" data-source="sports">Sports</button>
                <button class="recommended-filter" data-source="entertainment">Entertainment</button>
                <button class="recommended-filter" data-source="business">Business</button>
                <button class="recommended-filter" data-source="technology">Technology</button>
                <button class="recommended-filter" data-source="education">Education</button>
                <button class="recommended-filter" data-source="other">Other</button>
            </div>
            <div id="recommendedArticles" class="recommended-articles-grid">
                <div class="recommended-loading">
                    <div class="loading-spinner"></div>
                    <p>Loading trending articles...</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Status/Alert Container -->
    <div id="statusMessage" class="status-message hidden"></div>

    <script src="app.js"></script>
</body>
</html>
`;
}

function getStylesCSS() {
    return `/* kurate - Modern Clean Design */
:root {
    --bg-page: #FDFAF8;
    --text-primary: #1C1917;
    --text-secondary: #4B5563; /* Gray 600 */
    --text-tertiary: #9CA3AF;
    --accent-orange: #D2622A;
    --accent-orange-light: #FFF4F0;
    --accent-orange-hover: #B34E1F;
    --border-light: #E5E7EB; /* Gray 200 */
    --card-hover-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    
    --font-serif: "Instrument Serif", serif;
    --font-sans: "Inter", system-ui, -apple-system, sans-serif;
    
    --radius-lg: 16px;
    --radius-md: 12px;
    --radius-sm: 8px;
    
    --sidebar-width-left: clamp(180px, 14vw, 216px);
    --sidebar-width-right: clamp(240px, 18vw, 280px);
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}


html {
    overflow: hidden;
}

body {
    font-family: var(--font-sans);
    background: var(--bg-page);
    color: var(--text-primary);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
}

/* Layout */
.app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

.container {
    max-width: 1440px;
    margin: 0 auto;
    padding: 0 clamp(16px, 3vw, 40px);
    width: 100%;
    flex: 1;
}

.app-header {
    padding: 24px clamp(16px, 3vw, 40px);
    max-width: 1440px;
    margin: 0 auto;
    width: 100%;
}

.header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

/* Logo */
.logo-container {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: var(--text-primary);
}

.logo-circle-icon {
    width: 24px;
    height: 24px;
    background: #000;
    border-radius: 50%;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    font-family: var(--font-sans);
}

.logo-text {
    font-weight: 700;
    font-family: var(--font-sans);
    font-size: 20px;
    letter-spacing: -0.02em;
}

/* Logout Button */
.logout-btn {
    background: transparent;
    border: 1px solid var(--border-light);
    padding: 8px 16px;
    border-radius: 100px;
    font-family: var(--font-sans);
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
}

.logout-btn:hover {
    border-color: var(--text-primary);
    color: var(--text-primary);
}

.logout-icon { font-size: 12px; }

/* Main Grid Layout */
.main-content {
    display: grid;
    grid-template-columns: var(--sidebar-width-left) 1fr var(--sidebar-width-right);
    gap: clamp(24px, 3vw, 40px);
    padding-top: 12px;
    padding-bottom: 64px;
}

/* Left Sidebar: Navigation */
.nav-section { margin-bottom: 34px; }

.nav-header {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-primary);
    margin-bottom: 14px;
    margin-top: 0;
}

.nav-list { display: flex; flex-direction: column; gap: 4px; }

.nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    font-family: var(--font-sans);
    font-size: 13px;
    font-style: normal;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
}

.nav-item:hover { 
    color: var(--text-primary); 
    background: #F3F4F6;
    outline: none !important;
}

.nav-item.active {
    background: #FFEDD5; /* Darkened peach */
    color: var(--accent-orange); /* Vibrant orange */
    outline: none !important;
    border: none !important;
}

.nav-item:focus {
    outline: none !important;
    border: none !important;
}

#categoryNav .nav-item.active {
    background: #FFEDD5;
    color: var(--accent-orange);
}

.category-count {
    margin-left: auto;
    background: #374151;
    color: #fff;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 600;
}

.nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent-orange); /* Vibrant orange */
    opacity: 1;
}

.category-item { padding-left: 10px; } /* Simple list for categories */

/* Content Area */
.content-mid { 
    display: flex; 
    flex-direction: column;
    min-height: 0;
}

.content-header { margin-bottom: 0; }

.content-title {
    font-size: 24px;
    font-weight: 700;
    font-family: var(--font-sans);
    color: var(--text-primary);
    margin-bottom: 12px;
}

.content-title span {
    color: var(--accent-orange);
}

/* Search */
.search-container {
    position: relative;
    margin-bottom: 16px;
}

.search-input {
    width: 100%;
    padding: 10px 16px 10px 48px;
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--text-primary);
    background: #fff;
    transition: all 0.2s;
}

.search-input:focus {
    outline: none;
    border-color: var(--text-primary);
    box-shadow: 0 0 0 2px rgba(0,0,0,0.05);
}

.search-input::placeholder { color: var(--text-tertiary); }

.search-icon {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    opacity: 0.5;
}

/* Links Grid */
.links-container {
    max-height: calc(100vh - 230px);
    overflow-y: auto;
    padding: 20px;
    background: #FEFEFE;
    border: 1px solid #E8E8E8;
    border-radius: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
    transition: box-shadow 0.3s ease;
}

.links-container:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06), 0 2px 4px rgba(0, 0, 0, 0.03);
}

.links-container::-webkit-scrollbar {
    width: 8px;
}

.links-container::-webkit-scrollbar-track {
    background: transparent;
    margin: 8px 0;
}

.links-container::-webkit-scrollbar-thumb {
    background: #D1D5DB;
    border-radius: 10px;
    border: 2px solid #FEFEFE;
    transition: background 0.2s ease;
}

.links-container::-webkit-scrollbar-thumb:hover {
    background: #9CA3AF;
}

.links-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr); /* Fixed 2 columns */
    gap: 16px;
}

/* Link Card */
.link-card {
    background: #fff;
    border: 1px solid #ECECEC;
    border-radius: 14px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    height: 120px;
    overflow: hidden;
    cursor: pointer;
}

.link-card:hover {
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04);
    border-color: #D1D5DB;
    transform: translateY(-3px);
}

.card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 4px;
}

.card-badge {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 1px 4px;
    border-radius: 4px;
    background: #F3F4F6;
    color: var(--text-secondary);
}

/* Dynamic Badge Colors */
.badge-Business { background: #FFEDD5; color: #9A3412; }
.badge-Technology { background: #DBEAFE; color: #1E40AF; }
.badge-Sports { background: #DCFCE7; color: #166534; }
.badge-Education { background: #E0E7FF; color: #3730A3; }
.badge-Entertainment { background: #FCE7F3; color: #9D174D; }
.badge-Other { background: #F3F4F6; color: #4B5563; }

.star-btn {
    background: transparent;
    border: none;
    font-size: 18px;
    color: var(--border-light); /* Inactive color matching border roughly or tertiary */
    color: #D1D5DB; 
    cursor: pointer;
    transition: color 0.2s;
    padding: 0;
    line-height: 1;
    font-size: 16px;
}

.star-btn:hover, .star-btn.active { color: #FBBF24; /* Gold/Yellow */ }

.card-main { margin-bottom: 6px; flex: 1; }

.card-title {
    font-size: 14px;
    font-weight: 600;
    font-family: var(--font-sans);
    line-height: 1.2;
    margin-bottom: 1px;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2; /* Limit to 2 lines */
    -webkit-box-orient: vertical;
}

.card-title a { text-decoration: none; color: inherit; }
.card-title a:hover { color: var(--accent-orange); }

.card-domain {
    font-size: 11px;
    color: var(--text-tertiary);
}

.card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 4px;
}

.mark-read-btn {
    background: transparent;
    border: none;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: color 0.2s;
}

.mark-read-btn:hover { color: var(--text-primary); }

.mark-read-btn.is-read { color: var(--accent-orange); }

.card-actions { display: flex; gap: 8px; }

.icon-btn {
    background: transparent;
    border: none;
    color: var(--text-tertiary);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s;
}

.icon-btn:hover { background: #F3F4F6; color: var(--text-primary); }

/* Right Sidebar */
.sidebar-right .sidebar-card {
    background: #FAFAFA;
    border-radius: 12px;
    padding: 16px;
    border: 1px solid var(--border-light);
}

.sidebar-title-small {
    font-size: 16px;
    font-weight: 700;
    font-family: var(--font-sans);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
}

.add-link-form {
    background: transparent;
}

.form-group { margin-bottom: 12px; }

.form-group label {
    display: block;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #000000;
    margin-bottom: 8px;
    margin-left: 2px;
}

.form-group input, .form-group select {
    width: 100%;
    padding: 10px 12px;
    background: #F8FAFC;
    border: 1px solid #CBD5E1;
    border-radius: 8px;
    font-family: var(--font-sans);
    font-size: 13px;
    color: var(--text-primary);
    transition: all 0.2s;
}

.form-group input::placeholder { color: #94A3B8; }

.save-link-btn {
    width: 100%;
    padding: 16px;
    background: #D94E28;
    color: #fff;
    border: none;
    border-radius: 14px;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    margin-top: 8px;
    transition: all 0.2s;
}

.save-link-btn:hover {
    background: #B73D1E;
    transform: translateY(-1px);
}

.form-input {
    width: 100%;
    padding: 12px 16px;
    background: #F9FAFB; /* Gray 50 */
    border: 1px solid #CBD5E1;
    border-radius: var(--radius-sm);
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--text-primary);
    transition: all 0.2s;
}

.form-input:focus {
    outline: none;
    background: #fff;
    border-color: var(--accent-orange);
    box-shadow: 0 0 0 2px rgba(234, 88, 12, 0.1);
}

.form-input::placeholder { color: #D1D5DB; }

/* Custom Select */
.custom-select-wrapper {
    position: relative;
    width: 100%;
}

.custom-select-trigger {
    background: #F8FAFC;
    border: 1px solid #CBD5E1;
    border-radius: 8px;
    padding: 8px 12px;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
}

.custom-select-trigger:focus {
    outline: none;
    border-color: var(--accent-orange);
    box-shadow: 0 0 0 2px rgba(234, 88, 12, 0.1);
}

.custom-options {
    position: absolute;
    background: white;
    width: 100%;
    border: 1px solid var(--border-light);
    border-radius: var(--radius-sm);
    margin-top: 4px;
    box-shadow: var(--card-hover-shadow);
    z-index: 50;
    display: none;
}

.custom-options.open { display: block; }

.custom-option {
    padding: 7px 16px;
    font-size: 14px;
    cursor: pointer;
}

.custom-option:hover { background: #F9FAFB; color: var(--accent-orange); }

.btn-primary {
    width: 100%;
    background: var(--accent-orange);
    color: white;
    border: none;
    padding: 10px;
    border-radius: var(--radius-sm);
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    box-shadow: 0 4px 6px -1px rgba(234, 88, 12, 0.2);
    transition: all 0.2s;
}

.btn-primary:hover {
    background: var(--accent-orange-hover);
    transform: translateY(-1px);
    box-shadow: 0 6px 8px -1px rgba(234, 88, 12, 0.3);
}

.btn-primary:focus {
    outline: none;
}

.btn-primary:focus-visible {
    outline: 2px solid var(--accent-orange);
    outline-offset: 2px;
}

/* Empty State */
.empty-state, .tab-empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 60px 0;
    color: var(--text-tertiary);
}

/* Links Scroll Container */
.links-scroll-container {
    max-height: calc(100vh - 280px);
    overflow-y: auto;
    padding: 16px;
    background: #fff;
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
    margin-top: 12px;
}

/* Custom Scrollbar */
.links-scroll-container::-webkit-scrollbar {
    width: 6px;
}

.links-scroll-container::-webkit-scrollbar-track {
    background: transparent;
}

.links-scroll-container::-webkit-scrollbar-thumb {
    background: #D1D5DB;
    border-radius: 10px;
}

.links-scroll-container::-webkit-scrollbar-thumb:hover {
    background: #9CA3AF;
}
/* Status Toast */
.status-message {
    position: fixed;
    bottom: 32px;
    right: 32px;
    padding: 12px 24px;
    border-radius: 8px;
    background: #111827;
    color: white;
    font-size: 14px;
    font-weight: 500;
    z-index: 100;
    animation: slideUp 0.3s ease-out;
}

.status-message.hidden { display: none; }

.status-message.error { background: #EF4444; }
.status-message.success { background: #10B981; }

@keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}

/* Recommended Reading Section */
.recommended-card {
    margin-top: 16px;
    background: #FAFAFA;
    border: 1px solid var(--border-light);
}

.recommended-section {
    text-align: center;
    padding: 4px 0;
}

.recommended-sidebar-title {
    margin-bottom: 4px !important;
}

.recommended-desc {
    font-size: 11px;
    color: var(--text-secondary);
    margin-bottom: 8px;
    line-height: 1.4;
}

.btn-recommended {
    width: 100%;
    background: var(--accent-orange);
    color: white;
    border: none;
    padding: 10px 16px;
    border-radius: 8px;
    font-weight: 500;
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all 0.2s ease;
}

.btn-recommended:hover {
    background: var(--accent-orange-hover);
}

.btn-recommended:focus {
    outline: none;
}

.btn-recommended svg {
    transition: transform 0.2s ease;
}

.btn-recommended:hover svg {
    transform: translateX(4px);
}

/* Recommended Modal Portal */
.recommended-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.3s ease;
}

.recommended-modal.hidden {
    display: none;
}

.recommended-modal-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
}

.recommended-modal-content {
    position: relative;
    width: 85%;
    height: 85%;
    background: #fff;
    border-radius: 24px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideUpModal 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideUpModal {
    from { 
        opacity: 0;
        transform: translateY(30px) scale(0.98);
    }
    to { 
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.recommended-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 28px;
    border-bottom: 1px solid #E5E7EB;
    background: #FAFAFA;
}

.recommended-modal-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
}

.recommended-modal-subtitle {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 2px 0 0;
}

.recommended-modal-close {
    width: 40px;
    height: 40px;
    border: none;
    background: #F3F4F6;
    border-radius: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    color: var(--text-secondary);
}

.recommended-modal-close:hover {
    background: #E5E7EB;
    color: var(--text-primary);
}

.recommended-modal-filters {
    display: flex;
    gap: 8px;
    padding: 16px 32px;
    border-bottom: 1px solid #F3F4F6;
    background: #fff;
}

.recommended-filter {
    padding: 8px 16px;
    border: 1px solid #E5E7EB;
    background: #fff;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
}

.recommended-filter:hover {
    border-color: var(--accent-orange);
    color: var(--accent-orange);
}

.recommended-filter.active {
    background: var(--accent-orange);
    border-color: var(--accent-orange);
    color: white;
}

.recommended-articles-grid {
    flex: 1;
    overflow-y: auto;
    padding: 20px 32px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    align-content: start;
}

.recommended-articles-grid::-webkit-scrollbar {
    width: 8px;
}

.recommended-articles-grid::-webkit-scrollbar-track {
    background: transparent;
}

.recommended-articles-grid::-webkit-scrollbar-thumb {
    background: #D1D5DB;
    border-radius: 10px;
}

/* Recommended Article Card */
.recommended-article {
    background: #fff;
    border: 1px solid #E5E7EB;
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    min-height: 200px;
    height: 200px;
}

.recommended-article:hover {
    border-color: #D1D5DB;
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.06);
    transform: translateY(-2px);
}

.recommended-article-source {
    display: flex;
    align-items: center;
    gap: 6px;
}

.recommended-article-source-badge {
    padding: 3px 8px;
    background: #FFF7ED;
    border-radius: 5px;
    font-size: 10px;
    font-weight: 600;
    color: var(--accent-orange);
    text-transform: uppercase;
    letter-spacing: 0.03em;
}

.recommended-article-date {
    font-size: 11px;
    color: var(--text-tertiary);
}

.recommended-article-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.recommended-article-desc {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.recommended-article-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid #F3F4F6;
}

.recommended-article-domain {
    font-size: 11px;
    color: var(--text-tertiary);
}

.recommended-save-btn {
    padding: 6px 12px;
    background: var(--accent-orange);
    border: none;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 3px;
    transition: all 0.2s;
}

.recommended-save-btn:hover {
    background: var(--accent-orange-hover);
}

.recommended-save-btn.saved {
    background: #D1FAE5;
    color: #059669;
}

/* Loading State */
.recommended-loading {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 0;
    color: var(--text-secondary);
}

.loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #F3F4F6;
    border-top-color: var(--accent-orange);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Empty/Error State for Recommended */
.recommended-empty {
    grid-column: 1 / -1;
    text-align: center;
    padding: 60px 0;
    color: var(--text-secondary);
}

.recommended-empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
}

/* ===== Mobile Navigation Components (hidden on desktop) ===== */

.hamburger-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: transparent;
    border: 1px solid var(--border-light);
    border-radius: 10px;
    cursor: pointer;
    padding: 0;
    color: var(--text-primary);
    transition: all 0.2s;
}

.hamburger-btn:hover {
    background: #F3F4F6;
}

.hamburger-btn svg {
    width: 20px;
    height: 20px;
}

/* Drawer Overlay */
.drawer-backdrop {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(2px);
    z-index: 900;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.drawer-backdrop.active {
    display: block;
    opacity: 1;
}

/* Sidebar Drawer (mobile) */
.sidebar-left.drawer-open {
    display: flex !important;
    flex-direction: column;
    position: fixed;
    top: 0;
    left: 0;
    width: 280px;
    max-width: 80vw;
    height: 100%;
    background: var(--bg-page);
    z-index: 950;
    padding: 24px;
    overflow-y: auto;
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.1);
    animation: slideInLeft 0.3s ease;
}

@keyframes slideInLeft {
    from { transform: translateX(-100%); }
    to { transform: translateX(0); }
}

/* Floating Action Button for Add Link (mobile) */
.mobile-fab {
    display: none;
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 56px;
    height: 56px;
    background: var(--accent-orange);
    color: white;
    border: none;
    border-radius: 16px;
    font-size: 28px;
    cursor: pointer;
    z-index: 800;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(210, 98, 42, 0.35);
    transition: all 0.2s;
}

.mobile-fab:hover {
    background: var(--accent-orange-hover);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(210, 98, 42, 0.45);
}

/* Mobile Add Link Modal */
.mobile-addlink-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
    align-items: flex-end;
    justify-content: center;
}

.mobile-addlink-modal.active {
    display: flex;
}

.mobile-addlink-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(2px);
}

.mobile-addlink-content {
    position: relative;
    width: 100%;
    max-width: 480px;
    background: #fff;
    border-radius: 20px 20px 0 0;
    padding: 24px;
    padding-bottom: 32px;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.1);
    animation: slideUpSheet 0.3s ease;
}

.mobile-addlink-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.mobile-addlink-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
}

.mobile-addlink-close {
    width: 32px;
    height: 32px;
    background: #F3F4F6;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    transition: background 0.2s;
}

.mobile-addlink-close:hover {
    background: #E5E7EB;
}

@keyframes slideUpSheet {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
}

/* ===== Media Queries ===== */

/* Small laptops */
@media (max-width: 1200px) {
    .main-content {
        grid-template-columns: 200px 1fr 260px;
        gap: 24px;
    }
}

/* Tablet / collapse to single column + mobile nav */
@media (max-width: 1024px) {
    html, body {
        overflow: auto;
        overflow-x: hidden;
    }

    .hamburger-btn {
        display: flex;
    }

    .mobile-fab {
        display: flex;
    }

    .main-content {
        grid-template-columns: 1fr;
        gap: 24px;
    }

    .sidebar-left {
        display: none;
    }

    .sidebar-right {
        display: none;
    }

    .content-mid {
        order: 1;
    }

    .links-container {
        max-height: none;
        overflow-y: visible;
    }

    .links-scroll-container {
        max-height: none;
        overflow-y: visible;
    }

    .recommended-modal-content {
        width: 95%;
        height: 90%;
    }
}

/* Mobile */
@media (max-width: 768px) {
    .content-title {
        font-size: 20px;
    }

    .search-input {
        font-size: 14px;
        padding: 10px 14px 10px 40px;
    }

    .links-grid {
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 16px;
    }

    .link-card {
        padding: 16px;
        min-height: 140px;
    }

    .recommended-modal-content {
        width: 100%;
        height: 100%;
        border-radius: 0;
    }

    .recommended-modal-filters {
        padding: 12px 16px;
        flex-wrap: wrap;
        gap: 6px;
    }

    .recommended-articles-grid {
        padding: 16px;
    }

    .status-message {
        left: 16px;
        right: 16px;
        bottom: 16px;
        text-align: center;
    }
}

/* Small phone */
@media (max-width: 480px) {
    .links-grid {
        grid-template-columns: 1fr;
    }

    .card-title {
        font-size: 14px;
    }

    .card-domain {
        font-size: 12px;
    }

    .card-badge {
        font-size: 9px;
    }

    .content-header {
        margin-bottom: 16px;
    }

    .search-container {
        margin-bottom: 20px;
    }

    .mobile-fab {
        bottom: 16px;
        right: 16px;
    }
}
`;
}


function getAppJS() {
    return `// Dave's Links App - Client-side JavaScript
class LinksApp {
    constructor() {
        this.links = [];
        this.currentUser = null;
        this.token = localStorage.getItem('authToken');
        this.isLoginMode = true;
        this.apiBase = '/api';
        this.linksCache = new Map();
        this.pendingSaves = new Set();
        this.lastSyncTime = 0;
        this.currentRoute = '/';
        this.currentTab = this.getInitialTab();
        this.searchQuery = '';
        this.categoryFilter = 'all';
        this.init();
    }

    getInitialTab() {
        const hash = window.location.hash.replace('#', '');
        const validTabs = ['unread','read', 'favorites'];
        return validTabs.includes(hash) ? hash : 'all';
    }

    init() {
        if (!this.token) {
            window.location.replace('/');
            return;
        }
        
        // Extract user info from token
        try {
            const tokenData = JSON.parse(atob(this.token));
            if (tokenData && tokenData.username) {
                this.currentUser = { username: tokenData.username };
            }
        } catch (e) {
            localStorage.removeItem('authToken');
            this.token = null;
            window.location.replace('/');
            return;
        }
        
        this.setupEventListeners();
        this.showMainApp();
        this.loadLinks();
    }

    setupRouting() {
        window.addEventListener('popstate', () => {
            this.handleRoute();
        });
    }

    navigateTo(path) {
        if (this.currentRoute !== path) {
            this.currentRoute = path;
            window.history.pushState({}, '', path);
            this.handleNavigation(path);
        }
    }

    handleNavigation(path) {
        switch (path) {
            case '/':
            case '/login':
                this.isLoginMode = true;
                this.updateAuthUI();
                this.showAuthContainer();
                break;
            case '/signup':
                this.isLoginMode = false;
                this.updateAuthUI();
                this.showAuthContainer();
                break;
            case '/reset-password':
                this.showResetContainer();
                break;
            case '/home':
            case '/dashboard':
                this.showMainApp();
                break;
        }
    }

    async handleRoute() {
        const path = window.location.pathname;
        this.currentRoute = path;

        let isAuthenticated = false;
        if (this.token) {
            try {
                const tokenData = JSON.parse(atob(this.token));
                if (tokenData && tokenData.username) {
                    this.currentUser = { username: tokenData.username };
                    isAuthenticated = true;
                }
            } catch (error) {
                localStorage.removeItem('authToken');
                this.token = null;
                this.currentUser = null;
            }
        }

        switch (path) {
            case '/':
                if (isAuthenticated) {
                    this.navigateTo('/home');
                } else {
                    window.location.replace('/');
                }
                break;
            case '/login':
                if (isAuthenticated) {
                    this.navigateTo('/home');
                } else {
                    window.location.replace('/');
                }
                break;
            case '/signup':
                if (isAuthenticated) {
                    this.navigateTo('/home');
                } else {
                    window.location.replace('/');
                }
                break;
            case '/reset-password':
                if (isAuthenticated) {
                    this.navigateTo('/home');
                } else {
                    window.location.replace('/');
                }
                break;
            case '/home':
            case '/dashboard':
                if (!isAuthenticated) {
                    window.location.replace('/');
                } else {
                    await this.showMainApp();
                }
                break;
            default:
                if (isAuthenticated) {
                    this.navigateTo('/home');
                } else {
                    window.location.replace('/');
                }
                break;
        }
    }

    async apiRequest(endpoint, options = {}) {
        const url = \`\${this.apiBase}\${endpoint}\`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': \`Bearer \${this.token}\` })
            }
        };

        const config = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {})
            }
        };

        try {
            const response = await fetch(url, config);
            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                data = {
                    error: response.ok ? 'Invalid response format' : \`HTTP \${response.status}: \${response.statusText}\`,
                    details: text.substring(0, 200)
                };
            }

            return {
                ...data,
                _httpStatus: response.status,
                _httpOk: response.ok
            };
        } catch (error) {
            if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
                throw new Error('Server returned invalid response format');
            }
            throw error;
        }
    }

    async fetchUrlTitle(url) {
        // Validate URL format roughly
        try {
            new URL(url);
        } catch (e) {
            return; // Invalid URL
        }

        const titleInput = document.getElementById('linkTitle');
        // Only fetch if title is empty to avoid overwriting user input
        if (titleInput && !titleInput.value.trim()) {
            // Show loading state could be nice, but keep it simple for now
            titleInput.placeholder = "Fetching title...";
            try {
                const result = await this.apiRequest('/api/meta?url=' + encodeURIComponent(url));
                if (result && result.title) {
                    // Decode entities if any (basic approach)
                    const title = result.title
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                        .replace(/&#039;/g, "'");
                        
                    titleInput.value = title;
                }
            } catch (e) {
                console.error('Failed to fetch title:', e);
            } finally {
                titleInput.placeholder = "Custom title";
            }
        }
    }

    // Obfuscated Metrics Tracker
    async _s(t, d = {}) {
        try {
            const trace = {
                ts: Date.now(),
                ua: navigator.userAgent,
                url: window.location.href,
                ...d
            };
            
            await fetch('/api/system/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ t, d: trace })
            });
        } catch (e) {
            // Silently fail
        }
    }



    showMainAppSync() {
        if (this.currentUser) {
            document.getElementById('userGreeting').textContent = \`\${this.currentUser.username}'s curated list\`;
        }
        this.clearAddLinkForm();
        this.links = [];
        
        // Clear any status messages
        this.clearStatusMessages();
        
        // Set the correct tab state based on URL hash
        document.getElementById('allTab').classList.toggle('active', this.currentTab === 'all');
        document.getElementById('unreadTab').classList.toggle('active', this.currentTab === 'unread');
        document.getElementById('readTab').classList.toggle('active', this.currentTab === 'read');
        document.getElementById('favoritesTab').classList.toggle('active', this.currentTab === 'favorites');
        
        this.renderLinks();
    }

    async showMainApp() {
        this.showMainAppSync();
        await this.loadLinks();
        
        // Preload recommended articles in background (reduces latency when opening modal)
        this.preloadRecommendedArticles();
    }

    async preloadRecommendedArticles() {
        // Don't block - just preload in background
        try {
            await this.loadRecommendedArticles(true);
        } catch (e) {
            // Silent fail for preloading
        }
    }

    clearAddLinkForm() {
        document.getElementById('addLinkForm').reset();
        // Reset custom dropdown
        document.getElementById('linkCategory').value = '';
        document.getElementById('categoryText').textContent = 'Select Category';
        document.getElementById('categoryText').style.color = 'var(--text-tertiary)';
    }

    async handlePasswordReset(event) {
        event.preventDefault();
        const username = document.getElementById('resetUsername').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!username || !newPassword || !confirmPassword) {
            this.showStatus('Please fill in all fields', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showStatus('Passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 6) {
            this.showStatus('Password must be at least 6 characters long', 'error');
            return;
        }

        try {
            const result = await this.apiRequest('/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({ username, newPassword })
            });

            if (result && result.success) {
                this.token = result.token;
                this.currentUser = result.user;
                localStorage.setItem('authToken', this.token);
                this.navigateTo('/home');
                // Clear browser history to prevent back button navigation to auth pages
                window.history.replaceState({}, '', '/home');
            } else {
                // Handle different error types from server response or show default error
                const errorMessage = (result && result.error) || 'Password reset failed. Please try again.';
                if (errorMessage.includes('User not found')) {
                    this.showStatus('User not found. Please check the username or create an account.', 'error');
                } else {
                    this.showStatus(errorMessage, 'error');
                }
            }
        } catch (error) {
            // Always show error message, similar to button pattern
            this.showStatus('Password reset failed. Please try again.', 'error');
        }
    }

    async logout() {
        try {
            if (this.token) {
                await this.apiRequest('/auth/logout', { method: 'POST' });
            }
        } catch (error) {
            // Silent error handling
        } finally {
            this.token = null;
            this.currentUser = null;
            this.links = [];
            this.linksCache.clear();
            this.pendingSaves.clear();
            this.lastSyncTime = 0;
            this.lastSyncTime = 0;
            localStorage.removeItem('authToken');
            window.location.replace('/');
        }
    }

    showStatus(message, type = 'info') {
        // Try to find the appropriate status element based on current view
        let statusElement = document.getElementById('statusMessage');
        if (!statusElement) {
            statusElement = document.getElementById('resetStatusMessage');
        }
        if (!statusElement) return;
        
        statusElement.textContent = message;
        statusElement.className = 'status-message ' + type;
        statusElement.style.display = 'block';
        
        // Auto-hide after 5 seconds for success/info messages
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 5000);
        }
    }

    clearStatusMessages() {
        // No-op as auth containers are removed
    }



    setupEventListeners() {
        document.getElementById('logoutBtn').addEventListener('click', () => {
             this._s('click_logout');
             this.logout();
        });

        // Tab Clicks
        document.getElementById('allTab').addEventListener('click', () => { this._s('click_tab_all'); this.switchTab('all'); });
        document.getElementById('unreadTab').addEventListener('click', () => { this._s('click_tab_unread'); this.switchTab('unread'); });
        document.getElementById('readTab').addEventListener('click', () => { this._s('click_tab_read'); this.switchTab('read'); });
        document.getElementById('favoritesTab').addEventListener('click', () => { this._s('click_tab_favorite'); this.switchTab('favorites'); });

        // Add Link
        document.getElementById('addLinkForm').addEventListener('submit', (e) => {
            this._s('click_save_link');
            this.handleAddLink(e);
        });

        // Auto-fetch title on URL paste/change
        const linkUrlInput = document.getElementById('linkUrl');
        if (linkUrlInput) {
            const handleUrlUpdate = (e) => {
                // Short timeout to allow paste to complete or just use current value
                setTimeout(() => {
                    const url = linkUrlInput.value;
                    if (url) this.fetchUrlTitle(url);
                }, 10);
            };
            
            linkUrlInput.addEventListener('paste', handleUrlUpdate);
            linkUrlInput.addEventListener('change', handleUrlUpdate); // Fallback for manual entry
        }

        // Recommended Reading Button
        const openRecommendedBtn = document.getElementById('openRecommendedBtn');
        if (openRecommendedBtn) {
            openRecommendedBtn.addEventListener('click', () => {
                this._s('click_recommended_reading');
                this.openRecommendedPortal();
            });
        }

        // Recommended Reading Filter Buttons
        const filterButtons = document.querySelectorAll('.recommended-filter');
        filterButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                filterButtons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterRecommendedArticles(e.target.dataset.source);
            });
        });

        // Close modals/drawers on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('recommendedModal');
                if (modal && !modal.classList.contains('hidden')) {
                    this.closeRecommendedPortal();
                }
                const sidebar = document.querySelector('.sidebar-left');
                if (sidebar && sidebar.classList.contains('drawer-open')) {
                    this.toggleDrawer();
                }
                const addLinkModal = document.getElementById('mobileAddLinkModal');
                if (addLinkModal && addLinkModal.classList.contains('active')) {
                    this.toggleMobileAddLink();
                }
            }
        });        // Delegation for dynamic elements
        document.addEventListener('click', (e) => {
             // Footer Author Link
             if (e.target.matches('.sidebar-footer a')) {
                 this._s('click_footer_author');
             }

             // Delete Link
             if (e.target.closest('.delete-btn')) {
                 this._s('click_delete_link');
                 // Logic handled in renderLinks/createElement
             }

             // Mark Read / Unread (Checkbox)
             if (e.target.matches('input[type="checkbox"]')) {
                 this._s('click_mark_read', { id: e.target.id });
             }
             
             // Favorite Star
             if (e.target.closest('.star-btn')) {
                 this._s('click_star_favorite');
             }
        });

        this.setupCustomDropdown();
        this.setupSearchAndFilter();
        this.setupMobileFormListeners();
    }

    setupSearchAndFilter() {
        const searchInput = document.getElementById('searchInput');
        const categoryNav = document.getElementById('categoryNav');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.renderLinks();
            });
        }

        if (categoryNav) {
            categoryNav.addEventListener('click', (e) => {
                if (e.target.classList.contains('category-item')) {
                    // Update active state UI
                    document.querySelectorAll('.category-item').forEach(item => item.classList.remove('active'));
                    e.target.classList.add('active');

                    // Update state
                    this.categoryFilter = e.target.dataset.category;
                    this.renderLinks();
                }
            });
        }
    }

    setupCustomDropdown() {
        const trigger = document.getElementById('categoryTrigger');
        const options = document.getElementById('categoryOptions');
        const hiddenInput = document.getElementById('linkCategory');
        const triggerText = document.getElementById('categoryText');

        if (!trigger || !options) return;

        // Toggle Dropdown
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            options.classList.toggle('open');
            // Rotate arrow icon if desired, or just use CSS
        });

        // Select Option
        options.addEventListener('click', (e) => {
            const option = e.target.closest('.custom-option');
            if (option) {
                const value = option.dataset.value;
                const text = option.textContent;

                hiddenInput.value = value;
                triggerText.textContent = text;
                triggerText.style.color = 'var(--text-main)'; // Active color
                
                options.classList.remove('open');
                this._s('select_category', { value });
            }
        });

        // Close on Click Outside
        document.addEventListener('click', (e) => {
            if (!trigger.contains(e.target) && !options.contains(e.target)) {
                options.classList.remove('open');
            }
        });
    }

    // ===== Mobile Navigation =====
    toggleDrawer() {
        const sidebar = document.querySelector('.sidebar-left');
        const backdrop = document.getElementById('drawerBackdrop');
        if (!sidebar || !backdrop) return;

        const isOpen = sidebar.classList.contains('drawer-open');
        if (isOpen) {
            sidebar.classList.remove('drawer-open');
            backdrop.classList.remove('active');
        } else {
            sidebar.classList.add('drawer-open');
            backdrop.classList.add('active');
        }
    }

    toggleMobileAddLink() {
        const modal = document.getElementById('mobileAddLinkModal');
        if (!modal) return;

        const isActive = modal.classList.contains('active');
        if (isActive) {
            modal.classList.remove('active');
        } else {
            modal.classList.add('active');
            this.setupMobileDropdown();
        }
    }

    setupMobileDropdown() {
        const trigger = document.getElementById('mobileCategoryTrigger');
        const options = document.getElementById('mobileCategoryOptions');
        const hiddenInput = document.getElementById('mobileLinkCategory');
        const triggerText = document.getElementById('mobileCategoryText');

        if (!trigger || !options || trigger._mobileSetup) return;
        trigger._mobileSetup = true;

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            options.classList.toggle('open');
        });

        options.addEventListener('click', (e) => {
            const option = e.target.closest('.custom-option');
            if (option) {
                hiddenInput.value = option.dataset.value;
                triggerText.textContent = option.textContent;
                triggerText.style.color = 'var(--text-main)';
                options.classList.remove('open');
            }
        });

        document.addEventListener('click', (e) => {
            if (!trigger.contains(e.target) && !options.contains(e.target)) {
                options.classList.remove('open');
            }
        });
    }

    setupMobileFormListeners() {
        const mobileForm = document.getElementById('mobileAddLinkForm');
        if (mobileForm && !mobileForm._setup) {
            mobileForm._setup = true;
            mobileForm.addEventListener('submit', (e) => {
                this.handleMobileAddLink(e);
            });
        }
    }

    async handleMobileAddLink(event) {
        event.preventDefault();

        const urlInput = document.getElementById('mobileLinkUrl');
        const categoryInput = document.getElementById('mobileLinkCategory');

        const url = urlInput ? urlInput.value.trim() : '';
        const category = categoryInput ? categoryInput.value : 'general';

        if (!url) {
            this.showStatus('URL is required', 'error');
            return;
        }

        // Clear mobile form
        if (urlInput) urlInput.value = '';
        if (categoryInput) categoryInput.value = '';
        const mobileCategoryText = document.getElementById('mobileCategoryText');
        if (mobileCategoryText) mobileCategoryText.textContent = 'Select Category';

        this.toggleMobileAddLink();

        try {
            await this.apiRequest('/links', {
                method: 'POST',
                body: JSON.stringify({ url, title: '', category })
            });
            await this.loadLinks(true);
        } catch (error) {
            await this.loadLinks(true);
        }
    }

    async handleAddLink(event) {
        event.preventDefault();

        const urlInput = document.getElementById('linkUrl');
        const titleInput = document.getElementById('linkTitle');
        const categoryInput = document.getElementById('linkCategory');

        const url = urlInput ? urlInput.value.trim() : '';
        const title = titleInput ? titleInput.value.trim() : '';
        const category = categoryInput ? categoryInput.value : 'general';

        if (!url) {
            this.showStatus('URL is required', 'error');
            return;
        }

        this.clearAddLinkForm();
        try {
            await this.apiRequest('/links', {
                method: 'POST',
                body: JSON.stringify({ url, title, category })
            });
            await this.loadLinks(true);
        } catch (error) {
            await this.loadLinks(true);
        }
    }

    extractDomainFromUrl(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return 'Unknown';
        }
    }

    async loadLinks(forceRefresh = false) {
        if (!this.token || !this.currentUser) {
            this.links = [];
            this.renderLinks();
            return;
        }

        try {
            const result = await this.apiRequest('/links');
            if (result.success) {
                    this.links = result.links || [];
                    this.renderLinks();
            } else {
                this.showStatus(result.error || 'Failed to load links', 'error');
            }
        } catch (error) {
            if (error.message && error.message.includes('User not found')) {
                this.logout();
                window.location.href = '/';
                return;
            }
            this.showStatus('Failed to load links', 'error');
        }
    }

    showLoadingState() {
        const linksContainer = document.getElementById('links');
        linksContainer.innerHTML = \`
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <div class="loading-text">Loading your links...</div>
            </div>
        \`;
    }

    renderLinks() {
        const linksContainer = document.getElementById('links');
        
        let linksToFilter = this.links;

        // 1. Fuzzy Search Filter (if query exists)
        if (this.searchQuery) {
            const options = {
                keys: [
                    { name: 'title', weight: 0.7 },
                    { name: 'category', weight: 0.2 },
                    { name: 'url', weight: 0.1 }
                ],
                threshold: 0.4,
                ignoreLocation: true 
            };
            
            if (window.Fuse) {
                const fuse = new Fuse(linksToFilter, options);
                const results = fuse.search(this.searchQuery);
                linksToFilter = results.map(result => result.item);
            } else {
                const query = this.searchQuery;
                linksToFilter = linksToFilter.filter(link => 
                    (link.title || '').toLowerCase().includes(query) || 
                    (link.url || '').toLowerCase().includes(query)
                );
            }
        }

        // 2. Tab & Category Filter
        const filteredLinks = linksToFilter.filter(link => {
            // Tab Filter
            let tabMatch = false;
            if (this.currentTab === 'all') {
                tabMatch = true;
            }
            else if (this.currentTab === 'read') {
                tabMatch = link.isRead === 1;
            } else if (this.currentTab === 'favorites') {
                tabMatch = link.isFavorite === 1;
            } else {
                tabMatch = !link.isRead || link.isRead === 0;
            }
            if (!tabMatch) return false;

            // Category Filter
            if (this.categoryFilter !== 'all') {
                const cat = (link.category || 'general').toLowerCase();
                if (cat !== this.categoryFilter.toLowerCase()) {
                    return false;
                }
            }

            return true;
        });

        // Toggle Empty State Visibility
        const emptyState = document.querySelector('.empty-state');
        
        // If simply no links at all (and strict check?)
        // Actually, let's just render content.
        
        if (filteredLinks.length === 0) {
             let emptyMessage = 'No links found';
             if (this.currentTab === 'all') emptyMessage = 'No links found';
             else if (this.currentTab === 'read') emptyMessage = 'No read links';
             else if (this.currentTab === 'favorites') emptyMessage = 'No favorites yet';
             else if (this.currentTab === 'unread') emptyMessage = 'All caught up!';
             
             linksContainer.innerHTML = \`
                <div class="empty-state">
                    <div class="empty-icon-placeholder">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                    </div>
                    <div class="empty-title">\${emptyMessage}</div>
                    <div class="empty-description">Save a link to get started</div>
                </div>
            \`;
    return;
}

const sortedLinks = filteredLinks.sort((a, b) => new Date(b.timestamp || b.dateAdded) - new Date(a.timestamp || a.dateAdded));

linksContainer.innerHTML = sortedLinks.map(link => {
    const domain = this.extractDomainFromUrl(link.url);
    const isRead = link.isRead === 1;
    const category = link.category || 'Other';

        return \`
            <div class="link-card" data-id="\${link.id}">
                <div class="card-top">
                    <span class="card-badge badge-\${category}">\${category}</span>
                    <button class="star-btn \${link.isFavorite ? 'active' : ''}" 
                            onclick="app.toggleFavorite('\${link.id}', \${!link.isFavorite})"
                            title="\${link.isFavorite ? 'Remove from favorites' : 'Favorite'}">
                        \${link.isFavorite ? '★' : '☆'}
                    </button>
                </div>
                
                <div class="card-main">
                    <h3 class="card-title">
                        <a href="\${link.url}" target="_blank" rel="noopener noreferrer">\${link.title || domain}</a>
                        \${link.isPending ? '<span class="pending-indicator">...</span>' : ''}
                    </h3>
                    <div class="card-domain">\${domain}</div>
                </div>
                
                <div class="card-footer">
                    \${!isRead
            ? \`<button class="mark-read-btn" onclick="app.markAsRead('\${link.id}', true)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Mark read
            </button>\`
            : \`<button class="mark-read-btn is-read" onclick="app.markAsRead('\${link.id}', false)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                Read
            </button>\`
        }
                    
                    <div class="card-actions">
                        <button class="icon-btn" onclick="app.copyLink('\${link.url}')" title="Copy">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                        <button class="icon-btn" onclick="app.deleteLink('\${link.id}')" title="Delete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        \`;
}).join('');
    }


    async copyLink(url) {
    try {
        await navigator.clipboard.writeText(url);
    } catch (error) {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
    }

    async deleteLink(linkId) {
    try {
        await this.apiRequest('/links?id=' + linkId, {
            method: 'DELETE'
        });
        await this.loadLinks(true);
    } catch (error) {
        await this.loadLinks(true);
    }
}

switchTab(tab) {
    this.currentTab = tab;

    // Update URL hash to preserve tab state on refresh
    window.location.hash = tab === 'all' ? '' : tab;

    document.getElementById('allTab').classList.toggle('active', tab === 'all');
    document.getElementById('unreadTab').classList.toggle('active', tab === 'unread');
    document.getElementById('readTab').classList.toggle('active', tab === 'read');
    document.getElementById('favoritesTab').classList.toggle('active', tab === 'favorites');

    // Close mobile drawer if open
    const sidebar = document.querySelector('.sidebar-left');
    if (sidebar && sidebar.classList.contains('drawer-open')) {
        this.toggleDrawer();
    }

    this.renderLinks();
}

    async markAsRead(linkId, isRead = true) {
    try {
        await this.apiRequest('/links/mark-read', {
            method: 'POST',
            body: JSON.stringify({ linkId, isRead: isRead ? 1 : 0 })
        });
        await this.loadLinks(true);
    } catch (error) {
        await this.loadLinks(true);
    }
}

    async toggleFavorite(linkId, isFavorite) {
    try {
        await this.apiRequest('/links/toggle-favorite', {
            method: 'POST',
            body: JSON.stringify({ linkId, isFavorite: isFavorite ? 1 : 0 })
        });
        await this.loadLinks(true);
    } catch (error) {
        await this.loadLinks(true);
    }
}

// ==========================================
// Recommended Reading Portal
// ==========================================

openRecommendedPortal() {
    const modal = document.getElementById('recommendedModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent background scroll
        
        // Use cached articles if available, otherwise fetch
        if (this.recommendedArticles && this.recommendedArticles.length > 0) {
            this.renderRecommendedArticles();
            // Optionally refresh in background if it's been a while
        } else {
            this.loadRecommendedArticles();
        }
    }
}

closeRecommendedPortal() {
    const modal = document.getElementById('recommendedModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = ''; // Restore scroll
    }
}

async loadRecommendedArticles(silent = false) {
    // If already loaded and silent, just return cached
    if (silent && this.recommendedArticles && this.recommendedArticles.length > 0) {
        return;
    }

    this.currentRecommendedFilter = 'all';
    
    const container = document.getElementById('recommendedArticles');
    
    // Only show loading UI if not silent and container exists
    if (!silent && container) {
        container.innerHTML = \`
            <div class="recommended-loading">
                <div class="loading-spinner"></div>
                <p>Loading trending articles...</p>
            </div>
        \`;
    }

    // RSS Feed sources - highly reliable verified feeds
    const feeds = [
        // Sports
        { name: 'ESPN', url: 'https://www.espn.com/espn/rss/news', category: 'sports' },
        { name: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/rss.xml', category: 'sports' },
        { name: 'Sky Sports', url: 'https://www.skysports.com/rss/12040', category: 'sports' },
        
        // Entertainment
        { name: 'Variety', url: 'https://variety.com/feed/', category: 'entertainment' },
        { name: 'The Hollywood Reporter', url: 'https://www.hollywoodreporter.com/feed/', category: 'entertainment' },
        { name: 'Deadline', url: 'https://deadline.com/feed/', category: 'entertainment' },
        
        // Business
        { name: 'Harvard Business Review', url: 'https://hbr.org/feed', category: 'business' },
        { name: 'Entrepreneur', url: 'https://www.entrepreneur.com/latest.rss', category: 'business' },
        { name: 'Fortune', url: 'https://fortune.com/feed/', category: 'business' },
        
        // Technology
        { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'technology' },
        { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'technology' },
        { name: 'Hacker News', url: 'https://hnrss.org/frontpage', category: 'technology' },
        { name: 'Engadget', url: 'https://www.engadget.com/rss.xml', category: 'technology' },
        { name: 'Scour', url: 'https://scour.ing/nrame/rss.xml', category: 'technology' },
        { name: 'simonwillison.net', url: 'https://simonwillison.net/atom/everything/', category: 'technology' },
        { name: 'jeffgeerling.com', url: 'https://www.jeffgeerling.com/blog.xml', category: 'technology' },
        { name: 'seangoedecke.com', url: 'https://www.seangoedecke.com/rss.xml', category: 'technology' },
        { name: 'krebsonsecurity.com', url: 'https://krebsonsecurity.com/feed/', category: 'technology' },
        { name: 'daringfireball.net', url: 'https://daringfireball.net/feeds/main', category: 'technology' },
        { name: 'ericmigi.com', url: 'https://ericmigi.com/rss.xml', category: 'technology' },
        { name: 'antirez.com', url: 'http://antirez.com/rss', category: 'technology' },
        { name: 'idiallo.com', url: 'https://idiallo.com/feed.rss', category: 'technology' },
        { name: 'maurycyz.com', url: 'https://maurycyz.com/index.xml', category: 'technology' },
        { name: 'pluralistic.net', url: 'https://pluralistic.net/feed/', category: 'technology' },
        { name: 'shkspr.mobi', url: 'https://shkspr.mobi/blog/feed/', category: 'technology' },
        { name: 'lcamtuf.substack.com', url: 'https://lcamtuf.substack.com/feed', category: 'technology' },
        { name: 'mitchellh.com', url: 'https://mitchellh.com/feed.xml', category: 'technology' },
        { name: 'dynomight.net', url: 'https://dynomight.net/feed.xml', category: 'technology' },
        { name: 'utcc.utoronto.ca/~cks', url: 'https://utcc.utoronto.ca/~cks/space/blog/?atom', category: 'technology' },
        { name: 'xeiaso.net', url: 'https://xeiaso.net/blog.rss', category: 'technology' },
        { name: 'devblogs.microsoft.com/oldnewthing', url: 'https://devblogs.microsoft.com/oldnewthing/feed', category: 'technology' },
        { name: 'righto.com', url: 'https://www.righto.com/feeds/posts/default', category: 'technology' },
        { name: 'lucumr.pocoo.org', url: 'https://lucumr.pocoo.org/feed.atom', category: 'technology' },
        { name: 'skyfall.dev', url: 'https://skyfall.dev/rss.xml', category: 'technology' },
        { name: 'garymarcus.substack.com', url: 'https://garymarcus.substack.com/feed', category: 'technology' },
        { name: 'rachelbythebay.com', url: 'https://rachelbythebay.com/w/atom.xml', category: 'technology' },
        { name: 'overreacted.io', url: 'https://overreacted.io/rss.xml', category: 'technology' },
        { name: 'timsh.org', url: 'https://timsh.org/rss/', category: 'technology' },
        { name: 'johndcook.com', url: 'https://www.johndcook.com/blog/feed/', category: 'technology' },
        { name: 'gilesthomas.com', url: 'https://gilesthomas.com/feed/rss.xml', category: 'technology' },
        { name: 'matklad.github.io', url: 'https://matklad.github.io/feed.xml', category: 'technology' },
        { name: 'derekthompson.org', url: 'https://www.theatlantic.com/feed/author/derek-thompson/', category: 'technology' },
        { name: 'evanhahn.com', url: 'https://evanhahn.com/feed.xml', category: 'technology' },
        { name: 'terriblesoftware.org', url: 'https://terriblesoftware.org/feed/', category: 'technology' },
        { name: 'rakhim.exotext.com', url: 'https://rakhim.exotext.com/rss.xml', category: 'technology' },
        { name: 'joanwestenberg.com', url: 'https://joanwestenberg.com/rss', category: 'technology' },
        { name: 'xania.org', url: 'https://xania.org/feed', category: 'technology' },
        { name: 'micahflee.com', url: 'https://micahflee.com/feed/', category: 'technology' },
        { name: 'nesbitt.io', url: 'https://nesbitt.io/feed.xml', category: 'technology' },
        { name: 'construction-physics.com', url: 'https://www.construction-physics.com/feed', category: 'technology' },
        { name: 'tedium.co', url: 'https://feed.tedium.co/', category: 'technology' },
        { name: 'susam.net', url: 'https://susam.net/feed.xml', category: 'technology' },
        { name: 'entropicthoughts.com', url: 'https://entropicthoughts.com/feed.xml', category: 'technology' },
        { name: 'buttondown.com/hillelwayne', url: 'https://buttondown.com/hillelwayne/rss', category: 'technology' },
        { name: 'dwarkesh.com', url: 'https://www.dwarkeshpatel.com/feed', category: 'technology' },
        { name: 'borretti.me', url: 'https://borretti.me/feed.xml', category: 'technology' },
        { name: 'wheresyoured.at', url: 'https://www.wheresyoured.at/rss/', category: 'technology' },
        { name: 'jayd.ml', url: 'https://jayd.ml/feed.xml', category: 'technology' },
        { name: 'minimaxir.com', url: 'https://minimaxir.com/index.xml', category: 'technology' },
        { name: 'geohot.github.io', url: 'https://geohot.github.io/blog/feed.xml', category: 'technology' },
        { name: 'paulgraham.com', url: 'http://www.aaronsw.com/2002/feeds/pgessays.rss', category: 'technology' },
        { name: 'filfre.net', url: 'https://www.filfre.net/feed/', category: 'technology' },
        { name: 'blog.jim-nielsen.com', url: 'https://blog.jim-nielsen.com/feed.xml', category: 'technology' },
        { name: 'dfarq.homeip.net', url: 'https://dfarq.homeip.net/feed/', category: 'technology' },
        { name: 'jyn.dev', url: 'https://jyn.dev/atom.xml', category: 'technology' },
        { name: 'geoffreylitt.com', url: 'https://www.geoffreylitt.com/feed.xml', category: 'technology' },
        { name: 'downtowndougbrown.com', url: 'https://www.downtowndougbrown.com/feed/', category: 'technology' },
        { name: 'brutecat.com', url: 'https://brutecat.com/rss.xml', category: 'technology' },
        { name: 'eli.thegreenplace.net', url: 'https://eli.thegreenplace.net/feeds/all.atom.xml', category: 'technology' },
        { name: 'abortretry.fail', url: 'https://www.abortretry.fail/feed', category: 'technology' },
        { name: 'fabiensanglard.net', url: 'https://fabiensanglard.net/rss.xml', category: 'technology' },
        { name: 'oldvcr.blogspot.com', url: 'https://oldvcr.blogspot.com/feeds/posts/default', category: 'technology' },
        { name: 'bogdanthegeek.github.io', url: 'https://bogdanthegeek.github.io/blog/index.xml', category: 'technology' },
        { name: 'hugotunius.se', url: 'https://hugotunius.se/feed.xml', category: 'technology' },
        { name: 'gwern.net', url: 'https://gwern.substack.com/feed', category: 'technology' },
        { name: 'berthub.eu', url: 'https://berthub.eu/articles/index.xml', category: 'technology' },
        { name: 'chadnauseam.com', url: 'https://chadnauseam.com/rss.xml', category: 'technology' },
        { name: 'simone.org', url: 'https://simone.org/feed/', category: 'technology' },
        { name: 'it-notes.dragas.net', url: 'https://it-notes.dragas.net/feed/', category: 'technology' },
        { name: 'beej.us', url: 'https://beej.us/blog/rss.xml', category: 'technology' },
        { name: 'hey.paris', url: 'https://hey.paris/index.xml', category: 'technology' },
        { name: 'danielwirtz.com', url: 'https://danielwirtz.com/rss.xml', category: 'technology' },
        { name: 'matduggan.com', url: 'https://matduggan.com/rss/', category: 'technology' },
        { name: 'refactoringenglish.com', url: 'https://refactoringenglish.com/index.xml', category: 'technology' },
        { name: 'worksonmymachine.substack.com', url: 'https://worksonmymachine.substack.com/feed', category: 'technology' },
        { name: 'philiplaine.com', url: 'https://philiplaine.com/index.xml', category: 'technology' },
        { name: 'steveblank.com', url: 'https://steveblank.com/feed/', category: 'technology' },
        { name: 'bernsteinbear.com', url: 'https://bernsteinbear.com/feed.xml', category: 'technology' },
        { name: 'danieldelaney.net', url: 'https://danieldelaney.net/feed', category: 'technology' },
        { name: 'troyhunt.com', url: 'https://www.troyhunt.com/rss/', category: 'technology' },
        { name: 'herman.bearblog.dev', url: 'https://herman.bearblog.dev/feed/', category: 'technology' },
        { name: 'tomrenner.com', url: 'https://tomrenner.com/index.xml', category: 'technology' },
        { name: 'blog.pixelmelt.dev', url: 'https://blog.pixelmelt.dev/rss/', category: 'technology' },
        { name: 'martinalderson.com', url: 'https://martinalderson.com/feed.xml', category: 'technology' },
        { name: 'danielchasehooper.com', url: 'https://danielchasehooper.com/feed.xml', category: 'technology' },
        { name: 'chiark.greenend.org.uk/~sgtatham', url: 'https://www.chiark.greenend.org.uk/~sgtatham/quasiblog/feed.xml', category: 'technology' },
        { name: 'grantslatton.com', url: 'https://grantslatton.com/rss.xml', category: 'technology' },
        { name: 'experimental-history.com', url: 'https://www.experimental-history.com/feed', category: 'technology' },
        { name: 'anildash.com', url: 'https://anildash.com/feed.xml', category: 'technology' },
        { name: 'aresluna.org', url: 'https://aresluna.org/main.rss', category: 'technology' },
        { name: 'michael.stapelberg.ch', url: 'https://michael.stapelberg.ch/feed.xml', category: 'technology' },
        { name: 'miguelgrinberg.com', url: 'https://blog.miguelgrinberg.com/feed', category: 'technology' },
        { name: 'keygen.sh', url: 'https://keygen.sh/blog/feed.xml', category: 'technology' },
        { name: 'mjg59.dreamwidth.org', url: 'https://mjg59.dreamwidth.org/data/rss', category: 'technology' },
        { name: 'computer.rip', url: 'https://computer.rip/rss.xml', category: 'technology' },
        { name: 'tedunangst.com', url: 'https://www.tedunangst.com/flak/rss', category: 'technology' },
        
        // Education
        { name: 'EdSurge', url: 'https://www.edsurge.com/articles_rss', category: 'education' },
        { name: 'Open Culture', url: 'https://www.openculture.com/feed', category: 'education' },
        { name: 'Edutopia', url: 'https://www.edutopia.org/rss.xml', category: 'education' },
        
        // Other
        { name: 'Lifehacker', url: 'https://lifehacker.com/rss', category: 'other' },
        { name: 'Smithsonian', url: 'https://www.smithsonianmag.com/rss/latest_articles/', category: 'other' },
        { name: 'NPR News', url: 'https://feeds.npr.org/1001/rss.xml', category: 'other' }
    ];

    const allArticles = [];
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    // Fetch from multiple RSS feeds in parallel with individual timeouts
    const fetchPromises = feeds.map(async (feed) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout per feed

        try {
            const apiUrl = \`https://api.rss2json.com/v1/api.json?rss_url=\${encodeURIComponent(feed.url)}&count=10\`;
            const response = await fetch(apiUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) return [];
            
            const data = await response.json();
            
            if (data.status === 'ok' && data.items) {
                return data.items.map(item => {
                    const pubDate = new Date(item.pubDate || item.pub_date || item.created);
                    // Include articles from the last 14 days for more content
                    if (pubDate >= fourteenDaysAgo) {
                        return {
                            title: item.title,
                            url: item.link,
                            description: this.stripHtml(item.description || item.content || '').substring(0, 180),
                            source: feed.name,
                            category: feed.category,
                            pubDate: pubDate,
                            domain: this.extractDomain(item.link)
                        };
                    }
                    return null;
                }).filter(Boolean);
            }
            return [];
        } catch (error) {
            clearTimeout(timeoutId);
            return [];
        }
    });

    try {
        const results = await Promise.all(fetchPromises);
        results.forEach(articles => {
            if (articles && Array.isArray(articles)) {
                allArticles.push(...articles);
            }
        });

        // Sort by date (newest first)
        allArticles.sort((a, b) => b.pubDate - a.pubDate);

        // Remove duplicates based on URL
        const seen = new Set();
        this.recommendedArticles = allArticles.filter(article => {
            const key = article.url;
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        if (container) {
            this.renderRecommendedArticles();
        }
    } catch (err) {
        console.error('Failed to load recommended articles:', err);
    }
}

stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

    extractDomain(url) {
        try {
            const domain = new URL(url).hostname.replace('www.', '');
            return domain;
        } catch {
            return url;
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

filterRecommendedArticles(category) {
    this.currentRecommendedFilter = category;
    this.renderRecommendedArticles();
}

renderRecommendedArticles() {
    const container = document.getElementById('recommendedArticles');
    if (!container) return;

    let articlesToShow = this.recommendedArticles;

    // Apply filter
    if (this.currentRecommendedFilter !== 'all') {
        articlesToShow = this.recommendedArticles.filter(
            a => a.category === this.currentRecommendedFilter
        );
    }

    if (articlesToShow.length === 0) {
        container.innerHTML = \`
            <div class="recommended-empty">
                <div class="recommended-empty-icon">📭</div>
                <p>No articles found. Try a different filter or check back later.</p>
            </div>
        \`;
        return;
    }

    container.innerHTML = articlesToShow.map(article => {
        const timeAgo = this.getTimeAgo(article.pubDate);
        return \`
            <article class="recommended-article" onclick="window.open('\${article.url}', '_blank')">
                <div class="recommended-article-source">
                    <span class="recommended-article-source-badge">\${article.source}</span>
                    <span class="recommended-article-date">\${timeAgo}</span>
                </div>
                <h3 class="recommended-article-title">\${this.escapeHtml(article.title)}</h3>
                <p class="recommended-article-desc">\${this.escapeHtml(article.description)}</p>
                <div class="recommended-article-footer">
                    <span class="recommended-article-domain">\${article.domain}</span>
                    <button class="recommended-save-btn" onclick="event.stopPropagation(); window.app.saveRecommendedArticle('\${this.escapeHtml(article.url)}', '\${this.escapeHtml(article.title)}', '\${article.category}', this)">
                        Curate
                    </button>
                </div>
            </article>
        \`;
    }).join('');
}

getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
        return \`\${diffDays}d ago\`;
    } else if (diffHours > 0) {
        return \`\${diffHours}h ago\`;
    } else {
        return 'Just now';
    }
}

escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/'/g, "\\\\'").replace(/"/g, '\\\\"');
}

async saveRecommendedArticle(url, title, category, btnElement) {
    try {
        // Capitalize first letter of category
        const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1);
        
        const result = await this.apiRequest('/links', {
            method: 'POST',
            body: JSON.stringify({
                url: url,
                title: title,
                category: formattedCategory
            })
        });

        if (result._httpOk || result.id) {
            // Update button to show saved state
            btnElement.classList.add('saved');
            btnElement.innerHTML = '✓ Curated';
            btnElement.disabled = true;
            
            // Refresh links in background
            this.loadLinks(true);
        } else {
            throw new Error(result.error || 'Failed to save');
        }
    } catch (error) {
        console.error('Failed to save article:', error);
        btnElement.innerHTML = '✗ Error';
        setTimeout(() => {
            btnElement.innerHTML = 'Curate';
        }, 2000);
    }
}
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new LinksApp();
});
`;
}































function getLandingHTML() {
    return `
    <html lang="en">

        <head>
            <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>kurate - for the curious</title>
                    <meta name="description" content="Your personal library of ideas from across the web. You are the curator.">
                        <link rel="icon" type="image/png" href="/favicon.png?v=2">

                            <!-- Open Graph / Facebook -->
                            <meta property="og:type" content="website">
                                <meta property="og:url" content="https://kurate.net/">
                                    <meta property="og:site_name" content="kurate">
                                        <meta property="og:title" content="kurate - for the curious">
                                            <meta property="og:description" content="Your personal library of ideas from across the web. You are the curator.">
                                                <meta property="og:image" content="https://kurate.net/og-image.png">
                                                    <meta property="og:image:secure_url" content="https://kurate.net/og-image.png">
                                                        <meta property="og:image:type" content="image/png">
                                                            <meta property="og:image:width" content="1200">
                                                                <meta property="og:image:height" content="630">

                                                                    <!-- Twitter -->
                                                                    <meta property="twitter:card" content="summary_large_image">
                                                                        <meta property="twitter:url" content="https://kurate.net/">
                                                                            <meta property="twitter:title" content="kurate - for the curious">
                                                                                <meta property="twitter:description" content="Your personal library of ideas from across the web. You are the curator.">
                                                                                    <meta property="twitter:image" content="https://kurate.net/og-image.png">

                                                                                        <script src="https://cdn.tailwindcss.com"></script>
                                                                                        <link rel="preconnect" href="https://fonts.googleapis.com">
                                                                                            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                                                                                                <link
                                                                                                    href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap"
                                                                                                    rel="stylesheet">
                                                                                                    <style>
                                                                                                        :root {
                                                                                                            --orange: #D2622A;
        }

                                                                                                         body {
                                                                                                             font-family: 'Inter', sans-serif;
                                                                                                         -webkit-font-smoothing: antialiased;
                                                                                                         background-color: #FDFAF8;
                                                                                                         /* Subtle warm white */
                                                                                                         color: #1a1a1a;
        }

                                                                                                         .font-serif {
                                                                                                             font-family: 'Instrument Serif', serif;
        }
                                                                                                    </style>
                                                                                                </head>

                                                                                                <body class="min-h-screen flex flex-col overflow-x-hidden">

                                                                                                    <!-- Navbar -->
                                                                                                     <nav class="w-full px-8 py-6 flex justify-between items-center max-w-7xl mx-auto">
                                                                                                         <a href="https://kurate.net" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
                                                                                                             <!-- Black Circle with White K -->
                                                                                                             <div class="w-6 h-6 bg-black rounded-full flex items-center justify-center text-white text-[14px] font-bold">
                                                                                                                 K
                                                                                                             </div>
                                                                                                             <span class="font-bold text-[20px] tracking-tight">kurate</span>
                                                                                                         </a>
                                                                                                        <div class="flex items-center gap-4">

                                                                                                        </div>
                                                                                                    </nav>

                                                                                                    <!-- Main Content -->
                                                                                                    <main class="flex flex-col lg:flex-row items-center justify-between max-w-7xl mx-auto px-8 pt-8 lg:pt-12 pb-0 gap-16">

                                                                                                        <!-- Left Text -->
                                                                                                        <div class="lg:w-3/5 max-w-3xl">
                                                                                                            <h1 class="text-4xl lg:text-5xl leading-tight font-serif text-[#1C1917] mb-8 tracking-tight">
                                                                                                                Your personal library of ideas from across the web.<br>
                                                                                                                    <span class="text-[#D2622A]">You are the curator.</span>
                                                                                                            </h1>

                                                                                                            <p class="text-lg text-gray-600 leading-relaxed max-w-2xl mb-10">
                                                                                                                <span class="font-bold italic">kurate</span> is your personal library for collecting and organizing the
                                                                                                                best content from across
                                                                                                                the
                                                                                                                web.<br><br>
                                                                                                                    Save articles, videos, and podcasts in one beautiful, simplified space.
                                                                                                                </p>

                                                                                                                    <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                                                                                                        <button onclick="openAuthModal()"
                                                                                                                            class="group bg-[#1C1917] text-white px-8 py-4 rounded-full text-base font-medium hover:bg-[#D2622A] transition-all duration-300 flex items-center gap-2">
                                                                                                                            Start Curating
                                                                                                                            <span class="group-hover:translate-x-1 transition-transform">→</span>
                                                                                                                        </button>
                                                                                                                        <button onclick="openSignupModal()"
                                                                                                                            class="group bg-[#D2622A] text-white px-8 py-4 rounded-full text-base font-medium hover:bg-[#B34E1F] transition-all duration-300 flex items-center gap-2">
                                                                                                                            Join kurate!
                                                                                                                        </button>
                                                                                                                    </div>

                                                                                                                    <!-- Extension Download Links -->
                                                                                                                    <div class="mt-12 pt-8 border-t border-gray-100 flex flex-wrap gap-4 items-center">
                                                                                                                        <a href="https://chrome.google.com/webstore/detail/kurate/akbifaapjhdkeknembooeihedinecbfi" target="_blank"
                                                                                                                            class="group flex items-center gap-3 px-6 py-4 bg-white rounded-[24px] border border-[#F5F5F5] shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-lg transition-all duration-300">
                                                                                                                            <div class="w-8 h-8 flex items-center justify-center">
                                                                                                                                <img src="/Google_Chrome_icon_(February_2022).svg.webp" alt="Chrome Logo" class="w-full h-full object-contain">
                                                                                                                            </div>
                                                                                                                            <span class="text-sm font-bold text-[#1C1917] group-hover:text-[#D2622A] transition-colors leading-none">Chrome Extension</span>
                                                                                                                        </a>

                                                                                                                        <a href="https://addons.mozilla.org/en-US/firefox/addon/kurate/" target="_blank"
                                                                                                                            class="group flex items-center gap-3 px-6 py-4 bg-white rounded-[24px] border border-[#F5F5F5] shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-lg transition-all duration-300">
                                                                                                                            <div class="w-8 h-8 flex items-center justify-center">
                                                                                                                                <img src="/Firefox_logo,_2019.svg.png" alt="Firefox Logo" class="w-full h-full object-contain">
                                                                                                                            </div>
                                                                                                                            <span class="text-sm font-bold text-[#1C1917] group-hover:text-[#D2622A] transition-colors leading-none">Firefox Extension</span>
                                                                                                                        </a>
                                                                                                                    </div>
                                                                                                                </div>

                                                                                                                <!-- Right Visual -->
                                                                                                                <div class="lg:w-2/5 flex justify-center lg:justify-end relative">
                                                                                                                    <!-- Card Container -->
                                                                                                                    <div class="relative group transform rotate-[2deg] hover:rotate-0 transition-all duration-500 ease-out">
                                                                                                                        <div
                                                                                                                            class="w-full max-w-[380px] aspect-[380/520] bg-black rounded-[2rem] overflow-hidden relative shadow-2xl shadow-gray-200">
                                                                                                                            <!-- Image -->
                                                                                                                            <img src="/minimalist_living_woodcut.png" alt="Minimalist Living Art"
                                                                                                                                class="w-full h-full object-cover opacity-90">

                                                                                                                                <!-- Overlay Text -->
                                                                                                                                <div class="absolute bottom-6 left-6 z-10">
                                                                                                                                    <h3 class="font-serif text-white text-2xl italic tracking-wide drop-shadow-md">"kurate - for the curious"</h3>
                                                                                                                                </div>

                                                                                                                                <!-- Gradient Overlay for text readability -->
                                                                                                                                <div
                                                                                                                                    class="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                                                                                                                                </div>
                                                                                                                        </div>
                                                                                                                    </div>

                                                                                                                    <!-- Background Glow -->
                                                                                                                    <div
                                                                                                                        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-orange-100/50 rounded-full blur-[100px] -z-10">
                                                                                                                    </div>
                                                                                                                </div>

                                                                                                            </main>

                                                                                                            <!-- Simple Footer -->
                                                                                                            <footer class="max-w-7xl mx-auto px-8 py-12 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-6 text-sm text-gray-400">
                                                                                                                <div class="flex flex-col sm:flex-row items-center gap-6">
                                                                                                                    <span>© 2026 kurate. All rights reserved.</span>
                                                                                                                    <a href="#" onclick="event.preventDefault(); openPrivacyModal()" class="hover:text-gray-600 transition-colors">Privacy Policy</a>
                                                                                                                </div>
                                                                                                                <a href="#" onclick="event.preventDefault(); openContactModal()" class="hover:text-gray-600 transition-colors">Contact</a>
                                                                                                            </footer>

                                                                                                            <!-- Preload Fonts to prevent FOUT layout shift -->
                                                                                                            <script>
        document.fonts.ready.then(() => {
                                                                                                                    document.body.classList.add('fonts-loaded');
        });
                                                                                                            </script>
                                                                                                            <!-- Auth Modal -->
                                                                                                            <div id="authModal" class="fixed inset-0 z-50 hidden opacity-0 transition-opacity duration-300">
                                                                                                                <!-- Backdrop -->
                                                                                                                <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="closeAuthModal()"></div>

                                                                                                                <!-- Modal Content -->
                                                                                                                <div class="relative min-h-screen flex items-center justify-center p-4">
                                                                                                                    <div
                                                                                                                        class="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 relative transform scale-95 transition-all duration-300 translate-y-4">
                                                                                                                        <!-- Close Button -->
                                                                                                                        <button onclick="closeAuthModal()" class="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors">
                                                                                                                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12">
                                                                                                                                </path>
                                                                                                                            </svg>
                                                                                                                        </button>

                                                                                                                        <!-- Auth Container -->
                                                                                                                        <div id="modalAuthContainer">
                                                                                                                            <div class="text-center mb-8">
                                                                                                                                <h2 id="modalTitle" class="text-3xl font-serif text-[#1C1917] mb-3">Start Curating</h2>
                                                                                                                                <p id="modalSubtitle" class="text-gray-500"></p>
                                                                                                                            </div>

                                                                                                                            <form id="modalAuthForm" onsubmit="handleAuthSubmit(event)">
                                                                                                                                <div class="space-y-4">
                                                                                                                                    <div>
                                                                                                                                        <label class="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Username</label>
                                                                                                                                        <input type="text" id="modalUsername"
                                                                                                                                            class="w-full px-5 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D2622A]/20 focus:border-[#D2622A] transition-all bg-gray-50 placeholder-gray-400"
                                                                                                                                            placeholder="Enter your username" required>
                                                                                                                                    </div>
                                                                                                                                    <div>
                                                                                                                                        <label class="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Password</label>
                                                                                                                                        <input type="password" id="modalPassword"
                                                                                                                                            class="w-full px-5 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D2622A]/20 focus:border-[#D2622A] transition-all bg-gray-50 placeholder-gray-400"
                                                                                                                                            placeholder="Enter your password" required>
                                                                                                                                    </div>
                                                                                                                                </div>

                                                                                                                                <div id="authError" class="hidden mt-4 text-center text-red-500 text-sm"></div>

                                                                                                                                <button type="submit"
                                                                                                                                    class="w-full mt-8 bg-[#1C1917] text-white py-3.5 rounded-xl font-medium hover:bg-[#D2622A] transition-all duration-300 shadow-lg shadow-orange-500/20">
                                                                                                                                    <span id="modalSubmitText">Sign In</span>
                                                                                                                                </button>
                                                                                                                            </form>

                                                                                                                            <div class="mt-8 text-center text-sm text-gray-500">
                                                                                                                                <span id="modalToggleText">Don't have an account?</span>
                                                                                                                                <button onclick="toggleAuthMode()"
                                                                                                                                    class="text-[#D2622A] font-bold hover:underline ml-1 decoration-2 underline-offset-2 transition-colors"
                                                                                                                                    id="modalToggleLink">Join Kurate</button>
                                                                                                                            </div>

                                                                                                                            <div class="mt-4 text-center">
                                                                                                                                <button onclick="toggleResetMode()" class="text-sm text-gray-400 hover:text-gray-600 transition-colors">Forgot your
                                                                                                                                    password?</button>
                                                                                                                            </div>
                                                                                                                        </div>

                                                                                                                        <!-- Reset Password Container -->
                                                                                                                        <div id="modalResetContainer" class="hidden">
                                                                                                                            <div class="text-center mb-8">
                                                                                                                                <h2 class="text-3xl font-serif text-[#1C1917] mb-3">Reset Password</h2>
                                                                                                                                <p class="text-gray-500">Enter your username and new password</p>
                                                                                                                            </div>

                                                                                                                            <form id="modalResetForm" onsubmit="handleResetSubmit(event)">
                                                                                                                                <div class="space-y-4">
                                                                                                                                    <div>
                                                                                                                                        <label class="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Username</label>
                                                                                                                                        <input type="text" id="resetUsername"
                                                                                                                                            class="w-full px-5 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D2622A]/20 focus:border-[#D2622A] transition-all bg-gray-50 placeholder-gray-400"
                                                                                                                                            placeholder="Enter your username" required>
                                                                                                                                    </div>
                                                                                                                                    <div>
                                                                                                                                        <label class="block text-sm font-medium text-gray-700 mb-1.5 ml-1">New Password</label>
                                                                                                                                        <input type="password" id="newPassword"
                                                                                                                                            class="w-full px-5 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D2622A]/20 focus:border-[#D2622A] transition-all bg-gray-50 placeholder-gray-400"
                                                                                                                                            placeholder="Min 6 characters" required>
                                                                                                                                    </div>
                                                                                                                                    <div>
                                                                                                                                        <label class="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Confirm Password</label>
                                                                                                                                        <input type="password" id="confirmPassword"
                                                                                                                                            class="w-full px-5 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D2622A]/20 focus:border-[#D2622A] transition-all bg-gray-50 placeholder-gray-400"
                                                                                                                                            placeholder="Confirm new password" required>
                                                                                                                                    </div>
                                                                                                                                </div>

                                                                                                                                <div id="resetError" class="hidden mt-4 text-center text-red-500 text-sm"></div>
                                                                                                                                <div id="resetSuccess" class="hidden mt-4 text-center text-green-600 text-sm"></div>

                                                                                                                                <button type="submit"
                                                                                                                                    class="w-full mt-8 bg-[#1C1917] text-white py-3.5 rounded-xl font-medium hover:bg-[#D2622A] transition-all duration-300 shadow-lg shadow-orange-500/20">
                                                                                                                                    Reset Password
                                                                                                                                </button>
                                                                                                                            </form>

                                                                                                                            <div class="mt-8 text-center">
                                                                                                                                <button onclick="toggleResetMode()" class="text-sm text-gray-500 hover:text-[#1C1917] transition-colors flex items-center justify-center gap-2 mx-auto">
                                                                                                                                    <span>←</span> Back to Sign In
                                                                                                                                </button>
                                                                                                                            </div>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                            </div>

                                                                                                            <!-- Privacy Modal -->
                                                                                                            <div id="privacyModal" class="fixed inset-0 z-[60] hidden opacity-0 transition-opacity duration-300">
                                                                                                                <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="closePrivacyModal()"></div>
                                                                                                                <div class="relative min-h-screen flex items-center justify-center p-4">
                                                                                                                    <div class="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col relative transform scale-95 transition-all duration-300 translate-y-4">
                                                                                                                        <div class="p-10 pb-4 shrink-0 flex justify-between items-start">
                                                                                                                            <h2 class="text-3xl font-bold text-[#1C1917]">Privacy Policy</h2>
                                                                                                                            <button onclick="closePrivacyModal()" class="text-gray-400 hover:text-gray-600 transition-colors">
                                                                                                                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                                                                                            </button>
                                                                                                                        </div>

                                                                                                                        <div class="p-10 pt-0 overflow-y-auto flex-1 custom-scrollbar">
                                                                                                                            <div class="font-sans max-w-none">
                                                                                                                                <p class="text-gray-600 mb-4">Last Updated: February 2026</p>

                                                                                                                                <h3 class="text-xl font-bold text-[#1C1917] mt-8 mb-3">1. Information We Collect</h3>
                                                                                                                                <p class="text-gray-600 mb-4">kurate is designed to be a personal curation tool. We collect your username to manage your personal library. When you use the kurate extension, we save the titles, URLs, and categories of the links you explicitly choose to save.</p>

                                                                                                                                <h3 class="text-xl font-bold text-[#1C1917] mt-8 mb-3">2. How We Use Information</h3>
                                                                                                                                <p class="text-gray-600 mb-4">Your data is strictly used to provide the link-saving service. We do not track your browsing history and only access data when the extension is activated by you.</p>

                                                                                                                                <h3 class="text-xl font-bold text-[#1C1917] mt-8 mb-3">3. Data Storage</h3>
                                                                                                                                <p class="text-gray-600 mb-4">Your bookmarks are stored securely on our cloud servers. The browser extension stores your authentication token locally to maintain your session.</p>

                                                                                                                                <h3 class="text-xl font-bold text-[#1C1917] mt-8 mb-3">4. Sharing</h3>
                                                                                                                                <p class="text-gray-600 mb-4">We do not sell, trade, or share your personal information with third parties.</p>
                                                                                                                            </div>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                            </div>

                                                                                                            <!-- Contact Modal -->
                                                                                                            <div id="contactModal" class="fixed inset-0 z-[60] hidden opacity-0 transition-opacity duration-300">
                                                                                                                <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="closeContactModal()"></div>
                                                                                                                <div class="relative min-h-screen flex items-center justify-center p-4">
                                                                                                                    <div class="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 relative transform scale-95 transition-all duration-300 translate-y-4">
                                                                                                                        <button onclick="closeContactModal()" class="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors">
                                                                                                                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                                                                                        </button>

                                                                                                                        <div class="text-center pt-4 pb-8 font-sans">
                                                                                                                            <div class="w-16 h-16 bg-orange-100 text-[#FF7034] rounded-full flex items-center justify-center mx-auto mb-6">
                                                                                                                                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                                                                                                                                </svg>
                                                                                                                            </div>
                                                                                                                            <h2 class="text-3xl font-bold text-[#1C1917] mb-2">Contact Us</h2>
                                                                                                                            <p class="text-gray-500 mb-8">We'd love to hear from you</p>

                                                                                                                            <a class="inline-flex items-center gap-2 text-xl font-medium text-[#1C1917] hover:text-[#FF7034] transition-colors">
                                                                                                                                contact@kurate.net
                                                                                                                            </a>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                            </div>

                                                                                                            <script>
                                                                                                                let isLoginMode = true;

                                                                                                                function openAuthModal() {
            // Check if user is already logged in
            if (localStorage.getItem('authToken')) {
                                                                                                                    window.location.href = '/home';
                                                                                                                return;
            }

                                                                                                                const modal = document.getElementById('authModal');
                                                                                                                modal.classList.remove('hidden');
                                                                                                                // Trigger reflow
                                                                                                                void modal.offsetWidth;
                                                                                                                modal.classList.remove('opacity-0');
                                                                                                                modal.querySelector('div[class*="scale-95"]').classList.remove('scale-95', 'translate-y-4');
                                                                                                                modal.querySelector('div[class*="scale-95"]').classList.add('scale-100', 'translate-y-0');
        }

                                                                                                                function openSignupModal() {
                                                                                                                    isLoginMode = false;
                                                                                                                updateAuthUI();
                                                                                                                openAuthModal();
                                                                                                                // Update URL to reflect signup action
                                                                                                                window.history.pushState({ }, document.title, window.location.pathname + '?action=signup');
        }

                                                                                                                function closeAuthModal() {
            const modal = document.getElementById('authModal');
                                                                                                                modal.classList.add('opacity-0');
                                                                                                                const content = modal.querySelector('div[class*="scale-100"]');
                                                                                                                if(content) {
                                                                                                                    content.classList.remove('scale-100', 'translate-y-0');
                                                                                                                content.classList.add('scale-95', 'translate-y-4');
            }
            
            setTimeout(() => {
                                                                                                                    modal.classList.add('hidden');
                                                                                                                resetForms();
                                                                                                                // UX: Restore clean URL when modal closes
                                                                                                                window.history.replaceState({ }, document.title, window.location.pathname);
            }, 300);
        }

                                                                                                                function openPrivacyModal() {
            const modal = document.getElementById('privacyModal');
                                                                                                                modal.classList.remove('hidden');
                                                                                                                void modal.offsetWidth;
                                                                                                                modal.classList.remove('opacity-0');
                                                                                                                modal.querySelector('div[class*="scale-95"]').classList.remove('scale-95', 'translate-y-4');
                                                                                                                modal.querySelector('div[class*="scale-95"]').classList.add('scale-100', 'translate-y-0');
                                                                                                                window.history.pushState({ }, document.title, window.location.pathname + '?p=privacy');
        }

                                                                                                                function closePrivacyModal() {
            const modal = document.getElementById('privacyModal');
                                                                                                                modal.classList.add('opacity-0');
                                                                                                                const content = modal.querySelector('div[class*="scale-100"]');
                                                                                                                if(content) {
                                                                                                                    content.classList.remove('scale-100', 'translate-y-0');
                                                                                                                content.classList.add('scale-95', 'translate-y-4');
            }
            setTimeout(() => {
                                                                                                                    modal.classList.add('hidden');
                                                                                                                window.history.replaceState({ }, document.title, window.location.pathname);
            }, 300);
        }

                                                                                                                function openContactModal() {
            const modal = document.getElementById('contactModal');
                                                                                                                modal.classList.remove('hidden');
                                                                                                                void modal.offsetWidth;
                                                                                                                modal.classList.remove('opacity-0');
                                                                                                                modal.querySelector('div[class*="scale-95"]').classList.remove('scale-95', 'translate-y-4');
                                                                                                                modal.querySelector('div[class*="scale-95"]').classList.add('scale-100', 'translate-y-0');
        }

                                                                                                                function closeContactModal() {
            const modal = document.getElementById('contactModal');
                                                                                                                modal.classList.add('opacity-0');
                                                                                                                const content = modal.querySelector('div[class*="scale-100"]');
                                                                                                                if(content) {
                                                                                                                    content.classList.remove('scale-100', 'translate-y-0');
                                                                                                                content.classList.add('scale-95', 'translate-y-4');
            }
            setTimeout(() => {
                                                                                                                    modal.classList.add('hidden');
            }, 300);
        }

                                                                                                                function resetForms() {
                                                                                                                    document.getElementById('modalAuthForm').reset();
                                                                                                                document.getElementById('modalResetForm').reset();
                                                                                                                document.getElementById('authError').classList.add('hidden');
                                                                                                                document.getElementById('resetError').classList.add('hidden');
                                                                                                                document.getElementById('resetSuccess').classList.add('hidden');

                                                                                                                // Reset to login view
                                                                                                                isLoginMode = true;
                                                                                                                updateAuthUI();
                                                                                                                document.getElementById('modalAuthContainer').classList.remove('hidden');
                                                                                                                document.getElementById('modalResetContainer').classList.add('hidden');
        }

                                                                                                                function toggleAuthMode() {
                                                                                                                    isLoginMode = !isLoginMode;
                                                                                                                updateAuthUI();
        }

                                                                                                                function toggleResetMode() {
            const authContainer = document.getElementById('modalAuthContainer');
                                                                                                                const resetContainer = document.getElementById('modalResetContainer');

                                                                                                                if (resetContainer.classList.contains('hidden')) {
                                                                                                                    authContainer.classList.add('hidden');
                                                                                                                resetContainer.classList.remove('hidden');
            } else {
                                                                                                                    resetContainer.classList.add('hidden');
                                                                                                                authContainer.classList.remove('hidden');
            }
        }

                                                                                                                function updateAuthUI() {
            const title = document.getElementById('modalTitle');
                                                                                                                const subtitle = document.getElementById('modalSubtitle');
                                                                                                                const submitText = document.getElementById('modalSubmitText');
                                                                                                                const toggleText = document.getElementById('modalToggleText');
                                                                                                                const toggleLink = document.getElementById('modalToggleLink');
                                                                                                                const errorDiv = document.getElementById('authError');

                                                                                                                errorDiv.classList.add('hidden');

                                                                                                                if (isLoginMode) {
                                                                                                                    title.textContent = 'Start Curating';
                                                                                                                subtitle.textContent = '';
                                                                                                                submitText.textContent = 'Sign In';
                                                                                                                toggleText.textContent = "Don't have an account?";
                                                                                                                toggleLink.textContent = 'Join kurate';
            } else {
                                                                                                                    title.textContent = 'Join kurate';
                                                                                                                subtitle.textContent = '';
                                                                                                                submitText.textContent = 'Join kurate';
                                                                                                                toggleText.textContent = 'Already have an account?';
                                                                                                                toggleLink.textContent = 'Sign in';
            }
        }

                                                                                                                async function handleAuthSubmit(e) {
                                                                                                                    e.preventDefault();
                                                                                                                const username = document.getElementById('modalUsername').value;
                                                                                                                const password = document.getElementById('modalPassword').value;
                                                                                                                const errorDiv = document.getElementById('authError');

                                                                                                                errorDiv.classList.add('hidden');

                                                                                                                const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';

                                                                                                                try {
                const response = await fetch(endpoint, {
                                                                                                                    method: 'POST',
                                                                                                                headers: {'Content-Type': 'application/json' },
                                                                                                                body: JSON.stringify({username, password})
                });

                                                                                                                const data = await response.json();

                                                                                                                if (data.success) {
                                                                                                                    localStorage.setItem('authToken', data.token);
                                                                                                                window.location.href = '/home';
                } else {
                                                                                                                    errorDiv.textContent = data.error || 'Authentication failed';
                                                                                                                errorDiv.classList.remove('hidden');
                }
            } catch (error) {
                                                                                                                    errorDiv.textContent = 'An error occurred. Please try again.';
                                                                                                                errorDiv.classList.remove('hidden');
            }
        }

                                                                                                                async function handleResetSubmit(e) {
                                                                                                                    e.preventDefault();
                                                                                                                const username = document.getElementById('resetUsername').value;
                                                                                                                const newPassword = document.getElementById('newPassword').value;
                                                                                                                const confirmPassword = document.getElementById('confirmPassword').value;
                                                                                                                const errorDiv = document.getElementById('resetError');
                                                                                                                const successDiv = document.getElementById('resetSuccess');

                                                                                                                errorDiv.classList.add('hidden');
                                                                                                                successDiv.classList.add('hidden');

                                                                                                                if (newPassword !== confirmPassword) {
                                                                                                                    errorDiv.textContent = "Passwords don't match";
                                                                                                                errorDiv.classList.remove('hidden');
                                                                                                                return;
            }

                                                                                                                try {
                const response = await fetch('/api/auth/reset-password', {
                                                                                                                    method: 'POST',
                                                                                                                headers: {'Content-Type': 'application/json' },
                                                                                                                body: JSON.stringify({username, newPassword})
                });

                                                                                                                const data = await response.json();

                                                                                                                if (data.success) {
                                                                                                                    successDiv.textContent = 'Password reset successfully. You can now sign in.';
                                                                                                                successDiv.classList.remove('hidden');
                                                                                                                document.getElementById('modalResetForm').reset();
                    setTimeout(() => {
                                                                                                                    toggleResetMode();
                                                                                                                isLoginMode = true; // Switch to login
                                                                                                                updateAuthUI();
                    }, 2000);
                } else {
                                                                                                                    errorDiv.textContent = data.error || 'Reset failed';
                                                                                                                errorDiv.classList.remove('hidden');
                }
            } catch (error) {
                                                                                                                    errorDiv.textContent = 'An error occurred. Please try again.';
                                                                                                                errorDiv.classList.remove('hidden');
            }
        }

        // Check for auto-signup action from extension (immediate execution)
        const checkAutoSignup = () => {
            const params = new URLSearchParams(window.location.search);
                                                                                                                if (params.get('action') === 'signup') {
                                                                                                                    isLoginMode = false;
                                                                                                                if (typeof updateAuthUI === 'function') updateAuthUI();
                                                                                                                if (typeof openAuthModal === 'function') openAuthModal();
                                                                                                                // Clean up URL
                                                                                                                window.history.replaceState({ }, document.title, window.location.pathname);
            }

                                                                                                                // Handle Privacy Policy direct link
                                                                                                                if (params.get('p') === 'privacy') {
                if (typeof openPrivacyModal === 'function') openPrivacyModal();
            }
        };
                                                                                                                checkAutoSignup();

        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                                                                                                                    closeAuthModal();
                                                                                                                closePrivacyModal();
                                                                                                                closeContactModal();
            }
        });
                                                                                                            </script>
                                                                                                        </body>

                                                                                                    </html>`;
}


// ==================== MOBILE VERSIONS ====================

function getMobileLandingHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <title>kurate - for the curious</title>
    <link rel="icon" type="image/png" href="/favicon.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #D2622A;
            --primary-light: #FFEDD5;
            --bg: #FDFAF8;
            --text-primary: #1C1917;
            --text-secondary: #4B5563;
            --text-tertiary: #9CA3AF;
            --border: #E5E7EB;
            --white: #FFFFFF;
            --error: #EF4444;
            --success: #10B981;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            background: var(--bg);
            color: var(--text-primary);
            -webkit-font-smoothing: antialiased;
            min-height: 100vh;
            min-height: 100dvh;
            display: flex;
            flex-direction: column;
        }
        .m-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 60px 32px 32px;
            max-width: 480px;
            margin: 0 auto;
            width: 100%;
        }
        .m-logo {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 32px;
        }
        .m-logo-icon {
            width: 24px; height: 24px;
            background: #000;
            border-radius: 12px;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 700;
        }
        .m-logo-text {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }
        .m-headline {
            font-size: 24px;
            font-weight: 700;
            line-height: 32px;
            margin-bottom: 20px;
        }
        .m-headline-accent { color: var(--primary); }
        .m-marketing {
            margin-bottom: 32px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .m-marketing p {
            font-size: 14px;
            color: var(--text-secondary);
            line-height: 20px;
        }
        .m-marketing em {
            font-weight: 700;
            font-style: italic;
        }
        .m-form-group {
            margin-bottom: 20px;
        }
        .m-label {
            display: block;
            font-size: 12px;
            font-weight: 700;
            color: var(--text-primary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
            margin-left: 4px;
        }
        .m-input {
            width: 100%;
            background: var(--white);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 16px;
            font-size: 16px;
            font-family: inherit;
            color: var(--text-primary);
            -webkit-appearance: none;
        }
        .m-input::placeholder { color: var(--text-tertiary); }
        .m-input:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 2px rgba(210, 98, 42, 0.1);
        }
        .m-btn {
            width: 100%;
            background: var(--primary);
            color: var(--white);
            border: none;
            padding: 18px;
            border-radius: 100px;
            font-size: 16px;
            font-weight: 700;
            font-family: inherit;
            cursor: pointer;
            margin-top: 10px;
            box-shadow: 0 4px 8px rgba(210, 98, 42, 0.2);
        }
        .m-btn:active { opacity: 0.9; transform: scale(0.99); }
        .m-footer {
            margin-top: 24px;
            text-align: center;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .m-footer-text {
            font-size: 14px;
            color: var(--text-secondary);
        }
        .m-footer-link {
            color: var(--primary);
            font-weight: 700;
            background: none;
            border: none;
            font-size: inherit;
            font-family: inherit;
            cursor: pointer;
        }
        .m-forgot {
            font-size: 13px;
            color: var(--text-tertiary);
            font-weight: 500;
            background: none;
            border: none;
            font-family: inherit;
            cursor: pointer;
        }
        .m-error {
            display: none;
            margin-top: 12px;
            text-align: center;
            color: var(--error);
            font-size: 14px;
        }
        .m-error.visible { display: block; }
        .m-success {
            display: none;
            margin-top: 12px;
            text-align: center;
            color: var(--success);
            font-size: 14px;
        }
        .m-success.visible { display: block; }
        /* Reset password view */
        .m-view { display: none; }
        .m-view.active { display: block; }
        .m-reset-title {
            font-size: 24px;
            font-weight: 700;
            text-align: center;
            margin-bottom: 8px;
        }
        .m-reset-subtitle {
            font-size: 15px;
            color: var(--text-secondary);
            text-align: center;
            margin-bottom: 40px;
            line-height: 22px;
        }
        .m-back-link {
            margin-top: 32px;
            text-align: center;
        }
    </style>
</head>
<body>
    <!-- Auth View -->
    <div id="authView" class="m-view active">
        <div class="m-container">
            <div class="m-logo">
                <div class="m-logo-icon">K</div>
                <span class="m-logo-text">kurate</span>
            </div>
            <h1 class="m-headline">
                Your personal library of ideas from across the web.
                <span class="m-headline-accent">You are the curator.</span>
            </h1>
            <div class="m-marketing">
                <p><em>kurate</em> is your personal library for collecting and organizing the best content from across the web.</p>
                <p>Save articles, videos, and podcasts in one beautiful, simplified space.</p>
            </div>
            <form id="authForm" onsubmit="handleAuth(event)">
                <div class="m-form-group">
                    <label class="m-label">Username</label>
                    <input type="text" id="authUsername" class="m-input" placeholder="Enter your username" required autocomplete="off" autocapitalize="off">
                </div>
                <div class="m-form-group">
                    <label class="m-label">Password</label>
                    <input type="password" id="authPassword" class="m-input" placeholder="Enter your password" required>
                </div>
                <div id="authError" class="m-error"></div>
                <button type="submit" class="m-btn" id="authBtn">Start Curating</button>
            </form>
            <div class="m-footer">
                <div class="m-footer-text">
                    <span id="toggleText">Don't have an account?</span>
                    <button class="m-footer-link" id="toggleLink" onclick="toggleMode()">Join kurate</button>
                </div>
                <button class="m-forgot" id="forgotBtn" onclick="showReset()">Forgot your password?</button>
            </div>
        </div>
    </div>
    <!-- Reset View -->
    <div id="resetView" class="m-view">
        <div class="m-container" style="padding-top:48px;">
            <div class="m-logo" style="justify-content:center;">
                <div class="m-logo-icon">K</div>
                <span class="m-logo-text">kurate</span>
            </div>
            <h2 class="m-reset-title">Secure your account</h2>
            <p class="m-reset-subtitle">Enter your details below to reset your password.</p>
            <form id="resetForm" onsubmit="handleReset(event)">
                <div class="m-form-group">
                    <label class="m-label">Username</label>
                    <input type="text" id="resetUsername" class="m-input" placeholder="Enter your username" required autocomplete="off">
                </div>
                <div class="m-form-group">
                    <label class="m-label">New Password</label>
                    <input type="password" id="resetNewPw" class="m-input" placeholder="Min 6 characters" required>
                </div>
                <div class="m-form-group">
                    <label class="m-label">Confirm Password</label>
                    <input type="password" id="resetConfirmPw" class="m-input" placeholder="Repeat new password" required>
                </div>
                <div id="resetError" class="m-error"></div>
                <div id="resetSuccess" class="m-success"></div>
                <button type="submit" class="m-btn" style="margin-top:20px;">Reset Password</button>
            </form>
            <div class="m-back-link">
                <span class="m-footer-text">Remembered? </span>
                <button class="m-footer-link" onclick="showAuth()">Sign in</button>
            </div>
        </div>
    </div>
    <script>
    let isLogin = true;
    function toggleMode() {
        isLogin = !isLogin;
        document.getElementById('authBtn').textContent = isLogin ? 'Start Curating' : 'Join kurate';
        document.getElementById('toggleText').textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
        document.getElementById('toggleLink').textContent = isLogin ? 'Join kurate' : 'Sign In';
        document.getElementById('forgotBtn').style.display = isLogin ? '' : 'none';
        document.getElementById('authError').className = 'm-error';
    }
    function showReset() {
        document.getElementById('authView').className = 'm-view';
        document.getElementById('resetView').className = 'm-view active';
    }
    function showAuth() {
        document.getElementById('resetView').className = 'm-view';
        document.getElementById('authView').className = 'm-view active';
    }
    async function handleAuth(e) {
        e.preventDefault();
        const username = document.getElementById('authUsername').value;
        const password = document.getElementById('authPassword').value;
        const errDiv = document.getElementById('authError');
        errDiv.className = 'm-error';
        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem('authToken', data.token);
                window.location.href = '/home';
            } else {
                errDiv.textContent = data.error || 'Authentication failed';
                errDiv.className = 'm-error visible';
            }
        } catch (err) {
            errDiv.textContent = 'An error occurred. Please try again.';
            errDiv.className = 'm-error visible';
        }
    }
    async function handleReset(e) {
        e.preventDefault();
        const username = document.getElementById('resetUsername').value;
        const newPassword = document.getElementById('resetNewPw').value;
        const confirmPassword = document.getElementById('resetConfirmPw').value;
        const errDiv = document.getElementById('resetError');
        const successDiv = document.getElementById('resetSuccess');
        errDiv.className = 'm-error';
        successDiv.className = 'm-success';
        if (newPassword !== confirmPassword) {
            errDiv.textContent = "Passwords don't match";
            errDiv.className = 'm-error visible';
            return;
        }
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, newPassword })
            });
            const data = await res.json();
            if (data.success) {
                successDiv.textContent = 'Password reset successfully!';
                successDiv.className = 'm-success visible';
                document.getElementById('resetForm').reset();
                setTimeout(() => { showAuth(); isLogin = true; toggleMode(); toggleMode(); }, 2000);
            } else {
                errDiv.textContent = data.error || 'Reset failed';
                errDiv.className = 'm-error visible';
            }
        } catch (err) {
            errDiv.textContent = 'An error occurred.';
            errDiv.className = 'm-error visible';
        }
    }
    </script>
</body>
</html>`;
}


function getMobileIndexHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <title>kurate - for the curious</title>
    <link rel="icon" type="image/png" href="/favicon.png?v=2">
    <script src="https://cdn.jsdelivr.net/npm/fuse.js@7.0.0"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div id="mainApp" class="m-app">
        <!-- Header -->
        <header class="m-header">
            <div class="m-logo">
                <div class="m-logo-icon">K</div>
                <span class="m-logo-text">kurate</span>
            </div>
            <button id="logoutBtn" class="m-logout-btn">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
        </header>

        <!-- Title -->
        <div class="m-title-section">
            <h1 id="userGreeting" class="m-title">Curated List</h1>
        </div>

        <!-- Filter Section -->
        <div class="m-filter-section">
            <!-- Search -->
            <div class="m-search-bar">
                <svg class="m-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="searchInput" class="m-search-input" placeholder="Search through your curated list..." autocomplete="off">
            </div>

            <!-- Collections Label -->
            <div class="m-section-label">COLLECTIONS</div>

            <!-- Segmented Control -->
            <div class="m-tabs">
                <button id="allTab" class="m-tab active">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    All
                </button>
                <button id="unreadTab" class="m-tab">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                    To Read
                </button>
                <button id="readTab" class="m-tab">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    Read
                </button>
                <button id="favoritesTab" class="m-tab">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    Favorites
                </button>
            </div>

            <!-- Categories Label -->
            <div class="m-section-label">CATEGORIES</div>

            <!-- Category Pills -->
            <div class="m-categories-scroll">
                <nav class="m-categories" id="categoryNav">
                    <button class="m-category-pill active" data-category="all">All</button>
                    <button class="m-category-pill" data-category="Sports">Sports</button>
                    <button class="m-category-pill" data-category="Entertainment">Entertainment</button>
                    <button class="m-category-pill" data-category="Business">Business</button>
                    <button class="m-category-pill" data-category="Technology">Technology</button>
                    <button class="m-category-pill" data-category="Education">Education</button>
                    <button class="m-category-pill" data-category="Other">Other</button>
                </nav>
            </div>
        </div>

        <!-- Card Grid -->
        <div class="m-content">
            <div id="links" class="m-card-grid">
                <div class="m-empty-state">Loading links...</div>
            </div>
        </div>

        <!-- FABs -->
        <button class="m-fab m-fab-rec" id="openRecommendedBtn">Rec</button>
        <button class="m-fab m-fab-add" onclick="window.app.showMobileAddView()">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
    </div>

    <!-- Add Link Full-screen View -->
    <div id="mobileAddView" class="m-fullview">
        <header class="m-fullview-header">
            <button class="m-back-btn" onclick="window.app.hideMobileAddView()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <h2 class="m-fullview-title">Add Link</h2>
            <div style="width:24px;"></div>
        </header>
        <div class="m-fullview-body">
            <div class="m-add-card">
                <form id="addLinkForm" class="m-add-form">
                    <div class="m-add-group">
                        <label class="m-add-label">LINK</label>
                        <input type="url" id="linkUrl" class="m-add-input" placeholder="https://..." required autocomplete="off" autocapitalize="off">
                    </div>
                    <div class="m-add-group">
                        <label class="m-add-label">CATEGORY</label>
                        <div class="m-add-categories" id="mobileCatGrid">
                            <button type="button" class="m-add-cat-btn" data-value="Sports">Sports</button>
                            <button type="button" class="m-add-cat-btn" data-value="Entertainment">Entertainment</button>
                            <button type="button" class="m-add-cat-btn" data-value="Business">Business</button>
                            <button type="button" class="m-add-cat-btn" data-value="Technology">Technology</button>
                            <button type="button" class="m-add-cat-btn" data-value="Education">Education</button>
                            <button type="button" class="m-add-cat-btn" data-value="Other">Other</button>
                        </div>
                        <input type="hidden" id="linkCategory" value="">
                    </div>
                    <button type="submit" class="m-add-submit">Curate</button>
                </form>
            </div>
            <div class="m-tip">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4B5563" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <p>Tip: You can use the kurate browser extension to save links directly from any webpage.</p>
            </div>
        </div>
    </div>

    <!-- Recommended Reading Full-screen View -->
    <div id="recommendedModal" class="m-fullview recommended-modal hidden">
        <header class="m-fullview-header">
            <button class="m-back-btn" onclick="window.app.closeRecommendedPortal()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div class="m-fullview-title-group">
                <h2 class="m-fullview-title">Recommended Reading</h2>
                <p class="m-fullview-subtitle">Trending articles from the past 7 days</p>
            </div>
            <div style="width:24px;"></div>
        </header>
        <div class="m-rec-filters">
            <button class="recommended-filter active" data-source="all">All</button>
            <button class="recommended-filter" data-source="sports">Sports</button>
            <button class="recommended-filter" data-source="entertainment">Entertainment</button>
            <button class="recommended-filter" data-source="business">Business</button>
            <button class="recommended-filter" data-source="technology">Technology</button>
            <button class="recommended-filter" data-source="education">Education</button>
            <button class="recommended-filter" data-source="other">Other</button>
        </div>
        <div id="recommendedArticles" class="m-rec-articles">
            <div class="m-loading">
                <div class="m-spinner"></div>
                <p>Fetching trending articles...</p>
            </div>
        </div>
    </div>

    <!-- Status Toast -->
    <div id="statusMessage" class="m-status hidden"></div>

    <script src="app.js"></script>
</body>
</html>`;
}


function getMobileStylesCSS() {
    return `
:root {
    --primary: #D2622A;
    --primary-light: #FFEDD5;
    --primary-hover: #B34E1F;
    --bg: #FDFAF8;
    --text-primary: #1C1917;
    --text-secondary: #4B5563;
    --text-tertiary: #9CA3AF;
    --border: #E5E7EB;
    --border-light: #F3F4F6;
    --white: #FFFFFF;
    --card: #FEFEFE;
    --success: #10B981;
    --error: #EF4444;
    --font-sans: "Inter", system-ui, -apple-system, sans-serif;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: var(--font-sans);
    background: var(--bg);
    color: var(--text-primary);
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
    -webkit-tap-highlight-color: transparent;
}

/* App Shell */
.m-app {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
}

/* Header */
.m-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px 8px;
    background: var(--bg);
    position: sticky;
    top: 0;
    z-index: 100;
}
.m-logo {
    display: flex;
    align-items: center;
    gap: 6px;
}
.m-logo-icon {
    width: 24px; height: 24px;
    background: #000;
    border-radius: 12px;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
}
.m-logo-text {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.5px;
}
.m-logout-btn {
    padding: 4px;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
}

/* Title */
.m-title-section {
    padding: 4px 20px;
}
.m-title {
    font-size: 18px;
    font-weight: 700;
}

/* Filter Section */
.m-filter-section {
    background: var(--white);
    border-bottom: 1px solid var(--border-light);
    padding-top: 4px;
    padding-bottom: 12px;
}
.m-search-bar {
    display: flex;
    align-items: center;
    background: #F8FAFC;
    border-radius: 10px;
    margin: 8px 20px;
    padding: 0 12px;
    border: 1px solid #E2E8F0;
}
.m-search-icon { flex-shrink: 0; margin-right: 8px; }
.m-search-input {
    flex: 1;
    height: 40px;
    border: none;
    background: transparent;
    font-size: 13px;
    font-family: var(--font-sans);
    color: var(--text-primary);
    outline: none;
}
.m-search-input::placeholder { color: var(--text-tertiary); }

.m-section-label {
    font-size: 10px;
    font-weight: 700;
    color: #000;
    letter-spacing: 1px;
    margin: 12px 20px 4px;
}

/* Segmented Control */
.m-tabs {
    display: flex;
    margin: 0 20px 8px;
    background: #F1F5F9;
    border-radius: 10px;
    padding: 2px;
}
.m-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 0;
    border: none;
    background: transparent;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 600;
    font-family: var(--font-sans);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
}
.m-tab.active {
    background: var(--white);
    color: var(--primary);
    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
.m-tab svg { width: 14px; height: 14px; }

/* Category Pills */
.m-categories-scroll {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    padding-left: 20px;
    scrollbar-width: none;
}
.m-categories-scroll::-webkit-scrollbar { display: none; }
.m-categories {
    display: flex;
    gap: 8px;
    padding-right: 40px;
}
.m-category-pill {
    padding: 5px 14px;
    border-radius: 20px;
    border: 1px solid #E2E8F0;
    background: var(--white);
    font-size: 11px;
    font-weight: 500;
    font-family: var(--font-sans);
    color: var(--text-secondary);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
}
.m-category-pill.active,
.category-item.active {
    background: var(--primary-light);
    border-color: var(--primary);
    color: var(--primary);
    font-weight: 700;
}

/* Card Grid */
.m-content {
    flex: 1;
    padding: 16px 8px 100px;
}
.m-card-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    padding: 0 8px;
}

/* Link Card */
.link-card {
    background: var(--white);
    border-radius: 14px;
    padding: 12px;
    border: 1px solid #ECECEC;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    min-height: 150px;
}
.card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 8px;
}
.card-badge {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 2px 6px;
    border-radius: 4px;
    background: #F3F4F6;
    color: var(--text-secondary);
}
.badge-Business { background: #FFEDD5; color: #9A3412; }
.badge-Technology { background: #DBEAFE; color: #1E40AF; }
.badge-Design { background: #FCE7F3; color: #9D174D; }
.badge-Sports { background: #DCFCE7; color: #166534; }
.badge-Education { background: #E0E7FF; color: #3730A3; }
.badge-Entertainment { background: #FCE7F3; color: #9D174D; }

.star-btn {
    background: none; border: none;
    font-size: 20px;
    color: var(--text-tertiary);
    cursor: pointer;
    padding: 0; line-height: 1;
}
.star-btn:hover, .star-btn.active { color: #FBBF24; }

.card-main { margin-bottom: 8px; flex: 1; }
.card-title {
    font-size: 14px;
    font-weight: 600;
    line-height: 18px;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    margin-bottom: 4px;
    max-height: 36px;
}
.card-title a { text-decoration: none; color: inherit; }
.card-domain {
    font-size: 11px;
    color: var(--text-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 8px;
    border-top: 1px solid var(--border-light);
}
.mark-read-btn {
    background: none; border: none;
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font-family: var(--font-sans);
}
.mark-read-btn.is-read { color: var(--primary); }
.card-actions { display: flex; gap: 4px; }
.icon-btn {
    background: none; border: none;
    color: var(--text-tertiary);
    cursor: pointer;
    padding: 2px;
}

/* Empty State */
.m-empty-state, .empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 60px 20px;
    color: var(--text-tertiary);
    font-size: 14px;
}

/* FABs */
.m-fab {
    position: fixed;
    width: 56px; height: 56px;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 28px;
    cursor: pointer;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transition: transform 0.2s;
}
.m-fab:active { transform: scale(0.95); }
.m-fab-rec {
    bottom: 160px;
    right: 20px;
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
    font-family: var(--font-sans);
}
.m-fab-add {
    bottom: 88px;
    right: 20px;
}

/* Full-screen Views */
.m-fullview {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: var(--bg);
    z-index: 500;
    display: none;
    flex-direction: column;
}
.m-fullview.active {
    display: flex;
}
.m-fullview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--white);
    border-bottom: 1px solid var(--border);
}
.m-back-btn {
    background: none; border: none;
    color: var(--text-primary);
    cursor: pointer; padding: 0;
}
.m-fullview-title {
    font-size: 18px;
    font-weight: 700;
    text-align: center;
}
.m-fullview-title-group { text-align: center; flex: 1; }
.m-fullview-subtitle {
    font-size: 11px;
    color: var(--text-tertiary);
    margin-top: 2px;
}

/* Add Link View */
.m-fullview-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
}
.m-add-card {
    background: var(--white);
    border-radius: 24px;
    padding: 24px;
    border: 1px solid var(--border);
    box-shadow: 0 4px 10px rgba(0,0,0,0.05);
}
.m-add-group {
    margin-bottom: 20px;
}
.m-add-label {
    display: block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1px;
    color: var(--text-primary);
    margin-bottom: 10px;
    margin-left: 2px;
}
.m-add-input {
    width: 100%;
    background: #F8FAFC;
    border: 1px solid #CBD5E1;
    border-radius: 12px;
    padding: 14px;
    font-size: 14px;
    font-family: var(--font-sans);
    color: var(--text-primary);
    -webkit-appearance: none;
}
.m-add-input::placeholder { color: var(--text-tertiary); }
.m-add-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(210,98,42,0.1);
}
.m-add-categories {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 32px;
}
.m-add-cat-btn {
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--white);
    font-size: 13px;
    font-weight: 500;
    font-family: var(--font-sans);
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
}
.m-add-cat-btn.active {
    background: var(--primary-light);
    border-color: var(--primary);
    color: var(--primary);
}
.m-add-submit {
    width: 100%;
    background: var(--primary);
    color: white;
    border: none;
    padding: 16px;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 700;
    font-family: var(--font-sans);
    cursor: pointer;
    box-shadow: 0 4px 8px rgba(210,98,42,0.2);
}
.m-add-submit:active { opacity: 0.9; }
.m-tip {
    margin-top: 32px;
    display: flex;
    gap: 12px;
    background: rgba(0,0,0,0.03);
    padding: 16px;
    border-radius: 16px;
    align-items: flex-start;
}
.m-tip p {
    flex: 1;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 18px;
}
.m-tip svg { flex-shrink: 0; margin-top: 1px; }

/* Recommended Reading View */
.recommended-modal.hidden { display: none !important; }
.recommended-modal.active,
.recommended-modal:not(.hidden) { display: flex !important; }
.m-rec-filters {
    display: flex;
    gap: 6px;
    padding: 8px 16px;
    background: var(--white);
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
}
.m-rec-filters::-webkit-scrollbar { display: none; }
.recommended-filter {
    padding: 5px 14px;
    border-radius: 20px;
    border: none;
    background: #F3F4F6;
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font-sans);
    color: var(--text-secondary);
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
}
.recommended-filter.active {
    background: var(--primary);
    color: white;
}
.m-rec-articles {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.recommended-article-card {
    background: var(--white);
    border-radius: 16px;
    padding: 16px;
    border: 1px solid var(--border);
    min-height: 200px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}
.rec-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}
.rec-source-badge {
    padding: 4px 8px;
    border-radius: 6px;
    background: var(--primary-light);
    font-size: 10px;
    font-weight: 700;
    color: var(--primary);
    text-transform: uppercase;
}
.rec-date {
    font-size: 10px;
    color: var(--text-tertiary);
}
.rec-title {
    font-size: 15px;
    font-weight: 700;
    line-height: 20px;
    margin-bottom: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}
.rec-desc {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 18px;
    margin-bottom: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}
.rec-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 12px;
    border-top: 1px solid var(--border-light);
}
.rec-domain { font-size: 12px; color: var(--text-tertiary); }
.rec-curate-btn {
    padding: 8px 16px;
    border-radius: 100px;
    border: none;
    background: var(--primary);
    color: white;
    font-size: 12px;
    font-weight: 700;
    font-family: var(--font-sans);
    min-width: 80px;
    cursor: pointer;
    text-align: center;
}
.rec-curate-btn.curated {
    background: var(--success);
}
.rec-curate-btn:active { opacity: 0.9; }

/* Loading / Spinner */
.m-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px;
    gap: 16px;
    color: var(--text-secondary);
    font-size: 14px;
}
.m-spinner {
    width: 32px; height: 32px;
    border: 3px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Status Toast */
.m-status {
    position: fixed;
    bottom: 24px;
    left: 16px; right: 16px;
    padding: 12px 20px;
    border-radius: 12px;
    background: #111827;
    color: white;
    font-size: 14px;
    font-weight: 500;
    text-align: center;
    z-index: 9999;
    animation: slideUpToast 0.3s ease;
}
.m-status.hidden { display: none; }
.m-status.error { background: var(--error); }
.m-status.success { background: var(--success); }
@keyframes slideUpToast {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
}
`;
}


function getMobileAppJS() {
    return `
class LinksApp {
    constructor() {
        this.links = [];
        this.currentUser = null;
        this.token = localStorage.getItem('authToken');
        this.apiBase = '/api';
        this.currentTab = this.getInitialTab();
        this.searchQuery = '';
        this.categoryFilter = 'all';
        this.selectedAddCategory = '';
        this.recommendedArticles = [];
        this.allRecommendedArticles = [];
        this.init();
    }

    getInitialTab() {
        const hash = window.location.hash.replace('#', '');
        const validTabs = ['unread', 'read', 'favorites'];
        return validTabs.includes(hash) ? hash : 'all';
    }

    init() {
        if (!this.token) {
            window.location.replace('/');
            return;
        }
        try {
            const tokenData = JSON.parse(atob(this.token));
            if (tokenData && tokenData.username) {
                this.currentUser = { username: tokenData.username };
            }
        } catch (e) {
            localStorage.removeItem('authToken');
            window.location.replace('/');
            return;
        }
        this.setupEventListeners();
        this.showMainApp();
        this.loadLinks();
    }

    showMainApp() {
        const greeting = document.getElementById('userGreeting');
        if (greeting && this.currentUser) {
            greeting.textContent = this.currentUser.username + "'s curated list";
        }
    }

    setupEventListeners() {
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Tabs
        document.getElementById('allTab').addEventListener('click', () => this.switchTab('all'));
        document.getElementById('unreadTab').addEventListener('click', () => this.switchTab('unread'));
        document.getElementById('readTab').addEventListener('click', () => this.switchTab('read'));
        document.getElementById('favoritesTab').addEventListener('click', () => this.switchTab('favorites'));

        // Add Link Form
        document.getElementById('addLinkForm').addEventListener('submit', (e) => this.handleAddLink(e));

        // Search
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.renderLinks();
            });
        }

        // Category Nav
        const categoryNav = document.getElementById('categoryNav');
        if (categoryNav) {
            categoryNav.addEventListener('click', (e) => {
                const pill = e.target.closest('.m-category-pill');
                if (pill) {
                    document.querySelectorAll('.m-category-pill').forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                    this.categoryFilter = pill.dataset.category;
                    this.renderLinks();
                }
            });
        }

        // Add Link Category Grid
        const catGrid = document.getElementById('mobileCatGrid');
        if (catGrid) {
            catGrid.addEventListener('click', (e) => {
                const btn = e.target.closest('.m-add-cat-btn');
                if (btn) {
                    document.querySelectorAll('.m-add-cat-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.selectedAddCategory = btn.dataset.value;
                    document.getElementById('linkCategory').value = btn.dataset.value;
                }
            });
        }

        // Recommended Reading
        const openRecBtn = document.getElementById('openRecommendedBtn');
        if (openRecBtn) {
            openRecBtn.addEventListener('click', () => this.openRecommendedPortal());
        }

        // Recommended Filters
        document.querySelectorAll('.recommended-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.recommended-filter').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filterRecommendedArticles(e.target.dataset.source);
            });
        });

        // Auto-fetch title on URL paste
        const linkUrlInput = document.getElementById('linkUrl');
        if (linkUrlInput) {
            linkUrlInput.addEventListener('paste', () => {
                setTimeout(() => {
                    const url = linkUrlInput.value;
                    if (url) this.fetchUrlTitle(url);
                }, 10);
            });
        }
    }

    switchTab(tab) {
        this.currentTab = tab;
        window.location.hash = tab === 'all' ? '' : tab;
        document.getElementById('allTab').classList.toggle('active', tab === 'all');
        document.getElementById('unreadTab').classList.toggle('active', tab === 'unread');
        document.getElementById('readTab').classList.toggle('active', tab === 'read');
        document.getElementById('favoritesTab').classList.toggle('active', tab === 'favorites');
        this.renderLinks();
    }

    // Mobile Add View
    showMobileAddView() {
        document.getElementById('mobileAddView').classList.add('active');
    }
    hideMobileAddView() {
        document.getElementById('mobileAddView').classList.remove('active');
    }

    // Recommended Reading
    openRecommendedPortal() {
        const modal = document.getElementById('recommendedModal');
        modal.classList.remove('hidden');
        modal.classList.add('active');
        if (this.allRecommendedArticles.length === 0) {
            this.loadRecommendedArticles();
        }
    }
    closeRecommendedPortal() {
        const modal = document.getElementById('recommendedModal');
        modal.classList.add('hidden');
        modal.classList.remove('active');
    }

    async loadRecommendedArticles() {
        const container = document.getElementById('recommendedArticles');
        container.innerHTML = '<div class="m-loading"><div class="m-spinner"></div><p>Fetching trending articles...</p></div>';
        try {
            const sources = {
                sports: 'https://newsdata.io/api/1/latest?apikey=pub_6441534ee5919d07ef42d9dbb24ba7f66fd36&category=sports&language=en&size=10',
                entertainment: 'https://newsdata.io/api/1/latest?apikey=pub_6441534ee5919d07ef42d9dbb24ba7f66fd36&category=entertainment&language=en&size=10',
                business: 'https://newsdata.io/api/1/latest?apikey=pub_6441534ee5919d07ef42d9dbb24ba7f66fd36&category=business&language=en&size=10',
                technology: 'https://newsdata.io/api/1/latest?apikey=pub_6441534ee5919d07ef42d9dbb24ba7f66fd36&category=technology&language=en&size=10',
                education: 'https://newsdata.io/api/1/latest?apikey=pub_6441534ee5919d07ef42d9dbb24ba7f66fd36&category=education&language=en&size=10',
                other: 'https://newsdata.io/api/1/latest?apikey=pub_6441534ee5919d07ef42d9dbb24ba7f66fd36&category=top&language=en&size=10'
            };
            const allArticles = [];
            const entries = Object.entries(sources);
            const results = await Promise.allSettled(entries.map(([cat, url]) =>
                fetch(url).then(r => r.json()).then(data => ({ cat, results: data.results || [] }))
            ));
            results.forEach(r => {
                if (r.status === 'fulfilled' && r.value.results) {
                    r.value.results.forEach(article => {
                        allArticles.push({
                            title: article.title || 'Untitled',
                            description: article.description || '',
                            url: article.link || '#',
                            source: r.value.cat,
                            domain: article.source_id || '',
                            date: article.pubDate || ''
                        });
                    });
                }
            });
            this.allRecommendedArticles = allArticles;
            this.recommendedArticles = allArticles;
            this.renderRecommendedArticles();
        } catch (err) {
            container.innerHTML = '<div class="m-loading"><p>Failed to load articles.</p></div>';
        }
    }

    filterRecommendedArticles(source) {
        if (source === 'all') {
            this.recommendedArticles = this.allRecommendedArticles;
        } else {
            this.recommendedArticles = this.allRecommendedArticles.filter(a => a.source === source);
        }
        this.renderRecommendedArticles();
    }

    renderRecommendedArticles() {
        const container = document.getElementById('recommendedArticles');
        if (this.recommendedArticles.length === 0) {
            container.innerHTML = '<div class="m-loading"><p>No articles found.</p></div>';
            return;
        }
        container.innerHTML = this.recommendedArticles.map(function(article, i) {
            const dateStr = article.date ? new Date(article.date).toLocaleDateString() : '';
            return '<div class="recommended-article-card">' +
                '<div>' +
                    '<div class="rec-card-header">' +
                        '<span class="rec-source-badge">' + article.source + '</span>' +
                        '<span class="rec-date">' + dateStr + '</span>' +
                    '</div>' +
                    '<div class="rec-title">' + article.title + '</div>' +
                    '<div class="rec-desc">' + article.description + '</div>' +
                '</div>' +
                '<div class="rec-card-footer">' +
                    '<span class="rec-domain">' + article.domain + '</span>' +
                    '<button class="rec-curate-btn" id="recBtn' + i + '" onclick="window.app.curateArticle(' + i + ')">Curate</button>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    async curateArticle(index) {
        const article = this.recommendedArticles[index];
        if (!article) return;
        const btn = document.getElementById('recBtn' + index);
        if (btn && btn.classList.contains('curated')) return;
        try {
            await this.apiRequest('/links', {
                method: 'POST',
                body: JSON.stringify({ url: article.url, title: article.title, category: article.source || 'other' })
            });
            if (btn) {
                btn.textContent = 'Curated';
                btn.classList.add('curated');
                btn.disabled = true;
            }
            this.loadLinks(true);
        } catch (e) {
            this.showStatus('Failed to curate', 'error');
        }
    }

    async loadLinks(silent) {
        try {
            const data = await this.apiRequest('/links');
            if (data && data.links) {
                this.links = data.links;
                this.renderLinks();
            }
        } catch (e) {
            if (!silent) this.showStatus('Failed to load links', 'error');
        }
    }

    renderLinks() {
        const container = document.getElementById('links');
        let linksToFilter = this.links;

        if (this.searchQuery) {
            if (window.Fuse) {
                const fuse = new Fuse(linksToFilter, {
                    keys: [{ name: 'title', weight: 0.7 }, { name: 'category', weight: 0.2 }, { name: 'url', weight: 0.1 }],
                    threshold: 0.4, ignoreLocation: true
                });
                linksToFilter = fuse.search(this.searchQuery).map(r => r.item);
            } else {
                const q = this.searchQuery;
                linksToFilter = linksToFilter.filter(l =>
                    (l.title || '').toLowerCase().includes(q) || (l.url || '').toLowerCase().includes(q)
                );
            }
        }

        const filtered = linksToFilter.filter(link => {
            let tabMatch = false;
            if (this.currentTab === 'read') tabMatch = link.isRead === 1;
            else if (this.currentTab === 'favorites') tabMatch = link.isFavorite === 1;
            else tabMatch = !link.isRead || link.isRead === 0;
            if (!tabMatch) return false;
            if (this.categoryFilter !== 'all') {
                if ((link.category || 'general').toLowerCase() !== this.categoryFilter.toLowerCase()) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            let msg = 'No links found';
            if (this.currentTab === 'read') msg = 'No read links';
            else if (this.currentTab === 'favorites') msg = 'No favorites yet';
            else if (this.currentTab === 'unread') msg = 'All caught up!';
            container.innerHTML = '<div class="m-empty-state">' + msg + '</div>';
            return;
        }

        const sorted = filtered.sort((a, b) => new Date(b.timestamp || b.dateAdded) - new Date(a.timestamp || a.dateAdded));
        container.innerHTML = sorted.map(function(link) {
            const domain = app.extractDomain(link.url);
            const isRead = link.isRead === 1;
            const category = link.category || 'Other';
            var q = "&#39;";
            var readBtn = !isRead
                ? '<button class="mark-read-btn" onclick="app.markAsRead(' + q + link.id + q + ', true)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Mark read</button>'
                : '<button class="mark-read-btn is-read" onclick="app.markAsRead(' + q + link.id + q + ', false)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 4 12 14.01 9 11.01"/></svg>Read</button>';
            return '<div class="link-card" data-id="' + link.id + '">' +
                '<div class="card-top">' +
                    '<span class="card-badge badge-' + category + '">' + category + '</span>' +
                    '<button class="star-btn ' + (link.isFavorite ? 'active' : '') + '" onclick="app.toggleFavorite(' + q + link.id + q + ', ' + !link.isFavorite + ')">' + (link.isFavorite ? '★' : '☆') + '</button>' +
                '</div>' +
                '<div class="card-main">' +
                    '<h3 class="card-title"><a href="' + link.url + '" target="_blank">' + (link.title || domain) + '</a></h3>' +
                    '<div class="card-domain">' + domain + '</div>' +
                '</div>' +
                '<div class="card-footer">' +
                    readBtn +
                    '<div class="card-actions">' +
                        '<button class="icon-btn" onclick="app.deleteLink(' + q + link.id + q + ')">' +
                            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
                        '</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    extractDomain(url) {
        try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
    }

    async handleAddLink(e) {
        e.preventDefault();
        const urlInput = document.getElementById('linkUrl');
        const catInput = document.getElementById('linkCategory');
        const url = urlInput ? urlInput.value.trim() : '';
        const category = catInput ? catInput.value : 'general';
        if (!url) { this.showStatus('URL is required', 'error'); return; }
        urlInput.value = '';
        if (catInput) catInput.value = '';
        document.querySelectorAll('.m-add-cat-btn').forEach(b => b.classList.remove('active'));
        this.hideMobileAddView();
        try {
            await this.apiRequest('/links', { method: 'POST', body: JSON.stringify({ url, title: '', category }) });
            await this.loadLinks(true);
        } catch (e) { await this.loadLinks(true); }
    }

    async fetchUrlTitle(url) {
        try {
            const res = await fetch('/api/meta?url=' + encodeURIComponent(url));
            const data = await res.json();
            // Title auto-populated on server side when saving
        } catch (e) {}
    }

    async markAsRead(id, isRead) {
        try {
            await this.apiRequest('/links/mark-read', { method: 'POST', body: JSON.stringify({ linkId: id, isRead }) });
            const link = this.links.find(l => l.id == id);
            if (link) { link.isRead = isRead ? 1 : 0; this.renderLinks(); }
        } catch (e) { this.showStatus('Failed to update', 'error'); }
    }

    async toggleFavorite(id, isFavorite) {
        try {
            await this.apiRequest('/links/toggle-favorite', { method: 'POST', body: JSON.stringify({ linkId: id, isFavorite }) });
            const link = this.links.find(l => l.id == id);
            if (link) { link.isFavorite = isFavorite ? 1 : 0; this.renderLinks(); }
        } catch (e) { this.showStatus('Failed to update', 'error'); }
    }

    async deleteLink(id) {
        try {
            await this.apiRequest('/links', { method: 'DELETE', body: JSON.stringify({ linkId: id }) });
            this.links = this.links.filter(l => l.id != id);
            this.renderLinks();
        } catch (e) { this.showStatus('Failed to delete', 'error'); }
    }

    async apiRequest(endpoint, options = {}) {
        const res = await fetch(this.apiBase + endpoint, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + this.token,
                ...(options.headers || {})
            }
        });
        if (res.status === 401) { localStorage.removeItem('authToken'); window.location.replace('/'); return; }
        return res.json();
    }

    logout() {
        localStorage.removeItem('authToken');
        window.location.replace('/');
    }

    showStatus(message, type = 'success') {
        const el = document.getElementById('statusMessage');
        if (!el) return;
        el.textContent = message;
        el.className = 'm-status ' + type;
        setTimeout(() => { el.className = 'm-status hidden'; }, 3000);
    }
}

const app = new LinksApp();
window.app = app;
`;
}

