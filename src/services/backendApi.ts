import {APP_CONFIG} from '@/config/app';

const BASE = APP_CONFIG.metroApiBase;

/**
 * 通用 GET：从后端 /api/<resource> 拉取集合。
 * 后端不可用时（未配置 / 离线 / 404）抛出错误，调用方负责回落本地种子。
 */
export async function fetchCollection<T>(resource: string, query?: Record<string, string>): Promise<T[]> {
  if (!BASE) {
    console.warn(`[MetroApp][backendApi] metroApiBase 未配置，将回落本地种子数据: ${resource}`);
    throw new Error('metroApiBase 未配置');
  }
  const qs = query ? '?' + new URLSearchParams(query).toString() : '';
  const url = `${BASE}/api/${resource}${qs}`;
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {'Content-Type': 'application/json'},
    });
  } catch (e) {
    console.warn(`[MetroApp][backendApi] 请求失败(网络不可达?)，将回落本地种子: ${url} | ${(e as Error).message}`);
    throw e;
  }
  const cost = Date.now() - t0;
  if (!res.ok) {
    console.warn(`[MetroApp][backendApi] 接口返回 ${res.status}，将回落本地种子: ${url} (${cost}ms)`);
    throw new Error(`GET /api/${resource} -> ${res.status}`);
  }
  const body = (await res.json()) as {data?: T[]} | T[];
  const list = Array.isArray(body) ? body : ((body.data as T[]) ?? []);
  console.log(`[MetroApp][backendApi] 拉取成功: ${url} (${cost}ms, ${list.length} 条)`);
  return list;
}
