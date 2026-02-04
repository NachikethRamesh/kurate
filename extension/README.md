# kurate Browser Extension

Save links to your kurate collection with one click from any webpage.

## Features

- 🔐 Secure authentication with your kurate account
- 📝 Edit link titles before saving
- 🏷️ Categorize links (Article, Video, Podcast, Tool, Book, Course, etc.)
- ✨ Clean, minimal interface matching kurate's design
- 🚀 One-click saving from any webpage

## Installation

### Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `extension` folder
5. The kurate extension icon should appear in your toolbar

### Firefox

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Navigate to the `extension` folder and select `manifest.json`
4. The extension will be loaded temporarily (until browser restart)

**Note:** For permanent installation in Firefox, the extension needs to be signed by Mozilla.

## Usage

1. Click the kurate extension icon in your browser toolbar
2. Sign in with your kurate credentials (first time only)
3. The current page title and URL will be pre-filled
4. Edit the title if desired
5. Select a category
6. Click "Save to kurate"
7. Done! Your link is now saved to your collection

## Icons

The extension currently references icon files that need to be created. You can:
- Use the favicon from the kurate website
- Create custom icons at these sizes: 16x16, 32x32, 48x48, 128x128
- Place them in an `icons/` folder within the extension directory

## Security

- Authentication tokens are stored securely in browser local storage
- Tokens are sent via Bearer authentication
- No passwords are stored in the extension

## Support

For issues or questions, visit https://kurate.net
