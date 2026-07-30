import {AuthProvider, UserProfile} from '@/types';
import {storage, STORAGE_KEYS} from './storage';
import {t} from '@/i18n';

let guestCounter = 0;

/** G1 登录：示例实现为本地账户（真实环境对接后端/第三方 OAuth） */
export async function login(
  provider: AuthProvider,
  payload?: {phone?: string; email?: string; name?: string},
): Promise<UserProfile> {
  const existing = await storage.get<UserProfile>(STORAGE_KEYS.user);
  if (existing) return existing;

  const profile: UserProfile = {
    id: provider === 'guest' ? `guest_${Date.now()}_${guestCounter++}` : `u_${Date.now()}`,
    name: payload?.name ?? (provider === 'guest' ? t('svc.auth.guestName') : payload?.phone ?? payload?.email ?? t('svc.auth.userName')),
    provider,
    phone: payload?.phone,
    email: payload?.email,
    totalStops: 0,
    totalRides: 0,
    createdAt: Date.now(),
  };
  await storage.set(STORAGE_KEYS.user, profile);
  return profile;
}

export async function logout(): Promise<void> {
  await storage.remove(STORAGE_KEYS.user);
}

export async function getProfile(): Promise<UserProfile | null> {
  return storage.get<UserProfile>(STORAGE_KEYS.user);
}

export async function updateProfile(patch: Partial<UserProfile>): Promise<UserProfile> {
  const cur = await getProfile();
  if (!cur) throw new Error(t('svc.auth.notLoggedIn'));
  const next = {...cur, ...patch};
  await storage.set(STORAGE_KEYS.user, next);
  return next;
}
