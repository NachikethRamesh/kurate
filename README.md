# Kurate

Your personal library for collecting and organizing the best content from across the web.

## Architecture

Kurate is a multi-platform app spanning a web dashboard, browser extensions, and a native mobile app — all backed by a single Cloudflare Workers API.

- **Web App**: Vanilla JS SPA embedded in a Cloudflare Worker (`src/index.js`), serving both desktop and mobile layouts via user-agent detection
- **API**: Cloudflare Workers serverless functions with JWT authentication
- **Database**: Cloudflare D1 (SQLite)
- **Browser Extensions**: Manifest V3, Chrome and Firefox
- **Mobile App**: React Native / Expo (iOS + Android)

## Quick Start

### Install Dependencies

```bash
npm install
```

### Local Development

```bash
npx wrangler dev
```

Serves both frontend and backend at `http://127.0.0.1:8787`.

### Deploy

```bash
npm run deploy
```

Deploys to Cloudflare Workers at `https://kurate.net`.

### Database Setup

```bash
npm run setup:d1
```

Creates the D1 database and runs the schema from `schema.sql`.

## Project Structure

```
src/
  index.js         Main worker — routing, HTML/CSS/JS generation
  auth.js          JWT authentication handlers
  database.js      D1 database operations
  links.js         Link CRUD API handlers
  constants.js     Shared constants and response helpers
  feeds.js         RSS feed configuration (shared across desktop + mobile web)
  landing.html     Landing page (Tailwind CSS)

extension/
  manifest.json    Extension config (MV3, Chrome + Firefox)
  background.js    Service worker — keyboard shortcuts, context menu
  popup.html       Extension popup UI
  popup.js         Popup logic — auth, save links, metadata fetch
  popup.css        Popup styles
  icons/           Extension icons (16, 32, 48, 128px)

mobile-app/
  App.js           Root component — navigation and auth state
  src/
    api.js         API client (login, register, links, metadata)
    constants.js   Colors, API URL, categories
    feeds.js       RSS feed configuration
    rss.js         RSS service — fetch, cache, deduplicate articles
    sharedStorage.js  MMKV shared storage for share extension
    screens/
      HomeScreen.js               Main link list with draggable FABs
      AddLinkScreen.js             Add link form with metadata fetch
      LoginScreen.js               Auth screen (login + register)
      ResetPasswordScreen.js       Password reset flow
      RecommendedReadingScreen.js  RSS article browser by category
      ShareExtensionScreen.js      iOS share extension screen

public/              Static assets served by Cloudflare
scripts/
  deploy.js          Deployment script
  setup-d1.js        D1 database setup
schema.sql           Database schema
wrangler.toml        Cloudflare Workers config
```

## Features

- **Link Management** — Save, categorize, favorite, and mark links as read
- **Fuzzy Search** — Fuse.js-powered search across titles, URLs, and categories
- **Recommended Reading** — Curated RSS feeds from 125+ sources across 6 categories
- **Browser Extensions** — One-click save from any tab (Chrome + Firefox)
- **iOS Share Extension** — Save links directly from Safari and other apps
- **Responsive Design** — Desktop sidebar layout, tablet/mobile single-column with hamburger drawer
- **Cloud Sync** — All data stored in Cloudflare D1, accessible from any device

## Security

- JWT authentication with SHA-256 password hashing
- Complete data isolation per user
- Bearer token auth on all API endpoints
- Privacy policy at `kurate.net/?p=privacy`
