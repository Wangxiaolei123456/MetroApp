import {DirectSecp256k1HdWallet, DirectSecp256k1Wallet, makeAuthInfoBytes} from '@cosmjs/proto-signing';
import {stringToPath} from '@cosmjs/crypto';
import {SigningStargateClient, coin} from '@cosmjs/stargate';
import {SignDoc, TxBody} from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import {PubKey} from 'cosmjs-types/cosmos/crypto/secp256k1/keys';
import {Any} from 'cosmjs-types/google/protobuf/any';
import {bip39Generate, bip39Validate} from './bip39Wrapper';
import {deriveEvmAccount, EVM_HD_PATH, queryEvmNativeBalance} from './evmWallet';
import {ChainEnv, NftAsset, TokenBalance, WalletAccount, ChainTx} from '@/types';
import {UPTICK_CONFIG, APP_CONFIG} from '@/config/app';
import {secureStore, storage, STORAGE_KEYS} from './storage';
import {t} from '@/i18n';

// 沙箱/无网环境下 Cosmos 查询走 Mock；EVM 余额始终尝试真实 JSON-RPC。
// 乘车奖励链上发放需要此为 false + 真实 RPC + 已配置发奖密钥（见 APP_CONFIG.rewardTreasuryKey）。
const WALLET_MOCK = false;
const ADDRESS_PREFIX = 'uptick';

export class WalletError extends Error {}

function envConfig(env: ChainEnv) {
  return UPTICK_CONFIG[env];
}

/** D1 生成助记词（12 词） */
export function generateMnemonic(): string {
  return bip39Generate(128);
}

/** 校验助记词 */
export function validateMnemonic(m: string): boolean {
  return bip39Validate(m.trim());
}

/** 由助记词推导 CosmJS 钱包（ETH coin type，与 EVM 同源） */
async function deriveWallet(mnemonic: string): Promise<DirectSecp256k1HdWallet> {
  return DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: ADDRESS_PREFIX,
    hdPaths: [stringToPath(EVM_HD_PATH)],
  });
}

async function buildMeta(mnemonic: string, env: ChainEnv): Promise<WalletAccount> {
  const {evmAddress, cosmosAddress} = await deriveEvmAccount(mnemonic);
  return {
    address: cosmosAddress,
    evmAddress,
    env,
    createdAt: Date.now(),
  };
}

/** D1 创建钱包：生成 + 本地加密存储助记词 */
export async function createWallet(
  env: ChainEnv = APP_CONFIG.chainEnv,
): Promise<WalletAccount> {
  const mnemonic = generateMnemonic();
  await deriveWallet(mnemonic);
  await secureStore.saveSecret(STORAGE_KEYS.walletSecret, mnemonic);
  const meta = await buildMeta(mnemonic, env);
  await storage.set(STORAGE_KEYS.walletMeta, meta);
  return meta;
}

/** D1 导入钱包：校验助记词后保存 */
export async function importWallet(
  mnemonic: string,
  env: ChainEnv = APP_CONFIG.chainEnv,
): Promise<WalletAccount> {
  if (!validateMnemonic(mnemonic)) throw new WalletError(t('svc.wallet.invalidMnemonic'));
  const trimmed = mnemonic.trim();
  await deriveWallet(trimmed);
  await secureStore.saveSecret(STORAGE_KEYS.walletSecret, trimmed);
  const meta = await buildMeta(trimmed, env);
  await storage.set(STORAGE_KEYS.walletMeta, meta);
  return meta;
}

/** 读取已保存的钱包元数据；旧数据缺 evmAddress 时自动补齐 */
export async function loadWalletMeta(): Promise<WalletAccount | null> {
  const meta = await storage.get<WalletAccount>(STORAGE_KEYS.walletMeta);
  if (!meta) return null;
  if (meta.evmAddress) return meta;
  const mnemonic = await secureStore.getSecret(STORAGE_KEYS.walletSecret);
  if (!mnemonic) return meta;
  try {
    const {evmAddress, cosmosAddress} = await deriveEvmAccount(mnemonic);
    const next: WalletAccount = {
      ...meta,
      evmAddress,
      address: cosmosAddress,
    };
    await storage.set(STORAGE_KEYS.walletMeta, next);
    return next;
  } catch {
    return meta;
  }
}

/** 加载完整钱包（用于签名，私钥仅存在于内存） */
export async function loadSigningWallet(): Promise<DirectSecp256k1HdWallet> {
  const mnemonic = await secureStore.getSecret(STORAGE_KEYS.walletSecret);
  if (!mnemonic) throw new WalletError(t('svc.wallet.notFound'));
  return deriveWallet(mnemonic);
}

/** D3 资产查询：仅展示 EVM 原生余额 */
export async function queryBalances(
  _address: string,
  env: ChainEnv,
  evmAddress?: string,
): Promise<TokenBalance[]> {
  const list: TokenBalance[] = [];

  if (evmAddress) {
    const evm = await queryEvmNativeBalance(evmAddress, env);
    list.push({
      denom: 'evm-native',
      amount: evm.amount,
      symbol: evm.symbol,
      chain: 'evm',
    });
  }

  return list;
}

export async function queryNfts(
  _address: string,
  _env: ChainEnv,
): Promise<NftAsset[]> {
  if (WALLET_MOCK) {
    return [
      {id: 'n1', name: 'Metro Pioneer', collection: 'Metro OG', tokenId: '1'},
      {id: 'n2', name: 'Ride Master', collection: 'Metro OG', tokenId: '7'},
    ];
  }
  return [];
}

export async function queryTxs(_address: string, _env: ChainEnv): Promise<ChainTx[]> {
  if (WALLET_MOCK) {
    return [
      {
        hash: '0xabc...',
        type: 'airdrop_claim',
        amount: '50',
        denom: 'AIR',
        time: Date.now() - 86400000,
        status: 'success',
      },
    ];
  }
  return [];
}

/**
 * D4 链上签名授权：构造最小 SignDoc 并签名，返回签名结果。
 */
export async function signPayload(payload: Record<string, unknown>): Promise<{
  signature: string;
  signed: Record<string, unknown>;
}> {
  const wallet = await loadSigningWallet();
  const [account] = await wallet.getAccounts();
  const meta = await loadWalletMeta();
  const cfg = envConfig(meta?.env ?? 'testnet');

  const pubkeyAny = Any.fromPartial({
    typeUrl: '/cosmos.crypto.secp256k1.PubKey',
    value: PubKey.encode(PubKey.fromPartial({key: account.pubkey})).finish(),
  });
  const bodyBytes = TxBody.encode(
    TxBody.fromPartial({messages: [], memo: JSON.stringify(payload)}),
  ).finish();
  const authInfoBytes = makeAuthInfoBytes([{pubkey: pubkeyAny, sequence: 0}], [], 0, undefined, undefined);
  const signDoc = {
    bodyBytes,
    authInfoBytes,
    chainId: cfg.chainId,
    accountNumber: BigInt(0),
  } as unknown as SignDoc;

  const {signature} = await wallet.signDirect(account.address, signDoc);
  return {
    signature: signature.signature,
    signed: payload,
  };
}

/** D4 发送一笔 Token（示例：领取/转账） */
export async function sendTokens(
  toAddress: string,
  amount: string,
  denom: string,
  env: ChainEnv,
): Promise<string> {
  const cfg = envConfig(env);
  if (WALLET_MOCK) {
    await new Promise((r) => setTimeout(r, 800));
    return '0xMOCK_TX_' + Date.now().toString(16);
  }
  const wallet = await loadSigningWallet();
  const client = await SigningStargateClient.connectWithSigner(cfg.rpc, wallet);
  const [sender] = await wallet.getAccounts();
  const res = await client.sendTokens(
    sender.address,
    toAddress,
    [coin(amount, denom)],
    'auto',
  );
  return res.transactionHash;
}

/** 64 位 hex（32 字节）私钥 -> Uint8Array，可带 0x 前缀 */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/i, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

/**
 * 由 rewardTreasuryKey 派生发奖账户签名钱包：
 *   - 64 位 hex 私钥 -> DirectSecp256k1Wallet.fromKey
 *   - 否则按 12/24 词助记词 -> DirectSecp256k1HdWallet.fromMnemonic
 */
async function deriveTreasury(): Promise<DirectSecp256k1HdWallet | DirectSecp256k1Wallet> {
  const secret = APP_CONFIG.rewardTreasuryKey.trim();
  if (/^(0x)?[0-9a-fA-F]{64}$/.test(secret)) {
    return DirectSecp256k1Wallet.fromKey(hexToBytes(secret), ADDRESS_PREFIX);
  }
  return DirectSecp256k1HdWallet.fromMnemonic(secret, {
    prefix: ADDRESS_PREFIX,
    hdPaths: [stringToPath(EVM_HD_PATH)],
  });
}

/**
 * 乘车奖励发放：从「发奖账户(treasury)」向用户地址转账 RIDE。
 * treasury 密钥来自 APP_CONFIG.rewardTreasuryKey（支持私钥或助记词，演示用，需已充值 RIDE）。
 * 受 WALLET_MOCK 控制：mock 时返回假哈希；false 时走真实 SigningStargateClient 转账。
 */
export async function sendRewardTokens(
  toAddress: string,
  amount: string,
  denom: string,
  env: ChainEnv,
): Promise<string> {
  const cfg = envConfig(env);
  if (WALLET_MOCK) {
    await new Promise((r) => setTimeout(r, 800));
    return '0xMOCK_TX_' + Date.now().toString(16);
  }
  if (!APP_CONFIG.rewardTreasuryKey) {
    throw new WalletError(t('svc.wallet.rewardNoTreasury'));
  }
  const treasury = await deriveTreasury();
  const client = await SigningStargateClient.connectWithSigner(cfg.rpc, treasury);
  const [sender] = await treasury.getAccounts();
  const res = await client.sendTokens(sender.address, toAddress, [coin(amount, denom)], 'auto');
  return res.transactionHash;
}
