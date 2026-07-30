// 模拟坐地铁并发放 RIDE 奖励（演示 / 联调用）
//
// 依赖：Node 18+（需要全局 fetch），项目已安装 @cosmjs/proto-signing / @cosmjs/stargate。
// 说明：链上参数与 src/config/app.ts 的 UPTICK_CONFIG.testnet / APP_CONFIG 保持一致。
//
// 用法：
//   node scripts/simulateRide.mjs                 # 默认 10 站，自动生成演示用户地址
//   node scripts/simulateRide.mjs 15              # 指定 15 站
//   RIDE_RECIPIENT=uptick1xxxx node scripts/simulateRide.mjs 12        # 指定收款地址
//   REWARD_TREASURY_KEY=<私钥或助记词> node scripts/simulateRide.mjs 10  # 真实链上发币
//
// - 未设置 REWARD_TREASURY_KEY：仅模拟计算，不发链上交易（演示用）。
// - 设置 REWARD_TREASURY_KEY：从发奖账户向用户真实转账 RIDE，并查询前后余额。
//   格式可为「64 位 hex 私钥（可带 0x）」或「12/24 词助记词」，自动识别。

import {
  DirectSecp256k1HdWallet,
  DirectSecp256k1Wallet,
} from '@cosmjs/proto-signing';
import {SigningStargateClient, coin} from '@cosmjs/stargate';
import {stringToPath} from '@cosmjs/crypto';
import * as bip39 from 'bip39';

// ===== 链上配置（与 src/config/app.ts 保持一致） =====
const PREFIX = 'uptick';
const EVM_HD_PATH = "m/44'/60'/0'/0/0";
const DENOM = 'uride'; // RIDE 的 base denom
const EXP = 6; // uride = 10^-6 RIDE
const RPC = 'https://rpc.origin.uptick.network';
const REST = 'https://api.origin.uptick.network';
const RIDE_PER_STOP = 0.01; // 每站 0.01 RIDE

function hexToBytes(hex) {
  const clean = hex.replace(/^0x/i, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

async function deriveTreasury(secret) {
  const s = secret.trim();
  if (/^(0x)?[0-9a-fA-F]{64}$/.test(s)) {
    return DirectSecp256k1Wallet.fromKey(hexToBytes(s), PREFIX);
  }
  return DirectSecp256k1HdWallet.fromMnemonic(s, {
    prefix: PREFIX,
    hdPaths: [stringToPath(EVM_HD_PATH)],
  });
}

async function deriveUser(mnemonic) {
  const w = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: PREFIX,
    hdPaths: [stringToPath(EVM_HD_PATH)],
  });
  const [a] = await w.getAccounts();
  return a.address;
}

async function queryBalance(address) {
  try {
    const r = await fetch(`${REST}/cosmos/bank/v1beta1/balances/${address}`);
    const j = await r.json();
    const b = (j.balances || []).find((x) => x.denom === DENOM);
    return b ? Number(b.amount) : 0;
  } catch (e) {
    return 0;
  }
}

const fmt = (amt) => `${(amt / 10 ** EXP).toFixed(EXP)} RIDE`;

async function main() {
  const stops = parseInt(process.argv[2] || '10', 10);
  const treasurySecret = process.env.REWARD_TREASURY_KEY || '';
  const recipientArg = process.env.RIDE_RECIPIENT || '';

  // 收币用户
  let userAddress;
  if (recipientArg) {
    userAddress = recipientArg;
    console.log('收款地址(来自环境变量):', userAddress);
  } else {
    const m = bip39.generateMnemonic();
    userAddress = await deriveUser(m);
    console.log('自动生成演示用户助记词:', m);
    console.log('收款地址:', userAddress);
  }

  const earnedRide = stops * RIDE_PER_STOP;
  const amountBase = Math.round(earnedRide * 10 ** EXP); // 转成 base 单位整数

  console.log(`\n模拟乘车: ${stops} 站 -> 应得 ${earnedRide} RIDE (${amountBase} ${DENOM})`);
  const before = await queryBalance(userAddress);
  console.log('转账前余额:', fmt(before));

  if (!treasurySecret) {
    console.log('\n[模拟模式] 未设置 REWARD_TREASURY_KEY，仅计算、不发链上交易。');
    console.log(`若真实发放，用户将收到 ${earnedRide} RIDE，余额变为 ${fmt(before + amountBase)}`);
    return;
  }

  const treasury = await deriveTreasury(treasurySecret);
  const [sender] = await treasury.getAccounts();
  console.log('发奖账户:', sender.address);

  const client = await SigningStargateClient.connectWithSigner(RPC, treasury);
  const res = await client.sendTokens(
    sender.address,
    userAddress,
    [coin(String(amountBase), DENOM)],
    'auto',
  );
  console.log('链上交易哈希:', res.transactionHash);

  const after = await queryBalance(userAddress);
  console.log('转账后余额:', fmt(after));
  console.log(`✅ 本次乘车收到余额: ${fmt(after - before)} RIDE`);
}

main().catch((e) => {
  console.error('模拟失败:', e);
  process.exit(1);
});
