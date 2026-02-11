// PUSH NOTIFICATIONS DISABLED FOR RECOMMENDATIONS
// // Setup daily reminder at 9:05 AM
// function setupDailyReminder() {
//     chrome.alarms.create('daily-reminder', {
//         when: getNext905AM(),
//         periodInMinutes: 1440 // Every 24 hours
//     });
// }
//
// function getNext905AM() {
//     const now = new Date();
//     const next = new Date();
//     next.setHours(9, 5, 0, 0);
//
//     // If 9:05 AM has already passed today, set for tomorrow
//     if (next <= now) {
//         next.setDate(next.getDate() + 1);
//     }
//     return next.getTime();
// }

chrome.runtime.onInstalled.addListener(() => {
    console.log('Kurate extension installed');
    // PUSH NOTIFICATIONS DISABLED FOR RECOMMENDATIONS
    // setupDailyReminder();
});

// PUSH NOTIFICATIONS DISABLED FOR RECOMMENDATIONS
// chrome.alarms.onAlarm.addListener((alarm) => {
//     if (alarm.name === 'daily-reminder') {
//         chrome.notifications.create({
//             type: 'basic',
//             iconUrl: 'icons/icon-128.png',
//             title: 'Kurate',
//             message: "Here's your top pick of the day. Read more on Kurate",
//             priority: 2
//         });
//     }
// });

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
