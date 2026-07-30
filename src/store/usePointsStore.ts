import {create} from 'zustand';
import {PointsTransaction} from '@/types';
import {storage, STORAGE_KEYS} from '@/services/storage';
import {aggregateStats} from '@/services/pointsEngine';

interface PointsState {
  txs: PointsTransaction[];
  load: () => Promise<void>;
  addTransactions: (list: PointsTransaction[]) => Promise<void>;
  spend: (amount: number, note: string) => Promise<void>;
}

export const usePointsStore = create<PointsState>((set, get) => ({
  txs: [],
  async load() {
    const txs = await storage.get<PointsTransaction[]>(STORAGE_KEYS.pointsTx);
    if (txs) set({txs});
  },
  async addTransactions(list) {
    if (!list.length) return;
    const txs = [...get().txs, ...list];
    set({txs});
    await storage.set(STORAGE_KEYS.pointsTx, txs);
  },
  async spend(amount, note) {
    const list: PointsTransaction[] = [
      {
        id: `ptx_spend_${Date.now()}`,
        userId: 'me',
        amount: -Math.abs(amount),
        source: 'airdrop_exchange',
        createdAt: Date.now(),
        locked: false,
        note,
      },
    ];
    await get().addTransactions(list);
  },
}));

export function selectPointsStats(s: PointsState) {
  return aggregateStats(s.txs);
}
