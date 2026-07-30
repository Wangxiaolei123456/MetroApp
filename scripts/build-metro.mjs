// 生成真实地铁全网数据（多城市）到 src/data/metroData.ts
// 数据源（均经 jsDelivr CDN，沙箱/本机均可直连）：
//   上海: ZhengBryan/ShangHai-Metro-Transfer（坐标真实 WGS-84，含 lines + edges）
//   香港: johnleungck/MTR-Stations-Coordinates-JSON（真实 WGS-84 站坐标；线路顺序内置，机场两站补充真实坐标）
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const SH_URL =
  'https://cdn.jsdelivr.net/gh/ZhengBryan/ShangHai-Metro-Transfer@master/metroInfo.json';
const HK_URL =
  'https://cdn.jsdelivr.net/gh/johnleungck/MTR-Stations-Coordinates-JSON@main/mtrStationsCoord.json';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../src/data/metroData.ts');

// ===================== 工具 =====================
function rgbToHex(rgb) {
  if (!Array.isArray(rgb) || rgb.length < 3) return '#888888';
  return (
    '#' +
    rgb
      .slice(0, 3)
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  );
}

function orderLine(adj) {
  const nodes = [...adj.keys()];
  if (!nodes.length) return [];
  const endpoints = nodes.filter((n) => adj.get(n).size === 1);
  let start = endpoints[0] || nodes[0];
  const seq = [];
  const visited = new Set();
  let cur = start;
  let prev = null;
  while (cur && !visited.has(cur)) {
    visited.add(cur);
    seq.push(cur);
    const nb = [...adj.get(cur)].filter((n) => n !== prev);
    prev = cur;
    cur = nb.find((n) => !visited.has(n)) ?? null;
  }
  if (visited.size < nodes.length) {
    for (const n of nodes) {
      if (visited.has(n)) continue;
      const link = [...adj.get(n)].find((x) => visited.has(x));
      if (link) {
        const branch = [];
        const bVisited = new Set([link]);
        let bCur = n;
        let bPrev = link;
        while (bCur && !bVisited.has(bCur)) {
          bVisited.add(bCur);
          branch.push(bCur);
          const nb = [...adj.get(bCur)].filter((x) => x !== bPrev && !bVisited.has(x));
          bPrev = bCur;
          bCur = nb.find((x) => !bVisited.has(x)) ?? null;
        }
        const idx = seq.indexOf(link);
        seq.splice(idx + 1, 0, ...branch);
        branch.forEach((b) => visited.add(b));
      }
    }
  }
  if (
    seq.length > 2 &&
    adj.get(seq[0]) &&
    adj.get(seq[0]).has(seq[seq.length - 1]) &&
    seq[0] !== seq[seq.length - 1]
  ) {
    seq.push(seq[0]);
  }
  return seq;
}

// ===================== 上海 =====================
async function buildShanghai() {
  const res = await fetch(SH_URL);
  if (!res.ok) throw new Error(`上海数据 HTTP ${res.status}`);
  const data = await res.json();
  const linesRaw = data.lines || [];
  const stationsRaw = data.stations || [];

  const lineNameToId = {};
  const linesMeta = linesRaw.map((l) => {
    const m = String(l.name).match(/(\d+)/);
    const id = 'l' + (m ? m[1] : l.name);
    lineNameToId[l.name] = id;
    return { id, name: l.name, color: rgbToHex(l.color) };
  });

  const stationMap = new Map();
  const lineAdj = {};
  const ensureStation = (name, rp) => {
    if (!stationMap.has(name)) stationMap.set(name, { name, rp: rp || null, lineIds: new Set() });
    return stationMap.get(name);
  };

  for (const s of stationsRaw) {
    const st = ensureStation(s.name, s['real-position']);
    const edges = Array.isArray(s.edges) ? s.edges : [];
    for (const e of edges) {
      const lid = lineNameToId[e.line];
      if (!lid) continue;
      st.lineIds.add(lid);
      lineAdj[lid] = lineAdj[lid] || new Map();
      if (!lineAdj[lid].has(s.name)) lineAdj[lid].set(s.name, new Set());
      if (!lineAdj[lid].has(e.to)) lineAdj[lid].set(e.to, new Set());
      lineAdj[lid].get(s.name).add(e.to);
      lineAdj[lid].get(e.to).add(s.name);
    }
  }

  const stations = [...stationMap.values()].map((st) => {
    const rp = st.rp || [121.4737, 31.2304];
    const lineIds = [...st.lineIds];
    return {
      id: st.name,
      cityId: 'demo',
      name: st.name,
      nameEn: st.name,
      location: { latitude: rp[1], longitude: rp[0] },
      lineIds,
      isTransfer: lineIds.length > 1,
    };
  });
  const stationIdSet = new Set(stations.map((s) => s.id));

  const lines = linesMeta
    .map((m) => {
      const adj = lineAdj[m.id] || new Map();
      const ids = orderLine(adj);
      return {
        id: m.id,
        cityId: 'demo',
        name: m.name,
        nameEn: 'Line ' + m.id.replace('l', ''),
        color: m.color,
        stationIds: ids.filter((n) => stationIdSet.has(n)),
        segmentDistances: [],
      };
    })
    .filter((l) => l.stationIds.length > 0);

  const city = {
    id: 'demo',
    name: '上海',
    nameEn: 'Shanghai',
    center: { latitude: 31.2304, longitude: 121.4737 },
    defaultGeofenceRadius: 600,
  };
  return { city, stations, lines };
}

// ===================== 香港 =====================
// 线路顺序（标准 MTR 英文名，与 johnleungck 站名精确对应）
const HK_SUPPLEMENT = {
  // johnleungck 缺失的机场快线两站（真实 WGS-84 补充）
  Airport: [113.9184, 22.308],
  'AsiaWorld-Expo': [113.9356, 22.321],
};
const HK_LINES = [
  {
    id: 'h_twl',
    name: '荃湾线',
    nameEn: 'Tsuen Wan Line',
    color: '#E4002B',
    ids: [
      'Tsuen Wan', 'Tai Wo Hau', 'Kwai Hing', 'Kwai Fong', 'Lai King', 'Mei Foo',
      'Lai Chi Kok', 'Cheung Sha Wan', 'Sham Shui Po', 'Prince Edward', 'Mong Kok',
      'Yau Ma Tei', 'Jordan', 'Tsim Sha Tsui', 'Admiralty', 'Central',
    ],
  },
  {
    id: 'h_isl',
    name: '港岛线',
    nameEn: 'Island Line',
    color: '#0072BC',
    ids: [
      'Kennedy Town', 'HKU', 'Sai Ying Pun', 'Sheung Wan', 'Central', 'Admiralty',
      'Wan Chai', 'Causeway Bay', 'Tin Hau', 'Fortress Hill', 'North Point',
      'Quarry Bay', 'Tai Koo', 'Sai Wan Ho', 'Shau Kei Wan', 'Heng Fa Chuen', 'Chai Wan',
    ],
  },
  {
    id: 'h_kwt',
    name: '观塘线',
    nameEn: 'Kwun Tong Line',
    color: '#00A34A',
    ids: [
      'Whampoa', 'Ho Man Tin', 'Yau Ma Tei', 'Mong Kok', 'Prince Edward', 'Shek Kip Mei',
      'Lok Fu', 'Wong Tai Sin', 'Diamond Hill', 'Choi Hung', 'Kowloon Bay',
      'Ngau Tau Kok', 'Kwun Tong', 'Lam Tin', 'Yau Tong', 'Tiu Keng Leng',
    ],
  },
  {
    id: 'h_sil',
    name: '南港岛线',
    nameEn: 'South Island Line',
    color: '#EBB700',
    ids: ['Admiralty', 'Ocean Park', 'Wong Chuk Hang', 'Lei Tung', 'South Horizons'],
  },
  {
    id: 'h_tkl',
    name: '将军澳线',
    nameEn: 'Tseung Kwan O Line',
    color: '#A362B7',
    ids: [
      'North Point', 'Quarry Bay', 'Yau Tong', 'Tiu Keng Leng', 'Tseung Kwan O',
      'Hang Hau', 'Po Lam', 'LOHAS Park',
    ],
  },
  {
    id: 'h_tcl',
    name: '东涌线',
    nameEn: 'Tung Chung Line',
    color: '#F7943E',
    ids: [
      'Hong Kong', 'Kowloon', 'Olympic', 'Nam Cheong', 'Lai King', 'Tsing Yi',
      'Sunny Bay', 'Tung Chung',
    ],
  },
  {
    id: 'h_drl',
    name: '迪士尼线',
    nameEn: 'Disneyland Resort Line',
    color: '#EC96A3',
    ids: ['Sunny Bay', 'Disneyland Resort'],
  },
  {
    id: 'h_ael',
    name: '机场快线',
    nameEn: 'Airport Express',
    color: '#00B3C4',
    ids: ['Hong Kong', 'Kowloon', 'Tsing Yi', 'Airport', 'AsiaWorld-Expo'],
  },
  {
    id: 'h_erl',
    name: '东铁线',
    nameEn: 'East Rail Line',
    color: '#1A4FA0',
    ids: [
      'Lo Wu', 'Sheung Shui', 'Fanling', 'Tai Wo',
      'Tai Po Market', 'University', 'Fo Tan', 'Racecourse', 'Sha Tin', 'Tai Wai',
      'Kowloon Tong', 'Mong Kok East', 'Hung Hom', 'Exhibition Centre', 'Admiralty',
    ],
  },
  {
    // 落马洲支线（不与主线共线，经上水连接），避免主线绕行
    id: 'h_lmc',
    name: '东铁线·落马洲支线',
    nameEn: 'East Rail Line (Lok Ma Chau)',
    color: '#1A4FA0',
    ids: ['Sheung Shui', 'Lok Ma Chau'],
  },
  {
    id: 'h_tml',
    name: '屯马线',
    nameEn: 'Tuen Ma Line',
    color: '#A52019',
    ids: [
      'Wu Kai Sha', 'Ma On Shan', 'Heng On', 'Tai Shui Hang', 'Shek Mun', 'City One',
      'Sha Tin Wai', 'Che Kung Temple', 'Tai Wai', 'Hin Keng', 'Diamond Hill', 'Kai Tak',
      'Sung Wong Toi', 'To Kwa Wan', 'Ho Man Tin', 'Austin', 'East Tsim Sha Tsui',
      'Tsim Sha Tsui', 'Nam Cheong', 'Mei Foo', 'Tsuen Wan West', 'Kam Sheung Road',
      'Yuen Long', 'Long Ping', 'Tin Shui Wai', 'Siu Hong', 'Tuen Mun',
    ],
  },
];

async function buildHongKong() {
  const res = await fetch(HK_URL);
  if (!res.ok) throw new Error(`香港数据 HTTP ${res.status}`);
  const arr = await res.json();
  const coord = new Map();
  for (const s of arr) coord.set(s.name, [parseFloat(s.long), parseFloat(s.lat)]);
  for (const [n, c] of Object.entries(HK_SUPPLEMENT)) coord.set(n, c);

  const stMap = new Map();
  const ensure = (name) => {
    if (!stMap.has(name)) stMap.set(name, { name, rp: coord.get(name), lines: new Set() });
    return stMap.get(name);
  };
  const missing = [];
  for (const ln of HK_LINES) {
    for (const id of ln.ids) {
      const st = ensure(id);
      if (!st.rp) missing.push(`香港站缺失坐标: ${id}（线路 ${ln.id}）`);
      st.lines.add(ln.id);
    }
  }
  if (missing.length) throw new Error('香港坐标缺失:\n' + missing.join('\n'));

  const stations = [...stMap.values()].map((st) => {
    const lineIds = [...st.lines];
    return {
      id: st.name,
      cityId: 'hk',
      name: st.name,
      nameEn: st.name,
      location: { latitude: st.rp[1], longitude: st.rp[0] },
      lineIds,
      isTransfer: lineIds.length > 1,
    };
  });
  const idSet = new Set(stations.map((s) => s.id));
  const lines = HK_LINES.map((ln) => ({
    id: ln.id,
    cityId: 'hk',
    name: ln.name,
    nameEn: ln.nameEn,
    color: ln.color,
    stationIds: ln.ids.filter((x) => idSet.has(x)),
    segmentDistances: [],
  }));

  const city = {
    id: 'hk',
    name: '香港',
    nameEn: 'Hong Kong',
    center: { latitude: 22.3193, longitude: 114.1694 },
    defaultGeofenceRadius: 600,
  };
  return { city, stations, lines };
}

// ===================== 输出 =====================
function graphTS(name, city, stations, lines) {
  const esc = (s) => JSON.stringify(s);
  const mkFn = `mk${name.charAt(0).toUpperCase()}${name.slice(1)}Station`;
  const stationLines = stations
    .map(
      (s) =>
        `  ${mkFn}(${esc(s.id)}, ${esc(s.name)}, ${s.location.latitude}, ${s.location.longitude}, [${s.lineIds
          .map((x) => esc(x))
          .join(', ')}]),`,
    )
    .join('\n');
  const lineLines = lines
    .map(
      (l) =>
        `  {\n    id: ${esc(l.id)},\n    cityId: ${esc(l.cityId)},\n    name: ${esc(
          l.name,
        )},\n    nameEn: ${esc(l.nameEn)},\n    color: ${esc(l.color)},\n    stationIds: [${l.stationIds
          .map((x) => esc(x))
          .join(', ')}],\n    segmentDistances: [],\n  },`,
    )
    .join('\n');
  return `const ${name}City: City = ${JSON.stringify(city, null, 2).replace(/\n/g, '\n  ')};

const ${name}Stations: Station[] = [
${stationLines}
];

function ${mkFn}(
  id: string,
  name: string,
  latitude: number,
  longitude: number,
  lineIds: string[],
): Station {
  return {
    id,
    cityId: ${esc(city.id)},
    name,
    nameEn: name,
    location: {latitude, longitude},
    lineIds,
    isTransfer: lineIds.length > 1,
  };
}

const ${name}Lines: MetroLine[] = [
${lineLines}
];

const ${name}Graph: MetroGraph = {
  city: ${name}City,
  lines: fillDistances(${name}Lines, ${name}Stations),
  stations: ${name}Stations,
};`;
}

async function main() {
  console.log('抓取并生成真实地铁数据（上海 + 香港）...');
  const sh = await buildShanghai();
  const hk = await buildHongKong();

  const esc = (s) => JSON.stringify(s);
  const out = `import {City, MetroLine, MetroGraph, Station} from '@/types';
import {haversine} from '@/utils/geo';

// 真实地铁全网数据（自动生成，勿手改；重生成见 scripts/build-metro.mjs）。
// 坐标均为真实 WGS-84 经纬度：上海取自 ZhengBryan/ShangHai-Metro-Transfer，
// 香港取自 johnleungck/MTR-Stations-Coordinates-JSON（机场快线两站为补充真实坐标）。

/** 根据相邻站点坐标计算每段站间距 */
function fillDistances(lines: MetroLine[], stations: Station[]): MetroLine[] {
  const map = new Map(stations.map((s) => [s.id, s]));
  return lines.map((line) => {
    const seg: number[] = [];
    for (let i = 0; i < line.stationIds.length - 1; i++) {
      const a = map.get(line.stationIds[i])!;
      const b = map.get(line.stationIds[i + 1])!;
      seg.push(Math.round(haversine(a.location, b.location)));
    }
    return {...line, segmentDistances: seg};
  });
}

${graphTS('shanghai', sh.city, sh.stations, sh.lines)}

${graphTS('hongKong', hk.city, hk.stations, hk.lines)}

// ===== 可扩展：更多城市在此追加 =====
export const CITIES: Record<string, MetroGraph> = {
  demo: shanghaiGraph,
  hk: hongKongGraph,
};

export function getCityGraph(cityId: string): MetroGraph {
  return CITIES[cityId] ?? shanghaiGraph;
}

export const DEFAULT_CITY_ID = 'demo';
export const SUPPORTED_CITIES: {id: string; name: string; nameEn: string}[] = [
  {id: 'demo', name: '上海', nameEn: 'Shanghai'},
  {id: 'hk', name: '香港', nameEn: 'Hong Kong'},
];
`;
  writeFileSync(OUT, out, 'utf8');

  // 校验 + 报告
  const report = (label, g) => {
    const adj = new Map();
    g.stations.forEach((s) => adj.set(s.id, new Set()));
    g.lines.forEach((l) => {
      for (let i = 0; i < l.stationIds.length - 1; i++) {
        adj.get(l.stationIds[i]).add(l.stationIds[i + 1]);
        adj.get(l.stationIds[i + 1]).add(l.stationIds[i]);
      }
    });
    const vis = new Set([g.stations[0].id]);
    const st = [g.stations[0].id];
    while (st.length) {
      const n = st.pop();
      adj.get(n).forEach((x) => !vis.has(x) && (vis.add(x), st.push(x)));
    }
    const orphan = g.stations.filter((s) => !vis.has(s.id)).map((s) => s.name);
    console.log(
      `   [${label}] 线路 ${g.lines.length} / 站 ${g.stations.length} / 换乘 ${
        g.stations.filter((s) => s.isTransfer).length
      } / 孤立 ${orphan.length ? orphan.join('、') : '无'}`,
    );
  };
  console.log('✅ 已生成', OUT);
  report('上海', sh);
  report('香港', hk);
}

main().catch((e) => {
  console.error('❌ 生成失败:', e.message);
  process.exit(1);
});
