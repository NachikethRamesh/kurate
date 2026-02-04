import * as SecureStore from 'expo-secure-store';
import { API_URL } from './constants';

// Helper to get token
const getToken = async () => {
    return await SecureStore.getItemAsync('authToken');
};

export const api = {
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
            }
            return data;
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

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
            }
            return data;
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async logout() {
        await SecureStore.deleteItemAsync('authToken');
        await SecureStore.deleteItemAsync('username');
    },

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

    async getMetadata(url) {
        try {
            const response = await fetch(`${API_URL}/meta?url=${encodeURIComponent(url)}`);
            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    async resetPassword(username, newPassword) {
        try {
            const response = await fetch(`${API_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, newPassword })
            });
            const data = await response.json();
            if (data.success) {
                await SecureStore.setItemAsync('authToken', data.token);
                await SecureStore.setItemAsync('username', data.user.username);
            }
            return data;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
};
