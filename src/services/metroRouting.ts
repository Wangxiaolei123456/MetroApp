import {MetroGraph, RouteLeg, RouteOption, RoutePlan, RouteTag, Station} from '@/types';
import {haversine} from '@/utils/geo';

// 权重参数（用于平衡距离、停站与换乘）
const STOP_DWELL = 40; // 每站停靠等效米
const TRANSFER_PENALTY = 320; // 换乘步行等效米
const METRO_SPEED_MPM = 550; // 地铁平均速度 米/分钟
const TRANSFER_WALK_MIN = 4; // 换乘步行分钟
const STOP_MIN = 0.6; // 每站等效分钟

/** 规划模式：决定如何为边赋权（单位统一为「米等效代价」） */
type CostMode = 'balanced' | 'time' | 'distance' | 'transfers';

/** 相邻站点的边代价 */
function segmentCost(mode: CostMode, distance: number): number {
  switch (mode) {
    case 'distance':
      return distance + STOP_DWELL; // 纯距离视角
    case 'time':
      return distance / METRO_SPEED_MPM + STOP_MIN; // 时间视角（分钟）
    case 'transfers':
      return distance / METRO_SPEED_MPM + STOP_MIN;
    case 'balanced':
    default:
      return distance + STOP_DWELL; // 原综合代价（保持旧行为）
  }
}

/** 换乘边代价 */
function transferCost(mode: CostMode): number {
  switch (mode) {
    case 'distance':
      return TRANSFER_PENALTY;
    case 'time':
      return TRANSFER_WALK_MIN;
    case 'transfers':
      return TRANSFER_WALK_MIN + 25; // 强烈避免换乘
    case 'balanced':
    default:
      return TRANSFER_PENALTY;
  }
}

interface State {
  stationId: string;
  lineId: string;
}

function stateKey(s: State): string {
  return `${s.stationId}::${s.lineId}`;
}

/** 构建相邻站点 + 换乘连接（按模式赋权） */
function buildAdjacency(graph: MetroGraph, mode: CostMode) {
  const adj = new Map<string, {to: State; cost: number}[]>();
  const stationMap = new Map(graph.stations.map((s) => [s.id, s]));
  const addEdge = (from: State, to: State, cost: number) => {
    const k = stateKey(from);
    if (!adj.has(k)) adj.set(k, []);
    adj.get(k)!.push({to, cost});
  };

  for (const line of graph.lines) {
    for (let i = 0; i < line.stationIds.length; i++) {
      const cur = line.stationIds[i];
      const lineId = line.id;
      // 同线相邻移动
      if (i > 0) {
        const prev = line.stationIds[i - 1];
        const d = line.segmentDistances[i - 1] ?? haversine(
          stationMap.get(cur)!.location,
          stationMap.get(prev)!.location,
        );
        const c = segmentCost(mode, d);
        addEdge({stationId: cur, lineId}, {stationId: prev, lineId}, c);
        addEdge({stationId: prev, lineId}, {stationId: cur, lineId}, c);
      }
      // 换乘：同站切换线路
      const st = stationMap.get(cur)!;
      if (st.lineIds.length > 1) {
        for (const other of st.lineIds) {
          if (other !== lineId) {
            addEdge({stationId: cur, lineId}, {stationId: cur, lineId: other}, transferCost(mode));
          }
        }
      }
    }
  }
  return {adj, stationMap};
}

/** 按指定模式用 Dijkstra 求最优路线 */
function planRouteWithMode(
  graph: MetroGraph,
  fromStationId: string,
  toStationId: string,
  mode: CostMode,
): RoutePlan | null {
  if (fromStationId === toStationId) return null;
  const {adj, stationMap} = buildAdjacency(graph, mode);
  if (!stationMap.has(fromStationId) || !stationMap.has(toStationId)) return null;

  const dist = new Map<string, number>();
  const prev = new Map<string, {from: State; lineId: string}>();
  const visited = new Set<string>();

  const fromStation = stationMap.get(fromStationId)!;
  const startStates: State[] = fromStation.lineIds.map((l) => ({
    stationId: fromStationId,
    lineId: l,
  }));
  for (const s of startStates) dist.set(stateKey(s), 0);

  // 简单优先队列（图小，线性取最小即可）
  const pq: {state: State; cost: number}[] = startStates.map((s) => ({state: s, cost: 0}));

  while (pq.length) {
    let bi = 0;
    for (let i = 1; i < pq.length; i++) if (pq[i].cost < pq[bi].cost) bi = i;
    const {state, cost} = pq.splice(bi, 1)[0];
    const k = stateKey(state);
    if (visited.has(k)) continue;
    visited.add(k);
    if (state.stationId === toStationId) break;

    for (const edge of adj.get(k) ?? []) {
      const nk = stateKey(edge.to);
      if (visited.has(nk)) continue;
      const nd = cost + edge.cost;
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        prev.set(nk, {from: state, lineId: edge.to.lineId});
        pq.push({state: edge.to, cost: nd});
      }
    }
  }

  // 取终点最小代价状态
  let best: string | null = null;
  let bestCost = Infinity;
  for (const l of stationMap.get(toStationId)!.lineIds) {
    const k = stateKey({stationId: toStationId, lineId: l});
    const c = dist.get(k) ?? Infinity;
    if (c < bestCost) {
      bestCost = c;
      best = k;
    }
  }
  if (!best || bestCost === Infinity) return null;

  // 回溯路径
  const path: State[] = [];
  let cur: string | undefined = best;
  while (cur) {
    const [stationId, lineId] = cur.split('::');
    path.unshift({stationId, lineId});
    const p = prev.get(cur);
    cur = p ? stateKey(p.from) : undefined;
  }

  return buildPlan(graph, path);
}

/** 通用 Dijkstra：返回 fromId→toId 的状态路径，可屏蔽边与站点（供 Yen 生成备选）
 *  startStates 可显式指定起始状态（如 Yen 的 spur 节点必须延续当前线路），
 *  否则默认从该站所有线路以 0 代价出发。 */
function dijkstraPath(
  adj: Map<string, {to: State; cost: number}[]>,
  stationMap: Map<string, Station>,
  fromStationId: string,
  toStationId: string,
  blockedEdges: Set<string>,
  blockedStations: Set<string>,
  startStates?: State[],
): State[] | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, {from: State; lineId: string}>();
  const visited = new Set<string>();
  const fromStation = stationMap.get(fromStationId)!;
  const starts: State[] =
    startStates ?? fromStation.lineIds.map((l) => ({stationId: fromStationId, lineId: l}));
  for (const s of starts) dist.set(stateKey(s), 0);
  const pq: {state: State; cost: number}[] = starts.map((s) => ({state: s, cost: 0}));

  while (pq.length) {
    let bi = 0;
    for (let i = 1; i < pq.length; i++) if (pq[i].cost < pq[bi].cost) bi = i;
    const {state, cost} = pq.splice(bi, 1)[0];
    const k = stateKey(state);
    if (visited.has(k)) continue;
    if (blockedStations.has(state.stationId)) continue;
    visited.add(k);
    if (state.stationId === toStationId) break;

    for (const edge of adj.get(k) ?? []) {
      const nk = stateKey(edge.to);
      if (visited.has(nk)) continue;
      if (blockedStations.has(edge.to.stationId)) continue;
      if (blockedEdges.has(k + '>' + nk)) continue;
      const nd = cost + edge.cost;
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        prev.set(nk, {from: state, lineId: edge.to.lineId});
        pq.push({state: edge.to, cost: nd});
      }
    }
  }

  let best: string | null = null;
  let bestCost = Infinity;
  for (const l of stationMap.get(toStationId)!.lineIds) {
    const k = stateKey({stationId: toStationId, lineId: l});
    const c = dist.get(k) ?? Infinity;
    if (c < bestCost) {
      bestCost = c;
      best = k;
    }
  }
  if (!best || bestCost === Infinity) return null;

  const path: State[] = [];
  let cur: string | undefined = best;
  while (cur) {
    const [stationId, lineId] = cur.split('::');
    path.unshift({stationId, lineId});
    const p = prev.get(cur);
    cur = p ? stateKey(p.from) : undefined;
  }
  return path;
}

/** 两状态间边的代价（不存在的边返回 Infinity，避免拼出非法路径） */
function edgeCostBetween(
  adj: Map<string, {to: State; cost: number}[]>,
  from: State,
  to: State,
): number {
  const arr = adj.get(stateKey(from)) ?? [];
  const e = arr.find((x) => stateKey(x.to) === stateKey(to));
  return e ? e.cost : Infinity;
}

/** 路径总代价（含非法边则为 Infinity） */
function pathCost(adj: Map<string, {to: State; cost: number}[]>, path: State[]): number {
  let c = 0;
  for (let i = 1; i < path.length; i++) c += edgeCostBetween(adj, path[i - 1], path[i]);
  return c;
}

/** 路径签名（按站点序列，去重用） */
function pathSig(path: State[]): string {
  return path.map((s) => s.stationId).join('>');
}

/** 判断 p 的前 prefix.length 个状态是否与 prefix 相同 */
function samePrefix(p: State[], prefix: State[]): boolean {
  if (p.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (stateKey(p[i]) !== stateKey(prefix[i])) return false;
  }
  return true;
}

/** Yen's K 短路（无环）算法，生成多条走向不同的候选路线 */
function yenKPaths(
  graph: MetroGraph,
  fromStationId: string,
  toStationId: string,
  K: number,
): State[][] {
  const {adj, stationMap} = buildAdjacency(graph, 'balanced');
  const A: State[][] = [];
  const first = dijkstraPath(adj, stationMap, fromStationId, toStationId, new Set(), new Set());
  if (!first) return A;
  A.push(first);
  const B: {path: State[]; cost: number}[] = [];

  for (let k = 1; k < K; k++) {
    const prevPath = A[k - 1];
    for (let i = 0; i < prevPath.length - 1; i++) {
      const spurState = prevPath[i];
      const rootPath = prevPath.slice(0, i + 1);
      const blockedEdges = new Set<string>();
      // 移除 A 中与 rootPath 前缀相同的路径在分叉处的出边
      for (const p of A) {
        if (samePrefix(p, rootPath)) {
          blockedEdges.add(stateKey(p[i]) + '>' + stateKey(p[i + 1]));
        }
      }
      // 阻塞 rootPath 中除分叉点外的站点，避免重复经过
      const blockedStations = new Set<string>();
      for (let j = 0; j < rootPath.length - 1; j++) {
        blockedStations.add(rootPath[j].stationId);
      }
      // 关键：spur 段必须从「当前站 + 当前线路」这一确切状态出发，
      // 否则会免费切换到该站其他线路，拼接出带幽灵换乘的非法路径
      const spurPath = dijkstraPath(
        adj, stationMap, spurState.stationId, toStationId,
        blockedEdges, blockedStations, [spurState],
      );
      if (!spurPath) continue;
      const total = [...rootPath, ...spurPath.slice(1)];
      const cost = pathCost(adj, total);
      if (!Number.isFinite(cost)) continue; // 含非法边，丢弃
      const sig = pathSig(total);
      const dup = A.some((p) => pathSig(p) === sig) || B.some((b) => pathSig(b.path) === sig);
      if (!dup) B.push({path: total, cost});
    }
    if (B.length === 0) break;
    B.sort((a, b) => a.cost - b.cost);
    A.push(B.shift()!.path);
  }
  return A;
}

/** 为候选路线打上优化维度标签（推荐/最快/最短/换乘最少/备选） */
function labelRoutes(plans: RoutePlan[]): RouteOption[] {
  const n = plans.length;
  const tagOf: RouteTag[] = new Array(n).fill('alt');
  tagOf[0] = 'recommended';
  // 仅当候选在该维度「全场最优且严格优于推荐路线」时才打标，避免误导
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

/** 原单路线入口（综合最优，兼容旧调用） */
export function planRoute(
  graph: MetroGraph,
  fromStationId: string,
  toStationId: string,
): RoutePlan | null {
  return planRouteWithMode(graph, fromStationId, toStationId, 'balanced');
}

/** 规划多条候选路线（Yen 算法生成不同走向，并按优化维度打标） */
export function planRoutes(
  graph: MetroGraph,
  fromStationId: string,
  toStationId: string,
): RouteOption[] {
  if (fromStationId === toStationId) return [];
  const paths = yenKPaths(graph, fromStationId, toStationId, 4);
  return labelRoutes(paths.map((p) => buildPlan(graph, p)));
}

function buildPlan(
  graph: MetroGraph,
  path: State[],
): RoutePlan {
  const lineMap = new Map(graph.lines.map((l) => [l.id, l]));
  const legs: RouteLeg[] = [];
  let i = 0;
  while (i < path.length) {
    const lineId = path[i].lineId;
    const line = lineMap.get(lineId)!;
    const legStations: string[] = [path[i].stationId];
    let j = i + 1;
    while (j < path.length && path[j].lineId === lineId) {
      legStations.push(path[j].stationId);
      j++;
    }
    let distance = 0;
    for (let k = 0; k < legStations.length - 1; k++) {
      // 兼容正向/反向乘坐：区间距离取两站中索引较小者对应的 segment
      const ia = line.stationIds.indexOf(legStations[k]);
      const ib = line.stationIds.indexOf(legStations[k + 1]);
      distance += line.segmentDistances[Math.min(ia, ib)] ?? 0;
    }
    legs.push({
      lineId,
      lineName: line.name,
      lineColor: line.color,
      stationIds: legStations,
      stopCount: Math.max(0, legStations.length - 1),
      distance,
    });
    i = j;
  }

  const transferCount = Math.max(0, legs.length - 1);
  const totalStops = legs.reduce((s, l) => s + l.stopCount, 0);
  const totalDistance = legs.reduce((s, l) => s + l.distance, 0);
  const estimatedMinutes = Math.round(
    totalDistance / METRO_SPEED_MPM + transferCount * TRANSFER_WALK_MIN + totalStops * STOP_MIN,
  );

  return {
    fromStationId: path[0].stationId,
    toStationId: path[path.length - 1].stationId,
    legs,
    transferCount,
    totalStops,
    totalDistance,
    estimatedMinutes,
  };
}
