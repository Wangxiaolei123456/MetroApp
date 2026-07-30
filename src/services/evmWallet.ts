import {
  Bip39,
  EnglishMnemonic,
  Secp256k1,
  Slip10,
  Slip10Curve,
  stringToPath,
} from '@cosmjs/crypto';
import {toBech32, toHex} from '@cosmjs/encoding';
import {keccak_256} from '@noble/hashes/sha3';
import {JsonRpcProvider, Wallet, parseUnits, type Signer} from 'ethers';
import {ChainEnv} from '@/types';
import {APP_CONFIG, UPTICK_CONFIG} from '@/config/app';

/** Uptick / Ethermint 使用 ETH coin type */
export const EVM_HD_PATH = "m/44'/60'/0'/0/0";
const ADDRESS_PREFIX = 'uptick';

export type EvmAccount = {
  /** 0x 校验格式小写地址 */
  evmAddress: string;
  /** bech32：把 20 字节 EVM 地址编码为 uptick…（与 UptickApp 一致） */
  cosmosAddress: string;
};

/**
 * 从助记词按 ETH 路径推导 EVM / Cosmos 双地址（对齐 UptickApp getHDWallet）
 */
export async function deriveEvmAccount(mnemonic: string): Promise<EvmAccount> {
  const seed = await Bip39.mnemonicToSeed(new EnglishMnemonic(mnemonic.trim()));
  const {privkey} = Slip10.derivePath(Slip10Curve.Secp256k1, seed, stringToPath(EVM_HD_PATH));
  const {pubkey} = await Secp256k1.makeKeypair(privkey);
  const uncompressed = pubkey.length === 65 ? pubkey : Secp256k1.uncompressPubkey(pubkey);
  const hash = keccak_256(uncompressed.slice(1));
  const ethBytes = hash.slice(-20);
  const evmAddress = ('0x' + toHex(ethBytes)).toLowerCase();
  const cosmosAddress = toBech32(ADDRESS_PREFIX, ethBytes);
  return {evmAddress, cosmosAddress};
}

/** eth_getBalance → 人类可读余额字符串 */
export async function queryEvmNativeBalance(
  evmAddress: string,
  env: ChainEnv,
): Promise<{amount: string; symbol: string; decimals: number}> {
  const cfg = UPTICK_CONFIG[env];
  const symbol = cfg.evmSymbol;
  const decimals = cfg.evmDecimals;
  try {
    const res = await fetch(cfg.evmRpc, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [evmAddress, 'latest'],
      }),
    });
    const data = await res.json();
    if (data.error || data.result == null) {
      return {amount: '0', symbol, decimals};
    }
    const wei = BigInt(data.result as string);
    return {amount: formatUnitsAmount(wei, decimals), symbol, decimals};
  } catch {
    return {amount: '0', symbol, decimals};
  }
}

function createTreasuryWallet(secret: string): Wallet {
  const s = secret.trim();
  if (s.includes(' ')) {
    // fromPhrase 返回 HDNodeWallet，用私钥再包一层统一为 Wallet
    return new Wallet(Wallet.fromPhrase(s).privateKey);
  }
  return new Wallet(s.startsWith('0x') ? s : `0x${s}`);
}

/**
 * 从发奖账户向用户 EVM 地址转原生 UPTICK（直达钱包，不记账本）
 */
export async function sendEvmNativeReward(
  toEvmAddress: string,
  amountHuman: number,
  env: ChainEnv,
): Promise<string> {
  const secret = APP_CONFIG.rewardTreasuryKey.trim();
  if (!secret) {
    throw new Error('rewardTreasuryKey empty');
  }
  if (!toEvmAddress) {
    throw new Error('missing evm address');
  }
  const cfg = UPTICK_CONFIG[env];
  const provider = new JsonRpcProvider(cfg.evmRpc, cfg.evmChainId);
  const signer: Signer = createTreasuryWallet(secret).connect(provider);
  const value = parseUnits(
    amountHuman.toFixed(cfg.evmDecimals > 8 ? 8 : cfg.evmDecimals),
    cfg.evmDecimals,
  );
  const tx = await signer.sendTransaction({
    to: toEvmAddress,
    value,
  });
  await tx.wait(1);
  return tx.hash;
}

function formatUnitsAmount(value: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = value % base;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '').slice(0, 6);
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}
