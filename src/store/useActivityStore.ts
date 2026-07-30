import {create} from 'zustand';
import {Activity, PointsTransaction} from '@/types';
import {SAMPLE_ACTIVITIES} from '@/data/mockData';
import {usePointsStore} from './usePointsStore';
import {useTaskStore} from './useTaskStore';

interface ActivityState {
  activities: Activity[];
  enrolledIds: string[];
  checkedInIds: string[];
  enroll: (id: string) => void;
  /** E3 到店打卡：需在活动地理围栏内触发，发放积分/代币 */
  checkin: (id: string) => Promise<void>;
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  activities: SAMPLE_ACTIVITIES,
  enrolledIds: [],
  checkedInIds: [],
  enroll(id) {
    if (get().enrolledIds.includes(id)) return;
    set({enrolledIds: [...get().enrolledIds, id]});
  },
  async checkin(id) {
    if (get().checkedInIds.includes(id)) return;
    const act = get().activities.find((a) => a.id === id);
    if (!act) return;
    const txs: PointsTransaction[] = [];
    if (act.rewardPoints) {
      txs.push({
        id: `ptx_act_${id}_${Date.now()}`,
        userId: 'me',
        amount: act.rewardPoints,
        source: 'activity_checkin',
        refId: id,
        createdAt: Date.now(),
        locked: false,
        note: `活动打卡：${act.title}`,
      });
    }
    if (txs.length) await usePointsStore.getState().addTransactions(txs);
    useTaskStore.getState().tickMetric('checkins', 1);
    set({checkedInIds: [...get().checkedInIds, id]});
  },
}));
