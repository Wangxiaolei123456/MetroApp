import {MetroGraph, RouteLeg, RoutePlan} from '@/types';
import {haversine} from '@/utils/geo';

// 权重参数（用于平衡距离、停站与换乘）
const STOP_DWELL = 40; // 每站停靠等效米
const TRANSFER_PENALTY = 320; // 换乘步行等效米
const METRO_SPEED_MPM = 550; // 地铁平均速度 米/分钟
const TRANSFER_WALK_MIN = 4; // 换乘步行分钟
const STOP_MIN = 0.6; // 每站等效分钟

interface State {
  stationId: string;
  lineId: string;
}

function stateKey(s: State): string {
  return `${s.stationId}::${s.lineId}`;
}

/** 构建相邻站点 + 换乘连接 */
function buildAdjacency(graph: MetroGraph) {
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
        addEdge({stationId: cur, lineId}, {stationId: prev, lineId}, d + STOP_DWELL);
        addEdge({stationId: prev, lineId}, {stationId: cur, lineId}, d + STOP_DWELL);
      }
      // 换乘：同站切换线路
      const st = stationMap.get(cur)!;
      if (st.lineIds.length > 1) {
        for (const other of st.lineIds) {
          if (other !== lineId) {
            addEdge({stationId: cur, lineId}, {stationId: cur, lineId: other}, TRANSFER_PENALTY);
          }
        }
      }
    }
  }
  return {adj, stationMap};
}

/** Dijkstra 求最优路线 */
export function planRoute(
  graph: MetroGraph,
  fromStationId: string,
  toStationId: string,
): RoutePlan | null {
  if (fromStationId === toStationId) return null;
  const {adj, stationMap} = buildAdjacency(graph);
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
    const segIdxStart = line.stationIds.indexOf(legStations[0]);
    let distance = 0;
    for (let k = 0; k < legStations.length - 1; k++) {
      const idx = line.stationIds.indexOf(legStations[k]);
      distance += line.segmentDistances[idx] ?? 0;
    }
    legs.push({
      lineId,
      lineName: line.name,
      lineColor: line.color,
      stationIds: legStations,
      stopCount: Math.max(0, legStations.length - 1),
      distance,
    });
    void segIdxStart;
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
