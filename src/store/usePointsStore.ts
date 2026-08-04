import {create} from 'zustand';
import {PointsTransaction} from '@/types';
import {storage, STORAGE_KEYS} from '@/services/storage';
import {aggregateStats} from '@/services/pointsEngine';
import {getPointTransactions, getRewardUser} from '@/services/rewardsService';

interface PointsState {
  txs: PointsTransaction[];
  /** 后端是否已同步（用于首次标记，避免离线时误清空） */
  synced: boolean;
  load: () => Promise<void>;
  /** 从后端拉取积分余额与流水，并与本地流水合并（按 id 去重） */
  syncFromBackend: () => Promise<void>;
  addTransactions: (list: PointsTransaction[]) => Promise<void>;
  spend: (amount: number, note: string) => Promise<void>;
}

// 后端 PointTx -> 前端 PointsTransaction
function mapBackendTx(t: {id: string; type: string; amount: number; createdAt: string; remark: string | null}): PointsTransaction {
  return {
    id: `bk_${t.id}`,
    userId: 'me',
    amount: t.amount,
    source: (t.type as PointsTransaction['source']) || 'other',
    refId: undefined,
    createdAt: Date.parse(t.createdAt) || Date.now(),
    locked: false,
    note: t.remark ?? undefined,
  };
}

export const usePointsStore = create<PointsState>((set, get) => ({
  txs: [],
  synced: false,
  async load() {
    const txs = await storage.get<PointsTransaction[]>(STORAGE_KEYS.pointsTx);
    if (txs) set({txs});
    // 加载本地后顺带同步后端（若后端可用）
    await get().syncFromBackend().catch(() => {/* 离线忽略 */});
  },
  async syncFromBackend() {
    try {
      // 流水与账户分开拉：任一成功都更新，避免 /users/me 被其它路由挡住时整段失败
      let backend: PointsTransaction[] | null = null;
      try {
        const txs = await getPointTransactions(100);
        backend = txs.map(mapBackendTx);
      } catch {
        /* 流水接口失败则保留本地 */
      }
      if (backend) {
        set({txs: backend, synced: true});
        await storage.set(STORAGE_KEYS.pointsTx, backend);
      }
      try {
        await getRewardUser();
      } catch {
        /* 账户接口失败不影响已同步的流水 */
      }
    } catch {
      /* 后端不可用：保留本地数据 */
    }
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
