import {create} from 'zustand';
import {ChainEnv, ChainTx, NftAsset, TokenBalance, WalletAccount} from '@/types';
import * as wallet from '@/services/walletService';
import {sendEvmNativeReward} from '@/services/evmWallet';
import {APP_CONFIG} from '@/config/app';
import {loginWithSocial, logoutWeb3Auth, SocialProvider} from '@/services/web3Auth';
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
  /** 社交登录创建钱包（Web3Auth / Uptick webauth） */
  create: (provider: SocialProvider, env?: ChainEnv) => Promise<void>;
  /** @deprecated 历史兼容：助记词导入，UI 已移除入口 */
  import: (mnemonic: string, env?: ChainEnv) => Promise<void>;
  switchEnv: (env: ChainEnv) => Promise<void>;
  refresh: () => Promise<void>;
  /** 退出社交登录并清除钱包元数据 */
  logout: () => Promise<void>;
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
  async create(provider, env = 'testnet') {
    set({loading: true, error: null});
    try {
      const res = await loginWithSocial(provider, env);
      const meta: WalletAccount = {
        address: res.cosmosAddress,
        evmAddress: res.evmAddress,
        env,
        createdAt: Date.now(),
        kind: 'social',
        socialProvider: provider,
      };
      await wallet.saveWalletMeta(meta);
      set({meta});
      await useUserStore.getState().bindWallet(meta.address);
      useTaskStore.getState().tickMetric('binds', 1);
      const user = useUserStore.getState();
      await user.update({
        ...(res.email ? {email: res.email} : {}),
        ...(res.name ? {name: res.name} : {}),
        ...(res.profileImage ? {avatar: res.profileImage} : {}),
      });
      await get().refresh();
    } catch (e) {
      set({error: (e as Error).message});
    } finally {
      set({loading: false});
    }
  },
  /** @deprecated 保留内部调用，UI 不再暴露助记词导入 */
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
      wallet.queryTxs(meta.evmAddress ?? meta.address, meta.env),
    ]);
    set({balances, nfts, txs});
  },
  async switchEnv(env) {
    const meta = get().meta;
    if (!meta) return;
    const next: WalletAccount = {...meta, env};
    await wallet.saveWalletMeta(next);
    set({meta: next});
    await get().refresh();
  },
  async logout() {
    try {
      await logoutWeb3Auth();
    } catch {
      // 忽略登出异常，仍清理本地状态
    }
    await wallet.clearWalletMeta();
    set({meta: null, balances: [], nfts: [], txs: [], lastReward: null, error: null});
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
