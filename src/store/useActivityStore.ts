import {create} from 'zustand';
import {Activity} from '@/types';
import {SAMPLE_ACTIVITIES} from '@/data/mockData';
import {usePointsStore} from './usePointsStore';
import {useTaskStore} from './useTaskStore';
import {getMyActivityIds, signupActivity} from '@/services/rewardsService';

interface ActivityState {
  activities: Activity[];
  enrolledIds: string[];
  checkedInIds: string[];
  /** 从后端加载已报名活动，并触发积分余额同步 */
  load: () => Promise<void>;
  enroll: (id: string) => Promise<void>;
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  activities: SAMPLE_ACTIVITIES,
  enrolledIds: [],
  checkedInIds: [],
  async load() {
    try {
      const ids = await getMyActivityIds();
      set({enrolledIds: ids});
      // 报名可能带来积分，同步一次余额
      await usePointsStore.getState().syncFromBackend().catch(() => {/* ignore */});
    } catch {
      /* 后端不可用：保留本地空报名列表 */
    }
  },
  async enroll(id) {
    if (get().enrolledIds.includes(id)) return;
    // 乐观更新
    set({enrolledIds: [...get().enrolledIds, id]});
    try {
      await signupActivity(id);
      // 后端已发放报名积分，同步余额并刷新任务进度
      await usePointsStore.getState().syncFromBackend().catch(() => {/* ignore */});
      useTaskStore.getState().tickMetric('binds', 1);
    } catch {
      // 失败回滚
      set({enrolledIds: get().enrolledIds.filter(x => x !== id)});
    }
  },
}));
