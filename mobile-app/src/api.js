import * as SecureStore from 'expo-secure-store';
import { API_URL } from './constants';
import { setSharedToken, clearSharedToken } from './sharedStorage';

/** Retrieves the stored auth token from SecureStore. */
const getToken = async () => {
    return await SecureStore.getItemAsync('authToken');
};

/**
 * API client for all Kurate backend interactions.
 * All methods return { success, ...data } or { success: false, error } on failure.
 */
export const api = {
    /** Authenticates a user and stores the token in SecureStore + shared storage. */
    async login(username, password) {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (data.success) {
                await SecureStore.setItemAsync('authToken', data.token);
                await SecureStore.setItemAsync('username', data.user.username);
                setSharedToken(data.token);
            }
            return data;
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /** Registers a new user and stores the token in SecureStore + shared storage. */
    async register(username, password) {
        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (data.success) {
                await SecureStore.setItemAsync('authToken', data.token);
                await SecureStore.setItemAsync('username', data.user.username);
                setSharedToken(data.token);
            }
            return data;
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /** Clears all stored auth data from SecureStore and shared storage. */
    async logout() {
        await SecureStore.deleteItemAsync('authToken');
        await SecureStore.deleteItemAsync('username');
        clearSharedToken();
    },

    /** Fetches all links for the authenticated user. */
    async getLinks() {
        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/links`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /** Creates a new link with the given URL, title, and category. */
    async createLink({ url, title, category }) {
        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/links`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url, title, category })
            });
            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /** Toggles the favorite status of a link. */
    async toggleFavorite(linkId, isFavorite) {
        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/links/toggle-favorite`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ linkId, isFavorite: isFavorite ? 1 : 0 })
            });
            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /** Marks a link as read or unread. */
    async markRead(linkId, isRead = true) {
        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/links/mark-read`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ linkId, isRead: isRead ? 1 : 0 })
            });
            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /** Deletes a link by ID. */
    async deleteLink(linkId) {
        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/links?id=${linkId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /** Fetches page title metadata for a given URL. */
    async getMetadata(url) {
        try {
            const response = await fetch(`${API_URL}/meta?url=${encodeURIComponent(url)}`);
            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /** Updates the user's username and stores the new token. */
    async updateUsername(newUsername) {
        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/auth/update-username`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ newUsername })
            });
            const data = await response.json();
            if (data.success) {
                await SecureStore.setItemAsync('authToken', data.token);
                await SecureStore.setItemAsync('username', data.user.username);
                setSharedToken(data.token);
            }
            return data;
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /** Permanently deletes the user's account after password verification. */
    async deleteAccount(password) {
        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/auth/delete-account`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });
            const data = await response.json();
            if (data.success) {
                await SecureStore.deleteItemAsync('authToken');
                await SecureStore.deleteItemAsync('username');
                clearSharedToken();
            }
            return data;
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    /** Resets the user's password and stores the new token. */
    async resetPassword(username, currentPassword, newPassword) {
        try {
            const response = await fetch(`${API_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, currentPassword, newPassword })
            });
            const data = await response.json();
            if (data.success) {
                await SecureStore.setItemAsync('authToken', data.token);
                await SecureStore.setItemAsync('username', data.user.username);
                setSharedToken(data.token);
            }
            return data;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};
