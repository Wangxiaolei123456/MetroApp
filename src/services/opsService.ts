import {fetchCollection} from './backendApi';
import {Activity, AirdropRule} from '@/types';
import {SAMPLE_ACTIVITIES, SAMPLE_RANK_STOPS} from '@/data/mockData';
import {SAMPLE_AIRDROPS, SAMPLE_METRICS, SAMPLE_PUSHES, MetricPoint, PushItem} from '@/data/opsSample';
import {DEFAULT_CITY_ID, getCityGraph} from '@/data/metroData';

// 后端模型（与 metro-backend 对齐，仅取 App 端关心的字段）
interface BackendActivity {
  id: string;
  title: string;
  type: string;
  city: string;
  status: string;
  rewardPoints: number;
  enrolled: number;
  capacity: number;
}
interface BackendAirdrop {
  id: string;
  name: string;
  totalAmount: number;
  distributed: number;
  status: string;
  minPoints: number;
  minStops: number;
  minActiveDays: number;
}
interface BackendUser {
  id: string;
  name: string;
  totalStops: number;
  totalRides: number;
  risk: string;
}

function locate(cityId: string, title: string): {latitude: number; longitude: number} {
  const g = getCityGraph(cityId);
  const s = g?.stations.find((x) => title.includes(x.name)) ?? g?.stations[0];
  return s?.location ?? g?.city.center ?? {latitude: 31.2304, longitude: 121.4737};
}

/** 拉取活动(H2)；后端不可用时回落本地种子 */
export async function fetchActivities(cityId = DEFAULT_CITY_ID): Promise<Activity[]> {
  try {
    const list = await fetchCollection<BackendActivity>('activities', {city: '演示城'});
    const online = list.filter((a) => a.status !== 'offline');
    if (online.length === 0) {
      console.warn('[MetroApp][opsService] fetchActivities: 后端无在线活动，回落本地种子');
      return SAMPLE_ACTIVITIES;
    }
    console.log(`[MetroApp][opsService] fetchActivities: 使用线上数据 ${online.length} 条`);
    return online.map((a) => ({
      id: a.id,
      cityId,
      type: (a.type as Activity['type']) ?? 'merchant',
      title: a.title,
      description: '',
      location: locate(cityId, a.title),
      startAt: Date.now(),
      endAt: Date.now() + 7 * 86400000,
      rewardPoints: a.rewardPoints,
      capacity: a.capacity,
      enrolled: a.enrolled,
      status: a.status === 'online' ? 'online' : 'offline',
    }));
  } catch {
    console.warn('[MetroApp][opsService] fetchActivities: 接口异常，回落本地种子 SAMPLE_ACTIVITIES');
    return SAMPLE_ACTIVITIES;
  }
}

/** 拉取空投规则(H4)；后端不可用时回落本地种子 */
export async function fetchAirdropRules(): Promise<AirdropRule[]> {
  try {
    const list = await fetchCollection<BackendAirdrop>('airdrops');
    const active = list.filter((a) => a.status === 'active');
    if (active.length === 0) {
      console.warn('[MetroApp][opsService] fetchAirdropRules: 后端无 active 空投，回落本地种子');
      return SAMPLE_AIRDROPS;
    }
    console.log(`[MetroApp][opsService] fetchAirdropRules: 使用线上数据 ${active.length} 条`);
    const now = Date.now();
    return active.map((a) => ({
      id: a.id,
      name: a.name,
      totalAmount: a.totalAmount,
      distributed: a.distributed,
      perUserAmount: Math.max(1, Math.floor((a.totalAmount - a.distributed) / 1000)),
      startAt: now,
      endAt: now + 30 * 24 * 3600 * 1000,
      minPoints: a.minPoints,
      minStops: a.minStops,
      minActiveDays: a.minActiveDays,
      status: 'active',
    }));
  } catch {
    console.warn('[MetroApp][opsService] fetchAirdropRules: 接口异常，回落本地种子 SAMPLE_AIRDROPS');
    return SAMPLE_AIRDROPS;
  }
}

/** 拉取乘车站数榜(H5)；后端不可用时回落本地种子 */
export async function fetchRankStops(): Promise<{userId: string; name: string; value: number}[]> {
  try {
    const list = await fetchCollection<BackendUser>('users');
    const online = list.filter((u) => u.risk !== 'blocked');
    if (online.length === 0) {
      console.warn('[MetroApp][opsService] fetchRankStops: 后端无可用用户，回落本地种子');
      return SAMPLE_RANK_STOPS;
    }
    console.log(`[MetroApp][opsService] fetchRankStops: 使用线上数据 ${online.length} 条`);
    return online
      .sort((a, b) => b.totalStops - a.totalStops)
      .map((u) => ({userId: u.id, name: u.name, value: u.totalStops}));
  } catch {
    console.warn('[MetroApp][opsService] fetchRankStops: 接口异常，回落本地种子 SAMPLE_RANK_STOPS');
    return SAMPLE_RANK_STOPS;
  }
}

/** 拉取运营看板指标(H3)；后端不可用时回落本地种子 */
export async function fetchMetrics(): Promise<MetricPoint[]> {
  try {
    const list = await fetchCollection<MetricPoint>('metrics');
    if (!list.length) {
      console.warn('[MetroApp][opsService] fetchMetrics: 后端返回空，回落本地种子 SAMPLE_METRICS');
      return SAMPLE_METRICS;
    }
    console.log(`[MetroApp][opsService] fetchMetrics: 使用线上数据 ${list.length} 条`);
    return list;
  } catch {
    console.warn('[MetroApp][opsService] fetchMetrics: 接口异常，回落本地种子 SAMPLE_METRICS');
    return SAMPLE_METRICS;
  }
}

/** 拉取推送任务(H3)；后端不可用时回落本地种子 */
export async function fetchPushes(): Promise<PushItem[]> {
  try {
    const list = await fetchCollection<PushItem>('pushes');
    if (!list.length) {
      console.warn('[MetroApp][opsService] fetchPushes: 后端返回空，回落本地种子 SAMPLE_PUSHES');
      return SAMPLE_PUSHES;
    }
    console.log(`[MetroApp][opsService] fetchPushes: 使用线上数据 ${list.length} 条`);
    return list;
  } catch {
    console.warn('[MetroApp][opsService] fetchPushes: 接口异常，回落本地种子 SAMPLE_PUSHES');
    return SAMPLE_PUSHES;
  }
}
