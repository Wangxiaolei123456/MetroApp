import AsyncStorage from '@react-native-async-storage/async-storage';
import EncryptedStorage from 'react-native-encrypted-storage';

// ===== 普通本地存储（非敏感数据） =====
export const storage = {
  async get<T>(key: string): Promise<T | null> {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  async set<T>(key: string, value: T): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },
  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};

// ===== 加密存储（敏感数据：助记词/私钥，D6） =====
// react-native-encrypted-storage 在 iOS Keychain / Android Keystore 中加密保存。
// 若原生模块未链接（如 iOS 未执行 pod install），自动回退到 AsyncStorage，
// 保证创建/导入钱包流程可正常跑通（仅开发/演示用，生产请正确链接原生模块）。
export const secureStore = {
  async saveSecret(key: string, value: string): Promise<void> {
    try {
      await EncryptedStorage.setItem(key, value);
    } catch (e) {
      console.warn('[storage] EncryptedStorage 写入失败，回退 AsyncStorage', e);
      await AsyncStorage.setItem(key, value);
    }
  },
  async getSecret(key: string): Promise<string | null> {
    try {
      return await EncryptedStorage.getItem(key);
    } catch (e) {
      console.warn('[storage] EncryptedStorage 读取失败，回退 AsyncStorage', e);
      return AsyncStorage.getItem(key);
    }
  },
  async removeSecret(key: string): Promise<void> {
    try {
      await EncryptedStorage.removeItem(key);
    } catch (e) {
      console.warn('[storage] EncryptedStorage 删除失败，回退 AsyncStorage', e);
      await AsyncStorage.removeItem(key);
    }
  },
};

export const STORAGE_KEYS = {
  user: 'app:user',
  pointsTx: 'app:points_tx',
  trips: 'app:trips',
  tasks: 'app:user_tasks',
  walletSecret: 'app:wallet_mnemonic', // 加密存储键
  walletMeta: 'app:wallet_meta',
  settings: 'app:settings',
  invites: 'app:invites',
};
