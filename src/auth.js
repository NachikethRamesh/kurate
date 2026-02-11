import {
  createUser,
  getUserByUsername,
  verifyUserPassword,
  updateUserPassword,
  updateUsername,
  deleteUser
} from './database.js';
import { CORS_HEADERS, createResponse, createErrorResponse } from './constants.js';

/**
 * Generates a base64-encoded auth token from user data.
 * @param {Object} userData - Must contain username, id, and userHash
 * @returns {string} Base64-encoded token string
 */
function generateToken(userData) {
  const tokenPayload = {
    username: userData.username,
    userId: userData.id,
    userHash: userData.userHash, // For backward compatibility
    timestamp: Date.now()
  };
  return btoa(JSON.stringify(tokenPayload));
}

/**
 * Validates a Bearer token from the Authorization header.
 * @param {string|null} authHeader - Authorization header value (e.g. "Bearer <token>")
 * @returns {Object|null} Decoded token data with username/userId, or null if invalid
 */
export function validateToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const tokenData = JSON.parse(atob(token));
    if (!tokenData.username || !tokenData.userId) {
      return null;
    }
    return tokenData;
  } catch (error) {
    return null;
  }
}

/**
 * Handles POST /api/auth/login — verifies credentials and returns a token.
 * @param {Request} request
 * @param {Object} env - Cloudflare Worker environment bindings
 * @returns {Response}
 */
export async function handleAuthLogin(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (request.method === 'POST') {
    try {
      const requestData = await request.json();
      const { username, password } = requestData;

      if (!username || !password) {
        return createErrorResponse('Username and password required', 400);
      }

      // Verify user credentials
      const authResult = await verifyUserPassword(env.DB, username, password, env.PASSWORD_SALT);
      
      if (!authResult.success) {
        return createErrorResponse(authResult.error, authResult.error === 'User not found' ? 404 : 401);
      }

      // Generate token
      const token = generateToken(authResult.user);

      return createResponse({
        success: true,
        message: 'Login successful!',
        user: { username: authResult.user.username },
        token: token
      });

    } catch (error) {
      return createErrorResponse('Authentication failed', 500);
    }
  }

  return createErrorResponse('Method not allowed', 405);
}

/**
 * Handles POST /api/auth/register — creates a new user and returns a token.
 * @param {Request} request
 * @param {Object} env - Cloudflare Worker environment bindings
 * @returns {Response}
 */
export async function handleAuthRegister(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (request.method === 'POST') {
    try {
      const requestData = await request.json();
      const { username, password } = requestData;

      if (!username || !password) {
        return createErrorResponse('Username and password required', 400);
      }

      // Basic validation
      if (username.length < 3) {
        return createErrorResponse('Username must be at least 3 characters long', 400);
      }

      if (password.length < 6) {
        return createErrorResponse('Password must be at least 6 characters long', 400);
      }

      // Create user in D1 database
      const result = await createUser(env.DB, username, password, env.PASSWORD_SALT);

      if (!result.success) {
        return createErrorResponse(result.error, result.error === 'Username already exists' ? 409 : 500);
      }

      // Generate token for immediate login
      const userData = {
        username: username,
        id: result.userId,
        userHash: result.userHash
      };
      const token = generateToken(userData);

      return createResponse({
        success: true,
        message: 'Account created successfully!',
        user: { username: username },
        token: token
      });

    } catch (error) {
      return createErrorResponse('Failed to create account', 500);
    }
  }

  return createErrorResponse('Method not allowed', 405);
}

/**
 * Handles POST /api/auth/reset-password — verifies current password and updates to new one.
 * @param {Request} request
 * @param {Object} env - Cloudflare Worker environment bindings
 * @returns {Response}
 */
export async function handlePasswordReset(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (request.method === 'POST') {
    try {
      const requestData = await request.json();
      const { username, currentPassword, newPassword } = requestData;

      if (!username || !currentPassword || !newPassword) {
        return createErrorResponse('Username, current password, and new password are required', 400);
      }

      if (newPassword.length < 6) {
        return createErrorResponse('Password must be at least 6 characters long', 400);
      }

      // Verify current password first
      const authResult = await verifyUserPassword(env.DB, username, currentPassword, env.PASSWORD_SALT);
      if (!authResult.success) {
        return createErrorResponse(authResult.error === 'User not found' ? 'User not found' : 'Current password is incorrect', authResult.error === 'User not found' ? 404 : 401);
      }

      const user = authResult.user;

      // Update password
      const result = await updateUserPassword(env.DB, username, newPassword, env.PASSWORD_SALT);

      if (!result.success) {
        return createErrorResponse('Failed to reset password', 500);
      }

      // Generate token for immediate login
      const userData = {
        username: user.username,
        id: user.id,
        userHash: user.user_hash
      };
      const token = generateToken(userData);

      return createResponse({
        success: true,
        message: 'Password reset successfully!',
        user: { username: user.username },
        token: token
      });

    } catch (error) {
      return createErrorResponse('Failed to reset password', 500);
    }
  }

  return createErrorResponse('Method not allowed', 405);
}

/**
 * Handles POST /api/auth/update-username — updates username for authenticated user.
 * @param {Request} request
 * @param {Object} env - Cloudflare Worker environment bindings
 * @returns {Response}
 */
export async function handleUpdateUsername(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (request.method === 'POST') {
    try {
      const tokenData = validateToken(request.headers.get('Authorization'));
      if (!tokenData) {
        return createErrorResponse('Unauthorized', 401);
      }

      const { newUsername } = await request.json();

      if (!newUsername || newUsername.length < 3) {
        return createErrorResponse('Username must be at least 3 characters long', 400);
      }

      const result = await updateUsername(env.DB, tokenData.userId, newUsername);

      if (!result.success) {
        return createErrorResponse(result.error || 'Failed to update username', result.error === 'Username already exists' ? 409 : 500);
      }

      const newToken = generateToken({
        username: newUsername,
        id: tokenData.userId,
        userHash: tokenData.userHash
      });

      return createResponse({
        success: true,
        message: 'Username updated successfully!',
        user: { username: newUsername },
        token: newToken
      });

    } catch (error) {
      return createErrorResponse('Failed to update username', 500);
    }
  }

  return createErrorResponse('Method not allowed', 405);
}

/**
 * Handles POST /api/auth/delete-account — permanently deletes user and all their data.
 * @param {Request} request
 * @param {Object} env - Cloudflare Worker environment bindings
 * @returns {Response}
 */
export async function handleDeleteAccount(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (request.method === 'POST') {
    try {
      const tokenData = validateToken(request.headers.get('Authorization'));
      if (!tokenData) {
        return createErrorResponse('Unauthorized', 401);
      }

      const { password } = await request.json();

      if (!password) {
        return createErrorResponse('Password is required to delete account', 400);
      }

      // Verify password before deletion
      const authResult = await verifyUserPassword(env.DB, tokenData.username, password, env.PASSWORD_SALT);
      if (!authResult.success) {
        return createErrorResponse('Incorrect password', 401);
      }

      const result = await deleteUser(env.DB, tokenData.userId);

      if (!result.success) {
        return createErrorResponse('Failed to delete account', 500);
      }

      return createResponse({
        success: true,
        message: 'Account deleted successfully'
      });

    } catch (error) {
      return createErrorResponse('Failed to delete account', 500);
    }
  }

  return createErrorResponse('Method not allowed', 405);
}

/**
 * Handles POST /api/auth/logout — currently client-side only (token removal).
 * @param {Request} request
 * @param {Object} env - Cloudflare Worker environment bindings
 * @returns {Response}
 */
export async function handleAuthLogout(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (request.method === 'POST') {
    // For now, logout is client-side only (remove token)
    // In the future, we could maintain a token blacklist in D1
    return createResponse({
      success: true,
      message: 'Logged out successfully'
    });
  }

  return createErrorResponse('Method not allowed', 405);
}
