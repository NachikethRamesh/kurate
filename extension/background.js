// Background service worker for the Kurate extension

/**
 * Attempts to open the extension popup, falling back to opening Kurate in a new tab
 * on browsers that don't support chrome.action.openPopup() (e.g. Firefox).
 * @param {string} [fallbackUrl='https://kurate.net/home'] - URL to open if popup isn't supported
 */
function tryOpenPopup(fallbackUrl = 'https://kurate.net/home') {
    if (typeof chrome.action.openPopup === 'function') {
        chrome.action.openPopup();
    } else {
        chrome.tabs.create({ url: fallbackUrl });
    }
}

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Kurate extension installed');
});

// Keyboard shortcut handler — allows users to save links via configurable hotkey
chrome.commands?.onCommand?.addListener((command) => {
    if (command === 'save-link') {
        tryOpenPopup();
    }
});

// Context menu integration — right-click on any page or link to save it
chrome.contextMenus?.create({
    id: 'save-to-kurate',
    title: 'Save to Kurate',
    contexts: ['page', 'link']
});

chrome.contextMenus?.onClicked?.addListener((info, tab) => {
    if (info.menuItemId === 'save-to-kurate') {
        tryOpenPopup();
    }
});
