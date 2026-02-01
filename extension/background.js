// Background service worker for the Kurate extension

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Kurate extension installed');
});

// Optional: Add keyboard shortcut handler
chrome.commands?.onCommand?.addListener((command) => {
    if (command === 'save-link') {
        // chrome.action.openPopup() is not supported in Firefox yet
        if (typeof chrome.action.openPopup === 'function') {
            chrome.action.openPopup();
        } else {
            console.log('openPopup not supported on this browser');
        }
    }
});

// Optional: Context menu integration (right-click to save link)
chrome.contextMenus?.create({
    id: 'save-to-kurate',
    title: 'Save to Kurate',
    contexts: ['page', 'link']
});

chrome.contextMenus?.onClicked?.addListener((info, tab) => {
    if (info.menuItemId === 'save-to-kurate') {
        if (typeof chrome.action.openPopup === 'function') {
            chrome.action.openPopup();
        } else {
            console.log('openPopup not supported on this browser');
            // Fallback for Firefox: open the home page or a tab
            chrome.tabs.create({ url: 'https://kurate.net/home' });
        }
    }
});
