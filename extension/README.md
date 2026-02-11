# Kurate Browser Extension

Save links to your Kurate collection with one click from any webpage.

## Features

- One-click saving with auto-filled page title and URL
- Edit titles before saving
- Categorize links (Sports, Entertainment, Business, Technology, Education, Other)
- Keyboard shortcut: `Ctrl+Shift+S` (Chrome) / `Ctrl+Shift+S` (Firefox)
- Right-click context menu to save any page
- Persistent login with secure token storage

## Installation

### Chrome

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `extension/` folder

### Firefox

1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `extension/manifest.json`

For permanent Firefox installation, the extension must be signed via [addons.mozilla.org](https://addons.mozilla.org).

## Usage

1. Click the Kurate icon in your toolbar
2. Sign in with your Kurate account (first time only)
3. The current page title and URL are pre-filled
4. Edit the title if needed
5. Select a category from the dropdown
6. Click **Save to kurate**

## File Structure

```
manifest.json    MV3 config (Chrome + Firefox compatible)
background.js    Service worker — keyboard shortcut + context menu
popup.html       Extension popup UI with accessible dropdown
popup.js         Auth, metadata fetch, save logic
popup.css        Styles
icons/           16, 32, 48, 128px icons
```

## Packaging

To create a ZIP for Chrome Web Store or Firefox Add-ons submission:

```bash
cd extension && zip -r ../kurate-extension.zip . -x "README.md"
```

## Security

- Auth tokens stored in `chrome.storage.local` / `browser.storage.local`
- Bearer token authentication on all API calls
- No passwords stored in the extension
