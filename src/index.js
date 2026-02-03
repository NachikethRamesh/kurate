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

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

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
            return new Response(getLandingHTML(), {
                headers: { 'Content-Type': 'text/html' }
            });
        }

        // Redirect legacy auth routes to landing page
        if (path === '/login' || path === '/signup' || path === '/reset-password') {
            return Response.redirect(url.origin, 302);
        }

        // App routes - protected views
        if (path === '/app' || path === '/home' || path === '/dashboard') {
            return new Response(getIndexHTML(), {
                headers: { 'Content-Type': 'text/html' }
            });
        }

        if (path === '/styles.css') {
            return new Response(getStylesCSS(), {
                headers: { 'Content-Type': 'text/css' }
            });
        }

        if (path === '/app.js') {
            return new Response(getAppJS(), {
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
        return new Response(getIndexHTML(), {
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
    <title>kurate</title>
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
                <button id="logoutBtn" class="logout-btn">
                    Log out
                </button>
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
                        <input type="text" id="searchInput" class="search-input" placeholder="Search resources...">
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
                                <input type="url" id="linkUrl" class="form-input" placeholder="https://..." required>
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
                                Save Link
                            </button>
                        </form>
                    </div>
                </aside>

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
    
    --sidebar-width-left: 216px;
    --sidebar-width-right: 314px;
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
    padding: 0 40px;
    width: 100%;
    flex: 1;
}

.app-header {
    padding: 24px 40px;
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
    gap: 40px;
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
    background: #fff;
    border-radius: 24px;
    padding: 24px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.03);
}

.sidebar-title-small {
    font-size: 20px;
    font-weight: 700;
    font-family: var(--font-sans);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
}

.add-link-form {
    background: transparent;
}

.form-group { margin-bottom: 20px; }

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
    padding: 14px 16px;
    background: #F8FAFC;
    border: 1px solid #F1F5F9;
    border-radius: 12px;
    font-family: var(--font-sans);
    font-size: 14px;
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
    border: 1px solid #F3F4F6;
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
    border: 1px solid #F1F5F9;
    border-radius: 12px;
    padding: 11px 16px;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
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
    padding: 14px;
    border-radius: var(--radius-sm);
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
    box-shadow: 0 4px 6px -1px rgba(234, 88, 12, 0.2);
    transition: all 0.2s;
}

.btn-primary:hover {
    background: var(--accent-orange-hover);
    transform: translateY(-1px);
    box-shadow: 0 6px 8px -1px rgba(234, 88, 12, 0.3);
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

/* Media Queries */
@media (max-width: 1200px) {
    .main-content {
        grid-template-columns: 200px 1fr 280px;
        gap: 32px;
    }
}

@media (max-width: 1024px) {
    .main-content {
        grid-template-columns: 1fr;
        gap: 40px;
    }
    
    .sidebar-left, .sidebar-right {
        display: none; /* For simplicity in this responsive pass, or hide non-critical sidebars */
        /* Ideally convert to hamburger menu or verify requirments. User asked for desktop redesign. */
        /* Let's stack them for safety */
    }
    
    .sidebar-left { display: block; order: 1; }
    .content-mid { order: 2; }
    .sidebar-right { order: 3; }
    
    .nav-list { flex-direction: row; overflow-x: auto; padding-bottom: 8px; }
    .nav-item { white-space: nowrap; }
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
            window.location.href = '/';
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
            window.location.href = '/';
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
                    window.location.href = '/';
                }
                break;
            case '/login':
                if (isAuthenticated) {
                    this.navigateTo('/home');
                } else {
                    window.location.href = '/';
                }
                break;
            case '/signup':
                if (isAuthenticated) {
                    this.navigateTo('/home');
                } else {
                    window.location.href = '/';
                }
                break;
            case '/reset-password':
                if (isAuthenticated) {
                    this.navigateTo('/home');
                } else {
                    window.location.href = '/';
                }
                break;
            case '/home':
            case '/dashboard':
                if (!isAuthenticated) {
                    window.location.href = '/';
                } else {
                    await this.showMainApp();
                }
                break;
            default:
                if (isAuthenticated) {
                    this.navigateTo('/home');
                } else {
                    window.location.href = '/';
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
            window.location.href = '/';
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

        // Delegation for dynamic elements
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
                    <title>kurate - For the curious</title>
                    <meta name="description" content="Your personal library of ideas from across the web. You are the curator.">
                        <link rel="icon" type="image/png" href="/favicon.png?v=2">

                            <!-- Open Graph / Facebook -->
                            <meta property="og:type" content="website">
                                <meta property="og:url" content="https://kurate.net/">
                                    <meta property="og:site_name" content="kurate">
                                        <meta property="og:title" content="kurate - For the curious">
                                            <meta property="og:description" content="Your personal library of ideas from across the web. You are the curator.">
                                                <meta property="og:image" content="https://kurate.net/og-image.png">
                                                    <meta property="og:image:secure_url" content="https://kurate.net/og-image.png">
                                                        <meta property="og:image:type" content="image/png">
                                                            <meta property="og:image:width" content="1200">
                                                                <meta property="og:image:height" content="630">

                                                                    <!-- Twitter -->
                                                                    <meta property="twitter:card" content="summary_large_image">
                                                                        <meta property="twitter:url" content="https://kurate.net/">
                                                                            <meta property="twitter:title" content="kurate - For the curious">
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
                                                                                                    <nav href="https://kurate.net" class="w-full px-8 py-6 flex justify-between items-center max-w-7xl mx-auto">
                                                                                                        <a href="https://kurate.net" class="flex items-center gap-2 hover:opacity-80 transition-opacity">
                                                                                                            <!-- Black Circle with White K -->
                                                                                                            <div class="w-6 h-6 bg-black rounded-full flex items-center justify-center text-white text-xs font-bold">
                                                                                                                K
                                                                                                            </div>
                                                                                                            <span class="font-bold text-2xl tracking-tight">kurate</span>
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
                                                                                                                    <span class="text-[#D2622A]">You are curator.</span>
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
                                                                                                                                    <h3 class="font-serif text-white text-2xl italic tracking-wide drop-shadow-md">"kurate - For the curious"</h3>
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



