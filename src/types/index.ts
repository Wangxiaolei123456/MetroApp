// 全局核心类型定义
// 覆盖需求 A-H 的数据建模

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface City {
  id: string;
  name: string;
  nameEn: string;
  center: GeoPoint;
  /** 地理围栏默认半径（米） */
  defaultGeofenceRadius: number;
}

/** 站点 */
export interface Station {
  id: string;
  cityId: string;
  name: string;
  nameEn: string;
  location: GeoPoint;
  /** 地理围栏半径（米），缺省用城市默认 */
  geofenceRadius?: number;
  /** 经过该站的线路 id 列表（换乘站会有多条） */
  lineIds: string[];
  /** 是否为换乘站 */
  isTransfer: boolean;
  /** 首末班车时间（HH:mm），按上下行拆分 */
  firstTrain?: {up?: string; down?: string};
  lastTrain?: {up?: string; down?: string};
  /** 出入口列表 */
  exits?: {id: string; name: string; location?: GeoPoint}[];
}

/** 线路 */
export interface MetroLine {
  id: string;
  cityId: string;
  name: string;
  nameEn: string;
  color: string;
  /** 有序的站点 id 列表（首末站顺序） */
  stationIds: string[];
  /** 相邻站点的站间距（米），长度 = stationIds.length - 1 */
  segmentDistances: number[];
}

export interface MetroGraph {
  city: City;
  lines: MetroLine[];
  stations: Station[];
}

// ===== A. 地图与导航 =====

/** 一次换乘段 */
export interface RouteLeg {
  lineId: string;
  lineName: string;
  lineColor: string;
  /** 该段经过的站点（含起止）；Google 路线可能为空数组 */
  stationIds: string[];
  stopCount: number;
  distance: number;
  /** 站点显示名（Google 路线：上车站/下车站名） */
  stationNames?: string[];
  /** 该段折线坐标（Google 路线解码后的 polyline，用于地图绘制） */
  path?: GeoPoint[];
}

/** 规划出的完整路线 */
export interface RoutePlan {
  fromStationId: string;
  toStationId: string;
  legs: RouteLeg[];
  /** 换乘次数 */
  transferCount: number;
  /** 总站点数（含起止，换乘站计 1 次） */
  totalStops: number;
  totalDistance: number;
  /** 预估耗时（分钟，含换乘步行） */
  estimatedMinutes: number;
}

/** 路线优化维度标签 */
export type RouteTag = 'recommended' | 'fast' | 'short' | 'fewTransfers' | 'alt';

/** 一条候选路线（带优化维度标签），供用户在多条中择优 */
export interface RouteOption {
  plan: RoutePlan;
  tag: RouteTag;
}

// ===== B. 行程打卡 =====

export type TripStatus = 'active' | 'completed' | 'abnormal';

export interface TripStationPass {
  stationId: string;
  /** 进入该站围栏的时间戳 */
  enteredAt: number;
  /** 离开该站围栏的时间戳 */
  leftAt?: number;
  /** 是否经识别为有效途经 */
  valid: boolean;
}

/** 行程页到站/换乘提醒 */
export type StationAlertKind = 'arrival' | 'transfer' | 'destination' | 'boarded';

export interface StationAlert {
  kind: StationAlertKind;
  stationId: string;
  stationName: string;
  nextLineName?: string;
  message: string;
}

export interface Trip {
  id: string;
  userId: string;
  cityId: string;
  status: TripStatus;
  startedAt: number;
  endedAt?: number;
  startStationId?: string;
  endStationId?: string;
  /** 规划的目的地站（来自行程规划，用于进度条）；区别于结束时的 endStationId */
  destStationId?: string;
  /** 规划的途经站点序列（来自行程规划，用于进度条） */
  plannedStationIds?: string[];
  passedStations: TripStationPass[];
  /** 定位轨迹采样点 */
  trackPoints: { at: number; location: GeoPoint; speed: number }[];
  /** 异常标记原因 */
  abnormalReasons?: string[];
  /** 结算结果 */
  summary?: TripSummary;
}

export interface TripSummary {
  stationCount: number;
  distance: number;
  durationMs: number;
  lineIds: string[];
}

// ===== C. 积分体系 =====

export type PointsSource =
  | 'ride'
  | 'transfer'
  | 'long_distance'
  | 'activity_checkin'
  | 'task'
  | 'invite'
  | 'newbie'
  | 'airdrop_exchange'
  | 'activity'
  | 'airdrop'
  | 'exchange'
  | 'refund'
  | 'admin'
  | 'other';

export interface PointsTransaction {
  id: string;
  userId: string;
  amount: number; // 正为获得，负为消耗
  source: PointsSource;
  refId?: string; // 关联行程/活动/任务 id
  createdAt: number;
  /** 是否为锁定（活动周期）积分 */
  locked: boolean;
  /** 锁定释放时间 */
  unlockAt?: number;
  note?: string;
}

export interface PointsStats {
  balance: number;
  lockedBalance: number;
  totalEarned: number;
  totalSpent: number;
}

export interface UserLevel {
  level: number;
  name: string;
  minTotalStops: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

// ===== D. Web3 钱包（Uptick Origin） =====

export type ChainEnv = 'testnet' | 'mainnet';

export interface WalletAccount {
  /** Cosmos / bech32 地址（uptick…，由 EVM 地址字节编码） */
  address: string;
  /** EVM 0x 地址（旧钱包可能缺失，刷新时补齐） */
  evmAddress?: string;
  /** 仅本地加密存储，绝不上传明文 */
  encryptedKeystore?: string;
  env: ChainEnv;
  createdAt: number;
  /** 钱包来源：社交登录 or 助记词（历史兼容） */
  kind?: 'social' | 'mnemonic';
  /** 社交登录提供方 */
  socialProvider?: 'google' | 'apple' | 'email';
}

export interface TokenBalance {
  denom: string;
  amount: string;
  symbol: string;
  /** 来源：EVM 原生 / Cosmos bank / 其他 */
  chain?: 'evm' | 'cosmos';
}

export interface NftAsset {
  id: string;
  name: string;
  collection: string;
  imageUrl?: string;
  tokenId: string;
}

export interface ChainTx {
  hash: string;
  type: 'transfer' | 'send' | 'sign' | 'airdrop_claim';
  amount?: string;
  denom?: string;
  time: number;
  status: 'success' | 'pending' | 'fail';
}

// ===== E. 周边活动与任务 =====

export type ActivityType = 'merchant' | 'exhibition' | 'popup' | 'event';

export interface Activity {
  id: string;
  cityId: string;
  type: ActivityType;
  title: string;
  description: string;
  location: GeoPoint;
  stationId?: string;
  startAt: number;
  endAt: number;
  merchantName?: string;
  couponCode?: string;
  rewardPoints?: number;
  rewardToken?: number;
  capacity?: number;
  enrolled?: number;
  status: 'online' | 'offline';
}

export type TaskType = 'daily' | 'weekly' | 'newbie';
export type TaskStatus = 'in_progress' | 'completed' | 'claimed';

export interface TaskDef {
  id: string;
  type: TaskType;
  title: string;
  description: string;
  /** 目标进度，如乘坐 3 站 */
  target: number;
  metric: 'stops' | 'rides' | 'binds';
  rewardPoints: number;
  rewardToken?: number;
}

export interface UserTask {
  taskId: string;
  progress: number;
  status: TaskStatus;
}

// ===== F. 空投与拉新 =====

export interface AirdropRule {
  id: string;
  name: string;
  totalAmount: number; // 总量（Token）
  distributed: number;
  /** 资格门槛 */
  minPoints: number;
  minStops: number;
  minActiveDays: number;
  perUserAmount: number;
  startAt: number;
  endAt: number;
  status: 'pending' | 'active' | 'finished';
}

export interface Invite {
  code: string;
  inviterId: string;
  inviteeId?: string;
  rewardClaimed: boolean;
}

export interface RankItem {
  userId: string;
  name: string;
  value: number;
}

// ===== G. 用户与设置 =====

export type AuthProvider = 'phone' | 'email' | 'google' | 'guest';

export interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
  provider: AuthProvider;
  phone?: string;
  email?: string;
  walletAddress?: string;
  totalStops: number;
  totalRides: number;
  createdAt: number;
}

export interface NotificationSettings {
  tripAlert: boolean;
  activityPush: boolean;
  airdropAlert: boolean;
}

export interface PrivacySettings {
  locationEnabled: boolean;
  dataSharing: boolean;
}
