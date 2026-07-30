import {create} from 'zustand';
import {RoutePlan} from '@/types';

interface PlanState {
  fromId: string | null;
  toId: string | null;
  plan: RoutePlan | null;
  setPlan: (p: {
    fromId: string | null;
    toId: string | null;
    plan: RoutePlan | null;
  }) => void;
  clear: () => void;
}

// 保存当前规划结果，供主地图在「规划路线后」高亮展示线路。
export const usePlanStore = create<PlanState>((set) => ({
  fromId: null,
  toId: null,
  plan: null,
  setPlan: ({fromId, toId, plan}) => set({fromId, toId, plan}),
  clear: () => set({fromId: null, toId: null, plan: null}),
}));
