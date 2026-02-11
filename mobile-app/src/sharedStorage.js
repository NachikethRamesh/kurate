let storage = null;

try {
    const { MMKV } = require('react-native-mmkv');
    storage = new MMKV({
        id: 'kurate-shared',
        path: `group.com.kurate.app`,
    });
} catch (e) {
    // MMKV not available (e.g. Expo Go) — shared storage disabled
}

const TOKEN_KEY = 'authToken';

export const setSharedToken = (token) => {
    if (storage) storage.set(TOKEN_KEY, token);
};

export const getSharedToken = () => {
    if (storage) return storage.getString(TOKEN_KEY) || null;
    return null;
};

export const clearSharedToken = () => {
    if (storage) storage.delete(TOKEN_KEY);
};
