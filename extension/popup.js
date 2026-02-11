// Extension popup configuration
const CONFIG = {
    API_BASE: 'https://kurate.net/api',
    SITE_URL: 'https://kurate.net',
    HOME_URL: 'https://kurate.net/home',
    SIGNUP_URL: 'https://kurate.net?action=signup'
};

// DOM Elements
const loginView = document.getElementById('loginView');
const saveView = document.getElementById('saveView');
const successView = document.getElementById('successView');
const loginForm = document.getElementById('loginForm');
const saveForm = document.getElementById('saveForm');
const logoutBtn = document.getElementById('logoutBtn');
const viewLinksBtn = document.getElementById('viewLinksBtn');
const saveAnotherBtn = document.getElementById('saveAnotherBtn');

// Custom Dropdown Elements
const dropdownTrigger = document.getElementById('dropdownTrigger');
const dropdownOptions = document.getElementById('dropdownOptions');
const selectedCategoryText = document.getElementById('selectedCategory');
const categoryInput = document.getElementById('category');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const token = await getAuthToken();
    if (token) {
        await showSaveView();
    } else {
        showView('loginView');
    }

    setupCustomDropdown();
    setupLogoLink();
    setupErrorHandlers();
});

/**
 * Clears login error messages when the user starts typing in username/password fields.
 */
function setupErrorHandlers() {
    const loginInputs = ['username', 'password'];
    loginInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                const errorEl = document.getElementById('loginError');
                if (errorEl) {
                    errorEl.textContent = '';
                    errorEl.classList.add('hidden');
                }
            });
        }
    });
}

// Logo Click Logic
function setupLogoLink() {
    document.querySelectorAll('.logo').forEach(logo => {
        logo.addEventListener('click', () => {
            chrome.tabs.create({ url: CONFIG.SITE_URL });
        });
    });
}

/**
 * Initializes the custom category dropdown — handles open/close, selection, and click-outside dismissal.
 */
function setupCustomDropdown() {
    if (!dropdownTrigger) return;

    dropdownTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdownTrigger.classList.toggle('active');
        dropdownOptions.classList.toggle('active');
        dropdownTrigger.setAttribute('aria-expanded', isOpen);
    });

    document.querySelectorAll('.dropdown-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const val = option.dataset.value;
            const text = option.textContent;

            selectedCategoryText.textContent = text;
            categoryInput.value = val;
            selectedCategoryText.style.color = 'var(--text-main)';

            // Mark as selected
            document.querySelectorAll('.dropdown-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');

            // Close dropdown
            dropdownTrigger.classList.remove('active');
            dropdownOptions.classList.remove('active');
            dropdownTrigger.setAttribute('aria-expanded', 'false');

            // UX: Clear error when category is selected
            const statusEl = document.getElementById('saveStatus');
            if (statusEl) {
                statusEl.textContent = '';
                statusEl.classList.remove('error', 'success');
            }
        });
    });

    // Close on click outside
    document.addEventListener('click', () => {
        if (dropdownTrigger) {
            dropdownTrigger.classList.remove('active');
            dropdownOptions.classList.remove('active');
            dropdownTrigger.setAttribute('aria-expanded', 'false');
        }
    });
}

// View Management
function showView(viewId) {
    [loginView, saveView, successView].forEach(view => {
        if (view) view.classList.add('hidden');
    });
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');
}

/**
 * Switches to the save-link view and populates the URL display with the active tab's URL.
 */
async function showSaveView() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const urlDisplay = document.getElementById('urlDisplay');
    if (urlDisplay) urlDisplay.textContent = tab.url || '';

    window.currentUrl = tab.url;
    window.currentTabTitle = tab.title || ''; // Store for fallback
    showView('saveView');
}

// Authentication
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const errorEl = document.getElementById('loginError');

        try {
            const response = await fetch(`${CONFIG.API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success && data.token) {
                await chrome.storage.local.set({ authToken: data.token, username: username });
                errorEl.textContent = '';
                errorEl.classList.add('hidden');
                await showSaveView();
            } else {
                // UX: If user not found, auto-redirect to sign-up on website
                if (data.error === 'User not found') {
                    chrome.tabs.create({ url: CONFIG.SIGNUP_URL });
                    window.close();
                    return;
                }
                errorEl.textContent = data.error || 'Login failed';
                errorEl.classList.remove('hidden');
            }
        } catch (error) {
            errorEl.textContent = 'Connection error. Please try again.';
            errorEl.classList.remove('hidden');
        }
    });

    // Manual Join Link
    const joinLink = document.getElementById('joinLink');
    if (joinLink) {
        joinLink.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.tabs.create({ url: CONFIG.SIGNUP_URL });
            window.close();
        });
    }
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await chrome.storage.local.remove(['authToken', 'username']);
        showView('loginView');
    });
}

/**
 * Handles the save-link form submission — fetches page title from backend,
 * then saves the link with the selected category.
 */
if (saveForm) {
    saveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const statusEl = document.getElementById('saveStatus');
        const category = categoryInput.value;
        const url = window.currentUrl;

        if (!category) {
            statusEl.textContent = 'Please select a category';
            statusEl.className = 'status error';
            return;
        }

        try {
            const token = await getAuthToken();

            // Fetch title from backend API, fall back to tab title on failure
            let title = window.currentTabTitle;
            try {
                const metaResponse = await fetch(`${CONFIG.API_BASE}/meta?url=${encodeURIComponent(url)}`);
                if (metaResponse.ok) {
                    const metaData = await metaResponse.json();
                    if (metaData && metaData.title) {
                        title = metaData.title;
                    }
                }
            } catch (metaError) {
                console.log('Meta fetch failed, using tab title:', metaError);
            }

            const response = await fetch(`${CONFIG.API_BASE}/links`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ url, title, category })
            });

            const data = await response.json();

            if (data.success) {
                showView('successView');
            } else {
                statusEl.textContent = data.error || 'Failed to save link';
                statusEl.className = 'status error';
            }
        } catch (error) {
            statusEl.textContent = 'Connection error. Please try again.';
            statusEl.className = 'status error';
        }
    });
}

if (viewLinksBtn) {
    viewLinksBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: CONFIG.HOME_URL });
        window.close();
    });
}

if (saveAnotherBtn) {
    saveAnotherBtn.addEventListener('click', async () => {
        if (saveForm) saveForm.reset();
        // Reset custom dropdown
        selectedCategoryText.textContent = 'Select Category';
        selectedCategoryText.style.color = 'var(--text-muted)';
        categoryInput.value = '';
        document.querySelectorAll('.dropdown-option').forEach(opt => opt.classList.remove('selected'));

        await showSaveView();
    });
}

/**
 * Retrieves the stored auth token from chrome.storage.local.
 * @returns {Promise<string|null>}
 */
async function getAuthToken() {
    const result = await chrome.storage.local.get('authToken');
    return result.authToken || null;
}
