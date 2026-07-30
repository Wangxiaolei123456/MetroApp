import {create} from 'zustand';
import {GeoPoint, Trip} from '@/types';
import {
  createTrip,
  recordGps as recordGpsSvc,
  finalizeTrip,
} from '@/services/tripEngine';
import {buildTripTransactions} from '@/services/pointsEngine';
import {storage, STORAGE_KEYS} from '@/services/storage';
import {usePointsStore} from './usePointsStore';
import {useUserStore} from './useUserStore';

interface TripState {
  active: Trip | null;
  history: Trip[];
  ready: boolean;
  init: () => Promise<void>;
  start: (userId: string, cityId: string) => void;
  onGps: (location: GeoPoint) => {entered?: string; left?: string};
  finish: () => Promise<void>;
  clearActive: () => void;
}

const LOCK_RATIO = 0.3; // C5 30% 积分锁定至空投周期结束
const UNLOCK_AT = Date.now() + 30 * 86400000;

export const useTripStore = create<TripState>((set, get) => ({
  active: null,
  history: [],
  ready: false,
  async init() {
    const history = await storage.get<Trip[]>(STORAGE_KEYS.trips);
    set({history: history ?? [], ready: true});
  },
  start(userId, cityId) {
    set({active: createTrip(userId, cityId)});
  },
  onGps(location) {
    const active = get().active;
    if (!active) return {};
    const {trip, entered, left} = recordGpsSvc(active, location);
    set({active: trip});
    return {entered, left};
  },
  async finish() {
    const active = get().active;
    if (!active) return;
    const finalized = finalizeTrip(active);
    // 结算积分（仅 completed 计入有效）
    if (finalized.status === 'completed' && finalized.summary) {
      const txs = buildTripTransactions(
        finalized.userId,
        finalized.id,
        finalized.summary,
        {lockRatio: LOCK_RATIO, unlockAt: UNLOCK_AT},
      );
      await usePointsStore.getState().addTransactions(txs);
      await useUserStore.getState().addRide();
      await useUserStore.getState().addStops(finalized.summary.stationCount);
    }
    const history = [finalized, ...get().history];
    set({active: null, history});
    await storage.set(STORAGE_KEYS.trips, history);
  },
  clearActive() {
    set({active: null});
  },
}));
