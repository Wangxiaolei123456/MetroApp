import {create} from 'zustand';
import {ChainEnv, ChainTx, NftAsset, TokenBalance, WalletAccount} from '@/types';
import * as wallet from '@/services/walletService';
import {secureStore, STORAGE_KEYS} from '@/services/storage';
import {useUserStore} from './useUserStore';
import {useTaskStore} from './useTaskStore';

interface WalletState {
  meta: WalletAccount | null;
  balances: TokenBalance[];
  nfts: NftAsset[];
  txs: ChainTx[];
  loading: boolean;
  error: string | null;
  init: () => Promise<void>;
  create: (env?: ChainEnv) => Promise<void>;
  import: (mnemonic: string, env?: ChainEnv) => Promise<void>;
  switchEnv: (env: ChainEnv) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  meta: null,
  balances: [],
  nfts: [],
  txs: [],
  loading: false,
  error: null,
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
    const meta = get().meta;
    if (!meta) return;
    const [balances, nfts, txs] = await Promise.all([
      wallet.queryBalances(meta.address, meta.env),
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
}));
