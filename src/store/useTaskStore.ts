import {create} from 'zustand';
import {UserTask} from '@/types';
import {TASK_DEFS} from '@/data/mockData';
import {usePointsStore} from './usePointsStore';
import {claimTask, getTasks, reportTaskProgress} from '@/services/rewardsService';

interface TaskMeta {
  title: string;
  target: number;
  rewardPoints: number;
  type: string;
}

interface TaskState {
  tasks: UserTask[];
  /** 后端任务展示信息（id -> 标题/目标/奖励/类型） */
  meta: Record<string, TaskMeta>;
  loading: boolean;
  /** 从后端加载任务列表（含进度/claimable）；后端不可用时回退本地种子 */
  load: () => Promise<void>;
  /** 触发指标进度，本地推进并上报后端 */
  tickMetric: (metric: 'stops' | 'rides' | 'binds', amount?: number) => void;
  /** 领取任务奖励：调后端并同步积分 */
  claim: (taskId: string) => Promise<void>;
}

// 后端 TaskItem -> 前端 UserTask
function toUserTask(t: {
  id: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
}): UserTask {
  const status: UserTask['status'] = t.claimed ? 'claimed' : t.completed ? 'completed' : 'in_progress';
  return {taskId: t.id, progress: t.progress, status};
}

function toMeta(t: {id: string; title: string; target: number; rewardPoints: number; type: string}): TaskMeta {
  return {title: t.title, target: t.target, rewardPoints: t.rewardPoints, type: t.type};
}

// 本地兜底种子（后端不可用/未配置时使用）
function seed(): UserTask[] {
  return TASK_DEFS.map(t => ({taskId: t.id, progress: 0, status: 'in_progress'}));
}

function seedMeta(): Record<string, TaskMeta> {
  const m: Record<string, TaskMeta> = {};
  TASK_DEFS.forEach(t => {
    m[t.id] = {title: t.title, target: t.target, rewardPoints: t.rewardPoints, type: t.type};
  });
  return m;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: seed(),
  meta: seedMeta(),
  loading: false,
  async load() {
    set({loading: true});
    try {
      const tasks = await getTasks();
      set({
        tasks: tasks.map(toUserTask),
        meta: Object.fromEntries(tasks.map(t => [t.id, toMeta(t)])),
      });
    } catch {
      // 后端不可用：保留本地种子展示
      set({tasks: seed(), meta: seedMeta()});
    } finally {
      set({loading: false});
    }
  },
  tickMetric(metric, amount = 1) {
    // 映射前端 metric -> 后端任务 type
    const backendType =
      metric === 'stops' || metric === 'rides' ? 'ride' : metric === 'binds' ? 'profile' : null;
    // 本地推进（保持 UI 即时反馈）
    const tasks = get().tasks.map(ut => {
      const def = TASK_DEFS.find(d => d.id === ut.taskId);
      if (!def || def.metric !== metric || ut.status !== 'in_progress') return ut;
      const progress = Math.min(def.target, ut.progress + amount);
      return {...ut, progress, status: progress >= def.target ? 'completed' : 'in_progress'} as UserTask;
    });
    set({tasks});
    // 上报后端（按 type 推进，进度累加）
    if (backendType) {
      get().tasks
        .filter(ut => TASK_DEFS.find(d => d.taskId === ut.taskId)?.type === backendType)
        .forEach(ut => {
          reportTaskProgress(ut.taskId, ut.progress).catch(() => {/* 离线忽略 */});
        });
    }
  },
  async claim(taskId) {
    // 乐观更新本地状态
    set({tasks: get().tasks.map(t => (t.taskId === taskId ? {...t, status: 'claimed'} : t))});
    try {
      await claimTask(taskId);
      // 以后端积分账本为准同步（任务 id 与本地 TASK_DEFS 不一致时不能只靠本地加流水）
      await usePointsStore.getState().syncFromBackend();
    } catch {
      // 后端失败：回滚本地状态
      set({tasks: get().tasks.map(t => (t.taskId === taskId ? {...t, status: 'completed'} : t))});
    }
  },
}));
