import {
  Activity,
  AirdropRule,
  Badge,
  TaskDef,
  UserLevel,
} from '@/types';

// ===== 用户等级（按累计站数） =====
export const USER_LEVELS: UserLevel[] = [
  {level: 1, name: '初乘者', minTotalStops: 0},
  {level: 2, name: '通勤族', minTotalStops: 20},
  {level: 3, name: '地铁迷', minTotalStops: 80},
  {level: 4, name: '城市行者', minTotalStops: 200},
  {level: 5, name: '地铁传奇', minTotalStops: 500},
];

export function levelOf(totalStops: number): UserLevel {
  let result = USER_LEVELS[0];
  for (const lv of USER_LEVELS) {
    if (totalStops >= lv.minTotalStops) result = lv;
  }
  return result;
}

// ===== 勋章 =====
export const BADGES: Omit<Badge, 'unlocked'>[] = [
  {id: 'b_first', name: '初次旅程', description: '完成首次乘车', icon: '🚇'},
  {id: 'b_transfer', name: '换乘达人', description: '完成一次换乘', icon: '🔁'},
  {id: 'b_10', name: '十站达成', description: '累计乘坐 10 站', icon: '🔟'},
  {id: 'b_wallet', name: '链上公民', description: '绑定 Uptick 钱包', icon: '🔗'},
  {id: 'b_invite', name: '推广之星', description: '成功邀请 1 位好友', icon: '🤝'},
];

// ===== 周边活动（示例城市 demo） =====
export const SAMPLE_ACTIVITIES: Activity[] = [
  {
    id: 'act1',
    cityId: 'demo',
    type: 'merchant',
    title: '科技园咖啡 8 折',
    description: '科技园站周边合作咖啡店，出示优惠券享 8 折。',
    location: {latitude: 31.2304, longitude: 121.48},
    stationId: 'l1s6',
    startAt: Date.now() - 86400000,
    endAt: Date.now() + 7 * 86400000,
    merchantName: 'Metro Coffee',
    couponCode: 'METRO20',
    rewardPoints: 20,
    capacity: 500,
    enrolled: 132,
    status: 'online',
  },
  {
    id: 'act2',
    cityId: 'demo',
    type: 'exhibition',
    title: '滨江艺术展',
    description: '滨江枢纽艺术区限时展览，到店打卡领积分。',
    location: {latitude: 31.245, longitude: 121.472},
    stationId: 'l3s6',
    startAt: Date.now() - 3600000,
    endAt: Date.now() + 14 * 86400000,
    rewardPoints: 50,
    rewardToken: 5,
    capacity: 200,
    enrolled: 47,
    status: 'online',
  },
  {
    id: 'act3',
    cityId: 'demo',
    type: 'popup',
    title: '机场快闪市集',
    description: '机场站限时快闪，参与互动得代币。',
    location: {latitude: 31.195, longitude: 121.472},
    stationId: 'l3s1',
    startAt: Date.now() + 86400000,
    endAt: Date.now() + 3 * 86400000,
    rewardToken: 2,
    capacity: 100,
    enrolled: 12,
    status: 'online',
  },
];

// ===== 任务定义 =====
export const TASK_DEFS: TaskDef[] = [
  {
    id: 't_daily_3',
    type: 'daily',
    title: '今日乘坐 3 站',
    description: '今日累计乘坐 3 站',
    target: 3,
    metric: 'stops',
    rewardPoints: 30,
  },
  {
    id: 't_daily_ride',
    type: 'daily',
    title: '完成一次乘车',
    description: '今日完成 1 次完整行程',
    target: 1,
    metric: 'rides',
    rewardPoints: 20,
  },
  {
    id: 't_weekly_10',
    type: 'weekly',
    title: '本周乘坐 10 站',
    description: '本周累计乘坐 10 站',
    target: 10,
    metric: 'stops',
    rewardPoints: 80,
  },
  {
    id: 't_newbie_wallet',
    type: 'newbie',
    title: '绑定 Uptick 钱包',
    description: '首次绑定链上钱包',
    target: 1,
    metric: 'binds',
    rewardPoints: 100,
    rewardToken: 10,
  },
  {
    id: 't_newbie_first',
    type: 'newbie',
    title: '首次乘车',
    description: '完成你的第一次地铁行程',
    target: 1,
    metric: 'rides',
    rewardPoints: 50,
  },
];

// ===== 空投规则 =====
export const SAMPLE_AIRDROPS: AirdropRule[] = [
  {
    id: 'air1',
    name: '首发乘车空投',
    totalAmount: 100000,
    distributed: 12000,
    minPoints: 100,
    minStops: 10,
    minActiveDays: 1,
    perUserAmount: 50,
    startAt: Date.now() - 86400000,
    endAt: Date.now() + 30 * 86400000,
    status: 'active',
  },
  {
    id: 'air2',
    name: '邀请裂变空投',
    totalAmount: 50000,
    distributed: 3000,
    minPoints: 0,
    minStops: 0,
    minActiveDays: 0,
    perUserAmount: 20,
    startAt: Date.now() - 86400000,
    endAt: Date.now() + 60 * 86400000,
    status: 'active',
  },
];

// ===== 排行榜示例 =====
export const SAMPLE_RANK_STOPS: {userId: string; name: string; value: number}[] = [
  {userId: 'u_001', name: '地铁侠', value: 432},
  {userId: 'u_002', name: '通勤王', value: 388},
  {userId: 'u_003', name: 'CryptoLin', value: 311},
];

export const SAMPLE_RANK_POINTS: {userId: string; name: string; value: number}[] = [
  {userId: 'u_002', name: '通勤王', value: 9800},
  {userId: 'u_001', name: '地铁侠', value: 8200},
  {userId: 'u_003', name: 'CryptoLin', value: 6400},
];
