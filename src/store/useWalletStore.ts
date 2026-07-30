import {create} from 'zustand';
import {ChainEnv, ChainTx, NftAsset, TokenBalance, WalletAccount} from '@/types';
import * as wallet from '@/services/walletService';
import {sendEvmNativeReward} from '@/services/evmWallet';
import {secureStore, STORAGE_KEYS} from '@/services/storage';
import {APP_CONFIG} from '@/config/app';
import {useUserStore} from './useUserStore';
import {useTaskStore} from './useTaskStore';

interface WalletState {
  meta: WalletAccount | null;
  balances: TokenBalance[];
  nfts: NftAsset[];
  txs: ChainTx[];
  loading: boolean;
  error: string | null;
  /** 最近一次乘车发奖结果（成功哈希或失败信息） */
  lastReward: {hash?: string; error?: string; amount?: number} | null;
  init: () => Promise<void>;
  create: (env?: ChainEnv) => Promise<void>;
  import: (mnemonic: string, env?: ChainEnv) => Promise<void>;
  switchEnv: (env: ChainEnv) => Promise<void>;
  refresh: () => Promise<void>;
  /** 行程完成：按站数向用户 EVM 钱包直发 UPTICK */
  creditRideTokens: (stationCount: number) => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  meta: null,
  balances: [],
  nfts: [],
  txs: [],
  loading: false,
  error: null,
  lastReward: null,
  async init() {
    const meta = await wallet.loadWalletMeta();
    set({meta});
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
    const meta = await wallet.importWallet(mnemonic, env);
    set({meta});
    await get().refresh();
  },
  async creditRideTokens(stationCount) {
    if (!stationCount || stationCount <= 0) return;
    if (!APP_CONFIG.rewardOnChain) return;

    const meta = get().meta;
    if (!meta?.evmAddress) {
      set({lastReward: {error: 'no evm address'}});
      return;
    }
    if (!APP_CONFIG.rewardTreasuryKey.trim()) {
      set({lastReward: {error: 'rewardTreasuryKey empty'}});
      return;
    }

    const amount = Math.round(stationCount * APP_CONFIG.rideTokenPerStop * 1e8) / 1e8;
    try {
      const hash = await sendEvmNativeReward(meta.evmAddress, amount, meta.env);
      set({
        lastReward: {hash, amount},
        txs: [
          {
            hash,
            type: 'airdrop_claim',
            amount: String(amount),
            denom: APP_CONFIG.rideTokenSymbol,
            time: Date.now(),
            status: 'success',
          },
          ...get().txs,
        ],
      });
      await get().refresh();
    } catch (e) {
      set({lastReward: {error: (e as Error).message, amount}});
      console.warn('[wallet] UPTICK 发放失败:', (e as Error).message);
    }
  },
}));
