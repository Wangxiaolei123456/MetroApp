// 商城服务层：复用 Metro.IOS 既有后端（/shop/*、/api/user/*）。
//
// 设计原则（遵循用户要求：不再自建 metro-backend 商城模块）：
//   - 优先调用 Metro.IOS 远端 SERVER_URL 的真实接口；
//   - 当 mallServerUrl 未配置或请求失败时，回落本地 Mock，保证页面可完整演示。
//
// 参考 Metro.IOS/Zuiditie：
//   - 商品列表：GET {SERVER_URL}/shop/products（H5 /shop/index 同源 JSON）
//   - 购物车：  GET/POST/DELETE {SERVER_URL}/api/user/shopcart
//   - 下单（对齐 Metro.IOS）：
//       1) GET  {SERVER_URL}/api/user/ordertrade     -> orderID（锁定库存）
//       2) POST {SERVER_URL}/api/user/order          -> 真实订单 id（act=save_order）
//   - 我的订单：GET {SERVER_URL}/api/user/orders（H5，本 App 用 ordertrade 列表回落）
//   - 用户积分：GET {SERVER_URL}/api/user/info -> data.totalScore
//   - 支付方式：积分抵扣（usePointsStore.spend），不使用第三方支付。
import {APP_CONFIG} from '@/config/app';
import {METRO_API_BASE} from '@/config/env';
import {
  BackendOrder,
  Cart,
  CartGood,
  CartGroup,
  CreateOrderResult,
  MallOrder,
  MallProduct,
  OrderTradeParams,
  OrderTradeResult,
  PayMethod,
} from '@/types/mall';

const BASE = APP_CONFIG.mallServerUrl;

/** 通用请求参数：Metro.IOS 标准公共参数 */
const COMMON: Record<string, string> = {
  cityCode: '0755',
  tid: 'bugu',
  mobileType: 'IOS',
  walletversion: '164',
};

/** Metro.IOS 侧 access_token：MetroApp 当前未对接 Metro.IOS 账号体系，交由后端按游客处理。
 *  若后续打通 Metro.IOS 登录，可在此返回真实 token。 */
function getAccessToken(): string {
  return '';
}

/** 补全图片相对路径：Metro.IOS 图片前缀为 {SERVER_URL}/url/img */
export function resolveImage(path?: string): string {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  if (!BASE) return path;
  const base = BASE.replace(/\/$/, '');
  if (path.startsWith('/')) return `${base}${path}`;
  return `${base}/url/img/${path}`;
}

async function mallGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!BASE) throw new Error('mallServerUrl 未配置');
  const token = getAccessToken();
  const qs = new URLSearchParams({...COMMON, ...params});
  if (token) qs.set('access_token', token);
  const url = `${BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}?${qs.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`mall请求失败 ${res.status}`);
  return (await res.json()) as T;
}

/** 表单 POST（Metro.IOS 用 requestMethod=METHOD_POST，参数放 body） */
async function mallPost<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!BASE) throw new Error('mallServerUrl 未配置');
  const token = getAccessToken();
  const qs = new URLSearchParams({...COMMON, ...params});
  if (token) qs.set('access_token', token);
  const url = `${BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}?${qs.toString()}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: qs.toString(),
  });
  if (!res.ok) throw new Error(`mall请求失败 ${res.status}`);
  return (await res.json()) as T;
}

// ===================== Mock 回落数据 =====================
const MALL_SEED_PRODUCTS: MallProduct[] = [
  {
    id: '1001',
    title: '深圳通一日票',
    image: 'https://picsum.photos/seed/metro-ticket/400/400',
    price: 25,
    point: 200,
    marketPrice: 30,
    sales: 1280,
    stock: 999,
    maxNum: 5,
    merchantID: 1,
    merchantName: '深圳地铁官方',
    delivery: 2,
    desc: '24 小时内不限次乘坐地铁，适合游客与通勤族。',
  },
  {
    id: '1002',
    title: '地铁文创帆布袋',
    image: 'https://picsum.photos/seed/metro-bag/400/400',
    price: 39,
    point: 350,
    marketPrice: 49,
    sales: 642,
    stock: 500,
    maxNum: 3,
    merchantID: 2,
    merchantName: '布谷生活馆',
    delivery: 3,
    desc: '环保帆布材质，地铁主题印花，容量大耐用好看。',
  },
  {
    id: '1003',
    title: '无线蓝牙耳机',
    image: 'https://picsum.photos/seed/metro-earbuds/400/400',
    price: 99,
    point: 1200,
    marketPrice: 159,
    sales: 318,
    stock: 200,
    maxNum: 2,
    merchantID: 3,
    merchantName: '数码优选',
    delivery: 1,
    desc: '低延迟蓝牙 5.3，20 小时续航，通勤路上好伴侣。',
  },
  {
    id: '1004',
    title: '地铁联名咖啡券',
    image: 'https://picsum.photos/seed/metro-coffee/400/400',
    price: 18,
    point: 150,
    marketPrice: 22,
    sales: 2103,
    stock: 999,
    maxNum: 10,
    merchantID: 2,
    merchantName: '布谷生活馆',
    delivery: 2,
    desc: '站内合作咖啡品牌通用兑换券，到店自提。',
  },
  {
    id: '1005',
    title: '便携充电宝 10000mAh',
    image: 'https://picsum.photos/seed/metro-powerbank/400/400',
    price: 69,
    point: 800,
    marketPrice: 99,
    sales: 476,
    stock: 300,
    maxNum: 2,
    merchantID: 3,
    merchantName: '数码优选',
    delivery: 1,
    desc: '轻薄可登机，双向快充，出门在外不断电。',
  },
  {
    id: '1006',
    title: '地铁主题盲盒',
    image: 'https://picsum.photos/seed/metro-blindbox/400/400',
    price: 49,
    point: 480,
    marketPrice: 59,
    sales: 892,
    stock: 400,
    maxNum: 4,
    merchantID: 2,
    merchantName: '布谷生活馆',
    delivery: 3,
    desc: '随机款列车/车站造型，集齐一整套更有趣。',
  },
];

// 本地 Mock 购物车（userId -> 行），仅回落时使用
const mockCarts = new Map<string, CartGroup[]>();

// ===================== 对外 API =====================

/**
 * 拉取商品列表。
 * 数据源：优先 metro-backend /api/products（由 metro-admin 配置，支持积分价/美元价与支付方式）；
 * 失败或未配置时回落本地 Mock，保证页面可演示。
 */
export async function fetchProducts(cityId?: string): Promise<MallProduct[]> {
  if (METRO_API_BASE) {
    try {
      const q = cityId ? `?cityId=${encodeURIComponent(cityId)}` : '';
      const res = await fetch(`${METRO_API_BASE}/api/products${q}`);
      if (!res.ok) throw new Error(`商品接口返回 ${res.status}`);
      const list = (await res.json()) as Array<{
        id: string;
        title: string;
        titleEn?: string;
        imageUrl?: string;
        pricePoints: number;
        priceUsd: number;
        payMethods: ('points' | 'usd')[];
        cityId?: string | null;
        stock: number;
        status: 'online' | 'offline';
      }>;
      const mapped: MallProduct[] = list
        .filter((p) => p.status === 'online')
        .map((p) => ({
          id: p.id,
          title: p.titleEn ? `${p.title} ${p.titleEn}` : p.title,
          image: p.imageUrl ?? '',
          price: p.priceUsd || 0,
          point: p.pricePoints || 0,
          priceUsd: p.priceUsd || 0,
          payMethods: (p.payMethods ?? ['points']) as MallProduct['payMethods'],
          marketPrice: p.priceUsd || 0,
          sales: 0,
          stock: p.stock || 0,
          maxNum: 5,
          merchantID: 1,
          merchantName: 'MetroChain',
          delivery: 2,
          desc: '',
        }));
      if (mapped.length || list.length) return mapped;
      throw new Error('空列表');
    } catch (e) {
      console.warn(`[mall] 商品从 metro-backend 拉取失败，回落 mock: ${(e as Error).message}`);
    }
  }
  return MALL_SEED_PRODUCTS;
}

/** 拉取用户积分余额（优先远端 /api/user/info，失败回落 usePointsStore 本地值由调用方处理） */
export async function fetchUserScore(): Promise<number> {
  try {
    const data = await mallGet<{data?: {totalScore?: number}; totalScore?: number}>('api/user/info');
    const ts = data?.data?.totalScore ?? data?.totalScore;
    if (typeof ts === 'number') return ts;
    throw new Error('无积分字段');
  } catch {
    return 0;
  }
}

/** 拉取购物车（优先远端，失败回落本地 Mock） */
export async function fetchCart(userId: string): Promise<Cart> {
  try {
    const data = await mallGet<{obj?: CartGroup[]} | CartGroup[]>('api/user/shopcart');
    const list = Array.isArray(data) ? data : ((data as any).obj ?? []);
    if (Array.isArray(list)) {
      return list.map(g => ({
        ...g,
        goods: (g.goods ?? []).map((gd: CartGood) => ({...gd, logoUrl: resolveImage(gd.logoUrl), selected: gd.selected ?? true})),
      }));
    }
    throw new Error('空购物车');
  } catch {
    return mockCarts.get(userId) ?? [];
  }
}

/** 改数量（远端 POST，失败回落 Mock） */
export async function updateCartQty(userId: string, shopCartID: number, num: number): Promise<Cart> {
  try {
    await mallGet<unknown>('api/user/shopcart', {shopCartID: String(shopCartID), num: String(num), _method: 'POST'});
    return fetchCart(userId);
  } catch {
    const groups = mockCarts.get(userId) ?? [];
    for (const g of groups) {
      const good = g.goods.find(x => x.shopCartID === shopCartID);
      if (good) good.num = num;
    }
    mockCarts.set(userId, groups);
    return groups;
  }
}

/** 删除购物车行（远端 DELETE，失败回落 Mock） */
export async function removeCartItem(userId: string, shopCartID: number): Promise<Cart> {
  try {
    await mallGet<unknown>('api/user/shopcart', {shopCartID: String(shopCartID), _method: 'DELETE'});
    return fetchCart(userId);
  } catch {
    const groups = (mockCarts.get(userId) ?? []).map(g => ({
      ...g,
      goods: g.goods.filter(x => x.shopCartID !== shopCartID),
    })).filter(g => g.goods.length > 0);
    mockCarts.set(userId, groups);
    return groups;
  }
}

/** 加入购物车（远端 POST，失败回落 Mock） */
export async function addToCart(userId: string, product: MallProduct, num = 1): Promise<Cart> {
  try {
    await mallGet<unknown>('api/user/shopcart', {
      productId: String(product.id),
      num: String(num),
      merchantID: String(product.merchantID),
      _method: 'POST',
    });
    return fetchCart(userId);
  } catch {
    const groups = mockCarts.get(userId) ?? [];
    let group = groups.find(g => g.merchantID === product.merchantID);
    if (!group) {
      group = {merchantID: product.merchantID, merchantName: product.merchantName, deliveryMode: product.delivery, goods: []};
      groups.push(group);
    }
    const id = Date.now();
    group.goods.push({
      shopCartID: id,
      logoUrl: resolveImage(product.image),
      title: product.title,
      point: product.point,
      price: product.price,
      marketPrice: product.marketPrice,
      num,
      maxNum: product.maxNum,
      delivery: product.delivery,
      selected: true,
    });
    mockCarts.set(userId, groups);
    return groups;
  }
}

/** 第一步：ordertrade —— 锁定库存、生成预售 orderID（对齐 GET /api/user/ordertrade） */
export async function orderTrade(params: OrderTradeParams): Promise<OrderTradeResult> {
  const data = await mallGet<{obj?: {ordertradeJson?: OrderTradeResult}}>('api/user/ordertrade', {
    shopcart_ios: params.shopcart_ios,
    merchantID: String(params.merchantID),
    delivery: String(params.delivery),
  });
  const json = data.obj?.ordertradeJson;
  if (!json || !json.orderID) throw new Error('ordertrade 返回异常');
  return json;
}

/** 第二步：创建订单 —— POST /api/user/order（对齐 Metro.IOS act=save_order） */
export async function createOrder(input: {
  orderID: string;
  delivery: number;
  point: number;
  requireInvoice?: number;
  /** 支付方式：积分抵扣或美元（USD 预留 UptickPay，后期接入真实收银） */
  payMethod?: 'points' | 'usd';
}): Promise<CreateOrderResult> {
  const data = await mallPost<CreateOrderResult>('api/user/order', {
    orderID: input.orderID,
    delivery: String(input.delivery),
    point: String(input.point),
    requireInvoice: String(input.requireInvoice ?? 0),
    invoiceTitle: '',
    act: 'save_order',
    payMethod: input.payMethod ?? 'points',
  });
  if (!data.id) throw new Error('创建订单失败');
  return {...data, payMethod: input.payMethod ?? 'points'};
}

/** 我的订单（远端为 H5，这里提供本地 Mock 列表；接入真实 H5 时可在 WebView 打开） */
export async function fetchOrders(_userId: string): Promise<MallOrder[]> {
  // Metro.IOS 订单为 H5（/api/user/orders）。本 RN 版在接入真实后端时，
  // 可改为打开 WebView 或在服务层缓存本地生成的订单。这里返回空列表即可由页面提示。
  return [];
}

/**
 * 列出当前用户的后端订单（UptickPay / metro-backend）。
 * 优先返回后端订单；未配置后端地址时返回空数组。
 */
export async function listBackendOrders(): Promise<BackendOrder[]> {
  if (!METRO_API_BASE) return [];
  try {
    const res = await fetch(`${METRO_API_BASE}/api/orders`);
    if (!res.ok) throw new Error(`订单列表接口返回 ${res.status}`);
    const data = (await res.json()) as BackendOrder[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ===================== UptickPay / metro-backend 订单 =====================
//
// USD 支付链路：
//   1) 调后端 POST /api/orders 创建订单；usd 时后端会调用 Uptick 创建收银台支付单，
//      返回 upCheckoutUrl。
//   2) 客户端用 Linking.openURL(upCheckoutUrl) 跳转 Uptick 收银台（浏览器）。
//   3) 用户在收银台完成支付后，Uptick 通过 notifyUrl 通知后端更新订单状态；
//      客户端回到前台时轮询 GET /api/orders/:id 获取最新状态。

/** 创建后端订单（积分 / USD）。返回订单信息，USD 时含 upCheckoutUrl。 */
export async function createBackendOrder(input: {
  productId: string;
  payMethod: PayMethod;
  quantity?: number;
  /** 支付完成回跳地址（Uptick 收银台用；如 metroapp://pay/result?orderId=...） */
  returnUrl?: string;
}): Promise<BackendOrder> {
  if (!METRO_API_BASE) throw new Error('未配置后端地址');
  const res = await fetch(`${METRO_API_BASE}/api/orders`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      productId: input.productId,
      payMethod: input.payMethod,
      quantity: input.quantity ?? 1,
      returnUrl: input.returnUrl,
    }),
  });
  const data = (await res.json()) as BackendOrder & {message?: string};
  if (!res.ok) throw new Error(data.message || `下单失败 ${res.status}`);
  return data;
}

/** 查询后端订单最新状态（含 Uptick 支付状态同步）。 */
export async function getBackendOrder(id: string): Promise<BackendOrder> {
  if (!METRO_API_BASE) throw new Error('未配置后端地址');
  const res = await fetch(`${METRO_API_BASE}/api/orders/${id}`);
  const data = (await res.json()) as BackendOrder & {message?: string};
  if (!res.ok) throw new Error(data.message || `查询订单失败 ${res.status}`);
  return data;
}
