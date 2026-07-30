import {AirdropRule} from '@/types';
import {signPayload} from './walletService';
import {SAMPLE_AIRDROPS} from '@/data/mockData';

/** F1 空投资格：积分门槛 / 站数 / 活跃天数 */
export function isEligible(
  rule: AirdropRule,
  ctx: {pointsBalance: number; totalStops: number; activeDays: number},
): boolean {
  if (rule.status !== 'active') return false;
  if (Date.now() < rule.startAt || Date.now() > rule.endAt) return false;
  if (ctx.pointsBalance < rule.minPoints) return false;
  if (ctx.totalStops < rule.minStops) return false;
  if (ctx.activeDays < rule.minActiveDays) return false;
  // 池子是否还有余量
  return rule.distributed + rule.perUserAmount <= rule.totalAmount;
}

export interface AirdropEligibility {
  rule: AirdropRule;
  eligible: boolean;
  reasons: string[];
}

export function checkAll(
  ctx: {pointsBalance: number; totalStops: number; activeDays: number},
): AirdropEligibility[] {
  return SAMPLE_AIRDROPS.map((rule) => {
    const reasons: string[] = [];
    if (rule.status !== 'active') reasons.push('活动未开启');
    if (ctx.pointsBalance < rule.minPoints) reasons.push(`积分不足（需 ${rule.minPoints}）`);
    if (ctx.totalStops < rule.minStops) reasons.push(`站数不足（需 ${rule.minStops}）`);
    if (ctx.activeDays < rule.minActiveDays) reasons.push(`活跃天数不足（需 ${rule.minActiveDays}）`);
    return {rule, eligible: isEligible(rule, ctx), reasons};
  });
}

/**
 * F2 领取空投：链上签名授权 + 模拟发放。
 * 真实环境：构造 mint/transfer 消息并由钱包签名广播。
 */
export async function claimAirdrop(
  rule: AirdropRule,
  walletAddress: string,
): Promise<{txHash: string; amount: number}> {
  const sig = await signPayload({
    action: 'airdrop_claim',
    ruleId: rule.id,
    address: walletAddress,
    amount: rule.perUserAmount,
    ts: Date.now(),
  });
  void sig;
  // 模拟广播
  await new Promise((r) => setTimeout(r, 600));
  return {txHash: '0xAIR_' + Date.now().toString(16), amount: rule.perUserAmount};
}
