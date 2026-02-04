# Kurate

A secure, full-stack link sharing application with user authentication, cloud synchronization, and dedicated browser extensions for effortless curation.

## ✨ Latest Refinements (Feb 2026)
- **Official Store Branding**: Integrated high-fidelity Chrome (2022) and Firefox (2019) logos across the platform.
- **Premium Landing Page**: Redesigned extension download buttons into sleek, dashboard-style rounded containers.
- **Improved UX**: Tightened landing page layout and integrated a fully compliant Privacy Policy flow.
- **Cross-Platform Readiness**: Manifest V3 compliant with optimized ZIP packaging for instant store submission.

## 🏗️ Architecture

### Core System
- **Frontend**: Vanilla JavaScript SPA (embedded in Cloudflare Worker)
- **Backend**: Cloudflare Workers serverless functions
- **Database**: Cloudflare D1 (SQLite) for cloud storage
- **Authentication**: JWT tokens with SHA-256 password hashing

### Browser Extensions (Chrome & Firefox)
- **Manifest V3**: State-of-the-art extension architecture.
- **Premium Buttons**: Integrated into the landing page with custom dashboard-inspired containers (rounded boxes, soft shadows).
- **Official Branding**: Uses official 2022 Chrome and 2019 Firefox logos for maximum trust and recognition.
- **Communication**: Directly interfaces with the Kurate API for seamless saving.

## 🚀 Quick Start (Web App)

### 1. Install Dependencies
```bash
npm install
```

### 2. Deployment
The application is designed to be deployed to Cloudflare Workers.
```bash
npm run deploy
```
Visit `https://kurate.net` to access the application.

## 🧩 Browser Extensions

Kurate includes official extensions for **Chrome** and **Firefox** to allow one-click saving from any tab.

### Features:
- **Instant Save**: Capture any page URL and Title instantly.
- **On-the-fly Categorization**: Choose categories (Technology, Business, etc.) directly in the popup.
- **Persistent Login**: Securely stores your auth token for a seamless experience.
- **Store Optimized**: Pre-configured with official store descriptions, screenshots, and privacy justifications.

### Packaging for Store Submission:
To create the `kurate-extension.zip` for store submission:
```bash
# Re-packs the extension folder into a cross-platform ZIP
# Ensure you are on a system with Python installed
python -c "import zipfile, os; arch = zipfile.ZipFile('kurate-extension.zip', 'w', zipfile.ZIP_DEFLATED); [arch.write(os.path.join(root, file), os.path.relpath(os.path.join(root, file), 'extension').replace(os.sep, '/')) for root, dirs, files in os.walk('extension') for file in files]; arch.close()"
```

## 📁 Project Structure

```
├── extension/            # Browser extension source files
│   ├── icons/           # 16, 32, 48, 128px icons
│   ├── manifest.json    # Extension configuration (Chrome/Firefox)
│   ├── popup.js         # Extension logic & API calls
│   └── popup.html       # Extension UI
├── src/                 # Cloudflare Worker source code
│   ├── index.js         # Main landing page & SPA logic
│   ├── auth.js          # Authentication handlers
│   └── database.js      # D1 database operations
├── kurate-extension.zip # Prepared store-ready archive
├── schema.sql           # D1 database schema
├── wrangler.toml        # Cloudflare Workers configuration
└── README.md           # This file
```

## 🔐 Security & Privacy

- **Password Security**: JWT Authentication with secure token storage.
- **User Isolation**: Complete data separation per user.
- **Privacy Policy**: Built-in compliant privacy policy accessible at `kurate.net/?p=privacy`.
- **Transparency**: Fully compliant with Firefox "Data Collection Permissions."

## 🎨 Features

- ✅ **Cross-Platform Curation** - Dedicated Chrome & Firefox extensions.
- ✅ **Vibrant Branding** - Integrated official store logos for high trust.
- ✅ **Secure Authentication** - Modern JWT-based flow.
- ✅ **Link Management** - Add, edit, delete, and categorize links.
- ✅ **Premium UI** - Minimalist design with smooth, reactive transitions.
- ✅ **Cloud Sync** - Powered by Cloudflare D1 for high availability.

---

Built with ❤️ by Kurate