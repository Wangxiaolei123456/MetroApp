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
import {useWalletStore} from './useWalletStore';
import type {StationAlert} from '@/types';

interface TripState {
  active: Trip | null;
  history: Trip[];
  ready: boolean;
  /** 到站/换乘提醒 */
  stationAlert: StationAlert | null;
  /** 刚结束的行程，供结算弹窗展示 */
  finishResult: Trip | null;
  init: () => Promise<void>;
  start: (userId: string, cityId: string) => void;
  onGps: (location: GeoPoint) => {entered?: string; left?: string};
  finish: () => Promise<void>;
  clearActive: () => void;
  setStationAlert: (alert: StationAlert | null) => void;
  clearFinishResult: () => void;
}

const LOCK_RATIO = 0.3; // C5 30% 积分锁定至空投周期结束
const UNLOCK_AT = Date.now() + 30 * 86400000;

export const useTripStore = create<TripState>((set, get) => ({
  active: null,
  history: [],
  ready: false,
  stationAlert: null,
  finishResult: null,
  async init() {
    const history = await storage.get<Trip[]>(STORAGE_KEYS.trips);
    const seen = new Set<string>();
    const deduped = (history ?? []).filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
    if (deduped.length !== (history ?? []).length) {
      await storage.set(STORAGE_KEYS.trips, deduped);
    }
    set({history: deduped, ready: true});
  },
  start(userId, cityId) {
    set({active: createTrip(userId, cityId), stationAlert: null, finishResult: null});
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
    set({active: null, stationAlert: null});
    const finalized = finalizeTrip(active);
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
      await useWalletStore.getState().creditRideTokens(finalized.summary.stationCount);
    }
    const prev = get().history.filter((t) => t.id !== finalized.id);
    const history = [finalized, ...prev];
    set({history, finishResult: finalized});
    await storage.set(STORAGE_KEYS.trips, history);
  },
  clearActive() {
    set({active: null, stationAlert: null});
  },
  setStationAlert(alert) {
    set({stationAlert: alert});
  },
  clearFinishResult() {
    set({finishResult: null});
  },
}));
