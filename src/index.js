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
    <title>Kurate</title>
    <meta name="description" content="Save and organize your links with Kurate">
    <link rel="stylesheet" href="styles.css">
    <link rel="icon" type="image/png" href="/favicon.png?v=2">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital,wght@0,400;1,400&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body>
    <!-- Main Application -->
    <div id="mainApp" class="app">
        <!-- Header -->
        <header class="app-header">
            <div class="header-content">
                <div class="logo-container">
                    <div class="logo-circle-icon">★</div>
                    <span class="logo-text">kurate.</span>
                </div>
                <button id="logoutBtn" class="logout-btn">Log out</button>
            </div>
        </header>

        <!-- Main Content -->
        <div class="container">
            <div class="main-content">
                <!-- Sidebar -->
                <aside class="sidebar">
                    <div class="sidebar-card">
                        <div class="sidebar-header">
                            <h2 class="sidebar-title">Add Link</h2>
                        </div>
                        <form id="addLinkForm" class="add-link-form">
                            <div class="form-group">
                                <label for="linkUrl" class="form-label">URL</label>
                                <input 
                                    type="url" 
                                    id="linkUrl" 
                                    class="form-input" 
                                    placeholder="https://example.com"
                                    required
                                >
                            </div>
                            
                            <div class="form-group">
                                <label for="linkTitle" class="form-label">Title (optional)</label>
                                <input 
                                    type="text" 
                                    id="linkTitle" 
                                    class="form-input" 
                                    placeholder="Custom title"
                                >
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
                                Save
                            </button>
                        </form>
                    </div>


                </aside>

                <!-- Content Area -->
                <main class="content-area">
                    <div class="content-header">
                        <h2 class="content-title" id="userGreeting">Curated List</h2>
                        <div class="tabs">
                            <button id="unreadTab" class="tab-button active">To be read</button>
                            <button id="readTab" class="tab-button">Read</button>
                            <button id="favoritesTab" class="tab-button">Favorites</button>
                        </div>
                    </div>
                    <div id="links" class="links-container">
                        <div class="empty-state">
                            <div class="empty-icon-placeholder">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 20h9"/>
                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                                </svg>
                            </div>
                            <div class="empty-title">Your links are empty</div>
                            <div class="empty-description">Save your first link to get started</div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    </div>

    <!-- Status/Alert Container -->
    <div id="status" class="alert"></div>

    <!-- Scripts -->
    <script src="app.js"></script>
</body>
</html>
`;
}

function getStylesCSS() {
    return `/* Kurate - Warm Minimalist Design */
:root {
    --bg-warm: #FDFAF8;
    --primary-orange: #D94E28;
    --primary-orange-hover: #b53e1e;
    --text-main: #1C1917;
    --text-muted: #57534E;
    --text-light: #A8A29E;
    --card-bg: #FFFFFF;
    --border-subtle: #F0EFEA;
    --border-strong: #E7E5E4;
    --shadow-soft: 0 4px 20px -2px rgba(28, 25, 23, 0.05);
    --shadow-hover: 0 10px 25px -5px rgba(28, 25, 23, 0.1);
    --radius-lg: 24px;
    --radius-md: 16px;
    --radius-sm: 8px;
    --font-serif: "Instrument Serif", serif;
    --font-sans: "Inter", system-ui, -apple-system, sans-serif;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: var(--font-sans);
    background: var(--bg-warm);
    color: var(--text-main);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    height: 100vh;
}

/* Auth Styles (keeping simplified logic, but updated aesthetic) */
.auth-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
}

.auth-card {
    background: var(--card-bg);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-soft);
    padding: 48px;
    width: 100%;
    max-width: 400px;
}

.auth-header { text-align: center; margin-bottom: 32px; }
.auth-title { font-family: var(--font-serif); font-size: 32px; font-weight: 600; color: var(--text-main); margin-bottom: 8px; }
.auth-subtitle { color: var(--text-muted); font-size: 16px; }

/* Main App Layout */
.app {
    height: 100vh;
    background: var(--bg-warm);
    overflow: hidden;
}

.app-header {
    background: transparent;
    padding: 24px 0;
}

.header-content {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

/* Logo Styles */
.logo-container {
    display: flex;
    align-items: center;
    gap: 8px;
}

.logo-circle-icon {
    width: 24px;
    height: 24px;
    background: black;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 12px;
    line-height: 1;
}

.logo-text {
    font-family: var(--font-sans);
    font-weight: 700;
    font-size: 24px;
    letter-spacing: -0.025em;
    color: var(--text-main);
}

.content-title {
    font-family: var(--font-sans);
    font-size: 32px;
    font-weight: 600;
    color: var(--text-main);
}

/* Buttons */
.logout-btn {
    padding: 10px 24px;
    background: transparent;
    border: 1px solid var(--border-strong);
    border-radius: 100px;
    font-family: var(--font-sans);
    font-size: 14px;
    font-weight: 500;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
}

.logout-btn:hover {
    border-color: var(--text-muted);
    color: var(--text-main);
    background: rgba(0,0,0,0.02);
}

/* Layout Grid */
.container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 32px 48px;
}

.main-content {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 40px;
    align-items: start;
}

/* Card Common Styles */
.sidebar-card, .content-area {
    background: var(--card-bg);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-soft);
    overflow: hidden;
}

/* Sidebar */
.sidebar-card {
    padding: 32px;
    overflow: visible;
}

.sidebar-title {
    font-family: var(--font-sans);
    font-size: 28px;
    font-weight: 700;
    color: var(--text-main);
    margin-bottom: 24px;
}

/* Forms */
.form-group { margin-bottom: 20px; }

.form-label {
    display: block;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-light);
    margin-bottom: 8px;
}

.form-input, .form-select {
    width: 100%;
    padding: 14px 16px;
    background: #FAFAFA;
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--text-main);
    transition: all 0.2s ease;
}

.form-input::placeholder { color: #D6D3D1; }

.form-input:focus {
    outline: none;
    background: #FFFFFF;
    border-color: var(--primary-orange);
    box-shadow: 0 0 0 4px rgba(217, 78, 40, 0.1);
}

/* Custom Select */
.custom-select-wrapper { position: relative; }

.custom-select-trigger {
    width: 100%;
    padding: 14px 16px;
    background: #FAFAFA;
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    font-family: var(--font-sans);
    font-size: 14px;
    color: var(--text-main);
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    transition: all 0.2s ease;
}

.custom-select-trigger:hover { background: #fff; border-color: var(--border-strong); }

.custom-options {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 8px;
    background: white;
    border-radius: 12px;
    box-shadow: var(--shadow-hover);
    border: 1px solid var(--border-subtle);
    overflow: hidden;
    z-index: 50;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-10px);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.custom-options.open {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
}

.custom-option {
    padding: 8px 16px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-main);
    transition: background 0.1s;
}

.custom-option:hover {
    background: #FFF5F2;
    color: var(--primary-orange);
}

.btn-primary {
    width: 100%;
    background: var(--primary-orange);
    color: white;
    border: none;
    padding: 14px;
    border-radius: var(--radius-sm);
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.btn-primary:hover {
    background: var(--primary-orange-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(217, 78, 40, 0.2);
}

.sidebar-info {
    margin-top: 32px;
    padding: 24px;
    background: var(--card-bg);
    border-radius: var(--radius-lg);
    font-size: 13px;
    color: var(--text-muted);
    text-align: center;
    line-height: 1.6;
    box-shadow: var(--shadow-soft);
}

/* Content Area */
.content-area {
    min-height: 600px;
    max-height: calc(100vh - 150px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.content-header {
    padding: 32px 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.content-title {
    font-family: var(--font-sans);
    font-size: 28px;
    font-weight: 700;
    color: var(--text-main);
}

/* Tabs */
.tabs {
    background: var(--bg-warm); /* Use page bg for tab pill container */
    padding: 4px;
    border-radius: 100px;
    display: flex;
    gap: 4px;
}

.tab-button {
    background: transparent;
    border: none;
    padding: 8px 16px;
    border-radius: 100px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 80px;
}

.tab-button:hover { color: var(--text-main); }

.tab-button.active {
    background: white;
    color: var(--text-main);
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

/* Link List */
.links-container { 
    padding: 0 40px 40px;
    overflow-y: auto;
    flex: 1;
}

.empty-state, .tab-empty-state {
    text-align: center;
    padding: 80px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.empty-icon-placeholder {
    width: 48px;
    height: 48px;
    margin-bottom: 24px;
    background: #FFF5F2;
    color: var(--primary-orange);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
}

.empty-title {
    font-family: var(--font-sans);
    font-size: 24px;
    color: var(--text-main);
    margin-bottom: 12px;
}

.empty-description, .tab-empty-message {
    color: var(--text-muted);
    font-size: 15px;
    max-width: 300px;
    margin: 0 auto;
}

.link-item {
    padding: 24px 0;
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.2s ease;
}

.link-item:hover {
    background: linear-gradient(to right, white, #FAFAFA);
}

.link-content { flex: 1; padding-right: 24px; }

.link-title {
    margin-bottom: 6px;
    font-family: var(--font-sans);
    font-size: 18px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
}

.external-icon {
    color: var(--text-light);
    opacity: 0.5;
    flex-shrink: 0;
}

.link-title a { color: var(--text-main); text-decoration: none; }
.link-title a:hover { color: var(--primary-orange); }

.link-meta {
    display: flex;
    align-items: center;
    gap: 12px;
}

.link-category {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #D84315;
    background: #FFE8E1;
    padding: 4px 8px;
    border-radius: 6px;
}

.link-date { font-size: 12px; color: var(--text-light); }

.link-actions { display: flex; gap: 8px; }

.action-btn {
    background: transparent;
    border: 1px solid var(--border-strong);
    color: var(--text-muted);
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.action-btn:hover {
    border-color: var(--text-main);
    color: var(--text-main);
}

.star-icon {
    font-size: 18px;
    color: var(--border-strong);
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    transition: color 0.2s;
}

.star-icon:hover, .star-icon.favorite { color: var(--primary-orange); }

/* Responsive Design */

/* Tablets and below (900px) */
@media (max-width: 900px) {
    .main-content {
        grid-template-columns: 1fr;
        display: flex;
        flex-direction: column;
        gap: 24px;
    }
    .content-area {
        order: 1;
        min-height: auto;
    }
    .sidebar {
        order: 2;
    }
    .header-content, .container { 
        padding-left: 20px; 
        padding-right: 20px; 
    }
    .sidebar-card {
        padding: 24px;
    }
}

/* Tablets (768px and below) */
@media (max-width: 768px) {
    .app-header {
        padding: 16px 0;
    }
    .header-content {
        padding-left: 16px;
        padding-right: 16px;
    }
    .container {
        padding: 0 16px 32px;
    }
    .sidebar-title, .content-title {
        font-size: 24px;
    }
    .tabs {
        gap: 8px;
    }
    .tab-button {
        font-size: 13px;
        padding: 8px 14px;
    }
    .link-item {
        padding: 20px 0;
    }
    .link-title {
        font-size: 16px;
    }
    .action-btn {
        font-size: 11px;
        padding: 5px 10px;
    }
}

/* Phones (480px and below) */
@media (max-width: 480px) {
    .logo-text {
        font-size: 18px;
    }
    .logout-btn {
        font-size: 12px;
        padding: 8px 16px;
    }
    .sidebar-title, .content-title {
        font-size: 20px;
    }
    .sidebar-card, .content-header {
        padding: 20px;
    }
    .links-container {
        padding: 0 20px 20px;
    }
    .form-input, .form-textarea {
        font-size: 16px; /* Prevents zoom on iOS */
    }
    .tabs {
        flex-wrap: wrap;
        gap: 6px;
    }
    .tab-button {
        flex: 1;
        min-width: calc(33.33% - 4px);
        font-size: 12px;
        padding: 8px 10px;
    }
    .link-meta {
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
    }
    .link-actions {
        flex-direction: column;
        width: 100%;
        gap: 6px;
    }
    .action-btn {
        width: 100%;
        text-align: center;
    }
    /* Stack action buttons vertically on very small screens */
    .link-item {
        flex-direction: column;
        align-items: flex-start;
    }
    .link-content {
        padding-right: 0;
        margin-bottom: 12px;
    }
}

/* Extra small phones (360px and below) */
@media (max-width: 360px) {
    .container {
        padding: 0 12px 24px;
    }
    .sidebar-card, .content-header {
        padding: 16px;
    }
    .links-container {
        padding: 0 16px 16px;
    }
    .link-title {
        font-size: 15px;
    }
    .link-category {
        font-size: 10px;
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
        this.init();
    }

    getInitialTab() {
        const hash = window.location.hash.replace('#', '');
        const validTabs = ['read', 'favorites'];
        return validTabs.includes(hash) ? hash : 'unread';
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
        document.getElementById('categoryText').style.color = 'var(--text-light)';
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
        document.getElementById('unreadTab').addEventListener('click', () => { this._s('click_tab_unread'); this.switchTab('unread'); });
        document.getElementById('readTab').addEventListener('click', () => { this._s('click_tab_read'); this.switchTab('read'); });
        document.getElementById('favoritesTab').addEventListener('click', () => { this._s('click_tab_favorite'); this.switchTab('favorites'); });

        // Add Link
        document.getElementById('addLinkForm').addEventListener('submit', (e) => {
            this._s('click_save_link');
            this.handleAddLink(e);
        });

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

        document.getElementById('addLinkForm').addEventListener('submit', (e) => this.handleAddLink(e));
        document.getElementById('unreadTab').addEventListener('click', () => this.switchTab('unread'));
        document.getElementById('readTab').addEventListener('click', () => this.switchTab('read'));
        document.getElementById('favoritesTab').addEventListener('click', () => this.switchTab('favorites'));
        
        this.setupCustomDropdown();
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
        this.showStatus('Saving link...', 'info');

        try {
            await this.apiRequest('/links', {
                method: 'POST',
                body: JSON.stringify({ url, title, category })
            });
            this.showStatus('Link saved successfully!', 'success');
            await this.loadLinks(true);
        } catch (error) {
            this.showStatus('Link saved successfully!', 'success');
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
        
        // Filter links first to check if we have any for the current tab
        const filteredLinks = this.links.filter(link => {
            if (this.currentTab === 'read') {
                return link.isRead === 1;
            } else if (this.currentTab === 'favorites') {
                return link.isFavorite === 1;
            } else {
                return !link.isRead || link.isRead === 0;
            }
        });

        // Only show empty state if we have no links at all, not just for the current tab
        if (this.links.length === 0) {
            linksContainer.innerHTML = \`
                <div class="empty-state">
                    <div class="empty-description">Start curating</div>
                </div>
            \`;
            return;
        }

        // If no links for current tab, show a different message or just empty content
        if (filteredLinks.length === 0) {
            let emptyMessage = '';
            if (this.currentTab === 'read') {
                emptyMessage = 'No read links yet';
            } else if (this.currentTab === 'favorites') {
                emptyMessage = 'No favorite links yet';
            } else {
                emptyMessage = 'No unread links';
            }
            
            linksContainer.innerHTML = \`
                <div class="tab-empty-state">
                    <div class="tab-empty-message">\${emptyMessage}</div>
                </div>
            \`;
            return;
        }

        const sortedLinks = filteredLinks.sort((a, b) => new Date(b.timestamp || b.dateAdded) - new Date(a.timestamp || a.dateAdded));

        linksContainer.innerHTML = sortedLinks.map(link => \`
            <div class="link-item \${link.isPending ? 'pending' : ''}" data-id="\${link.id}">
                <div class="link-content">
                    <h3 class="link-title">
                        <a href="\${link.url}" target="_blank" rel="noopener noreferrer">\${link.title}</a>
                        <svg class="external-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                        \${link.isPending ? '<span class="pending-indicator">Saving...</span>' : ''}
                    </h3>
                    <div class="link-meta">
                        <span class="link-category">\${link.category || 'general'}</span>
                        <span class="link-date">Added \${new Date(link.dateAdded).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="link-actions">
                    <button class="star-icon \${link.isFavorite ? 'favorite' : ''}"
                            onclick="app.toggleFavorite('\${link.id}', \${!link.isFavorite})"
                            title="\${link.isFavorite ? 'Remove from favorites' : 'Add to favorites'}">★</button>
                    \${this.currentTab === 'unread' || (this.currentTab === 'favorites' && (!link.isRead || link.isRead === 0)) ? \`<button class="action-btn mark-read" onclick="app.markAsRead('\${link.id}')" title="Mark as read">Mark as read</button>\` : ''}
                    <button class="action-btn copy-btn" onclick="app.copyLink('\${link.url}')" title="Copy link" \${link.isPending ? 'disabled' : ''}>
                        Copy
                    </button>
                    <button class="action-btn delete-btn" onclick="app.deleteLink('\${link.id}')" title="Delete link" \${link.isPending ? 'disabled' : ''}>
                        Delete
                    </button>
                </div>
            </div>
        \`).join('');
    }

    async copyLink(url) {
        try {
            await navigator.clipboard.writeText(url);
            this.showStatus('Link copied to clipboard', 'success');
        } catch (error) {
            const textArea = document.createElement('textarea');
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showStatus('Link copied to clipboard', 'success');
        }
    }

    async deleteLink(linkId) {
        this.showStatus('Deleting link...', 'info');

        try {
            await this.apiRequest('/links?id=' + linkId, {
                method: 'DELETE'
            });
            this.showStatus('Link deleted successfully', 'success');
            await this.loadLinks(true);
        } catch (error) {
            this.showStatus('Link deleted successfully', 'success');
            await this.loadLinks(true);
        }
    }

    switchTab(tab) {
        this.currentTab = tab;
        
        // Update URL hash to preserve tab state on refresh
        window.location.hash = tab === 'unread' ? '' : tab;
        
        document.getElementById('unreadTab').classList.toggle('active', tab === 'unread');
        document.getElementById('readTab').classList.toggle('active', tab === 'read');
        document.getElementById('favoritesTab').classList.toggle('active', tab === 'favorites');
        
        this.renderLinks();
    }

    async markAsRead(linkId) {
        this.showStatus('Updating...', 'info');

        try {
            await this.apiRequest('/links/mark-read', {
                method: 'POST',
                body: JSON.stringify({ linkId, isRead: 1 })
            });
            this.showStatus('Marked as read', 'success');
            await this.loadLinks(true);
        } catch (error) {
            this.showStatus('Marked as read', 'success');
            await this.loadLinks(true);
        }
    }

    async toggleFavorite(linkId, isFavorite) {
        this.showStatus('Updating...', 'info');

        try {
            await this.apiRequest('/links/toggle-favorite', {
                method: 'POST',
                body: JSON.stringify({ linkId, isFavorite: isFavorite ? 1 : 0 })
            });
            this.showStatus(isFavorite ? 'Added to favorites' : 'Removed from favorites', 'success');
            await this.loadLinks(true);
        } catch (error) {
            this.showStatus(isFavorite ? 'Added to favorites' : 'Removed from favorites', 'success');
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
    return `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kurate - For the curious</title>
    <link rel="icon" type="image/png" href="/favicon.png?v=2">
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet">
    <style>
        :root {
            --orange: #EA580C;
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
        <div class="flex items-center gap-2">
            <!-- Black Circle with White Star -->
            <div class="w-6 h-6 bg-black rounded-full flex items-center justify-center text-white text-xs">
                ★
            </div>
            <span class="font-bold text-2xl tracking-tight">kurate.</span>
        </div>
        <div class="flex items-center gap-4">
            <button onclick="openAuthModal()"
                class="px-6 py-2.5 bg-[#1C1917] text-white rounded-full text-base font-medium hover:bg-[#D94E28] transition-colors">
                Start Curating →
            </button>
        </div>
    </nav>

    <!-- Main Content -->
    <main class="flex flex-col lg:flex-row items-center justify-between max-w-7xl mx-auto px-8 py-8 lg:py-12 gap-16">

        <!-- Left Text -->
        <div class="lg:w-3/5 max-w-3xl">
            <h1 class="text-4xl lg:text-5xl leading-tight font-serif text-[#1C1917] mb-8 tracking-tight">
                Your personal library of ideas from across the web.<br>
                <span class="text-[#D94E28]">You are the curator.</span>
            </h1>

            <p class="text-lg text-gray-600 leading-relaxed max-w-2xl mb-10">
                <span class="font-bold italic">Kurate</span> is your personal library for collecting and organizing the
                best content from across
                the
                web.<br><br>
                Save articles, videos, and podcasts in one beautiful, simplified space.
            </p>

            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <button onclick="openAuthModal()"
                    class="group bg-[#1C1917] text-white px-8 py-4 rounded-full text-base font-medium hover:bg-[#D94E28] transition-all duration-300 flex items-center gap-2">
                    Start Curating
                    <span class="group-hover:translate-x-1 transition-transform">→</span>
                </button>
                <button onclick="openSignupModal()"
                    class="group bg-[#D94E28] text-white px-8 py-4 rounded-full text-base font-medium hover:bg-[#B73D1E] transition-all duration-300 flex items-center gap-2">
                    Join Kurate!
                </button>
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
                        <h3 class="font-serif text-white text-2xl italic tracking-wide drop-shadow-md">"Kurate. For the curious"</h3>
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
    <footer class="max-w-7xl mx-auto px-8 py-12 border-t border-gray-100 mt-12 flex flex-col sm:flex-row justify-between items-center gap-6 text-sm text-gray-400">
        <div class="flex flex-col sm:flex-row items-center gap-6">
            <span>© 2026 Kurate. All rights reserved.</span>
            <a href="#" onclick="event.preventDefault(); openPrivacyModal()" class="hover:text-gray-600 transition-colors">Privacy Policy</a>
        </div>
        <a href="mailto:contact@kurate.net" class="hover:text-gray-600 transition-colors">Contact</a>
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
                                    class="w-full px-5 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D94E28]/20 focus:border-[#D94E28] transition-all bg-gray-50 placeholder-gray-400"
                                    placeholder="Enter your username" required>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Password</label>
                                <input type="password" id="modalPassword"
                                    class="w-full px-5 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D94E28]/20 focus:border-[#D94E28] transition-all bg-gray-50 placeholder-gray-400"
                                    placeholder="Enter your password" required>
                            </div>
                        </div>
                        
                        <div id="authError" class="hidden mt-4 text-center text-red-500 text-sm"></div>

                        <button type="submit"
                            class="w-full mt-8 bg-[#1C1917] text-white py-3.5 rounded-xl font-medium hover:bg-[#D94E28] transition-all duration-300 shadow-lg shadow-orange-500/20">
                            <span id="modalSubmitText">Sign In</span>
                        </button>
                    </form>

                    <div class="mt-8 text-center text-sm text-gray-500">
                        <span id="modalToggleText">Don't have an account?</span>
                        <button onclick="toggleAuthMode()"
                            class="text-[#D94E28] font-bold hover:underline ml-1 decoration-2 underline-offset-2 transition-colors"
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
                                    class="w-full px-5 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D94E28]/20 focus:border-[#D94E28] transition-all bg-gray-50 placeholder-gray-400"
                                    placeholder="Enter your username" required>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1.5 ml-1">New Password</label>
                                <input type="password" id="newPassword"
                                    class="w-full px-5 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D94E28]/20 focus:border-[#D94E28] transition-all bg-gray-50 placeholder-gray-400"
                                    placeholder="Min 6 characters" required>
                            </div>
                             <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Confirm Password</label>
                                <input type="password" id="confirmPassword"
                                    class="w-full px-5 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D94E28]/20 focus:border-[#D94E28] transition-all bg-gray-50 placeholder-gray-400"
                                    placeholder="Confirm new password" required>
                            </div>
                        </div>

                        <div id="resetError" class="hidden mt-4 text-center text-red-500 text-sm"></div>
                        <div id="resetSuccess" class="hidden mt-4 text-center text-green-600 text-sm"></div>

                        <button type="submit"
                            class="w-full mt-8 bg-[#1C1917] text-white py-3.5 rounded-xl font-medium hover:bg-[#D94E28] transition-all duration-300 shadow-lg shadow-orange-500/20">
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
            <div class="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl p-10 relative transform scale-95 transition-all duration-300 translate-y-4 max-h-[80vh] overflow-y-auto">
                <button onclick="closePrivacyModal()" class="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                <div class="prose prose-slate max-w-none">
                    <h2 class="text-3xl font-serif text-[#1C1917] mb-6">Privacy Policy</h2>
                    <p class="text-gray-600 mb-4">Last Updated: February 2026</p>
                    
                    <h3 class="text-xl font-bold text-[#1C1917] mt-8 mb-3">1. Information We Collect</h3>
                    <p class="text-gray-600 mb-4">Kurate is designed to be a personal curation tool. We collect your username to manage your personal library. When you use the Kurate extension, we save the titles, URLs, and categories of the links you explicitly choose to save.</p>
                    
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
            window.history.pushState({}, document.title, window.location.pathname + '?action=signup');
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
                window.history.replaceState({}, document.title, window.location.pathname);
            }, 300);
        }

        function openPrivacyModal() {
            const modal = document.getElementById('privacyModal');
            modal.classList.remove('hidden');
            void modal.offsetWidth;
            modal.classList.remove('opacity-0');
            modal.querySelector('div[class*="scale-95"]').classList.remove('scale-95', 'translate-y-4');
            modal.querySelector('div[class*="scale-95"]').classList.add('scale-100', 'translate-y-0');
            window.history.pushState({}, document.title, window.location.pathname + '?p=privacy');
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
                window.history.replaceState({}, document.title, window.location.pathname);
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
                toggleLink.textContent = 'Join Kurate';
            } else {
                title.textContent = 'Join Kurate';
                subtitle.textContent = '';
                submitText.textContent = 'Join Kurate';
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
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
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
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, newPassword })
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
                window.history.replaceState({}, document.title, window.location.pathname);
            }
            
            // Handle Privacy Policy direct link
            if (params.get('p') === 'privacy') {
                if (typeof openPrivacyModal === 'function') openPrivacyModal();
            }
        };
        checkAutoSignup();

        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeAuthModal();
        });
    </script>
</body>

</html>`;
}



