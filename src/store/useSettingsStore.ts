import {create} from 'zustand';
import {NotificationSettings, PrivacySettings} from '@/types';
import {storage, STORAGE_KEYS} from '@/services/storage';
import {DEFAULT_CITY_ID, SUPPORTED_CITIES} from '@/data/metroData';
import {ColorSchemePreference} from '@/theme/theme';

type Lang = 'zh' | 'en';

interface SettingsState {
  notification: NotificationSettings;
  privacy: PrivacySettings;
  cityId: string;
  language: Lang;
  colorScheme: ColorSchemePreference;
  init: () => Promise<void>;
  setNotification: (patch: Partial<NotificationSettings>) => Promise<void>;
  setPrivacy: (patch: Partial<PrivacySettings>) => Promise<void>;
  setCityId: (id: string) => Promise<void>;
  setLanguage: (lang: Lang) => Promise<void>;
  setColorScheme: (scheme: ColorSchemePreference) => Promise<void>;
}

const DEFAULT_NOTIF: NotificationSettings = {
  tripAlert: true,
  activityPush: true,
  airdropAlert: true,
};
const DEFAULT_PRIV: PrivacySettings = {
  locationEnabled: true,
  dataSharing: false,
};

function parseScheme(v: unknown): ColorSchemePreference {
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'dark';
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  notification: DEFAULT_NOTIF,
  privacy: DEFAULT_PRIV,
  cityId: DEFAULT_CITY_ID,
  language: 'zh',
  colorScheme: 'dark',
  async init() {
    const n = await storage.get<NotificationSettings>(STORAGE_KEYS.settings + ':notif');
    const p = await storage.get<PrivacySettings>(STORAGE_KEYS.settings + ':priv');
    const c = await storage.get<string>(STORAGE_KEYS.settings + ':city');
    const l = await storage.get<Lang>(STORAGE_KEYS.settings + ':lang');
    const scheme = await storage.get<ColorSchemePreference>(STORAGE_KEYS.settings + ':theme');
    const cityId = c && SUPPORTED_CITIES.some((x) => x.id === c) ? c : DEFAULT_CITY_ID;
    set({
      notification: n ?? DEFAULT_NOTIF,
      privacy: p ?? DEFAULT_PRIV,
      cityId,
      language: l === 'en' || l === 'zh' ? l : 'zh',
      colorScheme: parseScheme(scheme),
    });
  },
  async setNotification(patch) {
    const next = {...get().notification, ...patch};
    set({notification: next});
    await storage.set(STORAGE_KEYS.settings + ':notif', next);
  },
  async setPrivacy(patch) {
    const next = {...get().privacy, ...patch};
    set({privacy: next});
    await storage.set(STORAGE_KEYS.settings + ':priv', next);
  },
  async setCityId(id) {
    if (!SUPPORTED_CITIES.some((c) => c.id === id)) return;
    set({cityId: id});
    await storage.set(STORAGE_KEYS.settings + ':city', id);
  },
  async setLanguage(lang) {
    set({language: lang});
    await storage.set(STORAGE_KEYS.settings + ':lang', lang);
  },
  async setColorScheme(scheme) {
    set({colorScheme: scheme});
    await storage.set(STORAGE_KEYS.settings + ':theme', scheme);
  },
}));
