# Kurate Mobile App

React Native / Expo app for iOS and Android. Save, organize, and browse curated links on the go.

## Features

- **Home Screen** — Browse, search, favorite, and manage saved links with draggable FAB buttons
- **Add Link** — Paste a URL and auto-fetch the page title, then pick a category
- **Recommended Reading** — Browse 125+ RSS feeds across Sports, Entertainment, Business, Technology, Education, and Other
- **iOS Share Extension** — Save links directly from Safari and other apps without opening Kurate
- **Authentication** — Login, register, and password reset flows with secure token storage

## Setup

### Prerequisites

- Node.js >= 16
- Expo CLI: `npm install -g eas-cli`
- iOS: Xcode (for simulator/device builds)
- Android: Android Studio (for emulator/device builds)

### Install Dependencies

```bash
cd mobile-app
npm install
```

### Run Development Server

```bash
npx expo start
```

Press `i` for iOS simulator or `a` for Android emulator.

### Build for iOS

```bash
eas build --platform ios
```

### Build for Android

```bash
eas build --platform android
```

## Project Structure

```
App.js               Root component — navigation stack + auth state
app.json             Expo config (bundle ID, plugins, splash screen)
index.share.js       Entry point for iOS share extension

src/
  api.js             API client — login, register, links, metadata, password reset
  constants.js       Colors, API URL, categories
  feeds.js           RSS feed configuration (125+ sources)
  rss.js             RSS service — fetch, cache, deduplicate articles
  sharedStorage.js   MMKV shared storage for share extension auth

  screens/
    HomeScreen.js               Main link list, search, tabs, draggable FABs
    AddLinkScreen.js             Add link with URL metadata fetch
    LoginScreen.js               Login + registration
    ResetPasswordScreen.js       Password reset
    RecommendedReadingScreen.js  RSS reader with category filters
    ShareExtensionScreen.js      iOS share extension UI
```

## Configuration

The API URL is set in `src/constants.js`. Update it if running a local backend:

```js
export const API_URL = 'https://kurate.net/api';
```

## Tech Stack

- **React Native** 0.81 + **Expo** SDK 54
- **React Navigation** — Native stack + bottom tabs
- **Expo Secure Store** — Token storage
- **Expo Share Extension** — iOS share sheet integration
- **MMKV** — Fast shared storage between app and share extension
