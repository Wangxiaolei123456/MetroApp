import {create} from 'zustand';
import {ChainEnv, ChainTx, NftAsset, TokenBalance, WalletAccount} from '@/types';
import * as wallet from '@/services/walletService';
import {secureStore, storage, STORAGE_KEYS} from '@/services/storage';
import {APP_CONFIG} from '@/config/app';
import {useUserStore} from './useUserStore';
import {useTaskStore} from './useTaskStore';

interface WalletState {
  meta: WalletAccount | null;
  balances: TokenBalance[];
  nfts: NftAsset[];
  txs: ChainTx[];
  /** 乘车奖励 Token 累计（本地账本；上链前为演示数据） */
  rideTokens: number;
  loading: boolean;
  error: string | null;
  init: () => Promise<void>;
  create: (env?: ChainEnv) => Promise<void>;
  import: (mnemonic: string, env?: ChainEnv) => Promise<void>;
  switchEnv: (env: ChainEnv) => Promise<void>;
  refresh: () => Promise<void>;
  /** 行程完成时按站数累加乘车奖励 Token（每站 rideTokenPerStop） */
  creditRideTokens: (stationCount: number) => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  meta: null,
  balances: [],
  nfts: [],
  txs: [],
  rideTokens: 0,
  loading: false,
  error: null,
  async init() {
    const meta = await wallet.loadWalletMeta();
    set({meta});
    const rideTokens = await storage.get<number>(STORAGE_KEYS.rideTokens);
    if (rideTokens != null) set({rideTokens});
    if (meta) await get().refresh();
  },
  async create(env = 'testnet') {
    set({loading: true, error: null});
    try {
      const meta = await wallet.createWallet(env);
      set({meta});
      await useUserStore.getState().bindWallet(meta.address);
      useTaskStore.getState().tickMetric('binds', 1);
      await get().refresh();
    } catch (e) {
      set({error: (e as Error).message});
    } finally {
      set({loading: false});
    }
  },
  async import(mnemonic, env = 'testnet') {
    set({loading: true, error: null});
    try {
      const meta = await wallet.importWallet(mnemonic, env);
      set({meta});
      await useUserStore.getState().bindWallet(meta.address);
      useTaskStore.getState().tickMetric('binds', 1);
      await get().refresh();
    } catch (e) {
      set({error: (e as Error).message});
    } finally {
      set({loading: false});
    }
  },
  async refresh() {
    let meta = get().meta;
    if (!meta) return;
    // 补齐旧钱包缺失的 EVM 地址
    if (!meta.evmAddress) {
      meta = (await wallet.loadWalletMeta()) ?? meta;
      set({meta});
    }
    const [balances, nfts, txs] = await Promise.all([
      wallet.queryBalances(meta.address, meta.env, meta.evmAddress),
      wallet.queryNfts(meta.address, meta.env),
      wallet.queryTxs(meta.address, meta.env),
    ]);
    set({balances, nfts, txs});
  },
  async switchEnv(env) {
    const mnemonic = await secureStore.getSecret(STORAGE_KEYS.walletSecret);
    if (!mnemonic) return;
    const meta = await wallet.importWallet(mnemonic, env); // D5 重新导入到目标网络
    set({meta});
    await get().refresh();
  },
  async creditRideTokens(stationCount) {
    if (!stationCount || stationCount <= 0) return;
    const earned = stationCount * APP_CONFIG.rideTokenPerStop;
    const next = Math.round((get().rideTokens + earned) * 100) / 100;
    // 本地账本始终更新（展示 + 持久化）
    set({rideTokens: next});
    await storage.set(STORAGE_KEYS.rideTokens, next);

    // 链上发放：从发奖账户向用户转账 RIDE（需 rewardOnChain + 真实 RPC + 已配置发奖助记词）
    const meta = get().meta;
    if (meta && APP_CONFIG.rewardOnChain) {
      try {
        const base = Math.pow(10, APP_CONFIG.rideTokenExponent);
        const amountBase = Math.round(earned * base).toString();
        const hash = await wallet.sendRewardTokens(
          meta.address,
          amountBase,
          APP_CONFIG.rideTokenDenom,
          meta.env,
        );
        console.log('[wallet] RIDE 链上发放成功:', hash, '数量(base):', amountBase, meta.address);
      } catch (e) {
        // 链上失败不影响本地账本与行程流程，仅记录告警
        console.warn('[wallet] RIDE 链上发放失败，仅更新本地账本:', (e as Error).message);
      }
    }
  },
}));
