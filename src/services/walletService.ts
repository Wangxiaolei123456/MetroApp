import {DirectSecp256k1HdWallet, makeAuthInfoBytes} from '@cosmjs/proto-signing';
import {SigningStargateClient, coin} from '@cosmjs/stargate';
import {SignDoc, TxBody} from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import {PubKey} from 'cosmjs-types/cosmos/crypto/secp256k1/keys';
import {Any} from 'cosmjs-types/google/protobuf/any';
import {bip39Generate, bip39Validate} from './bip39Wrapper';
import {ChainEnv, NftAsset, TokenBalance, WalletAccount, ChainTx} from '@/types';
import {UPTICK_CONFIG, APP_CONFIG} from '@/config/app';
import {secureStore, storage, STORAGE_KEYS} from './storage';
import {t} from '@/i18n';

// 沙箱/无网环境下默认走 Mock，避免 RPC 调用失败。
// 接入真实链时将其置为 false 并填入有效 RPC。
const WALLET_MOCK = true;
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

/** 由助记词推导钱包（Uptick 地址前缀） */
async function deriveWallet(mnemonic: string): Promise<DirectSecp256k1HdWallet> {
  return DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {prefix: ADDRESS_PREFIX});
}

/** D1 创建钱包：生成 + 本地加密存储助记词 */
export async function createWallet(
  env: ChainEnv = APP_CONFIG.chainEnv,
): Promise<WalletAccount> {
  const mnemonic = generateMnemonic();
  const wallet = await deriveWallet(mnemonic);
  const [account] = await wallet.getAccounts();
  await secureStore.saveSecret(STORAGE_KEYS.walletSecret, mnemonic);
  const meta: WalletAccount = {
    address: account.address,
    env,
    createdAt: Date.now(),
  };
  await storage.set(STORAGE_KEYS.walletMeta, meta);
  return meta;
}

/** D1 导入钱包：校验助记词后保存 */
export async function importWallet(
  mnemonic: string,
  env: ChainEnv = APP_CONFIG.chainEnv,
): Promise<WalletAccount> {
  if (!validateMnemonic(mnemonic)) throw new WalletError(t('svc.wallet.invalidMnemonic'));
  const wallet = await deriveWallet(mnemonic.trim());
  const [account] = await wallet.getAccounts();
  await secureStore.saveSecret(STORAGE_KEYS.walletSecret, mnemonic.trim());
  const meta: WalletAccount = {
    address: account.address,
    env,
    createdAt: Date.now(),
  };
  await storage.set(STORAGE_KEYS.walletMeta, meta);
  return meta;
}

/** 读取已保存的钱包元数据（不含私钥明文） */
export async function loadWalletMeta(): Promise<WalletAccount | null> {
  return storage.get<WalletAccount>(STORAGE_KEYS.walletMeta);
}

/** 加载完整钱包（用于签名，私钥仅存在于内存） */
export async function loadSigningWallet(): Promise<DirectSecp256k1HdWallet> {
  const mnemonic = await secureStore.getSecret(STORAGE_KEYS.walletSecret);
  if (!mnemonic) throw new WalletError(t('svc.wallet.notFound'));
  return deriveWallet(mnemonic);
}

/** D3 资产查询（Token / NFT / 交易） */
export async function queryBalances(
  address: string,
  env: ChainEnv,
): Promise<TokenBalance[]> {
  const cfg = envConfig(env);
  if (WALLET_MOCK) {
    return [
      {denom: cfg.denom, amount: '1250.00', symbol: cfg.coinSymbol},
      {denom: 'uair', amount: '320.00', symbol: 'AIR'},
    ];
  }
  try {
    const res = await fetch(`${cfg.rest}/cosmos/bank/v1beta1/balances/${address}`);
    const data = await res.json();
    return (data.balances ?? []).map((b: {denom: string; amount: string}) => ({
      denom: b.denom,
      amount: (Number(b.amount) / 1e6).toFixed(2),
      symbol: b.denom.replace(/^u/, '').toUpperCase(),
    }));
  } catch {
    return [{denom: cfg.denom, amount: '0.00', symbol: cfg.coinSymbol}];
  }
}

export async function queryNfts(
  _address: string,
  _env: ChainEnv,
): Promise<NftAsset[]> {
  if (WALLET_MOCK) {
    return [
      {id: 'n1', name: 'Metro Pioneer', collection: 'MetroChain OG', tokenId: '1'},
      {id: 'n2', name: 'Ride Master', collection: 'MetroChain OG', tokenId: '7'},
    ];
  }
  return [];
}

export async function queryTxs(_address: string, _env: ChainEnv): Promise<ChainTx[]> {
  if (WALLET_MOCK) {
    return [
      {hash: '0xabc...', type: 'airdrop_claim', amount: '50', denom: 'AIR', time: Date.now() - 86400000, status: 'success'},
    ];
  }
  return [];
}

/**
 * D4 链上签名授权：构造最小 SignDoc 并签名，返回签名结果。
 * 用于乘车结算/领空投时引导用户完成链上签名。真实环境同理，
 * 可将 payload 作为交易 memo 或 ADR-36 消息进行签名授权。
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
    signature: signature.signature, // 本版本 StdSignature.signature 为 base64 字符串
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
