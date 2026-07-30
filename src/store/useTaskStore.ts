import {create} from 'zustand';
import {PointsTransaction, UserTask} from '@/types';
import {TASK_DEFS} from '@/data/mockData';
import {usePointsStore} from './usePointsStore';

interface TaskState {
  tasks: UserTask[];
  /** 触发指标进度，自动推进相关任务 */
  tickMetric: (metric: 'stops' | 'rides' | 'checkins' | 'binds', amount?: number) => void;
  claim: (taskId: string) => Promise<void>;
}

function seed(): UserTask[] {
  return TASK_DEFS.map((t) => ({taskId: t.id, progress: 0, status: 'in_progress'}));
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: seed(),
  tickMetric(metric, amount = 1) {
    const tasks = get().tasks.map((ut) => {
      const def = TASK_DEFS.find((d) => d.id === ut.taskId);
      if (!def || def.metric !== metric || ut.status !== 'in_progress') return ut;
      const progress = Math.min(def.target, ut.progress + amount);
      return {
        ...ut,
        progress,
        status: progress >= def.target ? 'completed' : 'in_progress',
      } as UserTask;
    });
    set({tasks});
  },
  async claim(taskId) {
    const ut = get().tasks.find((t) => t.taskId === taskId);
    const def = TASK_DEFS.find((d) => d.id === taskId);
    if (!ut || !def || ut.status !== 'completed') return;
    const txs: PointsTransaction[] = [
      {
        id: `ptx_task_${taskId}_${Date.now()}`,
        userId: 'me',
        amount: def.rewardPoints,
        source: 'task',
        refId: taskId,
        createdAt: Date.now(),
        locked: false,
        note: `任务奖励：${def.title}`,
      },
    ];
    await usePointsStore.getState().addTransactions(txs);
    set({tasks: get().tasks.map((t) => (t.taskId === taskId ? {...t, status: 'claimed'} : t))});
  },
}));
