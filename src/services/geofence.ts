import {GeoPoint, MetroGraph, Station} from '@/types';
import {distanceTo, isWithinRadius} from '@/utils/geo';

/** 返回当前位置所处围栏内的站点（若不在任何站内则返回 null） */
export function findEnclosingStation(
  graph: MetroGraph,
  location: GeoPoint,
): Station | null {
  for (const s of graph.stations) {
    const r = s.geofenceRadius ?? graph.city.defaultGeofenceRadius;
    if (isWithinRadius(location, s.location, r)) return s;
  }
  return null;
}

/** 最近站点及距离（用于"接近提醒"） */
export function findNearestStation(
  graph: MetroGraph,
  location: GeoPoint,
): {station: Station; distance: number} {
  let best = graph.stations[0];
  let bestD = Infinity;
  for (const s of graph.stations) {
    const d = distanceTo(location, s.location);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return {station: best, distance: bestD};
}

/**
 * 围栏状态机：根据连续 GPS 采样判定进入/离开站点围栏。
 * 用于 A4 实时定位、B1 进站识别、B2 站点计数、A5 到站提醒。
 */
export class GeofenceTracker {
  private current: Station | null = null;
  constructor(private graph: MetroGraph) {}

  /** 处理一次定位更新，返回状态变化事件 */
  update(location: GeoPoint): {
    entered?: Station;
    left?: Station;
    nearing?: Station; // 接近目标/换乘站
  } {
    const enclosing = findEnclosingStation(this.graph, location);
    let entered: Station | undefined;
    let left: Station | undefined;

    if (enclosing && enclosing.id !== this.current?.id) {
      entered = enclosing;
      this.current = enclosing;
    } else if (!enclosing && this.current) {
      left = this.current;
      this.current = null;
    }
    return {entered, left};
  }

  get currentStation(): Station | null {
    return this.current;
  }
}
