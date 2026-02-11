import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({
    id: 'kurate-shared',
    path: `group.com.kurate.app`,
});

const TOKEN_KEY = 'authToken';

export const setSharedToken = (token) => {
    storage.set(TOKEN_KEY, token);
};

export const getSharedToken = () => {
    return storage.getString(TOKEN_KEY) || null;
};

export const clearSharedToken = () => {
    storage.delete(TOKEN_KEY);
};
