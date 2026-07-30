import {PointsTransaction, PointsSource, TripSummary, UserLevel} from '@/types';
import {APP_CONFIG} from '@/config/app';
import {levelOf, USER_LEVELS} from '@/data/mockData';

/** C1/C6 依据行程计算积分明细 */
export function computeTripPoints(summary: TripSummary): {
  base: number;
  transferBonus: number;
  longBonus: number;
  total: number;
  transferCount: number;
} {
  const {pointsPerStop, transferBonus, longDistanceThreshold, longDistancePerStopBonus} =
    APP_CONFIG;
  const base = summary.stationCount * pointsPerStop;
  const transferCount = Math.max(0, summary.lineIds.length - 1);
  const tBonus = transferCount * transferBonus;
  const longBonus =
    summary.stationCount >= longDistanceThreshold
      ? (summary.stationCount - longDistanceThreshold + 1) * longDistancePerStopBonus
      : 0;
  return {
    base,
    transferBonus: tBonus,
    longBonus,
    total: base + tBonus + longBonus,
    transferCount,
  };
}

let txCounter = 0;
function txId(): string {
  return `ptx_${Date.now()}_${txCounter++}`;
}

/**
 * 生成行程对应的积分流水。
 * C5：可设活动周期内锁定，lockRatio 比例的积分延迟至 unlockAt 释放（公平空投）。
 */
export function buildTripTransactions(
  userId: string,
  tripId: string,
  summary: TripSummary,
  opts?: {lockRatio?: number; unlockAt?: number},
): PointsTransaction[] {
  const calc = computeTripPoints(summary);
  const now = Date.now();
  const lockRatio = opts?.lockRatio ?? 0;
  const unlockAt = opts?.unlockAt;
  const txs: PointsTransaction[] = [];

  const add = (amount: number, source: PointsSource, note: string) => {
    if (amount <= 0) return;
    const locked = lockRatio > 0 && unlockAt ? amount * lockRatio : 0;
    txs.push({
      id: txId(),
      userId,
      amount,
      source,
      refId: tripId,
      createdAt: now,
      locked: locked > 0,
      unlockAt: locked > 0 ? unlockAt : undefined,
      note,
    });
  };

  add(calc.base, 'ride', `乘车 ${summary.stationCount} 站基础积分`);
  if (calc.transferBonus > 0) add(calc.transferBonus, 'transfer', `换乘 ${calc.transferCount} 次加成`);
  if (calc.longBonus > 0) add(calc.longBonus, 'long_distance', '长途乘车加成');
  return txs;
}

/** 累计积分统计 */
export function aggregateStats(txs: PointsTransaction[]): {
  balance: number;
  lockedBalance: number;
  totalEarned: number;
  totalSpent: number;
} {
  let balance = 0;
  let lockedBalance = 0;
  let totalEarned = 0;
  let totalSpent = 0;
  const now = Date.now();
  for (const t of txs) {
    // 锁定的且未到释放时间的积分不计入可用余额
    const isLockedActive = t.locked && t.unlockAt && t.unlockAt > now;
    if (t.amount > 0) {
      totalEarned += t.amount;
      if (isLockedActive) {
        lockedBalance += t.amount;
      } else {
        balance += t.amount;
      }
    } else {
      totalSpent += -t.amount;
      balance += t.amount;
    }
  }
  return {balance, lockedBalance, totalEarned, totalSpent};
}

export function currentLevel(totalStops: number): UserLevel {
  return levelOf(totalStops);
}

export function nextLevel(totalStops: number): UserLevel | null {
  const idx = USER_LEVELS.findIndex((l) => l.level === levelOf(totalStops).level);
  return USER_LEVELS[idx + 1] ?? null;
}
