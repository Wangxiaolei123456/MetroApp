import {create} from 'zustand';
import {AuthProvider, UserProfile} from '@/types';
import * as auth from '@/services/authService';

interface UserState {
  profile: UserProfile | null;
  ready: boolean;
  init: () => Promise<void>;
  login: (provider: AuthProvider, payload?: {phone?: string; email?: string; name?: string}) => Promise<UserProfile>;
  bindWallet: (address: string) => Promise<void>;
  addRide: () => Promise<void>;
  addStops: (n: number) => Promise<void>;
  update: (patch: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  ready: false,
  async init() {
    const profile = await auth.getProfile();
    set({profile, ready: true});
  },
  async login(provider, payload) {
    const profile = await auth.login(provider, payload);
    set({profile});
    return profile;
  },
  async bindWallet(address) {
    const next = await auth.updateProfile({walletAddress: address});
    set({profile: next});
  },
  async addRide() {
    const p = get().profile;
    if (!p) return;
    const next = await auth.updateProfile({totalRides: p.totalRides + 1});
    set({profile: next});
  },
  async addStops(n) {
    const p = get().profile;
    if (!p) return;
    const next = await auth.updateProfile({totalStops: p.totalStops + n});
    set({profile: next});
  },
  async update(patch) {
    const next = await auth.updateProfile(patch);
    set({profile: next});
  },
  async logout() {
    await auth.logout();
    set({profile: null});
  },
}));
