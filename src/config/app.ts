import {ChainEnv} from '@/types';

// ===== 应用级配置（集中管理，便于后台下发/替换） =====

export const APP_CONFIG = {
  /** C1 基础积分：每站固定积分 */
  pointsPerStop: 10,
  /** 换乘加成（每次换乘额外积分） */
  transferBonus: 15,
  /** 长途加成门槛（站数）与每站额外积分 */
  longDistanceThreshold: 12,
  longDistancePerStopBonus: 2,

  /** 防作弊阈值（B4） */
  antiCheat: {
    /** 单点瞬时速度上限（米/秒），地铁约 < 33 m/s */
    maxPlausibleSpeed: 40,
    /** 两站最小合理时间间隔（毫秒），过短视为瞬移 */
    minStationIntervalMs: 20_000,
    /** 轨迹最大断点间隔（毫秒），超过视为定位丢失/异常 */
    maxTrackGapMs: 120_000,
  },

  /** 默认链上环境 */
  chainEnv: 'testnet' as ChainEnv,

  /** 乘车奖励 Token：每途经 1 站获得的 Token 数量 */
  rideTokenPerStop: 0.01,
  /** 乘车奖励 Token 符号（本地账本，上链前为演示数据） */
  rideTokenSymbol: 'RIDE',
  /** 乘车奖励 Token 的 denom（链上 base 单位，如 uride = 10^-6 RIDE） */
  rideTokenDenom: 'uride',
  /** 乘车奖励 denom 的小数位（uride -> 1e6） */
  rideTokenExponent: 6,

  /**
   * 乘车奖励「链上发放」开关。
   * 实际转账还需同时满足：WALLET_MOCK=false（见 walletService.ts）+ 真实 RPC（UPTICK_CONFIG）+ rewardTreasuryKey 已配置。
   * 开启后，每次行程完成会从 rewardTreasuryKey 对应的发奖账户向用户地址转账 RIDE。
   */
  rewardOnChain: true,
  /**
   * 发奖账户（treasury）密钥：支持两种格式（自动识别）
   *   - 12/24 词助记词（空格分隔）
   *   - 64 位 hex 私钥（32 字节，可带 0x 前缀）
   * 该地址需持有 RIDE(uride) 代币并承担发放。
   * 演示用，请替换为你自己持有的、已充值 RIDE 的钱包密钥（切勿把真实密钥提交到仓库）。
   */
  rewardTreasuryKey: '0x779fdb593268870a70532240e4c97cc3e6c99f0846a366de866558e5c4c54290',
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
