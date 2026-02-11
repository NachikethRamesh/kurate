function getStylesCSS() {
    return `/* kurate - Modern Clean Design */
:root {
    --bg-page: #FFFFFF;
    --text-primary: #111827; /* Gray 900 */
    --text-secondary: #6B7280; /* Gray 500 */
    --text-tertiary: #9CA3AF; /* Gray 400 */
    --accent-orange: #EA580C;
    --accent-orange-light: #FFEDD5; /* Orange 100 */
    --accent-orange-hover: #C2410C;
    --border-light: #E5E7EB; /* Gray 200 */
    --card-hover-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
    
    --font-serif: "Instrument Serif", serif;
    --font-sans: "Inter", system-ui, -apple-system, sans-serif;
    
    --radius-lg: 16px;
    --radius-md: 12px;
    --radius-sm: 8px;
    
    --sidebar-width-left: 240px;
    --sidebar-width-right: 320px;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: var(--font-sans);
    background: var(--bg-page);
    color: var(--text-primary);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
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
}

.logo-text {
    font-weight: 700;
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
    gap: 64px;
    padding-top: 24px;
    padding-bottom: 64px;
}

/* Left Sidebar: Navigation */
.nav-section { margin-bottom: 40px; }

.nav-header {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-tertiary);
    margin-bottom: 16px;
}

.nav-list { display: flex; flex-direction: column; gap: 4px; }

.nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    font-family: var(--font-sans);
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
}

.nav-item:hover { color: var(--text-primary); background: #F3F4F6; }

.nav-item.active {
    background: var(--accent-orange-light);
    color: var(--accent-orange);
}

.nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: inherit;
    opacity: 0.8;
}

.category-item { padding-left: 12px; } /* Simple list for categories */

/* Content Area */
.content-mid { display: flex; flex-direction: column; }

.content-header { margin-bottom: 24px; }

.content-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
}

.content-title span {
    color: var(--accent-orange);
}

/* Search */
.search-container {
    position: relative;
    margin-bottom: 32px;
}

.search-input {
    width: 100%;
    padding: 12px 16px 12px 48px;
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    font-family: var(--font-sans);
    font-size: 15px;
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
.links-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); /* Responsive cards */
    gap: 20px;
}

/* Link Card */
.link-card {
    background: #fff;
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: all 0.2s;
    position: relative;
    min-height: 160px;
}

.link-card:hover {
    box-shadow: var(--card-hover-shadow);
    border-color: #D1D5DB;
    transform: translateY(-2px);
}

.card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
}

.card-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    padding: 4px 8px;
    border-radius: 4px;
    background: #F3F4F6;
    color: var(--text-secondary);
}

/* Dynamic Badge Colors */
.badge-Business { background: #FFEDD5; color: #9A3412; }
.badge-Technology { background: #DBEAFE; color: #1E40AF; }
.badge-Design { background: #FCE7F3; color: #9D174D; }
.badge-Sports { background: #DCFCE7; color: #166534; }
.badge-Education { background: #E0E7FF; color: #3730A3; }

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
}

.star-btn:hover, .star-btn.active { color: #FBBF24; /* Gold/Yellow */ }

.card-main { margin-bottom: 20px; flex: 1; }

.card-title {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.4;
    margin-bottom: 4px;
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
    font-size: 13px;
    color: var(--text-tertiary);
}

.card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #F3F4F6;
    padding-top: 16px;
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
    border-radius: var(--radius-lg);
    padding: 0; 
}

.sidebar-title-small {
    font-size: 16px;
    font-weight: 700;
    color: var(--accent-orange);
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 24px;
}

.plus-icon { font-size: 18px; }

.add-link-form {
    background: #fff;
}

.form-group { margin-bottom: 20px; }

.form-label {
    display: block;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-tertiary);
    margin-bottom: 8px;
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

/* Custom Select (Reuse existing logic but style update) */
.custom-select-trigger {
    background: #F9FAFB;
    border: 1px solid #F3F4F6;
    border-radius: var(--radius-sm);
    padding: 12px 16px;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
    color: var(--text-secondary); /* Default placeholder color */
    cursor: pointer;
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
    padding: 10px 16px;
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

/* Load More */
.load-more-container {
    margin-top: 40px;
    text-align: center;
}

.load-more-btn {
    background: #fff;
    border: 1px solid var(--border-light);
    padding: 10px 24px;
    border-radius: 100px;
    font-family: var(--font-sans);
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s;
}

.load-more-btn:hover { border-color: var(--text-primary); }

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
