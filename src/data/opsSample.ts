import {AirdropRule} from '@/types';

/** 空投规则种子（与后端 airdrops 对齐；后端不可用时回落） */
export const SAMPLE_AIRDROPS: AirdropRule[] = [
  {
    id: 'air1',
    name: '首发乘车空投',
    totalAmount: 100000,
    distributed: 12000,
    perUserAmount: 50,
    startAt: Date.now() - 86400000,
    endAt: Date.now() + 30 * 86400000,
    minPoints: 100,
    minStops: 10,
    minActiveDays: 1,
    status: 'active',
  },
  {
    id: 'air2',
    name: '邀请裂变空投',
    totalAmount: 50000,
    distributed: 3000,
    perUserAmount: 20,
    startAt: Date.now() - 86400000,
    endAt: Date.now() + 60 * 86400000,
    minPoints: 0,
    minStops: 0,
    minActiveDays: 0,
    status: 'active',
  },
];

export interface MetricPoint {
  date: string;
  dau: number;
  rides: number;
  points: number;
  claims: number;
}

export interface PushItem {
  id: string;
  title: string;
  target: string;
  channel: string;
  sent: number;
  status: string;
}

/** 运营看板指标种子（H3） */
export const SAMPLE_METRICS: MetricPoint[] = [
  {date: '07-21', dau: 1200, rides: 3400, points: 42000, claims: 120},
  {date: '07-22', dau: 1320, rides: 3700, points: 46000, claims: 150},
  {date: '07-23', dau: 1410, rides: 4010, points: 50000, claims: 180},
  {date: '07-24', dau: 1380, rides: 3900, points: 49000, claims: 165},
  {date: '07-25', dau: 1550, rides: 4300, points: 54000, claims: 210},
  {date: '07-26', dau: 1620, rides: 4500, points: 56000, claims: 230},
  {date: '07-27', dau: 1700, rides: 4800, points: 60000, claims: 260},
];

/** 推送任务种子（H3） */
export const SAMPLE_PUSHES: PushItem[] = [
  {id: 'p1', title: '周末乘车挑战', target: '演示城', channel: 'activity', sent: 12000, status: 'sent'},
  {id: 'p2', title: '空投领取提醒', target: '标签:高积分', channel: 'airdrop', sent: 0, status: 'scheduled'},
  {id: 'p3', title: '系统维护通知', target: '全部用户', channel: 'notice', sent: 0, status: 'draft'},
];
