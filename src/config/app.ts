import { ChainEnv } from '@/types';
import { METRO_API_BASE, MALL_SERVER_URL } from './env';

// ===== 应用级配置（集中管理，便于后台下发/替换） =====

export const APP_CONFIG = {
  /** C1 基础积分：每站固定积分 */
  pointsPerStop: 10,
  /** 换乘加成（每次换乘额外积分） */
  transferBonus: 15,
  /** 长途加成门槛（站数）与每站额外积分 */
  longDistanceThreshold: 12,
  longDistancePerStopBonus: 2,

  /** 防作弊阈值（B4）——按地铁场景校准：地下丢星/跳点不应直接判异常 */
  antiCheat: {
    /** 总开关：false 时不标记异常、不影响积分结算 */
    enabled: false,
    /**
     * 连续采样瞬时速度上限（米/秒）。
     * 地铁运营约 < 33 m/s；留余量给 GPS 误差。仅对「连续采样」生效。
     */
    maxPlausibleSpeed: 50,
    /**
     * 速度采样最大时间间隔（毫秒）。
     * 超过则视为信号中断后恢复，不计瞬时速度（避免隧道出站「瞬移超速」误报）。
     */
    speedSampleMaxDtMs: 15_000,
    /**
     * 允许的超速噪点个数。地下 GPS 偶发跳点很常见；仅超过此数才判速度异常。
     */
    maxSpeedOutliers: 25,
    /** 两站最小合理时间间隔（毫秒），过短视为站间瞬移 */
    minStationIntervalMs: 20_000,
    /**
     * 轨迹最大断点（毫秒）。地铁地下丢星数分钟属正常。
     * 设为 0 表示不因断点单独判异常（站间时间仍校验）。
     */
    maxTrackGapMs: 0,
  },

  /** 默认链上环境 */
  chainEnv: 'testnet' as ChainEnv,

  /** 乘车奖励：每途经 1 站发放到用户 EVM 钱包的 UPTICK 数量 */
  rideTokenPerStop: 0.01,
  /** 展示用符号（与 EVM 原生币一致） */
  rideTokenSymbol: 'UPTICK',

  /**
   * 乘车奖励链上发放开关。
   * true：行程完成后由发奖账户向用户 EVM 地址转原生 UPTICK（不经过本地账本）。
   */
  rewardOnChain: true,
  /**
   * 发奖账户（treasury）密钥：支持助记词或 64 位 hex 私钥（可带 0x）。
   * 该 EVM 地址需持有 UPTICK 并承担 gas。切勿把真实主网密钥提交到仓库。
   */
  rewardTreasuryKey:
    '0x779fdb593268870a70532240e4c97cc3e6c99f0846a366de866558e5c4c54290',

  /**
   * H2–H6 运营后端地址（activity/airdrop/rank/metrics/pushes）。
   * 取自 src/config/env.ts 的 METRO_API_BASE，缺省为 ''（回落本地种子）。
   */
  metroApiBase: METRO_API_BASE,

  /**
   * 商城远端后端（复用 Metro.IOS 既有服务）。
   * 取自 src/config/env.ts 的 MALL_SERVER_URL，缺省为 ''（回落 Mock）。
   */
  mallServerUrl: MALL_SERVER_URL,
};

// ===== Google Maps Platform 配置 =====
// Routes API：https://developers.google.com/maps/documentation/routes
// 请在 Google Cloud Console 启用 "Routes API" 并替换为你的 API Key。
export const GOOGLE_MAPS_CONFIG = {
  apiKey: 'AIzaSyCuumkmBiuuX9g9c_HD-HaLgFV-g5NSJ-E',
  routesEndpoint: 'https://routes.googleapis.com/directions/v2:computeRoutes',
  /** 请求超时（毫秒） */
  timeoutMs: 12_000,
};

// ===== Uptick Origin 链上接入配置 =====
// Cosmos RPC 为占位；EVM JSON-RPC 为官方公开节点。
export const UPTICK_CONFIG: Record<
  ChainEnv,
  {
    chainId: string;
    rpc: string;
    rest: string;
    denom: string;
    coinSymbol: string;
    explorer: string;
    /** EVM JSON-RPC */
    evmRpc: string;
    evmChainId: number;
    evmSymbol: string;
    evmDecimals: number;
    evmExplorer: string;
  }
> = {
  testnet: {
    chainId: 'origin_1170-3',
    rpc: 'https://rpc.origin.uptick.network',
    rest: 'https://api.origin.uptick.network',
    denom: 'auptick',
    coinSymbol: 'UPTICK',
    explorer: 'https://explorer.origin.uptick.network',
    evmRpc: 'https://json-rpc.origin.uptick.network/',
    evmChainId: 1170,
    evmSymbol: 'UPTICK',
    evmDecimals: 18,
    evmExplorer: 'https://evm-explorer.origin.uptick.network',
  },
  mainnet: {
    chainId: 'uptick_117-1',
    rpc: 'https://rpc.uptick.network',
    rest: 'https://rest.uptick.network',
    denom: 'auptick',
    coinSymbol: 'UPTICK',
    explorer: 'https://explorer.uptick.network',
    evmRpc: 'https://json-rpc.uptick.network/',
    evmChainId: 117,
    evmSymbol: 'UPTICK',
    evmDecimals: 18,
    evmExplorer: 'https://evm-explorer.uptick.network',
  },
};
