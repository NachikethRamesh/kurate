# Kurate Browser Extension

Save links to your Kurate collection with one click from any webpage.

## Features

- 🔐 Secure authentication with your Kurate account
- 📝 Edit link titles before saving
- 🏷️ Categorize links (Article, Video, Podcast, Tool, Book, Course, etc.)
- ✨ Clean, minimal interface matching Kurate's design
- 🚀 One-click saving from any webpage

## Installation

### Chrome / Edge / Brave

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `extension` folder
5. The Kurate extension icon should appear in your toolbar

### Firefox

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Navigate to the `extension` folder and select `manifest.json`
4. The extension will be loaded temporarily (until browser restart)

**Note:** For permanent installation in Firefox, the extension needs to be signed by Mozilla.

## Usage

1. Click the Kurate extension icon in your browser toolbar
2. Sign in with your Kurate credentials (first time only)
3. The current page title and URL will be pre-filled
4. Edit the title if desired
5. Select a category
6. Click "Save to Kurate"
7. Done! Your link is now saved to your collection

## Development

To modify the extension for local development:

1. Edit `popup.js` and change `API_BASE` to `http://localhost:8787/api`
2. Make your changes
3. Reload the extension in `chrome://extensions/` or `about:debugging`

## Icons

The extension currently references icon files that need to be created. You can:
- Use the favicon from the Kurate website
- Create custom icons at these sizes: 16x16, 32x32, 48x48, 128x128
- Place them in an `icons/` folder within the extension directory

## API Configuration

The extension connects to `https://kurate.net/api` by default. To use with a local development server:
- Uncomment the localhost line in `popup.js`
- Make sure your local server is running on port 8787

## Security

- Authentication tokens are stored securely in browser local storage
- Tokens are sent via Bearer authentication
- No passwords are stored in the extension

## Support

For issues or questions, visit https://kurate.net
