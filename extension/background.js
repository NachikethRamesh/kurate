// Background service worker for the Kurate extension

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Kurate extension installed');
});

// Optional: Add keyboard shortcut handler
chrome.commands?.onCommand?.addListener((command) => {
    if (command === 'save-link') {
        chrome.action.openPopup();
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
        chrome.action.openPopup();
    }
});
