/**
 * Google Routes API 公交路线规划服务
 * https://developers.google.com/maps/documentation/routes/transit-route
 *
 * 使用 computeRoutes + travelMode=TRANSIT + computeAlternativeRoutes
 * 获取多条候选路线，并映射为应用内的 RouteOption/RoutePlan 结构。
 */
import {GOOGLE_MAPS_CONFIG} from '../config/app';
import type {GeoPoint, RouteLeg, RouteOption, RoutePlan, RouteTag, Station} from '../types';

// ===== Google 响应类型（仅声明用到的字段） =====

interface GLatLng {
  latitude: number;
  longitude: number;
}

interface GTransitStop {
  name?: string;
  location?: {latLng?: GLatLng};
}

interface GTransitDetails {
  stopDetails?: {
    arrivalStop?: GTransitStop;
    departureStop?: GTransitStop;
  };
  transitLine?: {
    name?: string;
    nameShort?: string;
    color?: string;
    vehicle?: {type?: string};
  };
  stopCount?: number;
}

interface GStep {
  travelMode?: string;
  distanceMeters?: number;
  staticDuration?: string;
  polyline?: {encodedPolyline?: string};
  transitDetails?: GTransitDetails;
}

interface GRoute {
  duration?: string;
  distanceMeters?: number;
  legs?: {steps?: GStep[]}[];
}

interface GResponse {
  routes?: GRoute[];
  error?: {message?: string; status?: string};
}

/** Google 路线查询错误（含可展示信息） */
export class GoogleRoutingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleRoutingError';
  }
}

/** 解码 Google encoded polyline 为坐标数组 */
export function decodePolyline(encoded: string): GeoPoint[] {
  const points: GeoPoint[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({latitude: lat / 1e5, longitude: lng / 1e5});
  }
  return points;
}

/** "1234s" -> 分钟数（向上取整） */
function durationToMinutes(d?: string): number {
  if (!d) return 0;
  const secs = parseInt(d.replace(/s$/i, ''), 10);
  return Number.isFinite(secs) ? Math.ceil(secs / 60) : 0;
}

const DEFAULT_LINE_COLOR = '#6b7280';

/** 将 Google 单条 route 映射为 RoutePlan（仅统计轨道交通段） */
function toPlan(route: GRoute, fromStationId: string, toStationId: string): RoutePlan | null {
  const steps = (route.legs ?? []).flatMap((l) => l.steps ?? []);
  const legs: RouteLeg[] = [];
  for (const step of steps) {
    if (step.travelMode !== 'TRANSIT' || !step.transitDetails) continue;
    const td = step.transitDetails;
    const dep = td.stopDetails?.departureStop;
    const arr = td.stopDetails?.arrivalStop;
    const line = td.transitLine;
    const path = step.polyline?.encodedPolyline
      ? decodePolyline(step.polyline.encodedPolyline)
      : undefined;
    legs.push({
      lineId: line?.nameShort ?? line?.name ?? 'transit',
      lineName: line?.nameShort ?? line?.name ?? '',
      lineColor: line?.color ?? DEFAULT_LINE_COLOR,
      stationIds: [],
      stationNames: [dep?.name ?? '', arr?.name ?? ''].filter(Boolean),
      stopCount: td.stopCount ?? 0,
      distance: step.distanceMeters ?? 0,
      path,
    });
  }
  if (legs.length === 0) return null;
  return {
    fromStationId,
    toStationId,
    legs,
    transferCount: legs.length - 1,
    totalStops: legs.reduce((s, l) => s + l.stopCount, 0) + 1,
    totalDistance: legs.reduce((s, l) => s + l.distance, 0),
    estimatedMinutes: durationToMinutes(route.duration),
  };
}

/** 给多条路线打标签：第 0 条为推荐，其余仅在严格优于推荐时标 fast/short/fewTransfers */
function labelRoutes(plans: RoutePlan[]): RouteOption[] {
  const n = plans.length;
  const tagOf: RouteTag[] = plans.map((_, i) => (i === 0 ? 'recommended' : 'alt'));
  const markBest = (metric: (p: RoutePlan) => number, tag: RouteTag) => {
    let bi = -1;
    for (let i = 1; i < n; i++) {
      if (tagOf[i] !== 'alt') continue;
      if (bi === -1 || metric(plans[i]) < metric(plans[bi])) bi = i;
    }
    if (bi > 0 && metric(plans[bi]) < metric(plans[0])) tagOf[bi] = tag;
  };
  markBest((p) => p.estimatedMinutes, 'fast');
  markBest((p) => p.totalDistance, 'short');
  markBest((p) => p.transferCount, 'fewTransfers');
  return plans.map((plan, i) => ({plan, tag: tagOf[i]}));
}

/**
 * 通过 Google Routes API 规划公交路线（多条候选）。
 * origin/destination 使用站点坐标；语言影响返回的站名/线路名。
 */
export async function planRoutesGoogle(
  fromStation: Station,
  toStation: Station,
  lang: 'zh' | 'en',
): Promise<RouteOption[]> {
  const {apiKey, routesEndpoint, timeoutMs} = GOOGLE_MAPS_CONFIG;
  if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY') {
    throw new GoogleRoutingError('Missing Google Maps API key');
  }

  const body = {
    origin: {location: {latLng: fromStation.location}},
    destination: {location: {latLng: toStation.location}},
    travelMode: 'TRANSIT',
    computeAlternativeRoutes: true,
    transitPreferences: {
      allowedTravelModes: ['SUBWAY', 'TRAIN', 'LIGHT_RAIL'],
      routingPreference: 'FEWER_TRANSFERS',
    },
    languageCode: lang === 'zh' ? 'zh-CN' : 'en',
  };

  const fieldMask = [
    'routes.duration',
    'routes.distanceMeters',
    'routes.legs.steps.travelMode',
    'routes.legs.steps.distanceMeters',
    'routes.legs.steps.polyline.encodedPolyline',
    'routes.legs.steps.transitDetails',
  ].join(',');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let resp: Response;
  try {
    resp = await fetch(routesEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    throw new GoogleRoutingError(e instanceof Error ? e.message : 'Network error');
  } finally {
    clearTimeout(timer);
  }

  const data = (await resp.json().catch(() => ({}))) as GResponse;
  if (!resp.ok) {
    throw new GoogleRoutingError(data.error?.message ?? `HTTP ${resp.status}`);
  }

  const plans = (data.routes ?? [])
    .map((r) => toPlan(r, fromStation.id, toStation.id))
    .filter((p): p is RoutePlan => p != null);
  return labelRoutes(plans);
}
