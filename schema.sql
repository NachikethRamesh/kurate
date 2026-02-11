-- Cloudflare D1 Database Schema for Kurate

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT, -- Capture email during signup
    password_hash TEXT NOT NULL,
    user_hash TEXT NOT NULL, -- For backward compatibility with existing system
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Links table for storing user links
CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    is_read INTEGER DEFAULT 0, -- 0 = unread, 1 = read
    is_favorite INTEGER DEFAULT 0, -- 0 = not favorite, 1 = favorite
    domain TEXT,
    date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_user_hash ON users(user_hash);
CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id);
CREATE INDEX IF NOT EXISTS idx_links_timestamp ON links(timestamp);
CREATE INDEX IF NOT EXISTS idx_links_is_read ON links(is_read);

-- Create a view for easy link retrieval with user info
CREATE VIEW IF NOT EXISTS user_links AS
SELECT 
    l.id,
    l.url,
    l.title,
    l.category,
    l.is_read,
    l.domain,
    l.date_added,
    l.timestamp,
    u.username
FROM links l
JOIN users u ON l.user_id = u.id;

-- Metrics table for tracking user events (Obfuscated as 'system sync' in API)
CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, -- Nullable for pre-auth events
    event_type TEXT NOT NULL,
    metadata TEXT, -- JSON string for trace details
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_metrics_user_id ON metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_event_type ON metrics(event_type);

-- Reminders table for engagement engine
CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    source TEXT,
    category TEXT,
    is_shown INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_is_shown ON reminders(is_shown);
-- Custom Categories table
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
