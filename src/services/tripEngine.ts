import {
  GeoPoint,
  MetroGraph,
  Trip,
  TripStationPass,
  TripSummary,
} from '@/types';
import {APP_CONFIG} from '@/config/app';
import {getCityGraph} from '@/data/metroData';
import {estimateSpeed} from '@/utils/geo';
import {findEnclosingStation} from './geofence';
import {t} from '@/i18n';

let tripCounter = 0;

export function createTrip(userId: string, cityId: string): Trip {
  return {
    id: `trip_${Date.now()}_${tripCounter++}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    cityId,
    status: 'active',
    startedAt: Date.now(),
    passedStations: [],
    trackPoints: [],
  };
}

/** 当前所在站（最后进入且未离开的站） */
function currentStationOf(trip: Trip): TripStationPass | null {
  for (let i = trip.passedStations.length - 1; i >= 0; i--) {
    if (!trip.passedStations[i].leftAt) return trip.passedStations[i];
  }
  return null;
}

/**
 * 记录一次 GPS 采样。B1/B2：进站识别 + 逐站计数。
 * 返回更新后的 trip 以及事件（供 UI 提示/提醒）。
 */
export function recordGps(
  trip: Trip,
  location: GeoPoint,
  graph?: MetroGraph,
): {trip: Trip; entered?: string; left?: string} {
  const g = graph ?? getCityGraph(trip.cityId);
  const now = Date.now();
  const prev = trip.trackPoints[trip.trackPoints.length - 1];
  const dtMs = prev ? now - prev.at : 0;
  // 仅连续采样计入瞬时速度；断点恢复后的大位移不算超速
  const continuityMs = APP_CONFIG.antiCheat.speedSampleMaxDtMs;
  const speed =
    prev && dtMs > 0 && dtMs <= continuityMs
      ? estimateSpeed(
          {at: prev.at, location: prev.location},
          {at: now, location},
        )
      : 0;

  const next: Trip = {
    ...trip,
    trackPoints: [...trip.trackPoints, {at: now, location, speed}],
    passedStations: [...trip.passedStations],
  };

  const enclosing = findEnclosingStation(g, location);
  let entered: string | undefined;
  let left: string | undefined;

  if (enclosing) {
    const cur = currentStationOf(trip);
    if (cur?.stationId !== enclosing.id) {
      // 若上一个站还没离开，先标记离开
      if (cur) {
        next.passedStations = next.passedStations.map((p) =>
          p.stationId === cur.stationId ? {...p, leftAt: now} : p,
        );
        left = cur.stationId;
      }
      next.passedStations.push({
        stationId: enclosing.id,
        enteredAt: now,
        valid: true,
      });
      entered = enclosing.id;
      if (!next.startStationId) next.startStationId = enclosing.id;
    }
  } else {
    const cur = currentStationOf(trip);
    if (cur) {
      next.passedStations = next.passedStations.map((p) =>
        p.stationId === cur.stationId ? {...p, leftAt: now} : p,
      );
      left = cur.stationId;
    }
  }
  return {trip: next, entered, left};
}

/** B3 出站结算：生成行程报告 */
export function computeSummary(trip: Trip): TripSummary {
  const g = getCityGraph(trip.cityId);
  const stationMap = new Map(g.stations.map((s) => [s.id, s]));
  const lineSet = new Set<string>();
  let distance = 0;
  const valid = trip.passedStations.filter((p) => p.valid);

  for (let i = 0; i < valid.length - 1; i++) {
    const a = stationMap.get(valid[i].stationId);
    const b = stationMap.get(valid[i + 1].stationId);
    if (a && b) {
      for (const lid of a.lineIds) {
        if (b.lineIds.includes(lid)) {
          lineSet.add(lid);
          const line = g.lines.find((l) => l.id === lid)!;
          const ia = line.stationIds.indexOf(a.id);
          const ib = line.stationIds.indexOf(b.id);
          if (ia >= 0 && ib >= 0) {
            const [lo, hi] = ia < ib ? [ia, ib] : [ib, ia];
            for (let k = lo; k < hi; k++) distance += line.segmentDistances[k] ?? 0;
          }
          break;
        }
      }
    }
  }
  return {
    stationCount: Math.max(0, valid.length - 1),
    distance,
    durationMs: (trip.endedAt ?? Date.now()) - trip.startedAt,
    lineIds: [...lineSet],
  };
}

/**
 * B4 防作弊校验（地铁场景）：
 * - 以站间时间为主（真实瞬移）
 * - 瞬时超速仅统计「连续采样」噪点，且允许一定数量
 * - 地下丢星导致的轨迹断点默认不单独判异常
 */
export function validateTrip(trip: Trip): string[] {
  if (!APP_CONFIG.antiCheat.enabled) return [];

  const reasons: string[] = [];
  const {
    maxPlausibleSpeed,
    minStationIntervalMs,
    maxTrackGapMs,
    maxSpeedOutliers,
    speedSampleMaxDtMs,
  } = APP_CONFIG.antiCheat;

  // 1) 速度异常：只看连续采样中的超速噪点，超过容忍个数才判异常
  let speedHits = 0;
  for (let i = 1; i < trip.trackPoints.length; i++) {
    const prev = trip.trackPoints[i - 1];
    const cur = trip.trackPoints[i];
    const dt = cur.at - prev.at;
    if (dt <= 0 || dt > speedSampleMaxDtMs) continue;
    const speed =
      cur.speed > 0
        ? cur.speed
        : estimateSpeed(
            {at: prev.at, location: prev.location},
            {at: cur.at, location: cur.location},
          );
    if (speed > maxPlausibleSpeed) speedHits += 1;
  }
  if (speedHits > maxSpeedOutliers) {
    reasons.push(t('svc.trip.speedAnomaly', {n: speedHits}));
  }

  // 2) 站间时间过短（瞬移）——主判定
  const valid = trip.passedStations.filter((p) => p.valid);
  for (let i = 1; i < valid.length; i++) {
    const dt = valid[i].enteredAt - valid[i - 1].enteredAt;
    if (dt < minStationIntervalMs && valid.length > 2) {
      reasons.push(t('svc.trip.shortInterval', {a: valid[i - 1].stationId, b: valid[i].stationId}));
      break;
    }
  }

  // 3) 轨迹断点：maxTrackGapMs=0 时跳过（地铁地下丢星属常态）
  if (maxTrackGapMs > 0) {
    for (let i = 1; i < trip.trackPoints.length; i++) {
      const gap = trip.trackPoints[i].at - trip.trackPoints[i - 1].at;
      if (gap > maxTrackGapMs) {
        reasons.push(t('svc.trip.gpsGap'));
        break;
      }
    }
  }

  return reasons;
}

/** 结束行程：结算 + 校验 */
export function finalizeTrip(trip: Trip): Trip {
  const summary = computeSummary(trip);
  const reasons = validateTrip(trip);
  const endStation =
    trip.passedStations.filter((p) => p.valid).slice(-1)[0]?.stationId;
  return {
    ...trip,
    status: reasons.length > 0 ? 'abnormal' : 'completed',
    endedAt: Date.now(),
    endStationId: endStation,
    summary,
    abnormalReasons: reasons,
  };
}
