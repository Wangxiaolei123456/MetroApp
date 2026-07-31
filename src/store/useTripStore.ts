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
import {usePlanStore} from './usePlanStore';
import type {StationAlert} from '@/types';

/** 开始行程时可带入的规划信息，用于行程页进度条 */
export interface TripPlanInput {
  destStationId?: string;
  plannedStationIds?: string[];
}

interface TripState {
  active: Trip | null;
  history: Trip[];
  ready: boolean;
  /** 到站/换乘提醒 */
  stationAlert: StationAlert | null;
  /** 刚结束的行程，供结算弹窗展示 */
  finishResult: Trip | null;
  /** 最近一次结算是否由「到达终点站」自动触发 */
  finishAuto: boolean;
  init: () => Promise<void>;
  start: (userId: string, cityId: string, plan?: TripPlanInput) => void;
  onGps: (location: GeoPoint) => {entered?: string; left?: string; arrivedDest?: boolean};
  finish: (opts?: {auto?: boolean}) => Promise<void>;
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
  finishAuto: false,
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
  start(userId, cityId, plan) {
    const trip = createTrip(userId, cityId);
    if (plan) {
      trip.destStationId = plan.destStationId;
      trip.plannedStationIds = plan.plannedStationIds;
    }
    set({active: trip, stationAlert: null, finishResult: null, finishAuto: false});
  },
  onGps(location) {
    const active = get().active;
    if (!active) return {};
    const {trip, entered, left} = recordGpsSvc(active, location);
    set({active: trip});

    // 到达规划终点站：自动结束并结算，无需用户手动点「结束」
    const arrivedDest = Boolean(
      entered && trip.destStationId && entered === trip.destStationId,
    );
    if (arrivedDest) {
      void get().finish({auto: true});
    }
    return {entered, left, arrivedDest};
  },
  async finish(opts) {
    const active = get().active;
    if (!active) return;
    set({active: null, stationAlert: null, finishAuto: Boolean(opts?.auto)});
    // 行程结束后清理已带走的规划信息，避免下次自由乘车时残留旧目的地
    usePlanStore.getState().clear();
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
    set({finishResult: null, finishAuto: false});
  },
}));
