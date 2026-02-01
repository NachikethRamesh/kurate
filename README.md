# Kurate

A secure, full-stack link sharing application with user authentication, cloud synchronization, and dedicated browser extensions for effortless curation.

## 🏗️ Architecture

### Core System
- **Frontend**: Vanilla JavaScript SPA (embedded in Cloudflare Worker)
- **Backend**: Cloudflare Workers serverless functions
- **Database**: Cloudflare D1 (SQLite) for cloud storage
- **Authentication**: JWT tokens with SHA-256 password hashing

### Browser Extensions (Chrome & Firefox)
- **Manifest V3**: State-of-the-art extension architecture
- **Popup UI**: Minimalist design echoing the landing page aesthetic
- **Communication**: Directly interfaces with the Kurate API for seamless saving

## 🚀 Quick Start (Web App)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Visit `http://localhost:8787` to access the application.

## 🧩 Browser Extensions

Kurate includes official extensions for **Chrome** and **Firefox** to allow one-click saving from any tab.

### Features:
- **Instant Save**: Capture any page URL and Title instantly.
- **On-the-fly Categorization**: Choose categories (Technology, Business, etc.) directly in the popup.
- **Persistent Login**: Securely stores your auth token for a seamless experience.

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

- ✅ **Cross-Platform Curation** - Chrome & Firefox extensions.
- ✅ **Secure Authentication** - Modern JWT-based flow.
- ✅ **Link Management** - Add, edit, delete, and categorize links.
- ✅ **Premium UI** - Minimalist, modern design with smooth animations.
- ✅ **Mobile Responsive** - Optimized for all screen sizes.
- ✅ **Cloud Sync** - Powered by Cloudflare D1 for high availability.

---

Built with ❤️ by Kurate