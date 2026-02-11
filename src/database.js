const encoder = new TextEncoder();

/**
 * Generates a SHA-256 hash of the password with the provided salt.
 * @param {string} password - Plain text password
 * @param {string} salt - Salt from environment variable (PASSWORD_SALT)
 * @returns {Promise<string>} Hex-encoded hash
 */
async function generatePasswordHash(password, salt) {
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);

  let result = '';
  for (let i = 0; i < hashArray.length; i++) {
    result += hashArray[i].toString(16).padStart(2, '0');
  }
  return result;
}

/**
 * Generates a unique user hash from username + current timestamp.
 * @param {string} username
 * @returns {Promise<string>} Hex-encoded hash
 */
async function generateUserHash(username) {
  const data = encoder.encode(username + Date.now().toString());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);

  let result = '';
  for (let i = 0; i < hashArray.length; i++) {
    result += hashArray[i].toString(16).padStart(2, '0');
  }
  return result;
}

/**
 * Extracts the domain (without www.) from a URL string.
 * @param {string} url
 * @returns {string} Domain name, or 'unknown' if URL is invalid
 */
function getDomainFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch (error) {
    return 'unknown';
  }
}

/**
 * Fetches a URL and extracts the <title> tag content.
 * Uses a 5-second timeout to avoid blocking link creation when target sites are slow or unresponsive.
 * @param {string} url - URL to fetch the title from
 * @returns {Promise<string|null>} Extracted title (max 200 chars), or null on failure
 */
async function extractTitleFromUrl(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KurateBot/1.0)' },
      signal: AbortSignal.timeout(5000) // 5s — keeps link creation fast even if target site is slow
    });

    if (!response.ok) return null;

    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch ? titleMatch[1].trim().substring(0, 200) : null; // Limit title length
  } catch (error) {
    return null;
  }
}

/**
 * Creates a new user in the database with hashed password and unique user hash.
 * @param {D1Database} db
 * @param {string} username
 * @param {string} password - Plain text, will be hashed before storage
 * @param {string} salt - Password salt from environment
 * @returns {Promise<{success: boolean, userId?: number, userHash?: string, error?: string}>}
 */
export async function createUser(db, username, password, salt) {
  try {
    const passwordHash = await generatePasswordHash(password, salt);
    const userHash = await generateUserHash(username);

    const result = await db.prepare(`
      INSERT INTO users (username, password_hash, user_hash)
      VALUES (?, ?, ?)
    `).bind(username, passwordHash, userHash).run();

    return {
      success: true,
      userId: result.meta.last_row_id,
      userHash
    };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return {
        success: false,
        error: 'Username already exists'
      };
    }
    throw error;
  }
}

/**
 * Looks up a user by username.
 * @param {D1Database} db
 * @param {string} username
 * @returns {Promise<Object|null>} User row or null if not found
 */
export async function getUserByUsername(db, username) {
  try {
    const user = await db.prepare(`
      SELECT id, username, password_hash, user_hash, created_at
      FROM users 
      WHERE username = ?
    `).bind(username).first();

    return user;
  } catch (error) {
    return null;
  }
}

/**
 * Verifies a user's password against the stored hash.
 * @param {D1Database} db
 * @param {string} username
 * @param {string} password - Plain text password to verify
 * @param {string} salt - Password salt from environment
 * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
 */
export async function verifyUserPassword(db, username, password, salt) {
  try {
    const user = await getUserByUsername(db, username);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const passwordHash = await generatePasswordHash(password, salt);
    if (user.password_hash !== passwordHash) {
      return { success: false, error: 'Invalid credentials' };
    }

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        userHash: user.user_hash
      }
    };
  } catch (error) {
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Updates a user's password hash.
 * @param {D1Database} db
 * @param {string} username
 * @param {string} newPassword - New plain text password to hash and store
 * @param {string} salt - Password salt from environment
 * @returns {Promise<{success: boolean, changes?: number, error?: string}>}
 */
export async function updateUserPassword(db, username, newPassword, salt) {
  try {
    const newPasswordHash = await generatePasswordHash(newPassword, salt);
    const result = await db.prepare(`
      UPDATE users 
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE username = ?
    `).bind(newPasswordHash, username).run();

    return {
      success: result.meta.changes > 0,
      changes: result.meta.changes
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Retrieves all links for a user, ordered by most recent first.
 * @param {D1Database} db
 * @param {number} userId
 * @returns {Promise<{success: boolean, links: Array}>}
 */
export async function getUserLinks(db, userId) {
  try {
    const links = await db.prepare(`
      SELECT id, url, title, category, is_read, is_favorite, domain, date_added, timestamp
      FROM links 
      WHERE user_id = ?
      ORDER BY timestamp DESC
    `).bind(userId).all();

    const results = links.results || [];
    const formattedLinks = new Array(results.length);

    for (let i = 0; i < results.length; i++) {
      const link = results[i];
      formattedLinks[i] = {
        id: link.id.toString(),
        url: link.url,
        title: link.title,
        category: link.category,
        isRead: link.is_read,
        isFavorite: link.is_favorite,
        domain: link.domain,
        dateAdded: link.date_added,
        timestamp: link.timestamp
      };
    }

    return {
      success: true,
      links: formattedLinks
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      links: []
    };
  }
}

/**
 * Creates a new link entry. Auto-extracts title from URL if not provided.
 * @param {D1Database} db
 * @param {number} userId
 * @param {Object} linkData - { url, title?, category? }
 * @returns {Promise<{success: boolean, link?: Object, error?: string}>}
 */
export async function createLink(db, userId, linkData) {
  try {
    const { url, title, category = 'general' } = linkData;
    const domain = getDomainFromUrl(url);
    const finalTitle = title || await extractTitleFromUrl(url) || 'Untitled';

    const result = await db.prepare(`
      INSERT INTO links (user_id, url, title, category, domain, is_read, is_favorite)
      VALUES (?, ?, ?, ?, ?, 0, 0)
    `).bind(userId, url, finalTitle, category, domain).run();

    // Fetch the created link
    const newLink = await db.prepare(`
      SELECT id, url, title, category, is_read, is_favorite, domain, date_added, timestamp
      FROM links 
      WHERE id = ?
    `).bind(result.meta.last_row_id).first();

    return {
      success: true,
      link: {
        id: newLink.id.toString(),
        url: newLink.url,
        title: newLink.title,
        category: newLink.category,
        isRead: newLink.is_read,
        isFavorite: newLink.is_favorite,
        domain: newLink.domain,
        dateAdded: newLink.date_added,
        timestamp: newLink.timestamp
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Deletes a link owned by the given user.
 * @param {D1Database} db
 * @param {number} userId
 * @param {string|number} linkId
 * @returns {Promise<{success: boolean, changes?: number, error?: string}>}
 */
export async function deleteLink(db, userId, linkId) {
  try {
    const result = await db.prepare(`
      DELETE FROM links 
      WHERE id = ? AND user_id = ?
    `).bind(linkId, userId).run();

    return {
      success: result.changes > 0,
      changes: result.changes
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Marks a link as read or unread.
 * @param {D1Database} db
 * @param {number} userId
 * @param {string|number} linkId
 * @param {number} [isRead=1] - 1 for read, 0 for unread
 * @returns {Promise<{success: boolean, changes?: number, error?: string}>}
 */
export async function markLinkAsRead(db, userId, linkId, isRead = 1) {
  try {
    const result = await db.prepare(`
      UPDATE links
      SET is_read = ?
      WHERE id = ? AND user_id = ?
    `).bind(isRead, linkId, userId).run();

    return {
      success: result.changes > 0,
      changes: result.changes
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Sets or clears the favorite flag on a link.
 * @param {D1Database} db
 * @param {number} userId
 * @param {string|number} linkId
 * @param {number} [isFavorite=1] - 1 to favorite, 0 to unfavorite
 * @returns {Promise<{success: boolean, changes?: number, error?: string}>}
 */
export async function toggleFavorite(db, userId, linkId, isFavorite = 1) {
  try {
    const result = await db.prepare(`
      UPDATE links 
      SET is_favorite = ?
      WHERE id = ? AND user_id = ?
    `).bind(isFavorite, linkId, userId).run();

    return {
      success: result.changes > 0,
      changes: result.changes
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Checks database connectivity by running a simple count query.
 * @param {D1Database} db
 * @returns {Promise<{status: string, userCount?: number, error?: string}>}
 */
export async function checkDatabaseHealth(db) {
  try {
    // Simple query to check if database is accessible
    const result = await db.prepare('SELECT COUNT(*) as count FROM users').first();
    return {
      status: 'connected',
      userCount: result.count
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Records an analytics event. Fails silently to avoid disrupting user experience.
 * @param {D1Database} db
 * @param {number|null} userId
 * @param {string} eventType
 * @param {string} metadata - JSON string of event details
 * @returns {Promise<{success: boolean, id?: number, error?: string}>}
 */
export async function trackEvent(db, userId, eventType, metadata) {
  try {
    const result = await db.prepare(`
      INSERT INTO metrics (user_id, event_type, metadata)
      VALUES (?, ?, ?)
    `).bind(userId, eventType, metadata).run();

    return {
      success: true,
      id: result.meta.last_row_id
    };
  } catch (error) {
    // Fail silently in production to avoid disrupting user experience
    return { success: false, error: error.message };
  }
}
