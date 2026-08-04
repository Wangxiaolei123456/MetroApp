// 奖励模块后端服务封装：积分账户、任务、活动报名、空投领取、排行榜、积分流水。
// 所有请求带 X-User-Id（= 当前登录用户 profile.id）。未配置后端时优雅降级为空/默认值。
import {METRO_API_BASE} from '@/config/env';
import {useUserStore} from '@/store/useUserStore';
import {usePointsStore} from '@/store/usePointsStore';

function userId(): string | null {
  return useUserStore.getState().profile?.id ?? null;
}

async function req<T>(path: string, init?: {method?: string; headers?: Record<string, string>; body?: any}): Promise<T> {
  if (!METRO_API_BASE) throw new Error('backend not configured');
  const uid = userId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (uid) headers['X-User-Id'] = uid;
  const res = await fetch(`${METRO_API_BASE}${path}`, {
    method: init?.method || 'GET',
    headers,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    let msg = `请求失败 ${res.status}`;
    try {
      const e = await res.json();
      msg = e.message || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ===================== 用户账户 =====================
export interface RewardUser {
  id: string;
  name: string;
  balance: number;
  totalStops: number;
  totalRides: number;
  rank: number;
}

export async function getRewardUser(): Promise<RewardUser> {
  return req<RewardUser>('/api/users/me');
}

// 乘车积分发放：前端行程完成时调用，后端原子加积分并推进 ride 任务
export async function reportRidePoints(p: {tripId: string; amount: number; stops: number; rides: number}): Promise<{balance: number; amount: number; duplicated?: boolean}> {
  return req('/api/points/ride', {method: 'POST', body: p});
}

// 积分流水从后端同步积分余额与流水到 usePointsStore
export async function syncPoints(): Promise<void> {
  await usePointsStore.getState().syncFromBackend();
}

// ===================== 积分流水 =====================
export interface PointTx {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  refId: string | null;
  remark: string | null;
  createdAt: string;
}

export async function getPointTransactions(limit = 50): Promise<PointTx[]> {
  return req<PointTx[]>(`/api/points/transactions?limit=${limit}`);
}

// ===================== 任务 =====================
export interface TaskItem {
  id: string;
  title: string;
  titleEn: string | null;
  descr: string | null;
  type: string;
  target: number;
  rewardPoints: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  claimable: boolean;
}

export async function getTasks(): Promise<TaskItem[]> {
  return req<TaskItem[]>('/api/tasks');
}

export async function reportTaskProgress(taskId: string, progress: number): Promise<{taskId: string; progress: number; completed: boolean; target: number}> {
  return req(`/api/tasks/${taskId}/progress`, {method: 'POST', body: {progress}});
}

export async function claimTask(taskId: string): Promise<{balance: number; reward: number}> {
  return req(`/api/tasks/${taskId}/claim`, {method: 'POST'});
}

// ===================== 活动报名 =====================
export async function getMyActivityIds(): Promise<string[]> {
  return req<string[]>('/api/activities/my');
}

export async function signupActivity(activityId: string): Promise<{isNew: boolean; balance: number; reward: number}> {
  return req(`/api/activities/${activityId}/signup`, {method: 'POST'});
}

// ===================== 空投领取 =====================
export async function getMyAirdropIds(): Promise<string[]> {
  return req<string[]>('/api/airdrops/my');
}

export async function claimAirdrop(airdropId: string): Promise<{isNew: boolean; balance: number; reward: number}> {
  return req(`/api/airdrops/${airdropId}/claim`, {method: 'POST'});
}

// ===================== 排行榜 =====================
export interface RankItem {
  rank: number;
  userId: string;
  name: string;
  balance: number;
  totalStops: number;
  totalRides: number;
}

export async function getRanking(limit = 20): Promise<{list: RankItem[]; myRank: number | null}> {
  return req(`/api/ranking?limit=${limit}`);
}
